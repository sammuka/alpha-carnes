# E11 — Fallback operacional de conciliação bancária por arquivos (API + arquivo)
> **Nova decisão do Quality Owner em 11/10/2026.** Complementa E06 (conectores APIs), E07 (motor de conciliação), E08 (tesouraria), E04/E05 (títulos), E09 (razão). **A análise CROSS T00 é gate bloqueante antes de executar qualquer task técnica de E06/E07/E08/E11 que persista dados bancários ou programe retorno.**

## 1. Contrato aprovado
- Canal **primário APIs** Bradesco, Itaú e Santander. Quando indisponível/não habilitado por serviço, habilitar **arquivos como fallback operacional**, por conta+convênio+serviço+versão de layout.
- Entrada de extrato: **CNAB 240 conciliação quando serviço/segmento suportados, OFX, CSV aprovado**. Eventos de cobranças: **retorno CNAB 240/400 quando homologado**; saída **remessa CNAB 240/400 conforme banco/carteira** somente se contratada e homologada. Arquivo CNAB de pagamento/retorno apenas se capability e documento habilitados e aprovado em T00.
- Importar arquivo não é executar transação bancária. Remessa baixada não foi necessariamente transmitida. Retorno de *registro de cobrança* não significa *liquidação*. Extrato e retorno de cobrança podem representar **observações diferentes de um mesmo recebimento econômico**, com eventos distintos.
- Não confundir fallback automático de **consulta/importação de dados** com fallback de **pagamentos/emissão de boletos**: ações externas exigem aprovação do operador e comprovação da aceitação bancária, nunca envio/reenvio cego.
- Se API e arquivo convergirem para o mesmo evento, **não criar segunda transação, baixa, título, receita ou lançamento contábil**. Se não existir identificador confiável, deixar item pendente com sugestão para revisão, sem auto-conciliação.
- Processo planejado como uma integração única desde a primeira migration, jamais implementar módulos paralelos e reconciliar dados posteriormente.

## 2. Avaliação CROSS entre épicos: decisões de ownership
| Objeto/fluxo | E06 APIs | E11 arquivos | E07/E08 | E04/E05 | E09 |
|---|---|---|---|---|---|
| Banco/conta/convênio/capability | Dono das configurações e credenciais | Lê banco/conta e extensões layout, não cria outro cadastro | Consulta | Consulta | Consulta |
| Recepção/API/webhook | Cria *source observation* | Sem acesso direto | Recebe notificação canônica | Não recebe cru | Não recebe cru |
| Upload arquivo/saldo/retorno | Consulta estado normalizado | Dono upload, parsing, provenance, lote, hash e layouts | Consome mesmo estado | Consome só evento econômico validado | Consome só fato econômico |
| Transação bancária canônica | **Uma única tabela/fato** compartilhado | Associa evidência à mesma transação | Dono do matching e distribuição de alocação | Dono dos títulos e suas baixas, sem novo ledger paralelo | Partidas com unique event ID |
| Cobrança e registro | Dono instrução de cobrança por conta | Faz remessa quando habilitado; lê retorno de aceite | Reconciliador verifica eventuais créditos | Um recebível e estado da cobrança | Evento único para competência |
| Pagamento AP | Executa API se habilitada e aprovada | Remessa opcional com comprovação de transmissão/retorno | Liquidação por confirmação inequívoca | Nunca baixar só por arquivo enviado | Uma despesa/liquidação documentada |
| Extrato API e arquivo | Consulta e cria observação | Cria observação | Dedupe e reconcilia sobre movimento canônico | Baixa 1x | Lança 1x |
| Fallback e failback | Monitora disponibilidade/capability | Operador ativa arquivo com guardrails | Reprocessa sem duplicar | Estado financeiro preservado | Período não reabre silenciosamente |

