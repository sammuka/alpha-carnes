# 03d — Jornadas Operacionais (Parte 4: Expedição, Faturamento e Gestão)

> Continuação de [`03c-jornadas-recebimento-producao.md`](03c-jornadas-recebimento-producao.md).
> Módulos: **M18 Expedição/Carga** · **M19 Faturamento & NFS-e** · **M20 Seguro** ·
> **M21 Liberação do Caminhão** · **M22 Painel Geral** · **M23 Relatórios SIF**.
>
> Aqui o dia se fecha: a peça etiquetada entra na carga, a carga é conferida, enviada ao faturamento,
> a NFS-e é emitida no EISS Osasco e o caminhão só sai quando o **checklist calculado** estiver 100%.

---

# M18 — Expedição / Carga

> **Ciclo de status do caminhão (matriz `TRANSICOES`):**
> `planejado → aguardando_carga → em_carga → em_conferencia → fechado → liberado_faturamento →`
> `faturado → liberado_saida → expedido`.
> Retornos permitidos: `em_conferencia → em_carga` e `fechado → em_carga` (reabertura autorizada).

## Rótulos de status (importante para o homologador)

| Código no banco | Rótulo na tela |
|---|---|
| `planejado` / `aguardando_carga` / `em_carga` | **Montando** |
| `em_conferencia` | **Em Conferência** |
| `fechado` | **Conferida** |
| `liberado_faturamento` | **Enviada para Faturamento** |
| `faturado` | **Faturada** |
| `liberado_saida` | **Liberada para Saída** |
| `expedido` | **Expedida** |

> 🔎 **GAP-050 (UX, Média):** três status distintos (`planejado`, `aguardando_carga`, `em_carga`) exibem o
> mesmo rótulo **Montando**. O usuário não distingue "criado" de "carga aberta", o que dificulta o
> diagnóstico quando o botão **Enviar para conferência** não funciona.

---

## Jornada: Montar carga e alocar pedidos ao caminhão

### ID
`JRN-EXP-001`

### Objetivo
Vincular os pedidos finalizados do dia a um caminhão, respeitando rota e capacidade.

### Perfil do usuário
`expedicao`, `gestor`, `administrador` (`EXPEDICAO_GERENCIAR`).

### Pré-condições
- Pedidos **finalizados** na data (`JRN-PVD-002`).
- Caminhão na frota (`JRN-CAD-008`) e motorista (`JRN-CAD-009`), ou uso de placa avulsa.

### Dados necessários

| Label | id | Valor |
|---|---|---|
| **Caminhão da frota** | `frota-caminhao` | `ABC1D23 · 8000 kg` (ou `Avulso (placa manual)`) |
| **Placa** | `placa` | `ABC1D23` (obrigatório se avulso) |
| **Motorista** | `motorista` | `João da Silva` (obrigatório) |
| **Rota** | `rota` | `Rota Zona Oeste` |

### Ponto inicial
Menu → **CARGA** → **Planejamento de Carga** (`/carga/planejamento`)

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Planejamento | Abrir a tela | — | Título **Planejamento de Expedição**, subtítulo `Montagem de carga e vínculo Pedido → Caminhão antes da operação` |
| 2 | Planejamento | Conferir a lista da esquerda | — | Pedidos com pill **S/ Caminhão** e **Prioridade ALTA/MÉDIA/BAIXA**, agrupados por rota (sem rota → `Sem rota`) |
| 3 | Planejamento | Preencher o form de novo caminhão | ver tabela | — |
| 4 | Planejamento | Clicar **Novo Caminhão** | — | Caminhão criado com status **Montando**; contador `1 Caminhão` |
| 5 | Planejamento | Num pedido, clicar **Alocar** | — | Modal **Alocar pedido a um caminhão** com `{nomeCliente} · {pedidoId}… · {rota}` |
| 6 | Modal | Escolher o caminhão | — | Pedido vinculado; sai da lista de não alocados |
| 7 | Planejamento | Conferir a ocupação | — | `{ocupacao}% ocupado` |
| 8 | Planejamento | Clicar **Abrir carga** | — | Caminhão em condição de receber peças (`em_carga`) |
| 9 | Planejamento | Após bipar/adicionar peças, clicar **Enviar para conferência** | — | Status **Em Conferência** |

### Resultado final esperado
Caminhão em **Em Conferência** com todos os pedidos do dia alocados.

### Efeitos colaterais
- Pedidos deixam de aparecer como não alocados.
- Eventos WebSocket (`carga_item_adicionado`, `conferencia_concluida`, etc.) atualizam as telas abertas.

### Validações funcionais
- Prioridade: `>= 3` = **ALTA**, `= 2` = **MÉDIA**, `<= 1` = **BAIXA**.
- Caminhão avulso exige placa manual; caminhão da frota deve estar **ativo**.

