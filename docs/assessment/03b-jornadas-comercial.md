# 03b — Jornadas Operacionais (Parte 2: Planejamento e Comercial)

> Continuação de [`03-jornadas-operacionais.md`](03-jornadas-operacionais.md).
> Módulos: **M05 Compra Programada** · **M06 Disponibilidade** · **M07 Pedidos de Venda** ·
> **M08 Overbooking** · **M09 Tabela de Preços** · **M10 Espelho Comercial**.
>
> Este é o coração comercial do sistema: é aqui que a **disponibilidade virtual** nasce (compra confirmada),
> é consumida (reserva do pedido) e é estourada (overbooking). Os cenários negativos deste bloco são os mais
> importantes de todo o assessment.

---

# M05 — Compra Programada (Pedido de Compra)

## Jornada: Criar compra programada em rascunho

### ID
`JRN-CMP-001`

### Objetivo
Registrar o que será comprado do frigorífico para uma operação, sem ainda gerar disponibilidade.

### Perfil do usuário
`compras`, `gestor`, `administrador`.

### Pré-condições
- Operação **aberta** ou **em andamento** para a data alvo (`JRN-OPE-001`).
- FORN-A cadastrado e ativo (`JRN-CAD-005`).
- Item de compra `BOI-CASADO` ativo (`JRN-CAD-003`).
- Regras de desdobramento ativas (`JRN-CAD-010`) — **sem elas a confirmação não gera saldo**.

### Dados necessários

| Campo | Valor |
|---|---|
| **Data operacional** | data da operação criada |
| **Fornecedor** | `Frigorífico Homologação A LTDA` |
| **Referência externa** | `PC-HOM-001` |
| **Observações** | `Compra de homologação` |
| Item / Quantidade | `BOI-CASADO` / `10` |

### Ponto inicial
Menu → **GESTÃO** → **Compras** (`/gestao/compras`)

### Passo a passo

| Passo | Tela | Ação do usuário | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Compras | Abrir a tela | — | Título **Compra Programada (Pedido de Compra)**, subtítulo `Planejamento de compra e geração de disponibilidade virtual` |
| 2 | Compras | Selecionar **Data operacional** (`#data`) | data da operação | Tela carrega a compra do dia (nenhuma ainda) |
| 3 | Compras | Abrir o combobox **Fornecedor** (`#fornecedor`) | — | Placeholder `Selecione o fornecedor`, busca `Buscar fornecedor…` |
| 4 | Compras | Escolher FORN-A | — | Fornecedor fixado |
| 5 | Compras | Preencher **Referência externa** (`#ref`) | `PC-HOM-001` | — |
| 6 | Compras | Na primeira linha de item, escolher **Item** | `BOI-CASADO` | Coluna **Regra de Desdobramento** exibe as regras (não `—`) |
| 7 | Compras | Preencher **Quantidade** | `10` | Painel de simulação à direita projeta a disponibilidade estimada |
| 8 | Compras | (Opcional) **Adicionar item** | — | Nova linha |
| 9 | Compras | Preencher **Observações** (`#obs`) | texto | — |
| 10 | Compras | Clicar **Salvar rascunho** | — | Compra criada; pill de status **Rascunho**; **Data operacional** fica desabilitada |

### Resultado final esperado
Compra programada em `rascunho`, vinculada à operação e ao fornecedor, com 1 item de 10 unidades.
**Nenhuma disponibilidade virtual foi criada ainda.**

### Efeitos colaterais
- Linhas em `compras_programadas` e `compras_programadas_itens`.
- A operação deixa de exibir o selo **Sem compra programada** em `/gestao/operacoes`.
- Nenhum saldo em `/comercial/disponibilidade`.

### Validações funcionais
- Só é possível **uma compra ativa por operação** (`uq_compras_prog_operacao`).
- Quantidade deve ser > 0 (CHECK no banco).
- O painel direito exibe `A disponibilidade aparecerá após confirmar a compra programada.` até a confirmação.

### Validações visuais / UX
- Aviso informativo: `Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada.`
- A coluna **Previsão (kg)** sempre mostra `—` (depende de peso médio por item, ainda não modelado).
- O ícone de lixeira da linha fica desabilitado quando só há uma linha.
- Botão **Salvar rascunho** desabilitado sem permissão, com compra não editável, ou durante o envio.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CMP-001-A1` | Compra com **múltiplos itens** de compra | Todos salvos; simulação soma os desdobramentos |
| `JRN-CMP-001-A2` | Reabrir a compra em rascunho e alterar a quantidade | Alteração salva sem restrição (status editável) |
| `JRN-CMP-001-A3` | Remover uma linha de item | Linha some; total recalculado |
| `JRN-CMP-001-A4` | Chegar pela URL `/gestao/compras?data=YYYY-MM-DD` (link **Registrar compra**) | Data pré-carregada |
| `JRN-CMP-001-A5` | Item de compra **sem regra de desdobramento** | Coluna **Regra de Desdobramento** mostra `—`; o rascunho salva, mas ver `JRN-CMP-002-N2` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CMP-001-N1` | Salvar sem fornecedor | **Informe fornecedor e ao menos um item com quantidade.** |
| `JRN-CMP-001-N2` | Salvar sem nenhum item com quantidade | Mesma mensagem |
| `JRN-CMP-001-N3` | Quantidade `0` | Bloqueado (CHECK `quantidade > 0`) |
| `JRN-CMP-001-N4` | Quantidade negativa | Bloqueado |
| `JRN-CMP-001-N5` | Quantidade absurda (ex.: `999999999`) | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: existe teto? — GAP-027 |
| `JRN-CMP-001-N6` | Item de compra duplicado na mesma compra | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: deveria somar ou bloquear? — GAP-028 |
| `JRN-CMP-001-N7` | Criar segunda compra para a **mesma operação** | `409` (unicidade por operação) |
| `JRN-CMP-001-N8` | Data sem operação cadastrada | Erro claro — a compra exige operação |
| `JRN-CMP-001-N9` | Fornecedor inativo | Não aparece no combobox |
| `JRN-CMP-001-N10` | Duplo clique em **Salvar rascunho** | Uma única compra |
| `JRN-CMP-001-N11` | F5 antes de salvar | Rascunho perdido, nenhum registro parcial |

### Permissões

| Perfil | Ler | Gerenciar |
|---|---|---|
| administrador, gestor, compras | Sim | Sim |
| comercial | Sim | Não |
| diretoria | Sim | Não |
| demais | Não | Não |

`JRN-CMP-001-P1`: `comercial` abre a tela mas os botões de mutação ficam indisponíveis.
`JRN-CMP-001-P2`: perfil sem `COMPRAS_PROGRAMADAS_LER` vê `Você não tem permissão para visualizar compras programadas.`

### Critérios de aprovação
Compra em rascunho criada, editável, com simulação coerente e sem gerar saldo antes da confirmação.

### Evidências recomendadas
Print da compra em rascunho com o painel de simulação; print da mensagem de validação.

---

## Jornada: Confirmar compra e gerar disponibilidade virtual

### ID
`JRN-CMP-002`

### Objetivo
**Jornada mais importante do planejamento**: transformar a compra em saldo vendável.

### Perfil do usuário
`compras`, `gestor`, `administrador`.

### Pré-condições
`JRN-CMP-001` concluída com regras de desdobramento ativas.

