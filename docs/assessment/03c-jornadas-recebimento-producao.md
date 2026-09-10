# 03c — Jornadas Operacionais (Parte 3: Recebimento, Pesagem, Desossa e Estoque)

> Continuação de [`03b-jornadas-comercial.md`](03b-jornadas-comercial.md).
> Módulos: **M11 Pedido ao Fornecedor** · **M12 Recebimento** · **M13 Pesagem & Destinação** ·
> **M14 Etiquetas** · **M15 Desossa/Transformação** · **M16 Estoque** · **M17 Ocorrências & Aprovações**.
>
> Este bloco é o chão de fábrica. Aqui a **disponibilidade virtual vira peça física** e a rastreabilidade
> ponta a ponta é construída (peça → etiqueta → pedido → carga → NF).

---

# M11 — Pedido ao Fornecedor

> 🔎 **GAP-042 (funcional/UX, severidade Alta):** **não existe tela dedicada** para o Pedido ao Fornecedor.
> O objeto é criado por API e só aparece como opção no combobox **Pedido ao fornecedor** do sheet de novo
> recebimento. Um usuário de negócio **não consegue emitir o pedido pela interface** — o que quebra a
> instrução do v1.1 de que "o recebimento nasce do Pedido ao Fornecedor". Confirmar se isso é escopo
> pendente ou lacuna.

## Jornada: Emitir e enviar o Pedido ao Fornecedor

### ID
`JRN-PFN-001`

### Objetivo
Materializar a compra confirmada em um pedido formal ao frigorífico, deixando-o elegível para recebimento.

### Perfil do usuário
`compras`, `gestor`, `administrador` (permissão `PEDIDO_FORNECEDOR_GERENCIAR`).

### Pré-condições
- Compra programada **confirmada** com disponibilidade gerada (`JRN-CMP-002`).

### Passo a passo (por API, dada a ausência de tela — GAP-042)

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | `POST /operacao/pedidos-fornecedor` com `compraProgramadaId` | Pedido criado em `rascunho` |
| 2 | `POST /operacao/pedidos-fornecedor/:id/enviar` | Status vira `enviado` |
| 3 | Abrir `/recebimento/recebimento-carga` → **Novo recebimento** | O pedido aparece no combobox **Pedido ao fornecedor** |

### Resultado final esperado
Pedido em `enviado` (ou `aguardando_recebimento`), elegível para abertura de lote.

### Status possíveis
`rascunho` · `enviado` · `aguardando_recebimento` · `recebido` · `encerrado` · `cancelado`
**Elegíveis para recebimento:** apenas `enviado` e `aguardando_recebimento`.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PFN-001-N1` | Criar pedido a partir de compra em **rascunho** | `Compra programada não confirmada` |
| `JRN-PFN-001-N2` | Compra confirmada mas **sem disponibilidade gerada** (item sem regra — GAP-029) | `Compra confirmada sem disponibilidade gerada` |
| `JRN-PFN-001-N3` | Compra sem operação | `Compra confirmada sem operação associada` |
| `JRN-PFN-001-N4` | Enviar pedido já enviado | `Pedido em status enviado não pode ser enviado` |
| `JRN-PFN-001-N5` | Pedido inexistente | `Pedido ao fornecedor não encontrado` |
| `JRN-PFN-001-N6` | Criar sem `PEDIDO_FORNECEDOR_GERENCIAR` | `403` |

### Permissões
Ler: `RECEBIMENTO_LER`. Gerenciar: `PEDIDO_FORNECEDOR_GERENCIAR`.

### Critérios de aprovação
Pedido criado, enviado e visível no combobox de recebimento; GAP-042 confirmado e dimensionado.

### Evidências recomendadas
Print do combobox **Pedido ao fornecedor** com o pedido listado; registro de que não há menu para o módulo.

---

# M12 — Recebimento de Carga

> **Contexto de regra (v1.1 §8 / AD-04):** a conclusão do recebimento exige a **revisão tripla obrigatória
> Pedido × NF × Pesagem**, com acumuladores por produto. Divergência **não bloqueia** a operação: gera
> **ocorrência administrativa auditável**.

## Jornada: Abrir lote de recebimento a partir do Pedido ao Fornecedor

### ID
`JRN-REC-001`

### Objetivo
Iniciar a conferência física da carga, herdando os itens previstos do pedido (sem redigitar).

### Perfil do usuário
`recebimento`, `gestor`, `administrador` (permissão `RECEBIMENTO_GERENCIAR`).

### Pré-condições
`JRN-PFN-001` concluída (pedido `enviado`).

### Dados necessários

| Seção | Campo | Valor |
|---|---|---|
| A — Pedido ao Fornecedor | **Pedido ao fornecedor** (`#pedido-fornecedor`) | o pedido enviado |
| A | **Doca / área** (`#doca`) | `Doca 1` |
| B — Nota Fiscal recebida | **Número da NF-e** (`#nfeNumero`) | `129110` |
| B | **Série** (`#nfeSerie`) | `1` |
| B | **Data emissão** (`#nfeDataEmissao`) | data do dia |
| B | **Chave NF-e** (`#nfeChave`) | 44 dígitos |
| B | **Romaneio** (`#romaneio`) | `ROM-001` |
| B | **Peso bruto NF** (`#nfePesoBruto`) | `2500` kg |
| B | **Peso líquido NF** (`#nfePesoLiquido`) | `2450` kg |
| B | **Volumes NF** (`#nfeVolumes`) | `60` |
| C — Transporte | **Placa** (`#placa`) | `ABC1D23` |
| C | **Motorista** (`#motorista`) | `João da Silva` |
| D | **Observações internas** (`#obs`) | `Lote de homologação` |

### Ponto inicial
Menu → **RECEBIMENTO** → **Recebimento de Carga** (`/recebimento/recebimento-carga`)

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Recebimento de carga | Abrir a tela | — | Título **Recebimento de carga**, subtítulo `Abertura de lotes a partir do Pedido ao Fornecedor — conferência na balança` |
| 2 | Lista | Clicar **Novo recebimento** | — | Sheet **Novo Recebimento de Carga** com as seções A–D |
| 3 | Sheet A | Abrir **Pedido ao fornecedor** | — | Busca `Buscar pedido...` |
| 4 | Sheet A | Selecionar o pedido | — | Badge **Itens carregados automaticamente**; tabela de previsão preenchida com **Produto / Qtd prevista / Unidade / Balança** |
| 5 | Sheet A | Ler o hint | — | `Os itens esperados vêm do Pedido ao Fornecedor. Não é necessário redigitar a carga.` |
| 6 | Sheet A | Preencher **Doca / área** | `Doca 1` | — |
| 7 | Sheet B | Preencher os campos da NF | ver tabela | — |
| 8 | Sheet C | Preencher **Placa** e **Motorista** | — | — |
| 9 | Sheet D | Preencher **Observações internas** | — | — |
| 10 | Sheet | Clicar **Criar Lote e Ir para Balança** | — | Lote criado; navega para `/recebimento/pesagem-destinacao?recebimentoId=...` |

### Resultado final esperado
Recebimento com status **Pesagem em andamento** (`pesagem_em_andamento`), itens previstos carregados do
pedido, dados de NF e transporte registrados.

### Efeitos colaterais
- Pedido ao fornecedor migra para `aguardando_recebimento`.
- O lote aparece na lista com colunas **Lote / Pedido de Compra / Fornecedor / NF-e / Romaneio / Tipo de carga / Status / Progresso**.
- Painel Geral: **Recebimentos aguardados** atualiza.

