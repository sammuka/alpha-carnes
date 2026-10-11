# Plano de execução Kiro — AlphaCarnes ERP 2026
**Contrato documental de implantação.** Este índice deriva dos Cadernos A/B/C. A branch `develop` é a base funcional; as especificações aguardam PR/revisão. Nenhum worker deve atuar sem Portão 1, papéis de AGENTS.md, revisão de ADR e protótipos para novas telas.

## Ordem técnica e paralelismo
-1. **Gate E12-T00 / Fundação de Integrações (OBRIGATÓRIO):** revisar cross E01..E11, fonte oficial out/2026, DB/secret-store/UI/protótipo, aprovar ADR sem duplicar credenciais e jobs; [Contrato E12](23-CROSS-IMPACTO-E12-PLANO-KIRO.md), [Arquitetura](22-ARQUITETURA-INTEGRACOES-CERTIFICADOS-BATCH-CADASTROS.md). Precede adapters e batch reais; E11-T00 permanece necessário para dedupe bancário.
0. **Gate E11-T00 CROSS OBRIGATÓRIO:** antes de codificar E06/E07/E08/E11, verificar develop, E04/E05/E09, manuais por banco, identificar modalidades e contratos API/CNAB/OFX/CSV por conta e serviço, definir schema/capabilities/ownership e aprovar ADR. Sem este gate, worker PARA.
1. **Fundação E01-T01 + E09-T01 + E06-T01 + E11-T01:** estabelecimento/regime fiscal, plano de contas, contas e capabilities bancárias; centralizar RBAC, trilha e dados empresariais sem duplicar entidades.
2. **E01-T02..T05:** operações/regras/simulação/aprovação com dados **fictícios anonimizados** das quatro NF-e fornecidas. Sem emissão real antes de parecer fiscal.
3. **E02-T01..T05:** autorização NF-e modelo55 SEFAZ/SP, XML assinatura A1 e eventos, integração com carga real; homologação estadual obrigatória.
4. **E03-T01..T04:** NF fornecedor, conferência, devolução e modelo de custos/CMV aprovado pelo contador.
5. **E04-T01..T05 + E05-T01..T04:** razão financeiro e títulos com origens de NF-e, parcelamento, baixas e reversão idempotente.
6. **E06-T02..T05 + E11-T02..T08:** implementar APIs e arquivos **na mesma arquitetura de transação econômica, observações e events**, com matrizes homologadas Bradesco/Itaú/Santander, layouts CNAB de serviço suportado e OFX/CSV por perfil. O fallback é parte do build principal, não fase 2. Nenhuma baixa a partir de arquivo/remessa sem comprovação.
7. **E07-T01..T04 + E08-T01..T04 + E11-T09..T11:** conciliação determinística única, proveniência API×arquivo, dedupe financeiro-contábil, tesouraria, fluxo caixa e testes cruzados por banco.
8. **E09-T02..T09:** políticas de contabilização, livros, fechamentos, apuração e SPED realmente aplicável ao regime; UAT com contador e validador.
9. **E10-T01..T04:** integrar todos os pontos operacionais com estados fiscais, telas e menu aprovados; não refazer compras/pedidos/pesagem.
Cada linha de execução E##-T## é uma issue Linear vinculada ao épico E##. Issues base já criadas: **ALP-100..ALP-158** (10 pais e 49 subtarefas), **novo E11 ALP-159 + 12 subtarefas ALP-160..ALP-171, totalizando 11 épicos e 61 subtarefas**, todas no projeto ERP ALP. [Abrir projeto](https://linear.app/alphacarnes/project/alphacarnes-expansao-erp-fiscal-financeiro-e-contabil-1348f297d069).

**O diagnóstico CROSS já foi documentado no [Parecer de Arquitetura](12-AVALIACAO-CROSS-ARQUITETURA-BANCARIA.md); faltam homologações por banco/conta no ALP-160.**