### Ponto inicial
`/gestao/compras` com a data da compra em rascunho.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Conferir o pill de status | **Rascunho** |
| 2 | Clicar **Confirmar compra** | Status vira **Confirmada**; painel direito passa a mostrar a disponibilidade real (`{qtd} disp.`) |
| 3 | Abrir `/comercial/disponibilidade` na data | Aba **Grade** lista TZ, DT e PA com **20** unidades cada (10 bois × fator 2 — AD-01) |
| 4 | Conferir os KPIs da grade | **Total gerado** = 60; **Reservado** = 0; **Disponível (livre)** = 60; **Recebido** = 0 |
| 5 | Voltar a `/gestao/compras` | Botão **Editar compra confirmada** disponível; **Salvar rascunho** bloqueado |

### Resultado final esperado
- `compras_programadas.status = confirmada`, com `data_confirmacao` preenchida.
- Registros em `disponibilidades_virtuais` com `status = gerada` e `quantidade_disponivel = quantidade_total`.

### Efeitos colaterais
- Pedidos de venda passam a poder reservar esses itens.
- O Painel Geral passa a contar **Compras programadas** e **Disponibilidade física + virtual**.
- Habilita a criação do **Pedido ao Fornecedor** (`JRN-REC-001`).

### Validações funcionais
- Quantidade gerada = `quantidade_comprada × fator_quantidade` de cada regra vigente.
- Confirmar duas vezes é idempotente.
- Compra `cancelada` não pode ser confirmada.

### Validações visuais / UX
- Transição do painel `A disponibilidade estimada aparecerá conforme itens e quantidades forem informados.`
  → valores reais.
- Estado do botão durante o envio.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CMP-002-A1` | Confirmar compra com múltiplos itens de compra | Disponibilidade somada por item comercial |
| `JRN-CMP-002-A2` | Confirmar novamente | Idempotente, sem duplicar saldo |
| `JRN-CMP-002-A3` | Consultar `GET /comercial/compras-programadas/:id/impacto` | Projeção coerente |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CMP-002-N1` | Confirmar compra **cancelada** | `409` |
| `JRN-CMP-002-N2` | Confirmar compra cujo item **não tem regra de desdobramento** | **Compra fica confirmada mas nenhuma disponibilidade é gerada** — comportamento silencioso; 🔎 **GAP-029** (não há aviso ao usuário) |
| `JRN-CMP-002-N3` | Confirmar como `comercial` | `403` |
| `JRN-CMP-002-N4` | Duplo clique em **Confirmar compra** | Uma confirmação, saldo correto |
| `JRN-CMP-002-N5` | Confirmar compra em operação **fechada** | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO — relacionado a GAP-012 |

### Permissões
`COMPRAS_PROGRAMADAS_GERENCIAR`.

### Critérios de aprovação
Saldo gerado na proporção exata da regra; GAP-029 confirmado.

### Evidências recomendadas
Print do saldo na grade de disponibilidade (deve mostrar 20/20/20 para 10 bois) e print do status confirmado.

---

## Jornada: Editar compra confirmada com painel de impacto

### ID
`JRN-CMP-003`

### Objetivo
Provar que alterar a compra depois de confirmada **recalcula a disponibilidade** e exige confirmação
explícita quando o resultado projeta déficit (v1.1 §6.1).

### Perfil do usuário
`compras`, `gestor`, `administrador`.

### Pré-condições
- `JRN-CMP-002` concluída (60 unidades geradas).
- Recomendado: um pedido já reservando parte do saldo (`JRN-PVD-001`), para haver déficit.

### Passo a passo — aumento (sem déficit)

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Clicar **Editar compra confirmada** | — | Modal **Editar compra confirmada** |
| 2 | Alterar a quantidade de `BOI-CASADO` | `10` → `12` | **Painel de impacto** atualiza |
| 3 | Conferir **Déficit resultante** | — | Sem déficit |
| 4 | Clicar **Salvar alteração** | — | Disponibilidade sobe para 24 de cada item |

### Passo a passo — redução (com déficit)

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 5 | Reabrir o modal e reduzir | `12` → `2` | Painel mostra **Total de déficit projetado:** > 0 |
| 6 | Tentar **Salvar alteração** | — | Bloqueado: **Alteração projeta déficit — use o painel de impacto para confirmar.** / `409 IMPACTO_CONFIRMACAO_NECESSARIA` |
| 7 | Confirmar o déficit no painel | — | Botão vira **Salvar mesmo assim** |
| 8 | Clicar **Salvar mesmo assim** | — | Alteração aplicada; disponibilidade recalculada; pedidos já reservados passam a estar em déficit |
| 9 | Abrir `/gestao/overbooking` | — | Pendência correspondente (se houver reserva descoberta) |

### Resultado final esperado
Compra alterada com trilha auditável; a disponibilidade reflete imediatamente a nova quantidade.

### Efeitos colaterais
- `disponibilidades_virtuais` recalculada (`gerada` / `parcialmente_reservada` / `esgotada`).
- Histórico de alterações da compra populado (`Nenhuma alteração registrada ainda.` deixa de aparecer).
- Evento de auditoria.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CMP-003-A1` | Alterar sem impacto negativo | Salva direto, sem confirmação extra |
| `JRN-CMP-003-A2` | Consultar o histórico da compra | Lista as alterações com autor e data |
| `JRN-CMP-003-A3` | `GET .../impacto?simulacao=true` | Retorna a projeção sem persistir |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CMP-003-N1` | Salvar com déficit sem confirmar | **Confirme o déficit projetado para prosseguir.** |
| `JRN-CMP-003-N2` | Reduzir a quantidade abaixo do que já foi **recebido** fisicamente | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: não há trava aparente — GAP-030 |
| `JRN-CMP-003-N3` | Quantidade `0` na edição | Bloqueado pelo CHECK |
| `JRN-CMP-003-N4` | Editar compra em `rascunho` por este modal | O modal só abre para status `confirmada` |
| `JRN-CMP-003-N5` | Dois usuários editando a mesma compra simultaneamente | Última escrita vence ou conflito explícito — ⚠️ verificar; GAP-031 |

### Permissões
`COMPRAS_PROGRAMADAS_GERENCIAR`.

### Critérios de aprovação
Recálculo imediato, confirmação obrigatória de déficit e trilha auditável.

### Evidências recomendadas
Print do painel de impacto com déficit, print do botão **Salvar mesmo assim**, print da disponibilidade antes/depois.

---

## Jornada: Cancelar compra programada

### ID
`JRN-CMP-004`

### Objetivo
Verificar o efeito do cancelamento sobre a disponibilidade já gerada.

### Perfil do usuário
`compras`, `gestor`, `administrador`.

### Pré-condições
Uma compra em `rascunho` (para o caminho feliz) e outra `confirmada` (para o negativo).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir uma compra em **Rascunho** | — |
| 2 | Executar `DELETE /comercial/compras-programadas/:id` (a UI não expõe o botão — ver GAP-032) | Status vira **Cancelada** |
| 3 | Conferir a disponibilidade | Sem saldo daquela compra |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CMP-004-N1` | Cancelar compra **confirmada** | `409` — o serviço recusa |
| `JRN-CMP-004-N2` | Cancelar compra já cancelada | Idempotente ou `409` claro |
| `JRN-CMP-004-N3` | Cancelar compra com Pedido ao Fornecedor já emitido | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO — GAP-033 |

### 🔎 Gap
`GAP-032`: existe endpoint de cancelamento (`DELETE`), mas **nenhum botão na UI** de Compras. O usuário de
negócio não consegue cancelar uma compra pela tela.

### Permissões
`COMPRAS_PROGRAMADAS_GERENCIAR`.

### Critérios de aprovação
Regra "confirmada não cancela" comprovada; GAP-032 confirmado.

---

## Jornada: Consultar histórico e impacto da compra

### ID
`JRN-CMP-005`

### Objetivo
Auditoria funcional da compra.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir uma compra alterada | Bloco de histórico populado |
| 2 | Conferir autor e data de cada alteração | Corretos |
| 3 | Comparar com `/admin/auditoria` filtrando pelo ID da compra | Eventos coerentes |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CMP-005-N1` | Compra nunca alterada | **Nenhuma alteração registrada ainda.** |