### Validações funcionais
- Itens previstos **não são digitados** — vêm do pedido.
- Coluna **Balança** mostra `Sim` para itens que passam por pesagem e `Não — Entrada direta` para caixaria.
- Só pedidos `enviado`/`aguardando_recebimento` aparecem.

### Validações visuais / UX
- Hint da seção B: `Informe apenas os dados complementares da NF/romaneio. A conferência real de peças, pesos e quantidades será feita na balança.`
- Botão alternativo **Criar Lote** (fica na lista, sem navegar).
- Deep-link `?recebimentoId=<uuid>` abre o detalhe direto.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-REC-001-A1` | Usar **Criar Lote** em vez de **Criar Lote e Ir para Balança** | Fica na tela, lote na lista |
| `JRN-REC-001-A2` | Carga só de caixaria (sem balança) | Todos os itens com `Não — Entrada direta` |
| `JRN-REC-001-A3` | Editar a NF depois (botão **Editar dados da NF**) | `PATCH /nfe` aplicado |
| `JRN-REC-001-A4` | Ajustar **Placa/Motorista/Doca/Observações** pelo bloco de metadados e **Salvar metadados** | Persistido |
| `JRN-REC-001-A5` | Clicar **Ver Pedido de Compra** | Navega para a compra programada de origem |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-001-N1` | Criar sem pedido ao fornecedor | **Informe o Pedido ao Fornecedor, NF-e e confirme que há itens previstos.** |
| `JRN-REC-001-N2` | Criar sem número da NF-e | Mesma mensagem |
| `JRN-REC-001-N3` | Pedido sem itens previstos | `Pedido ao fornecedor sem itens operacionais previstos` |
| `JRN-REC-001-N4` | Nenhum pedido elegível | Help `Nenhum Pedido ao Fornecedor aguardando recebimento.` |
| `JRN-REC-001-N5` | Chave NF-e com menos de 44 dígitos | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: o placeholder diz `44 dígitos`, mas não foi localizada validação de tamanho — **GAP-043** |
| `JRN-REC-001-N6` | Peso bruto menor que o líquido | ⚠️ Sem validação aparente — **GAP-044** |
| `JRN-REC-001-N7` | Backend fora do ar ao abrir | `Erro ao carregar Pedidos ao Fornecedor` |
| `JRN-REC-001-N8` | Duplo clique em **Criar Lote** | Um único lote |
| `JRN-REC-001-N9` | Sem permissão de leitura | `Você não tem permissão para visualizar recebimentos.` |

### Permissões

| Perfil | Ver | Gerenciar |
|---|---|---|
| administrador, gestor, recebimento | Sim | Sim |
| compras | Sim | Não |
| balanca | Sim (via pesagem) | Não |
| comercial | Não | Não |

### Critérios de aprovação
Lote criado com itens herdados, NF registrada e navegação para a balança funcionando.

### Evidências recomendadas
Print do sheet com o badge **Itens carregados automaticamente** e a tabela de previsão; print do lote na lista.

---

## Jornada: Capturar itens estruturados da NF

### ID
`JRN-REC-002`

### Objetivo
Persistir a NF estruturada, pré-requisito para concluir a conferência tripla.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | No detalhe do lote, clicar **Capturar itens da NF** | Itens da NF carregados |
| 2 | Conferir o quadro comparativo | Coluna NF preenchida |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-002-N1` | Capturar sem número de NF | **Informe o número da NF-e antes de capturar os itens.** / `nfeNumero é obrigatório para persistir NF estruturada` |
| `JRN-REC-002-N2` | NF sem itens | `NF estruturada exige ao menos um item` |
| `JRN-REC-002-N3` | Registrar NF antes de iniciar o recebimento | `Inicie um recebimento antes de registrar a NF` |
| `JRN-REC-002-N4` | Falha de rede | `Erro ao capturar itens da NF` |

### Critérios de aprovação
NF estruturada persistida e refletida no comparativo.

---

## Jornada: Concluir a conferência tripla sem divergência

### ID
`JRN-REC-003`

### Objetivo
**Jornada crítica (AD-04).** Fechar o recebimento com Pedido × NF × Pesagem batendo.

### Perfil do usuário
`recebimento`, `gestor`, `administrador` (permissão `CONFERENCIA_CONCLUIR`).

### Pré-condições
- Lote aberto (`JRN-REC-001`).
- NF estruturada capturada (`JRN-REC-002`).
- **Todas** as peças previstas pesadas e destinadas (`JRN-PES-001`).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Na balança, encerrar a pesagem (`POST /concluir-pesagem`) | Status vira **Aguardando conferência final** |
| 2 | Voltar ao detalhe do lote | Botão **Concluir conferência** habilitado |
| 3 | Clicar **Concluir conferência** | Dialog **Conclusão da Conferência — Pedido × NF × Pesagem** com a descrição `Revise o quadro comparativo e confirme o resultado da conferência.` |
| 4 | Revisar o quadro comparativo por produto | Colunas Pedido / NF / Pesagem com acumuladores |
| 5 | Preencher **Observação da conferência** (`#obs-conferencia`) | — |
| 6 | Clicar **Confirmar conclusão** | Status vira **Conferido sem divergência** |

### Resultado final esperado
`recebimentos.status = conferido_sem_divergencia`; itens em **Conferido**; nenhuma ocorrência gerada.

### Efeitos colaterais
- Pedido ao fornecedor migra para `recebido`.
- Disponibilidade **física** substitui a virtual nos itens recebidos.
- Estoque físico atualizado para peças destinadas a estoque.

### Status do recebimento (rótulos exatos)

| Código | Rótulo na tela |
|---|---|
| `pesagem_em_andamento` | Pesagem em andamento |
| `aguardando_conclusao_pesagem` | Pesagem em andamento |
| `aguardando_conferencia_final` | Aguardando conferência final |
| `conferido_sem_divergencia` | Conferido sem divergência |
| `conferido_com_divergencia` | Conferido com divergência |
| `ocorrencia_administrativa_aberta` | Ocorrência administrativa aberta |
| `tratativa_administrativa_concluida` | Tratativa concluída |
| `cancelado` | Cancelado |

### Status dos itens
**Aguardando** · **Em conferência** · **Conferido** · **Divergente** · **Entrada direta**

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-REC-003-A1` | Suspender a conferência (**Suspender**) e retomar | Volta a **Pesagem em andamento** |
| `JRN-REC-003-A2` | Lote misto (peças + caixaria) | Caixaria entra como **Entrada direta** |
| `JRN-REC-003-A3` | Conferência sem observação | Permitida (campo opcional) |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-003-N1` | Concluir com o lote ainda em pesagem | `Recebimento não está em pesagem` |
| `JRN-REC-003-N2` | Concluir sem NF do fornecedor | `NF do fornecedor obrigatória` |
| `JRN-REC-003-N3` | Concluir sem capturar itens da NF | `Carregue os itens da NF antes de concluir a conferência` (`NF_ITENS_OBRIGATORIOS`) |
| `JRN-REC-003-N4` | Declarar "sem divergência" havendo divergências | `Resultado inconsistente com o quadro (há divergências)` |
| `JRN-REC-003-N5` | Declarar "com divergência" sem haver nenhuma | `Resultado inconsistente com o quadro (sem divergências)` |
| `JRN-REC-003-N6` | Concluir duas vezes | `Conferência já concluída` |
| `JRN-REC-003-N7` | Concluir sem `CONFERENCIA_CONCLUIR` | `403` |
| `JRN-REC-003-N8` | Concluir com divergência em aberto | Aviso `Há {N} item(ns) com divergência em aberto.` |