### 2.1 Invariantes da identidade (ordem)
1. Identidade **forte**: `empresaId + bankAccountId + transactionType + bankTransactionId/EndToEndId/FITID validado`, quando semântica da origem atesta unicidade; conciliação por referência de cobrança `banco+convenio+carteira+nossoNumero+ocorrencia+sequencia/data` considerando retorno como **evento** e não movimento extrato.
2. Identidade **documental**: `empresa+conta+servico+tipoArquivo+hashSHA256` identifica LOTE exato; `lote+indiceRegistro+tipoEvento` identifica OBSERVAÇÃO; arquivo com mesmo conteúdo e nome diferente é reimportação idempotente; arquivo diferente com mesmos eventos mantém proveniência separada.
3. Sem chave forte: criar candidato `valor+direcao+data+texto normalizado+conta+contraparte` somente para **sugerir**, não para dedupe destrutivo nem baixar automaticamente; homologação de algoritmo por conjunto de layouts.
4. Corrigir/retificar evento: *append-only observation* de retificação e decisão explícita; nunca `UPDATE` em lançamento autorizado para encobrir reversão. A conciliação pode permanecer *pending_conflict* até validação.

### 2.2 Modelo de estados e agregados canônicos
```text
BankAccount (E06) - BankCapability per account, channel, service, validity
 BankSourceBatch (E11) - [uploaded, quarantined, parsed, validated, awaiting_review, accepted, rejected]
   BankSourceObservation (E06/E11 shared) - [API|WEBHOOK|CNAB240|CNAB400|OFX|CSV]
     CanonicalBankTransaction (single) - [pending, confirmed, conflicted, reversed]
        ReconciliationAllocation (E07) -> FinancialTitle (E04/E05) -> LedgerEvent (E09)
 BankCollectionInstruction (E05/E06) + BankCollectionEvent (API or file return)
 BankRemittanceBatch (E11) - [draft, validated, exported, submitted_external, accepted_by_bank, rejected_by_bank]
```
Eventos de *remessa* são instruções; eventos de *retorno* podem confirmar ou rejeitar instruções; *extrato* comprova movimento em conta. **Nunca inferir dinheiro creditado apenas de confirmação de registro de boleto.** Evento de liquidação de cobrança e crédito no extrato podem corroborar um único pagamento, mesmo quando IDs diferem: se não houver chave que prove vínculo, revisão humana.

### 2.3 Matriz de formatos/contratos por banco (a confirmar em T00)
| Banco | Extrato/Conciliação | Retorno cobrança | Remessa cobrança | OFX/CSV | Situação |
|---|---|---|---|---|---|
| Bradesco | Validador oficial indica retorno conciliação 240 **e 200**, conforme produto contratado | cobrança CNAB 240/400 | cobrança 240/400 | perfil aprovado da conta | Layout individual e habilitação serão confirmados |
| Itaú | consultar extrato oficial por produto/conta; não presumir CNAB E | documentação oficial de cobrança CNAB 400, variantes | 400 quando habilitado (ou 240 se contrato específico) | perfil aprovado da conta | Exigir manual vigente do convênio |
| Santander | consultar layout extrato bancário do produto/conta | oferta oficial cobrança CNAB 240/400 | 240/400 conforme carteira | perfil aprovado da conta | Contrato e versão por carteira requeridos |
**Não anunciar CNAB 240 segmento E como universal dos três bancos**: FEBRABAN padroniza a família, mas a disponibilidade e campos específicos dependem da instituição e serviço contratado. CNAB 200 Bradesco *não* está incluído automaticamente: pode ser submetido a aprovação do T00 e mudança de escopo/implementação apropriada.

### 2.4 Condições de fallback
- **Indisponibilidade do serviço API** registrada por status/capability, ou ausência contratual de API para extrato/retorno, possibilita upload de arquivo permitido. Não há auto-ativação por retry ou timeout pontual.
- Mesmo com API normal, é permitido **importar arquivo para auditoria** usando mesma pipeline sem nova liquidação.
- Falhas de conexão não concedem autorização de pagamento; rotas bancárias permanecem no controle de perfil/dupla aprovação.
- Recuperação API: reconciliar lacunas com checkpoint, anexar provenance, não sobrescrever eventos do arquivo, e mostrar conflitos à Karina.
- Liquidação financeira é uma **transação econômica**, não um "registro de API" nem "linha de CSV".

