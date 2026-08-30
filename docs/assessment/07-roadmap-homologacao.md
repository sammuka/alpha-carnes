# 07 — Roadmap de homologação assistida

> Sequência recomendada para executar os **644 cenários** do assessment. A ordem não é arbitrária: ela
> segue as dependências reais de dados do AlphaCarnes, de modo que cada fase produz os pré-requisitos da
> seguinte.
>
> **Regra de ouro:** não pule fases. Um cenário de venda executado sem a regra de desdobramento cadastrada
> produz falso negativo (GAP-029) e queima tempo de análise.

---

## Visão geral das fases

| Fase | Nome | Cenários | Esforço estimado | Pré-requisito |
|---|---|---:|---|---|
| **0** | Preparação do ambiente | — | 2 h | Docker Desktop |
| **1** | Fundação: acesso e administração | 62 | 1 dia | Fase 0 |
| **2** | Cadastros estruturantes | 96 | 2 dias | Fase 1 |
| **3** | Planejamento: operação e compra | 63 | 1,5 dia | Fase 2 |
| **4** | Comercial: disponibilidade, venda e overbooking | 130 | 3 dias | Fase 3 |
| **5** | Operação física: recebimento, pesagem e desossa | 156 | 3,5 dias | Fase 3 e 4 |
| **6** | Fechamento: carga, faturamento e liberação | 91 | 2,5 dias | Fase 5 |
| **7** | Transversais: painel, aprovações, relatórios, auditoria | 30 | 1 dia | Fases 1 a 6 |
| **8** | Jornada E2E | 6 | 1,5 dia | Todas |
| **9** | Permissões e segregação de funções | 17 | 1 dia | Fase 1 |
| **10** | Regressão dirigida | variável | 2 dias | Após correções |
| | **Total** | **644** | **≈ 19 dias úteis** | |

> O esforço supõe **um homologador em tempo integral** com apoio pontual do time técnico. Com duas pessoas
> em paralelo (uma no comercial, outra na operação física), cai para cerca de **12 dias úteis**.

---

# Fase 0 — Preparação do ambiente

**Objetivo:** garantir que o ambiente é confiável antes de gastar tempo interpretando resultados.

| # | Tarefa | Critério de pronto |
|---|---|---|
| 0.1 | `docker compose up --build -d` | `postgres`, `backend` e `frontend` saudáveis |
| 0.2 | Confirmar as portas | Frontend `4000`, backend `4001`, banco `15433` |
| 0.3 | Confirmar as flags | `HARDWARE_FAKE=1` e `NFSE_FAKE=1` no backend |
| 0.4 | Rodar migrations e seed | `npm run db:migrate` e `npm run db:seed` em `app/backend` |
| 0.5 | Validar o login inicial | `admin@alphacarnes.local` entra e vê o menu completo |
| 0.6 | Criar a estrutura de evidências | `evidencias/{fase}/{ID-do-cenario}/` |
| 0.7 | Preparar a planilha de controle | Uma linha por cenário, conforme [`04-matriz-testes.md`](04-matriz-testes.md) |
| 0.8 | Abrir duas janelas de navegador | Necessário para os testes de tempo real e concorrência |

> ⚠️ **Nunca homologue com `NFSE_FAKE=0`.** Emitiria nota real no EISS Osasco.

**Bloqueadores conhecidos:** se o seed não criar os 10 usuários não-admin, eles serão criados na Fase 1
pela própria UI (JRN-ADM-001) — isso é parte do teste, não um problema.

---

# Fase 1 — Fundação: acesso e administração

**Objetivo:** provar que o controle de acesso funciona e criar os usuários que todas as fases seguintes
vão usar.

| Ordem | Jornada | Por quê agora |
|---|---|---|
| 1.1 | JRN-AUTH-001, 002 | Sem login não há nada |
| 1.2 | **JRN-ADM-001** | **Gargalo do projeto:** cria os 10 usuários não-admin |
| 1.3 | JRN-ADM-002, 003 | Ciclo de vida e aprovação |
| 1.4 | JRN-AUTH-003, 004 | Menu por perfil e bloqueio de URL direta — só possível com os 10 usuários |
| 1.5 | JRN-ADM-005, 006 | Matriz de permissões e menus |
| 1.6 | JRN-ADM-007 | Parâmetros (inclusive `faturamento.rtc_*`, que a Fase 6 exige) |
| 1.7 | JRN-ADM-004 | Escopo de representantes (revisitar após a Fase 2, quando houver REP-A) |
| 1.8 | JRN-ADM-008 | Auditoria — reexecutar ao final de cada fase |