### Critérios de aprovação
Histórico e auditoria consistentes entre si.

---

# M06 — Disponibilidade

## Jornada: Consultar o mapa de disponibilidade e fazer drill-down

### ID
`JRN-DIS-001`

### Objetivo
Ler o estado real do saldo por item, no formato "teatro" (mapa por estado).

### Perfil do usuário
`comercial`, `gestor`, `diretoria`, `administrador`.

### Pré-condições
`JRN-CMP-002` concluída (há saldo).

### Ponto inicial
Menu → **COMERCIAL** → **Disponibilidade**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Disponibilidade**; abas **Mapa de Disponibilidade** e **Grade** |
| 2 | Selecionar **Data operacional** (`#data`) | Mapa carrega |
| 3 | Conferir a legenda dos estados | **F** Físico · **V** Virtual · **R** Reservado · **C** Confirmado · **D** Em desossa · **O** Overbooking · **E** Expedido · **!** Em ocorrência |
| 4 | Clicar em uma célula (ex.: **V** de TZ) | Painel **Unidades do grupo** abre com o drill-down |
| 5 | Conferir a contagem no drill-down | Bate com o mapa |
| 6 | Alternar para **Grade** | KPIs + tabela + bloco **Alertas & impactos** |
| 7 | Buscar `Buscar item...` = `TZ` | Filtra |
| 8 | Clicar **Limpar filtros** | Volta ao estado inicial |

### Resultado final esperado
O mapa e a grade refletem exatamente o saldo do banco.

### Validações funcionais — a conta que deve fechar
`físico + virtual − reservas (elaboração) − comprometidos (finalizados) = saldo antes do overbooking` (v1.1 §6.2).

Execute esta jornada **três vezes**: (a) logo após confirmar a compra; (b) depois de criar um pedido em
rascunho; (c) depois de finalizar o pedido. Os números devem migrar de **Disponível** → **Reservado** →
**Confirmado** sem que o total mude.

### Validações visuais / UX
- Indicador **live** quando o WebSocket está conectado.
- Pill **ESGOTADO** quando `disponivel <= 0`.
- Barra de ocupação com `{percentual}% reservado`.
- 🔎 A coluna **Status** da grade exibe o **valor técnico bruto** (`gerada`, `parcialmente_reservada`,
  `esgotada`) em vez de um rótulo em português — **GAP-034** (UX).

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-DIS-001-A1` | Filtrar por item comercial específico | Mapa reduzido |
| `JRN-DIS-001-A2` | Data sem compra confirmada | **Nenhuma disponibilidade para esta data.** |
| `JRN-DIS-001-A3` | Catálogo sem produto na operação | **Nenhum produto no catálogo para esta operação.** |
| `JRN-DIS-001-A4` | Clicar num estado sem unidades | **Nenhuma unidade real neste estado.** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DIS-001-N1` | Data inválida na URL | Erro tratado, sem tela branca |
| `JRN-DIS-001-N2` | `operacaoId` inexistente | `404 OPERACAO_NAO_ENCONTRADA` |
| `JRN-DIS-001-N3` | Backend fora do ar | Mensagem de erro visível |

### Permissões
`DISPONIBILIDADE_LER`. 🔎 A página em si só exige autenticação — o menu é o filtro. Ver GAP-018 (mesma classe).

### Critérios de aprovação
A equação de saldo fecha nos três momentos.

### Evidências recomendadas
Três prints da grade (após compra, após rascunho, após finalizar) com os KPIs visíveis.

---

## Jornada: Alertas e impactos na grade

### ID
`JRN-DIS-002`

### Objetivo
Validar o bloco de alertas que sinaliza esgotamento e divergência.

### Pré-condições
Um item esgotado (venda todo o saldo em `JRN-PVD-001`) e uma divergência aberta (`JRN-REC-005`).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Vender todo o saldo de um item | Item mostra pill **ESGOTADO** |
| 2 | Conferir **Alertas & impactos** | Alerta **Item esgotado** |
| 3 | Após abrir divergência no recebimento | Alerta **Divergências no recebimento** |
| 4 | Sem nenhum alerta | **Nenhum item esgotado no momento.** |

### Critérios de aprovação
Alertas aparecem e somem conforme o estado real.

---

## Jornada: Atualização em tempo real da disponibilidade

### ID
`JRN-DIS-003`

### Objetivo
Provar o Princípio VI (tempo real por evento, sem polling) — regra do v1.1 §6.3: outros vendedores devem
ver a redução imediatamente.

### Pré-condições
Dois navegadores (ou duas janelas anônimas) autenticados.

### Passo a passo

| Passo | Janela | Ação | Resultado esperado |
|---|---|---|---|
| 1 | A | Abrir `/comercial/disponibilidade` na data da operação | Indicador **live** ativo |
| 2 | B | Criar um pedido consumindo 5 unidades de TZ (`JRN-PVD-001`) | Pedido salvo |
| 3 | A | **Sem apertar F5** | O saldo de TZ cai de 20 para 15 automaticamente |
| 4 | B | Cancelar o pedido | — |
| 5 | A | Sem F5 | Saldo volta a 20 |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DIS-003-N1` | Derrubar a conexão de rede e restabelecer | Reconecta e ressincroniza; indicador **live** volta |
| `JRN-DIS-003-N2` | Deixar a aba em segundo plano por 10 min | Ao voltar, dado atualizado |

### Critérios de aprovação
Atualização sem recarga manual nas duas direções (consumo e devolução).

### Evidências recomendadas
Vídeo curto ou dois prints sequenciais da janela A sem recarga.

---

# M07 — Pedidos de Venda

> **Contexto de regra (v1.1 §6.2, §6.3, §6.9 e AD-03/AD-05/AD-06):**
> a inclusão de item **reserva imediatamente**; a prioridade de consumo é automática
> (**físico → virtual → overbooking**) e o vendedor não escolhe; existe no máximo **um pedido aberto** por
> (cliente, produto, operação); overbooking é permitido **sem limite** mas **sempre** com confirmação
> explícita; reserva de rascunho **não expira** sozinha.

## Jornada: Criar pedido de venda com saldo suficiente

### ID
`JRN-PVD-001`

### Objetivo
Registrar a venda e provar que a reserva acontece na hora, no rascunho.

### Perfil do usuário
`comercial`, `gestor`, `administrador`.

### Pré-condições
- Compra confirmada com saldo (`JRN-CMP-002`).
- CLI-A cadastrado (`JRN-CAD-006`).

### Dados necessários

| Campo | Valor |
|---|---|
| **Buscar cliente** | `Açougue A` |
| **Operação** | a compra confirmada da data |
| **Produto** | `TZ` |
| **Quantidade do novo produto** | `5` |
| **Prioridade** | `50` |
| **Observações** | `Pedido de homologação` |

### Ponto inicial
Menu → **COMERCIAL** → **Pedidos de Venda**

### Passo a passo

| Passo | Tela | Ação do usuário | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Pedidos de Venda | Clicar **Novo pedido** | — | Editor com título **Novo Pedido** |
| 2 | Editor | Abrir o combobox **Buscar cliente** (`#pedido-cliente`) | — | Busca `Buscar cliente...`; sublabel é o CNPJ/CPF |
| 3 | Editor | Selecionar CLI-A | — | **Representante** (`#pedido-representante`) preenche automaticamente com REP-A (somente leitura) e **Rota** com ROTA-A |
| 4 | Editor | Selecionar **Operação** (`#pedido-operacao`) | data da compra | — |
| 5 | Editor | Preencher **Prioridade** (`#pedido-prioridade`) | `50` | Faixa 0–100 |
| 6 | Editor | Escolher **Produto** (`#produto-novo`) | `TZ` | — |
| 7 | Editor | Preencher **Quantidade do novo produto** (`#quantidade-produto-novo`) | `5` | — |
| 8 | Editor | Clicar **Adicionar produto** | — | Linha na grade com origem **Virtual** |
| 9 | Editor | Clicar **Salvar Rascunho** | — | Pedido criado; volta à lista |
| 10 | Lista | Localizar o pedido | — | Badge **Rascunho com reserva ativa** |
| 11 | — | Abrir `/comercial/disponibilidade` | — | TZ: **Disponível** caiu de 20 para 15; **Reservado** = 5 |

