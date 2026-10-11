# Plano de execução Kiro — AlphaCarnes ERP 2026
**Contrato documental de implantação.** Este índice deriva dos Cadernos A/B/C. A branch `develop` é a base funcional; as especificações aguardam PR/revisão. Nenhum worker deve atuar sem Portão 1, papéis de AGENTS.md, revisão de ADR e protótipos para novas telas.

## Ordem técnica e paralelismo
1. **Fundação E01-T01 + E09-T01 + E06-T01:** estabelecimento/regime fiscal, plano de contas, contas e capabilities bancárias; centralizar RBAC, trilha e dados empresariais sem duplicar entidades.
2. **E01-T02..T05:** operações/regras/simulação/aprovação com dados **fictícios anonimizados** das quatro NF-e fornecidas. Sem emissão real antes de parecer fiscal.
3. **E02-T01..T05:** autorização NF-e modelo55 SEFAZ/SP, XML assinatura A1 e eventos, integração com carga real; homologação estadual obrigatória.
4. **E03-T01..T04:** NF fornecedor, conferência, devolução e modelo de custos/CMV aprovado pelo contador.
5. **E04-T01..T05 + E05-T01..T04:** razão financeiro e títulos com origens de NF-e, parcelamento, baixas e reversão idempotente.
6. **E06-T02..T05:** implementar os adaptadores bancários **por contrato de homologação real** de Bradesco, Itaú e Santander. Não afirmar suporte à operação antes do sandbox/convênio documentados.
7. **E07-T01..T04 + E08-T01..T04:** conciliação determinística, tesouraria e fluxo caixa.
8. **E09-T02..T09:** políticas de contabilização, livros, fechamentos, apuração e SPED realmente aplicável ao regime; UAT com contador e validador.
9. **E10-T01..T04:** integrar todos os pontos operacionais com estados fiscais, telas e menu aprovados; não refazer compras/pedidos/pesagem.
Cada linha de execução E##-T## é uma issue Linear vinculada ao épico E##. Issues recém-criadas: **ALP-100..ALP-158** (10 pais e 49 subtarefas), todas no projeto ERP ALP. [Abrir projeto](https://linear.app/alphacarnes/project/alphacarnes-expansao-erp-fiscal-financeiro-e-contabil-1348f297d069).

## Template rigoroso de PR/Portão
- **Antes:** provar SHA origin/develop e inspecionar código/contrato/dados existentes; abrir worktree `feature/erp-<id>`; selecionar um único subissue e plano autocontido.
- **Modelo:** entes/tabelas, migração Drizzle, unicidade, invariantes matemáticas/legais, gateway fake determinístico, interface real isolada, RBAC e auditoria/outbox.
- **Service:** validar evento e campos, transacionar mutação, serializar dinheiro como string, disparar integração externa FORA da transação, processar retorno assíncrono com reconciliação/idempotência.
- **UI:** importar componentes DS v3, não inventar nova paleta/layout; telas novas só após aprovar protótipo e eventual emenda constitucional, registrar empty/loading/error/conflict.
- **Testes:** unit table-driven, integração PG18, teste 2 requisições concorrentes, auth negativa, reprocessamento após timeout, fail-closed se norma/capability/regime indefinido, frontend Jest, Playwright com screenshot. Manter todos os oito jobs CI.
- **Evidência por issue:** commit/PR SHA, comparativo schema, Swagger/OpenAPI, casos feliz e negativo, relatório CI, parecer fiscal/bancário ou bloqueio externo, demonstração UAT.
- **STOP obrigatório:** falta de URL/certificado/convênio, alíquota não aprovada, exigência de autorização não aplicável, dúvida sobre método de custo, ausência de protótipo, contradição com constituição, teste falhando após correção. Não presumir resposta.
## Mapa de escopo comercial
O **Caderno A** representa o desenvolvimento original e aponta exclusões, pendências EISS e hardware. O **Caderno B** representa exclusivamente a ampliação de 49 telas/funcionalidades; seus 10 épicos não equivalem a 10 PRs e podem exigir várias ondas por dependência. O **Caderno C** organiza pacotes de cobrança, aceite, custos de terceiros, exclusões e premissas. Um aceite no GitHub não significa homologação de banco, NF-e em produção ou fechamento contábil validado por contador.
## Matriz de não escopo comum
Sem folha/eSocial própria; sem NFS-e geral, NFC-e, CT-e, MDF-e; sem outros bancos; sem operação de contabilidade terceirizada; sem retificação histórica ilimitada; sem credenciamento bancário fornecido pelo desenvolvedor; sem licença/hardware físico; sem garantias de SLA de terceiros; sem alterações normativas ilimitadas; sem faturamento fictício ou conciliação que oculte fluxos.
## Critérios de negociação antes de preço final
Obter quantitativos mensais de NF-e e itens, produtos e NCMs, empresas/filiais/UF, regime tributário, convenções financeiras (boleto, Pix, DDA, pagamentos), quantas contas em cada banco, quantidade de usuários/concor­rência, volume de XMLs históricos, quantos exercícios a migrar, contador validador, infraestrutura e cronograma desejado. O orçamento fechado só pode ser calculado após dimensionamento por `E##-T##`, riscos e paralelismo.