**Critério de saída:** 11 usuários ativos, cada um logando e vendo apenas o seu menu; nenhuma URL direta
permitindo ação sem permissão.

**Gaps a confirmar nesta fase:** GAP-001, 002, 003, 004, 006, 013.

---

# Fase 2 — Cadastros estruturantes

**Objetivo:** popular o catálogo. É a fase mais mecânica e a que mais economiza tempo depois.

**Ordem obrigatória** (há dependências entre eles):

| Ordem | Jornada | Cria | Depende de |
|---|---|---|---|
| 2.1 | JRN-CAD-000 | — (ficha mestra: padrão de CRUD) | — |
| 2.2 | JRN-CAD-001 | REP-A, REP-B | — |
| 2.3 | JRN-CAD-007 | ROTA-A com 2 paradas | — |
| 2.4 | JRN-CAD-002 | Produtos | — |
| 2.5 | JRN-CAD-003 | ICOMP-BOI (`BOI-CASADO`) | — |
| 2.6 | JRN-CAD-004 | TZ, DT, PA | — |
| 2.7 | **JRN-CAD-010** | **3 regras de desdobramento** | 2.5, 2.6 |
| 2.8 | JRN-CAD-011 | Regras de transformação (consulta) | 2.6 |
| 2.9 | JRN-CAD-005 | FORN-A, FORN-B | — |
| 2.10 | JRN-CAD-006 | CLI-A, CLI-B | 2.2, 2.3 |
| 2.11 | JRN-CAD-008 | CAM-A | — |
| 2.12 | JRN-CAD-009 | MOT-A | — |
| 2.13 | JRN-CAD-012 | Modelo de etiqueta | — |
| 2.14 | JRN-ADM-004 (revisita) | Escopo de REP-A no usuário comercial | 2.2, 2.10 |

> **2.7 é o passo mais importante da fase.** Sem as três regras (`BOI-CASADO → TZ ×2`, `→ DT ×2`,
> `→ PA ×2`), a Fase 3 confirma a compra e nada acontece, silenciosamente.

**Critério de saída:** os dados de teste padronizados de
[`03-jornadas-operacionais.md`](03-jornadas-operacionais.md) existem e estão ativos.

**Gaps a confirmar:** GAP-007, 008, 009, 014, 015, 016, 017, 021, 022, 023, 024, 025, 026.

---

# Fase 3 — Planejamento: operação e compra

**Objetivo:** provar que a **disponibilidade virtual nasce corretamente**. É aqui que a regra AD-01
(boi casado = 2 TZ + 2 DT + 2 PA) é validada.

| Ordem | Jornada | Marco |
|---|---|---|
| 3.1 | JRN-OPE-001 | Cadência gera os dias |
| 3.2 | JRN-OPE-002 | Operação extraordinária |
| 3.3 | JRN-OPE-004 | Consulta e filtros |
| 3.4 | JRN-CMP-001 | Compra em rascunho |
| 3.5 | **JRN-CMP-002** | **Confirmação gera 60 unidades** — o marco da fase |
| 3.6 | JRN-CMP-005 | Histórico |
| 3.7 | JRN-CMP-004 | Cancelamento (usar uma segunda compra descartável) |
| 3.8 | JRN-PRC-001, 003, 004, 005 | Tabela de preços |
| 3.9 | JRN-PRC-002 | Cópia (exige tabela de dia anterior) |
| 3.10 | JRN-OPE-003 | Ciclo de status — **deixar por último**, pois fechar a operação pode travar as fases seguintes |

> **Checkpoint da fase:** `/comercial/disponibilidade` → **Grade** deve mostrar **Total gerado 60**
> (TZ 20 · DT 20 · PA 20). Se vier zero, volte ao passo 2.7.
> `JRN-CMP-003` (edição com impacto) fica para a Fase 4, pois precisa de pedidos reservando saldo.

**Gaps a confirmar:** GAP-012, 019, 020, 027, 028, **029**, 032, 033, 041.

---

# Fase 4 — Comercial: disponibilidade, venda e overbooking

**Objetivo:** a fase de maior densidade de regra de negócio. Valida a reserva imediata, o tempo real e a
regra de overbooking (AD-05).