### Resultado final esperado
- `pedidos_venda` com status `rascunho` (exibido como **Rascunho com reserva ativa**).
- `pedidos_venda_itens` com status `totalmente_reservado`.
- `reservas_disponibilidade` com `status = ativa` e `tipo_consumo = virtual`.
- `disponibilidades_virtuais` com `quantidade_reservada = 5` e status `parcialmente_reservada`.

### Efeitos colaterais
- Disponibilidade reduzida em tempo real para todos os usuários (`JRN-DIS-003`).
- KPI **Rascunhos** na lista de pedidos incrementa.
- Painel Geral: **Reservas em elaboração** incrementa.
- Espelho comercial passa a listar o pedido como **Aberto**.

### Validações funcionais
- A origem do item deve ser **Virtual** (não há físico ainda).
- A reserva é **transacional**: não pode haver saldo negativo (CHECK de banco como backstop).
- O representante do pedido é herdado do cliente e não é editável.

### Validações visuais / UX
- KPIs no topo: **Total de pedidos**, **Rascunhos** (`com reserva ativa`), **Overbooking** (`exige atenção`),
  **Finalizados** (`pedidos concluídos`).
- Coluna de origem exibe **Físico** / **Virtual** / **Overbooking**.
- Card **Linha do tempo** no editor.
- Botão **Voltar para pedidos** com `aria-label`.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PVD-001-A1` | Pedido com **um único** item | Funciona |
| `JRN-PVD-001-A2` | Pedido com **três** itens diferentes (TZ, DT, PA) | Três reservas independentes |
| `JRN-PVD-001-A3` | Cliente **sem** representante | Campo **Representante** vazio; pedido válido |
| `JRN-PVD-001-A4` | Preencher **Rota** manualmente diferente da do cliente | Aceito (campo editável) |
| `JRN-PVD-001-A5` | Quantidade exatamente igual ao saldo (20) | Reserva total; item fica **ESGOTADO** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-001-N1` | Salvar sem cliente | **Cliente, operação e ao menos um produto são obrigatórios.** |
| `JRN-PVD-001-N2` | Salvar sem operação | Mesma mensagem |
| `JRN-PVD-001-N3` | Salvar sem nenhum produto | Mesma mensagem |
| `JRN-PVD-001-N4` | Quantidade `0` | **Selecione um produto e informe uma quantidade positiva.** |
| `JRN-PVD-001-N5` | Quantidade negativa | Mesma mensagem |
| `JRN-PVD-001-N6` | Adicionar **o mesmo produto duas vezes** | `Item comercial já existe neste pedido` |
| `JRN-PVD-001-N7` | Operação inexistente | `404 OPERACAO_NAO_ENCONTRADA` |
| `JRN-PVD-001-N8` | Já existe pedido aberto para (cliente, produto, operação) | `409 PEDIDO_ABERTO_EXISTENTE` → a UI deve oferecer o modal **Registrar adendo** (`JRN-PVD-006`) |
| `JRN-PVD-001-N9` | Duplo clique em **Salvar Rascunho** | Um único pedido, uma única reserva |
| `JRN-PVD-001-N10` | Dois vendedores reservando a última unidade ao mesmo tempo | Um vence; o outro recebe o challenge de overbooking ou `Saldo mudou durante a confirmação` — **teste de concorrência crítico** |
| `JRN-PVD-001-N11` | F5 no meio do preenchimento | Rascunho de tela perdido; **nenhuma reserva órfã** criada |
| `JRN-PVD-001-N12` | Cliente inativo | Não aparece no combobox |
| `JRN-PVD-001-N13` | Criar pedido em operação **fechada** | ⚠️ GAP-012 — verificar se é bloqueado |

### Permissões

| Perfil | Ler | Criar/editar | Finalizar | Confirmar overbooking | Liberar reserva |
|---|---|---|---|---|---|
| administrador | Sim | Sim | Sim | Sim | Sim |
| gestor | Sim | Sim | Sim | Sim | Sim |
| comercial | Sim | Sim | Sim | Sim | Não |
| compras, diretoria | Sim | Não | Não | Não | Não |
| expedicao, faturamento | Menu visível | Não | Não | Não | Não |

`JRN-PVD-001-P1`: `compras` vê a lista mas **Novo pedido** fica desabilitado.
`JRN-PVD-001-P2`: `comercial` **não** vê o botão **Liberar reserva**.

### Critérios de aprovação
Reserva imediata comprovada na disponibilidade; 13 negativos com comportamento previsível; concorrência
resolvida sem saldo negativo.

### Evidências recomendadas
Print do pedido com badge **Rascunho com reserva ativa**, print da disponibilidade antes e depois,
print do erro `PEDIDO_ABERTO_EXISTENTE`.

---

## Jornada: Finalizar pedido de venda

### ID
`JRN-PVD-002`

### Objetivo
Converter reserva em compromisso confirmado, sem dupla redução do saldo (v1.1 §6.3).

### Perfil do usuário
`comercial`, `gestor`, `administrador` (permissão `PEDIDO_FINALIZAR`).

### Pré-condições
`JRN-PVD-001` concluída.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir o pedido (**Abrir** na lista) | Editor **Editar Pedido** |
| 2 | Conferir os itens | Origem e quantidades corretas |
| 3 | Clicar **Finalizar Pedido** | Volta à lista com status **Finalizado** |
| 4 | Abrir `/comercial/disponibilidade` | O total **não muda**; o valor migra de **Reservado** para **Confirmado** |
| 5 | Abrir `/comercial/espelho` | Pedido aparece com status **Fechado** |

### Resultado final esperado
`pedidos_venda.status = finalizado`; reservas mantidas; saldo comprometido.