### 2.5 Ponto de controle ZERO antes de implementação
Executar a task **E11-T00** em modo de análise; publicar ADR complementar em docs, matriz `bank × account × capability × channel × file layout × version`, mapa dos owners/migrations de E04–E09, avaliação dos retornos disponibilizados de Karina e de convênios, lista de decisões humanas, impacto de esforço comercial em C. **Só então** abrir Portão 1 para E06-T01, E07-T01 e E11-T01; E04/E05 poderão iniciar modelagem não bancária, mas congelar interfaces comuns aprovadas. Pular T00 invalida gate de arquitetura.

## 3. Dependências e agenda de segurança
- Estado fiscal e de títulos permanece em seus módulos; arquivo bancário não modifica NF-e, nota de fornecedor, preço, documento fiscal ou regime.
- Dados de extrato e contas contém sigilo bancário e LGPD: upload autorizado, armazenamento cifrado, mascaramento, limite de tamanho, antivírus/política de conteúdo, logs seguros e retenção auditada por tipo; excluir arquivo pelo operador não pode apagar eventos financeiros.
- Homologação: registros reais de HML somente com anuência bancária e anonimização em fixtures; qualquer operação financeira real requer controles dos responsáveis.
- A proposta comercial inclui processamento do fallback dentro de E11, com esforço de parsers por **layout validado** e três bancos; novos formatos/versões/carteiras/serviços fora da matriz aprovada são alteração contratual.