### Validações visuais / UX
- Link **Itinerários** leva a `/cadastros/rotas`.
- Empty da esquerda: **Todos os pedidos do dia já foram alocados a um caminhão.**
- Empty da direita: **Nenhum caminhão montado ainda.**
- Empty do caminhão: **Nenhum pedido alocado. Use "Alocar" na lista à esquerda.**
- Estado pronto: **Pronto para conferência. Aguardando início da carga.**

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-EXP-001-A1` | Caminhão avulso (sem frota) | Placa manual obrigatória |
| `JRN-EXP-001-A2` | Vários caminhões no mesmo dia | Contador `{n} Caminhões` |
| `JRN-EXP-001-A3` | Transferir item entre caminhões | `POST /itens/:id/transferir` |
| `JRN-EXP-001-A4` | Remover item da carga | `POST /itens/:id/remover` |
| `JRN-EXP-001-A5` | Buscar pedido (`Buscar pedido…`) | Filtra |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EXP-001-N1` | Criar caminhão sem motorista | Bloqueado |
| `JRN-EXP-001-N2` | Criar avulso sem placa | Bloqueado |
| `JRN-EXP-001-N3` | Caminhão da frota inativo/inexistente | `FROTA_NAO_ENCONTRADA` — `Caminhão da frota não encontrado ou inativo` |
| `JRN-EXP-001-N4` | Vincular pedido **cancelado** | `Pedido cancelado não pode ser vinculado ao caminhão` |
| `JRN-EXP-001-N5` | Adicionar peça **sem etiqueta** | `Peça sem etiqueta não pode entrar na carga` |
| `JRN-EXP-001-N6` | Adicionar peça **sem vínculo de pedido** | `Peça sem vínculo de pedido não pode entrar na carga` |
| `JRN-EXP-001-N7` | Adicionar peça já em outra carga ativa | `Peça/subitem já está em outra carga ativa` |
| `JRN-EXP-001-N8` | Adicionar peça com o caminhão fora de `em_carga` | `Caminhão não está em estado de carga` |
| `JRN-EXP-001-N9` | Caminhão inexistente | `Caminhão não encontrado` |
| `JRN-EXP-001-N10` | Exceder a capacidade em kg | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: a ocupação passa de 100% sem bloqueio — **GAP-051** |
| `JRN-EXP-001-N11` | Backend fora do ar | `Falha ao carregar dados` / `Erro de conexão` |
| `JRN-EXP-001-N12` | Sem `EXPEDICAO_GERENCIAR` | Form e botões ausentes (só leitura) |

### Permissões
Ver: `EXPEDICAO_LER` ou `EXPEDICAO_GERENCIAR` (senão redireciona para `/`). Agir: `EXPEDICAO_GERENCIAR`.

### Critérios de aprovação
Carga montada, ocupação calculada, seis validações de elegibilidade de peça exercitadas.

### Evidências recomendadas
Print do planejamento com pedidos alocados e ocupação; print de cada mensagem de elegibilidade.

---

## Jornada: Conferir a carga por bipagem

### ID
`JRN-EXP-002`

### Objetivo
**Jornada crítica.** Garantir que só sai o que foi conferido peça a peça.

### Perfil do usuário
`expedicao`, `gestor`, `administrador`.

### Pré-condições
Caminhão em **Em Conferência** com peças etiquetadas.

### Ponto inicial
Menu → **CARGA** → **Conferência** (`/carga/conferencia`)

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir a tela | — | Título **Conferência de Carga**, subtítulo `Bipagem de peças etiquetadas antes do envio ao faturamento`; PipelineBar com a etapa **Carga** |
| 2 | Buscar a carga | `Buscar por placa, cliente ou carga...` | Filtra |
| 3 | Selecionar a carga | — | KPIs: **Total de Pedidos**, **Peças Conferidas** (`{conferidas} / {total}`), **Divergências**, **Peso Conferido** |
| 4 | Bipar a etiqueta | `ETQ-00001` (placeholder `Bipar etiqueta (ETQ-XXXXX)...`) | **Peça conferida.** |
| 5 | Conferir a linha | — | Colunas **Etiqueta / Produto / Peso / Status**; status **Conferida** |
| 6 | Repetir para todas as peças | — | Contador chega a `{total} / {total}` |
| 7 | Clicar **Finalizar Conferência** | — | Carga vira **Conferida**; aviso `Carga conferida. Estornos simples bloqueados — alterações exigem reabertura autorizada pela gestão.` |
| 8 | Clicar **Enviar para Faturamento** | — | Navega para `/carga/enviar-faturamento` |

### Status dos itens
**Pendente** (`em_carga`) · **Conferida** (`conferido`) · **Divergente** (`divergente`) · **Removida** (`removido`)

### Resultado final esperado
Carga `fechado` com todos os itens conferidos, pronta para o faturamento.

