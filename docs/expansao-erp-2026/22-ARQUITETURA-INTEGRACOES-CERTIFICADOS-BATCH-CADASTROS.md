# AlphaCarnes — Arquitetura de integrações administráveis, certificados digitais e batch
**Versão 1.0 — 11/10/2026, base develop SHA db9d8ac1760a01c262c57a9f824d2c8fcf18291b.** Parecer de arquitetura, sem alteração de código; novas telas necessitam aprovação do protótipo/Constituição e Portão 1.
Fontes: [versões fiscais oficiais](20-CATALOGO-OFICIAL-INTEGRACOES-OUT-2026.md), [bancos](21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md), [E11](11-E11-FALLBACK-BANCARIO-ARQUIVOS.md).
**Decisão RATIFICADA (AD-18):** fundação única E12 para E01/02/03/06/07/08/09/11. PostgreSQL guarda configurações, metadados **E SEGREDOS/CERTIFICADOS NA FORMA DE CIPHERTEXT AES-256-GCM**, gerada no NestJS. KEK mestra sob AWS KMS fora do banco, por IAM; envelope DEK cifrada armazenada com ciphertext. Nenhuma credencial de banco/SEFAZ ou agenda de job operacional em .env.



## Decisão ratificada AD-18 (11/10/2026) — cofre no PostgreSQL e protótipos DS v3
Não existe uma tabela de parâmetro genérico que funcione como cofre. **A criptografia ocorre no backend**, com ciphertext e DEK cifrada no PostgreSQL, enquanto a KEK reside no AWS KMS, independente do RDS. Esquema `integration_secret_versions`, contexto e algoritmos: [ADR-ERP-024](24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md). Evitar Secrets Manager como repositório obrigatório por segredo; ele não foi selecionado. A aplicação pode consultar e usar a chave mediante identidade técnica autorizada sem expor valores na UI.
**Referência visual vinculante de 7 interfaces E12:** [Protótipo navegável DS v3](../prototipos/erp-integrado-v1/index.html#E12-V01) e [Matriz tela a tela](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md). UI completa com todas as abas, ações, exceções, evidências e erro: nenhuma redução a MVP é permitida nas tasks.

## 1. Diagnóstico cross com develop
| Artefato | Achado comprovado | Mudança exigida |
|---|---|---|
| app/backend/src/config/env.schema.ts e app.config.ts | DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET e configurações de infraestrutura vêm de process.env | bootstrap técnico permanece provisoriamente, sem ampliar para integrações; migração gradual de JWT/DB para secret injection/identidade de workload aprovada |
| .env.example e docker-compose.yml | variáveis atuais essenciais no desenvolvimento, inclusive JWT compartilhado front/back | não remover abruptamente ou quebrar CI; segredos de bootstrap devem ser protegidos no deploy, nunca armazenados em repositório |
| database/schema/parametros.schema.ts e modules/parametros | chave-valor JSONB sem classificação de segredo, com auditoria antes/depois; tela /admin/parametros | REJEITADO guardar senhas PFX, tokens, client secrets ou chave privada neste JSONB; criar cadastros especializados |
| integracoes/nfse/eiss-client.adapter.ts e faturamento | gateway incipiente municipal de serviço | NF-e modelo55 consome perfil/certificado da nova fundação, nunca herda segredos EISS por nome |
| modules/cadastros/ e RBAC | sistema operacional já tem menus/perfis | adicionar controle por perfil para funções sensíveis, sem reutilizar permissão genérica de parâmetros |
| AGENTS.md / Constituição | UI baseada em protótipo canônico, transação+auditoria, isolamento de gateways, CI fakes, eventos pós-commit | telas novas/menus somente após validação visual ou emenda explícita; batch externo é atividade backend e UI continua orientada a eventos, não polling |
**Mapa de ownership:** fundação é dona de provedor, perfil, ambiente, endpoint, credencial/certificado, lote/referência normativa e agenda; E06 é dono de contas/convênios bancários; E11 de arquivos e provenance; E07 de conciliação/baixa canônicas; E09 de razão; E02 de documentos fiscais. Não duplicar tabelas.


## 2. Modelo relacional (proposta de contratos a congelar no Planner)
- external_providers: id, code, description, kind(FISCAL/BANK/REFERENCE), status, officialDocumentationUrl.
- external_integration_profiles: id, companyId, establishmentId opcional, providerId, serviceCode, environment(HML/PRD), version, status(DRAFT/WAITING_EXTERNAL/HML_READY/HML_TESTED/PROD_REVIEW/ACTIVE/SUSPENDED/EXPIRED), bankAccountId opcional, contractId, certificateBindingId e createdBy/approvedBy.
- external_endpoints: profileId, serviceOperation, baseUrl, SOAP action quando aplicável, version, officialSourceId, environment, approvedBy, effectiveFrom/to. Validação de domínio/host obrigatório e aprovação antes de PRODUÇÃO.
- external_capabilities: profileId, capability, channel(API/FILE), currentContractVersion, status, fileLayoutRegistryId quando aplicável, rateLimit, enabledAt, testedAt.
- external_credentials: profileId, credentialType(OAUTH_CLIENT,API_KEY,WEBHOOK_SIGN), clientId quando não sigiloso, secretRef opaco, expiry, lastRotatedAt, status e permissionScope.
- external_certificates: companyId, purpose(NFE_SIGN,NFE_MTLS,BANK_MTLS,BANK_SIGN,SPED_SIGN,WEBHOOK_TLS,TRUST_CA), certificatePublic, thumbprintSHA256, serial, issuer, subject, subjectCnpj, notBefore, notAfter, keyAlgorithm, encryptedSecretVersionId (FK BYTEA ciphertext, nonce, tag, encryptedDEK, kmsKeyArn, AAD/context), validationStatus, uploadedBy, approvedBy, revokedAt.
- external_certificate_bindings: profileId, certificateId, purpose, approvedBy, validFrom/to, current; impedir sobreposição de dois certificados ativos no mesmo propósito/ambiente sem janela de rotação formal.
- external_contracts: provider, service, company, accountId, convenioMasked, wallet, officialEvidenceRef, agreedCapabilities, validFrom/to e bankApproval.
- external_reference_datasets: name, officialUrl, version, sourceTimestamp, checksum quando arquivo efetivamente baixado, effectiveFrom/to, status(STAGED/APPROVED/ACTIVE/RETIRED), approvedBy.
- external_job_definitions: id, profileId, operation, scheduleType(CRON/INTERVAL/MANUAL/EVENT), timezone, nextRunAt, checkpointJson, retryPolicy, concurrencyKey, lastConfigVersion, enabled, createdBy/approvedBy.
- external_job_runs: jobId, attempt, leaseToken, startedAt, endedAt, status, externalCorrelationId, input/outputCheckpoint, certVersion, profileVersion, errorCode (sem segredo), totalProcessed, auditId.
- external_job_leases: jobId UNIQUE, holder, leaseUntil, fencingToken. Infra de outbox/inbox e idempotência compartilhada, não esquema paralelo de dados financeiros.
**Restrições:** domínio + serviço + ambiente + estabelecimento com unicidade de perfil ativo; índice único para thumbprint por empresa e propósito; chave forte de job por empresa/serviço/operação/correlation; todos identificadores de empresa inclusive CNPJ alfanumérico string, não numérico.


## 3. Telas e formulários completos propostos
### INT-UI-01 — Painel /admin/integracoes
**Protótipo E12-V01:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V01) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Cartões SEFAZ/SP, Distribuição DF-e, Bradesco/Itaú/Santander, SPED e catálogos oficiais. Colunas provedor, empresa/estabelecimento, tipo de serviço, capability, HML/PRD, convênio mascarado, endpoint e versão, certificado, estado, última execução, próximo agendamento, falha. Ações criar, editar, duplicar somente metadata, testar sem efeito, ativar com aprovação, suspender, abrir logs. Em HML/PRD uma mesma aplicação pode usar configurações distintas, não misturar.
### INT-UI-02 — Certificados /admin/integracoes/certificados
**Protótipo E12-V02:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V02) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Campos: empresa, estabelecimento, finalidade, provedor, ambiente, formato PFX/P12 ou PEM+KEY quando suportado, upload arquivo, senha de uso único, thumbprint, serial, issuer, sujeito/CNPJ, validade, cadeia, status, origem, aprovado por. Ações importar, validar, testar assinatura/mTLS em HML, associar, rotacionar, substituir, suspender e revogar binding; nunca GET privateKey, exportar senha ou reexpor arquivo.
### INT-UI-03 — Apps bancários e credenciais
**Protótipo E12-V03:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V03) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Selecionar banco, empresa, conta, convênio, carteira, applicationId/workspaceId conforme produto, scopes, endpoint aprovado, clientId, cliente secret apenas write-only, certificado associado, webhook callback, capacidade, limites e plano de fallback. Ações solicitar acesso externo, cadastrar dados fornecidos, testar token TLS, homologar, ativar com dupla aprovação, suspender e renovar. Segredos nunca pré-preenchidos no edit.
### INT-UI-04 — Serviços fiscais e catálogos
**Protótipo E12-V04:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V04) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Estabelecimento, CRT, IE, credenciamento, série/número, endpoints SEFAZ v4.00, DF-e ambiente nacional, certificado A1, esquemas/NT/benefícios e vigência. Ações validar cadastro, testar status, simular XSD, baixar tabela em staging, comparar diff e aprovar por contador. Atualização do portal nunca altera regras fiscais automaticamente.
### INT-UI-05 — Agenda /admin/integracoes/jobs
**Protótipo E12-V05:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V05) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Tabela por provedor/operação, conta/estabelecimento, origem API/arquivo, agendamento timezone, último/next run, configuração pinada, checkpoint NSU/extrato, número registros, erro/retry/DLQ. Ações executar agora, pausar, retomar, inspecionar, reprocessar com justificativa, exportar evidência; mudanças sensíveis sob RBAC.
### INT-UI-06 — Versões de documentação/contratos
**Protótipo E12-V06:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V06) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Fonte oficial, URL, versão, data publicação, SHA256 quando arquivo efetivamente baixado, data verificação, aprovador, ambiente/capability, histórico e data próxima revisão. Ações importar metadados, anexar manual PDF por canal autorizado e registrar diff; upload de manual não configura endpoint nem competência automaticamente.
### INT-UI-07 — Health/alertas
**Protótipo E12-V07:** [Abrir tela integral](../prototipos/erp-integrado-v1/index.html#E12-V07) · [Contrato de campos, regras e exceções](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md).
Expiração certificados, API/mTLS, mudança CA (especial Itaú 2026), jobs atrasados, NSU gap, layouts desatualizados, webhook falhando, rate limits e failback. Alertas 60/30/15/7 dias configuráveis via DB; usuário vê somente metadados seguros.


## 4. Pipeline de upload e gestão de certificados (obrigatório)
1. Usuário autorizado indica empresa, finalidade e ambiente, envia arquivo PFX/P12 + senha no mesmo POST multipart sob TLS, ou par CRT+KEY de integração bancária com permissão específica. A senha só é usada em memória transitória no backend, não vira .env, banco, logs, auditoria, webhook ou relatório.
2. Validar magic/mimetype/tamanho/cadeia, formato PKCS12, senha, privada correspondente à pública, algoritmo e keyUsage/EKU do serviço, notBefore/notAfter, dados do titular e ICP-Brasil para emissão NF-e. Tratar revogação OCSP/CRL conforme viabilidade, erro de consulta não é aprovação. Validar CNPJ do grupo segundo regra NF-e vigente.
3. Extrair a chave privada em memória controlada e cifrar no NestJS com AES-256-GCM + DEK aleatória de 256 bits por versão, gerada/protegida por AWS KMS via IAM role. Registrar `BYTEA ciphertext`, nonce aleatória 12 bytes, auth tag 16 bytes, `encryptedDataKey`, ARN KMS e contexto autenticado no PostgreSQL (ver [ADR-ERP-024](24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md)). Senha PFX descartada após parse, **não armazená-la** quando a chave pode ser mantida cifrada separadamente; não usar pgcrypto com chave privada enviada ao banco.
4. Persistir certificado público, metadados **e binário privado exclusivamente como ciphertext verificado e key envelope** no PostgreSQL; upload não ativa integração de produção. Binding finalidade+empresa+ambiente e aceite fiscal/bancário.
5. Teste assinatura XML com fake/homologação, teste TLS/auth banco sem operação financeira com efeito; zero download da chave privada, zero cabeçalhos/cookie com segredos.
6. Rotação: upload nova versão, período sobreposto aprovado, jobs fixam versão de cert no início; não usar cert vencido/revogado em nova operação; notificação e paralisação segura.
7. **A1** compatível com batch sem operador; A3 hardware/cartão exige dispositivo ou HSM/PKCS#11 (fora deste upload) e NÃO deve ser vendido como batch autônomo. Itaú pode usar certificado dinâmico mTLS gerado por CSR; disponibilizar fluxo CSR na UI se produto exigir, com chave privada cifrada no PostgreSQL e KEK no KMS. Bradesco/Santander têm seus requisitos por produto; certificado NF-e pode ser distinto dos bancários.
8. Segurança: antivírus/política upload, validação estrita, limites, escopo tenant, proteção contra SSRF de endpoints, hostnames aprovados, criptografia em repouso e trânsito, backend role least privilege, trilha de auditoria apenas com metadata e backups de cofre testados.


## 5. Execução batch autossuficiente sem usuário logado
Serviços: NF-e consulta/retorno pendente, DF-e distNSU/consChNFe e manifestação quando autorizada, emissão em lote sob fila, sincronização API extratos, ingestão CNAB/OFX/CSV E11, retorno de cobrança, reconciliação/baixas, alertas certificados, atualização de tabelas oficiais com revisão, preparação SPED conforme capacidade contratada.
- Agenda armazenada no PostgreSQL com timezone America/Sao_Paulo ou por empresa, cron/intervalo/trigger, janelas e limites por fonte. O worker obtém Identity de serviço sem sessão interativa e lê configuração/segredo aprovados just-in-time.
- Estado queued/leased/running/succeeded/retry_scheduled/needs_review/failed/cancelled, lease com fencing token/lock PostgreSQL, idempotência por empresa+capability+externalId+tipo, backoff+jitter e Retry-After, checkpoint consistente por NSU/conta/documento e versão de schema/credential por tentativa.
- Transações de negócio e outbox numa única transação, chamada de rede fora da transação, resultado assíncrono reconcilia por chave/recibo antes de reenvio. Eventos pós-commit/WebSocket na UI; agendamento backend **não viola** restrição a polling do frontend.
- API indisponível: capability+policy aprovadas ativam importação de arquivo, sem segundo motor E07 ou baixa; retorno e extrato podem ser observações do mesmo fato, conferência humana quando IDs frágeis.
- Falha/restart: jobs retomam checkpoint, sem duplicar nota, pagamento, título ou razão; usuários podem consultar timeline e reprocessar sob autorização, credencial revogada suspende.


## 6. O que se permite e proíbe em .env
**Permitido bootstrap técnico inevitável**: conexão inicial PostgreSQL ou secrets de infraestrutura injetados pelo orquestrador, identidade workload para cofre (ideal IAM role sem chave estática), porta/log básico de processo; JWT atual requer plano de migração. A aplicação não consegue buscar a string de conexão dentro do DB antes de conectar ao próprio DB. Não remover .env existente abruptamente: migração por Portão e smoke tests.
**Proibido adicionar**: SEFAZ_URL, BANK_API_URL, CNPJ fiscal, CFOP/cBenef, certificados/PFX paths/senhas, client_id/client_secret, scopes/tokens, convenios/carteiras, layout CNAB, jobs, timezone de negócio ou cron. Esses são dados de integração versionados e gerenciados na UI/DB/vault.
Coexistência temporária com env atual do backend/frontend é dívida técnica com plano de remoção controlada, não impedimento à configuração funcional por BD. Restaurar backup exige PostgreSQL+cofre+chaves de decriptação; não clonar PROD para HML.


## 7. Endpoints propostos /admin/integracoes/** (OpenAPI a congelar)
- GET/POST profiles, GET/PATCH profiles/:id, POST profiles/:id/testar|submeter|aprovar-ativacao|suspender.
- GET certificates metadata; POST certificates/upload multipart com password write-only; POST certificates/:id/testar|substituir|revoke-binding; **nenhum GET private key**.
- POST credentials/create-or-rotate (write-only); GET credentials/status (mascarado).
- GET/POST reference-datasets, POST reference-datasets/:id/importar|validar|aprovar|ativar.
- GET/POST jobs, POST jobs/:id/executar|pausar|retomar, GET job-runs e POST job-runs/:id/reprocessar.
RBAC novo: INTEGRACOES_VIEW, INTEGRACOES_CONFIG, INTEGRACOES_CERT_UPLOAD, INTEGRACOES_TEST, INTEGRACOES_APPROVE_PROD, INTEGRACOES_BATCH_EXEC, INTEGRACOES_VAULT_ROTATE; dupla aprovação PROD. 403 para usuário comum, não vazar secretRef nem certificados privados no JSON.


## 8. DoD / requisitos inversos / gates
**Testes:** upload PFX válido e inválido, certificado vencido/revogado, PFX senha errada, chave não correspondente, concorrência no binding, certificado trocado durante job, mTLS CA nova Itaú, job após restart sem env BANK/SEFAZ/CERT/JOB, retry após timeout sem duplicar documento, volume realista, RBAC 403, logs sem segredo, Playwright da jornada, CI fake sem banco real e homologação por ambiente.
**Inversos:** segredos nunca em parametros.valorJson; sem download privkey; sem editar env para mudar banco, endpoints, cron, certificado; sem A3 como upload batch; sem autorização de produção só por teste técnico; sem dado fiscal atualizado automaticamente sem validação; sem atribuir a sandbox ações reais de produção; sem duplicar ledger bancário/contábil; sem promessa de emissão bancária sem convênio.
**Ratificação de UI e cofre:** [AD-18](../execucao/DECISOES.md) define [protótipo integral de 61 interfaces](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md), [menu 13 grupos](24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md), ciphertext PostgreSQL AES-256-GCM e KMS/IAM externo. Banco requer contrato e manuais autenticados; contador valida regime/NT; TI formaliza key policy, tenant isolation e backup/restore. Esses gates não impedem o desenho do módulo comum.