### Permissões
`CONFERENCIA_CONCLUIR` — segregada de `RECEBIMENTO_GERENCIAR` (segregação de funções SF).

### Critérios de aprovação
Conferência tripla completa, acumuladores corretos, mensagens de inconsistência funcionando nos dois sentidos.

### Evidências recomendadas
Print do dialog com o quadro comparativo completo; print do status final.

---

## Jornada: Registrar divergência e abrir ocorrência administrativa

### ID
`JRN-REC-004`

### Objetivo
Provar que a divergência **não trava a operação** e gera trilha administrativa (v1.1 §8).

### Pré-condições
Lote em pesagem/conferência.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | No detalhe do lote, clicar **Registrar divergência** | — | Dialog **Registrar divergência** |
| 2 | Selecionar **Tipo de divergência** (`#div-tipo`) | `Quantidade menor` | Primeira opção do select: `Selecione o tipo` |
| 3 | Preencher **Descrição** (`#div-desc`) | `Chegaram 8 peças, previstas 10` | Obrigatório |
| 4 | Preencher **Ação imediata** (`#div-acao`) | `Fornecedor notificado por telefone` | Obrigatório |
| 5 | Clicar **Registrar** | — | Item vira **Divergente** |
| 6 | Concluir a conferência declarando divergência | — | Status **Conferido com divergência** e ocorrência administrativa aberta |
| 7 | Abrir `/gestao/aprovacoes` → aba **Fila Administrativa de Ocorrências** | — | Ocorrência **Aberta** |

### Tipos de divergência (valores exatos)

| Código | Rótulo |
|---|---|
| `quantidade_menor` | Quantidade menor |
| `quantidade_maior` | Quantidade maior |
| `item_divergente` | Item divergente |
| `qualidade_divergente` | Qualidade divergente |
| `peso_incompativel` | Peso incompatível |
| `item_ausente` | Item ausente |
| `item_excedente` | Item excedente |
| `inconsistencia_nf_fisico` | Inconsistência NF x físico |

### Resultado final esperado
Divergência registrada, recebimento concluído mesmo assim, ocorrência na fila administrativa.

### Efeitos colaterais
- Painel Geral: **Divergências abertas** incrementa.
- Alerta **Divergência de recebimento** no dashboard: `Lote {lote} — {n} divergência(s) encaminhada(s) ao administrativo.`
- Alerta na Disponibilidade (**Divergências no recebimento**).

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-REC-004-A1` | Registrar os 8 tipos de divergência | Todos aceitos |
| `JRN-REC-004-A2` | Múltiplas divergências no mesmo lote | Contador `Há {N} item(ns) com divergência em aberto.` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-004-N1` | Registrar sem descrição ou ação imediata | **Preencha descrição e ação imediata da divergência.** |
| `JRN-REC-004-N2` | Registrar sem tipo | Bloqueado (select obrigatório) |
| `JRN-REC-004-N3` | Falha de rede | `Erro ao registrar divergência` |

### Permissões
`RECEBIMENTO_GERENCIAR` para registrar; `DIVERGENCIA_RECEBIMENTO_GERENCIAR` para tratar.

### Critérios de aprovação
Operação continua apesar da divergência; ocorrência gerada e visível na fila administrativa.

### Evidências recomendadas
Print do dialog de divergência, print da ocorrência na fila e do alerta no dashboard.

---

## Jornada: Tratar a divergência até a resolução

### ID
`JRN-REC-005`

### Objetivo
Fechar o ciclo administrativo da divergência.

### Perfil do usuário
`administrativo`, `gestor`, `administrador` (`OCORRENCIA_FORNECEDOR_GERENCIAR`).

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | `/gestao/aprovacoes` → aba **Fila Administrativa de Ocorrências** | — | Ocorrência **Aberta** com `Fornecedor:`, `NF:`, `Pedido/lote:` |
| 2 | Preencher **Registrar andamento** (`#andamento`) | `Fornecedor confirmou o abatimento na NF` | — |
| 3 | Clicar **Registrar andamento** | — | Status vira **Em tratativa**; entrada na **Timeline de andamentos** |
| 4 | Preencher **Concluir tratativa** (`#desfecho`) | `Nota de crédito emitida pelo fornecedor` | — |
| 5 | Clicar **Concluir tratativa** | — | Status **Concluída** com `Resultado` e `Concluída em {data}` |

### Status da ocorrência

| Código | Rótulo |
|---|---|
| `aberta` | Aberta |
| `em_analise` | Em tratativa |
| `aguardando_fornecedor` | Aguardando fornecedor |
| `resolvida` | Concluída |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-005-N1` | Encerrar ocorrência já encerrada | `Ocorrência já encerrada` |
| `JRN-REC-005-N2` | Ocorrência inexistente | `Ocorrência não encontrada` |
| `JRN-REC-005-N3` | Abrir o comparativo sem conferência tripla concluída | `Sem conferência tripla concluída para esta ocorrência` (`CONCLUSAO_INEXISTENTE`) |
| `JRN-REC-005-N4` | Tratar sem `OCORRENCIA_FORNECEDOR_GERENCIAR` | `403` |

### Critérios de aprovação
Timeline completa e ocorrência encerrada com desfecho.

---

## Jornada: Cancelar lote de recebimento

### ID
`JRN-REC-006`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Em um lote **sem** pesagem registrada, clicar **Cancelar lote** | Confirmação `Confirma o cancelamento deste lote?` |
| 2 | Confirmar | Status **Cancelado** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-006-N1` | Cancelar lote **com** pesagem registrada | **Não é possível cancelar lote com pesagem registrada.** |
| `JRN-REC-006-N2` | Cancelar lote já conferido | Bloqueado |
| `JRN-REC-006-N3` | Falha de rede | `Erro ao cancelar lote` |

### Critérios de aprovação
Trava de pesagem comprovada.

---

## Jornada: Consultar e navegar a lista de recebimentos

