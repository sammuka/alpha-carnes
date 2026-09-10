# 08 — Matriz de estados e transições

> Todas as entidades do AlphaCarnes que carregam status, com as transições que o código permite e as que
> ele recusa. Serve para dois propósitos na homologação: garantir que **cada status seja exercitado ao
> menos uma vez** e dar ao homologador a lista exata de transições inválidas a provocar.
>
> **Origem:** enums e CHECK constraints do schema Drizzle, matrizes `TRANSICOES_*` do backend e validações
> nos services. Onde o código não decide, o campo **Permitido?** traz `A confirmar`.

---

## Convenções

| Símbolo | Significado |
|---|---|
| **Sim** | Transição implementada e validada |
| **Não** | Bloqueada com erro explícito (a mensagem está na coluna Observações) |
| **A confirmar** | Não há regra explícita no código — ⚠️ REGRA A CONFIRMAR COM NEGÓCIO |
| **terminal** | Estado final; nenhuma transição sai dele |

---

# 1. Operação (`operacoes`)

**Status:** `aberta` · `em_andamento` · `fechada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Gerar cadência / criar extraordinária | `aberta` | Sim | JRN-OPE-001 / 002 |
| `aberta` | Iniciar | `em_andamento` | Sim | JRN-OPE-003 |
| `aberta` | Fechar | `fechada` | Sim | Sem verificação de pendências — GAP-020 |
| `em_andamento` | Fechar | `fechada` | Sim | idem |
| `em_andamento` | Reabrir | `aberta` | A confirmar | Não localizada transição de retorno |
| `fechada` | Qualquer transição | — | Não | `409` |
| `fechada` | Criar pedido / compra na operação | — | **A confirmar** | **GAP-012, severidade Crítica**: o código não bloqueia |

**Cobertura:** JRN-OPE-001, 002, 003, 004.

---

# 2. Compra programada (`compras_programadas`)

**Status:** `rascunho` · `confirmada` · `cancelada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Salvar rascunho | `rascunho` | Sim | Unicidade por operação (`uq_compras_prog_operacao`) |
| `rascunho` | Editar itens | `rascunho` | Sim | Sem restrição |
| `rascunho` | Confirmar | `confirmada` | Sim | **Gera disponibilidade virtual** — o marco do planejamento |
| `rascunho` | Cancelar | `cancelada` | Sim | 🔎 sem botão na UI — GAP-032 |
| `confirmada` | Confirmar de novo | `confirmada` | Sim | Idempotente |
| `confirmada` | Editar (modal de impacto) | `confirmada` | Sim | Recalcula disponibilidade; déficit exige confirmação (`IMPACTO_CONFIRMACAO_NECESSARIA`) |
| `confirmada` | Cancelar | — | **Não** | O service recusa |
| `cancelada` | Confirmar | — | Não | `409` |
| `cancelada` | Editar | — | Não | `409` |

**Cobertura:** JRN-CMP-001 a 005.

---

# 3. Disponibilidade virtual (`disponibilidades_virtuais`)