### Efeitos colaterais
- Estornos de peça passam a ser bloqueados (`Peça já está em carga fechada — estorno bloqueado`).
- Eventos WebSocket atualizam o planejamento e o dashboard.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-EXP-002-A1` | **Leitura manual** (leitor indisponível) | Modal **Leitura manual — informe o motivo** com `Código digitado:` e **Motivo** (`#motivo-leitura-manual`, placeholder `Ex.: leitor indisponível, etiqueta danificada...`); ao confirmar: `{codigo} conferida.` |
| `JRN-EXP-002-A2` | Bipar peças de vários pedidos | Accordion por pedido: `Pedido {id}… · {conferidas} / {total} peças · {n} divergente(s)` |
| `JRN-EXP-002-A3` | Finalizar com faltas usando `forcado=true` | Exige justificativa |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EXP-002-N1` | Bipar etiqueta que não pertence à carga | **Etiqueta não encontrada nesta carga.** / `Item não está vinculado a esta carga (excedente)` |
| `JRN-EXP-002-N2` | Bipar a mesma etiqueta duas vezes | `ITEM_NAO_PENDENTE` — `Item já foi conferido ou tratado` |
| `JRN-EXP-002-N3` | Leitura manual sem motivo | `Conferência manual exige código e motivo` |
| `JRN-EXP-002-N4` | Leitura manual sem permissão | `Sem permissão LEITURA_MANUAL para conferência manual` |
| `JRN-EXP-002-N5` | Conferir com o caminhão fora de `em_conferencia` | `Caminhão não está em conferência` |
| `JRN-EXP-002-N6` | Registrar item sem conferência ativa | `Nenhuma conferência ativa para este caminhão` |
| `JRN-EXP-002-N7` | Finalizar com faltas sem forçar | `Conferência possui faltas. Use forcado=true com justificativa para forçar o fechamento` |
| `JRN-EXP-002-N8` | Nenhuma carga selecionada | **Selecione uma carga para ver os detalhes.** |
| `JRN-EXP-002-N9` | Falha de rede na bipagem | `Falha na bipagem automática` / `Falha na conferência manual` |

### Permissões
`EXPEDICAO_GERENCIAR` para conferir e finalizar; `LEITURA_MANUAL` para o modo manual.

### Critérios de aprovação
Contagem exata, bloqueio de duplicidade e de excedente, leitura manual auditada.

### Evidências recomendadas
Print dos KPIs com 100% conferido; print do modal de leitura manual; print do aviso de bloqueio pós-conferência.

---

## Jornada: Marcar divergência na conferência

### ID
`JRN-EXP-003`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Numa peça, clicar **Marcar divergência** | — | Modal **Marcar divergência na peça** com `Etiqueta:`, `Produto:`, `Peso previsto:` |
| 2 | Selecionar **Motivo** (`#motivo-divergencia`) | `Peça ausente` | Opções: `Selecionar...`, **Peça ausente**, **Peça errada**, **Peso divergente**, **Etiqueta ilegível**, **Avaria**, **Outro** |
| 3 | Preencher **Observação** (`#obs-divergencia`) | — | — |
| 4 | Clicar **Confirmar Divergência** | — | Item vira **Divergente**; KPI **Divergências** incrementa |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EXP-003-N1` | Confirmar sem motivo | Bloqueado |
| `JRN-EXP-003-N2` | Clicar **Voltar** | Nada persistido |
| `JRN-EXP-003-N3` | Falha de rede | `Falha ao registrar divergência` |

### Critérios de aprovação
Divergência registrada e refletida no KPI e no accordion do pedido.

---

## Jornada: Reabrir carga fechada

### ID
`JRN-EXP-004`

### Objetivo
Provar o marco de fechamento: depois de fechada, só reabertura autorizada altera a carga.

### Perfil do usuário
`gestor`, `administrador` (`EXPEDICAO_REABRIR`).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Com a carga **Conferida**, executar `POST /caminhoes/:id/reabrir` | Volta a `em_carga` |
| 2 | Conferir a auditoria | Evento registrado |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EXP-004-N1` | Reabrir carga que não está `fechado` | `Reabertura só permitida de 'fechado'. Status atual: {status}` |
| `JRN-EXP-004-N2` | Reabrir carga **com NFS-e emitida** | `Reabertura bloqueada: caminhão possui NFS-e emitida` |
| `JRN-EXP-004-N3` | Reabrir sem `EXPEDICAO_REABRIR` | `403` |

### 🔎 Gap
**GAP-052 (UX, Média):** a reabertura **não tem botão na UI** — só existe via API, apesar de o texto da tela
mencionar "reabertura autorizada pela gestão". O gestor não tem caminho pela interface.

### Critérios de aprovação
Dois bloqueios comprovados; GAP-052 confirmado.

---

## Jornada: Enviar carga para o faturamento

### ID
`JRN-EXP-005`

### Objetivo
Executar o marco de transição entre a operação e o fiscal.

### Perfil do usuário
`expedicao`, `faturamento`, `gestor`, `administrador`.

