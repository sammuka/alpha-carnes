# 00 — Sumário executivo

**Assessment funcional do AlphaCarnes — preparação da homologação assistida**
Data: 30/08/2026 · Escopo: `app/frontend` + `app/backend` no estado atual do repositório
Natureza: análise e documentação. **Nenhuma linha de código da aplicação foi alterada.**

---

## O que foi feito

Foram lidos a documentação de governança e especificação (constituição, `DECISOES.md` com AD-01 a AD-06,
spec funcional v1.1, plano mestre e matriz de rastreabilidade), as 50 telas do frontend, os controllers,
services e matrizes de transição do backend, os schemas Drizzle com seus `CHECK` e enums, as migrations,
o catálogo de permissões e menus do RBAC, os seeds e os testes Playwright existentes.

A partir dessa base foram produzidas **93 fichas de jornada** com passo a passo executável, totalizando
**644 cenários** de validação, além de **59 gaps** e **25 perguntas** que precisam de decisão do negócio.

---

## Números

| # | Métrica | Valor |
|---:|---|---:|
| 1 | Módulos identificados | **23** |
| 2 | Telas identificadas | **50** |
| 3 | Jornadas documentadas (fichas completas) | **93** |
| 4 | Cenários Happy Path | **93** |
| 5 | Cenários alternativos | **130** |
| 6 | Cenários negativos | **398** |
| 7 | Cenários E2E (1 principal + 5 variantes) | **6** |
| 8 | Cenários de permissão | **17** |
| 9 | **Total de cenários executáveis** | **644** |
| 10 | Gaps identificados | **59** |
| 11 | Regras a confirmar com o negócio | **25** |
| 12 | Percentual de telas cobertas por jornada | **100% (50/50)** |
| 13 | Perfis RBAC exercitados | **11 / 11** |
| 14 | Endpoints mapeados no BFF | **~178** |

**Distribuição dos gaps**

| Severidade | Qtd. | Tipo | Qtd. |
|---|---:|---|---:|
| Crítica | 5 | Funcional | 14 |
| Alta | 19 | Processo | 9 |
| Média | 25 | Validação | 9 |
| Baixa | 10 | Regra a confirmar | 8 |
| | | Demais tipos (UX, permissão, dados, doc., integração) | 19 |

A predominância de cenários negativos (62% do total) é deliberada. Num sistema com reserva atômica de
estoque virtual, overbooking sem limite e emissão fiscal, o risco não está no caminho feliz.

---

## Os cinco achados que mudam decisões

### 1. O preço não circula pelo sistema — GAP-041 + GAP-056 (Crítica)
Existe uma tela completa de Tabela de Preços, com faixas A/B/C/D, publicação e histórico. **Nenhum outro
módulo lê esse preço.** No faturamento, o operador digita o valor da NFS-e à mão. Isso significa risco de
erro de digitação em documento fiscal, ausência de conferência de margem e trabalho de manutenção da
tabela sem retorno. Fechar esse elo (`valor = peso conferido × preço da faixa do cliente`) é uma feature
de porte, não um ajuste — precisa entrar no planejamento, não na lista de correções.

### 2. Pedido ao Fornecedor não tem tela — GAP-042 (Crítica)
A especificação v1.1 é explícita: "o recebimento nasce do Pedido ao Fornecedor". A entidade existe, tem
status próprio, endpoints e permissão dedicada — mas não há `page.tsx` nem item de menu. Na prática o
comprador não emite o pedido sem apoio técnico, e o elo entre planejamento e operação física fica
invisível. Até que exista tela, o E2E depende de chamada de API nesse ponto.

### 3. Fechar a operação não congela o dia — GAP-012 (Crítica)
O ciclo `aberta → em_andamento → fechada` é validado, mas nada impede criar pedido, compra ou movimento
numa operação já fechada. O fechamento é hoje um rótulo, não um controle.

### 4. A compra pode confirmar sem gerar disponibilidade, em silêncio — GAP-029 (Crítica)
Se o item de compra não tem regra de desdobramento vigente, a confirmação passa e a disponibilidade fica
zerada. O comprador acredita ter comprado, o comercial não tem o que vender, e ninguém é avisado. Isso
viola diretamente o princípio "nenhuma falha silenciosa" (RA-05) da constituição.