**Status:** `gerada` · `parcialmente_reservada` · `esgotada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Confirmar compra | `gerada` | Sim | `quantidade_disponivel = quantidade_total` |
| `gerada` | Reserva parcial | `parcialmente_reservada` | Sim | Automático |
| `parcialmente_reservada` | Reserva total | `esgotada` | Sim | Pill **ESGOTADO** na grade |
| `esgotada` | Liberar reserva | `parcialmente_reservada` | Sim | Devolução imediata |
| `parcialmente_reservada` | Liberar todas | `gerada` | Sim | — |
| `esgotada` | Nova venda | — | Sim, **como overbooking** | AD-05: sem limite, com confirmação |
| qualquer | Aumentar a compra | recalculado | Sim | JRN-CMP-003 |
| qualquer | Reduzir a compra abaixo do reservado | recalculado com déficit | Sim, com confirmação | `IMPACTO_CONFIRMACAO_NECESSARIA` |

🔎 A UI exibe o status **técnico** nesta grade — GAP-034.
**Cobertura:** JRN-DIS-001, 002, 003.

---

# 4. Pedido de venda (`pedidos_venda`)

**Status:** `rascunho` · `em_elaboracao_reserva_ativa` · `aguardando_confirmacao_overbooking` ·
`finalizado` · `parcialmente_atendido` · `atendido` · `faturado` · `cancelado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Salvar rascunho | `rascunho` | Sim | **Reserva já acontece aqui** (v1.1 §6.3) |
| `rascunho` | Incluir item | `rascunho` | Sim | Reserva imediata; item duplicado bloqueado |
| `rascunho` | Reduzir/remover item | `rascunho` | Sim | Devolve saldo; exige `motivo` |
| `rascunho` | Registrar adendo | `rascunho` | Sim | AD-03; append-only em `adendos_pedido` |
| `rascunho` | Finalizar | `finalizado` | Sim | Exige item sem overbooking pendente |
| `rascunho` | Finalizar com item `aguardando_confirmacao_overbooking` | — | **Não** | `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` |
| `rascunho` | Liberar reserva (admin) | `cancelado` | Sim | `PEDIDO_RESERVA_LIBERAR`; justificativa ≥ 10 caracteres |
| `rascunho` | Cancelar | `cancelado` | Sim | Exige `motivo`; 🔎 sem botão na UI — GAP-037 |
| `finalizado` | Editar itens | — | **Não** | `409 PEDIDO_NAO_ABERTO` |
| `finalizado` | Finalizar de novo | — | Não | `Pedido já finalizado` |
| `finalizado` | Liberar reserva | — | Não | `400 PEDIDO_NAO_ESTA_EM_RASCUNHO` |
| `finalizado` | Cancelar | `cancelado` | A confirmar | GAP-036 |
| `finalizado` | Entrar em carga | `finalizado` | Sim | Status do pedido não muda |
| `cancelado` | Qualquer ação | — | Não | `Pedido já cancelado` |
| `parcialmente_atendido` / `atendido` / `faturado` | — | — | **Inalcançável hoje** | 🔎 **GAP-038**: existem no schema, nenhum endpoint os produz (pendência **P15**) |

**Reserva não expira sozinha** (AD-06): não há TTL nem job de expiração. Só a liberação administrativa
devolve o saldo de um rascunho abandonado.

**Cobertura:** JRN-PVD-001 a 009.

---

# 5. Item do pedido de venda (`pedidos_venda_itens`)

**Status principais:** `totalmente_reservado` · `aguardando_confirmacao_overbooking` · `overbooking_confirmado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Incluir com saldo | `totalmente_reservado` | Sim | Origem **Virtual** ou **Físico** |
| — | Incluir acima do saldo | `aguardando_confirmacao_overbooking` | Sim, **sem persistir** | Challenge `409`; nada é gravado se cancelar |
| `aguardando_confirmacao_overbooking` | Confirmar overbooking | `overbooking_confirmado` | Sim | Cria reserva tipada + pendência, atomicamente |
| `overbooking_confirmado` | Finalizar o pedido | permitido | Sim | AD-05: após confirmado não bloqueia |
| `totalmente_reservado` | Reduzir | `totalmente_reservado` | Sim | Saldo devolvido |
| `overbooking_confirmado` | Reduzir até zerar o déficit | `totalmente_reservado` | Sim | Pendência passa a `cancelada` |
| qualquer | Alterar com pedido finalizado | — | Não | `409 PEDIDO_NAO_ABERTO` |

**Prioridade de consumo (automática, não escolhida pelo vendedor):** **físico → virtual → overbooking**.

**Cobertura:** JRN-PVD-001, 003, 004, 005.

---

# 6. Reserva de disponibilidade (`reservas_disponibilidade`)

**Status:** `ativa` · `liberada`
**Tipo de consumo:** `fisico` · `virtual` · `overbooking`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Incluir item no pedido | `ativa` | Sim | Transacional |
| `ativa` | Remover item | `liberada` | Sim | Devolve saldo |
| `ativa` | Cancelar pedido | `liberada` | Sim | Todas as reservas do pedido |
| `ativa` | Liberação administrativa | `liberada` | Sim | Com justificativa auditada |
| `ativa` | Passar do tempo | `ativa` | Sim | **Não expira** (AD-06) |
| `ativa` | Finalizar pedido | `ativa` | Sim | Muda de "reservado" para "comprometido" na leitura, não no registro |
| `liberada` | Reativar | — | Não | Nova reserva é criada |

**Cobertura:** JRN-PVD-001, 005, 008; JRN-DIS-001.

---

# 7. Pendência de overbooking (`pendencias_overbooking`)

**Status:** `aberta` · `em_analise` · `compra_complementar_programada` · `redistribuicao_decidida` ·
`novo_pedido_criado` · `resolvida` · `cancelada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Confirmar overbooking | `aberta` | Sim | Criada na mesma transação do pedido |
| `aberta` | Iniciar análise | `em_analise` | Sim | `OVERBOOKING_RESOLVER` |
| `aberta` / `em_analise` | Programar compra complementar | `compra_complementar_programada` | Sim | Exige compra elegível |
| `aberta` / `em_analise` | Redistribuir | `redistribuicao_decidida` | Sim | Exige reserva doadora |
| `aberta` / `em_analise` | Postergar | `novo_pedido_criado` | Sim | Gera pedido na operação destino |
| qualquer decidida | Marcar como resolvido | `resolvida` | Sim | — |
| `aberta` / `em_analise` | Cancelar | `cancelada` | Sim | Exige motivo; **não resolve o déficit** — GAP-040 |
| — | Reduzir o item até zerar o déficit | `cancelada` | Sim | Automático |
| `resolvida` / `cancelada` | Qualquer decisão | — | Não | `409` (matriz `TRANSICOES_PENDENCIA`) |