### Ponto inicial
Menu → **CARGA** → **Enviar para Faturamento** (`/carga/enviar-faturamento`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Enviar para Faturamento**, subtítulo `Cargas conferidas são liberadas para o faturamento consolidar e emitir a NFS-e.` |
| 2 | Filtrar por **Conferida** | Chips: **Todas**, **Em Conferência**, **Conferida**, **Enviada para Faturamento**, **Faturada** |
| 3 | Selecionar a carga | Detalhe |
| 4 | Ler o aviso | `Ao enviar para faturamento, a carga entra no marco de fechamento: estornos simples deixam de ocorrer e qualquer alteração exige reabertura autorizada pela gestão.` |
| 5 | Clicar **Enviar para Faturamento** | Status vira **Enviada para Faturamento**; lock `Carga já enviada ao faturamento.` + `Enviada em {data} por {responsável}.` |
| 6 | Conferir **Histórico de Envios** | Colunas **Carga / Placa / Status / Data/Hora / Responsável / Observação** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-EXP-005-N1` | Enviar carga ainda **Em Conferência** | Botão desabilitado com o title `Somente cargas com status Conferida podem ser enviadas ao faturamento.` + info `Esta carga ainda está em conferência. Finalize a bipagem das peças na tela de Conferência de Carga antes de enviar para faturamento.` |
| `JRN-EXP-005-N2` | Enviar carga já enviada | Lock exibido, botão bloqueado |
| `JRN-EXP-005-N3` | Filtro sem resultado | **Nenhuma carga encontrada com este filtro.** |
| `JRN-EXP-005-N4` | Nenhuma carga selecionada | **Selecione uma carga para visualizar os detalhes.** |
| `JRN-EXP-005-N5` | Sem envios | **Nenhum envio registrado ainda.** |

### 🔎 Observação
A coluna **Observação** do histórico exibe sempre `—` — não há campo para justificar o envio. **GAP-053** (Baixa).

### Permissões
Ver: `EXPEDICAO_LER` ou `EXPEDICAO_GERENCIAR` ou `FATURAMENTO_LER`. Enviar: `EXPEDICAO_GERENCIAR` ou `FATURAMENTO_GERENCIAR`.

### Critérios de aprovação
Marco de fechamento aplicado e histórico registrado.

---

# M19 — Faturamento & NFS-e

> **Contexto (ADR-011):** a emissão usa o gateway **EISS Osasco-SP** via SOAP, isolado atrás de uma porta.
> Em homologação use `NFSE_FAKE=1` — o fake é **determinístico** e tem **valores-gatilho** que permitem
> provocar erros sem tocar o EISS real.

## Valores-gatilho do fake (essenciais para os cenários negativos)

| Valor informado | Comportamento do fake |
|---|---|
| qualquer outro | Sucesso: `numeroNota = FAKE-001`, `codigoVerificacao = FAKECODE123` |
| `999.99` | Erro de negócio: `Atividade não autorizada` (sem exceção) |
| `888.88` | Erro de transporte: `Timeout simulado (valor gatilho 888.88)` |

Cenários mutáveis do fake: `sucesso`, `erro_negocio` (`CNPJ do tomador inválido.`),
`timeout` (`Timeout na comunicação com EISS`), `http500` (`Internal Server Error (HTTP 500) no EISS`).

---

## Jornada: Consolidar o faturamento da carga

### ID
`JRN-FAT-001`

### Objetivo
Reunir os pedidos da carga para emissão, evidenciando bloqueios fiscais.

### Perfil do usuário
`faturamento`, `gestor`, `administrador`.

### Pré-condições
Carga em **Conferida** ou **Enviada para Faturamento** (`JRN-EXP-005`).

### Ponto inicial
Menu → **FATURAMENTO** → **Pré-Faturamento** (`/faturamento/pre-faturamento`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Pré-Faturamento**; badge de ambiente **Homologação EISS** ou **Produção EISS** |
| 2 | Conferir o pipeline | **Aberto** → **Fechado** → **Faturado** |
| 3 | Escolher o caminhão do dia (ou informar **ID do Caminhão** em `#caminhao-id`, placeholder `UUID do caminhão`) | — |
| 4 | Clicar **Consolidar** | `Consolidando…` → **Pedidos consolidados** |
| 5 | Conferir os KPIs | **Pedidos na carga** (`para faturamento`), **Preparados** (`aguardando envio`), **Autorizados** (`nota emitida`), **Com erro** (`aguardando reprocessamento`), **Valor total da carga** (`notas emitidas`) |
| 6 | Se houver bloqueios | Painel **Bloqueios ativos — dados fiscais incompletos ({n})** com `Causa:`, `Impacto:`, `Ação:` e `[{codigo}]` |
| 7 | Se a carga ainda não foi liberada, clicar **Liberar para Faturamento** | `Liberando…` → status atualizado |

### Bloqueios possíveis (códigos e textos exatos)

| Código | Causa | Impacto | Ação |
|---|---|---|---|
| `EXPEDICAO_NAO_FECHADA` | Expedição com status '{status}' em vez de 'fechado' | Não é possível faturar carga em aberto | Feche a expedição antes de faturar |
| `DIVERGENCIA_CRITICA_NAO_TRATADA` | Há divergência crítica de recebimento não resolvida | Faturamento com divergência não documentada é irregular | Resolva as divergências críticas antes de faturar |
| `DADOS_FISCAIS_INCOMPLETOS` | Cliente não possui documento fiscal válido (CNPJ/CPF) | NFS-e exige documento fiscal do tomador | Complete os dados fiscais do cliente no cadastro |
| `PECA_SEM_RASTREABILIDADE` | Há peça(s) na carga sem pedido associado | Rastreabilidade NF↔pedido↔peça não pode ser garantida | Associe todas as peças a pedidos antes de faturar |

### Status de faturamento
`em_consolidacao` · `pronto_para_emitir` · `parcialmente_emitido` · `concluido`
🔎 Exibidos **crus** na tela (com `_` trocado por espaço) — **GAP-054** (UX, Baixa).

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-FAT-001-N1` | Nenhum caminhão elegível | **Nenhum caminhão elegível para faturamento hoje** + `Caminhões aparecem aqui após fechamento da expedição. Use o ID abaixo para consolidar manualmente, se necessário.` |
| `JRN-FAT-001-N2` | Consolidar carga em aberto | `EXPEDICAO_NAO_FECHADA` |
| `JRN-FAT-001-N3` | Cliente sem CNPJ/CPF válido | `DADOS_FISCAIS_INCOMPLETOS` — **provocar propositalmente** criando um cliente sem documento |
| `JRN-FAT-001-N4` | Divergência crítica em aberto | `DIVERGENCIA_CRITICA_NAO_TRATADA` |
| `JRN-FAT-001-N5` | Peça sem pedido na carga | `PECA_SEM_RASTREABILIDADE` |
| `JRN-FAT-001-N6` | Falha de rede | `Falha ao consolidar` / `Falha ao liberar faturamento` |
| `JRN-FAT-001-N7` | Sem pedidos consolidados | **Nenhum pedido consolidado para este caminhão.** |

### 🔎 Gap
**GAP-055 (permissão, Alta):** a `page.tsx` do Pré-Faturamento **não faz checagem RBAC** — qualquer usuário
autenticado abre a tela; a proteção é só de API. Diferente das demais telas, que redirecionam ou exibem
mensagem. Confirmar se é intencional.

### Permissões
`FATURAMENTO_LER` para consolidar/ler; `FATURAMENTO_GERENCIAR` para liberar.

### Critérios de aprovação
Os quatro bloqueios exercitados com texto correto; consolidação válida.

### Evidências recomendadas
Print do painel de bloqueios com cada código; print dos KPIs consolidados.

---

## Jornada: Emitir NFS-e

### ID
`JRN-FAT-002`

### Objetivo
**Jornada crítica de integração.** Emitir a nota no EISS Osasco (fake em homologação).

### Perfil do usuário
`faturamento`, `administrador` (`NFSE_EMITIR`).

### Pré-condições
- Consolidação sem bloqueios (`JRN-FAT-001`).
- `NFSE_FAKE=1`.

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | No pedido consolidado, preencher **Valor (R$)** (`#valor-{pedidoVendaId}`) | `1500,00` (placeholder `0,00`) | — |
| 2 | Clicar **Emitir NFS-e** | — | `Emitindo…` |
| 3 | Aguardar o retorno | — | Card exibe `NFS-e nº FAKE-001`, `Cód. verificação: FAKECODE123`, `Valor: R$`, `Alíquota:`, `{n} tentativa(s)` |
| 4 | Clicar **Ver NFS-e** | — | Abre o link externo |
| 5 | Abrir `/faturamento/notas-xml` | — | Nota com pill **Autorizada** |

### Resultado final esperado
Nota `emitida`, vinculada ao pedido e à carga; caminhão avança para **Faturada**.

### Efeitos colaterais
- Reabertura da carga passa a ser bloqueada (`JRN-EXP-004-N2`).
- Checklist de liberação: **NF-e(s) autorizadas** fica OK.
- Painel Geral: **Faturamentos pendentes** decresce.

### Transições da NFS-e

| De | Para |
|---|---|
| `pendente` | `emitida` ou `erro_emissao` |
| `emitida` | `cancelada` ou `erro_cancelamento` |
| `erro_emissao` | `pendente` (reprocessamento) |
| `cancelada` | terminal |
| `erro_cancelamento` | `cancelada` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-FAT-002-N1` | Valor `0` ou vazio | **Informe um valor maior que zero.** |
| `JRN-FAT-002-N2` | Valor `999.99` | Erro de negócio do EISS: `Atividade não autorizada`; nota em `erro_emissao` |
| `JRN-FAT-002-N3` | Valor `888.88` | Erro de transporte: `Timeout simulado (valor gatilho 888.88)`; a operação **não pode** ficar em estado inconsistente |
| `JRN-FAT-002-N4` | Emitir sem consolidar | `Consolidação necessária antes de emitir` |
| `JRN-FAT-002-N5` | Emitir com a carga não fechada | `Emissão só para caminhão 'fechado'. Status: {status}` |
| `JRN-FAT-002-N6` | Emitir com bloqueios ativos | `Emissão bloqueada por pendências críticas` (com a lista) |
| `JRN-FAT-002-N7` | Parâmetros RTC incompletos | `RTC_PARAMETROS_INCOMPLETOS` — `Parâmetros RTC incompletos — configure faturamento.rtc_* antes de emitir` |
| `JRN-FAT-002-N8` | Emitir duas vezes para o mesmo pedido | `Pedido já possui NFS-e em emissão ou emitida` |
| `JRN-FAT-002-N9` | Emitir sem `NFSE_EMITIR` | `403` |
| `JRN-FAT-002-N10` | Duplo clique em **Emitir NFS-e** | Uma única nota |

### ⚠️ Regra a confirmar
O **valor é digitado manualmente** na tela — não vem da tabela de preços publicada (`JRN-PRC-004`) nem de
cálculo por peso × preço. Isso é um risco fiscal e comercial relevante: **GAP-041** (já registrado) e
**GAP-056** (ausência de cálculo automático peso × preço).

### Critérios de aprovação
Emissão bem-sucedida com o fake; os dois valores-gatilho exercitados sem corromper estado.

### Evidências recomendadas
Print da nota `FAKE-001` emitida; print do erro `Atividade não autorizada`; print do timeout.

---

## Jornada: Reprocessar e cancelar NFS-e

### ID
`JRN-FAT-003`

### Objetivo
Cobrir a recuperação de erro e o cancelamento antes da liberação do caminhão.

### Passo a passo — reprocessar

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Numa nota com pill **Erro**, clicar **Reprocessar** | `Reprocessando…`; nota volta a `pendente` e é reenviada |
| 2 | Conferir o contador | `{n} tentativa(s)` incrementa |

### Passo a passo — cancelar

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 3 | Numa nota **Autorizada**, clicar **Cancelar** | — | Campo **Motivo do cancelamento** (`#motivo-cancelar-{notaId}`, placeholder `Motivo auditável`) |
| 4 | Informar o motivo e confirmar | — | Nota vira **Cancelada** |

### Pelo `/faturamento/notas-xml`

| Passo | Ação | Resultado esperado |
|---|---|---|
| 5 | Abrir a tela | Título **Notas / XML**, subtítulo `Consulta das notas emitidas via integração EISS Osasco-SP.` |
| 6 | Conferir os KPIs | **Autorizadas hoje**, **Com erro**, **Aguardando retorno** |
| 7 | Filtrar | `Status: Todos`, **Autorizada**, **Erro**, **Processando**, **Cancelada** |
| 8 | Clicar em cancelar | Modal **Cancelar Nota {numero}** com `Pedido:`, `Cliente:`, `Valor:` |
| 9 | Escolher o motivo | **Pedido selecionado incorretamente** / **Peso/preço lançado incorretamente** / **Cliente incorreto** / **Solicitação do cliente** / **Outro** |
| 10 | Preencher **Observação** (`#obs-cancelamento-nota`) e clicar **Confirmar Cancelamento** | Nota cancelada |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-FAT-003-N1` | Cancelar nota de caminhão **já liberado** | Modal **Cancelamento bloqueado** — `O caminhão desta carga já foi liberado. Notas só podem ser canceladas antes da liberação do caminhão.` + botão **Entendi**; API: `NOTA_TRAVADA_CAMINHAO_LIBERADO` |
| `JRN-FAT-003-N2` | Cancelar sem motivo | **Informe o motivo do cancelamento da NFS-e.** |
| `JRN-FAT-003-N3` | Nota inexistente | `Nota fiscal não encontrada` |
| `JRN-FAT-003-N4` | Cancelar sem `NFSE_CANCELAR` | `403` |
| `JRN-FAT-003-N5` | Nenhuma nota nos filtros | **Nenhuma nota encontrada para os filtros atuais.** |
| `JRN-FAT-003-N6` | Baixar XML de nota pendente | Tooltip `Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS` |

### Critérios de aprovação
Reprocessamento recupera o erro; cancelamento respeita a trava da liberação.

### Evidências recomendadas
Print do modal **Cancelamento bloqueado**; print da nota cancelada.

---

## Jornada: Consultar a rastreabilidade da nota

### ID
`JRN-FAT-004`

### Objetivo
**Prova final de rastreabilidade ponta a ponta**: da NF de volta até a peça pesada.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Em `/faturamento/notas-xml`, clicar **Ver detalhe** | Drawer **Nota {numero}** |
| 2 | Conferir a seção | `Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal` |
| 3 | Conferir os campos | **Pedido**, **Cliente**, **Chave de verificação**, **Data/hora** |
| 4 | Conferir a seção **Peças** | Colunas **Etiqueta / Produto / Peso** e footer **Peso total** |
| 5 | Anotar um código de etiqueta e voltar até `/recebimento/etiquetas` | A mesma etiqueta aparece com a peça original |

### Resultado final esperado
Cadeia completa: NF → pedido → peça → etiqueta → recebimento → pedido ao fornecedor → compra programada.

### Validações funcionais
O **Peso total** do drawer deve bater com a soma dos pesos individuais das peças.

### Rodapé da tela
`Número, chave, XML e DANFE são obtidos do retorno da integração EISS Osasco-SP. Cancelamento de nota só é
permitido antes da liberação do caminhão.`

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-FAT-004-N1` | Nota sem peças vinculadas | Lista vazia sem erro |
| `JRN-FAT-004-N2` | **Baixar XML** / **Ver DANFE** com link ausente | Ação desabilitada com tooltip explicativo |

### Critérios de aprovação
Rastreabilidade completa comprovada em ambos os sentidos.

### Evidências recomendadas
Print do drawer de rastreabilidade com peso total; print da mesma etiqueta na tela de recebimento.

---

# M20 — Seguro

## Jornada: Registrar e confirmar o seguro da carga

### ID
`JRN-SEG-001`

### Objetivo
Cumprir o requisito manual de seguro, que **bloqueia a liberação do caminhão**.

### Perfil do usuário
`faturamento`, `gestor`, `administrador` (`SEGURO_GERENCIAR`).

### Ponto inicial
Menu → **FATURAMENTO** → **Seguro Manual** (`/faturamento/seguro-manual`)

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir a tela | — | Título **Seguro Manual**, subtítulo `Controle manual do envio e confirmação do seguro por carga.`; info `O seguro é tratado manualmente — o sistema apenas registra o status.` |
| 2 | Conferir os KPIs | — | **Cargas com seguro** (`no total`), **Pendentes** (`ainda não enviados`), **Enviados** (`aguardando confirmação`), **Confirmados** (`seguro tratado`) |
| 3 | Localizar a carga | `Buscar placa, motorista...` | — |
| 4 | Preencher **Observação** (`#obs-seguro-{id}`) | `Averbação enviada à corretora` (placeholder `Observações sobre o seguro desta carga...`) | Persistido |
| 5 | Clicar **Anexar comprovante** | — | Modal **Anexar comprovante** com **Nome do arquivo** (`#anexo-nome-{id}`, placeholder `averbacao-centro-1130.pdf`) e **Descrição (opcional)** |
| 6 | Clicar **Anexar** | — | Comprovante registrado |
| 7 | Clicar **Marcar como enviado** | — | Status **Enviado** |
| 8 | Clicar **Marcar como confirmado** | — | Status **Confirmado**; badge **Seguro tratado** |

### Transições do seguro

| De | Para |
|---|---|
| `pendente` | `enviado` |
| `enviado` | `confirmado` ou `pendente` |
| `confirmado` | terminal |

### Rodapé
`O status do seguro é um dos requisitos para a liberação do caminhão. Cargas com seguro pendente bloqueiam
a liberação em "Liberação do Caminhão".`

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-SEG-001-A1` | Voltar de **Enviado** para **Pendente** | Permitido pela matriz |
| `JRN-SEG-001-A2` | Filtrar por status | `Status: Todos`, **Pendente**, **Enviado**, **Confirmado** |
| `JRN-SEG-001-A3` | Parâmetro que dispensa seguro | Checklist mostra `dispensado por parâmetro` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-SEG-001-N1` | Pular de **Pendente** direto para **Confirmado** | `TRANSICAO_SEGURO_INVALIDA` — `Transição inválida: pendente → confirmado` |
| `JRN-SEG-001-N2` | Alterar seguro já **Confirmado** | Bloqueado (estado terminal) |
| `JRN-SEG-001-N3` | Sem cargas nos filtros | **Nenhuma carga encontrada para os filtros atuais.** |
| `JRN-SEG-001-N4` | Falha de rede | `Falha ao alterar status` / `Falha ao anexar comprovante` / `Erro de conexão ao salvar observação` |
| `JRN-SEG-001-N5` | Sem `SEGURO_GERENCIAR` | Ações indisponíveis |

### 🔎 Gap
**GAP-057 (funcional, Média):** o "anexo" registra apenas **nome e descrição** — não há upload real de
arquivo. O comprovante de averbação não fica armazenado no sistema.

### Critérios de aprovação
Fluxo pendente → enviado → confirmado completo; transição inválida bloqueada; GAP-057 confirmado.

### Evidências recomendadas
Print dos três status; print do erro de transição inválida.

---

# M21 — Liberação do Caminhão

## Jornada: Liberar o caminhão pelo checklist calculado

### ID
`JRN-LIB-001`

### Objetivo
**Último portão do dia.** Provar que o caminhão só sai quando os quatro requisitos estiverem OK.

### Perfil do usuário
`faturamento`, `expedicao`, `gestor`, `administrador`.

### Pré-condições
- Carga conferida (`JRN-EXP-002`).
- NFS-e emitida (`JRN-FAT-002`).
- Seguro confirmado (`JRN-SEG-001`).
- Caminhão e motorista preenchidos (`JRN-EXP-001`).

### Ponto inicial
Menu → **FATURAMENTO** → **Liberação do Caminhão** (`/faturamento/liberacao`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Liberação do Caminhão**, subtítulo `Checklist calculado a partir do estado real da carga, notas fiscais e seguro. Libera apenas quando todos os requisitos estiverem OK.` |
| 2 | Conferir os KPIs | **Cargas no pátio** (`aguardando liberação`), **Liberáveis agora** (`todos os requisitos OK`), **Com pendência** (`requisitos incompletos`), **Liberadas** (`alterações bloqueadas`) |
| 3 | Selecionar a carga em **Caminhões no Pátio** | Pills: **Liberado** / **Liberável** / **Pendente** |
| 4 | Conferir **Requisitos para liberação** | Os quatro itens do checklist |
| 5 | Conferir **Notas fiscais desta carga** | Colunas **Nº nota / Status** |
| 6 | Clicar **Liberar Caminhão** | `Liberando…` → banner `Caminhão liberado por {nome} em {data}` + `Alterações operacionais bloqueadas para esta carga.` |

### O checklist (quatro requisitos)

| Requisito | Detalhe quando OK | Detalhe quando falha | Link de resolução |
|---|---|---|---|
| **Carga conferida** | Conferência concluída | Não conferida | **Resolver em Carga → Conferência** (`/carga/conferencia`) |
| **NF-e(s) autorizadas** | `{n} de {total}` | `{n} de {total}` | **Resolver em Notas / XML** (`/faturamento/notas-xml`) |
| **Seguro confirmado** | status ou `dispensado por parâmetro` | `pendente` | **Resolver em Seguro Manual** (`/faturamento/seguro-manual`) |
| **Caminhão/motorista preenchidos** | Completos | Incompletos | **Resolver em Cadastros → Caminhões** (`/cadastros/caminhoes`) |

### Resultado final esperado
Caminhão em `liberado_saida`; alterações operacionais e cancelamento de nota bloqueados.

### Efeitos colaterais
- Cancelamento de NFS-e passa a retornar `NOTA_TRAVADA_CAMINHAO_LIBERADO`.
- Notas / XML exibe o subtexto **Caminhão liberado**.

### Cenários negativos — **testar cada requisito isoladamente**

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-LIB-001-N1` | Liberar com a **carga não conferida** | `CHECKLIST_INCOMPLETO` — `Liberação bloqueada — checklist incompleto`; item vermelho + link |
| `JRN-LIB-001-N2` | Liberar com **NF pendente** | Bloqueado; `Liberação de saída exige faturamento concluído (todas as NFS-e emitidas)` |
| `JRN-LIB-001-N3` | Liberar com **seguro pendente** | Bloqueado; link para Seguro Manual |
| `JRN-LIB-001-N4` | Liberar com **motorista em branco** | Bloqueado; link para Cadastros → Caminhões |
| `JRN-LIB-001-N5` | Liberar caminhão já liberado | Botão vira **Já liberado**; banner `Liberado — alterações bloqueadas` |
| `JRN-LIB-001-N6` | Carga sem notas | **Nenhuma nota vinculada a esta carga.** |
| `JRN-LIB-001-N7` | Sem permissão | Botão indisponível |

### Permissões
`LIBERACAO_GERENCIAR` **ou** `FATURAMENTO_GERENCIAR` **ou** `EXPEDICAO_GERENCIAR`.

### Critérios de aprovação
**Os quatro requisitos bloqueiam individualmente** e cada link de resolução leva à tela certa.
Este é o teste de aceite mais importante do fim do dia.

### Evidências recomendadas
Quatro prints, um por requisito em falha; print do checklist 100% OK; print do banner de liberação.

---

# M22 — Painel Geral da Operação

## Jornada: Ler o Painel Geral e navegar pelos alertas

### ID
`JRN-DSH-001`

### Objetivo
Visão executiva do dia com atualização em tempo real.

### Perfil do usuário
`gestor`, `diretoria`, `administrador`, `comercial`, `compras`.

### Ponto inicial
Menu → **GESTÃO** → **Painel Geral da Operação** (`/gestao/dashboard`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Título **Painel Geral da Operação**, subtítulo `Visão executiva da compra, venda, disponibilidade e operação do dia` |
| 2 | Conferir os 10 KPIs | ver lista abaixo |
| 3 | Conferir a tabela de pedidos | Colunas **Pedido / Cliente / Produto / Corte / Peso (kg) / Status / Data** |
| 4 | Conferir os alertas operacionais | ver lista abaixo |
| 5 | Conferir as atividades recentes | Lista cronológica |
| 6 | Clicar **Atualizar** | Recarrega |

### Os 10 KPIs
1. **Compras programadas** · 2. **Disponibilidade física + virtual** · 3. **Reservas em elaboração** ·
4. **Pedidos finalizados** · 5. **Overbookings abertos** · 6. **Recebimentos aguardados** ·
7. **Divergências abertas** · 8. **Peças em desossa** · 9. **Relatórios SIF pendentes** ·
10. **Faturamentos pendentes**

### Alertas operacionais (textos exatos)

| Título | Descrição |
|---|---|
| **Overbooking em aberto** | `{n} pendência(s) com déficit de {qtd} aguardando decisão.` |
| **Divergência de recebimento** | `Lote {lote} — {n} divergência(s) encaminhada(s) ao administrativo.` |
| **TZ aguardando desossa** | `{n} peça(s) disponível(is) aguardando encaminhamento à desossa.` |
| **Seguro pendente** | `Caminhão {placa} faturado aguardando averbação manual de seguro para liberação de saída.` |

### Validação de tempo real
Com o painel aberto, execute em outra janela: confirmar uma compra, criar um overbooking, abrir uma
divergência e gerar um relatório SIF. Os KPIs correspondentes devem mudar **sem F5** (eventos
`compra_programada_confirmada`, `pendencia_overbooking_aberta`, `divergencia_recebimento_aberta`,
`relatorio_sif_gerado`).

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-DSH-001-N1` | Nenhuma operação cadastrada | **Nenhuma operação cadastrada** + `Cadastre ou gere a cadência de operações para visualizar os KPIs.` + botão **Ir para Operações** |
| `JRN-DSH-001-N2` | Backend indisponível | **Erro ao carregar dashboard** + **Tentar novamente** |
| `JRN-DSH-001-N3` | Dia sem pedidos | **Nenhum pedido em andamento no momento.** |
| `JRN-DSH-001-N4` | Sem alertas | **Nenhum alerta ativo no momento.** |
| `JRN-DSH-001-N5` | Sem atividades | **Nenhuma atividade recente registrada.** |
| `JRN-DSH-001-N6` | `operacaoId` inexistente | `OPERACAO_INEXISTENTE` |
| `JRN-DSH-001-N7` | Sem permissão | `Você não tem permissão para visualizar o dashboard operacional.` |

### Permissões
`COMPRAS_PROGRAMADAS_LER` **ou** `DISPONIBILIDADE_LER`.

### Critérios de aprovação
KPIs conferem com o estado real; os quatro alertas aparecem quando provocados; tempo real funcionando.

### Evidências recomendadas
Print do painel com os 10 KPIs e os 4 alertas ativos.

---

# M23 — Relatórios SIF

## Jornada: Gerar e retificar relatório SIF

### ID
`JRN-SIF-001`

### Objetivo
Cobrir a área regulatória — **com a ressalva de que os modelos oficiais ainda não existem (P8)**.

### Perfil do usuário
`administrativo`, `gestor`, `administrador` (`SIF_GERAR`).

### Ponto inicial
Menu → **GESTÃO** → **Relatórios & SIF** (`/gestao/relatorios`)

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir a tela | — | Título **Relatórios SIF**, subtítulo `Área de relatórios ligados ao Serviço de Inspeção Federal.`; badge **Provisório · P8** |
| 2 | Ler o aviso amarelo | — | `Modelos oficiais dos relatórios SIF pendentes de fornecimento pelo cliente. Nomes e campos abaixo são provisórios (demonstração).` |
| 3 | Conferir os KPIs | — | **Pendentes de dados**, **Prontos para gerar**, **Gerados/Retificados** |
| 4 | Conferir o catálogo | — | 4 relatórios (ver tabela) |
| 5 | Num relatório **Pronto para gerar**, clicar **Gerar** | — | Status vira **Gerado** |
| 6 | Clicar **Pré-visualizar** | — | Modal (ver negativo N3) |
| 7 | Clicar **Retificar** | — | Modal com **Motivo** (`#motivo-ret`, `Mín. 10 caracteres`) |
| 8 | Preencher e clicar **Retificar** | `Correção de peso do lote 404` | Status vira **Retificado** |
| 9 | Clicar **Histórico** | — | **Histórico de versões** com tipo **Gerado** / **Retificado** |

### Catálogo (nomes exatos)

| Código | Nome |
|---|---|
| SIF-01 | Mapa de recebimento diário (provisório) |
| SIF-02 | Relatório de produção/desossa (provisório) |
| SIF-03 | Controle de expedição (provisório) |
| SIF-04 | Relatório de perdas e destinação (provisório) |

### Status
**Pendente de dados** (`pendente_dados`) · **Pronto para gerar** (`pronto_para_gerar`) ·
**Gerado** (`gerado`) · **Retificado** (`retificado`)

### Efeitos colaterais
- Painel Geral: **Relatórios SIF pendentes** decresce.
- Evento `relatorio_sif_gerado` no WebSocket.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-SIF-001-N1` | Gerar relatório **Pendente de dados** | Botão com title `Resolva as pendências de dados antes de gerar` |
| `JRN-SIF-001-N2` | Retificar com motivo curto | Bloqueado (mín. 10 caracteres) |
| `JRN-SIF-001-N3` | Pré-visualizar | **Pré-visualização disponível após definição do modelo oficial** + `Este relatório está sendo demonstrado com nome e campos provisórios. A pré-visualização real do layout depende dos modelos oficiais do SIF fornecidos pelo cliente.` |
| `JRN-SIF-001-N4` | Histórico sem versões | **Nenhuma versão gerada ainda para este relatório.** |
| `JRN-SIF-001-N5` | Gerar sem `SIF_GERAR` | Botões ausentes; API `403` |

### ⚠️ Pendência aberta
**P8** — os quatro relatórios têm nomes e campos **provisórios**. O conteúdo gerado **não tem valor fiscal**
até que o cliente forneça os modelos oficiais. **Não homologar o conteúdo, apenas o fluxo.**

### Permissões
Ler: `SIF_LER`. Gerar/retificar: `SIF_GERAR`.

### Critérios de aprovação
Fluxo gerar → retificar → histórico funcional; badge P8 visível em todos os pontos.

### Evidências recomendadas
Print do aviso P8; print do histórico de versões com gerado e retificado.

---

# Nota final desta parte

## 🔎 GAP-058 — ausência de módulo de Notificações
Não existe tela de notificações no sistema. O único canal de aviso é o bloco de **alertas do Painel Geral**
e os eventos WebSocket que atualizam as telas abertas. Um operador que não estiver com a tela aberta
**não é notificado** de overbooking, divergência ou seguro pendente. Confirmar com o negócio se isso é
aceitável para a operação real.

## 🔎 GAP-059 — ausência de relatórios gerenciais
Além dos quatro relatórios SIF (provisórios), **não há relatórios gerenciais** (vendas por cliente, margem,
produtividade da desossa, ranking de representantes). A tela de Relatórios cobre apenas a dimensão
regulatória. Confirmar se está fora de escopo.