### ID
`JRN-REC-007`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a lista | Colunas **Lote / Pedido de Compra / Fornecedor / NF-e / Romaneio / Tipo de carga / Status / Progresso** |
| 2 | Clicar **Atualizar** | Recarrega |
| 3 | Clicar **Abrir** em um lote | Detalhe |
| 4 | Clicar **Ir para Balança** | `/recebimento/pesagem-destinacao?recebimentoId=...` |
| 5 | Clicar **← Voltar à lista** | Volta |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-REC-007-N1` | Nenhum recebimento | **Nenhum recebimento registrado.** |
| `JRN-REC-007-N2` | `recebimentoId` inexistente na URL | `Erro ao carregar recebimento` |

### Critérios de aprovação
Navegação e deep-link funcionais.

---

# M13 — Pesagem & Destinação (recebimento)

> **Contexto de regra:** cada peça é pesada individualmente e recebe **um destino** — pedido, estoque ou
> desossa. A prioridade é atender pedido. A **Troca de Peça** é atômica e preserva pesos (v1.1 §10.4).

## Jornada: Capturar peso e associar peça a pedido

### ID
`JRN-PES-001`

### Objetivo
**Jornada crítica.** Materializar a peça física e vinculá-la ao pedido do cliente.

### Perfil do usuário
`balanca`, `recebimento`, `gestor`, `administrador`.

### Pré-condições
- Lote em **Pesagem em andamento** (`JRN-REC-001`).
- Pedido de venda com item compatível (`JRN-PVD-001`).
- `HARDWARE_FAKE=1` no ambiente de homologação (balança/impressora/leitor simulados).

### Ponto inicial
Menu → **RECEBIMENTO** → **Pesagem & Destinação** (`/recebimento/pesagem-destinacao?recebimentoId=...`)

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Pesagem | Abrir a tela | — | Título **Pesagem & Destinação**, subtítulo `Captura de peso e destino da peça recebida` |
| 2 | Pesagem | Conferir os badges de dispositivo | — | **Balança**, **Impressora**, **Leitor** com status |
| 3 | Pesagem | Se necessário, **Trocar lote** | — | Select `Selecione o lote` |
| 4 | Card Balança | Conferir **Produto** (`#produto-atual`) | — | Somente leitura |
| 5 | Card Balança | (Opcional) marcar **Características (opcional)** | `Mais pesada` | Chips: **Mais pesada**, **Mais gorda**, **Melhor acabamento** |
| 6 | Card Balança | Clicar **Capturar Peso** | — | **Peso atual** exibido em `kg` |
| 7 | Pedidos compatíveis | Conferir a lista | — | Badge **Sugestão principal** no melhor match; selo `pref. compatível` |
| 8 | Pedidos compatíveis | Buscar `Buscar cliente` | `Açougue A` | Filtra |
| 9 | Pedidos compatíveis | Clicar **Vincular** no pedido | — | Peça fica **Pedido** |
| 10 | Card Balança | Clicar **Confirmar e imprimir etiqueta** | — | Botão passa a exibir **Etiqueta: {código}** |
| 11 | Ações realizadas | Conferir a linha | — | **Hora / Produto / Peso / Destino / Cliente / Etiqueta** |
| 12 | Acumulado do lote | Conferir | — | **Produto / Previsto / Pesado / Restante** — restante decresce |

### Resultado final esperado
- Peça com status `associada`, peso registrado, etiqueta `ativa` impressa.
- Item do pedido de venda progride para atendido.
- Acumulado do lote atualizado.

### Efeitos colaterais
- Disponibilidade: unidade migra de **V** (virtual) para **F** (físico) no mapa.
- Etiqueta consultável em `/recebimento/etiquetas`.
- Rastreabilidade peça → pedido → cliente estabelecida.

### Status da peça (rótulos)
**Aguardando destino** · **Pedido** · **Estoque** · **Desossa** · **Análise** · **Divergência**
(códigos: `pesada`, `associada`, `em_sobra`, `em_analise`, `para_corte`, `divergente`)

### Validações funcionais
- A sugestão considera **produto, faixa de peso e prioridade do cliente**.
- A etiqueta só pode ser emitida **após** a confirmação da associação.
- Peça já em carga fechada bloqueia estorno.

### Validações visuais / UX
- Empty inicial: **Capture o peso para ver pedidos compatíveis** + `A lista considera produto, faixa de peso e prioridade do cliente.`
- `Carregando sugestões…` durante a busca.
- Rodapé de demandas: `Origem: {origem} · regras provisórias por unidade`.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PES-001-A1` | Destinar a estoque (**→ Estoque**) | Peça fica **Estoque**; exige `Motivo (estoque)` |
| `JRN-PES-001-A2` | Destinar à desossa (**→ Desossa**) | Peça fica **Desossa** (`para_corte`), some do acumulado de pedido e aparece na fila da desossa |
| `JRN-PES-001-A3` | Peso manual assistido | Ver `JRN-PES-002` |
| `JRN-PES-001-A4` | Múltiplas peças do mesmo produto em sequência | Acumulado incrementa corretamente |
| `JRN-PES-001-A5` | Usar as **Demandas desossa** como orientação | Lista de faltas; empty `Nenhuma demanda de desossa pendente.` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PES-001-N1` | Vincular peça já associada | `Peça já associada — use redirecionar` |
| `JRN-PES-001-N2` | Vincular a item de pedido já completo | `Item do pedido já está completo` |
| `JRN-PES-001-N3` | Vincular a pedido **cancelado** | `Pedido cancelado não aceita associação` |
| `JRN-PES-001-N4` | Vincular peça a item incompatível (produto errado) | `Item de pedido incompatível com a peça` |
| `JRN-PES-001-N5` | Emitir etiqueta sem confirmar a associação | `Etiqueta só pode ser emitida após a confirmação da associação` |
| `JRN-PES-001-N6` | Redirecionar peça não associada | `Só é possível redirecionar peça já associada` |
| `JRN-PES-001-N7` | Nenhum pedido compatível | **Nenhum pedido compatível encontrado.** → usar `→ Estoque` ou `→ Desossa` |
| `JRN-PES-001-N8` | Nenhum lote selecionado | **Nenhum lote selecionado.** |
| `JRN-PES-001-N9` | Nenhuma ação no lote | **Nenhuma ação registrada neste lote.** |
| `JRN-PES-001-N10` | Duplo clique em **Capturar Peso** | Uma única peça criada |
| `JRN-PES-001-N11` | Sem permissão de leitura | `Você não tem permissão para visualizar pesagem.` |

### Permissões

| Ação | Permissão |
|---|---|
| Ver a tela | `PESAGEM_LER` |
| **Capturar Peso** | `PESAGEM_GERENCIAR` |
| **Vincular** / destinos / **Trocar Peça** | `ASSOCIACAO_GERENCIAR` |
| **Cancelar ação realizada** | `ASSOCIACAO_ESTORNAR` |
| **Digitar** peso manual | `PESO_MANUAL` |
| **Confirmar e imprimir etiqueta** | `ETIQUETA_GERENCIAR` |

`JRN-PES-001-P1`: perfil `balanca` sem `ASSOCIACAO_ESTORNAR` não vê **Cancelar ação realizada**.

### Critérios de aprovação
Peça pesada, associada, etiquetada e rastreável; acumulado correto; 11 negativos verificados.

### Evidências recomendadas
Print do card Balança com peso, print da lista de pedidos compatíveis com **Sugestão principal**,
print de **Ações realizadas** e do **Acumulado do lote**.

---

## Jornada: Peso manual assistido (contingência de balança)

### ID
`JRN-PES-002`

### Objetivo
Cobrir a indisponibilidade do hardware sem perder auditabilidade (ADR-009).