**Cobertura:** JRN-OVB-001 a 005.

---

# 8. Tabela de preços (`tabelas_preco`)

**Status:** `rascunho` · `publicada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar tabela do dia | `rascunho` | Sim | Uma por data (`TABELA_PRECO_DUPLICADA`) |
| `rascunho` | Copiar tabela anterior | `rascunho` | Sim | `SEM_TABELA_PRECO_ANTERIOR` se não houver |
| `rascunho` | Salvar preços | `rascunho` | Sim | — |
| `rascunho` | Publicar com todos os preços | `publicada` | Sim | Registra em `tabelas_preco_publicacoes` |
| `rascunho` | Publicar com preço faltando | — | **Não** | `400 PRECOS_INCOMPLETOS` com a lista |
| `publicada` | Alterar preço e salvar | `publicada` (com aviso) | Sim | `Esta tabela já foi publicada anteriormente e sofreu alteração...` |
| `publicada` | Republicar | `publicada` | Sim | Nova entrada no histórico |
| `publicada` | Reverter para rascunho | `rascunho` | Sim | Ação `revertida_para_rascunho` no histórico |

🔎 O preço publicado **não é consumido** por nenhum outro módulo — GAP-041.
**Cobertura:** JRN-PRC-001 a 005.

---

# 9. Pedido ao fornecedor (`pedidos_fornecedor`)

**Status:** `rascunho` · `enviado` · `aguardando_recebimento` · `recebido` · `encerrado` · `cancelado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar a partir de compra confirmada | `rascunho` | Sim | Exige compra `confirmada` **com disponibilidade gerada** |
| `rascunho` | Enviar | `enviado` | Sim | Fica elegível para recebimento |
| `enviado` | Abrir recebimento | `aguardando_recebimento` | Sim | — |
| `aguardando_recebimento` | Concluir conferência | `recebido` | Sim | — |
| `recebido` | Encerrar | `encerrado` | Sim | — |
| `enviado` | Enviar de novo | — | Não | `Pedido em status enviado não pode ser enviado` |
| qualquer | Cancelar | `cancelado` | A confirmar | Efeito em cascata não definido — GAP-033 |

**Elegíveis para recebimento na UI:** apenas `enviado` e `aguardando_recebimento`.
🔎 Sem tela dedicada — GAP-042.
**Cobertura:** JRN-PFN-001.

---

# 10. Recebimento (`recebimentos`)