### Efeitos colaterais
- KPI **Finalizados** incrementa.
- Pedido passa a ser elegível para o **Planejamento de Carga**.
- Painel Geral: **Pedidos finalizados** incrementa.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PVD-002-A1` | Finalizar pedido com múltiplos itens | Todos comprometidos |
| `JRN-PVD-002-A2` | Finalizar pedido que contém item com overbooking **já confirmado** | Permitido (AD-05: após confirmado não bloqueia) |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-002-N1` | Finalizar pedido com item `aguardando_confirmacao_overbooking` | `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` |
| `JRN-PVD-002-N2` | Finalizar pedido já finalizado | `Pedido já finalizado` |
| `JRN-PVD-002-N3` | Finalizar pedido cancelado | `Pedido já cancelado` |
| `JRN-PVD-002-N4` | Finalizar sem `PEDIDO_FINALIZAR` (perfil `compras`) | `403`; botão **Finalizar Pedido** desabilitado |
| `JRN-PVD-002-N5` | Editar o pedido **depois** de finalizado | `409 PEDIDO_NAO_ABERTO` — verificar se a UI bloqueia os botões |
| `JRN-PVD-002-N6` | Duplo clique em **Finalizar Pedido** | Uma única finalização |

### Critérios de aprovação
Saldo não sofre dupla redução; pedido finalizado é imutável.

### Evidências recomendadas
Print dos KPIs de disponibilidade antes e depois (o total deve ser idêntico).

---

## Jornada: Criar pedido com overbooking (challenge + confirmação)

### ID
`JRN-PVD-003`

### Objetivo
**Jornada crítica.** Provar AD-05: tentativa acima do saldo devolve `409` **sem persistir nada**, e a
confirmação explícita é a única mutação, criando reserva tipada e pendência atomicamente.

### Perfil do usuário
`comercial`, `gestor`, `administrador` (permissão `PEDIDO_OVERBOOKING_CONFIRMAR`).

### Pré-condições
Saldo conhecido (ex.: 15 unidades de TZ restantes após `JRN-PVD-001`).

### Dados necessários
Cliente CLI-B, produto `TZ`, quantidade **20** (5 acima do saldo).

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | **Novo pedido**, cliente CLI-B, operação da data | — | — |
| 2 | Produto `TZ`, quantidade `20` | — | — |
| 3 | Clicar **Adicionar produto** e **Salvar Rascunho** | — | Modal **Confirmar overbooking** abre com a mensagem vinda da API |
| 4 | Conferir a tabela do modal | — | Colunas **Produto**, **Disponível**, **Solicitado**, **Déficit** — o déficit deve ser exatamente 5 |
| 5 | Clicar **Cancelar** no modal | — | **Nada é persistido**: nenhum pedido, nenhuma reserva, saldo inalterado (verificar na disponibilidade) |
| 6 | Repetir os passos 1–3 | — | Modal reaparece |
| 7 | Clicar **Confirmar overbooking** | — | Texto muda para `Confirmando...`; pedido criado |
| 8 | Conferir a lista | — | Pedido com item de origem **Overbooking** |
| 9 | Abrir `/gestao/overbooking` | — | Pendência **Aberto** com déficit 5, cliente CLI-B, vendedor e operação |
| 10 | Abrir `/comercial/disponibilidade` | — | O item aparece no estado **O** (Overbooking) do mapa |

### Resultado final esperado
- Pedido criado com item `overbooking_confirmado`.
- Reserva com `tipo_consumo = overbooking`.
- Pendência em `pendencias_overbooking` com status `aberta`.
- Tudo em uma única transação.

### Efeitos colaterais
- KPI **Overbooking** (`exige atenção`) na lista de pedidos.
- Painel Geral: **Overbookings abertos**.
- Alerta na Disponibilidade.

### Validações funcionais — as três provas de AD-05
1. O `409` do challenge **não** cria pedido nem reserva (verificável na lista e no saldo).
2. A confirmação cria pedido + reserva + pendência **atomicamente**.
3. Depois de confirmado, a **finalização não é bloqueada** (`JRN-PVD-002-A2`).

### Validações visuais / UX
- Modal **Confirmar overbooking** com déficit por item.
- Estado de loading no botão.
- Badge de overbooking no pedido.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PVD-003-A1` | Overbooking em pedido **existente** (incluir item acima do saldo) | Mesmo challenge; confirmação por `POST /:id/itens/confirmar-overbooking` |
| `JRN-PVD-003-A2` | Overbooking com quantidade **muito** acima do saldo (ex.: 1000) | Permitido — **sem limite** (AD-05) |
| `JRN-PVD-003-A3` | Overbooking em **adendo** | Endpoint `/:id/adendos/confirmar-overbooking` |
| `JRN-PVD-003-A4` | Saldo zerado (item esgotado) | Qualquer quantidade cai em overbooking |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-003-N1` | Confirmar overbooking sem a permissão `PEDIDO_OVERBOOKING_CONFIRMAR` (perfil `compras`) | `403` |
| `JRN-PVD-003-N2` | Confirmar depois de o saldo ter mudado (outro usuário liberou reserva no intervalo) | `Saldo mudou durante a confirmação` |
| `JRN-PVD-003-N3` | Cancelar o modal e conferir se algo foi gravado | **Nada** foi gravado — prova do "challenge read-only" |
| `JRN-PVD-003-N4` | Duplo clique em **Confirmar overbooking** | Um único pedido e uma única pendência |
| `JRN-PVD-003-N5` | Desligar `comercial.overbooking_permitido` nos parâmetros e repetir | ⚠️ GAP-013 — verificar se o parâmetro ainda tem efeito ou é legado após AD-05 |

### Permissões
`PEDIDO_OVERBOOKING_CONFIRMAR`: `administrador`, `gestor`, `comercial`.

### Critérios de aprovação
As três provas de AD-05 verificadas; nenhum resíduo após cancelar o challenge.

### Evidências recomendadas
Print do modal com o déficit, print do saldo intacto após cancelar, print da pendência gerada.

---

## Jornada: Incluir item em pedido existente

### ID
`JRN-PVD-004`

### Objetivo
Acrescentar produto a um pedido ainda aberto.

