# ADR-ERP-024 — Cofre criptográfico PostgreSQL + AWS KMS; menu de 13 grupos, DS v3 e protótipos completos
**Estado: RATIFICADO PELO QUALITY OWNER EM 11/10/2026; implementação depende de Portões 1/2 e PR.**
**Escopo:** expansão ERP E01..E12, prevalece como decisão explícita posterior sobre formulações anteriores de Secret Manager obrigatório para armazenamento de cada certificado e menu invariável de 9 grupos. A Constituição/DECISOES deve registrar emenda para ampliar o menu sem alterar a hierarquia das 39 rotas originais.
## Contexto e decisão
- O projeto usa PostgreSQL 18 + Drizzle/NestJS 11, DS v3 Direção A (AD-10), 39 rotas na `develop` e 11 perfis canônicos (AD-04). Expansão propõe 61 interfaces e integrações estaduais, 3 bancos e batch.
- **AD-ERP-COFRE:** PostgreSQL é **repositório de segredos e artefatos privados SOMENTE CIFRADOS**. Criptografia e descriptografia no backend NestJS (AES-256-GCM), envelope encryption: DEK aleatória por segredo/versão, KEK não exportável sob AWS KMS, acessível por identidade de execução IAM da aplicação; não guardar chave mestra no banco ou em .env.
- **AD-ERP-MENU:** sidebar possui **13 grupos principais**, preservando a ordem relativa dos 9 atuais e inserindo 4: Fiscal, Financeiro, Bancos & Tesouraria, Contabilidade. O grupo Administração comporta a Central de Integrações E12 com sete views. O padrão visual é DS v3 Direção A com componentes reais do design system. Submenus recolhíveis para não apresentar 61 links em primeiro nível.
- **AD-ERP-PROTÓTIPO:** implementado protótipo navegável em [index.html](../../prototipos/erp-integrado-v1/index.html), matriz tela a tela em [MATRIZ-INTEGRAL-INTERFACES.md](../../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md), 61 telas de expansão, 39 links à linha-base, oito jornadas, validações/erros/aprovação simulados, **sem APIs reais**. Nenhum worker pode substituí-lo por CRUD genérico ou versões MVP; implementar todos os campos, estados, exceções e ações de cada contrato de domínio.
## Fronteira de segurança e esquema físico
Tabelas propostas:
```sql
CREATE TABLE integration_secret_versions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('HML','PROD')),
  service text NOT NULL,
  purpose text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  cipher_alg text NOT NULL CHECK (cipher_alg = 'AES-256-GCM'),
  ciphertext bytea NOT NULL,
  nonce bytea NOT NULL CHECK (octet_length(nonce)=12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag)=16),
  encrypted_data_key bytea NOT NULL,
  kms_key_arn text NOT NULL,
  encryption_context_hash bytea NOT NULL,
  cert_thumbprint_sha256 text,
  status text NOT NULL CHECK (status IN ('PENDING','ACTIVE','RETIRED','REVOKED')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  approved_by uuid,
  UNIQUE (company_id, environment, service, purpose, version)
);
```
DDL ilustra contrato; worker deve ajustar convenções reais (`uuidv7`, status, migration drizzle-kit, NUMERIC etc.), índices e criptografia sem SQL manual em migrations.
### Pipeline CREATE/UPLOAD
1. Usuário autorizado escolhe empresa, estabelecimento, finalidade/serviço, HML/PROD. Upload A1 PFX/P12 ou PEM/KEY bancário permitido por serviço via HTTPS/multipart no backend. Senha transitória nunca em log/BD, sem uso de cert real nos protótipos.
2. Backend valida formato, senha, pública/privada, validade, cadeia/uso adequado e CPF/CNPJ do titular conforme norma e empresa; verificação OCSP/CRL quando disponível. Falha é explícita e não gera binário persistido em claro.
3. Obtém DEK aleatória de 256 bits via `KMS GenerateDataKey` com `EncryptionContext={companyId, environment, service, purpose, secretVersion}`. Mantém plaintext DEK **apenas durante cifragem**. Nonce aleatória **nova a cada cifragem**, 96 bits.
4. Encripta com AES-256-GCM no NestJS, AAD canônica e imutável (mesmos campos do contexto + ID/vigência); captura `ciphertext`, `nonce`, `auth_tag` e `encryptedDataKey`; descarrega buffers em memória quando possível. Armazena em `BYTEA`; somente metadata visível pela UI. Não persistir plaintext/decrypted blob/PFX em disco temporário.
5. Job/serviço obtém versão ativa por binding e propósito, confere RBAC da identidade workload, `KMS Decrypt` com mesmo contexto e verifica GCM/AAD; usa chave/PKCS12 apenas dentro do processo por menor tempo necessário. Revogação, vencimento ou mismatch de empresa/ambiente bloqueiam.
6. Ao rotacionar, criar versão imutável nova; jobs fixam versão no início do run, com dupla aprovação para PROD; arquivo anterior mantém trilha/retencão necessária e é desativado conforme plano seguro.
### Segurança de chaves e recuperação
- AWS KMS é **único provedor de KEK por ambiente**, separado do RDS. IAM `kms:GenerateDataKey`/ `kms:Decrypt` sob role de backend/worker limitada ao key ARN e contexto quando viável. IAM do banco/analista sem `kms:Decrypt`. Key policy, CloudTrail, alertas de uso anômalo e segregação HML/PROD são mandatórios.
- RDS com encryption at rest + TLS é camada adicional, **não substitui** criptografia applicativa. Administrador SQL pode ler ciphertext/metadata mas não plaintext sem chave IAM.
- Os backups devem abranger PostgreSQL e disponibilidade futura da KMS KEK (incluindo políticas e estado da chave); impedir exclusão precipitada da key. Disaster recovery exige teste de restore e verificação de decrypt por papel de recuperação autorizado.
- Chaves mestras não ficam no DB, GitHub, `.env`, Next.js, logs, tabelas genéricas `parametros.valorJson` ou arquivos servidos estaticamente. Token Bearer nunca exposto para download.
- A necessidade de múltiplas regiões/contas/KMS key rotation e custos devem ser dimensionados, mas **não criam uma nova instância Secrets Manager por certificado**.
## Menu (ordem, preservação das 39 rotas)
| Ordem | Grupo | Escopo |
|---:|---|---|
| 01 | Comercial | original (5 rotas), sem mudança |
| 02 | Gestão | original (6 rotas), sem mudança |
| 03 | Recebimento & Balança | original (3 rotas) |
| 04 | Desossa | original (3 rotas) |
| 05 | Estoque | original (3 rotas) |
| 06 | Carga | original (3 rotas) |
| 07 | Faturamento | original (4 rotas) e extensão E10 integrada sem substituir EISS histórico |
| 08 | **Fiscal** | novo: motor tributário, NF-e 55, entrada DF-e, devolução, apuração |
| 09 | **Financeiro** | novo: AP, AR, despesas, cobrança/parcelas |
| 10 | **Bancos & Tesouraria** | novo: API E06, E07, E08 e fallback arquivo E11 |
| 11 | **Contabilidade** | novo: E09 razão/diário, plano, DRE/BP, SPED/fechamento |
| 12 | Cadastros & Regras | original (8 rotas) e cadastro estabelecimento E01 mediante aprovação |
| 13 | Administração | original (4 rotas) + Central de Integrações E12 (7 views com subnav/abas) |
Os nove grupos originais permanecem em ordem relativa. **O frontend prototipado não altera o MENU_V2/menus-canonicos da develop**, apenas formaliza o contrato para as novas ondas.
### RBAC
- AD-04 retém **11 perfis canônicos**. Personas `fiscal`, `contador`, `financeiro`, `tesouraria`, `auditoria` do protótipo servem à revisão de jornada, **não são perfis canônicos novos aprovados**. A matriz autoriza novas permissões e perfis configuráveis com decisão explícita de alçada/segregação antes de novas seeds.
- Menu visual filtrado `perfis.menus_visiveis`, backend NestJS RbacGuard valida cada ação e empresa; bloquear papéis não autorizados mesmo via URL direta.
### Navegação e telas detalhadas
- Sidebar de 13 grupos recolhíveis, com 39 rotas originais (sem replicar a lógica operacional), subgrupos por épico, busca global e links `#E##-T##`/`#E11-V##`/`#E12-V##`.
- Em cada nova interface: cabeçalho com origem/epic, filtros e tabela, detalhe, ficha com todos os campos da especificação, formulários de criação/edição, tabs Movimentos/Regras/Exceções/Histórico/Integrações/Aceite, estados empty/error/conflict, ações de domínio e variantes por jornada. Ações sensíveis são **simuladas e bloqueadas contra efeitos reais**; o Kiro deve ligar apenas gateways homologados ao backend real.
- Certificado: upload → validar → aprovar por responsável → binding serviço/ambiente → teste sandbox → ativação/rotação; não autenticar com certificado vencido e nunca expor key.
- Conciliação: API preferencial ou arquivo homologado convergem à transação econômica única; não confundir remessa, retorno e extrato nem baixar pelo valor isolado.
## Critérios do Portão 1/2
- E12-T00 atualizar ADR e contrato físico PostgreSQL+KMS; E12-T02 implementar SecretProvider/PostgresCiphertextProvider com fake CI; E12-T03/05 implementar importação/CSR/rotação; E10-T04 governança menu e RBAC; E11-T00 continua gate cross de eventos.
- Portão 1: protótipo completo + matriz [61 telas](../../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md), validação das personas do negócio e alçadas, 13 grupos e 39 rotas preservadas, sem necessidade de retrabalho UI após implantar.
- Portão 2: comparação visual DS v3 e aceitação de todos os estados, fluxos, efeitos e erros (não apenas screenshot de uma tela feliz). Sem integração real no protótipo; produção exige CI, homologação bancos/SEFAZ e UAT por responsável.
## Requisitos inversos
Proibido: armazenamento de plaintext/certificado privado em PostgreSQL, KEK no banco, senha em JSONB, `pgcrypto` com chave enviada ao servidor de banco como substituto da cifragem na aplicação, Secrets Manager obrigatório por certificado, menu extra além dos 13 sem aprovação, telas MVP/CRUD raso, alteração das 39 rotas originais sem aditivo, novo perfil canônico sem ratificação, emissão fiscal ou pagamentos simulados como reais.