## Precondição transversal E11-T00 — análise CROSS anterior a qualquer implementação bancária
- Validar interfaces E04/05 (títulos), E06 (API), E07 (conciliação), E08 (tesouraria), E09 (contabilidade), E11 (arquivos) com o mesmo modelo de bank_account, bank_transaction e ledger; nenhum módulo cria sua própria versão.
- Inventariar por **banco/conta/convênio/carteira/serviço**, API e remessa/retorno/OFX/CSV disponíveis e layouts homologados. Diferenciar extrato versus retorno de cobrança versus instrução de pagamento.
- Definir fingerprints de lote/observação e chaves fortes de transação; duas fontes podem representar **um** evento econômico. Chaves fracas são propostas humanas, nunca auto-match.
- Aprovar versão da ADR pelo Quality Owner/tesouraria. E11-T01 não entra no Portão 1 antes deste aceite. E06-T01, E07-T01 e E08-T01 também bloqueadas até CROSS; E04/E05 independentes podem avançar se não congelarem o contrato bancário.
- E11 incluído na proposta: funcionalidades 5 telas, 12 tasks, teste de arquivos e combinação API + arquivo; casos de teste [XB-01..XB-16](11-E11-FALLBACK-BANCARIO-ARQUIVOS.md). Deve haver uma política de fallback/failback por capability.
- Regras negativas: arquivo importado ≠ pagamento confirmado, remessa exportada ≠ boleto registrado, retorno de registro ≠ retorno de liquidação; somar observações não significa somar créditos; exigir revisão em conflitos.

## Complemento E12 — certificados, endpoints e jobs sem .env externo
E12 compartilha perfis/segredos/jobs para NF-e, DF-e, bancos, SPED e catálogos; Kiro deve evitar criação redundante nos E02/E06/E11. Não salvar segredo em parametros.valorJson; usar cofre com referências de DB e upload PFX A1 por tela, testes de validade/ICP-Brasil, rotação e batch independente de sessão. Implementar endpoints por base oficial verificada, bloquear versões normativas não aprovadas, e registrar snapshots de certificado/configuração por run. Consultar [Catálogo de fontes](20-CATALOGO-OFICIAL-INTEGRACOES-OUT-2026.md) e [Banco](21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md).

## Template rigoroso de PR/Portão
- **Antes:** provar SHA origin/develop e inspecionar código/contrato/dados existentes; abrir worktree `feature/erp-<id>`; selecionar um único subissue e plano autocontido.
- **Modelo:** entes/tabelas, migração Drizzle, unicidade, invariantes matemáticas/legais, gateway fake determinístico, interface real isolada, RBAC e auditoria/outbox.
- **Service:** validar evento e campos, transacionar mutação, serializar dinheiro como string, disparar integração externa FORA da transação, processar retorno assíncrono com reconciliação/idempotência.
- **UI:** importar componentes DS v3, não inventar nova paleta/layout; telas novas só após aprovar protótipo e eventual emenda constitucional, registrar empty/loading/error/conflict.
- **Testes:** unit table-driven, integração PG18, teste 2 requisições concorrentes, auth negativa, reprocessamento após timeout, fail-closed se norma/capability/regime indefinido, frontend Jest, Playwright com screenshot. Manter todos os oito jobs CI.
- **Evidência por issue:** commit/PR SHA, comparativo schema, Swagger/OpenAPI, casos feliz e negativo, relatório CI, parecer fiscal/bancário ou bloqueio externo, demonstração UAT.
- **STOP obrigatório:** falta de URL/certificado/convênio, alíquota não aprovada, exigência de autorização não aplicável, dúvida sobre método de custo, ausência de protótipo, contradição com constituição, teste falhando após correção. Não presumir resposta.
## Mapa de escopo comercial
O **Caderno A** representa o desenvolvimento original e aponta exclusões, pendências EISS e hardware. O **Caderno B** representa exclusivamente a ampliação de **61 telas/funcionalidades** (49 propostas originais + 5 E11 + 7 E12) e **12 épicos** não equivalem a 10 PRs e podem exigir várias ondas por dependência. O **Caderno C** organiza pacotes de cobrança, aceite, custos de terceiros, exclusões e premissas. Um aceite no GitHub não significa homologação de banco, NF-e em produção ou fechamento contábil validado por contador.
## Matriz de não escopo comum
Sem folha/eSocial própria; sem NFS-e geral, NFC-e, CT-e, MDF-e; sem outros bancos; sem operação de contabilidade terceirizada; sem retificação histórica ilimitada; sem credenciamento bancário fornecido pelo desenvolvedor; **arquivos bancários de layouts homologados estão incluídos no E11**; sem licença/hardware físico; sem garantias de SLA de terceiros; sem alterações normativas ilimitadas; sem faturamento fictício ou conciliação que oculte fluxos.
## Critérios de negociação antes de preço final
Obter quantitativos mensais de NF-e e itens, produtos e NCMs, empresas/filiais/UF, regime tributário, convenções financeiras (boleto, Pix, DDA, pagamentos), quantas contas em cada banco, quantidade de usuários/concor­rência, volume de XMLs históricos, quantos exercícios a migrar, contador validador, infraestrutura e cronograma desejado. O orçamento fechado só pode ser calculado após dimensionamento por `E##-T##`, riscos e paralelismo.