**Status:** `pesagem_em_andamento` · `aguardando_conclusao_pesagem` · `aguardando_conferencia_final` ·
`conferido_sem_divergencia` · `conferido_com_divergencia` · `ocorrencia_administrativa_aberta` ·
`tratativa_administrativa_concluida` · `cancelado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar lote | `pesagem_em_andamento` | Sim | Itens herdados do pedido ao fornecedor |
| `pesagem_em_andamento` | Concluir pesagem | `aguardando_conferencia_final` | Sim | `CONFERENCIA_CONCLUIR` |
| `aguardando_conferencia_final` | Suspender | `pesagem_em_andamento` | Sim | Retorno permitido |
| `aguardando_conferencia_final` | Concluir sem divergência | `conferido_sem_divergencia` | Sim | Exige NF e itens da NF |
| `aguardando_conferencia_final` | Concluir com divergência | `conferido_com_divergencia` | Sim | Gera ocorrência administrativa |
| `conferido_com_divergencia` | Abrir ocorrência | `ocorrencia_administrativa_aberta` | Sim | — |
| `ocorrencia_administrativa_aberta` | Concluir tratativa | `tratativa_administrativa_concluida` | Sim | — |
| `pesagem_em_andamento` (sem peça pesada) | Cancelar | `cancelado` | Sim | — |
| `pesagem_em_andamento` (com peça pesada) | Cancelar | — | **Não** | **Não é possível cancelar lote com pesagem registrada.** |
| `pesagem_em_andamento` | Concluir conferência | — | Não | `Recebimento não está em pesagem` |
| qualquer | Concluir sem NF | — | Não | `NF do fornecedor obrigatória` |
| qualquer | Concluir sem itens da NF | — | Não | `NF_ITENS_OBRIGATORIOS` |
| conferido | Concluir de novo | — | Não | `Conferência já concluída` |

**Status dos itens:** **Aguardando** · **Em conferência** · **Conferido** · **Divergente** · **Entrada direta**.

**Cobertura:** JRN-REC-001 a 007.

---

# 11. Divergência de recebimento e ocorrência de fornecedor

**Status (ambas):** `aberta` · `em_analise` · `aguardando_fornecedor` · `resolvida`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Registrar divergência | `aberta` | Sim | Exige tipo, descrição e ação imediata |
| `aberta` | Registrar andamento | `em_analise` | Sim | Rótulo **Em tratativa** |
| `em_analise` | Aguardar fornecedor | `aguardando_fornecedor` | Sim | — |
| qualquer | Concluir tratativa | `resolvida` | Sim | Rótulo **Concluída**; exige desfecho |
| `resolvida` | Encerrar de novo | — | Não | `Ocorrência já encerrada` / `Divergência já resolvida` |

**8 tipos de divergência:** `quantidade_menor`, `quantidade_maior`, `item_divergente`,
`qualidade_divergente`, `peso_incompativel`, `item_ausente`, `item_excedente`, `inconsistencia_nf_fisico`.

**Cobertura:** JRN-REC-004, 005.

---

# 12. Peça (`pecas`)

**Status:** `pesada` · `associada` · `em_sobra` · `em_analise` · `para_corte` · `divergente`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Capturar peso | `pesada` | Sim | Rótulo **Aguardando destino** |
| `pesada` | Vincular a pedido | `associada` | Sim | Rótulo **Pedido** |
| `pesada` | → Estoque | `em_sobra` | Sim | Exige motivo |
| `pesada` | → Desossa | `para_corte` | Sim | Entra na fila da desossa |
| `pesada` | → Análise | `em_analise` | Sim | — |
| `pesada` | → Divergência | `divergente` | Sim | — |
| `associada` | Redirecionar | `associada` (outro pedido) | Sim | `Só é possível redirecionar peça já associada` |
| `associada` | Estornar | `pesada` | Sim | `ASSOCIACAO_ESTORNAR`; invalida etiqueta |
| `associada` | Trocar peça | `em_sobra` / `para_corte` | Sim | Fluxo atômico de 6 passos |
| `pesada` | Vincular de novo | — | Não | `Peça já associada — use redirecionar` |
| `associada` (carga fechada) | Estornar / trocar | — | **Não** | `Peça já está em carga fechada — estorno bloqueado` |
| qualquer | Associar a pedido cancelado | — | Não | `Pedido cancelado não aceita associação` |
| qualquer | Associar a item completo | — | Não | `Item do pedido já está completo` |
| qualquer | Associar a produto incompatível | — | Não | `Item de pedido incompatível com a peça` |

**Cobertura:** JRN-PES-001 a 005.

---

# 13. Etiqueta (`etiquetas`)

**Estado:** `emitida` · `ativa` · `invalidada_por_troca` · `reimpressa` · `cancelada`
**Status de impressão:** `impressa` · `falha_impressao` · `pendente`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Confirmar associação + imprimir | `emitida` → `ativa` | Sim | `Etiqueta só pode ser emitida após a confirmação da associação` |
| `ativa` | Reimprimir | `reimpressa` | Sim | Exige motivo |
| `ativa` | Troca de peça | `invalidada_por_troca` | Sim | Nova etiqueta emitida na mesma transação |
| `ativa` | Cancelar | `cancelada` | Sim | Estorna a ação operacional vinculada |
| `cancelada` / `invalidada_por_troca` | Qualquer ação | — | Não | `Etiqueta já está em estado terminal` |
| `ativa` (peça em carga fechada) | Cancelar | — | **Não** | `Peça já está em carga fechada — cancelamento bloqueado` |

**Rótulos na tela:** **Ativa** · **Pendente de impressão** · **Reimprimida** · **Cancelada** ·
**Invalidada por troca** · **Bloqueada**.

**Cobertura:** JRN-ETQ-001, JRN-DES-004, JRN-PES-004.

---

# 14. Transformação / desossa (`transformacoes`)

**Status:** `aberta` · `em_execucao` · `aguardando_pesagem` · `aguardando_associacao` ·
`aguardando_etiquetagem` · `concluida` · `cancelada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Iniciar a partir de peça `para_corte` | `aberta` | Sim | `CORTE_GERENCIAR` |
| `aberta` | Definir regra (A ou B) | `em_execucao` | Sim | **Obrigatório antes de registrar partes**; regras exclusivas por unidade |
| `em_execucao` | Gerar subitens | `aguardando_pesagem` | Sim | Quantidade fixa pela regra |
| `aguardando_pesagem` | Pesar todos | `aguardando_associacao` | Sim | Peso variável |
| `aguardando_associacao` | Associar todos | `aguardando_etiquetagem` | Sim | — |
| `aguardando_etiquetagem` | Etiquetar todos + concluir | `concluida` | Sim | — |
| qualquer | Concluir com subitem incompleto | — | Não | Exige peso, destino e etiqueta em todos |
| qualquer | Concluir com checklist divergente sem registrar | — | **Não** | `Checklist divergente — registre o tipo antes de concluir.` |
| qualquer | Cancelar | `cancelada` | Sim | — |

