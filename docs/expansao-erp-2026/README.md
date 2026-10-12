# AlphaCarnes — Índice da expansão ERP e integrações externas (11/10/2026)
**Estado:** documentação sob revisão por PR para develop. Não equivale a implementação ou homologação externa.

## Cadernos contratuais
- [A — escopo operacional existente](A-ESCOPO-EXISTENTE-DEVELOP.md): 39 telas da linha-base, entregues versus lacunas e exclusões.
- [B — expansão ERP](B-ESCOPO-NOVOS-MODULOS-ERP.md): 12 épicos, 61 telas/funcionalidades propostas, requisitos técnicos, não funcionais e inversos.
- [C — proposta comercial](C-PROPOSTA-COMERCIAL-ERP.md): P-01 até P-12, premissas, aceite, exclusões, reuso e valores a estimar.
- [10 — plano Kiro](10-BACKLOG-KIRO-TESTES.md): tarefas, gates e testes.

## Integração bancária e fallback único
- [11 — E11 arquivos CNAB/OFX/CSV](11-E11-FALLBACK-BANCARIO-ARQUIVOS.md): 12 tarefas e 16 cenários multicanal.
- [12 — Parecer CROSS bancário](12-AVALIACAO-CROSS-ARQUITETURA-BANCARIA.md): um cadastro, uma transação canônica e uma baixa por fato econômico.

## Documentação oficial pesquisada e arquitetura compartilhada E12
- [20 — fontes oficiais NF-e, SPED e cadastros](20-CATALOGO-OFICIAL-INTEGRACOES-OUT-2026.md): versão, fonte, vigência, limite de prova e checklist.
- [21 — bancos](21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md): Bradesco/Itaú/Santander, APIs autenticadas, mTLS e layouts.
- [22 — arquitetura de integração](22-ARQUITETURA-INTEGRACOES-CERTIFICADOS-BATCH-CADASTROS.md): cadastro DB e UI, upload A1, cofre PostgreSQL+KMS, batch e governança.
- [23 — impacto CROSS e tarefas E12](23-CROSS-IMPACTO-E12-PLANO-KIRO.md): 13 tasks técnicas, 7 telas propostas, dependências e Portão 1.
- [24 — ADR-ERP-024](24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md): cofre PostgreSQL + AWS KMS, menu de 13 grupos e protótipos completos (ratificado pela AD-18).

## Protótipo navegável da expansão
- [index.html](../prototipos/erp-integrado-v1/index.html): 61 telas de expansão, 39 links à linha-base e jornadas simuladas, sem APIs reais.
- [Matriz integral de interfaces](../prototipos/erp-integrado-v1/MATRIZ-INTEGRAL-INTERFACES.md) e [matriz UX/componentes das 61 telas](../prototipos/erp-integrado-v1/MATRIZ-UX-COMPONENTES-61-TELAS.md).

## Diretrizes inegociáveis
- Aplicação autossuficiente *após habilitações externas*, com configurações de serviços em PostgreSQL e telas. Segredos no PostgreSQL somente como ciphertext AES-256-GCM gerado no backend (DEK cifrada junto, KEK não exportável no AWS KMS via IAM; [ADR-ERP-024](24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md)); nunca em claro, em `parametros.valorJson` ou em `.env`.
- Arquivos como fallback das APIs, sem segundo motor de conciliação. Certificados A1 por upload e execução batch sem usuário conectado.
- Não adicionar variáveis de integração em arquivos .env; bootstrap inicial DB/identidade workload precisa de meio externo mínimo, preferencialmente identidade de serviço ou secret injection.
- Não inferir a habilitação do cliente de documentação pública: bancos exigem convênio/conta e documentação OpenAPI autenticada; SEFAZ exige situação/credenciamento e certificado correto.
- A diferença entre NT 2025.002 v1.52 e pacote XSD 010f precisa de teste na homologação; não assumir que publicações têm a mesma vigência.
- Telas novas sujeitas a protótipo/Constituição; agentes não alteram direto develop, nem registram decisões não homologadas.

## Linear
[Projeto ERP ALP](https://linear.app/alphacarnes/project/alphacarnes-expansao-erp-fiscal-financeiro-e-contabil-1348f297d069): 12 épicos e 74 subtarefas, todos Backlog.
[Gate bancário ALP-160](https://linear.app/alphacarnes/issue/ALP-160) e [Gate transversal E12 ALP-173](https://linear.app/alphacarnes/issue/ALP-173) tiveram a convenção de bloqueio liberada pela AD-19 e os planos CROSS aprovados no Portão 1 (branches `feature/erp-e11-t00-cross-bancario` e `feature/erp-e12-t00-cross-adr`), ainda não integrados em develop; nada foi implementado nem homologado.