## 4. Tarefas granulares, inputs, outputs, testes e impeditivos
### E11-T00 — Avaliação CROSS obrigatória: APIs, arquivos e razão financeiro
**Objetivo/implementação determinística:** Produzir inventário de E04–E09 e E11 por banco, conta, convênio e serviço: API cobrança, webhook, extrato, pagamento, DDA, arquivo remessa, retorno cobrança, extrato, retorno pagamentos. Validar layout e versão oficiais com o banco, indicar disponibilizado/habilitado/não disponível, credenciais, frequência, canal de entrega, referência para correlação, regras de retificação e segurança. Decidir quais opções de fonte ativar por capability, construir diagrama único e matriz ownership das tabelas/eventos. Registrar ADR e obter Portão 1 antes de migrations ou adapters.
**Aceite funcional/técnico e testes obrigatórios:** Matriz assinada por TI, Karina/tesouraria e responsável bancário; inventário de objetos existentes no develop e novas tabelas; nenhuma criação de gateway/handler antes da decisão documental. Não escolher layout só pela extensão.
**Cross-dependências:** ALP-133..141, ALP-142..154, E11-T01..T11.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T01 — Canonicalização: tabelas de origem, lote, observação e evento bancário
**Objetivo/implementação determinística:** Criar migração aditiva para bank_import_batches, bank_source_observations, bank_transactions, bank_transaction_observation_links, bank_cobranca_events, bank_statement_periods e reconciliation_conflicts, com empresaId, bankAccountId, convenioId nullable, sourceChannel API/WEBHOOK/CNAB240/CNAB400/OFX/CSV, sourceDocumentId, sourceEventKey, normalizedKind, layoutVersion, bankEventId nullable, nossoNumero/endToEndId/txId/numeroDocumento nullable, effectiveDate, postingDate, amount NUMERIC, direction, rawPayloadEncryptedPointer, hash and timestamps. Separar observação de fato canônico; vínculos N:M; outbox emitida só quando fato canônico vira estado efetivo. Controles UNIQUE para lote SHA256 por empresa/conta/tipo/serviço, observação sourceEventKey + canal, evento canônico chave externa forte por conta e tipo, baixa única em ledger. Não inventar vínculo forte quando ausência de referência.
**Aceite funcional/técnico e testes obrigatórios:** Provas com mesmo evento API+CNAB e CNAB+OFX+CSV, um bank_transaction, várias observations, um lançamento contábil; evento sem ID inequívoco fica pendente e não comita baixa.
**Cross-dependências:** ALP-133, ALP-138..140, ALP-146..148.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T02 — Matriz de formatos, contratos e validadores por banco/serviço
**Objetivo/implementação determinística:** Definir bank_file_layout_registry {banco,servico,direcao,formato,versao,encoding,headerRules,recordLength,segmentMap,checksumRules,activeFrom,to,approvedBy}. Registrar manifestos de layout e fixtures sintéticas homologadas para Bradesco/Itaú/Santander. Não generalizar que CNAB240 cobrança é igual CNAB240 extrato ou que CNAB400 tem estrutura idêntica entre bancos. Implementar detecção por cabeçalho + configuração de convênio (nunca por extensão apenas), parser dispatch explícito e validação de trailers/somas/contagens. Só aceitar variante verificada no T00.
**Aceite funcional/técnico e testes obrigatórios:** Upload layout desconhecido ou não homologado é rejeitado 422 sem transações; diferença de charset, newline CRLF, registro truncado, conta e CNPJ divergentes geram bloqueio.
**Cross-dependências:** ALP-133, ALP-135, ALP-137.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T03 — Importação CNAB 240 extrato/conciliação bancária
**Objetivo/implementação determinística:** Implementar parser de extrato CNAB240 segmento E quando disponível por conta/banco, cabeçalhos de arquivo/lote, datas, saldos abertura/fechamento, lançamentos, naturezas, codificação do histórico, totais. Regra: primeiro layout FEBRABAN como referência e overlay versionado específico do banco. Aceitar apenas extrato compatível com serviço firmado; integrar bank_statement_periods e reconciliação de saldo.
**Aceite funcional/técnico e testes obrigatórios:** Arquivo parcial, saldo sem lastro ou frequências sobrepostas gera alerta e bloqueia fechamento automático. Frequência D+1 pode trazer saldos parciais; não marcar conciliado final a partir de snapshot incompleto.
**Cross-dependências:** ALP-135, ALP-138, ALP-145.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T04 — Importação CNAB 240/400 de retorno de cobrança
**Objetivo/implementação determinística:** Implementar por banco e carteira o retorno de registro de boleto, rejeição, liquidação, baixa/cancelamento, alteração, tarifa/encargo, desconto/abatimento conforme códigos documentados. Segmentar eventos de cobrança separados de movimento de extrato; só eventos de liquidação comprovados e vinculados a título, dentro da política, geram baixa; quando posteriormente extrato evidencia crédito, reconciliar liquidação já existente sem nova receita. Retorno CNAB240/400 são adaptadores banco+layout próprios.
**Aceite funcional/técnico e testes obrigatórios:** Não confundir baixa de registro com pagamento real; Pix vinculado ao boleto depende do retorno específico homologado. Retorno importado após API não cria segundo boleto nem segundo título.
**Cross-dependências:** ALP-131, ALP-134, ALP-139, ALP-140.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T05 — Importação OFX e CSV com perfis de instituição
**Objetivo/implementação determinística:** OFX: parser estrito para transações, IDs FITID (quando confiável), data, valor, moeda, conta e saldo quando presente; perfis para OFX variantes aprovadas. CSV: importação por mapeamento explícito de cabeçalho, delimitador, separador decimal, timezone/datas, sinal de débito/crédito, banco e conta, versão; não inferir livremente por IA ou heurística. Identidade forte via transactionId; sem isso marcar tentativa de match por conjunto mais amplo como proposta/manual.
**Aceite funcional/técnico e testes obrigatórios:** Valor 1.234,56 vs 1,234.56, timezone e centavos testados; CSV sem ID não deve autobaixar por valor/data; criptografar blob original e manter SHA.
**Cross-dependências:** ALP-135, ALP-138, ALP-139.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T06 — Remessa bancária por arquivo quando API da operação indisponível
**Objetivo/implementação determinística:** Permitir gerar remessa de cobrança (e eventualmente pagamento somente se habilitado), com layout homologado para banco/convênio/carteira, número sequencial, header/trailer, registros obrigatórios, checksum. Fluxo: operador aprovado gera artefato + hash → faz transmissão ao banco por canal autorizado **fora** do ERP se não houver integração de transporte → marca comprovante de envio → importa retorno de aceite/rejeição → somente confirma registro/execução pelo retorno ou consulta bancária inequívoca. Sem remessa para serviço não habilitado.
**Aceite funcional/técnico e testes obrigatórios:** Download/remessa não é boleto registrado, pagamento efetuado nem confirmação bancária. Reenvio do mesmo lote exige verificação e autorização para não duplicar instrução bancária.
**Cross-dependências:** ALP-127, ALP-130..131, ALP-136.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T07 — Upload seguro e pipeline de validação/quarentena de arquivos
**Objetivo/implementação determinística:** Tela e API para arrastar/selecionar arquivos, banco, conta, serviço, data, layout detectado, hash, lote, prévia, contagem, totais, warnings e histórico. Processar streaming com limite e AV/política corporativa, mimetype e conteúdo, sem planilha com fórmula executável; arquivo original imutável criptografado, RBAC de importador, revisão/confirmador segregados. Persistir upload em quarantine → parsed → validated → reviewed → ingested/rejected; job restart idempotente por lote.
**Aceite funcional/técnico e testes obrigatórios:** Blob duplicado apresenta status já importado, não replica fatos; arquivo com conta divergente bloqueia lote; validação não implica baixa automática.
**Cross-dependências:** ALP-135, ALP-138, ALP-148.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T08 — Orquestração fallback/retorno à API por capability
**Objetivo/implementação determinística:** Definir routing policy por accountId/capability: API_PREFERRED, FILE_ALLOWED, API_DISABLED, MANUAL_REVIEW. Critério de fallback: API 403 de escopo/credenciamento, indisponibilidade persistente validada, sem endpoint para capability, configuração manual autorizada. Não ativar fallback por uma falha isolada ou timeout sem reconciliação. Se API normaliza e depois arquivo chega: juntar observações, não repetir baixa. Quando API volta: replay retroativo com checkpoint e prevenção de duplicidade. Registrar quem alterou modo, motivo, vigência e hash da versão do contrato.
**Aceite funcional/técnico e testes obrigatórios:** Mudar fonte não muda lançamento já conciliado; se registros contradizem, conflito e congelamento da baixa/fechamento até revisão; zero reenvio bancário automático de remessa.
**Cross-dependências:** ALP-133..137, ALP-138..145.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T09 — Painel de importações, exceções e proveniência
**Objetivo/implementação determinística:** Telas: Caixa de Entrada de Arquivos, Detalhe de Lote/Prévia, Divergências de fontes, Histórico por transação e Monitor de disponibilidade dos canais. Exibir estado, protocolo, banco, conta mascarada, serviço, soma, qte, layout, origem API/arquivo, chaves fortes, correspondências e decisões. Operações: importar, simular, confirmar, rejeitar, reprocessar somente após causa tratada e autorizar conflito; nenhuma edição direta em extrato original.
**Aceite funcional/técnico e testes obrigatórios:** Obrigatória acessibilidade, campos de negócio e actor, 403 para perfil sem permissão, tranca após fechamento; não renderizar dados sigilosos em tela de preview não autorizada.
**Cross-dependências:** ALP-138..141, ALP-142.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T10 — Conciliação integrada AR/AP/tesouraria/contabilidade
**Objetivo/implementação determinística:** Motor único recebe movimentos canônicos confirmados, mapeia efeitos em AR/AP e razão. Algoritmo determinístico por chave forte bancária, parcela, nossoNúmero/txId, conta, empresa, direção, valor e data efetiva. Um evento pode ter observações múltiplas. Transação de baixa com UNIQUE sourceEconomicEventId+allocationId; pagamento parcial distribui via alocações explícitas; tarifa é evento próprio separado, transferência exige duas pernas sem reconhecer receita. Estorno é movimento compensatório, não delete. Permitir vínculo quando retorno cobrança confirma liquidação mas extrato chega D+1 sem duplicar caixa.
**Aceite funcional/técnico e testes obrigatórios:** Teste receber API e CNAB com mesmo txId, retorno cobrança e extrato com mesmo crédito, OFX e API sobrepostos, arquivo de correção bancária e inversão de operação: um título baixado e lançamentos contabilmente equilibrados.
**Cross-dependências:** ALP-124..132, ALP-138..154.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.