**Tipos:** `simples` · `subdivisao` · `reclassificacao` · `destinacao_mista`.
**Motivos:** `preferencia_cliente` · `necessidade_operacional` · `divergencia` · `decisao_humana`.
⚠️ Regras A/B são **provisórias** (P12).

**Cobertura:** JRN-DES-002, 003.

---

# 15. Subitem da desossa (`subitens`)

**Status:** `gerado` · `pesado` · `associado` · `em_sobra` · `em_analise`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Regra aplicada | `gerado` | Sim | Quantidade definida pela regra |
| `gerado` | Pesar | `pesado` | Sim | Peso variável na balança da desossa |
| `pesado` | Associar a pedido | `associado` | Sim | — |
| `pesado` | Sem cobertura → sobra | `em_sobra` | Sim | — |
| `pesado` | Sem cobertura → análise | `em_analise` | Sim | — |
| `associado` | Redirecionar | `associado` (outro) | Sim | — |
| `associado` | Etiquetar | `associado` | Sim | Pré-requisito para concluir |

**Cobertura:** JRN-DES-002.

---

# 16. Item de estoque

**Status:** `disponivel` (**Disponível**) · `destinado_pedido` (**Destinado a pedido**) ·
`em_desossa` (**Em desossa**) · `bloqueado_ocorrencia` (**Bloqueado por ocorrência**)

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Peça → Estoque / entrada de caixaria | `disponivel` | Sim | — |
| `disponivel` | Destinar a pedido | `destinado_pedido` | Sim | `ITEM_NAO_DISPONIVEL` se não estiver |
| `disponivel` | Enviar à desossa | `em_desossa` | Sim | — |
| qualquer | Ocorrência aberta | `bloqueado_ocorrencia` | Sim | — |
| `destinado_pedido` | Destinar de novo | — | Não | `ITEM_DO_PEDIDO_COMPLETO` / `ITEM_NAO_DISPONIVEL` |
| qualquer | Destinar quantidade maior que o saldo | — | Não | `SALDO_INSUFICIENTE` |
| qualquer | Destinar a produto incompatível | — | Não | `ITEM_INCOMPATIVEL` |

🔎 O filtro **Reservado** da UI não corresponde a nenhum status — GAP-047.
**Consumo por FIFO:** itens com badge **Estoque anterior** são consumidos primeiro.

**Cobertura:** JRN-EST-001, 002.

---

# 17. Ajuste de estoque (`ajustes_estoque`)