### 5. Doze endpoints existem sem botão que os acione
Restaurar usuário, cancelar compra programada, cancelar pedido de venda, reabrir carga, transferir item —
todos implementados e testáveis por API, nenhum alcançável pela interface. Não são bugs de código; são
decisões de produto pendentes sobre se a ação deve existir para o usuário final.

---

## Principais riscos da homologação

| # | Risco | Consequência | Mitigação |
|---:|---|---|---|
| 1 | **Falta de usuários de teste** | O seed cria apenas o `admin`; os outros 10 perfis não existem. Toda a Fase 9 (permissões) fica bloqueada. | Criar os 10 usuários na Fase 1, antes de qualquer outra coisa (JRN-ADM-001) |
| 2 | **Cadeia de dependência longa** | Uma falha no Bloco 1 (compra) invalida tudo que vem depois. O E2E tem 7 blocos encadeados. | Seguir o roadmap em [`07`](07-roadmap-homologacao.md); não pular fases |
| 3 | **Ausência de cobertura automatizada além do recebimento** | O spec Playwright existente para no handoff para desossa. Fases 5, 6 e 7 nunca foram exercitadas ponta a ponta. | Executar o E2E-001 manualmente com rigor e registrar evidência |
| 4 | **Confundir pendência com defeito** | 7 itens levam badge "Provisório" por decisão consciente (P1, P3, P5, P8, P9, P12, P15). Reportá-los como bug gera ruído. | Ler a seção de pendências de [`06`](06-gaps-identificados.md) antes de começar |
| 5 | **25 regras sem dono** | O homologador não sabe se o comportamento observado está certo. | Levar as 25 perguntas ao Quality Owner antes da Fase 5; cada resposta vira um AD-xx |
| 6 | **Estado compartilhado entre cenários** | Reserva sem expiração (AD-06) faz um pedido em rascunho segurar saldo indefinidamente e contaminar o cenário seguinte. | Liberar reserva ao fim de cada cenário comercial (JRN-PVD-008) |
| 7 | **Emissão fiscal com valor digitado** | Uma nota emitida com valor errado em homologação pode virar hábito em produção. | Tratar GAP-056 como bloqueio de go-live, não como observação |

---

## Top 10 — o que homologar primeiro

Ordenado por dependência, não por importância isolada. Cada item pressupõe o anterior.

| # | Jornada | Por quê |
|---:|---|---|
| 1 | **JRN-AUTH-001** — Login | Sem isso não há nada. Valida também a resolução de menus por perfil |
| 2 | **JRN-ADM-001** — Criar os 10 usuários de perfil | Desbloqueia toda a validação de RBAC; é o gargalo da homologação |
| 3 | **JRN-CAD-003/004/005/006** — Itens de compra, itens comerciais, fornecedor, cliente | Massa mínima sem a qual nenhum processo roda |
| 4 | **JRN-CAD-010** — Regra de desdobramento comercial | Sem ela a disponibilidade nunca nasce; é a raiz do GAP-029 |
| 5 | **JRN-OPE-001/003** — Operação e seu ciclo de status | Entidade pivô do dia; exercita o GAP-012 |
| 6 | **JRN-CMP-001/002** — Compra programada e confirmação | Onde a disponibilidade virtual é criada (AD-01: boi casado = 2 TZ + 2 DT + 2 PA) |
| 7 | **JRN-PVD-001** — Pedido de venda com reserva imediata | O coração da regra comercial: rascunho já reserva |
| 8 | **JRN-PVD-003** — Confirmação de overbooking | AD-05: challenge sem persistência seguido de confirmação atômica |
| 9 | **JRN-REC-003** — Conferência tripla Pedido × NF × Pesagem | O controle mais forte do recebimento |
| 10 | **JRN-FAT-002 + JRN-LIB-001** — Emissão de NFS-e e liberação do caminhão | Portão final do dia, com efeito fiscal e o GAP-056 exposto |