### Pré-condições
Pedido em rascunho de `JRN-PVD-001`.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir o pedido | Editor **Editar Pedido** |
| 2 | Escolher **Produto** = `DT`, **Quantidade do novo produto** = `3` | — |
| 3 | Clicar **Adicionar produto** | Novo item na grade; reserva criada imediatamente |
| 4 | Conferir a disponibilidade de DT | Reduzida em 3 |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-004-N1` | Incluir produto já existente no pedido | `Item comercial já existe neste pedido` |
| `JRN-PVD-004-N2` | Incluir em pedido finalizado | `409 PEDIDO_NAO_ABERTO` |
| `JRN-PVD-004-N3` | Incluir em pedido cancelado | `Pedido já cancelado` |
| `JRN-PVD-004-N4` | Incluir acima do saldo | Challenge de overbooking |

### Critérios de aprovação
Inclusão reserva na hora e respeita o estado do pedido.

---

## Jornada: Reduzir ou remover item do pedido

### ID
`JRN-PVD-005`

### Objetivo
Provar que a devolução do saldo é imediata (v1.1 §6.3: "remoção devolve").

### Pré-condições
Pedido em rascunho com item de 5 unidades.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | No editor, alterar **Quantidade** da linha | `5` → `3` | — |
| 2 | Clicar **Aplicar quantidade** | — | Item reduzido; saldo devolvido em 2 unidades |
| 3 | Conferir a disponibilidade | — | **Disponível** +2, **Reservado** −2 |
| 4 | Clicar no ícone de remover da linha | — | Item removido; saldo totalmente devolvido |

### Resultado final esperado
Reserva liberada (`reservas_disponibilidade.status = liberada`) e disponibilidade recalculada.

### Efeitos colaterais
- Se o item tinha pendência de overbooking e o déficit zera, a pendência é **cancelada** automaticamente.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PVD-005-A1` | Reduzir item com overbooking até zerar o déficit | Pendência passa a `cancelada` |
| `JRN-PVD-005-A2` | **Aumentar** a quantidade pelo mesmo campo | Abre o modal **Registrar adendo** (`JRN-PVD-006`) |
| `JRN-PVD-005-A3` | Remover o último item do pedido | Pedido fica sem itens — ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: deveria cancelar automaticamente? — GAP-035 |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-005-N1` | Reduzir sem informar motivo (via API) | `400` — o DTO exige `motivo` |
| `JRN-PVD-005-N2` | Reduzir para `0` | Deve equivaler a remover ou ser bloqueado — ⚠️ confirmar |
| `JRN-PVD-005-N3` | Reduzir item que não pertence ao pedido | `404 ITEM_NAO_ESTA_NO_PEDIDO` |
| `JRN-PVD-005-N4` | Alterar item de pedido finalizado | `409 PEDIDO_NAO_ABERTO` |
| `JRN-PVD-005-N5` | Quantidade inválida (texto) | **Informe uma quantidade válida.** |

### Critérios de aprovação
Devolução imediata e coerente; motivo obrigatório registrado na auditoria.

---

## Jornada: Registrar adendo em pedido aberto

### ID
`JRN-PVD-006`

### Objetivo
Cobrir a regra de unicidade AD-03: existe **um** pedido aberto por (cliente, produto, operação); nova
solicitação vira **adendo** com histórico.

### Perfil do usuário
`comercial`, `gestor`, `administrador`.

### Pré-condições
Pedido aberto de CLI-A com `TZ` na operação do dia.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Criar um novo pedido para CLI-A, mesma operação, produto `TZ` | — | `409 PEDIDO_ABERTO_EXISTENTE`; UI abre o modal **Registrar adendo** |
| 2 | Ler a descrição do modal | — | `Pedido {id} já aberto. Quantidade atual: {qtd}. Adição solicitada: {qtd}.` |
| 3 | Conferir o badge | — | Badge **Provisório P5** (política de preço em adendo pendente) |
| 4 | Preencher **Motivo** (`#motivo-adendo`) | `Cliente solicitou reforço` | Mínimo de 3 caracteres |
| 5 | Clicar **Registrar adendo** | — | `Registrando...`; adendo criado |
| 6 | Abrir o pedido | — | Card **Linha do tempo** com **Adendo registrado** — `{qtd} adicionados — {motivo}` |
| 7 | Conferir a disponibilidade | — | Reduzida pela quantidade do adendo |

### Resultado final esperado
Registro em `adendos_pedido` (append-only) com autoria, quantidade anterior e adicionada; reserva ampliada.

### Efeitos colaterais
Linha do tempo do pedido; auditoria.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PVD-006-A1` | Mesmo cliente e produto em **operação diferente** | **Não** dispara adendo — pedidos coexistem (AD-03) |
| `JRN-PVD-006-A2` | Adendo acima do saldo | Challenge de overbooking no adendo |
| `JRN-PVD-006-A3` | Vários adendos no mesmo pedido | Todos na linha do tempo, em ordem |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-006-N1` | Motivo com menos de 3 caracteres | Botão **Registrar adendo** desabilitado |
| `JRN-PVD-006-N2` | Motivo vazio | Idem |
| `JRN-PVD-006-N3` | Adendo em pedido finalizado | `409 PEDIDO_NAO_ABERTO` |
| `JRN-PVD-006-N4` | Cancelar o modal | Nada persistido |

### ⚠️ Pendência aberta
**P5 — política de preço em adendos.** Hoje o adendo herda o preço vigente do pedido, marcado como
provisório. Remoção do badge exige AD-xx.

### Critérios de aprovação
Unicidade por (cliente, produto, operação) comprovada e adendo rastreável.

### Evidências recomendadas
Print do modal com o badge P5 e print da linha do tempo com o adendo.

---

## Jornada: Cancelar pedido

### ID
`JRN-PVD-007`

### Objetivo
Liberar todas as reservas de um pedido.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir o pedido e cancelar (`DELETE /comercial/pedidos/:id` com **motivo**) | Status **Cancelado** |
| 2 | Conferir a disponibilidade | Todas as reservas devolvidas |
| 3 | Conferir a pendência de overbooking (se houver) | Cancelada |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-007-N1` | Cancelar sem motivo | `400` — o DTO exige `motivo` |
| `JRN-PVD-007-N2` | Cancelar pedido já cancelado | `Pedido já cancelado` |
| `JRN-PVD-007-N3` | Cancelar pedido **faturado** | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO — GAP-036 |
| `JRN-PVD-007-N4` | Cancelar pedido cujas peças já estão em carga fechada | ⚠️ GAP-036 |

### 🔎 Gap
`GAP-037`: a lista de pedidos não expõe um botão **Cancelar** — o cancelamento só é acessível por API.
Verificar durante a homologação se existe caminho pela UI.

### Critérios de aprovação
Cancelamento devolve 100% das reservas; motivo obrigatório auditado.

---

## Jornada: Liberar reserva administrativamente (AD-06)

### ID
`JRN-PVD-008`

### Objetivo
Provar a regra AD-06: reserva de rascunho **não expira sozinha**; a liberação é uma ação administrativa
explícita, com justificativa e auditoria.

### Perfil do usuário
`gestor`, `administrador` (permissão `PEDIDO_RESERVA_LIBERAR`).

### Pré-condições
Pedido em **rascunho** com reserva ativa.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Na lista, localizar o pedido com badge **Rascunho com reserva ativa** | — | Botão **Liberar reserva** visível |
| 2 | Clicar **Liberar reserva** | — | Modal **Liberar reserva** com o texto `A ação cancela o rascunho {pedidoId}, libera suas reservas...` |
| 3 | Preencher **Justificativa** (`#justificativa-reserva`) | `Rascunho abandonado — liberação administrativa` | Mínimo de **10 caracteres** |
| 4 | Clicar **Confirmar liberação** | — | `Liberando...`; pedido vira **Cancelado**; reservas liberadas |
| 5 | Conferir a disponibilidade | — | Saldo devolvido |
| 6 | Conferir `/admin/auditoria` | — | Evento `ACAO_MANUAL` com a justificativa e o autor |

### Resultado final esperado
Rascunho cancelado, saldo liberado, trilha auditável com justificativa.