**Status:** `aguardando_aprovacao` · `aplicado` · `rejeitado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar ajuste acima do limiar | `aguardando_aprovacao` | Sim | Limiar em `estoque.limiar_aprovacao_ajuste` |
| — | Criar ajuste abaixo do limiar | `aplicado` | Sim | Aplicação direta |
| `aguardando_aprovacao` | Aprovar (outro usuário) | `aplicado` | Sim | Saldo alterado |
| `aguardando_aprovacao` | Rejeitar (outro usuário) | `rejeitado` | Sim | Saldo intacto; motivo ≥ 5 caracteres |
| `aguardando_aprovacao` | Aprovar (o próprio criador) | — | **Não** | `SEGREGACAO_CRIADOR_APROVADOR` — controle interno |
| `aplicado` / `rejeitado` | Decidir de novo | — | Não | `AJUSTE_NAO_PENDENTE` |

**Motivos:** Quebra · Perda · Erro de contagem · Vencimento · Outro.

**Cobertura:** JRN-EST-003.

---

# 18. Aprovação operacional (`aprovacoes_operacionais`)

**Status:** `pendente` · `aprovada` · `rejeitada`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Solicitar | `pendente` | Sim | `APROVACOES_SOLICITAR` |
| `pendente` | Aprovar | `aprovada` | Sim | `APROVACOES_DECIDIR`; motivo ≥ 10 caracteres |
| `pendente` | Rejeitar | `rejeitada` | Sim | idem |
| `pendente` | Decidir sendo o próprio solicitante | — | **A confirmar** | 🔎 GAP-049: sem segregação, diferente do ajuste de estoque |
| decidida | Decidir de novo | — | Não | `409` |

**5 tipos:** Divergência de transformação · Estorno fora da regra · Reabertura de carga/pedido ·
Ajuste de estoque relevante · Pendência física de etiqueta.

**Cobertura:** JRN-APR-001.

---

# 19. Caminhão / carga (`caminhoes`) — matriz `TRANSICOES`

**Status:** `planejado` · `aguardando_carga` · `em_carga` · `em_conferencia` · `fechado` ·
`liberado_faturamento` · `faturado` · `liberado_saida` · `expedido`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar caminhão | `planejado` | Sim | Rótulo **Montando** |
| `planejado` | Preparar | `aguardando_carga` | Sim | Rótulo **Montando** |
| `aguardando_carga` | Abrir carga | `em_carga` | Sim | Rótulo **Montando** |
| `em_carga` | Enviar para conferência | `em_conferencia` | Sim | Rótulo **Em Conferência** |
| `em_conferencia` | Concluir conferência + fechar | `fechado` | Sim | Rótulo **Conferida**; bloqueia estornos |
| `em_conferencia` | Voltar para carga | `em_carga` | Sim | Retorno permitido |
| `fechado` | Reabrir | `em_carga` | Sim | `EXPEDICAO_REABRIR`; 🔎 sem botão na UI — GAP-052 |
| `fechado` | Liberar para faturamento | `liberado_faturamento` | Sim | Rótulo **Enviada para Faturamento** |
| `liberado_faturamento` | Emitir todas as NFS-e | `faturado` | Sim | Rótulo **Faturada** |
| `faturado` | Liberar saída | `liberado_saida` | Sim | **Só com checklist 100%** |
| `liberado_saida` | Expedir | `expedido` | Sim | terminal |
| `fechado` **com NFS-e emitida** | Reabrir | — | **Não** | `Reabertura bloqueada: caminhão possui NFS-e emitida` |
| não-`fechado` | Reabrir | — | Não | `Reabertura só permitida de 'fechado'. Status atual: {status}` |
| `faturado` | Liberar saída com checklist incompleto | — | **Não** | `CHECKLIST_INCOMPLETO` |
| qualquer inválida | — | — | Não | `Transição inválida: {de} → {para}. Permitidas: {lista}` |

🔎 Três status compartilham o rótulo **Montando** — GAP-050.

**Cobertura:** JRN-EXP-001 a 005, JRN-LIB-001.

---

# 20. Item da carga (`carga_itens`) e conferência

**Item:** `em_carga` (**Pendente**) · `conferido` (**Conferida**) · `divergente` (**Divergente**) ·
`removido` (**Removida**)
**Conferência:** `aberta` · `concluida`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Adicionar peça etiquetada | `em_carga` | Sim | Exige etiqueta + vínculo com pedido |
| `em_carga` | Bipar | `conferido` | Sim | Automático ou manual assistido |
| `em_carga` | Marcar divergência | `divergente` | Sim | 6 motivos disponíveis |
| `em_carga` | Remover | `removido` | Sim | — |
| `conferido` | Bipar de novo | — | **Não** | `ITEM_NAO_PENDENTE` — `Item já foi conferido ou tratado` |
| item de outra carga | Bipar | — | Não | `Item não está vinculado a esta carga (excedente)` |
| conferência com faltas | Concluir | — | Não sem forçar | `Conferência possui faltas. Use forcado=true com justificativa` |

**Cobertura:** JRN-EXP-002, 003.

---

# 21. Faturamento (`faturamentos`)

**Status:** `em_consolidacao` · `pronto_para_emitir` · `parcialmente_emitido` · `concluido`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Consolidar | `em_consolidacao` | Sim | Reúne os pedidos da carga |
| `em_consolidacao` | Sem bloqueios | `pronto_para_emitir` | Sim | 4 bloqueios possíveis |
| `pronto_para_emitir` | Emitir parte das notas | `parcialmente_emitido` | Sim | — |
| `parcialmente_emitido` | Emitir as restantes | `concluido` | Sim | Habilita a liberação de saída |
| qualquer | Emitir sem consolidar | — | Não | `Consolidação necessária antes de emitir` |
| qualquer | Emitir com carga aberta | — | Não | `Emissão só para caminhão 'fechado'. Status: {status}` |
| qualquer | Emitir com bloqueio ativo | — | Não | `Emissão bloqueada por pendências críticas` |

**Bloqueios:** `EXPEDICAO_NAO_FECHADA` · `DIVERGENCIA_CRITICA_NAO_TRATADA` · `DADOS_FISCAIS_INCOMPLETOS` ·
`PECA_SEM_RASTREABILIDADE`.
🔎 Status exibidos crus na tela — GAP-054.

**Cobertura:** JRN-FAT-001, 002.

---

# 22. NFS-e (`notas_fiscais`) — matriz `TRANSICOES_NFSE`

**Status:** `pendente` · `emitida` · `erro_emissao` · `cancelada` · `erro_cancelamento`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Emitir | `pendente` | Sim | Enviada ao EISS |
| `pendente` | Retorno OK | `emitida` | Sim | Pill **Autorizada**; `FAKE-001` no fake |
| `pendente` | Retorno com erro | `erro_emissao` | Sim | Pill **Erro** |
| `erro_emissao` | Reprocessar | `pendente` | Sim | Contador `{n} tentativa(s)` |
| `emitida` | Cancelar | `cancelada` | Sim | **Só antes da liberação do caminhão** |
| `emitida` | Cancelar com falha | `erro_cancelamento` | Sim | — |
| `erro_cancelamento` | Reprocessar cancelamento | `cancelada` | Sim | — |
| `cancelada` | Qualquer ação | — | Não | terminal |
| `emitida` (caminhão **liberado**) | Cancelar | — | **Não** | `NOTA_TRAVADA_CAMINHAO_LIBERADO` |
| pedido já com nota | Emitir de novo | — | Não | `Pedido já possui NFS-e em emissão ou emitida` |

**Gatilhos do fake:** valor `999.99` → `Atividade não autorizada`; valor `888.88` → timeout.

**Cobertura:** JRN-FAT-002, 003, 004.

---

# 23. Seguro da carga (`seguros_carga`) — matriz `TRANSICOES_SEGURO`

**Status:** `pendente` · `enviado` · `confirmado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Carga criada | `pendente` | Sim | — |
| `pendente` | Marcar como enviado | `enviado` | Sim | — |
| `enviado` | Marcar como confirmado | `confirmado` | Sim | Badge **Seguro tratado** |
| `enviado` | Voltar para pendente | `pendente` | Sim | Retorno permitido |
| `pendente` | Marcar como confirmado | — | **Não** | `TRANSICAO_SEGURO_INVALIDA` — não pula etapa |
| `confirmado` | Qualquer transição | — | Não | terminal |