| Ordem | Jornada | Marco |
|---|---|---|
| 4.1 | JRN-DIS-001 | Leitura do saldo antes de qualquer venda |
| 4.2 | **JRN-PVD-001** | **Reserva imediata no rascunho** |
| 4.3 | **JRN-DIS-003** | **Tempo real** — precisa de duas janelas |
| 4.4 | JRN-PVD-004 | Inclusão de item |
| 4.5 | JRN-PVD-005 | Redução e remoção com devolução |
| 4.6 | JRN-PVD-006 | Adendo (AD-03) |
| 4.7 | JRN-PVD-002 | Finalização sem dupla redução |
| 4.8 | **JRN-PVD-003** | **Overbooking: challenge + confirmação** |
| 4.9 | JRN-OVB-001 | Fila do gestor |
| 4.10 | JRN-OVB-002, 003, 004, 005 | Os quatro caminhos de resolução — use **uma pendência por caminho** |
| 4.11 | JRN-PVD-008 | Liberação administrativa (AD-06) |
| 4.12 | JRN-PVD-007 | Cancelamento |
| 4.13 | JRN-PVD-009 | Lista e filtros |
| 4.14 | **JRN-CMP-003** | **Edição de compra confirmada com déficit** — agora que há reservas |
| 4.15 | JRN-DIS-002 | Alertas de esgotamento |
| 4.16 | JRN-ESP-001, 002 | Espelho comercial |

> **Antes de encerrar a fase, deixe pedidos finalizados suficientes para a Fase 6** (carga precisa de
> pedido finalizado com peça associada).

**Concorrência:** execute `JRN-PVD-001-N10` (dois vendedores na última unidade) com duas janelas
simultâneas. É o teste mais difícil de reproduzir e o mais revelador.

**Gaps a confirmar:** GAP-030, 031, 034, 035, 036, 037, 038, 039, 040.

---

# Fase 5 — Operação física: recebimento, pesagem e desossa

**Objetivo:** provar a materialização da compra e a rastreabilidade peça a peça.

| Ordem | Jornada | Marco |
|---|---|---|
| 5.1 | **JRN-PFN-001** | Pedido ao fornecedor — **por API** (GAP-042) |
| 5.2 | JRN-REC-001 | Abertura do lote com itens herdados |
| 5.3 | JRN-REC-007 | Lista e navegação |
| 5.4 | **JRN-PES-001** | **Pesar, destinar e etiquetar** — o núcleo da fase |
| 5.5 | JRN-PES-002 | Peso manual assistido |
| 5.6 | JRN-PES-005 | Destinos sem cobertura |
| 5.7 | **JRN-PES-004** | **Troca de peça** — fluxo atômico de 6 passos |
| 5.8 | JRN-PES-003 | Estorno |
| 5.9 | JRN-ETQ-001 | Ciclo da etiqueta |
| 5.10 | JRN-REC-002 | Captura de itens da NF |
| 5.11 | **JRN-REC-003** | **Conferência tripla sem divergência** (AD-04) |
| 5.12 | JRN-REC-004, 005 | Divergência e ocorrência — **usar um segundo lote** |
| 5.13 | JRN-REC-006 | Cancelamento de lote — usar um terceiro lote |
| 5.14 | JRN-DES-001 | Painel de necessidade |
| 5.15 | **JRN-DES-002** | **Transformação do TZ** |
| 5.16 | JRN-DES-003 | Divergência de transformação |
| 5.17 | JRN-DES-004 | Etiquetas da desossa |
| 5.18 | JRN-EST-001 | Consulta de estoque e destinação |
| 5.19 | JRN-EST-002 | Entrada de caixaria |
| 5.20 | **JRN-EST-003** | **Ajuste com segregação criador × aprovador** |

> **Planeje os lotes antes de começar.** Você precisa de pelo menos três: um limpo (5.11), um com
> divergência (5.12) e um descartável (5.13). Abrir tudo em um lote só embaralha os resultados.

**Gaps a confirmar:** GAP-042, 043, 044, 045, 046, 047, 048, 010, 057 (parcial).

---

# Fase 6 — Fechamento: carga, faturamento e liberação

**Objetivo:** o fim do dia. Valida o marco de fechamento, a integração fiscal e o portão final.