### Pré-condições
Balança indisponível ou leitura instável (simulável desligando o fake).

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Conferir o badge **Balança** | — | Indisponível; hint `Balança indisponível — use peso manual assistido.` |
| 2 | Clicar **Digitar** | — | Campo **Peso manual** (`#peso-manual`, placeholder `0,000`) |
| 3 | Informar o peso | `24,350` | — |
| 4 | Selecionar o motivo | `dispositivo indisponivel` | Opções: `dispositivo indisponivel`, `leitura instavel`, `divergencia balanca`, `outro` |
| 5 | Clicar **Confirmar peso manual** | — | Peso registrado com marcação de origem manual |
| 6 | Conferir a auditoria | — | Evento com motivo |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PES-002-N1` | Peso manual sem motivo | `Captura manual exige pesoManual e motivo` |
| `JRN-PES-002-N2` | Sem permissão `PESO_MANUAL` | `Sem permissão PESO_MANUAL para captura manual assistida` |
| `JRN-PES-002-N3` | Leitura instável sem modo manual | `Leitura instável: confirme via modo manual assistido com motivo` |
| `JRN-PES-002-N4` | Peso `0` ou negativo | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO — **GAP-045** |

### Critérios de aprovação
Contingência funciona e fica auditada com motivo.

---

## Jornada: Estornar ação de pesagem

### ID
`JRN-PES-003`

### Objetivo
Corrigir erro operacional dentro da janela permitida.

### Perfil do usuário
`gestor`, `administrador`, `recebimento` com `ASSOCIACAO_ESTORNAR`.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Em **Ações realizadas**, clicar **Cancelar ação realizada** | — | Painel de estorno |
| 2 | Selecionar o motivo | `Peso informado incorretamente` | Opções: **Peso informado incorretamente**, **Pedido selecionado incorretamente**, **Destino selecionado incorretamente**, **Etiqueta impressa incorretamente**, **Outro** |
| 3 | Preencher `Observações` | — | — |
| 4 | Clicar **Confirmar estorno** | — | Ação revertida; etiqueta invalidada; saldo do pedido devolvido |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PES-003-N1` | Estornar peça **não associada** a pedido | `Só é possível estornar peça associada a um pedido` |
| `JRN-PES-003-N2` | Estornar peça em **carga fechada** | `Peça já está em carga fechada — estorno bloqueado` |
| `JRN-PES-003-N3` | Sem `ASSOCIACAO_ESTORNAR` | Botão ausente; API `403` |
| `JRN-PES-003-N4` | Estornar sem motivo | Bloqueado |

### Critérios de aprovação
Estorno reverte tudo (peça, etiqueta, item do pedido) e é bloqueado após carga fechada.

---

## Jornada: Troca de peça (fluxo atômico de 6 passos)

### ID
`JRN-PES-004`

### Objetivo
**Jornada crítica (v1.1 §10.4).** Substituir a peça associada a um pedido preservando pesos e
invalidando a etiqueta antiga — tudo em uma transação.

### Perfil do usuário
`balanca`, `recebimento`, `gestor`, `administrador` (`ASSOCIACAO_GERENCIAR`).

### Pré-condições
- Um pedido com peça associada e etiquetada (`JRN-PES-001`).
- Uma segunda peça pesada e **não associada**.

### Passo a passo

| Passo | Passo do fluxo | Ação | Resultado esperado |
|---|---|---|---|
| 1 | — | Clicar **Trocar Peça** | Modal **Trocar Peça** |
| 2 | **1. Selecionar pedido** | Escolher o pedido | **Avançar** habilita |
| 3 | **2. Peça atual associada** | Conferir a peça e o peso | — |
| 4 | **3. Nova peça** | Selecionar a peça de entrada | — |
| 5 | **4. Destino da peça retirada** | Escolher **Estoque** ou **Desossa** | — |
| 6 | **5. Motivo da troca** | Selecionar (`Selecione…`) e preencher `Observações` | Motivos: **Peça mais adequada ao cliente**, **Peso fora da preferência**, **Qualidade**, **Erro de associação**, **Outro** |
| 7 | **6. Revisão de impactos** | Revisar | Mostra o que muda |
| 8 | — | Clicar **Confirmar Troca** | Tela **Troca concluída** com **Etiqueta invalidada**, **Nova etiqueta** e **Peça retirada** |
| 9 | — | Clicar **Concluir** | Volta à pesagem |
| 10 | — | Abrir `/recebimento/etiquetas` | Etiqueta antiga com estado `invalidada_por_troca`; nova etiqueta ativa |

### Resultado final esperado
Pedido com a nova peça; peça antiga no destino escolhido; etiquetas coerentes; pesos preservados.

### Efeitos colaterais
- Estoque ou fila de desossa recebe a peça retirada.
- Auditoria com motivo.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-PES-004-A1` | Destino da retirada = **Desossa** | Peça vira `para_corte` |
| `JRN-PES-004-A2` | Usar **Voltar** entre os passos | Dados preservados |
| `JRN-PES-004-A3` | Impressora não confirma | Alerta `Nova etiqueta registrada, mas a impressora não confirmou — reimprima pela tela de Etiquetas.` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PES-004-N1` | Peça retirada já desassociada por outro usuário | `Peça retirada não está mais associada...` |
| `JRN-PES-004-N2` | Peça de entrada já associada | `Peça de entrada já está associada...` |
| `JRN-PES-004-N3` | Peça retirada em carga fechada | `Peça retirada já está em carga fechada — troca bloqueada` |
| `JRN-PES-004-N4` | Falha genérica | `Não foi possível concluir a troca` |
| `JRN-PES-004-N5` | Avançar sem preencher o passo | **Avançar** desabilitado |

### Critérios de aprovação
Troca atômica: ou tudo muda, ou nada muda. Etiqueta antiga invalidada e nova emitida.

### Evidências recomendadas
Print de cada um dos 6 passos e da tela **Troca concluída**; print das duas etiquetas em `/recebimento/etiquetas`.

---

## Jornada: Peça sem cobertura (sobra, análise, corte, divergência)

### ID
`JRN-PES-005`

### Objetivo
Cobrir o destino de peças que não têm pedido compatível.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Pesar uma peça sem pedido compatível | **Nenhum pedido compatível encontrado.** |
| 2 | Escolher o destino | `sobra` / `analise` / `corte` / `divergencia` (via `→ Estoque`, `→ Desossa` ou API) |
| 3 | Informar o motivo | Obrigatório para estoque |
| 4 | Conferir o status da peça | **Estoque** / **Análise** / **Desossa** / **Divergência** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-PES-005-N1` | Destino sem motivo | Bloqueado |
| `JRN-PES-005-N2` | Destino inválido | `400` |

### Critérios de aprovação
Os quatro destinos alternativos funcionam e ficam rastreáveis.

---

# M14 — Etiquetas

## Jornada: Consultar, reimprimir e cancelar etiqueta de recebimento

### ID
`JRN-ETQ-001`

### Objetivo
Gerir o ciclo de vida da etiqueta (v1.1 §10.4).

### Perfil do usuário
`balanca`, `recebimento`, `gestor`, `administrador`.

### Ponto inicial
Menu → **RECEBIMENTO** → **Etiquetas** (`/recebimento/etiquetas`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Etiquetas — recebimento**, subtítulo `Consulta, reimpressão e cancelamento conforme v1.1 §10.4` |
| 2 | Selecionar o lote | Lista carrega |
| 3 | Filtrar por estado | Opções: `Todos os estados`, `emitida`, `ativa`, `invalidada_por_troca`, `reimpressa`, `cancelada` |
| 4 | Clicar numa etiqueta | Sheet **Detalhe da etiqueta** |
| 5 | Conferir as seções | **Preview da etiqueta**, **Dados da peça**, **Rastreabilidade**, e **Pedido vinculado** / **Estoque** / **Desossa** |
| 6 | Reimprimir | Dialog **Reimprimir etiqueta** com `Inclui etiquetas pendentes de impressão. Confirma reimpressão de {código}?` |
| 7 | Cancelar | Dialog **Cancelar etiqueta e estornar ação** com o aviso `Esta ação irá invalidá-la e estornar a ação operacional vinculada.` |
| 8 | Escolher o motivo do cancelamento | **Peso informado incorretamente** / **Pedido selecionado incorretamente** / **Destino selecionado incorretamente** / **Etiqueta impressa incorretamente** / **Peça identificada incorretamente** / **Outro** |

### Rótulos de status

| Rótulo na tela | Significado |
|---|---|
| Cancelada | etiqueta anulada |
| Pendente de impressão | emitida sem confirmação da impressora |
| Bloqueada | não pode ser alterada |
| Reimprimida | reimpressa |
| Ativa | válida |

### Colunas
**Etiqueta / Status / Produto / Peso / Destino**

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ETQ-001-N1` | Lote sem etiquetas | **Nenhuma etiqueta neste recebimento.** |
| `JRN-ETQ-001-N2` | Cancelar etiqueta em estado terminal | `Etiqueta já está em estado terminal` |
| `JRN-ETQ-001-N3` | Cancelar etiqueta de peça em **carga fechada** | `Peça já está em carga fechada — cancelamento bloqueado` |
| `JRN-ETQ-001-N4` | Sem `ETIQUETA_GERENCIAR` | Ações indisponíveis |
| `JRN-ETQ-001-N5` | Sem permissão de leitura | `Você não tem permissão para visualizar etiquetas.` |