### Validações funcionais — prova de AD-06
Deixe um rascunho com reserva por várias horas e confirme que **a reserva continua ativa** (não há TTL nem
job de expiração). Só a ação administrativa libera.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-008-N1` | Justificativa com menos de 10 caracteres | Bloqueado |
| `JRN-PVD-008-N2` | Liberar pedido **finalizado** | Botão indisponível; API retorna `400 PEDIDO_NAO_ESTA_EM_RASCUNHO` |
| `JRN-PVD-008-N3` | Liberar pedido sem reserva ativa | `400 PEDIDO_SEM_RESERVA_ATIVA` |
| `JRN-PVD-008-N4` | Executar como `comercial` | Botão ausente; API `403` |

### Permissões
`PEDIDO_RESERVA_LIBERAR`: **apenas** `administrador` e `gestor`.

### Critérios de aprovação
Liberação só por perfil autorizado, com justificativa e auditoria; ausência de expiração automática comprovada.

### Evidências recomendadas
Print do modal, print da auditoria com a justificativa.

---

## Jornada: Consultar, buscar e filtrar pedidos

### ID
`JRN-PVD-009`

### Objetivo
Validar a listagem, os KPIs e os rótulos de status.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir `/comercial/pedidos` | KPIs e tabela |
| 2 | Buscar `Buscar pedido ou cliente...` = `Açougue A` | Filtra |
| 3 | Filtrar por status | Opções: **Rascunho com reserva ativa**, **Em elaboração com reserva ativa**, **Aguardando confirmação de overbooking**, **Finalizado**, **Parcialmente atendido**, **Atendido**, **Faturado**, **Cancelado** |
| 4 | Paginar | Funcional |

### Mapeamento rótulo ↔ status técnico

| Rótulo exibido | Status no banco |
|---|---|
| Rascunho com reserva ativa | `rascunho` (com reserva ativa) |
| Em elaboração com reserva ativa | `em_elaboracao_reserva_ativa` |
| Aguardando confirmação de overbooking | `aguardando_confirmacao_overbooking` |
| Finalizado | `finalizado` |
| Parcialmente atendido | `parcialmente_atendido` |
| Atendido | `atendido` |
| Faturado | `faturado` |
| Cancelado | `cancelado` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PVD-009-N1` | Busca sem resultado | **Nenhum pedido encontrado.** |
| `JRN-PVD-009-N2` | Backend indisponível | **Falha ao carregar pedidos.** |
| `JRN-PVD-009-N3` | Abrir pedido inexistente | **Falha ao abrir pedido.** |

### 🔎 Observação para o assessment
Quatro status existem no banco mas **nenhum endpoint os produz hoje**: `parcialmente_atendido`, `atendido`,
`faturado` e `aguardando_confirmacao_overbooking` (no cabeçalho do pedido). O filtro os oferece, mas nunca
retornará resultados. Isso está diretamente ligado à pendência **P15** (marco de fechamento do pedido
comercial) — registrado como **GAP-038**.

### Critérios de aprovação
Filtros funcionais; GAP-038 confirmado (os quatro filtros retornam vazio).

---

# M08 — Overbooking

## Jornada: Analisar pendência de overbooking

### ID
`JRN-OVB-001`

### Objetivo
Abrir a fila do gestor e iniciar a análise de um déficit.

### Perfil do usuário
`gestor`, `administrador` (resolver); `comercial`, `compras` (ver).

### Pré-condições
`JRN-PVD-003` concluída (pendência aberta).

### Ponto inicial
Menu → **GESTÃO** → **Pendências de Overbooking** (a tela exige `operacaoId` — use o **SeletorOperacao**)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela e selecionar a operação | KPIs: **Pendências abertas**, **Em análise**, **Déficit total**, **Resolvidas hoje** |
| 2 | Conferir a lista | Item com `Déficit: 5`, cliente CLI-B, vendedor, timestamp |
| 3 | Clicar na pendência | Painel direito com detalhe, cobertura e histórico |
| 4 | Clicar **Iniciar análise** | Status vira **Em análise** |
| 5 | Conferir o histórico | Evento registrado com autor |

### Resultado final esperado
Pendência em `em_analise` com histórico.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-OVB-001-A1` | Buscar por texto | Filtra |
| `JRN-OVB-001-A2` | Filtrar por status | Filtra |
| `JRN-OVB-001-A3` | Clicar no ícone de refresh | Recarrega |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OVB-001-N1` | Nenhuma pendência | **Nenhuma pendência encontrada.** |
| `JRN-OVB-001-N2` | Nenhuma seleção | **Selecione uma pendência.** |
| `JRN-OVB-001-N3` | **Iniciar análise** em pendência já resolvida | Botão desabilitado / `409` |
| `JRN-OVB-001-N4` | Acessar como `comercial` | Vê a fila (tem `PEDIDOS_LER`) mas os botões de decisão ficam indisponíveis |

### Permissões
Ver: `PEDIDOS_LER`. Resolver: `OVERBOOKING_RESOLVER` (`administrador`, `gestor`).

### Critérios de aprovação
Fila carregada com dados corretos; transição `aberta → em_analise` funcional.

---

## Jornada: Resolver por compra complementar

### ID
`JRN-OVB-002`

### Objetivo
Cobrir o caminho de decisão "programar compra complementar".

### Pré-condições
Pendência em `aberta` ou `em_analise`.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | No painel, abrir **1. Compra complementar** | Lista de compras elegíveis |
| 2 | Selecionar a compra e clicar **Programar** | Status vira **Compra complementar programada** |
| 3 | Clicar **Marcar como resolvido** | Status **Resolvido** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OVB-002-N1` | Sem compra elegível | **Nenhuma compra elegível disponível.** |
| `JRN-OVB-002-N2` | Quantidade acima do déficit | Bloqueado |
| `JRN-OVB-002-N3` | Decidir pendência já resolvida | `409` (matriz `TRANSICOES_PENDENCIA`) |

### Critérios de aprovação
Transição registrada com histórico.

---

## Jornada: Resolver por redistribuição

### ID
`JRN-OVB-003`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir **2. Redistribuição** | Lista de reservas doadoras |
| 2 | Selecionar a reserva doadora e clicar **Redistribuir** | Status **Redistribuição decidida** |
| 3 | Conferir o pedido doador | Reserva reduzida |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OVB-003-N1` | Sem doador | **Nenhuma reserva doadora disponível.** |
| `JRN-OVB-003-N2` | Redistribuir mais do que o doador tem | Bloqueado |

### ⚠️ Regra a confirmar
O impacto no cliente doador (que perde parte da reserva) precisa de política de comunicação definida pelo
negócio. — **GAP-039**

### Critérios de aprovação
Saldo transferido corretamente entre pedidos.

---

## Jornada: Postergar déficit para a próxima operação

### ID
`JRN-OVB-004`

### Objetivo
Cobrir a regra v1.1 §6.4: "quantidade postergada gera novo pedido".

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir **3. Postergar para próxima operação** | — | Lista de operações destino |
| 2 | Clicar **Postergar** | — | Modal |
| 3 | Preencher **Quantidade a postergar** (`#qtd-postergar`) | `5` | — |
| 4 | Clicar **Gerar novo pedido** | — | Status **Novo pedido criado**; novo pedido na operação destino |
| 5 | Abrir `/comercial/pedidos` na operação destino | — | Pedido gerado |

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-OVB-004-A1` | Postergar **parcialmente** (2 de 5) | Novo pedido de 2; pendência mantém o restante |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OVB-004-N1` | Sem operação destino elegível | **Nenhuma operação destino elegível.** |
| `JRN-OVB-004-N2` | Quantidade maior que o déficit | Bloqueado |
| `JRN-OVB-004-N3` | Quantidade zero | Bloqueado |

### Critérios de aprovação
Novo pedido criado na operação correta com a quantidade postergada.

---

## Jornada: Cancelar pendência de overbooking