**Cobertura:** JRN-SEG-001.

---

# 24. Relatório SIF (`relatorios_sif`)

**Status:** `pendente_dados` · `pronto_para_gerar` · `gerado` · `retificado`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Dados incompletos | `pendente_dados` | Sim | Botão **Gerar** com title de bloqueio |
| `pendente_dados` | Dados completos | `pronto_para_gerar` | Sim | Automático |
| `pronto_para_gerar` | Gerar | `gerado` | Sim | Cria versão no histórico |
| `gerado` | Retificar | `retificado` | Sim | Motivo ≥ 10 caracteres |
| `retificado` | Retificar de novo | `retificado` | Sim | Nova versão |
| `pendente_dados` | Gerar | — | Não | `Resolva as pendências de dados antes de gerar` |

⚠️ Conteúdo provisório (P8) — homologar o fluxo, não o conteúdo.

**Cobertura:** JRN-SIF-001.

---

# 25. Usuário (`usuarios`)

**Estados:** ativo/inativo (booleano) + aprovação + `deleted_at`

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar | ativo | Sim | Exige perfil |
| ativo | Inativar | inativo | Sim | Impede login |
| inativo | Ativar | ativo | Sim | — |
| qualquer | Aprovar | aprovado | Sim | `USUARIOS_APROVAR` (SF-01); 🔎 gestor sem menu — GAP-003 |
| qualquer | Excluir | soft delete | Sim | `deleted_at` preenchido |
| excluído | Restaurar | ativo | Sim, **só via API** | 🔎 sem botão na UI — GAP-002 |