Se houver tempo para mais, siga com as 21 jornadas críticas listadas em [`04`](04-matriz-testes.md).

---

## Esforço estimado

| Fase | Conteúdo | Cenários | Estimativa |
|---|---|---:|---:|
| 0 | Preparação do ambiente | — | 2 h |
| 1 | Acesso e administração | 62 | 1 dia |
| 2 | Cadastros estruturantes | 96 | 2 dias |
| 3 | Planejamento: operação e compra | 63 | 1,5 dia |
| 4 | Comercial: disponibilidade, venda, overbooking | 130 | 3 dias |
| 5 | Operação física: recebimento, pesagem, desossa | 156 | 3,5 dias |
| 6 | Fechamento: carga, faturamento, liberação | 91 | 2,5 dias |
| 7 | Módulos transversais | 30 | 1 dia |
| 8 | E2E principal + 5 variantes | 6 | 1,5 dia |
| 9 | Permissões (11 perfis) | 17 | 1 dia |
| 10 | Regressão dirigida | variável | 2 dias |
| | **Total (1 homologador)** | **644** | **≈ 19 dias úteis** |

Com dois homologadores em paralelo a partir da Fase 3 — um no comercial, outro na operação física — cai
para cerca de 12 dias úteis. Detalhamento e pontos de paralelização em
[`07-roadmap-homologacao.md`](07-roadmap-homologacao.md).

---

## Respostas ao critério de conclusão

| Pergunta | Onde está respondida |
|---|---|
| Quais módulos existem? | [`01`](01-visao-geral.md) — 23 módulos |
| Quais telas existem? | [`02`](02-inventario-telas.md) — 50 telas com rota, ações e permissões |
| Quais personas existem? | [`01`](01-visao-geral.md) — 11 perfis RBAC |
| Quais jornadas existem e como executá-las? | [`03`](03-jornadas-operacionais.md), [`03b`](03b-jornadas-comercial.md), [`03c`](03c-jornadas-recebimento-producao.md), [`03d`](03d-jornadas-expedicao-faturamento.md) |
| Quais dados são necessários? | Seção **Dados necessários** de cada ficha |
| Quais dependências existem? | [`01`](01-visao-geral.md) §mapa de dependências e [`04`](04-matriz-testes.md) |
| Quais status e transições existem? | [`08`](08-matriz-estados-transicoes.md) — 26 entidades |
| Cenários positivos e negativos? | [`04`](04-matriz-testes.md) — 644 cenários |
| Quais regras precisam de confirmação? | [`06`](06-gaps-identificados.md) — 25 perguntas |
| Quais gaps foram identificados? | [`06`](06-gaps-identificados.md) — 59 gaps |
| Telas ou ações sem cobertura? | [`02`](02-inventario-telas.md) §4 e §5 — telas 100%; 5 ações parciais por ausência de UI |
| Sequência ideal de homologação? | [`07`](07-roadmap-homologacao.md) — 11 fases (0 a 10) |
| Como executar uma operação completa? | [`05`](05-jornada-e2e.md) — E2E-001, 7 blocos |
| De onde veio cada regra? | [`09`](09-rastreabilidade-tecnica.md) |

---

## Recomendação

O sistema está funcionalmente denso e as jornadas centrais são executáveis. O que impede considerá-lo
pronto não é volume de defeito, e sim **quatro decisões de produto ainda em aberto** — o elo do preço, a
tela do pedido ao fornecedor, o significado de fechar uma operação e o comportamento da compra sem regra
de desdobramento. Nenhuma delas se resolve durante a homologação: as quatro precisam de resposta do
Quality Owner antes que os testes das Fases 5 a 8 produzam um veredito confiável.

A sugestão é levar as **25 perguntas** de [`06`](06-gaps-identificados.md) a uma sessão de decisão antes
de iniciar a Fase 3, registrando cada resposta como AD-xx em `docs/execucao/DECISOES.md`, conforme manda
a constituição. As Fases 1 e 2 podem começar imediatamente — não dependem de nenhuma dessas decisões.