| Ordem | Jornada | Marco |
|---|---|---|
| 6.1 | JRN-EXP-001 | Montar carga e alocar pedidos |
| 6.2 | **JRN-EXP-002** | **Conferência por bipagem** |
| 6.3 | JRN-EXP-003 | Divergência na conferência |
| 6.4 | JRN-EXP-005 | Envio ao faturamento + prova do bloqueio de estorno |
| 6.5 | JRN-EXP-004 | Reabertura (por API — GAP-052) |
| 6.6 | JRN-FAT-001 | Consolidação e os **4 bloqueios** |
| 6.7 | **JRN-FAT-002** | **Emissão NFS-e** + gatilhos `999.99` e `888.88` |
| 6.8 | JRN-FAT-003 | Reprocessamento e cancelamento |
| 6.9 | **JRN-FAT-004** | **Rastreabilidade da nota até a peça** |
| 6.10 | JRN-SEG-001 | Ciclo do seguro |
| 6.11 | **JRN-LIB-001** | **Checklist de liberação** — testar os 4 requisitos isoladamente |

> **Para testar os 4 requisitos do checklist isoladamente (6.11) você precisa de 4 cargas** em estados
> diferentes: uma sem conferir, uma sem NF, uma sem seguro e uma sem motorista. Prepare-as na 6.1.
>
> **Para provocar `DADOS_FISCAIS_INCOMPLETOS` (6.6)**, crie um cliente sem CNPJ/CPF na Fase 2 e leve um
> pedido dele até aqui.

**Gaps a confirmar:** GAP-005, 011, 050, 051, 052, 053, 054, 055, **056**, 057.

---

# Fase 7 — Transversais

**Objetivo:** validar o que só faz sentido com o dia inteiro populado.

| Ordem | Jornada | Observação |
|---|---|---|
| 7.1 | JRN-DSH-001 | Os 10 KPIs e os 4 alertas — provocar cada alerta |
| 7.2 | JRN-APR-001 | Decidir as aprovações geradas nas Fases 5 e 6 |
| 7.3 | JRN-SIF-001 | Gerar e retificar (fluxo, não conteúdo — P8) |
| 7.4 | JRN-ADM-008 (revisita) | Auditoria de tudo que foi feito |
| 7.5 | JRN-OPE-003 (revisita) | Fechar a operação e observar o efeito (GAP-012) |

**Gaps a confirmar:** GAP-049, 058, 059.

---

# Fase 8 — Jornada E2E

**Objetivo:** provar a costura. Execute o [`05-jornada-e2e.md`](05-jornada-e2e.md) do zero, em ambiente
limpo, idealmente com cinco pessoas simulando a operação real.

| Ordem | Cenário | Prioridade |
|---|---|---|
| 8.1 | **E2E-001** — Operação completa | Crítica |
| 8.2 | E2E-005 — Dia sem regra de desdobramento | Alta (confirma GAP-029) |
| 8.3 | E2E-002 — Dia com divergência | Alta |
| 8.4 | E2E-003 — Compra alterada após venda | Alta |
| 8.5 | E2E-006 — Reabertura de carga | Média |
| 8.6 | E2E-004 — Duas cargas | Média |

**Critério de saída:** as 17 perguntas de validação de integridade do E2E respondidas com **sim**.

---

# Fase 9 — Permissões e segregação de funções

**Objetivo:** rodar a matriz de acesso com cada um dos 11 perfis. Pode correr em paralelo às Fases 4 a 7.

| Ordem | Verificação | Cenários |
|---|---|---|
| 9.1 | Menu correto por perfil | JRN-AUTH-003 |
| 9.2 | URL direta bloqueada | JRN-AUTH-004 (5 cenários) |
| 9.3 | Botões desabilitados sem permissão | `-Px` de CAD, CMP, PVD, PES, ADM |
| 9.4 | **SF-01** — aprovação de usuário | JRN-ADM-003 |
| 9.5 | **SF** — ajuste de estoque: criador ≠ aprovador | JRN-EST-003-N1 |
| 9.6 | **SF** — liberação de reserva só gestor/admin | JRN-PVD-008-N4 |
| 9.7 | **SF** — conferência separada de recebimento | JRN-REC-003-N7 |
| 9.8 | **SF** — reabertura de carga só com `EXPEDICAO_REABRIR` | JRN-EXP-004-N3 |
| 9.9 | **SF** — emissão/cancelamento de NFS-e segregados | JRN-FAT-002-N9, JRN-FAT-003-N4 |

> As segregações de funções (9.4 a 9.9) são **controle interno**, não conveniência de UI. Um "não" aqui
> tem peso de auditoria, não de usabilidade.

---

# Fase 10 — Regressão dirigida

**Objetivo:** após cada rodada de correções, reexecutar o mínimo necessário com confiança.