**Cobertura:** JRN-ADM-001, 002, 003.

---

# 26. Cadastros genéricos

Todos os cadastros (`clientes`, `fornecedores`, `produtos`, `representantes`, `itens_compra`,
`itens_comerciais`, `rotas`, `frota_caminhoes`, `frota_motoristas`, `regras_*`, `modelos_etiqueta`)
seguem o mesmo ciclo:

| Estado atual | Ação | Próximo estado | Permitido? | Observações |
|---|---|---|---|---|
| — | Criar | ativo | Sim | — |
| ativo | Editar | ativo | Sim | — |
| ativo | Inativar | inativo | Sim | Some dos comboboxes operacionais |
| inativo | Ativar | ativo | Sim | — |
| ativo/inativo | Excluir | soft delete (`deleted_at`) | Sim | Nunca DELETE físico |
| excluído | Restaurar | ativo | Sim, **só via API** | GAP-002 |
| com vínculos | Inativar/excluir | — | **A confirmar** | GAP-008 |

**Cobertura:** JRN-CAD-000 (ficha mestra) e as fichas específicas.

---

# Checklist de cobertura de status

Use esta lista para garantir que **nenhum status ficou sem ser exercitado**.

| Entidade | Status | Jornada que o produz | ✔ |
|---|---|---|---|
| Operação | aberta / em_andamento / fechada | JRN-OPE-001 / 003 / 003 | ☐ |
| Compra | rascunho / confirmada / cancelada | JRN-CMP-001 / 002 / 004 | ☐ |
| Disponibilidade | gerada / parcialmente_reservada / esgotada | JRN-CMP-002 / JRN-PVD-001 / JRN-PVD-003 | ☐ |
| Pedido | rascunho / finalizado / cancelado | JRN-PVD-001 / 002 / 007 | ☐ |
| Pedido | parcialmente_atendido / atendido / faturado | **inalcançável — GAP-038** | ☒ |
| Item de pedido | reservado / aguardando OB / OB confirmado | JRN-PVD-001 / 003 / 003 | ☐ |
| Reserva | ativa / liberada | JRN-PVD-001 / 005 | ☐ |
| Pendência OB | 7 status | JRN-OVB-001 a 005 | ☐ |
| Tabela de preços | rascunho / publicada | JRN-PRC-001 / 004 | ☐ |
| Pedido fornecedor | 6 status | JRN-PFN-001 + JRN-REC-* | ☐ |
| Recebimento | 8 status | JRN-REC-001 a 006 | ☐ |
| Divergência | 4 status | JRN-REC-004 / 005 | ☐ |
| Peça | 6 status | JRN-PES-001 / 005 | ☐ |
| Etiqueta | 5 estados | JRN-ETQ-001 + JRN-PES-004 | ☐ |
| Transformação | 7 status | JRN-DES-002 | ☐ |
| Subitem | 5 status | JRN-DES-002 | ☐ |
| Item de estoque | 4 status | JRN-EST-001 | ☐ |
| Ajuste | 3 status | JRN-EST-003 | ☐ |
| Aprovação | 3 status | JRN-APR-001 | ☐ |
| Caminhão | 9 status | JRN-EXP-001 a 005 + JRN-FAT-002 + JRN-LIB-001 | ☐ |
| Item de carga | 4 status | JRN-EXP-002 / 003 | ☐ |
| Faturamento | 4 status | JRN-FAT-001 / 002 | ☐ |
| NFS-e | 5 status | JRN-FAT-002 / 003 | ☐ |
| Seguro | 3 status | JRN-SEG-001 | ☐ |
| Relatório SIF | 4 status | JRN-SIF-001 | ☐ |
| Usuário | ativo / inativo / excluído | JRN-ADM-002 | ☐ |