### E11-T11 — Homologação cruzada 3 bancos × formatos × operações e contingência
**Objetivo/implementação determinística:** Construir matrizes de testes por banco, conta, carteira, serviço e layout/vigência; fixtures sintéticas e, em homologação privada, amostras descaracterizadas aceitas pelos bancos. Casos API indisponível antes/depois de retorno, arquivo remessa gerado sem envio, retorno parcial, falha de lote com trailer, correção, extrato duplicado, D+1, falha concorrente, failback e fechamento de mês. Gerar relatório evidências CI/Playwright e aceite por Karina/tesouraria e auditor.
**Aceite funcional/técnico e testes obrigatórios:** Só liberar canal por capability se versão de layout e testes aprovados; sem arquivos bancários reais para determinada variante manter opção bloqueada com explicação; cliente negocia com banco.
**Cross-dependências:** ALP-133..154.
**Requisitos não funcionais:** isolamento por banco e serviço, PostgreSQL numeric/string para valores, guardrails de idempotência, testes negativos, fault injection, transações com outbox, RBAC e logs sem segredo; plano tático Kiro lista arquivos existentes reais antes de qualquer alteração.
**Requisito inverso:** proibido segundo motor de conciliação, criação de baixa por upload, tabela de conta paralela, supressão de observação conflitante, reconhecimento de boleto registrado como liquidado, e importação de layout não aprovado.
## 5. Casos de teste matriciais numerados para Kiro
| Caso | Evidência | Resultado |
|---|---|---|
| XB-01 | API e OFX mesma transação com FITID confiável e ID bancário comprovado | uma transação, duas observações, uma baixa |
| XB-02 | API e CNAB retorno de liquidação mesmo nosso número/evento | um evento de cobrança, nenhuma duplicata |
| XB-03 | retorno cobrança liquidação e extrato crédito D+1 sem chave de vínculo conclusiva | pendência/sugestão; nenhuma segunda baixa automática |
| XB-04 | CNAB/OFX/CSV mesmo evento, nomes de arquivos distintos | um evento econômico, múltiplos blobs/evidências |
| XB-05 | mesmo arquivo importado duas vezes | HTTP 200 com lote existente e zero novos movimentos |
| XB-06 | dois arquivos diferentes com igual valor e data para transações reais distintas | duas observações; não colapsar por valor/data |
| XB-07 | API timeout no registro boleto; depois arquivo remessa gerado | bloquear remessa até consulta e resolução da incerteza |
| XB-08 | remessa exportada, mas sem retorno de aceite | status apenas exportado, não registrada/paga |
| XB-09 | arquivo segmento E saldo inicial/final não bate | nenhuma conciliação final; abertura de divergência |
| XB-10 | pagamento parcial com tarifa | parcela parcial + tarifa separada, lançamento contábil equilibrado |
| XB-11 | arquivo de retificação/estorno | evento compensatório e trilha; sem delete |
| XB-12 | API recuperada após três dias de importação arquivo | replay sem baixa/título/razão duplicados |
| XB-13 | arquivo para conta de outro CNPJ ou convênio | 422/quarentena; zero transação financeira |
| XB-14 | múltiplos usuários importam mesmo arquivo simultaneamente | somente um lote confirmado |
| XB-15 | arquivos desconhecidos / linha truncada / encoding inválido | rejeição por layout/linha e indicação de correção |
| XB-16 | cenário por banco × formato × convênio | ativado apenas após evidências de layout e banco |
## 6. Fontes externas de referência (verificar em T00)
- FEBRABAN 240 v10.9: https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20padrao%20CNAB240%20V%2010%2009%20-%2014_10_21.pdf
- Bradesco validador: https://wspf.bradesco.com.br/wsValidadorUniversal/
- Itaú cobrança 400: https://download.itau.com.br/bankline/itaubba/cobranca_400_itaubba.pdf
- Santander layouts: https://www.santander.com.br/layout-de-arquivos
Estas fontes **não provam habilitação** do convênio específico da AlphaCarnes. Karina e bancos devem fornecer manuais por conta, serviço, versão e exemplos descaracterizados.