## Suíte de regressão mínima (executar sempre)

| ID | Jornada | Motivo |
|---|---|---|
| JRN-AUTH-001 | Login | Porta de entrada |
| JRN-CMP-002 | Confirmar compra | Geração de saldo |
| JRN-PVD-001 | Criar pedido | Reserva imediata |
| JRN-PVD-003 | Overbooking | AD-05 |
| JRN-REC-003 | Conferência tripla | AD-04 |
| JRN-PES-001 | Pesagem e etiqueta | Rastreabilidade |
| JRN-EXP-002 | Conferência de carga | Marco de fechamento |
| JRN-FAT-002 | Emitir NFS-e | Fiscal |
| JRN-LIB-001 | Liberação | Portão final |
| **E2E-001** | Operação completa | Costura |

## Regras de reexecução

| Se a correção tocou… | Reexecute |
|---|---|
| Reserva, disponibilidade ou overbooking | Fase 4 inteira + E2E-001 |
| Conferência, pesagem ou etiqueta | Fase 5 inteira + E2E-001 |
| Carga, NFS-e ou liberação | Fase 6 inteira + E2E-001 |
| RBAC ou permissões | Fase 9 inteira |
| Cadastros | Fase 2 do cadastro afetado + as fases que o consomem |
| Qualquer coisa | Suíte de regressão mínima |

---

# Paralelização sugerida

Com duas pessoas, a partir da Fase 3:

| Semana | Pessoa A (comercial) | Pessoa B (operação) |
|---|---|---|
| 1 | Fases 0, 1, 2 (juntas) | Fases 0, 1, 2 (juntas) |
| 2 | Fase 3 + Fase 4 | Fase 9 (permissões) |
| 3 | Fase 4 (conclusão) + Fase 7 | Fase 5 |
| 4 | Fase 8 (E2E, papel comercial) | Fase 6 + Fase 8 (papel operação) |
| 5 | Fase 10 (regressão) | Fase 10 (regressão) |

> A Fase 5 depende da Fase 4 apenas para ter pedidos com itens compatíveis. Se a Pessoa A concluir
> JRN-PVD-001/002 no início da semana 2, a Pessoa B pode começar a Fase 5 antes do fim da Fase 4.

---

# Critérios de conclusão da homologação

A homologação está concluída quando **todas** as afirmações abaixo forem verdadeiras.

| # | Critério |
|---|---|
| C1 | 100% dos cenários de prioridade **Crítica** executados |
| C2 | 100% dos cenários de prioridade **Alta** executados |
| C3 | ≥ 80% dos cenários **Média** e **Baixa** executados |
| C4 | **E2E-001** aprovado com as 17 validações de integridade em "sim" |
| C5 | Os 59 gaps com situação registrada (`Confirmado`, `Refutado` ou `Não testado` justificado) |
| C6 | As 25 regras a confirmar respondidas pelo negócio, com AD-xx aberto para cada decisão |
| C7 | Nenhuma reprovação de severidade Crítica em aberto |
| C8 | 50/50 telas visitadas com evidência |
| C9 | Todos os status alcançáveis exercitados (checklist de [`08`](08-matriz-estados-transicoes.md)) |
| C10 | Os 11 perfis exercitados na Fase 9 |
| C11 | Evidências arquivadas e indexadas |
| C12 | Relatório final de homologação emitido, com decisão de go/no-go |

---

# Riscos do cronograma

| Risco | Impacto | Mitigação |
|---|---|---|
| GAP-042 (Pedido ao Fornecedor sem tela) bloqueia a Fase 5 pela UI | Alto | Preparar os comandos de API antes da fase; alocar apoio técnico |
| GAP-029 causa falso negativo em cadeia | Alto | Checkpoint obrigatório ao fim da Fase 3 (**Total gerado 60**) |
| Testes de concorrência difíceis de reproduzir | Médio | Duas máquinas ou duas janelas anônimas; roteiro sincronizado por relógio |
| Ausência de dados de preço reais | Médio | Usar os valores sugeridos; GAP-041 torna o preço irrelevante hoje |
| Modelos SIF inexistentes (P8) | Baixo | Homologar apenas o fluxo; conteúdo fica fora de escopo |
| Regras de desossa provisórias (P12) | Médio | Registrar como pendência, não como defeito |
| Dependência de decisão do negócio nas 25 regras | Alto | Enviar a lista **antes** de começar a Fase 4; decisões tardias forçam reexecução |