### Permissões
Ver: `PESAGEM_LER` **ou** `ETIQUETA_GERENCIAR`. Agir: `ETIQUETA_GERENCIAR`.

### ⚠️ Pendência aberta
Badge **Provisório P1** no local de estoque previsto do drawer.

### Critérios de aprovação
Ciclo completo da etiqueta exercitado, incluindo os dois bloqueios (estado terminal e carga fechada).

### Evidências recomendadas
Print do detalhe com preview e rastreabilidade; print dos dois bloqueios.

---

# M15 — Desossa / Transformação

> **Contexto de regra (AD-01 / v1.1 §11 / pendência P12):** só o **TZ** é transformado, por **2 regras
> provisórias exclusivas por unidade** (A ou B). A quantidade de saída é fixa pela regra; o **peso é
> variável** e capturado na balança da desossa. O painel é **orientativo** — a execução é na pesagem.

## Jornada: Ler o Painel de Necessidade da desossa

### ID
`JRN-DES-001`

### Objetivo
Saber o que falta produzir para completar os pedidos do dia.

### Perfil do usuário
`desossa`, `gestor`, `administrador`.

### Pré-condições
Peças `para_corte` na fila (`JRN-PES-001-A2`) e pedidos com itens de partes.

### Ponto inicial
Menu → **DESOSSA** → **Painel de Necessidade** (`/desossa/dashboard`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Painel de Necessidade**, subtítulo `O que falta produzir para completar os pedidos do dia.` |
| 2 | Conferir os KPIs | **Itens faltantes**, **Prontos em estoque**, **TZs na desossa**, **Regras sugeridas**, **Prioridade alta** |
| 3 | Conferir **Painel de Itens a Produzir** | Lista de faltas |
| 4 | Conferir **Sugestão por Regra de Transformação** | Regras sugeridas com badge **Provisório P12** no drawer |
| 5 | Conferir **TZs Disponíveis na Desossa** | Peças encaminhadas |
| 6 | Clicar **Modo TV** | Tela cheia: **DESOSSA — PAINEL OPERACIONAL** / `O que falta produzir para atender pedidos e cargas` |
| 7 | Conferir as colunas do modo TV | **PRIOR. / PRODUTO / FALTAM / A PRODUZIR / ORIGEM / CARGA / HORÁRIO / STATUS**; rodapé `Atualização por eventos em tempo real` |
| 8 | Clicar **Sair** | Volta ao painel |
| 9 | Clicar **Pesagem e Destinação** | Navega para `/desossa/pesagem-destinacao` |

### Validações funcionais
Hint do drawer: `Painel somente orientativo. A execução ocorre na Pesagem e Destinação da Desossa.`

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DES-001-N1` | Nada faltando | **Nenhum item faltante.** |
| `JRN-DES-001-N2` | Sem regra aplicável | **Nenhuma regra sugerida.** |
| `JRN-DES-001-N3` | Sem permissão | `Você não tem permissão para visualizar o dashboard da desossa.` |

### Permissões
`DESOSSA_PAINEL_LER` **ou** `DESOSSA_LER` **ou** `CORTE_GERENCIAR`.

### Critérios de aprovação
KPIs coerentes com pedidos e fila; modo TV legível a distância.

### Evidências recomendadas
Print do painel e do modo TV.

---

## Jornada: Executar a transformação de um TZ

### ID
`JRN-DES-002`

### Objetivo
**Jornada crítica.** Transformar um TZ em partes, capturando o peso variável de cada saída.

### Perfil do usuário
`desossa`, `gestor`, `administrador` (`CORTE_GERENCIAR`).

### Pré-condições
Ao menos um TZ com status **Desossa** (`para_corte`) e etiqueta ativa.

### Ponto inicial
Menu → **DESOSSA** → **Pesagem e Destinação** (`/desossa/pesagem-destinacao`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Pesagem e Destinação**, subtítulo `Escolha o TZ, vincule a regra A/B e registre as saídas da transformação.` + badge **Provisório P12 — Regras provisórias — validar com cliente** |
| 2 | Ler o empty inicial | **Selecione ou leia a etiqueta de um TZ encaminhado à desossa** / `As peças enviadas pela balança principal aparecem na lista de seleção.` |
| 3 | Clicar **Selecionar TZ** | Modal **Selecionar TZ para desossa** com o texto `Peças encaminhadas pela balança principal. Leia a etiqueta (QR) ou selecione manualmente.` |
| 4 | Escolher o TZ | Transformação iniciada (`POST /corte/pecas/:id/iniciar`) |
| 5 | Ler o próximo empty | **Escolha a regra de transformação para o {etiqueta}** / `A regra define as saídas esperadas (quantidade fixa; peso variável capturado aqui). A definição é obrigatória antes de registrar as partes.` |
| 6 | Selecionar a regra (A ou B) | Checklist de saídas esperadas carregado |
| 7 | Para cada subitem: capturar peso, associar destino e emitir etiqueta | Subitem passa por `gerado → pesado → associado` |
| 8 | Clicar **Finalizar** | Modal **Finalizar transformação** |
| 9 | Com o checklist completo, clicar **Concluir** | Transformação `concluida` |

### Resultado final esperado
- TZ consumido; partes geradas com peso, destino e etiqueta.
- Cada parte rastreável até a peça mãe.

### Status da transformação
`aberta` → `em_execucao` → `aguardando_pesagem` → `aguardando_associacao` → `aguardando_etiquetagem` → `concluida` (ou `cancelada`)

### Status do subitem
`gerado` · `pesado` · `associado` · `em_sobra` · `em_analise`

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-DES-002-A1` | Usar a **regra B** em vez da A | Saídas diferentes conforme a regra |
| `JRN-DES-002-A2` | Parte sem pedido compatível | Vai para sobra/análise |
| `JRN-DES-002-A3` | Reimprimir etiqueta de parte | **Reimprimir** funcional |
| `JRN-DES-002-A4` | Cancelar registro individual (**Cancelar ação**) | Motivos: **Peso informado incorretamente**, **Produto registrado incorretamente**, **Pedido selecionado incorretamente**, **Destino selecionado incorretamente**, **Etiqueta impressa incorretamente**, **Outro** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DES-002-N1` | Nenhum TZ na fila | **Nenhum TZ disponível para desossa.** |
| `JRN-DES-002-N2` | Registrar partes antes de definir a regra | Bloqueado pelo empty state |
| `JRN-DES-002-N3` | Concluir com subitem sem peso, destino ou etiqueta | Bloqueado |
| `JRN-DES-002-N4` | Concluir com checklist divergente sem registrar a divergência | `Checklist divergente — registre o tipo antes de concluir.` |
| `JRN-DES-002-N5` | Aplicar duas regras à mesma unidade | Bloqueado (regras **exclusivas por unidade**) |
| `JRN-DES-002-N6` | Sem `CORTE_GERENCIAR` | `403` |

### Permissões
`CORTE_GERENCIAR` para executar; `DESOSSA_LER`/`DESOSSA_PAINEL_LER` para consultar.

### ⚠️ Pendência aberta
**P12** — as duas regras são provisórias e precisam ser validadas com o cliente. Remoção do badge exige AD-xx.

### Critérios de aprovação
TZ transformado ponta a ponta com rastreabilidade peça mãe → partes; exclusividade de regra comprovada.

### Evidências recomendadas
Print do modal de seleção de TZ, do checklist da regra e da transformação concluída.

---

## Jornada: Registrar divergência de transformação

### ID
`JRN-DES-003`

### Objetivo
Documentar quando a saída real diverge da regra.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Com checklist divergente, clicar **Finalizar** | — | Modal **Finalizar transformação** com o aviso de divergência |
| 2 | Selecionar o tipo | `Subpeça faltante` | Opções: **Subpeça faltante**, **Subpeça excedente**, **Produto diferente**, **Perda informada** |
| 3 | Preencher a observação | mínimo 3 caracteres | Placeholder `Observação (ao menos 3 caracteres)` |
| 4 | Clicar **Registrar divergência e concluir** | — | Transformação concluída com divergência; solicitação de aprovação **Divergência de transformação** gerada |
| 5 | Abrir `/gestao/aprovacoes` → **Aprovações Operacionais** | — | Solicitação **Pendente** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DES-003-N1` | Observação com menos de 3 caracteres | Bloqueado |
| `JRN-DES-003-N2` | Concluir sem registrar tendo divergência | `Checklist divergente — registre o tipo antes de concluir.` |

### Critérios de aprovação
Divergência registrada e encaminhada à fila de aprovações.

---

## Jornada: Gerir etiquetas da desossa

### ID
`JRN-DES-004`

### Ponto inicial
Menu → **DESOSSA** → **Etiquetas** (`/desossa/etiquetas`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Etiquetas — Desossa**, subtítulo `Etiquetas das partes geradas na transformação, com peça mãe e invalidação por troca.` |
| 2 | Conferir os KPIs | **Emitidas**, **Reimpressões**, **Canceladas**, **Invalidadas por troca**, **Pendentes de impressão** |
| 3 | Buscar | Placeholder `Buscar por etiqueta, parte, cliente, TZ, lote ou NF` |
| 4 | Filtrar por produto | `Todos`, `Coxão-bola`, `Jacaré`, `Coxão-bola com alcatra`, `Filé curto` |
| 5 | Abrir o drawer de uma etiqueta | Vínculo com a peça mãe (TZ) |
| 6 | Reimprimir | Motivos: **Etiqueta rasgada**, **Etiqueta molhada/danificada**, **Falha de impressão**, **Perda da etiqueta**, **Outro**; impressora `Balança Desossa — Zebra ZD421` |

### Status
**Bloqueada** · **Pendente de impressão** · **Ativa** · **Reimprimida** · **Cancelada** · **Invalidada por troca**

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DES-004-N1` | Abrir etiqueta cancelada | Aviso `Esta etiqueta foi cancelada e não deve ser usada na operação.` |
| `JRN-DES-004-N2` | Abrir etiqueta invalidada por troca | Aviso `Esta etiqueta foi invalidada em razão de uma troca de peça (v1.1 §10.4)...` |
| `JRN-DES-004-N3` | Cancelar etiqueta de peça em carga fechada | `Cancelamento bloqueado: etiqueta vinculada a carga fechada ou estado que impede estorno.` |

### 🔎 Observação
O filtro de produto é **hardcoded** com quatro cortes fixos. Se o catálogo mudar, o filtro fica
desatualizado — **GAP-046** (UX/dados, severidade Média).

### Critérios de aprovação
Rastreabilidade parte → TZ visível; bloqueios funcionando.

---

# M16 — Estoque

## Jornada: Consultar a posição de estoque e destinar item a pedido

### ID
`JRN-EST-001`

### Objetivo
Consumir estoque físico para atender pedidos (prioridade físico → virtual).

### Perfil do usuário
`estoque`, `gestor`, `administrador`.

### Ponto inicial
Menu → **ESTOQUE** → **Consulta de Estoque** (`/estoque/consulta`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Consulta de Estoque**, subtítulo `Posição física de itens disponíveis, reservados ou destinados`; abas **Consulta de Estoque** e **Sobras & Congelamento** |
| 2 | Conferir os status | **Disponível**, **Destinado a pedido**, **Em desossa**, **Bloqueado por ocorrência** |
| 3 | Conferir os tipos | **Peça inteira**, **Parte de desossa**, **Caixa por unidade** |
| 4 | Localizar item com badge **Estoque anterior** | Tooltip: `Item recebido em dia anterior — consumido antes pela regra FIFO` |
| 5 | Clicar **Destinar** | Modal **Destinar item a pedido** com **Quantidade a destinar** e **Pedidos compatíveis** |
| 6 | Escolher o pedido e **Confirmar destinação** | Item vira **Destinado a pedido** |
| 7 | Clicar **Limpar** | Filtros resetados |

### Efeitos colaterais
- Item do pedido de venda progride.
- Histórico do item registra a movimentação.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-EST-001-A1` | Aba **Sobras & Congelamento** | Badge **Provisório P3**; botão **Autorizar Congelamento** **desabilitado** |
| `JRN-EST-001-A2` | **Decidir Destino** de uma sobra | Fluxo de decisão |
| `JRN-EST-001-A3` | **Apontar Quebra / Descarte** | Encaminha para ajuste |
| `JRN-EST-001-A4` | Consultar o histórico do item | `GET /estoque/{tipo}/{id}/historico` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EST-001-N1` | Filtro sem resultado | **Nenhum item encontrado com os filtros selecionados.** |
| `JRN-EST-001-N2` | Sem sobras | **Nenhuma sobra crítica no momento.** |
| `JRN-EST-001-N3` | Sem pedido compatível | **Não há pedidos pendentes compatíveis com este produto.** |
| `JRN-EST-001-N4` | Destinar item indisponível | `ITEM_NAO_DISPONIVEL` |
| `JRN-EST-001-N5` | Destinar a item de pedido já completo | `ITEM_DO_PEDIDO_COMPLETO` |
| `JRN-EST-001-N6` | Quantidade acima do saldo | `SALDO_INSUFICIENTE` |
| `JRN-EST-001-N7` | Produto incompatível | `ITEM_INCOMPATIVEL` |

### 🔎 Gaps identificados

- **GAP-047 (funcional, Média):** o filtro **Reservado** existe na UI (herança do protótipo) mas **nunca
  retorna resultados** — não há status correspondente no backend.
- **GAP-048 (funcional, Média):** **Autorizar Congelamento** está permanentemente desabilitado (pendência **P3**).

### Permissões
Ler: `ESTOQUE_LER`. Destinar: `ESTOQUE_GERENCIAR`.

### Critérios de aprovação
Destinação funcional com os 4 códigos de erro exercitados; gaps confirmados.

### Evidências recomendadas
Print da consulta com badge **Estoque anterior**; print do modal de destinação.

---

## Jornada: Registrar entrada de caixaria

### ID
`JRN-EST-002`

### Objetivo
Entrar itens que **não passam por balança** (v1.1 — caixaria vendida por unidade).

### Perfil do usuário
`estoque`, `recebimento`, `administrador` (`ESTOQUE_ENTRADA`).

### Ponto inicial
Menu → **ESTOQUE** → **Entrada de Itens** (`/estoque/entrada-itens`)

### Dados necessários

| Label | id | Valor |
|---|---|---|
| **Produto** | `produto-entrada` | um produto caixaria |
| **Quantidade** | `qtd-entrada` | `20` |
| **Unidade** | `unidade-entrada` | `Caixa` |
| **Fornecedor/origem** | `fornecedor-entrada` | `Frigorífico Homologação A LTDA` |
| **Lote/NF** | `lote-entrada` | `NF 129110 / Lote 404` |
| **Local/câmara** | `local-entrada` | `Câmara 1` |
| **Destino** (chips) | — | `Estoque` |
| **Observação** | `obs-entrada` | — |

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Entrada de Itens**, subtítulo `Registro de entrada de itens que não passam por balança`; hint `Caixarias são vendidas por unidade; não passam por balança nem desossa.` |
| 2 | Preencher os campos | — | 
| 3 | Clicar **Confirmar entrada** | **Entrada registrada com sucesso.** |
| 4 | Conferir em `/estoque/consulta` | Item tipo **Caixa por unidade**, status **Disponível** |

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-EST-002-A1` | Unidade `Unidade` em vez de `Caixa` | Aceito |
| `JRN-EST-002-A2` | Destino `Pedido` | Vincula direto ao pedido |
| `JRN-EST-002-A3` | Local `Câmara 2` ou `Túnel` | Aceito |
| `JRN-EST-002-A4` | Clicar **Limpar** | Formulário resetado |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EST-002-N1` | Produto que **não é caixaria** | `PRODUTO_NAO_E_CAIXARIA` |
| `JRN-EST-002-N2` | Quantidade `0` ou negativa | Bloqueado |
| `JRN-EST-002-N3` | Sem produto | Bloqueado |
| `JRN-EST-002-N4` | Sem `ESTOQUE_ENTRADA` | `403` |

### Critérios de aprovação
Entrada registrada e visível na consulta com o tipo correto.

---

## Jornada: Ajuste de estoque com aprovação (segregação de funções)

### ID
`JRN-EST-003`

### Objetivo
**Jornada de controle interno.** Provar a segregação criador × aprovador.

### Perfil do usuário
Solicitante: `estoque` (`ESTOQUE_AJUSTAR`). Aprovador: `gestor`/`administrador` (`ESTOQUE_AJUSTE_APROVAR`).

### Ponto inicial
Menu → **ESTOQUE** → **Ajustes de Estoque** (`/estoque/ajustes`)

### Passo a passo

| Passo | Usuário | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | estoque | Abrir a tela | — | Título **Ajustes de Estoque**, subtítulo `Ajuste controlado de saldo físico, com aprovação quando necessário` |
| 2 | estoque | Criar um ajuste com motivo | `Quebra` | Motivos: **Quebra**, **Perda**, **Erro de contagem**, **Vencimento**, **Outro** |
| 3 | estoque | Salvar | — | **Ajuste registrado com sucesso.**; status **Aguardando aprovação** |
| 4 | estoque | Tentar aprovar o **próprio** ajuste | — | `SEGREGACAO_CRIADOR_APROVADOR` |
| 5 | gestor | Abrir o ajuste e clicar aprovar | — | Modal **Aprovar ajuste de estoque** com `Ao aprovar, o ajuste será aplicado ao saldo físico do item.` |
| 6 | gestor | Clicar **Confirmar aprovação** | — | Status **Aplicado**; saldo alterado |

### Fluxo de rejeição

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 7 | gestor | Em outro ajuste, clicar rejeitar | — | Modal **Rejeitar ajuste de estoque** com `Ao rejeitar, o ajuste não será aplicado e o saldo físico permanece inalterado.` |
| 8 | gestor | Preencher **Motivo da rejeição** | mínimo 5 caracteres (`Mín. 5 caracteres`) | — |
| 9 | gestor | Clicar **Confirmar rejeição** | — | Status **Rejeitado**; saldo intacto |

### Status
**Aplicado** · **Aguardando aprovação** · **Rejeitado**

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EST-003-N1` | Aprovar o próprio ajuste | `SEGREGACAO_CRIADOR_APROVADOR` — **teste obrigatório de SF** |
| `JRN-EST-003-N2` | Aprovar ajuste já decidido | `AJUSTE_NAO_PENDENTE` |
| `JRN-EST-003-N3` | Ajuste inválido para peça | `AJUSTE_INVALIDO_PARA_PECA` |
| `JRN-EST-003-N4` | Rejeitar com motivo curto | Bloqueado |
| `JRN-EST-003-N5` | Aprovar sem `ESTOQUE_AJUSTE_APROVAR` | `403` |

### Critérios de aprovação
Segregação criador × aprovador comprovada; saldo só muda na aprovação.

### Evidências recomendadas
Print do erro `SEGREGACAO_CRIADOR_APROVADOR` e dos dois modais de decisão.

---

# M17 — Aprovações Operacionais

## Jornada: Decidir uma solicitação de aprovação operacional

### ID
`JRN-APR-001`

### Objetivo
Fechar o ciclo de exceções operacionais que exigem autorização da gestão.

### Perfil do usuário
`gestor`, `administrador` (`APROVACOES_DECIDIR`).

### Pré-condições
Uma solicitação gerada (ex.: `JRN-DES-003`).

### Ponto inicial
Menu → **GESTÃO** → **Aprovações & Ocorrências** → aba **Aprovações Operacionais**

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir a aba | — | Lista de solicitações **Pendente** com `Impacto:` |
| 2 | Selecionar a solicitação | — | Detalhe |
| 3 | Clicar **Aprovar solicitação** | — | Modal **Aprovar solicitação** |
| 4 | Preencher **Motivo** (`#motivo-decisao`) | mínimo 10 caracteres (`Mín. 10 caracteres`) | — |
| 5 | Clicar **Confirmar** | — | Status **Aprovada** |

### Tipos de aprovação
**Divergência de transformação** · **Estorno fora da regra** · **Reabertura de carga/pedido** ·
**Ajuste de estoque relevante** · **Pendência física de etiqueta**

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-APR-001-A1` | **Rejeitar solicitação** | Modal **Rejeitar solicitação**; status **Rejeitada** |
| `JRN-APR-001-A2` | Exercitar os 5 tipos | Todos decidíveis |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-APR-001-N1` | Motivo com menos de 10 caracteres | Bloqueado |
| `JRN-APR-001-N2` | Decidir solicitação já decidida | `409` |
| `JRN-APR-001-N3` | Decidir sem `APROVACOES_DECIDIR` | Botões ausentes; API `403` |
| `JRN-APR-001-N4` | Solicitante tentando aprovar a própria solicitação | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: não foi localizada trava de segregação aqui (diferente do ajuste de estoque) — **GAP-049** |

### Permissões
Listar: `APROVACOES_LER`. Solicitar: `APROVACOES_SOLICITAR`. Decidir: `APROVACOES_DECIDIR`.

### Critérios de aprovação
Decisão registrada com motivo; GAP-049 verificado.

### Evidências recomendadas
Print do modal de decisão e da solicitação decidida.
