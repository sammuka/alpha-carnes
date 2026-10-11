# Avaliação CROSS v1.0 — Bancos, arquivos, títulos, caixa, conciliação e razão | AlphaCarnes
> 11/10/2026. **Análise concluída no nível de arquitetura interna, com recomendações fechadas; homologação de bancos/convênios/layouts segue gate E11-T00.** Esta avaliação ocorre **antes** do desdobramento executável da implantação bancária. Escopo E04/E05/E06/E07/E08/E09/E11. Não altera a implementação da branch develop.
## 1. Fontes examinadas e limites
- Desenvolvimento `develop` SHA `db9d8ac1760a01c262c57a9f824d2c8fcf18291b`: PostgreSQL/Drizzle, modular monolith NestJS, controle RBAC/auditoria, faturamento NFS-e EISS incipiente; não possui razão bancário AP/AR abrangente implementado que possa ser simplesmente adaptado.
- Reunião Karina 25/09/2026: contas a pagar/receber, DDA, arquivos de retorno/francesinha, conciliação manual Excel, bancos Bradesco/Itaú/Santander, fluxo de caixa e impostos, pedidos/nota de fornecedores e peso recebido.
- Decisão 10/10/2026: APIs diretas dos três bancos desde início; decisão 11/10/2026: arquivos como fallback operacional **construído em conjunto**.
- Fontes públicas: FEBRABAN CNAB 240 v10.9 (segmento E para conciliação/extrato); validador Bradesco (conciliação 240/200); Itaú cobrança CNAB400 e retornos; Santander layout cobrança CNAB240/400. A documentação **não** demonstra que a AlphaCarnes tem convênio habilitado em nenhuma modalidade. Não substituir inspeção dos manuais assinados pelo banco em T00.
## 2. Alternativas e decisão arquitetural
| Alternativa | Benefícios | Defeitos técnicos/comerciais | Parecer |
|---|---|---|---|
| A. Dois sistemas, API e arquivos com tabelas/baixas próprias | entrega parcial inicial simples | mesmo pagamento gera 2 títulos/caixas/lançamentos, conciliação tardia complexa, teste combinado frágil, sobrecusto e fraude acidental | **REJEITADA** |
| B. API e arquivos como adaptadores de entrada para uma única observação/transação, conciliação e ledger | idempotência determinística, failover/failback, auditoria de fontes, menores riscos e reuso de regra | maior investimento inicial em contratos e modelos | **ADOTADA PARA ESPECIFICAÇÃO** |
| C. Só arquivos substituindo APIs | baixo custo integração externa inicial | contraria decisão do cliente, atraso de eventos, ações manuais, perda de oportunidades API | **REJEITADA** |
**Parecer:** uma camada de `BankSourceObservation`, `CanonicalBankTransaction`, `CollectionEvent`, `ReconciliationAllocation` e `LedgerEntry`, com responsabilidade explícita por módulo. A normalização de entrada não pode alterar registros fiscais ou títulos diretamente.
## 3. Identidade e regras contra duplicidade
**Escopos separados para chave forte:**
- Observação: canal+documento ou lote/linha+tipo evento, com imutabilidade e SHA-256 original.
- Transação financeira: empresa+conta+tipo+identificador único bancário/EndToEndId validado; para cobrança, nosso número e ocorrência/referência identificam evento do título, não necessariamente a linha de extrato.
- Título AP/AR: documento origem + parcela + tipo obrigação; nunca chavear só por banco e valor. Cobrança e baixas são filhas do título.
- Alocação: transação canônica + título/parcela + valor alocado (disponibilizar parcial/múltiplos títulos); regras de unicidade evitam reuso indevido e soma alocada acima da transação.
- Diário contábil: evento financeiro único+tipo de lançamento+empresa/competência; lançamentos reversos por estorno e vínculo a original.
**Chave fraca:** valor+data+descrição+contraparte gera apenas `match_candidate`, não `confirmed`.
**Exemplo A:** API extrato registra crédito R$ 5.000; D+1 OFX traz mesma transação com FITID comprovado → 2 observations, 1 transaction, 1 allocation, 1 baixa, 1 lançamento. IDs sem vínculo inequívoco → apresentar conflito para revisão.
**Exemplo B:** retorno CNAB informa boleto liquidado; extrato API traz crédito líquido (valor total menos tarifa) → não criar receita nova, correlacionar instrumento e tarifa como movimento distinto, conferir abatimento e data de crédito. Se múltiplos boletos compõem depósito, alocação 1:N autorizada.
**Exemplo C:** título pago após remessa de pagamento exportada e não comprovada → permanecer `submitted_external_unconfirmed`; baixa só após retorno bancário confiável/extrato/consulta. Reenvio depende da reconciliação de estado da instrução.
**Exemplo D:** o mesmo CSV sem ID forte importado duas vezes é mesmo lote por hash; eventos de arquivos diferentes com mesmo valor/data podem ser distintos → não colapsar automaticamente.
## 4. Ownership e arquivos migratórios
| Responsabilidade | Único owner | Entidades compartilhadas | Proibição |
|---|---|---|---|
| Banco, conta, convênio/capability e credenciais | E06 | BankAccount, BankCapability | E11 não cria segunda tabela contas |
| Observações provenientes de API/webhook | E06 adapter, escrita no serviço canônico comum | BankSourceObservation | E06 não baixa AR/AP direto |
| Lote, upload, parser, provenance arquivo | E11 | BankSourceBatch, BankSourceObservation, BankLayoutRegistry | arquivos não criam títulos |
| Transação bancária normalizada e reconciliação | E07 (serviço único) | CanonicalBankTransaction, ReconciliationAllocation | E11 não cria motor matching paralelo |
| AP e AR | E04/E05 | Payable/Receivable, Installment, Settlement | nenhuma fonte bancária vira obrigação nova sem documento |
| Caixa e projeções | E08 | TreasuryProjection, BankBalanceSnapshot | saldo de arquivo parcial não vira saldo final automático |
| Partidas e competência | E09 | LedgerEntry, AccountingPeriod | sem dois journals por mesma liquidação |
| Controle da execução | E11-T00 (análise), E06/E07/E11 (workers e gates) | ADR, DDL e contratos OpenAPI | não migrar antes de aprovar cross |
## 5. Matriz funcional API × arquivo
| Processo | Origem API prioritária | Arquivo fallback homologado | Normalização/efeito |
|---|---|---|---|
| Extrato conta | API extratos/lançamentos habilitada | CNAB segmento E/variante do banco, OFX, CSV perfilado | transações canônicas por conta; fechamento só com saldo íntegro |
| Registro boleto | API cobrança e webhook/consulta | remessa CNAB 240/400 e retorno aceito | cobrança registrada somente após retorno inequívoco |
| Liquidação boleto | webhook/consulta, eventualmente extrato API | retorno cobrança 240/400; extrato CNAB/OFX/CSV | um título liquidado, evitando duplicar entre retorno e extrato |
| Pagamento de fornecedor | API de pagamento + status | remessa/retorno **somente se contratados** | instrução ≠ pagamento; baixa por confirmação |
| DDA | API se habilitada | layout formal habilitado se houver | não presumir DDA em OFX, CSV ou retorno genérico |
| Tarifas e aplicações | API/extrato | extrato CNAB/OFX/CSV | lançamentos classificados, transferência não é receita |
| Reversões/chargeback | eventos/consulta | retorno, correção de extrato | ajuste compensatório, eventos imutáveis |
## 6. Risco de layout e o que está efetivamente incluído
O escopo base E11 inclui **infra de arquivos e perfis para três bancos**, com parsers específicos por versão homologada para extratos e retornos realmente disponibilizados, mas não oferece suporte irrestrito a todos formatos existentes nos três bancos. CNAB240 para conciliação pode não existir para cada convênio. Bradesco apresenta opção 200 em validador; **CNAB 200 não faz parte do pacote-base sem validação/aditivo**. Itaú CNAB400 de cobrança não é extrato OFX. Santander cobra regras por carteira. Cada integração é um item orçamentário granular em E11 com risco e aceite próprios.
## 7. Decisões já respondidas versus gates pendentes
**Fechadas pelo Quality Owner/arquitetura:** API é primária; arquivos fallback; E11 novo épico; modelo, conciliação e ledger únicos; sem duplicidades e sem autobaixa por importação; reserva comercial do fallback incluída no Caderno C.
**A validar apenas em E11-T00:** contas/convênios reais e serviços bancários habilitados; layout e versão reais de cada arquivo; se remessa de pagamentos será necessária onde API pagamentos não estiver disponível; método de depósito múltiplos boletos; período/frequência de extratos, autorização e controles por Karina/TI; salvaguardas e retenção de arquivos. Essas lacunas **não bloqueiam a definição do épico**, mas bloqueiam implementação do adaptador específico e orçamento fechado por variante.
## 8. Critérios de Portão 1 para workers
- DDL proposto sem duplicar entidades/contratos com E04–E09; drift check e migration snapshot;
- diagrama sequencial para `API → observation` e `arquivo → observation`, ligando a **mesma** transação canônica;
- índice e contrato de idempotência documentados, replay determinístico, conflito por chave fraca não auto-baixado;
- quatro cenários de provas cruzadas acima e XB-01..XB-16 do E11;
- plano explícito de failback e recuperação de confirmação externa, RBAC de upload/aprovação, logs e criptografia;
- acordo de homologação por banco/capability/layout; matriz de riscos e custo sem dupla precificação E06/E07/E11.
**Status deste parecer:** recomendação técnica concluída; aprovações e dados externos a obter no gate E11-T00, registrado em ALP-160.