### ID
`JRN-OVB-005`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Clicar **Cancelar pendência** | — | Modal com o aviso `O cancelamento não resolve o déficit no pedido de origem...` |
| 2 | Selecionar **Motivo** (`#motivo-cancelamento`) | `Cliente desistiu do pedido` | Opções: Cliente desistiu do pedido / Pedido duplicado / Erro de lançamento / Outro |
| 3 | Preencher **Observação** (`#obs-cancelamento`) | texto | Opcional |
| 4 | Clicar **Confirmar Cancelamento** | — | Status **Cancelado** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OVB-005-N1` | Sem selecionar motivo | Botão **Confirmar Cancelamento** desabilitado |
| `JRN-OVB-005-N2` | Motivo com menos de 5 caracteres (via API) | `400` |
| `JRN-OVB-005-N3` | Cancelar pendência já resolvida | `409` |

### ⚠️ Ponto de atenção
O próprio aviso da tela deixa claro que cancelar a **pendência** não resolve o **déficit** do pedido. O
homologador deve confirmar com o negócio se esse comportamento (pedido segue em overbooking sem pendência
aberta) é o desejado. — **GAP-040**

### Critérios de aprovação
Cancelamento exige motivo e mantém histórico.

---

# M09 — Tabela de Preços

## Jornada: Criar a tabela de preços do dia

### ID
`JRN-PRC-001`

### Objetivo
Criar a tabela diária com as faixas A/B/C/D.

### Perfil do usuário
`gestor`, `administrador`.

### Pré-condições
Produtos ativos cadastrados.

### Ponto inicial
Menu → **COMERCIAL** → **Tabela de Preços**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Selecionar a **Data da tabela** no datepicker | Se não existir: **Nenhuma tabela de preços para DD/MM/AAAA.** |
| 2 | Clicar **Criar tabela do dia** | Banner **Tabela do dia criada...**; status **Rascunho** |
| 3 | Conferir o rodapé | `{N} produtos na tabela.` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PRC-001-N1` | Criar tabela em data que já tem uma | `409 TABELA_PRECO_DUPLICADA` |

### Critérios de aprovação
Tabela criada em rascunho com todos os produtos ativos.

---

## Jornada: Copiar a tabela anterior

### ID
`JRN-PRC-002`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Com a tabela do dia criada, clicar **Copiar tabela anterior** | Banner `Preços da tabela anterior copiados...` |
| 2 | Conferir os valores | Iguais aos da tabela anterior |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PRC-002-N1` | Não existe tabela anterior | `409 SEM_TABELA_PRECO_ANTERIOR` |
| `JRN-PRC-002-N2` | Origem igual ao destino | `400 COPIA_ORIGEM_IGUAL_AO_DESTINO` |

### Critérios de aprovação
Cópia integral e correta.

---

## Jornada: Editar preços e salvar

### ID
`JRN-PRC-003`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Preencher **Preço A de {codigo}** | `45,00` | — |
| 2 | Preencher **Preço B**, **C** e **D** | `43,00`, `41,00`, `39,00` | — |
| 3 | Repetir para todos os produtos | — | — |
| 4 | Clicar **Salvar** | — | **Tabela salva com sucesso.** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PRC-003-N1` | Preço negativo | Validação esperada — ⚠️ confirmar |
| `JRN-PRC-003-N2` | Preço `0` | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: preço zero é válido? |
| `JRN-PRC-003-N3` | Preço com mais de 2 decimais | Arredondamento ou bloqueio (`NUMERIC(15,2)`) |
| `JRN-PRC-003-N4` | Deixar produtos sem preço e tentar publicar | Ver `JRN-PRC-004-N1` |

### 🔎 Observação
A tela de **Produtos** tem o campo **Preço por kg (R$)** desabilitado com a nota de lacuna de API
(GAP-009). O preço real vive aqui, na tabela diária — isso pode confundir o usuário de negócio.

### Critérios de aprovação
Preços salvos e recuperados corretamente.

---

## Jornada: Publicar a tabela

### ID
`JRN-PRC-004`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Com todos os preços preenchidos, clicar **Publicar** | **Tabela publicada com sucesso.**; status **Publicada** |
| 2 | Tentar clicar **Publicar** de novo | Botão desabilitado |
| 3 | Alterar um preço e salvar | Aviso `Esta tabela já foi publicada anteriormente e sofreu alteração...` |
| 4 | Publicar novamente | Nova entrada no histórico |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PRC-004-N1` | Publicar com produtos sem preço | `400 PRECOS_INCOMPLETOS` listando os produtos faltantes |
| `JRN-PRC-004-N2` | Publicar como `comercial` | `403` (só tem `TABELA_PRECO_LER`) |

### ⚠️ Regra a confirmar
Não foi encontrado nenhum ponto do sistema em que o **preço publicado seja consumido** pelo pedido de venda
ou pelo faturamento — a emissão de NFS-e pede o **valor digitado manualmente** na tela de Pré-Faturamento.
Isso é um gap funcional relevante: **GAP-041**.

### Critérios de aprovação
Publicação exige completude e gera histórico.

---

## Jornada: Consultar histórico de publicações

### ID
`JRN-PRC-005`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Clicar **Histórico** | Painel **Histórico de publicações** |
| 2 | Conferir as entradas | Ação `publicada` / `revertida_para_rascunho`, autor e data |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PRC-005-N1` | Tabela nunca publicada | **Nenhuma publicação registrada ainda.** |

### Critérios de aprovação
Histórico completo e legível.

---

# M10 — Espelho Comercial

## Jornada: Consultar o espelho e agrupar

### ID
`JRN-ESP-001`

### Objetivo
Conferência dos pedidos do dia pelo comercial e pela expedição.

### Perfil do usuário
`comercial`, `gestor`, `expedicao`, `administrador`.

### Pré-condições
Pedidos criados na data.

### Ponto inicial
Menu → **COMERCIAL** → **Espelho Comercial**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Badge **Provisório P15** e o aviso `Fechado hoje equivale a pedido finalizado; o marco exato permanece pendente em P15.` |
| 2 | Selecionar **Data operacional** | Lista carrega |
| 3 | Filtrar por **Vendedor / representante** | Filtra |
| 4 | Filtrar por **Rota** | Filtra |
| 5 | Buscar por **Buscar cliente** | Filtra |
| 6 | Alternar entre **Por cliente**, **Por rota** e **Por representante** | Agrupamento muda; aparece **Subtotal do grupo** |
| 7 | Clicar **Limpar filtros** | Volta ao estado inicial |

### Status exibidos
**Aberto** · **Parcial** · **Atendido** · **Fechado** · **Faturado** · **Cancelado**

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ESP-001-N1` | Filtros sem resultado | **Nenhum pedido encontrado com os filtros selecionados.** |
| `JRN-ESP-001-N2` | Backend indisponível | **Falha ao carregar o espelho.** |
| `JRN-ESP-001-N3` | `comercial` com escopo REP-A | Só vê pedidos de REP-A |

### ⚠️ Pendência aberta
**P15** — marco exato de fechamento do pedido comercial (carga conferida × envio a faturamento × NF ×
liberação do caminhão). Enquanto não houver AD-xx, o espelho considera "fechado = finalizado".

### Critérios de aprovação
Agrupamentos coerentes e subtotais corretos.

---

## Jornada: Exportar e imprimir o espelho

### ID
`JRN-ESP-002`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Clicar **Exportar** | Download de CSV com os pedidos filtrados |
| 2 | Abrir o CSV | Colunas legíveis, acentuação correta |
| 3 | Clicar **Imprimir** | Diálogo de impressão do navegador com layout adequado |

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ESP-002-A1` | Exportar com filtro aplicado | CSV respeita o filtro |
| `JRN-ESP-002-A2` | Exportar lista vazia | CSV só com cabeçalho, sem erro |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ESP-002-N1` | Exportar como perfil sem `ESPELHO_COMERCIAL_LER` | `403` |

### Critérios de aprovação
CSV íntegro e impressão legível.

### Evidências recomendadas
Arquivo CSV exportado + print da pré-visualização de impressão.
