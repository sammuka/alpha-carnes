# Onda 4 — Comercial — Plano de Implementação

> Para workers agênticos: usar o papel `worker` definido em `.codex/agents/worker.toml`.
> Plano escrito com a skill `writing-plans` (superpowers) no formato obrigatório de
> [`pipeline-execucao.md §6`](../../governance/pipeline-execucao.md), com o mesmo rigor dos planos
> [F4c](2026-06-07-f4c-corte-transformacao.md) e [Onda 3](2026-07-25-onda3-cadastros-admin.md).

**Goal:** entregar completas e fiéis ao protótipo validado as 5 telas do módulo Comercial —
`/comercial/clientes`, `/comercial/pedidos`, `/comercial/tabela-precos`, `/comercial/disponibilidade`
e `/comercial/espelho` — fechando os gaps das linhas 3–7 da
[matriz de rastreabilidade](2026-07-22-matriz-rastreabilidade-v1.1.md) e o DoD O4 dos
[quality-gates](../../governance/quality-gates.md): adendo com histórico, unicidade de pedido aberto
por `(cliente, produto, operação)` (AD-03), rascunho sem expiração automática com ação administrativa
auditada "Liberar reserva" (AD-06), mapa teatro com estados agregados **F/V/R/C/D/O/E/!** e
drill-down, catálogo MVP correto e tabela de preços com publicação auditada.

**Architecture:** modular monolith. Backend NestJS: um `@Module()` por domínio, Drizzle direto nos
services, transação + auditoria em toda etapa crítica (RA-02), eventos de domínio **pós-commit**
(RA-04). Frontend Next.js 16 App Router com BFF obrigatório — nenhum componente chama o backend
diretamente (RA-01). A Onda 4 **não reescreve a Onda 1**: o challenge `409
OVERBOOKING_CONFIRMACAO_NECESSARIA`, os endpoints de confirmação, as reservas tipadas e as
pendências de overbooking já existem em `develop` e são **reusados**; esta onda acrescenta adendo,
unicidade AD-03, liberação administrativa de reserva, tabela de preços, mapa teatro/drill-down,
espelho comercial e as 5 telas.

**Tech Stack:** NestJS 11 · TypeScript 5 strict · PostgreSQL 18 · Drizzle (`drizzle-kit`) · Zod 4 ·
Next.js 16 (App Router/BFF) · React 19 · Tailwind 4 · Shadcn/ui · WebSocket nativo + `EventEmitter2` ·
Jest (backend e frontend) · Playwright (e2e).

---

## Contexto fixo desta onda

| Item | Valor |
|---|---|
| Worktree | `F:/Projetos/AlphaCarnes/.worktrees/onda4-plan` |
| Branch do plano | `feature/onda4-plano-comercial` (commit `planejando` = `a394539`) |
| Base | `origin/develop` = `c2146fa` |
| Onda 3 | mergeada em `030ee9e` — dependência satisfeita |
| Protótipo UI | `F:/Projetos/alpha-carnes-prototipo` @ `feature/completude-v1.1` (`8d32aa4c`) |
| Repositório | `sammuka/alpha-carnes` |
| Branch de implementação | `feature/onda4-comercial` (criada a partir de `origin/develop` pelo Worker) |
| Emenda 1 | Portão 1 `ajustar` em `158da75` → achados 1–10 corrigidos; API real reauditada no worktree |
| Emenda 2 | Re-Portão 1 `ajustar` em `8229ff9` → 6 achados novos corrigidos: estado **E** do mapa passa a `status_carga_item <> 'removido'` (padrão real de `conferencia`/`fechamento`/`carga`/`liberacao`/`consolidacao`); caminho literal para operação inexistente em AD-03; DoD-109/112 ganham task própria (Task 20); DoD-113 vira teste escrito em `menu-rbac.test.ts`; `salvarItens`, `precosDaUltimaPublicada`, `exigirTabela` e `detalhar` escritos por extenso; linha 3 da matriz fechada por **D31** |
| Emenda 3 | 3º Portão 1 `ajustar` em `a71d03f` → achados novos da Task 9: `criar` deixa de chamar `detalhar` **dentro** da transação (outra conexão do pool → 404 + rollback) e passa a lê-lo após o commit, como `publicar`/`salvarItens`; o `.returning()` de `criar` usa `primeiroOuFalha` (`noUncheckedIndexedAccess`); `POST /precos/tabelas/:id/copiar` ganha regra (D14), corpo literal e **DoD-122/123/124**, deixando de ser rota órfã. Menores: `PrecosController` e o `@Get('aberto')` de pedidos por extenso, `arquivos`/`ler` (Task 13) e `arquivosDeCodigo` (Task 20) definidos |
| Emenda 4 | Execução bloqueada na Task 13: o plano atribuía um `PATCH` agregado a `app/frontend/src/app/api/comercial/pedidos/[id]/route.ts`, mas o contrato real é item-específico (`PATCH /comercial/pedidos/:id/itens/:itemId`, body `{ novaQuantidade, motivo }`) e aceita somente redução. Corrigido por **D32**, rota BFF aninhada literal, matriz de persistência do editor e **DoD-125/126**, sem criar endpoint backend nem regra de produto |
| Emenda 5 | Re-Portão 1 `ajustar` em `0439140` → fecha os dois achados do Monitor: quantidade editada para `0` passa literalmente pelo `DELETE` item-específico (remoção integral + liberação da reserva), enquanto redução positiva continua no `PATCH`, aumento no adendo e produto ausente no `POST /itens`; DoD-125 deixa de inspecionar texto e executa `PATCH`/`DELETE` com `apiFetch` mockado, provando `204` vazio e preservação byte/status de `400`/`404`/`409` |
| Worktree da Emenda 4 | `F:/Projetos/AlphaCarnes/.worktrees/o4-plan-fix` |
| Branch da Emenda 4 | `plan/onda4-task13-contract` |
| Base da Emenda 4 | `origin/develop` = `c2fe0e09f230e7748d532d2292e059f027941e0e` |

---

## Global Constraints (herda constituição + plano mestre)

Vinculantes, na ordem da [constituição](../../governance/constituicao.md):

1. **Princípio I — Fidelidade absoluta ao protótipo (NÃO-NEGOCIÁVEL).** Cada tela desta onda tem um
   `.tsx` de origem citado com caminho e faixa de linhas na seção *Referências do protótipo*. O Worker
   **lê o arquivo do protótipo antes de escrever a tela**. Layout, ordem dos campos, rótulos, ícones,
   larguras, cores de badge e textos de banner são copiados; divergências só as 7 listadas em
   *Divergências autorizadas*.
2. **Princípio II — Completude E2E, não MVP.** As 5 telas entram completas: backend + BFF + UI +
   testes + evidência. Nenhuma rota desta onda permanece `PlaceholderPage`.
3. **RA-01 — Regras de negócio só no backend.** Unicidade AD-03, política de overbooking, publicação
   de tabela de preços, derivação dos estados do mapa e agregações do espelho são calculadas no
   NestJS. O frontend só renderiza e chama o BFF.
4. **RA-02 — Transação + auditoria em etapa crítica.** Adendo, liberação de reserva, publicação e
   despublicação de tabela de preços rodam em `db.transaction` com `AuditoriaService.registrar` na
   mesma transação.
5. **RA-03/V — Gateways isolados.** Nada nesta onda toca hardware ou EISS.
6. **RA-04 — Tempo real por eventos pós-commit.** Sem polling: `ADENDO_REGISTRADO`,
   `RESERVA_LIBERADA_ADMIN` e `TABELA_PRECO_PUBLICADA` são emitidos após o commit e consumidos pelo
   `conectarRealtime` nas telas.
7. **RA-05/RA-06 — Nenhuma falha silenciosa nem dado inventado.** Preço não informado é `NULL` e a
   UI mostra campo vazio, nunca `0,00`. Erro do backend vira mensagem explícita na tela. Nenhum
   `catch {}` vazio, nenhum `success: true` em caminho de erro.
8. **Princípio VIII — Não inventar o que está pendente.** As pendências abertas P1, P3, P5–P12 e P15
   (v1.1 §16 / plano mestre §7) **não viram regra dura**: viram parâmetro existente e/ou badge
   "Provisório". Remover badge exige nova `AD-xx` em [`DECISOES.md`](../../execucao/DECISOES.md).
9. **Princípio X — Parametrização.** Nenhuma constante de negócio hard-coded em componente.
10. **Terminologia.** A palavra `[Mm]arca` é **banida** como rótulo, nome de entidade, campo, tipo,
    chave de tradução ou texto de UI. Usa-se **"Nome Fantasia"** e **"Buscar cliente"** (v1.1 §6.8).
11. **Schema.** PK `uuid` com `uuidv7()`; `TIMESTAMPTZ`; dinheiro `NUMERIC(15,2)`; pesos
    `NUMERIC(10,3)`; enums como `TEXT` + `CHECK`; soft delete com `deleted_at`; `created_at`/
    `updated_at` em toda tabela de negócio; migração estrutural em **expand → backfill → contract**;
    nunca `ALTER TABLE` fora de `drizzle-kit`.
12. **Design System.** Nenhum literal hexadecimal de cor fora de `app/frontend/src/app/globals.css`
    (`__tests__/tokens-ds.test.ts` já falha se houver). Fonte Inter; classes utilitárias dos tokens.
13. **Cobertura.** `npm run test:cov` do backend ≥ 80% linha **e** branch — gate do CI.
14. **Sem código legado.** Onde o campo é substituído (`clientes.rota_padrao` → `clientes.rota_id`),
    o antigo é removido no `contract` da mesma onda; não fica fallback, coluna órfã nem leitura dupla.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

**D1 — Escopo é o das linhas 3–7 da matriz.** Cinco rotas. Nenhuma outra tela é tocada. Backend
alterado apenas onde essas telas exigem.

**D2 — A Onda 1 não é reescrita.** `PedidosService.planejarSobLock`, `persistirItensPlanejados`,
`OverbookingChallengeException`, `reservas_disponibilidade` tipadas e `pendencias_overbooking`
permanecem como estão. Adendo e unicidade AD-03 **chamam** esses blocos.

**D3 — Migrações `0016_onda4_comercial_expand.sql` (cria/adiciona) e
`0017_onda4_comercial_contract.sql` (remove `clientes.rota_padrao`).** Backfill vai no 0016, depois
do `ADD COLUMN`. O 0017 tem guarda que aborta se restar `rota_padrao` não migrado.

**D4 — O "produto" da tabela de preços é `produtos`; o "produto" da cadeia comercial é
`itens_comerciais`.** `tabelas_preco_itens.produto_id → produtos.id` (igual ao plano mestre §3.2),
porque só `produtos` tem `unidade_preco` (`kg` | `unidade`), que a tela exige. Disponibilidade,
pedido, reserva e pendência continuam em `item_comercial_id`. O elo é
`produtos.legado_item_comercial_id`, garantido 1:1 pelo seed do catálogo MVP (D5).

**D5 — Seed do catálogo MVP: 11 pares `itens_comerciais` + `produtos` vinculados, sinalizados
Provisório (P11).** A Decisão 24 da Onda 3 adiou o seed porque semear catálogo sem fonte seria
inventar dado (RA-06); aqui a fonte existe e é o **protótipo validado**
(`TabelaPrecos.tsx:29-41`), que é fonte de verdade por Princípio I. O plano mestre §7 prescreve
exatamente este tratamento para P11: *"seed do catálogo MVP sinalizado como provisório; CRUD completo
permite saneamento"*. Códigos canônicos (D6):

| código | descrição | `unidade_preco` | `tipo_operacional` | natureza |
|---|---|---|---|---|
| `TZ` | Traseiro Bovino | `kg` | `peca_inteira_pesavel` | peça primária |
| `DT` | Dianteiro Bovino | `kg` | `peca_inteira_pesavel` | peça primária |
| `PA` | Ponta de Agulha | `kg` | `peca_inteira_pesavel` | peça primária |
| `BPORCO` | Banda de Porco | `kg` | `peca_inteira_pesavel` | peça primária |
| `CB` | Coxão-bola | `kg` | `derivado_desossa` | derivado TZ — regra A |
| `JAC` | Jacaré | `kg` | `derivado_desossa` | derivado TZ — regra A |
| `CBA` | Coxão-bola c/ alcatra | `kg` | `derivado_desossa` | derivado TZ — regra B |
| `FC` | Filé curto | `kg` | `derivado_desossa` | derivado TZ — regra B |
| `CXMIU` | Caixa de Miúdos | `unidade` | `entrada_unidade` | caixaria |
| `CXRABO` | Caixa de Rabo | `unidade` | `entrada_unidade` | caixaria |
| `CXFIG` | Caixa de Fígado | `unidade` | `entrada_unidade` | caixaria |

**D6 — Um único conjunto canônico de códigos.** O protótipo usa códigos diferentes por arquivo
(`COXBOLA`/`JACARE`/`COXALCATRA`/`FILECURTO`/`CXMIUDOS` em `PedidoVenda.tsx` e `Disponibilidade.tsx`;
`CB`/`JAC`/`CBA`/`FC`/`CXMIU` em `TabelaPrecos.tsx`). Vale o de `TabelaPrecos.tsx`, único arquivo com
os 11 itens completos. Divergência **D-02**.

**D7 — AD-03 é validada no backend com a chave `(cliente, item comercial, operação)`.** A validação
atual do `PedidosService` (duplicidade de `itemComercialId` dentro do mesmo pedido) permanece e ganha
uma segunda camada: se já existir **outro** pedido do mesmo cliente, mesmo item comercial e mesma
operação em estado aberto, a criação/inclusão retorna `409 PEDIDO_ABERTO_EXISTENTE` com o payload do
modal de adendo. Estados abertos = `rascunho`, `em_elaboracao_reserva_ativa`,
`aguardando_confirmacao_overbooking`. Operações diferentes podem coexistir (texto literal de AD-03).

**D8 — Adendo é aumento auditado de um item de pedido aberto, não pedido novo.**
`POST /comercial/pedidos/:id/adendos` reusa `planejarSobLock`. Se houver déficit, devolve o mesmo
`409 OVERBOOKING_CONFIRMACAO_NECESSARIA` da Onda 1 (AD-05), confirmado em
`POST /comercial/pedidos/:id/adendos/confirmar-overbooking`. Toda linha de adendo grava em
`adendos_pedido` (append-only) e em `auditoria`.

**D9 — P5 (política de preço em adendo) não tem superfície de código nesta onda.**
`pedidos_venda_itens` não possui coluna de preço; o adendo não fixa preço. Tratamento: badge
"Provisório · P5" no rodapé do modal de adendo com o texto *"A política de preço do adendo está
pendente de decisão; o adendo registra apenas quantidade."* Nenhum parâmetro novo é criado — os 9
cartões de `/admin/parametros` (Decisão 25 da Onda 3) permanecem 9.

**D10 — AD-06: sem TTL, sem job.** Nenhum agendador é criado. A liberação é
`POST /comercial/pedidos/:id/liberar-reserva` com `justificativa` (mín. 10 caracteres), permissão
`PEDIDO_RESERVA_LIBERAR`, transação que libera as reservas ativas do pedido, cancela as pendências de
overbooking abertas dele, move o pedido para `cancelado` (comportamento literal do protótipo,
`PedidoVenda.tsx:1003-1005`), registra auditoria com `dadosNovos.acao = 'liberar_reserva'` e emite
`RESERVA_LIBERADA_ADMIN` pós-commit.

**D11 — "Rascunho com reserva ativa" é rótulo derivado, não status de banco.** O `CHECK` de
`pedidos_venda.status` permanece com os 8 estados da v1.1 §10.1. A UI deriva o 9º rótulo quando
`status = 'rascunho'` **e** o pedido tem reserva ativa. Divergência **D-06**.

**D12 — `POST /comercial/pedidos` ganha `salvarComoRascunho?: boolean` (default `false`).** Com
`true`, o pedido nasce em `rascunho` (com reserva, conforme AD-06); com `false`, mantém o
comportamento atual (`em_elaboracao_reserva_ativa`). "Finalizar Pedido" continua sendo
`POST /:id/finalizar`. Em pedido já existente, "Salvar Rascunho" apenas persiste itens e não altera
status.

**D13 — Tabela de preços: 3 tabelas.** `tabelas_preco` (cabeçalho do dia, `rascunho` | `publicada`),
`tabelas_preco_itens` (1 linha por produto, 4 preços A/B/C/D **nullable**) e
`tabelas_preco_publicacoes` (histórico append-only de `publicada` | `revertida_para_rascunho`).
Índice único parcial em `data` com `deleted_at IS NULL`: uma tabela por dia.

**D14 — Criar tabela do dia é ação explícita; copiar da anterior é outra ação explícita.**
`POST /precos/tabelas { data }` cria o rascunho com uma linha por produto ativo do catálogo,
copiando os preços da última tabela **publicada**; se não houver nenhuma, os 4 preços nascem `NULL`
e a UI mostra campo vazio (RA-06). A tela não cria nada sozinha ao carregar. Divergência **D-04**.

`POST /precos/tabelas/:id/copiar` é o botão **"Copiar tabela anterior"** do protótipo
(`TabelaPrecos.tsx:158-162`) sobre uma tabela **já existente**, com corpo
`{ origemId?: string }` e permissão `TABELA_PRECO_GERENCIAR`. Três regras, uma para cada
ambiguidade que o endpoint teria:

| Situação | Regra |
|---|---|
| **Sem `origemId`** | A origem é a última tabela **publicada com data anterior à do destino** — o "anterior" do rótulo, e o recorte que impede uma tabela publicada de copiar a si mesma. Se não existir nenhuma, `409 SEM_TABELA_PRECO_ANTERIOR` e nada é escrito: não se inventa preço nem se devolve sucesso vazio (RA-05/RA-06). Com `origemId`, a origem é aquela tabela (rascunho ou publicada), `404` se não existir e `400 COPIA_ORIGEM_IGUAL_AO_DESTINO` se for a própria. |
| **Sobrescrita** | Para cada produto presente na origem, as 4 faixas do destino são **substituídas**, inclusive por `NULL` quando a origem não tem preço — copiar a ausência é copiar o dado real. Produto do destino que a origem não possui fica **intacto** (é o `{ ...it, ...TABELA_ANTERIOR[it.codigo] }` do protótipo). Produto da origem fora da grade do destino é ignorado: a grade é o catálogo ativo montado em `criar` e a cópia nunca insere linha nova. |
| **Destino `publicada`** | Volta para `rascunho` e grava `revertida_para_rascunho` em `tabelas_preco_publicacoes`, exatamente como a edição de D16 e como `TabelaPrecos.tsx:160` faz. O botão **não** é bloqueado em tabela publicada — o protótipo não o bloqueia. |

Tudo em uma transação com auditoria (`dadosNovos.acao = 'copiar_tabela_anterior'`). A cópia **não**
emite evento: nada foi publicado. Cobertura: **DoD-122**, **DoD-123** e **DoD-124**.

**D15 — Publicar exige tabela completa.** `POST /precos/tabelas/:id/publicar` retorna
`400 PRECOS_INCOMPLETOS` com a lista de produtos sem os 4 preços. Sucesso grava `publicada_por`,
`publicada_em`, linha em `tabelas_preco_publicacoes`, auditoria e evento `TABELA_PRECO_PUBLICADA`.

**D16 — Editar tabela publicada devolve ao rascunho.** `PATCH /precos/tabelas/:id/itens` sobre tabela
`publicada` muda o status para `rascunho` e grava `revertida_para_rascunho` no histórico
(`TabelaPrecos.tsx:152-155`), com o banner âmbar do protótipo (`TabelaPrecos.tsx:223-228`).

**D17 — Mapa teatro: 8 estados derivados de tabelas reais, sem coluna nova.** Nenhum estado é
inventado nem persistido. O parâmetro de todas as consultas é `operacaoId` (matriz linha 6:
`GET /comercial/disponibilidade/mapa?operacaoId=`), porque **`pecas` não tem `operacao_id`**: o elo
com a operação é `pecas.recebimento_id → recebimentos.operacao_id`. O "produto" da peça é
`pecas.item_comercial_base_id` (não existe `produto_id` em `pecas`); o do subitem é
`subitens.item_comercial_id`. Cada estado é uma consulta agregada por `item_comercial_id`:

| Estado | Rótulo | Tabela de origem | Chave de operação | Chave de produto |
|---|---|---|---|---|
| `F` | Físico disponível | `pecas` | `recebimentos.operacao_id` | `pecas.item_comercial_base_id` |
| `V` | Virtual disponível | `disponibilidades_virtuais` | `disponibilidades_virtuais.operacao_id` | `disponibilidades_virtuais.item_comercial_id` |
| `R` | Reservado (em elaboração) | `reservas_disponibilidade` | `pedidos_venda.operacao_id` | `pedidos_venda_itens.item_comercial_id` |
| `C` | Confirmado | `reservas_disponibilidade` | `pedidos_venda.operacao_id` | `pedidos_venda_itens.item_comercial_id` |
| `D` | Em desossa | `pecas` | `recebimentos.operacao_id` | `pecas.item_comercial_base_id` |
| `O` | Overbooking | `reservas_disponibilidade` | `pedidos_venda.operacao_id` | `pedidos_venda_itens.item_comercial_id` |
| `E` | Expedido | `carga_itens` | `caminhoes.operacao_id` | `pecas.item_comercial_base_id` ∪ `subitens.item_comercial_id` |
| `!` | Em ocorrência | `pecas` | `recebimentos.operacao_id` | `pecas.item_comercial_base_id` |

**SQL literal das 8 consultas** (`$1` = `operacaoId`). O `MapaService` executa exatamente estas
oito e agrega o resultado por `item_comercial_id`:

```sql
-- F — peça pesada, livre (sem item de pedido), não removida.
SELECT p.item_comercial_base_id AS item_comercial_id,
       count(*)::int            AS unidades,
       coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
  FROM pecas p
  JOIN recebimentos r ON r.id = p.recebimento_id
 WHERE r.operacao_id = $1
   AND p.status_peca = 'pesada'
   AND p.pedido_venda_item_id IS NULL
   AND p.deleted_at IS NULL
   AND r.deleted_at IS NULL
 GROUP BY p.item_comercial_base_id;

-- V — saldo virtual remanescente da operação.
SELECT dv.item_comercial_id,
       0::int                                      AS unidades,
       sum(dv.quantidade_disponivel)::numeric(15,3) AS quantidade
  FROM disponibilidades_virtuais dv
 WHERE dv.operacao_id = $1
 GROUP BY dv.item_comercial_id;

-- R — reserva ativa de pedido ainda em elaboração.
SELECT pvi.item_comercial_id,
       0::int                                       AS unidades,
       sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
  FROM reservas_disponibilidade rd
  JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
  JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
 WHERE pv.operacao_id = $1
   AND rd.status = 'ativa'
   AND rd.tipo_consumo IN ('fisico','virtual')
   AND pv.status IN ('rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking')
   AND pvi.deleted_at IS NULL
   AND pv.deleted_at IS NULL
 GROUP BY pvi.item_comercial_id;

-- C — mesma reserva, pedido já fechado comercialmente.
SELECT pvi.item_comercial_id,
       0::int                                       AS unidades,
       sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
  FROM reservas_disponibilidade rd
  JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
  JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
 WHERE pv.operacao_id = $1
   AND rd.status = 'ativa'
   AND rd.tipo_consumo IN ('fisico','virtual')
   AND pv.status IN ('finalizado','parcialmente_atendido','atendido','faturado')
   AND pvi.deleted_at IS NULL
   AND pv.deleted_at IS NULL
 GROUP BY pvi.item_comercial_id;

-- D — peça em fila de corte ou em transformação.
SELECT p.item_comercial_base_id AS item_comercial_id,
       count(*)::int            AS unidades,
       coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
  FROM pecas p
  JOIN recebimentos r ON r.id = p.recebimento_id
 WHERE r.operacao_id = $1
   AND p.status_peca IN ('para_corte','em_transformacao')
   AND p.deleted_at IS NULL
   AND r.deleted_at IS NULL
 GROUP BY p.item_comercial_base_id;

-- O — reserva ativa sem lastro (overbooking confirmado).
SELECT pvi.item_comercial_id,
       0::int                                       AS unidades,
       sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
  FROM reservas_disponibilidade rd
  JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
  JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
 WHERE pv.operacao_id = $1
   AND rd.status = 'ativa'
   AND rd.tipo_consumo = 'overbooking'
   AND pv.status <> 'cancelado'
   AND pvi.deleted_at IS NULL
   AND pv.deleted_at IS NULL
 GROUP BY pvi.item_comercial_id;

-- E — peça OU subitem em caminhão já fechado (UNION ALL; o agregador soma as duas pernas).
SELECT p.item_comercial_base_id AS item_comercial_id,
       count(*)::int            AS unidades,
       coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
  FROM carga_itens ci
  JOIN caminhoes cam ON cam.id = ci.caminhao_id
  JOIN pecas p       ON p.id = ci.peca_id
 WHERE cam.operacao_id = $1
   AND ci.tipo_origem = 'peca'
   AND ci.status_carga_item <> 'removido'
   AND cam.status_caminhao IN
       ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
   AND ci.deleted_at IS NULL
   AND cam.deleted_at IS NULL
   AND p.deleted_at IS NULL
 GROUP BY p.item_comercial_base_id
UNION ALL
SELECT s.item_comercial_id,
       count(*)::int                             AS unidades,
       coalesce(sum(s.peso), 0)::numeric(15,3)   AS quantidade
  FROM carga_itens ci
  JOIN caminhoes cam ON cam.id = ci.caminhao_id
  JOIN subitens s    ON s.id = ci.subitem_id
 WHERE cam.operacao_id = $1
   AND ci.tipo_origem = 'subitem'
   AND ci.status_carga_item <> 'removido'
   AND cam.status_caminhao IN
       ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
   AND ci.deleted_at IS NULL
   AND cam.deleted_at IS NULL
   AND s.deleted_at IS NULL
 GROUP BY s.item_comercial_id;

-- ! — peça marcada divergente na destinação.
SELECT p.item_comercial_base_id AS item_comercial_id,
       count(*)::int            AS unidades,
       coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
  FROM pecas p
  JOIN recebimentos r ON r.id = p.recebimento_id
 WHERE r.operacao_id = $1
   AND p.status_peca = 'divergente'
   AND p.deleted_at IS NULL
   AND r.deleted_at IS NULL
 GROUP BY p.item_comercial_base_id;
```

**Nota sobre `status_carga_item` (estado E) — predicado é `<> 'removido'`, nunca `= 'em_carga'`.**
`chk_carga_itens_status` admite `'em_carga' | 'conferido' | 'removido'`
(`expedicao.schema.ts:80,93-95`) e a conferência **promove** o item de `'em_carga'` para
`'conferido'` (`conferencia.service.ts:167-176`). Como o estado E só conta itens de caminhão já
`fechado` — e o caminhão só fecha depois da conferência —, filtrar por `= 'em_carga'` esconderia
justamente os itens conferidos, ou seja, a carga inteira do caso normal, reportando falta onde não
há. O predicado correto é o mesmo que **todo** o resto do repositório usa para "item vivo na carga":
`ne(cargaItens.statusCargaItem, 'removido')` em `consolidacao.service.ts:61`,
`conferencia.service.ts:146,152`, `liberacao.service.ts:156` e `carga.service.ts:325,330`;
`!== 'removido'` em `fechamento.service.ts:253`; e `<> 'removido'` nos índices únicos parciais
`uq_carga_itens_peca` / `uq_carga_itens_subitem` (`0006_mixed_barracuda.sql:81-82`). As duas pernas
do `UNION ALL` de E usam esse predicado. A fixture de DoD-99 (Task 10) obriga o caso: o caminhão
fechado leva **um item `'conferido'` e um item `'em_carga'`**, e ambos aparecem em E; um terceiro
item `'removido'` fica de fora.

**Nota sobre `tipo_consumo = 'fisico'` (R e C).** `chk_reservas_tipo_consumo` admite
`'fisico' | 'virtual' | 'overbooking'`, mas o motor de reserva de `PedidosService`
(`persistirItensPlanejados`) hoje só grava `'virtual'` e `'overbooking'`; `'fisico'` existe no
domínio e é lido por `liberarReservaReal`, porém nenhum writer o produz. Os filtros de R e C
mantêm `IN ('fisico','virtual')` para acompanhar o CHECK — não é dado inventado, é o mesmo
predicado já usado em `liberarReservaReal`. O teste de DoD-99 cobre apenas as reservas `'virtual'`
e `'overbooking'`, que são as efetivamente produzíveis nesta onda.

**D18 — Grade Tabular usa dados reais.** A aba Grade permanece sobre `disponibilidades_virtuais` da
operação. O catálogo hard-coded do protótipo ("Dianteiro Bovino", "Traseiro Bovino"… em
`Disponibilidade.tsx`, aba Grade) **não é copiado**. Divergência **D-03**, exigida pelo escopo da onda.

**D19 — Espelho é leitura pura.** `GET /comercial/espelho` não escreve nada. O status por item é
derivado nesta precedência: `Cancelado` → `Faturado` → `Fechado` (pedido `finalizado`) → `Atendido`
(`quantidade_atendida >= quantidade_pedida`) → `Parcial` (`0 < atendida < pedida`) → `Aberto`.
P15 (marco exato de fechamento do pedido) permanece aberta: badge "Provisório · P15" no cabeçalho da
tela, informando que "Fechado" hoje equivale a `finalizado`.

**D20 — Export do espelho é gerado no servidor.** `GET /comercial/espelho?formato=csv` devolve
`text/csv; charset=utf-8` com `Content-Disposition: attachment`. A exportação fica auditável e usa os
mesmos filtros da tela. Divergência **D-07**.

**D21 — 4 permissões novas.** `TABELA_PRECO_LER`, `TABELA_PRECO_GERENCIAR`, `ESPELHO_COMERCIAL_LER`,
`PEDIDO_RESERVA_LIBERAR`. Atribuição alinhada à matriz de menu já testada em
`__tests__/menu-rbac.test.ts:24-28`:

| Permissão | Perfis |
|---|---|
| `TABELA_PRECO_LER` | `comercial`, `gestor`, `administrador` |
| `TABELA_PRECO_GERENCIAR` | `gestor`, `administrador` |
| `ESPELHO_COMERCIAL_LER` | `comercial`, `gestor`, `expedicao`, `administrador` |
| `PEDIDO_RESERVA_LIBERAR` | `gestor`, `administrador` |

**D22 — 3 eventos novos.** `ADENDO_REGISTRADO = 'adendo_registrado'`,
`RESERVA_LIBERADA_ADMIN = 'reserva_liberada_admin'`,
`TABELA_PRECO_PUBLICADA = 'tabela_preco_publicada'`, com payload tipado em `PayloadPorEvento`.

**D23 — Clientes: `rota_id` substitui `rota_padrao`.** `clientes.rota_id uuid REFERENCES rotas(id)`
entra no 0016 com backfill por `rotas.codigo` e depois `rotas.nome`; o 0017 remove `rota_padrao`. O
`representante_id` já existe e é reusado. O banner do protótipo ("Representante e Rota definem a
herança…") descreve um comportamento **executável**, não um aviso: a propagação dos dois campos
para o pedido é a lacuna da linha 3 da matriz e está especificada em **D31**.

**D24 — `necessitaCorteAcerto` entra em `preferenciasJsonSchema`.** Campo booleano opcional no JSONB
de preferências (`app/backend/src/common/dto/json-cadastros.dto.ts`), sem migração de coluna.

**D25 — `prioridade` do cliente é `normal` | `alta` no DTO.** A coluna `clientes.prioridade` é `TEXT`;
o Zod restringe ao par do protótipo (`Cadastros.tsx`, Select "Prioridade Padrão"). Sem `CHECK` novo,
para não invalidar linha existente fora do par.

**D26 — Dívida 6 da Onda 3 (`usuarios_representantes`) permanece aberta e é reprogramada para a
Onda 5.** Ela pertence a `/admin/usuarios`, que não está nas linhas 3–7 da matriz. O filtro por
representante do Espelho e do Pedido usa `clientes.representante_id`, que já existe, sem depender
daquela tabela.

**D27 — `adendos_pedido.origem_consumo` é derivado do `PlanoItem`, não de um campo inexistente.**
`planejarSobLock` devolve `PlanoItem[]`; **não existe `plano.origemPredominante`**. A regra de
derivação é literal e única:

```ts
/** Origem do consumo do adendo, derivada do plano da Onda 1 (D27). */
function origemDoAdendo(alocacao: PlanoItem): 'virtual' | 'overbooking' {
  return ehZero(alocacao.deficit) ? 'virtual' : 'overbooking';
}
```

O `CHECK` de `origem_consumo` continua com os três valores de `chk_reservas_tipo_consumo`
(`'fisico'`, `'virtual'`, `'overbooking'`) para não divergir do vocabulário de
`reservas_disponibilidade`, mas **o motor da Onda 4 nunca grava `'fisico'`**: não há writer de
reserva física em `develop` (ver nota de D17). Um adendo parcialmente coberto (parte virtual, parte
déficit) é gravado como `'overbooking'` — a linha do adendo é única e o déficit é a informação que
gera pendência para o gestor. DoD-116 fixa essa derivação em teste.

**D28 — Testes de backend ficam onde o repositório já os põe: `app/backend/test/`.** Não há
nenhum `*.spec.ts` colocado ao lado do código em `app/backend/src` — `jest.config.cjs` usa
`testRegex: '.*\\.(e2e-)?spec\\.ts$'` sobre `rootDir: '.'` e as 63 suítes vivem em
`test/unit/*.spec.ts` (unitárias, sem banco) e `test/integration/*.e2e-spec.ts` (com Postgres, via
`test/helpers/test-app.ts`). O plano segue essa convenção; o mapa DoD abaixo cita o arquivo real.
Consequências diretas: `src/database/seed-catalogo-mvp.ts` **entra** no `collectCoverageFrom`
(só `src/database/seed.ts` e `src/database/schema/**` estão excluídos), e
`src/common/rbac/permissoes.ts` **não** entra.

**D29 — O legado de pedidos sai nesta onda (Global Constraint 14).** `pedido-venda-client.tsx`
(597 linhas), a rota `/comercial/pedidos/novo` e `__tests__/pedido-novo.test.tsx` são a
implementação anterior, anterior ao protótipo, e **não** correspondem a `PedidoVenda.tsx`. Eles são
**removidos**, não mantidos em paralelo: a tela nova (`pedidos-client.tsx` + `pedido-editor.tsx`) é
master-detail em rota única, como o protótipo, e `/comercial/pedidos/novo` não existe na matriz
(39 rotas) nem no menu canônico. Nenhum redirect é criado — rota inexistente na matriz não vira
rota permanente. Os únicos consumidores externos são `e2e/jornada-operacional.spec.ts:551` e o
próprio `pedido-novo.test.tsx`, ambos realinhados/removidos na mesma task.

**D30 — Histórico da tabela de preços usa o caminho da matriz: `GET /precos/tabelas/:id/historico`.**
A matriz (linha 5) prescreve `GET /tabelas/:id/historico` sob o módulo `precos`; o plano anterior
usava `/publicacoes`. Vale a matriz — nenhuma divergência nova é aberta. A **tabela** continua
chamando-se `tabelas_preco_publicacoes` (é o log de publicação/reversão); só a rota se alinha.

**D31 — A herança representante → rota no fluxo de pedido é implementada, não deixada como
informativa.** A coluna "Lacuna" da **linha 3 da matriz** pede literalmente *"herança automática
representante→rota no fluxo de pedido"*. Esta onda a fecha; **nenhuma divergência nova é aberta**
(continuam 7). Regra, com o schema real e sem coluna nova:

- **Rota** — `pedidos_venda.rota_prevista` é `TEXT` (`pedidos.schema.ts:21`). No `criar`, quando
  `dto.rotaPrevista` **não** é enviado, o backend copia `rotas.nome` da rota do cliente
  (`clientes.rota_id`, coluna criada no 0016 por D23). Cliente sem rota mantém `rota_prevista`
  `NULL` — campo vazio na tela, nunca texto fabricado (RA-06). Enviar `rotaPrevista` explicitamente
  continua sobrepondo a herança (o vendedor pode desviar a entrega do itinerário padrão).
- **Representante** — **não** é copiado para `pedidos_venda`. Não existe
  `pedidos_venda.representante_id` e criá-la duplicaria o dado: o representante do pedido é o do
  cliente, via `clientes.representante_id` (coluna já existente, `clientes.schema.ts:10`). É a
  mesma origem que o Espelho e o filtro do Pedido já usam por D26 — uma fonte só, sem divergir
  quando o cadastro do cliente muda. `detalhar`/`listar` devolvem o representante por `join`.

Código literal, no `criar` de `pedidos.service.ts`, dentro da transação e **depois** da checagem
AD-03 (é leitura, não muta nada) e **antes** do `tx.insert(pedidosVenda)`:

```ts
/**
 * Herança do cadastro do cliente para o pedido (matriz linha 3 / D31).
 * Rota: copiada de clientes.rota_id → rotas.nome quando o DTO não a informa.
 * Representante: NÃO é copiado — é derivado de clientes.representante_id na leitura.
 */
private async rotaHerdadaDoCliente(tx: Tx, clienteId: string): Promise<string | null> {
  const [linha] = await tx
    .select({ nomeRota: rotas.nome })
    .from(clientes)
    .leftJoin(rotas, eq(clientes.rotaId, rotas.id))
    .where(and(eq(clientes.id, clienteId), isNull(clientes.deletedAt)))
    .limit(1);
  if (!linha) throw new NotFoundException('Cliente não encontrado');
  return linha.nomeRota ?? null;
}
```

```ts
// criar — substitui `rotaPrevista: dto.rotaPrevista` no values do insert.
rotaPrevista: dto.rotaPrevista ?? (await this.rotaHerdadaDoCliente(tx, dto.clienteId)),
```

E na leitura (`detalhar`, hoje `pedidos.service.ts:118-128`), o representante entra como campo
derivado ao lado do cliente já carregado, sem `select` extra na tela:

```ts
const [heranca] = await this.db
  .select({
    representanteId: clientes.representanteId,
    representanteNome: representantes.nome,
    rotaId: clientes.rotaId,
    rotaNome: rotas.nome,
  })
  .from(clientes)
  .leftJoin(representantes, eq(clientes.representanteId, representantes.id))
  .leftJoin(rotas, eq(clientes.rotaId, rotas.id))
  .where(eq(clientes.id, pedido.clienteId))
  .limit(1);
return { ...pedido, heranca: heranca ?? null };
```

`listar` recebe os mesmos dois `leftJoin` para alimentar a coluna Representante da lista e o filtro
por representante. Fixado por **DoD-119** (backend) e **DoD-120** (UI).

**D32 — Alteração de item persistido usa a rota BFF aninhada que espelha o controller real; não
existe `PATCH` agregado no pedido.** O contrato auditado em
`pedidos.controller.ts:104-123`, `pedido.dto.ts:57-74` e `pedidos.service.ts:380-428,532-562` é:

| Ação no editor | BFF | Backend | Body | Semântica |
|---|---|---|---|---|
| Reduzir item persistido para quantidade `> 0` e menor que a atual | `PATCH /api/comercial/pedidos/:id/itens/:itemId` | `PATCH /comercial/pedidos/:id/itens/:itemId` | `{ novaQuantidade, motivo: 'Redução de quantidade no editor de rascunho' }` | **somente redução positiva**; `reduzirItemSchema` exige `positive()` e `novaQuantidade >= quantidadePedida` retorna `409` |
| Editar a quantidade persistida para `0` | `DELETE /api/comercial/pedidos/:id/itens/:itemId` | `DELETE /comercial/pedidos/:id/itens/:itemId` | `{ motivo: 'Remoção de item ao zerar quantidade no editor de rascunho' }` | `min={0}` do protótipo significa remoção integral: libera todas as reservas do item, trata a pendência e faz soft delete; **nunca** envia `novaQuantidade: 0` ao `PATCH` |
| Remover item persistido pelo ícone `Trash2` | `DELETE /api/comercial/pedidos/:id/itens/:itemId` | `DELETE /comercial/pedidos/:id/itens/:itemId` | `{ motivo: 'Remoção de item no editor de rascunho' }` | mesma remoção integral sustentada por v1.1 §6.3, com motivo próprio da ação visual |
| Aumentar item persistido | `POST /api/comercial/pedidos/:id/adendos` | `POST /comercial/pedidos/:id/adendos` | `{ itemComercialId, quantidadeAdicionada, motivo }` | aumento é **adendo** (v1.1 §5.7/§6.9), com histórico; não passa pelo `PATCH` de redução |
| Incluir produto ainda ausente no pedido | `POST /api/comercial/pedidos/:id/itens` | `POST /comercial/pedidos/:id/itens` | `{ itemComercialId, quantidade, observacoes? }` | cria nova linha; challenge/confirmação de overbooking já é o contrato da Onda 1 |

A rota `app/frontend/src/app/api/comercial/pedidos/[id]/route.ts` permanece com `GET` do detalhe e
`DELETE` do **pedido inteiro**; ela **não recebe `PATCH`**. A nova rota é
`app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/route.ts`, com `PATCH` e `DELETE`.
Ela usa `apiFetch` e devolve `response.body` bruto em `NextResponse`: inclusive uma resposta `204`
sem corpo não é forçada por `response.json()` (o que viraria erro falso), e qualquer
`400`/`404`/`409` mantém literalmente status e bytes do corpo. O BFF não revalida nem amplia a
regra: os schemas Zod canônicos continuam no backend (RA-01). A matriz — incluindo `0 → DELETE` —
é fixada por **DoD-125** (proxy/contratos executado) e **DoD-126** (consumidor no editor).

---

## Referências do protótipo (tela → arquivo `.tsx` do protótipo) — Princípio I

Raiz: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` (`8d32aa4c`).

### 1. `/comercial/clientes` → `src/app/pages/Cadastros.tsx`

Caminho real localizado no protótipo (não existe `Clientes.tsx`; a tela de Clientes é o conteúdo de
`Cadastros.tsx`). Elementos obrigatórios:

- Cabeçalho: título "Cadastro de Clientes", subtítulo, badge com o total de clientes ativos.
- Master `w-[400px]`: campo **"Buscar cliente"**, botão `+`, filtro de status, cards com **Nome
  Fantasia**, razão social, CNPJ e pílula de status.
- Detalhe: avatar `Building2`, título = Nome Fantasia, subtítulo = razão social, `Switch`
  "Cliente Ativo", botão "Salvar".
- 4 abas: `Dados Gerais` · `Dados Fiscais & Endereço` · `Contatos` · `Preferências Operacionais`.
- Aba Dados Gerais: banner azul de herança + Nome Fantasia\*, Razão Social\*, CNPJ/CPF\*, Código
  Interno (somente leitura), Representante\*, Itinerário / Rota\*, Prioridade Padrão.
- Aba Preferências Operacionais: banner azul + Faixa de Peso Mínima (kg), Faixa de Peso Máxima (kg),
  Perfil de Gordura Aceito, `Switch` "Necessita Corte de Acerto?" com rótulo "Sim, enviar para mesa
  de corte".
- Listas `REPRESENTANTES` e `ROTAS` do protótipo são mock; a implementação lê
  `/api/cadastros/representantes` e `/api/cadastros/rotas` (divergência **D-05**).

### 2. `/comercial/pedidos` → `src/app/pages/PedidoVenda.tsx`

- `StatusPedido` (9 rótulos) e `STATUS_STYLE`; `Origem` = `Físico` | `Virtual` | `Overbooking`.
- Lista de pedidos com filtros, contadores e ação "Liberar reserva" nas linhas em rascunho com
  reserva ativa (`PedidoVenda.tsx:1003-1005`).
- `PedidoEditor`: cabeçalho do cliente, seletor de produto, quantidade, tabela de itens com coluna
  Origem, rodapé com "Salvar Rascunho" e "Finalizar Pedido".
- `ModalOverbooking`: título, quantidade solicitada, disponível, déficit, texto de confirmação e os
  dois botões. É o payload do `409` da Onda 1.
- `ModalAdendo`: aviso de pedido aberto existente, quantidade atual, quantidade a adicionar, motivo e
  confirmação. É o payload do `409 PEDIDO_ABERTO_EXISTENTE`.
- Alteração de item persistido segue o comportamento do protótipo em `PedidoVenda.tsx:465-508`
  (reduzir devolve disponibilidade; remover libera a reserva; aumentar calcula apenas o incremento),
  inclusive o `input min={0}` de `PedidoVenda.tsx:729-734`: `0` é remoção integral e vai ao
  `DELETE`, redução ainda positiva vai ao `PATCH`, aumento vai ao adendo e produto ausente vai ao
  `POST /itens`, conforme D32 — nunca para um `PATCH` agregado do pedido.
- `HistoricoEntry`: linha do tempo do pedido (inclui adendos).
- `PRODUTOS`, `CLIENTES`, `SEED_PEDIDOS`, `DISPONIBILIDADE_INICIAL` são mock (divergência **D-05**).

### 3. `/comercial/tabela-precos` → `src/app/pages/TabelaPrecos.tsx`

- Cabeçalho com data, pílula de status (`Rascunho` | `Publicada`) e as ações literais
  "Copiar tabela anterior" (`202-206`), "Histórico" (`207-212`) e "Publicar" (`214-220`).
- Grade com colunas Produto · Unidade · Preço A · Preço B · Preço C · Preço D.
- `CATALOGO_INICIAL:29-41` — os 11 produtos e a unidade de preço (fonte do seed D5).
- Banner âmbar de tabela publicada em edição (`223-228`) e `HISTORICO_INICIAL` (painel de histórico).

### 4. `/comercial/disponibilidade` → `src/app/pages/Disponibilidade.tsx`

- `EstadoBloco` com os 8 estados `F/V/R/C/D/O/E/!`, legenda e cores.
- `GrupoCell`: bloco agregado por produto/estado (mapa teatro).
- `DetalheUnidade`: painel de drill-down da unidade selecionada.
- `SEED_PRODUTOS:131-148` — catálogo MVP (fonte cruzada do seed D5).
- `GradeTabular`: **o catálogo hard-coded desta aba não é copiado** (divergência **D-03**).

### 5. `/comercial/espelho` → `src/app/pages/EspelhoComercial.tsx`

- Filtros: data, vendedor, rota, cliente; seletor de agrupamento `cliente` | `rota` | `representante`.
- Tabela agrupada com quantidade pedida, peso atendido e `StatusBadge` por item.
- Botão de exportação (divergência **D-07**: geração no servidor).

### Dados relacionados do protótipo

`src/app/data/*` do protótipo contém apenas fixtures de demonstração; nenhuma delas é copiada para
o runtime. A única extração autorizada é o **catálogo MVP** (D5/D6), que vira seed sinalizado
Provisório.

---

## Estrutura de arquivos

Verificado contra o worktree em `158da75`: o que já existe está em *alterados*, o que não existe
está em *novos*. Testes de backend seguem D28 (`app/backend/test/…`).

### Backend — novos (código)

```
app/backend/src/database/migrations/0016_onda4_comercial_expand.sql
app/backend/src/database/migrations/0017_onda4_comercial_contract.sql
app/backend/src/database/schema/adendos-pedido.schema.ts
app/backend/src/database/schema/tabelas-preco.schema.ts
app/backend/src/database/seed-catalogo-mvp.ts
app/backend/src/modules/comercial/adendos/adendos.service.ts
app/backend/src/modules/comercial/adendos/dto/adendo.dto.ts
app/backend/src/modules/comercial/precos/precos.module.ts
app/backend/src/modules/comercial/precos/precos.controller.ts
app/backend/src/modules/comercial/precos/precos.service.ts
app/backend/src/modules/comercial/precos/dto/tabela-preco.dto.ts
app/backend/src/modules/comercial/disponibilidade/mapa.service.ts
app/backend/src/modules/comercial/disponibilidade/dto/mapa.dto.ts
app/backend/src/modules/comercial/espelho/espelho.module.ts
app/backend/src/modules/comercial/espelho/espelho.controller.ts
app/backend/src/modules/comercial/espelho/espelho.service.ts
app/backend/src/modules/comercial/espelho/dto/espelho.dto.ts
```

### Backend — novos (testes, D28)

```
app/backend/test/helpers/onda4-fixtures.ts                     (fixtures dos 8 estados + catálogo)
app/backend/test/unit/adendos.service.spec.ts
app/backend/test/unit/precos.service.spec.ts
app/backend/test/unit/espelho.service.spec.ts
app/backend/test/unit/permissoes-onda4.spec.ts
app/backend/test/unit/eventos-onda4.spec.ts
app/backend/test/unit/onda4-schema.spec.ts
app/backend/test/integration/adendos.e2e-spec.ts
app/backend/test/integration/pedidos-onda4.e2e-spec.ts
app/backend/test/integration/precos.e2e-spec.ts
app/backend/test/integration/espelho.e2e-spec.ts
app/backend/test/integration/mapa-disponibilidade.e2e-spec.ts
app/backend/test/integration/clientes-onda4.e2e-spec.ts
app/backend/test/integration/seed-catalogo-mvp.e2e-spec.ts
app/backend/test/integration/onda4-comercial.e2e-spec.ts       (jornada ponta a ponta)
```

### Backend — alterados

```
app/backend/src/database/schema/index.ts              (exporta os 2 schemas novos)
app/backend/src/database/schema/clientes.schema.ts    (+ rota_id, − rota_padrao)
app/backend/src/database/migrations/ROLLBACK.md       (rollback de 0016/0017)
app/backend/src/database/seed.ts                      (chama seedCatalogoMvp)
app/backend/src/common/rbac/permissoes.ts             (+4 permissões, +4 descrições, pushPermissoes)
app/backend/src/common/rbac/perfil-permissoes.snapshot.json (regerado por `npm run rbac:snapshot`)
app/backend/src/common/dto/json-cadastros.dto.ts      (+ necessitaCorteAcerto)
app/backend/src/realtime/events/eventos.ts            (+3 eventos e payloads)
app/backend/src/modules/comercial/pedidos/pedidos.module.ts     (+ AdendosService)
app/backend/src/modules/comercial/pedidos/pedidos.controller.ts (+4 rotas)
app/backend/src/modules/comercial/pedidos/pedidos.service.ts    (AD-03, AD-06, rascunho,
                                                                 herança representante/rota (D31),
                                                                 export de desafiosParaChallenge,
                                                                 extração de aplicarAlocacaoNoItem
                                                                 e dos helpers de adendo)
app/backend/src/modules/comercial/pedidos/dto/pedido.dto.ts     (+ salvarComoRascunho, liberar)
app/backend/src/modules/comercial/disponibilidade/disponibilidade.module.ts     (+ MapaService)
app/backend/src/modules/comercial/disponibilidade/disponibilidade.controller.ts (+2 rotas)
app/backend/src/modules/cadastros/clientes/dto/cliente.dto.ts   (rotaId, prioridade, preferências)
app/backend/src/modules/cadastros/clientes/clientes.service.ts  (rotaId, totalAtivos)
app/backend/src/app.module.ts                          (+ PrecosModule, EspelhoModule)
app/backend/test/unit/pedidos.service.spec.ts          (+ DoD-83 estrutural)
app/backend/test/integration/clientes.e2e-spec.ts      (rota_padrao → rota_id nas asserções)
```

### Frontend — novos (35 arquivos; 14 rotas BFF)

```
app/frontend/src/lib/precos.ts
app/frontend/src/lib/espelho.ts
app/frontend/src/lib/mapa-disponibilidade.ts
app/frontend/src/lib/status-pedido.ts
app/frontend/src/app/api/comercial/pedidos/aberto/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/adendos/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/adendos/confirmar-overbooking/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/liberar-reserva/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/route.ts
app/frontend/src/app/api/comercial/disponibilidade/mapa/route.ts
app/frontend/src/app/api/comercial/disponibilidade/mapa/[itemComercialId]/detalhe/route.ts
app/frontend/src/app/api/comercial/espelho/route.ts
app/frontend/src/app/api/precos/tabelas/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/itens/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/publicar/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/copiar/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/historico/route.ts
app/frontend/src/app/(admin)/comercial/pedidos/pedidos-client.tsx
app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx
app/frontend/src/app/(admin)/comercial/pedidos/modal-overbooking.tsx
app/frontend/src/app/(admin)/comercial/pedidos/modal-adendo.tsx
app/frontend/src/app/(admin)/comercial/pedidos/modal-liberar-reserva.tsx
app/frontend/src/app/(admin)/comercial/tabela-precos/tabela-precos-client.tsx
app/frontend/src/app/(admin)/comercial/disponibilidade/mapa-teatro.tsx
app/frontend/src/app/(admin)/comercial/disponibilidade/detalhe-unidade.tsx
app/frontend/src/app/(admin)/comercial/espelho/espelho-client.tsx
app/frontend/__tests__/onda4-clientes.test.tsx
app/frontend/__tests__/onda4-pedidos.test.tsx
app/frontend/__tests__/onda4-tabela-precos.test.tsx
app/frontend/__tests__/onda4-disponibilidade.test.tsx
app/frontend/__tests__/onda4-espelho.test.tsx
app/frontend/__tests__/onda4-rotas.test.tsx
app/frontend/__tests__/bff-onda4.test.ts
app/frontend/e2e/onda4-comercial.spec.ts
```

### Frontend — alterados (12 arquivos; 1 rota BFF)

```
app/frontend/src/app/api/comercial/pedidos/route.ts             (+ salvarComoRascunho no POST)
app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx
                                     (hoje 18 linhas sobre CadastroMasterDetail genérico →
                                      master-detail fiel a Cadastros.tsx com as 4 abas)
app/frontend/src/app/(admin)/comercial/clientes/page.tsx        (props do client novo)
app/frontend/src/app/(admin)/comercial/pedidos/page.tsx         (usa pedidos-client, sem `modo`)
app/frontend/src/app/(admin)/comercial/tabela-precos/page.tsx   (deixa de ser placeholder)
app/frontend/src/app/(admin)/comercial/disponibilidade/page.tsx (mapa + grade)
app/frontend/src/app/(admin)/comercial/espelho/page.tsx         (deixa de ser placeholder)
app/frontend/src/lib/comercial.ts                                (tipos de adendo/mapa/rascunho)
app/frontend/__tests__/menu-rbac.test.ts       (+ teste nomeado de DoD-113 — Task 3, passo 6)
app/frontend/e2e/jornada-operacional.spec.ts   (dívida 9 da Onda 3 + fim da rota `/pedidos/novo`)
app/frontend/e2e/telas-migradas.spec.ts                          (dívida 9 da Onda 3)
app/frontend/e2e/telas-reais.spec.ts                             (dívida 9 da Onda 3)
```

### Frontend — removidos (D29 / Global Constraint 14)

```
app/frontend/src/app/(admin)/comercial/pedidos/pedido-venda-client.tsx
app/frontend/src/app/(admin)/comercial/pedidos/novo/page.tsx
app/frontend/__tests__/pedido-novo.test.tsx
```

---

## Mapa DoD → teste (1:1)

Cada linha: a regra e o **nome exato do teste que falha se a regra for violada**, com o caminho
real do arquivo (D28). `test/unit/*` roda sem banco; `test/integration/*` sobe o app com Postgres
via `test/helpers/test-app.ts`.

### Clientes

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-70 | A tela tem exatamente as 4 abas do protótipo, na ordem | `app/frontend/__tests__/onda4-clientes.test.tsx` › `clientes exibe as 4 abas do prototipo na ordem` |
| DoD-71 | Nenhum rótulo, atributo ou texto contém `[Mm]arca`; existe "Nome Fantasia" e "Buscar cliente" | `app/frontend/__tests__/onda4-clientes.test.tsx` › `clientes nao usa o termo banido e usa Nome Fantasia e Buscar cliente` |
| DoD-72 | Representante e Rota vêm da API de cadastros, nunca de lista fixa | `app/frontend/__tests__/onda4-clientes.test.tsx` › `selects de representante e rota sao populados pela API de cadastros` |
| DoD-73 | Aba Dados Fiscais & Endereço persiste em `dados_fiscais_json` | `app/backend/test/integration/clientes-onda4.e2e-spec.ts` › `persiste dados fiscais e endereco no jsonb sem perder chaves` |
| DoD-74 | Aba Contatos persiste em `dados_contato_json` | `app/backend/test/integration/clientes-onda4.e2e-spec.ts` › `persiste lista de contatos no jsonb` |
| DoD-75 | `necessitaCorteAcerto` é aceito e persistido nas preferências | `app/backend/test/integration/clientes-onda4.e2e-spec.ts` › `aceita necessitaCorteAcerto nas preferencias operacionais` |
| DoD-76 | `rota_padrao` não existe mais; cliente grava `rota_id` FK | `app/backend/test/unit/onda4-schema.spec.ts` › `cliente grava rota_id e o schema nao expoe rota_padrao` |
| DoD-77 | Badge do cabeçalho mostra a contagem real de clientes ativos | `app/frontend/__tests__/onda4-clientes.test.tsx` › `badge do cabecalho mostra a contagem real de clientes ativos` |

### Pedidos

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-78 | **AD-03**: pedido aberto duplicado em `(cliente, item, operação)` retorna `409 PEDIDO_ABERTO_EXISTENTE` | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `recusa segundo pedido aberto do mesmo cliente item e operacao com 409 PEDIDO_ABERTO_EXISTENTE` |
| DoD-79 | **AD-03**: mesmo cliente e item em **operações diferentes** é permitido | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `permite pedidos abertos do mesmo cliente e item em operacoes diferentes` |
| DoD-80 | Adendo **incrementa** o item existente e grava histórico append-only em `adendos_pedido` + auditoria na mesma transação | `app/backend/test/integration/adendos.e2e-spec.ts` › `adendo incrementa o item e grava linha em adendos_pedido e auditoria na mesma transacao` |
| DoD-81 | Adendo com déficit devolve `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` sem persistir nada (nem `adendos_pedido`, nem reserva, nem mudança de quantidade) | `app/backend/test/integration/adendos.e2e-spec.ts` › `adendo com deficit nao persiste e devolve challenge de overbooking` |
| DoD-82 | Confirmação do adendo soma a quantidade no item, cria a reserva de overbooking e acumula a pendência | `app/backend/test/integration/adendos.e2e-spec.ts` › `confirmacao do adendo soma quantidade cria reserva overbooking e acumula pendencia` |
| DoD-83 | **AD-06**: não existe TTL/agendador de expiração de rascunho no código | `app/backend/test/unit/pedidos.service.spec.ts` › `nao existe expiracao automatica de reserva de rascunho` |
| DoD-84 | **AD-06**: "Liberar reserva" exige justificativa, libera reservas, cancela pendências e audita | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `liberar reserva exige justificativa libera reservas e registra auditoria` |
| DoD-85 | `PEDIDO_RESERVA_LIBERAR` ausente → `403` | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `liberar reserva sem permissao retorna 403` |
| DoD-86 | `salvarComoRascunho: true` cria pedido em `rascunho` **com** reserva ativa | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `salvarComoRascunho cria pedido em rascunho com reserva ativa` |
| DoD-87 | O rótulo "Rascunho com reserva ativa" é derivado e os 9 rótulos do protótipo existem | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `deriva os 9 rotulos de status do prototipo incluindo rascunho com reserva ativa` |
| DoD-88 | Modal de overbooking mostra solicitado, disponível e déficit vindos do `409` | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `modal de overbooking renderiza o payload do 409 sem numero fabricado` |
| DoD-89 | Modal de adendo mostra o pedido aberto existente e envia motivo | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `modal de adendo mostra pedido aberto existente e envia motivo` |
| DoD-90 | Badge "Provisório · P5" presente no modal de adendo | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `modal de adendo exibe badge provisorio P5 da politica de preco` |

### Tabela de Preços

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-91 | Grade tem as 4 faixas A/B/C/D e a coluna Unidade | `app/frontend/__tests__/onda4-tabela-precos.test.tsx` › `grade exibe colunas produto unidade e as quatro faixas A B C D` |
| DoD-92 | Publicar com preço faltando retorna `400 PRECOS_INCOMPLETOS` listando os produtos | `app/backend/test/integration/precos.e2e-spec.ts` › `publicar com preco faltando retorna 400 PRECOS_INCOMPLETOS com os produtos` |
| DoD-93 | Publicação emite `TABELA_PRECO_PUBLICADA` **depois** do commit (e não emite em rollback) | `app/backend/test/unit/precos.service.spec.ts` › `publicacao emite tabela_preco_publicada apos o commit` |
| DoD-94 | Editar tabela publicada volta para rascunho e registra `revertida_para_rascunho` | `app/backend/test/integration/precos.e2e-spec.ts` › `editar tabela publicada volta para rascunho e registra reversao no historico` |
| DoD-95 | Preço ausente é `null` e a UI mostra campo vazio, nunca `0,00` | `app/frontend/__tests__/onda4-tabela-precos.test.tsx` › `preco ausente renderiza campo vazio e nunca zero fabricado` |
| DoD-96 | Uma única tabela por data (índice único parcial) | `app/backend/test/integration/precos.e2e-spec.ts` › `recusa segunda tabela de preco para a mesma data` |
| DoD-97 | `TABELA_PRECO_GERENCIAR` ausente → `403` em publicar | `app/backend/test/integration/precos.e2e-spec.ts` › `publicar sem TABELA_PRECO_GERENCIAR retorna 403` |
| DoD-122 | **D14** — `POST /precos/tabelas/:id/copiar` sem `origemId` usa a última tabela **publicada com data anterior à do destino**; se não existir nenhuma, `409 SEM_TABELA_PRECO_ANTERIOR` e a grade fica intacta | `app/backend/test/integration/precos.e2e-spec.ts` › `copiar sem origemId usa a ultima publicada anterior e devolve 409 quando nao existe anterior` |
| DoD-123 | **D14** — a cópia sobrescreve as 4 faixas de cada produto presente na origem, inclusive com `null`, e preserva os produtos que a origem não tem | `app/backend/test/integration/precos.e2e-spec.ts` › `copiar sobrescreve as faixas dos produtos da origem e preserva os ausentes` |
| DoD-124 | **D14/D16** — copiar sobre tabela `publicada` devolve ao rascunho e registra `revertida_para_rascunho` no histórico | `app/backend/test/integration/precos.e2e-spec.ts` › `copiar em tabela publicada volta para rascunho e registra reversao no historico` |

### Disponibilidade

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-98 | Mapa agrega exatamente os 8 estados `F/V/R/C/D/O/E/!` | `app/backend/test/integration/mapa-disponibilidade.e2e-spec.ts` › `mapa agrega os oito estados F V R C D O E e ocorrencia` |
| DoD-99 | Cada estado sai do SQL de D17 (peça pesada livre = F; carga fechada = E contando item `conferido` **e** `em_carga` e excluindo `removido`; etc.) | `app/backend/test/integration/mapa-disponibilidade.e2e-spec.ts` › `deriva cada estado da tabela de origem correta` |
| DoD-100 | Drill-down devolve as unidades reais do estado clicado | `app/backend/test/integration/mapa-disponibilidade.e2e-spec.ts` › `drill-down devolve as unidades reais do estado selecionado` |
| DoD-101 | O catálogo do mapa é o MVP seedado, nunca o catálogo legado da Grade do protótipo | `app/frontend/__tests__/onda4-disponibilidade.test.tsx` › `mapa usa o catalogo MVP e nao contem o catalogo legado da grade do prototipo` |
| DoD-102 | Seed cria os 11 pares item comercial/produto com `legado_item_comercial_id` 1:1 e é idempotente | `app/backend/test/integration/seed-catalogo-mvp.e2e-spec.ts` › `seed cria onze pares item comercial e produto vinculados um para um` |
| DoD-103 | Itens do catálogo MVP nascem com badge Provisório · P11 na UI | `app/frontend/__tests__/onda4-disponibilidade.test.tsx` › `catalogo MVP exibe badge provisorio P11` |

### Espelho Comercial

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-104 | Os 3 agrupamentos (cliente, rota, representante) produzem totais coerentes | `app/backend/test/integration/espelho.e2e-spec.ts` › `agrupa por cliente rota e representante com totais coerentes` |
| DoD-105 | Status derivado segue a precedência de D19 | `app/backend/test/unit/espelho.service.spec.ts` › `deriva status do item na precedencia cancelado faturado fechado atendido parcial aberto` |
| DoD-106 | Export CSV usa os mesmos filtros e cabeçalho `text/csv` | `app/backend/test/integration/espelho.e2e-spec.ts` › `export csv respeita filtros e devolve content-type text/csv` |
| DoD-107 | `ESPELHO_COMERCIAL_LER` ausente → `403` | `app/backend/test/integration/espelho.e2e-spec.ts` › `espelho sem ESPELHO_COMERCIAL_LER retorna 403` |
| DoD-108 | Badge "Provisório · P15" presente no cabeçalho | `app/frontend/__tests__/onda4-espelho.test.tsx` › `espelho exibe badge provisorio P15 do marco de fechamento` |

### Transversais

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-109 | Nenhuma das 5 rotas é `PlaceholderPage` | `app/frontend/__tests__/onda4-rotas.test.tsx` › `as cinco rotas comerciais nao renderizam PlaceholderPage` (teste **escrito** na Task 20, passo 1) |
| DoD-110 | Nenhum literal hexadecimal de cor fora de `globals.css` | `app/frontend/__tests__/tokens-ds.test.ts` › `nenhum literal hexadecimal de cor em src fora de globals.css` |
| DoD-111 | Nenhum componente chama o backend direto — só BFF (RA-01) | `app/frontend/__tests__/bff-onda4.test.ts` › `nenhuma tela da onda 4 chama o backend fora do BFF` |
| DoD-112 | A palavra banida não aparece em nenhum arquivo da onda | `app/frontend/__tests__/onda4-rotas.test.tsx` › `nenhum arquivo da onda 4 usa o termo banido como rotulo` (teste **escrito** na Task 20, passo 2) |
| DoD-113 | Menu por perfil continua igual à matriz após as permissões novas | `app/frontend/__tests__/menu-rbac.test.ts` › `menus visiveis por perfil batem com a matriz apos as permissoes da onda 4` (teste **escrito** na Task 3, passo 6) |
| DoD-114 | Cobertura backend ≥ 80% linha e branch | `npm run test:cov` (gate do CI, job `coverage`) |
| DoD-115 | O legado de pedido não existe mais: sem `pedido-venda-client.tsx`, sem rota `/comercial/pedidos/novo` | `app/frontend/__tests__/onda4-rotas.test.tsx` › `o cliente legado de pedido e a rota novo nao existem mais` (teste **escrito** na Task 16, passo 1) |
| DoD-116 | `adendos_pedido.origem_consumo` é derivado do déficit do plano (D27), nunca de campo inexistente | `app/backend/test/unit/adendos.service.spec.ts` › `origem do adendo e virtual sem deficit e overbooking com deficit` |
| DoD-117 | As 4 permissões novas entram no catálogo, nas descrições e no snapshot de perfis | `app/backend/test/unit/permissoes-onda4.spec.ts` › `perfis recebem as quatro permissoes novas da onda 4` |
| DoD-118 | Os 3 eventos novos existem no catálogo com payload tipado | `app/backend/test/unit/eventos-onda4.spec.ts` › `catalogo expoe os tres eventos da onda 4` |
| DoD-119 | **Linha 3 da matriz / D31**: o pedido herda a rota do cliente quando o DTO não a informa, mantém `null` se o cliente não tem rota, e o representante vem de `clientes.representante_id` | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `pedido herda rota do cliente e expoe o representante do cadastro` |
| DoD-120 | **Linha 3 da matriz / D31**: selecionar o cliente no editor preenche Representante e Rota a partir do cadastro, sem lista fixa e sem valor fabricado | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `selecionar cliente herda representante e rota do cadastro no editor de pedido` |
| DoD-121 | Criar pedido em data **sem operação ativa** não executa AD-03 e cria a operação do dia; a busca de pedido aberto em data sem operação devolve `404 OPERACAO_NAO_ENCONTRADA` | `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` › `criar em data sem operacao nao checa AD-03 e cria a operacao do dia` |
| DoD-125 | **D32**: teste executa `PATCH` e `DELETE` do BFF aninhado `/:id/itens/:itemId`, prova método/body sem troca, sucesso `204` com corpo vazio e preservação literal de status+bytes nos erros `400`/`404`/`409`; `[id]/route.ts` não exporta `PATCH` | `app/frontend/__tests__/bff-onda4.test.ts` › `BFF de item usa a rota aninhada e os contratos reais de reducao e remocao` |
| DoD-126 | **D32/v1.1 §6.3/§6.9**: no editor persistido, redução positiva chama `PATCH`; quantidade `0` e ícone de remoção chamam `DELETE` com seus motivos; aumento chama adendo; produto ausente chama `POST /itens`; nunca há `PATCH` agregado nem `PATCH` com zero | `app/frontend/__tests__/onda4-pedidos.test.tsx` › `edicao de rascunho traduz reducao zero remocao aumento e produto ausente para os endpoints reais` |

**57 itens de DoD** (DoD-70 a DoD-126), todos com teste nomeado 1:1 — DoD-114 é o gate de cobertura
do CI.

---

## Task 1 — Migração expand + schemas Drizzle

**Files:** `0016_onda4_comercial_expand.sql`, `meta/_journal.json`, `adendos-pedido.schema.ts`,
`tabelas-preco.schema.ts`, `clientes.schema.ts`, `schema/index.ts`.

**Steps**

1. Criar `app/backend/src/database/migrations/0016_onda4_comercial_expand.sql`:

```sql
-- Onda 4 — Comercial. Expand: cria tabelas novas e adiciona clientes.rota_id (com backfill).
CREATE TABLE IF NOT EXISTS "adendos_pedido" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "pedido_venda_id" uuid NOT NULL REFERENCES "pedidos_venda"("id"),
  "pedido_venda_item_id" uuid NOT NULL REFERENCES "pedidos_venda_itens"("id"),
  "item_comercial_id" uuid NOT NULL REFERENCES "itens_comerciais"("id"),
  "operacao_id" uuid NOT NULL REFERENCES "operacoes"("id"),
  "quantidade_anterior" numeric(10,3) NOT NULL,
  "quantidade_adicionada" numeric(10,3) NOT NULL,
  "quantidade_resultante" numeric(10,3) NOT NULL,
  "origem_consumo" text NOT NULL,
  "motivo" text NOT NULL,
  "autor_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_adendos_pedido_quantidade" CHECK ("quantidade_adicionada" > 0),
  CONSTRAINT "chk_adendos_pedido_origem" CHECK ("origem_consumo" IN ('fisico','virtual','overbooking'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_adendos_pedido_pedido" ON "adendos_pedido" ("pedido_venda_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "data" date NOT NULL,
  "status" text DEFAULT 'rascunho' NOT NULL,
  "observacao" text,
  "publicada_por" uuid REFERENCES "usuarios"("id"),
  "publicada_em" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_tabelas_preco_status" CHECK ("status" IN ('rascunho','publicada'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tabelas_preco_data"
  ON "tabelas_preco" ("data") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco_itens" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tabela_preco_id" uuid NOT NULL REFERENCES "tabelas_preco"("id"),
  "produto_id" uuid NOT NULL REFERENCES "produtos"("id"),
  "preco_a" numeric(15,2),
  "preco_b" numeric(15,2),
  "preco_c" numeric(15,2),
  "preco_d" numeric(15,2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_tabelas_preco_itens_positivos" CHECK (
    ("preco_a" IS NULL OR "preco_a" > 0) AND ("preco_b" IS NULL OR "preco_b" > 0) AND
    ("preco_c" IS NULL OR "preco_c" > 0) AND ("preco_d" IS NULL OR "preco_d" > 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tabelas_preco_itens_produto"
  ON "tabelas_preco_itens" ("tabela_preco_id", "produto_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco_publicacoes" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tabela_preco_id" uuid NOT NULL REFERENCES "tabelas_preco"("id"),
  "acao" text NOT NULL,
  "autor_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "observacao" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_tabelas_preco_publicacoes_acao"
    CHECK ("acao" IN ('publicada','revertida_para_rascunho'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tabelas_preco_publicacoes_tabela"
  ON "tabelas_preco_publicacoes" ("tabela_preco_id");
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "rota_id" uuid REFERENCES "rotas"("id");
--> statement-breakpoint
UPDATE "clientes" c SET "rota_id" = r."id"
  FROM "rotas" r
 WHERE c."rota_id" IS NULL AND c."rota_padrao" IS NOT NULL
   AND (r."codigo" = c."rota_padrao" OR r."nome" = c."rota_padrao")
   AND r."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clientes_rota" ON "clientes" ("rota_id")
  WHERE "deleted_at" IS NULL;
```

2. Acrescentar a entrada `{"idx": 16, "version": "7", "when": 1785110400000, "tag":
   "0016_onda4_comercial_expand", "breakpoints": true}` em `meta/_journal.json`.
3. Criar `adendos-pedido.schema.ts` espelhando o SQL (append-only: só `criadoEm`, sem `deletedAt`,
   como `pendencias_overbooking_historico`):

```ts
export const adendosPedido = pgTable(
  'adendos_pedido',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    itemComercialId:      uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
    quantidadeAnterior:   numeric('quantidade_anterior', { precision: 10, scale: 3 }).notNull(),
    quantidadeAdicionada: numeric('quantidade_adicionada', { precision: 10, scale: 3 }).notNull(),
    quantidadeResultante: numeric('quantidade_resultante', { precision: 10, scale: 3 }).notNull(),
    origemConsumo:        text('origem_consumo').notNull(),
    motivo:               text('motivo').notNull(),
    autorId:              uuid('autor_id').notNull().references(() => usuarios.id),
    criadoEm:             timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_adendos_pedido_quantidade', sql`${t.quantidadeAdicionada} > 0`),
    check('chk_adendos_pedido_origem', sql`${t.origemConsumo} IN ('fisico','virtual','overbooking')`),
    index('idx_adendos_pedido_pedido').on(t.pedidoVendaId),
  ],
);
```

4. Criar `tabelas-preco.schema.ts` com `tabelasPreco`, `tabelasPrecoItens` e
   `tabelasPrecoPublicacoes` espelhando o SQL acima.
5. Em `clientes.schema.ts`, adicionar `rotaId: uuid('rota_id').references(() => rotas.id)`.
   **Não** remover `rotaPadrao` ainda (Task 2 faz o contract).
6. Exportar os dois arquivos novos em `schema/index.ts`.
7. Rodar `cd app/backend && npm run db:migrate` contra Postgres 18 local e conferir que as 4 tabelas
   existem e que `clientes.rota_id` foi criado.

**Commit:** `feat(onda4): migração expand e schemas de adendo e tabela de preços`

---

## Task 2 — Migração contract (`rota_padrao` sai)

**Files:** `0017_onda4_comercial_contract.sql`, `meta/_journal.json`, `clientes.schema.ts`.

**Steps (TDD)**

1. Escrever o teste que falha primeiro, em `app/backend/test/unit/onda4-schema.spec.ts` (D28):

```ts
it('cliente grava rota_id e o schema nao expoe rota_padrao', () => {
  expect(Object.keys(clientes)).toContain('rotaId');
  expect(Object.keys(clientes)).not.toContain('rotaPadrao');
});
```

2. Criar `0017_onda4_comercial_contract.sql` com guarda que aborta em backfill incompleto:

```sql
-- Onda 4 — Comercial. Contract: remove clientes.rota_padrao após o backfill do 0016.
DO $$
DECLARE pendentes integer;
BEGIN
  SELECT count(*) INTO pendentes
    FROM "clientes"
   WHERE "deleted_at" IS NULL AND "rota_padrao" IS NOT NULL AND "rota_id" IS NULL;
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'backfill incompleto: % cliente(s) com rota_padrao sem rota_id', pendentes;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "clientes" DROP COLUMN IF EXISTS "rota_padrao";
```

3. Acrescentar `{"idx": 17, ..., "tag": "0017_onda4_comercial_contract", ...}` ao journal.
4. Remover `rotaPadrao` de `clientes.schema.ts` e de todo consumidor. Localizar os consumidores com
   `rg -n "rotaPadrao|rota_padrao" app/backend/src app/backend/test app/frontend/src` e ajustar
   todos (inclusive `app/backend/test/integration/clientes.e2e-spec.ts`) — sem leitura dupla, sem
   fallback.
5. Registrar o passo de rollback em `migrations/ROLLBACK.md` no formato já usado pelas ondas
   anteriores.
6. Rodar `npm run db:migrate` e o teste do passo 1 (agora verde).

**Commit:** `refactor(onda4): contract remove clientes.rota_padrao em favor de rota_id`

---

## Task 3 — Permissões novas e matriz de perfis

**Files:** `app/backend/src/common/rbac/permissoes.ts`,
`app/backend/src/common/rbac/perfil-permissoes.snapshot.json`,
`app/backend/test/unit/permissoes-onda4.spec.ts`,
`app/frontend/__tests__/menu-rbac.test.ts` (teste nomeado de DoD-113).

**Steps (TDD)**

1. Teste primeiro, em `app/backend/test/unit/permissoes-onda4.spec.ts` (D28, mesmo formato de
   `test/unit/permissoes-onda1.spec.ts`):

```ts
it('perfis recebem as quatro permissoes novas da onda 4', () => {
  expect(MAPA_PERFIL_PERMISSOES.gestor).toEqual(expect.arrayContaining([
    PERMISSOES.TABELA_PRECO_LER, PERMISSOES.TABELA_PRECO_GERENCIAR,
    PERMISSOES.ESPELHO_COMERCIAL_LER, PERMISSOES.PEDIDO_RESERVA_LIBERAR,
  ]));
  expect(MAPA_PERFIL_PERMISSOES.comercial).toEqual(expect.arrayContaining([
    PERMISSOES.TABELA_PRECO_LER, PERMISSOES.ESPELHO_COMERCIAL_LER,
  ]));
  expect(MAPA_PERFIL_PERMISSOES.comercial).not.toContain(PERMISSOES.PEDIDO_RESERVA_LIBERAR);
  expect(MAPA_PERFIL_PERMISSOES.expedicao).toContain(PERMISSOES.ESPELHO_COMERCIAL_LER);
  // DESCRICOES_PERMISSOES é Record<Permissao, string>: sem descrição, o type-check quebra.
  for (const chave of [
    PERMISSOES.TABELA_PRECO_LER, PERMISSOES.TABELA_PRECO_GERENCIAR,
    PERMISSOES.ESPELHO_COMERCIAL_LER, PERMISSOES.PEDIDO_RESERVA_LIBERAR,
  ]) {
    expect(DESCRICOES_PERMISSOES[chave]).toEqual(expect.any(String));
  }
});
```

2. Em `PERMISSOES` (`permissoes.ts`), no bloco novo, logo após o bloco da Onda 1:

```ts
  // Onda 4 — Comercial (tabela de preços, espelho e liberação administrativa de reserva).
  TABELA_PRECO_LER: 'TABELA_PRECO_LER',
  TABELA_PRECO_GERENCIAR: 'TABELA_PRECO_GERENCIAR',
  ESPELHO_COMERCIAL_LER: 'ESPELHO_COMERCIAL_LER',
  PEDIDO_RESERVA_LIBERAR: 'PEDIDO_RESERVA_LIBERAR',
```

3. Distribuir com o mesmo mecanismo já usado no arquivo (`pushPermissoes`, depois do objeto), na
   composição de D21:

```ts
pushPermissoes(
  'administrador',
  'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
  'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
);
pushPermissoes(
  'gestor',
  'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
  'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
);
pushPermissoes('comercial', 'TABELA_PRECO_LER', 'ESPELHO_COMERCIAL_LER');
pushPermissoes('expedicao', 'ESPELHO_COMERCIAL_LER');
```

4. Acrescentar as 4 entradas em `DESCRICOES_PERMISSOES` (o `Record<Permissao, string>` é total —
   omitir qualquer uma quebra `npm run type-check`):

```ts
  TABELA_PRECO_LER: 'Consultar tabelas de preço e histórico de publicação',
  TABELA_PRECO_GERENCIAR: 'Criar, editar, copiar e publicar tabelas de preço',
  ESPELHO_COMERCIAL_LER: 'Consultar e exportar o espelho comercial',
  PEDIDO_RESERVA_LIBERAR: 'Liberar administrativamente a reserva de um rascunho (AD-06)',
```

5. Regerar o snapshot de perfis: `cd app/backend && npm run rbac:snapshot`. Sem isso,
   `test/unit/perfil-permissoes-snapshot.spec.ts` falha com as permissões novas.
6. **Escrever** o teste de DoD-113 em `app/frontend/__tests__/menu-rbac.test.ts` — hoje esse
   arquivo **não** tem nenhum `it(...)` com esse nome (os existentes são `zero perdas: …`,
   `zero extras: …`, `menus_visiveis do perfil sao exatamente os da matriz: %s`, entre outros,
   em `menu-rbac.test.ts:161-270`). O teste novo entra no fim do `describe` já existente e usa os
   helpers do próprio arquivo (`PERFIS`, `MATRIZ_RASTREABILIDADE`, `rotasVisiveis`,
   `PERMISSOES_POR_PERFIL`), sem import novo além do snapshot já lido no topo:

```ts
it('menus visiveis por perfil batem com a matriz apos as permissoes da onda 4', () => {
  // As 4 permissões da Onda 4 são de API, não de menu: o menu por perfil não pode se mexer.
  for (const perfil of PERFIS) {
    expect(rotasVisiveis(perfil).sort()).toEqual(menusDaMatriz(perfil));
  }
  expect(ROTAS_CANONICAS).toHaveLength(39);
  expect(PERFIS.reduce((soma, p) => soma + menusDe(p).length, 0)).toBe(126);

  // E as permissões novas chegaram ao snapshot, nos perfis de D21.
  const novas = [
    'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
    'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
  ];
  expect(PERMISSOES_POR_PERFIL.administrador).toEqual(expect.arrayContaining(novas));
  expect(PERMISSOES_POR_PERFIL.gestor).toEqual(expect.arrayContaining(novas));
  expect(PERMISSOES_POR_PERFIL.comercial)
    .toEqual(expect.arrayContaining(['TABELA_PRECO_LER', 'ESPELHO_COMERCIAL_LER']));
  expect(PERMISSOES_POR_PERFIL.comercial).not.toContain('PEDIDO_RESERVA_LIBERAR');
  expect(PERMISSOES_POR_PERFIL.expedicao).toContain('ESPELHO_COMERCIAL_LER');
});
```

   Ele roda **depois** do passo 5: sem `npm run rbac:snapshot`, `perfil-permissoes.snapshot.json`
   ainda não tem as 4 permissões e este teste falha — que é exatamente o comportamento desejado.
7. Rodar `npm run db:seed` e a suíte `menu-rbac.test.ts` inteira até verde.

**Commit:** `feat(onda4): permissões de tabela de preços, espelho e liberação de reserva`

---

## Task 4 — Eventos de domínio novos

**Files:** `app/backend/src/realtime/events/eventos.ts`,
`app/backend/test/unit/eventos-onda4.spec.ts`.

**Steps (TDD)**

1. Teste primeiro, em `app/backend/test/unit/eventos-onda4.spec.ts` (D28):

```ts
it('catalogo expoe os tres eventos da onda 4', () => {
  expect(EVENTOS.ADENDO_REGISTRADO).toBe('adendo_registrado');
  expect(EVENTOS.RESERVA_LIBERADA_ADMIN).toBe('reserva_liberada_admin');
  expect(EVENTOS.TABELA_PRECO_PUBLICADA).toBe('tabela_preco_publicada');
});
```

2. Em `EVENTOS`, no bloco novo:

```ts
  // ── Onda 4 — Comercial ────────────────────────────────────────────────────
  ADENDO_REGISTRADO: 'adendo_registrado',
  RESERVA_LIBERADA_ADMIN: 'reserva_liberada_admin',
  TABELA_PRECO_PUBLICADA: 'tabela_preco_publicada',
```

3. Em `PayloadPorEvento`:

```ts
  adendo_registrado: {
    adendoId: string;
    pedidoVendaId: string;
    itemComercialId: string;
    quantidadeAdicionada: string;
    origemConsumo: 'fisico' | 'virtual' | 'overbooking';
  };
  reserva_liberada_admin: {
    pedidoVendaId: string;
    autorId: string;
    justificativa: string;
  };
  tabela_preco_publicada: { tabelaPrecoId: string; data: string; autorId: string };
```

**Commit:** `feat(onda4): eventos de adendo, liberação de reserva e publicação de preços`

---

## Task 5 — Seed do catálogo MVP (11 pares, Provisório P11)

**Files:** `app/backend/src/database/seed-catalogo-mvp.ts`, `app/backend/src/database/seed.ts`,
`app/backend/test/integration/seed-catalogo-mvp.e2e-spec.ts`.

**Steps (TDD)**

1. Teste primeiro, em `app/backend/test/integration/seed-catalogo-mvp.e2e-spec.ts` (precisa de
   banco → `test/integration`, D28; o `db` sai de `app.get(DRIZZLE)` como em `seed.spec.ts`):

```ts
it('seed cria onze pares item comercial e produto vinculados um para um', async () => {
  await seedCatalogoMvp(db);
  const itens = await db.select().from(itensComerciais);
  const prods = await db.select().from(produtos);
  expect(itens).toHaveLength(11);
  expect(prods).toHaveLength(11);
  expect(prods.every((p) => p.legadoItemComercialId !== null)).toBe(true);
  expect(new Set(prods.map((p) => p.legadoItemComercialId)).size).toBe(11);
  expect(prods.filter((p) => p.unidadePreco === 'unidade').map((p) => p.codigo).sort())
    .toEqual(['CXFIG', 'CXMIU', 'CXRABO']);
});

it('seed e idempotente', async () => {
  await seedCatalogoMvp(db);
  await seedCatalogoMvp(db);
  expect(await db.select().from(produtos)).toHaveLength(11);
});
```

2. Implementar o seed com a tabela literal de D5, sinalizando a pendência no JSONB do produto:

```ts
/** Catálogo MVP extraído do protótipo validado (TabelaPrecos.tsx:29-41). Provisório — P11. */
const CATALOGO_MVP = [
  { codigo: 'TZ',     nome: 'Traseiro Bovino',       unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'DT',     nome: 'Dianteiro Bovino',      unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'PA',     nome: 'Ponta de Agulha',       unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'BPORCO', nome: 'Banda de Porco',        unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'CB',     nome: 'Coxão-bola',            unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'JAC',    nome: 'Jacaré',                unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'CBA',    nome: 'Coxão-bola c/ alcatra', unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'FC',     nome: 'Filé curto',            unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'CXMIU',  nome: 'Caixa de Miúdos',       unidadePreco: 'unidade', tipo: 'entrada_unidade' },
  { codigo: 'CXRABO', nome: 'Caixa de Rabo',         unidadePreco: 'unidade', tipo: 'entrada_unidade' },
  { codigo: 'CXFIG',  nome: 'Caixa de Fígado',       unidadePreco: 'unidade', tipo: 'entrada_unidade' },
] as const;

export async function seedCatalogoMvp(db: Db): Promise<void> {
  for (const linha of CATALOGO_MVP) {
    // uq_itens_comerciais_codigo e uq_produtos_codigo são índices PARCIAIS
    // (WHERE deleted_at IS NULL): o ON CONFLICT precisa repetir o predicado,
    // senão o Postgres não encontra o índice de arbitragem.
    const [item] = await db.insert(itensComerciais)
      .values({
        codigo: linha.codigo,
        descricao: linha.nome,
        unidadeComercial: linha.unidadePreco,
      })
      .onConflictDoNothing({
        target: itensComerciais.codigo,
        targetWhere: isNull(itensComerciais.deletedAt),
      })
      .returning();
    const itemId = item?.id ?? primeiroOuFalha(
      await db.select({ id: itensComerciais.id }).from(itensComerciais)
        .where(and(
          eq(itensComerciais.codigo, linha.codigo),
          isNull(itensComerciais.deletedAt),
        )),
      `item comercial ${linha.codigo} não encontrado após o seed`,
    ).id;
    await db.insert(produtos)
      .values({
        codigo: linha.codigo,
        nome: linha.nome,
        tipoOperacional: linha.tipo,
        unidadePedido: linha.unidadePreco,
        unidadePreco: linha.unidadePreco,
        exigePeso: linha.unidadePreco === 'kg',
        passaDesossa: linha.tipo === 'derivado_desossa',
        legadoItemComercialId: itemId,
        atributosJson: { provisorio: true, pendencia: 'P11', origem: 'prototipo_v1.1' },
      })
      .onConflictDoNothing({
        target: produtos.codigo,
        targetWhere: isNull(produtos.deletedAt),
      });
  }
}
```

`primeiroOuFalha` vem de `src/common/crud/paginacao.ts` (já usado por `PedidosService`): se o item
não existir depois do insert, o seed falha explicitamente em vez de inventar id (RA-05).

3. Chamar `seedCatalogoMvp(db)` em `seed()`, depois do seed de RBAC.
4. Atualizar a nota da Decisão 24 da Onda 3 **apenas no relatório da onda**, citando D5 deste plano
   (não editar o plano da Onda 3).

**Commit:** `feat(onda4): seed do catálogo MVP com 11 pares sinalizados provisório P11`

---

## Task 6 — Unicidade AD-03 e herança do cadastro no backend

**Files:** `pedidos.service.ts`, `pedidos.controller.ts`, `pedido.dto.ts`,
`app/backend/test/integration/pedidos-onda4.e2e-spec.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-78, DoD-79, DoD-119 e DoD-121), em
   `test/integration/pedidos-onda4.e2e-spec.ts` — precisam de banco, então usam `createTestApp` +
   `seedComercialBase` (`test/helpers/`) e o service resolvido do container. Os dois primeiros
   ficam aqui; os corpos de DoD-121 e DoD-119 estão nos passos 6 e 7:

```ts
const service = app.get(PedidosService);

it('recusa segundo pedido aberto do mesmo cliente item e operacao com 409 PEDIDO_ABERTO_EXISTENTE',
  async () => {
    await service.criar(dtoBase, usuarioId);
    await expect(service.criar(dtoBase, usuarioId)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'PEDIDO_ABERTO_EXISTENTE' }),
    });
  });

it('permite pedidos abertos do mesmo cliente e item em operacoes diferentes', async () => {
  await service.criar({ ...dtoBase, dataOperacao: '2026-08-01' }, usuarioId);
  await expect(service.criar({ ...dtoBase, dataOperacao: '2026-08-02' }, usuarioId))
    .resolves.toMatchObject({ status: 'em_elaboracao_reserva_ativa' });
});
```

2. Implementar o guard no service, dentro da mesma transação que já obtém a operação:

```ts
/** AD-03 — a chave funcional do pedido aberto é (cliente, item comercial, operação). */
private static readonly STATUS_ABERTOS = [
  'rascunho', 'em_elaboracao_reserva_ativa', 'aguardando_confirmacao_overbooking',
] as const;

private async exigirUnicidadeAd03(
  tx: Tx, clienteId: string, operacaoId: string, itensComerciaisIds: string[],
  pedidoIdIgnorado?: string,
): Promise<void> {
  const conflitos = await tx
    .select({
      pedidoId: pedidosVenda.id,
      itemComercialId: pedidosVendaItens.itemComercialId,
      quantidadeAtual: pedidosVendaItens.quantidadePedida,
      status: pedidosVenda.status,
    })
    .from(pedidosVendaItens)
    .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
    .where(and(
      eq(pedidosVenda.clienteId, clienteId),
      eq(pedidosVenda.operacaoId, operacaoId),
      inArray(pedidosVenda.status, [...PedidosService.STATUS_ABERTOS]),
      inArray(pedidosVendaItens.itemComercialId, itensComerciaisIds),
      isNull(pedidosVenda.deletedAt),
      isNull(pedidosVendaItens.deletedAt),
      pedidoIdIgnorado ? ne(pedidosVenda.id, pedidoIdIgnorado) : undefined,
    ));
  if (conflitos.length === 0) return;
  throw new ConflictException({
    code: 'PEDIDO_ABERTO_EXISTENTE',
    message: 'Já existe pedido aberto deste cliente para o produto nesta operação. Use o adendo.',
    conflitos,
  });
}
```

   `ne` entra na lista de imports de `drizzle-orm` do arquivo (hoje:
   `and, desc, eq, inArray, isNull, notInArray, sql`).
3. **Caminho explícito quando não existe operação na data.** `exigirUnicidadeAd03` recebe
   `operacaoId: string` (não `string | null`), mas em `criar` o valor vem de
   `this.operacoes.encontrarAtivaPorData(tx, dto.dataOperacao)`, que **devolve `null` quando não há
   operação ativa naquela data** (`operacoes.service.ts:94-99`). O plano fixa os dois ramos por
   extenso; nenhum deles fica implícito e nenhum deles alarga a assinatura:

```ts
// pedidos.service.ts › criar — depois de encontrarAtivaPorData, antes de planejarSobLock.
// Sem operação ativa na data não pode existir pedido aberto para checar: pedidos_venda.operacao_id
// é NOT NULL e FK para operacoes(id), logo o conjunto de conflitos é provadamente vazio.
// A operação é criada logo abaixo por garantirOperacao (primeiro pedido do dia).
if (operacaoExistente) {
  await this.exigirUnicidadeAd03(
    tx,
    dto.clienteId,
    operacaoExistente.id,
    solicitados.map((s) => s.itemComercialId),
  );
}
```

   **Por que não é `throw` aqui.** Um `404`/`400` neste ponto quebraria o primeiro pedido de cada
   data: `criar` cria a operação sob demanda via `garantirOperacao`
   (`pedidos.service.ts:150-153`), e o próprio DoD-79 exercita duas datas novas (`2026-08-01` e
   `2026-08-02`) — com `throw`, o teste nomeado do mapa DoD falharia por construção. O `throw`
   explícito existe, porém, nos caminhos em que a operação é **entrada** e não pode ser inventada
   (passo 4 e passo 5). DoD-121 fixa este ramo em teste.
4. Nos demais chamadores a operação é dado persistido, nunca nulo: `incluirItemTransacional` e os
   dois caminhos de confirmação de overbooking carregam o pedido antes, e
   `pedidos_venda.operacao_id` é `NOT NULL`. Ainda assim, a leitura é explícita e falha alto se o
   invariante for violado:

```ts
// pedidos.service.ts › incluirItemTransacional — antes do planejarSobLock, sem mutação anterior.
if (!pedido.operacaoId) {
  throw new ConflictException({
    code: 'PEDIDO_SEM_OPERACAO',
    message: 'Pedido sem operação vinculada; não é possível validar a unicidade AD-03.',
  });
}
await this.exigirUnicidadeAd03(
  tx, pedido.clienteId, pedido.operacaoId, [dto.itemComercialId], pedido.id,
);
```

5. Expor `GET /comercial/pedidos/aberto?clienteId&itemComercialId&dataOperacao`, que devolve o
   pedido aberto e a quantidade atual (payload do `ModalAdendo`) ou `null`. O parâmetro é
   `dataOperacao` (e não `operacaoId`) porque é isso que o `PedidoEditor` tem em mãos — é o mesmo
   campo de `CreatePedidoDto` (`pedido.dto.ts:35`). Aqui a resolução da operação é entrada do
   usuário e o ramo nulo é **404 explícito**:

```ts
export const buscarPedidoAbertoSchema = z.object({
  clienteId: z.string().uuid(),
  itemComercialId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
});

async buscarAberto(query: BuscarPedidoAbertoDto) {
  return this.db.transaction(async (tx) => {
    const operacao = await this.operacoes.encontrarAtivaPorData(tx, query.dataOperacao);
    if (!operacao) {
      throw new NotFoundException({
        code: 'OPERACAO_NAO_ENCONTRADA',
        message: `Não existe operação ativa em ${query.dataOperacao}.`,
      });
    }
    const [aberto] = await tx
      .select({
        pedidoId: pedidosVenda.id,
        status: pedidosVenda.status,
        itemComercialId: pedidosVendaItens.itemComercialId,
        quantidadeAtual: pedidosVendaItens.quantidadePedida,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(and(
        eq(pedidosVenda.clienteId, query.clienteId),
        eq(pedidosVenda.operacaoId, operacao.id),
        eq(pedidosVendaItens.itemComercialId, query.itemComercialId),
        inArray(pedidosVenda.status, [...PedidosService.STATUS_ABERTOS]),
        isNull(pedidosVenda.deletedAt),
        isNull(pedidosVendaItens.deletedAt),
      ))
      .limit(1);
    return aberto ?? null;
  });
}
```

   No `PedidosController`, o handler entra **entre `@Get()` e `@Get(':id')`**
   (`pedidos.controller.ts:44-54`). A ordem é obrigatória: o Nest casa a primeira rota
   compatível, então declarado depois de `@Get(':id')` a requisição cairia em `detalhar('aberto')`
   e o Postgres rejeitaria `pedidos_venda.id = 'aberto'` como uuid inválido — erro 500 no lugar
   do payload do modal.

```ts
@Get('aberto')
@RequirePermissoes('PEDIDOS_LER')
async buscarAberto(
  @Query(new ZodValidationPipe(buscarPedidoAbertoSchema)) query: BuscarPedidoAbertoDto,
) {
  return this.service.buscarAberto(query);
}
```

   `buscarPedidoAbertoSchema` e `BuscarPedidoAbertoDto` entram no import de `./dto/pedido.dto`
   do controller, junto dos schemas já listados lá.
6. Teste do ramo nulo (DoD-121), em `test/integration/pedidos-onda4.e2e-spec.ts`:

```ts
it('criar em data sem operacao nao checa AD-03 e cria a operacao do dia', async () => {
  const pedido = await service.criar({ ...dtoBase, dataOperacao: '2026-08-09' }, usuarioId);
  expect(pedido.operacaoId).toEqual(expect.any(String));
  await expect(service.buscarAberto({
    clienteId: dtoBase.clienteId,
    itemComercialId: dtoBase.itens[0].itemComercialId,
    dataOperacao: '2026-08-10',
  })).rejects.toMatchObject({
    status: 404,
    response: expect.objectContaining({ code: 'OPERACAO_NAO_ENCONTRADA' }),
  });
});
```

7. **Herança representante → rota no fluxo de pedido (D31).** Aplicar os três blocos literais de
   D31: `rotaHerdadaDoCliente`, a linha `rotaPrevista:` do `insert` em `criar` e os dois
   `leftJoin` de `detalhar`/`listar`. É a lacuna aberta da linha 3 da matriz e é fechada aqui, no
   backend (RA-01) — o frontend só renderiza (Task 15, DoD-120). Teste de DoD-119:

```ts
it('pedido herda rota do cliente e expoe o representante do cadastro', async () => {
  // Cliente com rota e representante no cadastro; DTO sem rotaPrevista.
  const comHeranca = await service.criar(
    { ...dtoBase, clienteId: ctx.clienteComRotaId, rotaPrevista: undefined }, usuarioId,
  );
  expect(comHeranca.rotaPrevista).toBe(ctx.nomeRotaDoCliente);
  const detalhe = await service.detalhar(comHeranca.id);
  expect(detalhe.heranca).toMatchObject({
    representanteId: ctx.representanteId,
    representanteNome: ctx.nomeRepresentante,
    rotaNome: ctx.nomeRotaDoCliente,
  });

  // rotaPrevista explícita sobrepõe a herança.
  const comDesvio = await service.criar(
    { ...dtoBase, clienteId: ctx.clienteComRotaId, dataOperacao: '2026-08-03',
      rotaPrevista: 'Entrega direta' }, usuarioId,
  );
  expect(comDesvio.rotaPrevista).toBe('Entrega direta');

  // Cliente sem rota no cadastro fica null — nada é fabricado (RA-06).
  const semRota = await service.criar(
    { ...dtoBase, clienteId: ctx.clienteSemRotaId, dataOperacao: '2026-08-04',
      rotaPrevista: undefined }, usuarioId,
  );
  expect(semRota.rotaPrevista).toBeNull();
});
```

   `clientes`, `rotas` e `representantes` entram nos imports de schema de `pedidos.service.ts`.

**Commit:** `feat(onda4): unicidade AD-03 e herança de representante e rota no pedido`

---

## Task 7 — Adendo com histórico

**Files:** `adendos.service.ts`, `dto/adendo.dto.ts`, `pedidos.service.ts` (exportações e 3 métodos
reusáveis), `pedidos.controller.ts`, `pedidos.module.ts`,
`app/backend/test/unit/adendos.service.spec.ts`,
`app/backend/test/integration/adendos.e2e-spec.ts`.

### API real da Onda 1 que esta task consome (auditada em `develop`)

Antes de qualquer código: a superfície real de `PedidosService` em
`app/backend/src/modules/comercial/pedidos/pedidos.service.ts` é

```ts
async planejarSobLock(
  tx: Tx, operacaoId: string | null, itens: ItemSolicitado[],
): Promise<PlanoItem[]>                     // 3 parâmetros; NÃO existe { permitirOverbooking }

async persistirItensPlanejados(
  tx: Tx, pedido: PedidoVenda, solicitados: ItemSolicitado[], plano: PlanoItem[], usuarioId: string,
): Promise<{ pedido: PedidoVenda; eventos: EventoDominio[] }>   // 5 parâmetros; sempre INSERT
```

Consequências que o Worker **não pode** ignorar:

1. `planejarSobLock` é **puramente read-only e nunca lança** `OverbookingChallengeException`. Quem
   lança é o chamador, depois de traduzir o plano:
   `const desafios = desafiosParaChallenge(plano); if (desafios.length && !confirmado) throw new
   OverbookingChallengeException(desafios);` — exatamente como `criar` (linhas 145-148) e
   `incluirItemTransacional` (linhas 232-235) já fazem.
2. `desafiosParaChallenge`, `PlanoItem` e `ItemSolicitado` são hoje **privados do módulo**
   (função e interfaces sem `export`). A primeira alteração desta task é exportá-los, sem mudar
   corpo nem semântica.
3. `persistirItensPlanejados` **sempre faz `tx.insert(pedidosVendaItens)`**. O adendo precisa
   **incrementar** um item que já existe → não pode chamá-lo. Para não duplicar o motor de reserva
   (D2), o laço interno de consumo de saldo é **extraído** para um método público
   `aplicarAlocacaoNoItem`, reusado pelos dois caminhos. Não existe parâmetro `itemExistenteId`.
4. Não existe `plano.origemPredominante`: `plano` é `PlanoItem[]`. A origem do adendo é derivada
   por D27.

**Steps (TDD)**

1. Testes primeiro (DoD-80, DoD-81, DoD-82, DoD-116) com os nomes exatos do mapa DoD:
   `test/unit/adendos.service.spec.ts` cobre a derivação de origem (função pura) e a ordem
   commit→emit; `test/integration/adendos.e2e-spec.ts` cobre incremento, challenge sem escrita e
   confirmação com pendência acumulada.
2. DTO:

```ts
export const registrarAdendoSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidadeAdicionada: z.coerce.number().positive().max(9_999_999_999.999),
  motivo: z.string().trim().min(3, 'motivo do adendo é obrigatório').max(1000),
});
export type RegistrarAdendoDto = z.infer<typeof registrarAdendoSchema>;

export const confirmarAdendoOverbookingSchema = registrarAdendoSchema;
```

3. **Em `pedidos.service.ts`** — três alterações mínimas, sem mudar comportamento existente.

   3.1. Exportar o que o adendo precisa reusar:

```ts
export interface ItemSolicitado {          // era `interface` sem export
  itemComercialId: string;
  quantidade: number;
  observacoes?: string;
}

export interface PlanoItem {               // era `interface` sem export
  itemComercialId: string;
  quantidadeSolicitada: string;
  disponivelAntes: string;
  coberturas: CoberturaPlanejada[];
  deficit: string;
}

/** Traduz plano → itens de challenge. Exportado para o AdendosService reusar (D2). */
export function desafiosParaChallenge(plano: PlanoItem[]): OverbookingChallengeItem[] {
  // corpo atual, inalterado
}
```

   3.2. Extrair o laço de consumo de saldo de `persistirItensPlanejados` para um método público, de
   modo que criação e adendo usem o **mesmo** motor. O corpo é o laço interno atual, com a única
   diferença de **acumular** a pendência quando já existe uma aberta para o item (na criação nunca
   existe, então o comportamento da Onda 1 é preservado bit a bit):

```ts
/**
 * Consome as coberturas planejadas e o déficit de um item de pedido JÁ persistido.
 * Extraído de persistirItensPlanejados para que o adendo reuse o motor de reserva
 * sem duplicar regra (D2). Devolve os eventos a emitir após o commit.
 */
async aplicarAlocacaoNoItem(
  tx: Tx,
  pedido: PedidoVenda,
  item: PedidoVendaItem,
  alocacao: PlanoItem,
  usuarioId: string,
): Promise<EventoDominio[]> {
  const eventos: EventoDominio[] = [];
  for (const cobertura of alocacao.coberturas) {
    const atualizada = await tx.execute<{ id: string }>(sql`
      UPDATE disponibilidades_virtuais
      SET quantidade_reservada=quantidade_reservada+${cobertura.quantidade}::numeric,
          quantidade_disponivel=quantidade_disponivel-${cobertura.quantidade}::numeric,
          status=CASE
            WHEN quantidade_disponivel-${cobertura.quantidade}::numeric=0 THEN 'esgotada'
            ELSE 'parcialmente_reservada'
          END
      WHERE id=${cobertura.disponibilidadeId}
        AND quantidade_disponivel >= ${cobertura.quantidade}::numeric
      RETURNING id
    `);
    if (atualizada.rows.length !== 1) {
      throw new ConflictException('Saldo mudou durante a confirmação; refaça a operação');
    }
    await tx.insert(reservasDisponibilidade).values({
      disponibilidadeVirtualId: cobertura.disponibilidadeId,
      pedidoVendaItemId: item.id,
      quantidadeReservada: cobertura.quantidade,
      tipoConsumo: 'virtual',
      status: 'ativa',
    });
  }
  if (ehZero(alocacao.deficit)) return eventos;

  if (!pedido.operacaoId) {
    throw new ConflictException('Pedido sem operação não pode gerar overbooking');
  }
  await tx.insert(reservasDisponibilidade).values({
    disponibilidadeVirtualId: null,
    pedidoVendaItemId: item.id,
    quantidadeReservada: alocacao.deficit,
    tipoConsumo: 'overbooking',
    status: 'ativa',
  });
  const pendenciaId = await this.abrirOuAcumularPendencia(tx, pedido, item, alocacao.deficit, usuarioId);
  eventos.push({
    nome: EVENTOS.PENDENCIA_OVERBOOKING_ABERTA,
    payload: { pendenciaId, pedidoVendaId: pedido.id },
  });
  eventos.push({
    nome: EVENTOS.OVERBOOKING_CONFIRMADO,
    payload: {
      pedidoVendaId: pedido.id,
      itemId: item.id,
      quantidadeOverbooking: alocacao.deficit,
    },
  });
  return eventos;
}

/**
 * Abre a pendência de overbooking do item ou soma o déficit à pendência aberta.
 * Só existe pendência aberta quando o item recebeu adendo deficitário antes; na
 * criação do item o caminho é sempre o INSERT (comportamento da Onda 1 preservado).
 * Acumular em vez de duplicar é obrigatório: atualizarOuCancelarPendencia
 * (reduzirItem/removerItem) resolve UMA pendência aberta por item.
 */
private async abrirOuAcumularPendencia(
  tx: Tx,
  pedido: PedidoVenda,
  item: PedidoVendaItem,
  deficit: string,
  usuarioId: string,
): Promise<string> {
  const [aberta] = await tx.select().from(pendenciasOverbooking)
    .where(and(
      eq(pendenciasOverbooking.pedidoVendaItemId, item.id),
      notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
      isNull(pendenciasOverbooking.deletedAt),
    ))
    .for('update')
    .limit(1);
  if (aberta) {
    const acumulado = somarQtd(aberta.quantidadeDeficit, deficit);
    await tx.update(pendenciasOverbooking)
      .set({ quantidadeDeficit: acumulado, updatedAt: new Date() })
      .where(eq(pendenciasOverbooking.id, aberta.id));
    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: aberta.id,
      acao: 'deficit_aumentado_por_adendo',
      autorId: usuarioId,
      detalheJson: { deficitAdicionado: deficit, deficitTotal: acumulado },
    });
    return aberta.id;
  }
  const [pendencia] = await tx.insert(pendenciasOverbooking).values({
    pedidoVendaId: pedido.id, pedidoVendaItemId: item.id,
    itemComercialId: item.itemComercialId, clienteId: pedido.clienteId,
    vendedorUsuarioId: usuarioId, operacaoId: pedido.operacaoId,
    quantidadeDeficit: deficit,
  }).returning();
  if (!pendencia) throw new Error('Falha ao abrir pendência de overbooking');
  await tx.insert(pendenciasOverbookingHistorico).values({
    pendenciaId: pendencia.id, acao: 'confirmada_pelo_vendedor', autorId: usuarioId,
  });
  return pendencia.id;
}
```

   `persistirItensPlanejados` passa a delegar, mantendo o `PEDIDO_VENDA_ITEM_CRIADO` no lugar:

```ts
    if (!item) throw new Error('Falha ao persistir item do pedido');
    eventos.push(...await this.aplicarAlocacaoNoItem(tx, pedido, item, alocacao, usuarioId));
    eventos.push({
      nome: EVENTOS.PEDIDO_VENDA_ITEM_CRIADO,
      payload: { pedidoVendaId: pedido.id, itemId: item.id },
    });
```

   3.3. Os dois carregadores usados pelo adendo — **definidos aqui, não presumidos**:

```ts
/** Carrega sob lock o pedido que vai receber adendo. Só estados abertos de AD-03 (D7). */
async carregarAbertoParaAdendo(tx: Tx, pedidoId: string): Promise<PedidoVenda> {
  const [pedido] = await tx.select().from(pedidosVenda)
    .where(and(eq(pedidosVenda.id, pedidoId), isNull(pedidosVenda.deletedAt)))
    .for('update')
    .limit(1);
  if (!pedido) throw new NotFoundException('Pedido não encontrado');
  if (!(PedidosService.STATUS_ABERTOS as readonly string[]).includes(pedido.status)) {
    throw new ConflictException({
      code: 'PEDIDO_NAO_ABERTO',
      message: 'O adendo só se aplica a pedido aberto (rascunho, em elaboração ou aguardando '
        + 'confirmação de overbooking).',
    });
  }
  return pedido;
}

/** Exige que o produto JÁ esteja no pedido: adendo aumenta item, não cria item. */
async exigirItemDoPedido(
  tx: Tx, pedidoId: string, itemComercialId: string,
): Promise<PedidoVendaItem> {
  const [item] = await tx.select().from(pedidosVendaItens)
    .where(and(
      eq(pedidosVendaItens.pedidoVendaId, pedidoId),
      eq(pedidosVendaItens.itemComercialId, itemComercialId),
      isNull(pedidosVendaItens.deletedAt),
    ))
    .for('update')
    .limit(1);
  if (!item) {
    throw new NotFoundException({
      code: 'ITEM_NAO_ESTA_NO_PEDIDO',
      message: 'O produto não está neste pedido; use a inclusão de item.',
    });
  }
  return item;
}
```

   `PedidosService.STATUS_ABERTOS` é a constante criada na Task 6. `somarQtd` é o helper decimal
   real de `src/common/crud/decimal.ts` (**não existe `somaDecimal`**; a lista exportada é
   `subtrairQtd`, `somarQtd`, `formatarQtd`, `compararQtd`, `ehZero`, `minimoQtd`, `somarListaQtd`,
   `multiplicar`).

4. **`adendos.service.ts`** — o adendo, contra a API real. `AdendosService` injeta
   `@Inject(DRIZZLE)`, `AuditoriaService`, `EventEmitter2` e `PedidosService`, e é declarado em
   `pedidos.module.ts` (mesmo módulo, sem ciclo de import):

```ts
/** Origem do consumo do adendo, derivada do plano da Onda 1 (D27). */
function origemDoAdendo(alocacao: PlanoItem): 'virtual' | 'overbooking' {
  return ehZero(alocacao.deficit) ? 'virtual' : 'overbooking';
}

async registrar(
  pedidoId: string, dto: RegistrarAdendoDto, usuarioId: string, confirmado: boolean,
): Promise<AdendoResultado> {
  const resultado = await this.db.transaction(async (tx) => {
    const pedido = await this.pedidos.carregarAbertoParaAdendo(tx, pedidoId);
    const item = await this.pedidos.exigirItemDoPedido(tx, pedidoId, dto.itemComercialId);

    // 1) Planejamento read-only. Assinatura real: (tx, operacaoId, itens).
    const [alocacao] = await this.pedidos.planejarSobLock(tx, pedido.operacaoId, [
      { itemComercialId: dto.itemComercialId, quantidade: dto.quantidadeAdicionada },
    ]);
    if (!alocacao) throw new Error('planejarSobLock não devolveu alocação para o adendo');

    // 2) O challenge é responsabilidade do CHAMADOR: planejarSobLock nunca lança.
    //    Este throw acontece antes de qualquer INSERT/UPDATE → DoD-81.
    const desafios = desafiosParaChallenge([alocacao]);
    if (desafios.length && !confirmado) {
      throw new OverbookingChallengeException(desafios);
    }

    // 3) Incremento do item existente (persistirItensPlanejados sempre INSERE; aqui é UPDATE).
    const anterior = item.quantidadePedida;
    const resultante = somarQtd(anterior, dto.quantidadeAdicionada);
    const reservadaAdicional = somarListaQtd(alocacao.coberturas.map((c) => c.quantidade));
    const overbookingTotal = somarQtd(item.quantidadeOverbooking, alocacao.deficit);
    const [itemAtualizado] = await tx.update(pedidosVendaItens).set({
      quantidadePedida: resultante,
      quantidadeReservada: somarQtd(item.quantidadeReservada, reservadaAdicional),
      quantidadeOverbooking: overbookingTotal,
      status: ehZero(overbookingTotal) ? 'totalmente_reservado' : 'overbooking_confirmado',
      updatedAt: new Date(),
    }).where(eq(pedidosVendaItens.id, item.id)).returning();
    if (!itemAtualizado) throw new Error('Falha ao incrementar o item do pedido no adendo');

    // 4) Reservas e pendência pelo motor da Onda 1, sem duplicar regra.
    const eventos = await this.pedidos.aplicarAlocacaoNoItem(
      tx, pedido, itemAtualizado, alocacao, usuarioId,
    );

    // 5) Histórico append-only + auditoria na MESMA transação (RA-02 / DoD-80).
    const [adendo] = await tx.insert(adendosPedido).values({
      pedidoVendaId: pedido.id,
      pedidoVendaItemId: item.id,
      itemComercialId: dto.itemComercialId,
      operacaoId: pedido.operacaoId,
      quantidadeAnterior: anterior,
      quantidadeAdicionada: formatarQtd(dto.quantidadeAdicionada),
      quantidadeResultante: resultante,
      origemConsumo: origemDoAdendo(alocacao),
      motivo: dto.motivo,
      autorId: usuarioId,
    }).returning();
    if (!adendo) throw new Error('Falha ao registrar o adendo');

    await this.auditoria.registrar(tx, {
      tabela: 'adendos_pedido',
      registroId: adendo.id,
      operacao: 'INSERT',
      modulo: 'comercial',
      usuarioId,
      dadosAnteriores: { quantidadePedida: anterior },
      dadosNovos: adendo,
      justificativa: dto.motivo,
    });

    eventos.push({
      nome: EVENTOS.ADENDO_REGISTRADO,
      payload: {
        adendoId: adendo.id,
        pedidoVendaId: pedido.id,
        itemComercialId: dto.itemComercialId,
        quantidadeAdicionada: adendo.quantidadeAdicionada,
        origemConsumo: origemDoAdendo(alocacao),
      },
    });
    return { adendo, item: itemAtualizado, eventos };
  });

  // Eventos SEMPRE fora da transação (RA-04), no padrão real do repositório:
  // EventEmitter2 injetado, um emit por evento — igual a emitirEventosPosCommit.
  for (const evento of resultado.eventos) {
    this.eventEmitter.emit(evento.nome, evento.payload);
  }
  return { adendo: resultado.adendo, item: resultado.item };
}

/** Linha do tempo do pedido: histórico append-only, mais novo primeiro. */
async listar(pedidoId: string) {
  return this.db.select().from(adendosPedido)
    .where(eq(adendosPedido.pedidoVendaId, pedidoId))
    .orderBy(desc(adendosPedido.criadoEm));
}
```

5. Controller — no padrão real de `PedidosController` (`@RequirePermissoes('X')` com literal de
   string, `@CurrentUser() user: CurrentUserPayload` e `user.sub`; **não** existem
   `@RequerPermissao`, `@UsuarioAtual` nem `UsuarioAutenticado` no repositório):

```ts
@Post(':id/adendos')
@HttpCode(HttpStatus.CREATED)
@RequirePermissoes('PEDIDOS_GERENCIAR')
async registrarAdendo(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(registrarAdendoSchema)) dto: RegistrarAdendoDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.adendos.registrar(id, dto, user.sub, false);
}

@Post(':id/adendos/confirmar-overbooking')
@HttpCode(HttpStatus.CREATED)
@RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
async confirmarAdendoOverbooking(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(registrarAdendoSchema)) dto: RegistrarAdendoDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.adendos.registrar(id, dto, user.sub, true);
}

@Get(':id/adendos')
@RequirePermissoes('PEDIDOS_LER')
async listarAdendos(@Param('id') id: string) {
  return this.adendos.listar(id);
}
```

**Commit:** `feat(onda4): adendo de pedido com histórico append-only e overbooking AD-05`

---

## Task 8 — AD-06: liberar reserva e rascunho explícito

**Files:** `pedidos.service.ts`, `pedidos.controller.ts`, `pedido.dto.ts`,
`app/backend/test/unit/pedidos.service.spec.ts` (acrescenta DoD-83),
`app/backend/test/integration/pedidos-onda4.e2e-spec.ts` (DoD-84 a DoD-86).

**Steps (TDD)**

1. Testes primeiro (DoD-83 a DoD-86). DoD-83 é um teste estrutural, sem banco, que impede a volta
   do TTL — acrescentado a `test/unit/pedidos.service.spec.ts`, com varredura literal (sem helper
   inventado):

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fontesDoModulo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return fontesDoModulo(caminho);
    return nome.endsWith('.ts') ? [caminho] : [];
  });
}

it('nao existe expiracao automatica de reserva de rascunho', () => {
  const raiz = join(__dirname, '../../src/modules/comercial');
  const suspeitos = fontesDoModulo(raiz).filter((f) =>
    /@Cron|SchedulerRegistry|setTimeout\(|setInterval\(|expiraEm|ttlReserva/
      .test(readFileSync(f, 'utf8')));
  expect(suspeitos).toEqual([]);
});
```

2. DTO:

```ts
export const liberarReservaSchema = z.object({
  justificativa: z.string().trim().min(10, 'justificativa deve ter ao menos 10 caracteres').max(1000),
});
export type LiberarReservaDto = z.infer<typeof liberarReservaSchema>;
```

   E em `createPedidoSchema`, o campo novo: `salvarComoRascunho: z.boolean().optional().default(false)`.
3. Em `criar`, o status inicial passa a ser
   `dto.salvarComoRascunho ? 'rascunho' : 'em_elaboracao_reserva_ativa'`; as reservas são criadas nos
   dois casos (AD-06: rascunho tem reserva ativa).
4. Novo método, reusando os métodos públicos que **já existem** em `PedidosService` — não há helper
   novo a inventar: a liberação por item é `liberarTodasReservasDoItem(tx, itemId)` (linhas 492-511)
   e o cancelamento de pendências do pedido é `cancelarPendenciasDoPedido(tx, pedidoId, usuarioId)`
   (linhas 513-530). **Não existem** `liberarTodasReservasDoPedido`,
   `cancelarPendenciasOverbookingDoPedido` nem `carregarComReservaAtiva`; o carregador com lock é
   `obterPedidoAtivoSobLock(tx, pedidoId)` (privado, linhas 640-647) e é ele que se usa:

```ts
/** AD-06 — única liberação além de remoção/cancelamento pelo vendedor. Sem TTL, sem job. */
async liberarReservaAdministrativa(
  pedidoId: string, dto: LiberarReservaDto, usuarioId: string,
): Promise<{ id: string; status: string }> {
  const resultado = await this.db.transaction(async (tx) => {
    const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId);
    if (pedido.status !== 'rascunho') {
      throw new BadRequestException({
        code: 'PEDIDO_NAO_ESTA_EM_RASCUNHO',
        message: 'A liberação administrativa só se aplica a rascunho com reserva ativa.',
      });
    }
    const itens = await tx.select().from(pedidosVendaItens)
      .where(and(
        eq(pedidosVendaItens.pedidoVendaId, pedido.id),
        isNull(pedidosVendaItens.deletedAt),
      ));
    const reservasAtivas = await tx.select({ id: reservasDisponibilidade.id })
      .from(reservasDisponibilidade)
      .where(and(
        inArray(reservasDisponibilidade.pedidoVendaItemId, itens.map((i) => i.id)),
        eq(reservasDisponibilidade.status, 'ativa'),
      ));
    if (reservasAtivas.length === 0) {
      throw new BadRequestException({
        code: 'PEDIDO_SEM_RESERVA_ATIVA',
        message: 'Este rascunho não tem reserva ativa a liberar.',
      });
    }
    for (const item of itens) {
      await this.liberarTodasReservasDoItem(tx, item.id);
    }
    await this.cancelarPendenciasDoPedido(tx, pedido.id, usuarioId);
    const [liberado] = await tx.update(pedidosVenda)
      .set({ status: 'cancelado', motivoCancelamento: dto.justificativa, updatedAt: new Date() })
      .where(eq(pedidosVenda.id, pedido.id))
      .returning();
    if (!liberado) throw new Error('Falha ao liberar a reserva do rascunho');
    await this.auditoria.registrar(tx, {
      tabela: 'pedidos_venda', registroId: pedido.id, operacao: 'UPDATE',
      modulo: 'comercial', usuarioId,
      dadosAnteriores: { status: pedido.status },
      dadosNovos: { status: 'cancelado', acao: 'liberar_reserva' },
      justificativa: dto.justificativa,
    });
    return {
      pedido: { id: pedido.id, status: 'cancelado' },
      eventos: [{
        nome: EVENTOS.RESERVA_LIBERADA_ADMIN,
        payload: {
          pedidoVendaId: pedido.id, autorId: usuarioId, justificativa: dto.justificativa,
        },
      }] as EventoDominio[],
    };
  });
  // Não existe RealtimeService.emitir: o padrão real é EventEmitter2 pós-commit,
  // pelo emitirEventosPosCommit privado que já existe no service (linhas 634-638).
  this.emitirEventosPosCommit(resultado.eventos);
  return resultado.pedido;
}
```

5. Controller — padrão real (literal de permissão, `@CurrentUser`, `user.sub`):

```ts
@Post(':id/liberar-reserva')
@HttpCode(HttpStatus.OK)
@RequirePermissoes('PEDIDO_RESERVA_LIBERAR')
async liberarReserva(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(liberarReservaSchema)) dto: LiberarReservaDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.liberarReservaAdministrativa(id, dto, user.sub);
}
```

**Commit:** `feat(onda4): liberação administrativa auditada de reserva e rascunho explícito (AD-06)`

---

## Task 9 — Módulo de Tabela de Preços

**Files:** `precos.module.ts`, `precos.controller.ts`, `precos.service.ts`,
`dto/tabela-preco.dto.ts`, `app.module.ts`,
`app/backend/test/unit/precos.service.spec.ts` (DoD-93, ordem commit→emit),
`app/backend/test/integration/precos.e2e-spec.ts` (DoD-92, DoD-94, DoD-96, DoD-97 e
DoD-122 a DoD-124, os três da cópia).

**Steps (TDD)**

1. Testes primeiro (DoD-92 a DoD-94, DoD-96, DoD-97, DoD-122, DoD-123 e DoD-124), com os nomes
   exatos do *Mapa DoD → teste*.
2. DTOs:

```ts
export const criarTabelaPrecoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  observacao: z.string().trim().max(500).optional(),
});

const precoOpcional = z.coerce.number().positive().max(9_999_999_999.99).nullable().optional();

export const salvarItensTabelaPrecoSchema = z.object({
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    precoA: precoOpcional, precoB: precoOpcional,
    precoC: precoOpcional, precoD: precoOpcional,
  })).min(1),
});

export const copiarTabelaPrecoSchema = z.object({ origemId: z.string().uuid().optional() });
export const publicarTabelaPrecoSchema = z.object({
  observacao: z.string().trim().max(500).optional(),
});
```

3. Service — `criar` monta as linhas a partir do catálogo e da última publicada:

```ts
async criar(dto: CriarTabelaPrecoDto, usuarioId: string) {
  const criada = await this.db.transaction(async (tx) => {
    const [existente] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(eq(tabelasPreco.data, dto.data), isNull(tabelasPreco.deletedAt)));
    if (existente) {
      throw new ConflictException({
        code: 'TABELA_PRECO_DUPLICADA',
        message: `Já existe tabela de preços para ${dto.data}.`,
      });
    }
    // `primeiroOuFalha` (src/common/crud/paginacao.ts) porque sob `noUncheckedIndexedAccess`
    // o `.returning()` é `T[]` e `linhas[0]` é `T | undefined` — mesmo padrão de
    // `PedidosService.criar` (pedidos.service.ts:154) e dos 4 services de cadastros.
    const tabela = primeiroOuFalha(
      await tx.insert(tabelasPreco)
        .values({ data: dto.data, observacao: dto.observacao }).returning(),
      'Criação da tabela de preços não retornou registro',
    );
    const catalogo = await tx.select({ id: produtos.id }).from(produtos)
      .where(and(eq(produtos.status, 'ativo'), eq(produtos.ativoVenda, true),
                 isNull(produtos.deletedAt)));
    const base = await this.precosDaUltimaPublicada(tx);
    await tx.insert(tabelasPrecoItens).values(catalogo.map((p) => ({
      tabelaPrecoId: tabela.id,
      produtoId: p.id,
      precoA: base.get(p.id)?.precoA ?? null,
      precoB: base.get(p.id)?.precoB ?? null,
      precoC: base.get(p.id)?.precoC ?? null,
      precoD: base.get(p.id)?.precoD ?? null,
    })));
    await this.auditoria.registrar(tx, {
      tabela: 'tabelas_preco', registroId: tabela.id, operacao: 'INSERT',
      modulo: 'comercial.precos', usuarioId, dadosNovos: { data: dto.data },
    });
    return tabela;
  });
  // `detalhar` lê por `this.db`, que é OUTRA conexão do pool: chamado de dentro da transação
  // ele não enxergaria as linhas ainda não commitadas e lançaria 404, revertendo a criação
  // inteira. A leitura vai depois do commit — mesmo padrão de `publicar` e `salvarItens`.
  return this.detalhar(criada.id);
}
```

   `primeiroOuFalha` entra nos imports de `../../../common/crud/paginacao`. É a única
   desestruturação de `.returning()` da Task 9: os demais `const [x] = …` deste arquivo
   (`existente`, `ultima`, `tabela` de `exigirTabela` e de `detalhar`) são `select` já
   guardados por `if (!x)` ou por checagem de existência logo abaixo.

   `publicar` valida a completude antes de escrever:

```ts
async publicar(id: string, dto: PublicarTabelaPrecoDto, usuarioId: string) {
  const publicada = await this.db.transaction(async (tx) => {
    const tabela = await this.exigirTabela(tx, id);
    const incompletos = await tx
      .select({ codigo: produtos.codigo, nome: produtos.nome })
      .from(tabelasPrecoItens)
      .innerJoin(produtos, eq(tabelasPrecoItens.produtoId, produtos.id))
      .where(and(eq(tabelasPrecoItens.tabelaPrecoId, id), or(
        isNull(tabelasPrecoItens.precoA), isNull(tabelasPrecoItens.precoB),
        isNull(tabelasPrecoItens.precoC), isNull(tabelasPrecoItens.precoD),
      )));
    if (incompletos.length > 0) {
      throw new BadRequestException({
        code: 'PRECOS_INCOMPLETOS',
        message: 'Todos os produtos precisam das quatro faixas preenchidas para publicar.',
        produtos: incompletos,
      });
    }
    await tx.update(tabelasPreco)
      .set({ status: 'publicada', publicadaPor: usuarioId, publicadaEm: new Date(),
             updatedAt: new Date() })
      .where(eq(tabelasPreco.id, id));
    await tx.insert(tabelasPrecoPublicacoes)
      .values({ tabelaPrecoId: id, acao: 'publicada', autorId: usuarioId,
                observacao: dto.observacao });
    await this.auditoria.registrar(tx, {
      tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
      modulo: 'comercial.precos', usuarioId,
      dadosAnteriores: { status: tabela.status }, dadosNovos: { status: 'publicada' },
    });
    return { id, data: tabela.data };
  });
  // Evento pós-commit com EventEmitter2 injetado — padrão real do repositório
  // (não existe RealtimeService.emitir). RA-04 / DoD-93.
  this.eventEmitter.emit(EVENTOS.TABELA_PRECO_PUBLICADA, {
    tabelaPrecoId: publicada.id, data: publicada.data, autorId: usuarioId,
  });
  return this.detalhar(id);
}
```

   `salvarItens` faz o upsert dos preços e, se a tabela estava `publicada`, devolve ao `rascunho`
   gravando `revertida_para_rascunho` no histórico (D16) — tudo na mesma transação:

```ts
async salvarItens(id: string, dto: SalvarItensTabelaPrecoDto, usuarioId: string) {
  await this.db.transaction(async (tx) => {
    const tabela = await this.exigirTabela(tx, id);
    for (const item of dto.itens) {
      await tx.insert(tabelasPrecoItens)
        .values({
          tabelaPrecoId: id,
          produtoId: item.produtoId,
          precoA: item.precoA ?? null, precoB: item.precoB ?? null,
          precoC: item.precoC ?? null, precoD: item.precoD ?? null,
        })
        .onConflictDoUpdate({
          // uq_tabelas_preco_itens_produto é índice TOTAL (a tabela é linha-filha e não tem
          // deleted_at, ver 0016) — logo não leva targetWhere, ao contrário de uq_tabelas_preco_data.
          target: [tabelasPrecoItens.tabelaPrecoId, tabelasPrecoItens.produtoId],
          set: {
            precoA: item.precoA ?? null, precoB: item.precoB ?? null,
            precoC: item.precoC ?? null, precoD: item.precoD ?? null,
            updatedAt: new Date(),
          },
        });
    }
    if (tabela.status === 'publicada') {
      await tx.update(tabelasPreco)
        .set({ status: 'rascunho', publicadaPor: null, publicadaEm: null, updatedAt: new Date() })
        .where(eq(tabelasPreco.id, id));
      await tx.insert(tabelasPrecoPublicacoes).values({
        tabelaPrecoId: id, acao: 'revertida_para_rascunho', autorId: usuarioId,
        observacao: 'Edição de tabela publicada (D16).',
      });
    }
    await this.auditoria.registrar(tx, {
      tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
      modulo: 'comercial.precos', usuarioId,
      dadosAnteriores: { status: tabela.status },
      dadosNovos: { status: 'rascunho', produtosAlterados: dto.itens.map((i) => i.produtoId) },
    });
  });
  return this.detalhar(id);
}
```

   `copiar` implementa a ação **"Copiar tabela anterior"** do protótipo
   (`TabelaPrecos.tsx:158-162`) com as três regras de D14: origem, sobrescrita e destino publicado.

```ts
async copiar(id: string, dto: CopiarTabelaPrecoDto, usuarioId: string) {
  await this.db.transaction(async (tx) => {
    const destino = await this.exigirTabela(tx, id);
    if (dto.origemId === id) {
      throw new BadRequestException({
        code: 'COPIA_ORIGEM_IGUAL_AO_DESTINO',
        message: 'A origem da cópia não pode ser a própria tabela.',
      });
    }
    // Sem `origemId`, a origem é a última publicada ANTERIOR à data do destino — é o
    // "Copiar tabela anterior" do protótipo, e o recorte por data também impede a tabela
    // publicada de copiar a si mesma quando é a mais recente do banco.
    const origem = dto.origemId
      ? await this.precosDaTabela(tx, dto.origemId)
      : await this.precosDaUltimaPublicada(tx, destino.data);
    if (origem.size === 0) {
      throw new ConflictException({
        code: 'SEM_TABELA_PRECO_ANTERIOR',
        message: dto.origemId
          ? 'A tabela de origem não tem linhas para copiar.'
          : 'Não existe tabela de preços publicada anterior para copiar.',
      });
    }
    // Sobrescrita por produto presente na origem, inclusive com `null` (RA-06: copiar a
    // ausência de preço é o dado real da origem). Produto do destino que a origem não tem
    // fica intacto, e produto da origem que não está na grade do destino é ignorado — a
    // grade do destino é o catálogo ativo montado em `criar` e a cópia não cria linha nova.
    for (const [produtoId, faixas] of origem) {
      await tx.update(tabelasPrecoItens)
        .set({ ...faixas, updatedAt: new Date() })
        .where(and(
          eq(tabelasPrecoItens.tabelaPrecoId, id),
          eq(tabelasPrecoItens.produtoId, produtoId),
        ));
    }
    // Destino publicado volta ao rascunho, exatamente como no protótipo
    // (`TabelaPrecos.tsx:160`) e pela mesma regra de D16 que `salvarItens` aplica.
    if (destino.status === 'publicada') {
      await tx.update(tabelasPreco)
        .set({ status: 'rascunho', publicadaPor: null, publicadaEm: null, updatedAt: new Date() })
        .where(eq(tabelasPreco.id, id));
      await tx.insert(tabelasPrecoPublicacoes).values({
        tabelaPrecoId: id, acao: 'revertida_para_rascunho', autorId: usuarioId,
        observacao: 'Cópia de tabela anterior sobre tabela publicada (D14/D16).',
      });
    }
    await this.auditoria.registrar(tx, {
      tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
      modulo: 'comercial.precos', usuarioId,
      dadosAnteriores: { status: destino.status },
      dadosNovos: {
        acao: 'copiar_tabela_anterior',
        origemId: dto.origemId ?? null,
        status: 'rascunho',
        produtosCopiados: [...origem.keys()],
      },
    });
  });
  return this.detalhar(id);
}
```

   A cópia **não** emite evento: nada foi publicado. `detalhar` fica fora da transação pela
   mesma razão de `criar`.

   Os quatro helpers que `criar`, `publicar`, `salvarItens` e `copiar` chamam, por extenso —
   nenhum é citado sem corpo:

```ts
// Alias local por arquivo, convenção do repositório (`disponibilidade.service.ts:12`).
type Tx = NodePgDatabase<typeof schema>;

type FaixasDePreco = {
  precoA: string | null; precoB: string | null;
  precoC: string | null; precoD: string | null;
};
type MapaDePrecos = Map<string, FaixasDePreco>;

/** Preços de uma tabela específica, indexados por produto. Falha se a tabela não existe. */
private async precosDaTabela(tx: Tx, tabelaPrecoId: string): Promise<MapaDePrecos> {
  const [origem] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
    .where(and(eq(tabelasPreco.id, tabelaPrecoId), isNull(tabelasPreco.deletedAt)))
    .limit(1);
  if (!origem) throw new NotFoundException('Tabela de preços de origem não encontrada');
  const linhas = await tx
    .select({
      produtoId: tabelasPrecoItens.produtoId,
      precoA: tabelasPrecoItens.precoA, precoB: tabelasPrecoItens.precoB,
      precoC: tabelasPrecoItens.precoC, precoD: tabelasPrecoItens.precoD,
    })
    .from(tabelasPrecoItens)
    .where(eq(tabelasPrecoItens.tabelaPrecoId, origem.id));
  return new Map(linhas.map((l) => [l.produtoId, {
    precoA: l.precoA, precoB: l.precoB, precoC: l.precoC, precoD: l.precoD,
  }]));
}

/**
 * Preços da última tabela publicada, indexados por produto. Vazio se nunca houve publicação.
 * `anteriorA` restringe a busca às tabelas com data menor — usado por `copiar`; `criar` não
 * passa nada porque a tabela do dia acabou de nascer em `rascunho`.
 */
private async precosDaUltimaPublicada(tx: Tx, anteriorA?: string): Promise<MapaDePrecos> {
  const [ultima] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
    .where(and(
      eq(tabelasPreco.status, 'publicada'),
      isNull(tabelasPreco.deletedAt),
      ...(anteriorA ? [lt(tabelasPreco.data, anteriorA)] : []),
    ))
    .orderBy(desc(tabelasPreco.data))
    .limit(1);
  if (!ultima) return new Map();
  return this.precosDaTabela(tx, ultima.id);
}

/** Carrega a tabela sob lock de linha ou falha alto. Nunca devolve undefined mascarado. */
private async exigirTabela(tx: Tx, id: string) {
  const [tabela] = await tx.select().from(tabelasPreco)
    .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
    .for('update')
    .limit(1);
  if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
  return tabela;
}

/** Leitura da tabela com a grade completa e o histórico. Preço ausente permanece null (RA-06). */
async detalhar(id: string) {
  const [tabela] = await this.db.select().from(tabelasPreco)
    .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
    .limit(1);
  if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
  const itens = await this.db
    .select({
      produtoId: produtos.id,
      codigo: produtos.codigo,
      nome: produtos.nome,
      unidadePreco: produtos.unidadePreco,
      provisorio: sql<boolean>`coalesce((${produtos.atributosJson}->>'provisorio')::boolean, false)`,
      precoA: tabelasPrecoItens.precoA, precoB: tabelasPrecoItens.precoB,
      precoC: tabelasPrecoItens.precoC, precoD: tabelasPrecoItens.precoD,
    })
    .from(tabelasPrecoItens)
    .innerJoin(produtos, eq(tabelasPrecoItens.produtoId, produtos.id))
    .where(eq(tabelasPrecoItens.tabelaPrecoId, id))
    .orderBy(asc(produtos.codigo));
  const historico = await this.db.select().from(tabelasPrecoPublicacoes)
    .where(eq(tabelasPrecoPublicacoes.tabelaPrecoId, id))
    .orderBy(desc(tabelasPrecoPublicacoes.criadoEm));
  return { ...tabela, itens, historico };
}
```

   `asc`, `desc`, `lt`, `or` e `sql` entram nos imports de `drizzle-orm` do arquivo;
   `NotFoundException`, `BadRequestException` e `ConflictException`, nos de `@nestjs/common`.
4. Controller `@Controller('precos/tabelas')` no padrão de `PedidosController` (`@SkipThrottle`,
   `@UseGuards(JwtAuthGuard, RbacGuard)`, `@RequirePermissoes` por rota, `@CurrentUser` com
   `user.sub`, `ZodValidationPipe` no corpo). Leitura com `TABELA_PRECO_LER`, escrita com
   `TABELA_PRECO_GERENCIAR`. As sete rotas, por extenso:

```ts
@SkipThrottle()
@Controller('precos/tabelas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PrecosController {
  constructor(private readonly service: PrecosService) {}

  @Get()
  @RequirePermissoes('TABELA_PRECO_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('TABELA_PRECO_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  // D30 — caminho da matriz; a tabela continua `tabelas_preco_publicacoes`.
  @Get(':id/historico')
  @RequirePermissoes('TABELA_PRECO_LER')
  async historico(@Param('id') id: string) {
    return this.service.historico(id);
  }

  @Post()
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(criarTabelaPrecoSchema)) dto: CriarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id/itens')
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async salvarItens(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(salvarItensTabelaPrecoSchema)) dto: SalvarItensTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.salvarItens(id, dto, user.sub);
  }

  @Post(':id/copiar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async copiar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(copiarTabelaPrecoSchema)) dto: CopiarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.copiar(id, dto, user.sub);
  }

  @Post(':id/publicar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async publicar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(publicarTabelaPrecoSchema)) dto: PublicarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.publicar(id, dto, user.sub);
  }
}
```

   Não há ambiguidade de rota aqui: `:id` e `:id/historico` têm profundidades diferentes, ao
   contrário do caso de `GET /comercial/pedidos/aberto` (Task 6, passo 5), onde a rota literal
   colide com `:id`. `listar` e `historico` são leituras diretas por `this.db`, sem transação:

```ts
type TabelaPreco = typeof tabelasPreco.$inferSelect;   // padrão de `clientes.service.ts:11`

async listar(query: ListarQuery): Promise<Paginado<TabelaPreco>> {
  const { limit, offset } = calcularRange(query);
  const where = query.incluirRemovidos ? undefined : isNull(tabelasPreco.deletedAt);
  const [linhas, totalRow] = await Promise.all([
    this.db.select().from(tabelasPreco).where(where)
      .orderBy(desc(tabelasPreco.data)).limit(limit).offset(offset),
    this.db.select({ total: sql<number>`count(*)::int` }).from(tabelasPreco).where(where),
  ]);
  return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
}

/** D30 — histórico append-only da tabela. 404 explícito se a tabela não existe. */
async historico(id: string) {
  const [tabela] = await this.db.select({ id: tabelasPreco.id }).from(tabelasPreco)
    .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
    .limit(1);
  if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
  return this.db.select().from(tabelasPrecoPublicacoes)
    .where(eq(tabelasPrecoPublicacoes.tabelaPrecoId, id))
    .orderBy(desc(tabelasPrecoPublicacoes.criadoEm));
}
```

   `calcularRange`, `montarPaginado`, `primeiroOuFalha`, `listarQuerySchema`, `ListarQuery` e
   `Paginado` vêm de `../../../common/crud/paginacao`, como nos quatro services de cadastros.
5. Registrar `PrecosModule` em `app.module.ts`.

**Commit:** `feat(onda4): módulo de tabela de preços A/B/C/D com publicação auditada`

---

## Task 10 — Mapa teatro e drill-down da Disponibilidade

**Files:** `mapa.service.ts`, `dto/mapa.dto.ts`, `disponibilidade.controller.ts`,
`disponibilidade.module.ts`, `app/backend/test/helpers/onda4-fixtures.ts`,
`app/backend/test/integration/mapa-disponibilidade.e2e-spec.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-98 a DoD-100), em `test/integration/mapa-disponibilidade.e2e-spec.ts` — as
   8 consultas são SQL sobre 6 tabelas, então o teste é de banco real, com fixtures em
   `test/helpers/onda4-fixtures.ts` que produzem pelo menos uma linha em cada estado de D17
   (peça pesada livre, saldo virtual, reserva de rascunho, reserva de pedido finalizado, peça
   `para_corte`, reserva de overbooking, item em caminhão `fechado`, peça `divergente`).

   Para o estado **E**, a fixture é obrigatoriamente de três linhas em `carga_itens` do mesmo
   caminhão `fechado`, cobrindo os três valores de `chk_carga_itens_status` (nota de D17):

```ts
/** Estado E — dois itens vivos (um já conferido) e um removido, no mesmo caminhão fechado. */
export async function semearCargaFechadaParaMapa(db: Db, ctx: CtxFixture) {
  await db.insert(cargaItens).values([
    { caminhaoId: ctx.caminhaoFechadoId, tipoOrigem: 'peca',    pecaId: ctx.pecaConferidaId,
      pedidoVendaId: ctx.pedidoId, pedidoVendaItemId: ctx.pedidoItemId,
      statusCargaItem: 'conferido', conferido: true },
    { caminhaoId: ctx.caminhaoFechadoId, tipoOrigem: 'subitem', subitemId: ctx.subitemEmCargaId,
      pedidoVendaId: ctx.pedidoId, pedidoVendaItemId: ctx.pedidoItemId,
      statusCargaItem: 'em_carga',  conferido: false },
    { caminhaoId: ctx.caminhaoFechadoId, tipoOrigem: 'peca',    pecaId: ctx.pecaRemovidaId,
      pedidoVendaId: ctx.pedidoId, pedidoVendaItemId: ctx.pedidoItemId,
      statusCargaItem: 'removido',  conferido: false, observacoes: 'trocada antes do fechamento' },
  ]);
}
```

   E a asserção de DoD-99 para E pega o erro exato que a emenda corrige — o item `'conferido'`
   **conta**, o `'removido'` **não**:

```ts
it('deriva cada estado da tabela de origem correta', async () => {
  const mapa = await service.consultar(ctx.operacaoId);
  const linha = mapa.find((l) => l.itemComercialId === ctx.itemComercialId)!;
  // peça conferida + subitem em carga; a peça removida fica fora.
  expect(linha.unidades.E).toBe(2);
  expect(linha.estados.E).toBe(somarQtd(ctx.pesoPecaConferida, ctx.pesoSubitemEmCarga));
  // ... demais estados F/V/R/C/D/O/! na mesma asserção
});
```
2. DTO e contrato — o parâmetro é `operacaoId` (matriz linha 6:
   `GET /comercial/disponibilidade/mapa?operacaoId=`), que é a chave usada pelos 8 SQL de D17:

```ts
export const consultarMapaSchema = z.object({
  operacaoId: z.string().uuid(),
  itemComercialId: z.string().uuid().optional(),
});

export const drillDownSchema = consultarMapaSchema.extend({
  estado: z.enum(['F', 'V', 'R', 'C', 'D', 'O', 'E', '!']),
});

export type EstadoMapa = 'F' | 'V' | 'R' | 'C' | 'D' | 'O' | 'E' | '!';

export interface MapaProduto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  provisorio: boolean;                        // badge P11 do catálogo MVP
  estados: Record<EstadoMapa, string>;        // NUMERIC(.,3) como string (sem drift — S4)
  unidades: Record<EstadoMapa, number>;       // contagem de peças/subitens onde faz sentido
  saldoComercial: string;                     // F + V − R − O, via somarQtd/subtrairQtd
}
```

3. `MapaService.consultar(operacaoId, itemComercialId?)` executa **as oito consultas literais de
   D17** (uma por estado, `tx.execute(sql`…`)`), une os resultados por `item_comercial_id` e
   completa o eixo com o catálogo (`itens_comerciais` ativos, `join produtos` por
   `legado_item_comercial_id` para o badge Provisório). Estado sem linha vira `'0.000'`, nunca
   `null` mascarado. Nenhuma coluna nova, nenhum estado persistido.
4. `MapaService.detalhar(operacaoId, itemComercialId, estado)` devolve as unidades reais do estado,
   reusando o mesmo `WHERE` da consulta agregada sem o `GROUP BY`:
   - `F`/`D`/`!` → `pecas` (`etiqueta_atual`, `peso_original`, `status_peca`, `recebimento_id`),
     via `join recebimentos` para filtrar `operacao_id`;
   - `E` → `carga_itens` + `caminhoes` (placa, status) + peça **ou** subitem;
   - `V` → `disponibilidades_virtuais` + `compras_programadas` (compra de origem);
   - `R`/`C`/`O` → `reservas_disponibilidade` + `pedidos_venda_itens` + `pedidos_venda` + `clientes`.
5. Rotas: `GET /comercial/disponibilidade/mapa?operacaoId=` e
   `GET /comercial/disponibilidade/mapa/:itemComercialId/detalhe?operacaoId=&estado=`, ambas com
   `@RequirePermissoes('DISPONIBILIDADE_LER')`. A rota `GET /comercial/disponibilidade` existente
   permanece intacta (Grade Tabular). O handler do mapa é declarado **antes** de qualquer rota
   `:param` no `DisponibilidadeController`.

**Commit:** `feat(onda4): mapa teatro de disponibilidade com 8 estados e drill-down`

---

## Task 11 — Espelho Comercial

**Files:** `espelho.module.ts`, `espelho.controller.ts`, `espelho.service.ts`,
`dto/espelho.dto.ts`, `app.module.ts`,
`app/backend/test/unit/espelho.service.spec.ts` (DoD-105, `derivarStatus` é função pura),
`app/backend/test/integration/espelho.e2e-spec.ts` (DoD-104, DoD-106, DoD-107).

**Steps (TDD)**

1. Testes primeiro (DoD-104 a DoD-107).
2. DTO:

```ts
export const consultarEspelhoSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agrupar: z.enum(['cliente', 'rota', 'representante']).default('cliente'),
  clienteId: z.string().uuid().optional(),
  rotaId: z.string().uuid().optional(),
  representanteId: z.string().uuid().optional(),
  busca: z.string().trim().max(120).optional(),
  formato: z.enum(['json', 'csv']).default('json'),
});
```

3. Service com a derivação de status literal de D19:

```ts
private derivarStatus(pedidoStatus: string, pedida: number, atendida: number): StatusEspelho {
  if (pedidoStatus === 'cancelado') return 'Cancelado';
  if (pedidoStatus === 'faturado') return 'Faturado';
  if (pedidoStatus === 'finalizado') return 'Fechado';
  if (atendida >= pedida) return 'Atendido';
  if (atendida > 0) return 'Parcial';
  return 'Aberto';
}
```

   O peso atendido vem da soma de `pecas.peso_original` das peças associadas ao item; nenhum peso é
   estimado (RA-06).
4. `formato=csv` devolve `text/csv; charset=utf-8` com `Content-Disposition:
   attachment; filename="espelho-comercial-<data>.csv"`, montado do mesmo resultado do JSON.
5. Registrar `EspelhoModule` em `app.module.ts`.

**Commit:** `feat(onda4): espelho comercial com agrupamentos e export CSV no servidor`

---

## Task 12 — Clientes no backend (rota, prioridade, preferências)

**Files:** `json-cadastros.dto.ts`, `cliente.dto.ts`, `clientes.service.ts`,
`app/backend/test/integration/clientes-onda4.e2e-spec.ts` (DoD-73 a DoD-75),
`app/backend/test/unit/onda4-schema.spec.ts` (DoD-76),
`app/backend/test/integration/clientes.e2e-spec.ts` (realinhar `rota_padrao` → `rota_id`).

**Steps (TDD)**

1. Testes primeiro (DoD-73 a DoD-76).
2. Em `json-cadastros.dto.ts`, dentro de `preferenciasJsonSchema`:

```ts
    necessitaCorteAcerto: z.boolean().optional(),
```

3. Em `cliente.dto.ts`: trocar `rotaPadrao` por `rotaId: z.string().uuid().optional().nullable()` e
   restringir `prioridade: z.enum(['normal', 'alta']).optional()`.
4. Em `clientes.service.ts`: gravar/ler `rotaId`; no `detalhar`, devolver o nome da rota e do
   representante por `join` para a tela; expor `totalAtivos` no `listar` (badge do cabeçalho,
   DoD-77).

**Commit:** `feat(onda4): cliente com rota_id, prioridade tipada e corte de acerto`

---

## Task 13 — Camada BFF

**Files:** as **14 rotas novas + 1 alterada** listadas em *Estrutura de arquivos* +
`app/frontend/__tests__/bff-onda4.test.ts` + `lib/precos.ts`, `lib/espelho.ts`,
`lib/mapa-disponibilidade.ts`, `lib/status-pedido.ts`, `lib/comercial.ts`.

**Steps (TDD)**

1. Teste primeiro (DoD-111), com os dois helpers definidos no topo do próprio
   `bff-onda4.test.ts` — nenhum é importado de lugar nenhum:

```ts
/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiFetch } from '@/lib/api';
import {
  DELETE as removerItem,
  PATCH as reduzirItem,
} from '../src/app/api/comercial/pedidos/[id]/itens/[itemId]/route';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));

const RAIZ_FRONTEND = join(__dirname, '..');

/** Todos os `.ts`/`.tsx` sob um diretório do frontend, recursivo, em caminho absoluto. */
function arquivos(diretorio: string): string[] {
  const raiz = join(RAIZ_FRONTEND, diretorio);
  return readdirSync(raiz, { recursive: true, encoding: 'utf8' })
    .filter((relativo) => /\.tsx?$/.test(relativo))
    .map((relativo) => join(raiz, relativo));
}

const ler = (arquivo: string) => readFileSync(arquivo, 'utf8');

it('nenhuma tela da onda 4 chama o backend fora do BFF', () => {
  const telas = arquivos('src/app/(admin)/comercial');
  const vazamentos = telas.filter((f) =>
    /fetchBackend|process\.env\.BACKEND_URL|http:\/\/localhost:3001/.test(ler(f)));
  expect(vazamentos).toEqual([]);
});
```

   O recorte é `src/app/(admin)/comercial` — só as telas. As rotas de BFF vivem em
   `src/app/api/**`, que é justamente onde `fetchBackend`/`apiFetch` **devem** aparecer, e por
   isso ficam fora da varredura.

   O arquivo começa com `/** @jest-environment node */`: o Jest usa `Response`/`Headers` nativos do
   Node 22 e o teste exercita streams reais, sem depender do polyfill mínimo de `jest.setup.ts`.
   No mesmo arquivo, escrever primeiro o teste **executável** de **DoD-125**. Ele importa e chama as
   funções da rota, mocka `apiFetch`, trava caminho/método/body, prova o repasse bruto de `204` vazio
   e de `400`/`404`/`409`, e mantém a ausência do `PATCH` agregado que causou o bloqueio:

```ts
const apiFetchMock = jest.mocked(apiFetch);

function requisicaoCom(body: unknown): NextRequest {
  return { json: jest.fn().mockResolvedValue(body) } as unknown as NextRequest;
}

function contexto(itemId: string) {
  return { params: Promise.resolve({ id: 'pedido-1', itemId }) };
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

it('BFF de item usa a rota aninhada e os contratos reais de reducao e remocao', async () => {
  const reducao = {
    novaQuantidade: 4,
    motivo: 'Redução de quantidade no editor de rascunho',
  };
  apiFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const sucessoPatch = await reduzirItem(requisicaoCom(reducao), contexto('item-reduzido'));
  expect(apiFetchMock).toHaveBeenLastCalledWith(
    '/comercial/pedidos/pedido-1/itens/item-reduzido',
    { method: 'PATCH', body: JSON.stringify(reducao) },
  );
  expect(sucessoPatch.status).toBe(204);
  expect(await sucessoPatch.text()).toBe('');

  const remocao = { motivo: 'Remoção de item no editor de rascunho' };
  apiFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const sucessoDelete = await removerItem(requisicaoCom(remocao), contexto('item-removido'));
  expect(apiFetchMock).toHaveBeenLastCalledWith(
    '/comercial/pedidos/pedido-1/itens/item-removido',
    { method: 'DELETE', body: JSON.stringify(remocao) },
  );
  expect(sucessoDelete.status).toBe(204);
  expect(await sucessoDelete.text()).toBe('');

  const erros = [
    {
      executar: reduzirItem,
      method: 'PATCH',
      itemId: 'item-400',
      body: reducao,
      status: 400,
      corpo: '{ "statusCode":400, "message":"quantidade inválida" }\n',
    },
    {
      executar: removerItem,
      method: 'DELETE',
      itemId: 'item-404',
      body: remocao,
      status: 404,
      corpo: '{ "statusCode":404, "message":"item não encontrado" }\n',
    },
    {
      executar: reduzirItem,
      method: 'PATCH',
      itemId: 'item-409',
      body: reducao,
      status: 409,
      corpo: '{ "statusCode":409, "message":"conflito de edição" }\n',
    },
  ] as const;

  for (const caso of erros) {
    apiFetchMock.mockResolvedValueOnce(new Response(caso.corpo, {
      status: caso.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }));
    const resposta = await caso.executar(requisicaoCom(caso.body), contexto(caso.itemId));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      `/comercial/pedidos/pedido-1/itens/${caso.itemId}`,
      { method: caso.method, body: JSON.stringify(caso.body) },
    );
    expect(resposta.status).toBe(caso.status);
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await resposta.text()).toBe(caso.corpo);
  }

  const rotaPedido = join(RAIZ_FRONTEND, 'src/app/api/comercial/pedidos/[id]/route.ts');
  const contratos = join(RAIZ_FRONTEND, 'src/lib/comercial.ts');
  expect(ler(rotaPedido)).not.toMatch(/export async function PATCH/);

  const fonteContratos = ler(contratos);
  expect(fonteContratos).toMatch(
    /interface ReduzirItemPedidoBody[\s\S]*novaQuantidade: number;[\s\S]*motivo: string;/,
  );
  expect(fonteContratos).toMatch(
    /interface RemoverItemPedidoBody[\s\S]*motivo: string;/,
  );
});
```

   O espaço e a quebra de linha intencionais nos três `corpo` tornam o teste sensível a
   desserialização/resserialização: trocar `response.body` por `await response.json()` +
   `NextResponse.json(...)` muda os bytes e falha. Consumir JSON no sucesso também falha antes das
   asserções porque `204` não tem corpo. Fixar `200`, inverter `PATCH`/`DELETE`, trocar seus bodies ou
   omitir qualquer status de erro quebra as asserções correspondentes.

2. Implementar cada rota nos **dois padrões que já existem** em `src/lib/api.ts`, escolhendo pelo
   critério "o corpo do erro importa?":

   **(a) Rotas cujo `409`/`400` carrega payload que a UI precisa** — adendo, confirmação,
   criação de pedido, publicação de preços: usar `apiFetch` e repassar status **e corpo** sem
   reescrever, exatamente como o `POST` de `api/comercial/pedidos/route.ts` já faz hoje. Reescrever
   com `fetchBackend` **perderia** `OVERBOOKING_CONFIRMACAO_NECESSARIA`, `PEDIDO_ABERTO_EXISTENTE`
   e `PRECOS_INCOMPLETOS`, que são o que monta os modais:

```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/comercial/pedidos/${id}/adendos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
```

   **(b) Rotas de leitura simples** — listagens, detalhe, mapa, espelho, histórico: usar
   `fetchBackend<T>` com o repasse de status já padronizado, sem `catch` silencioso:

```ts
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<MapaResposta>(
    `/comercial/disponibilidade/mapa${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
```

   O export CSV do espelho é o único caso especial: o BFF repassa `Content-Type` e
   `Content-Disposition` do backend com `new NextResponse(response.body, { status, headers })`,
   sem reserializar o corpo.
3. **Criar a rota item-específica de D32**, sem tocar em
   `app/frontend/src/app/api/comercial/pedidos/[id]/route.ts`. O código é literal; `repassar` não
   chama `.json()` porque `PedidosService.reduzirItem` e `removerItem` retornam `Promise<void>`:

```ts
// app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import type { ReduzirItemPedidoBody, RemoverItemPedidoBody } from '@/lib/comercial';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Preserva status/body do backend inclusive quando o sucesso é 204 sem corpo. */
function repassar(response: Response): NextResponse {
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json() as ReduzirItemPedidoBody;
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return repassar(response);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json() as RemoverItemPedidoBody;
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
  return repassar(response);
}
```

   Em `lib/comercial.ts`, declarar o contrato espelhado dos schemas backend — sem criar um DTO
   alternativo e sem aceitar aumento no `PATCH`:

```ts
export interface ReduzirItemPedidoBody {
  novaQuantidade: number;
  motivo: string;
}

export interface RemoverItemPedidoBody {
  motivo: string;
}
```

4. Criar os demais tipos compartilhados em `lib/*`, incluindo `status-pedido.ts` com a derivação de
   D11:

```ts
export const ROTULOS_STATUS_PEDIDO = {
  rascunho: 'Rascunho',
  rascunho_com_reserva: 'Rascunho com reserva ativa',
  em_elaboracao_reserva_ativa: 'Em elaboração com reserva ativa',
  aguardando_confirmacao_overbooking: 'Aguardando confirmação de overbooking',
  finalizado: 'Finalizado',
  parcialmente_atendido: 'Parcialmente atendido',
  atendido: 'Atendido',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
} as const;

export function rotuloStatusPedido(status: string, temReservaAtiva: boolean): string {
  if (status === 'rascunho' && temReservaAtiva) {
    return ROTULOS_STATUS_PEDIDO.rascunho_com_reserva;
  }
  return ROTULOS_STATUS_PEDIDO[status as keyof typeof ROTULOS_STATUS_PEDIDO] ?? status;
}
```

**Commit:** `feat(onda4): camada BFF do comercial (pedidos, adendos, preços, mapa e espelho)`

---

## Task 14 — Tela `/comercial/clientes`

**Files:** `clientes-client.tsx` (**existe** — 18 linhas delegando ao `CadastroMasterDetail`
genérico da Onda 3; é **substituído**, não criado), `clientes/page.tsx`,
`app/frontend/__tests__/onda4-clientes.test.tsx`.

**Steps (TDD)**

1. **Ler `F:\Projetos\alpha-carnes-prototipo\src\app\pages\Cadastros.tsx` inteiro antes de escrever**
   (Princípio I). Ler também o `clientes-client.tsx` atual e o `clientesConfig` de
   `src/lib/cadastros-config.ts`: o componente genérico não comporta as 4 abas do protótipo, então
   a tela de Clientes deixa de usá-lo. `clientesConfig` permanece para os demais cadastros da
   Onda 3 — nada mais é removido de `cadastros-config.ts`.
2. Testes primeiro (DoD-70 a DoD-72, DoD-77):

```tsx
it('clientes exibe as 4 abas do prototipo na ordem', async () => {
  render(<ClientesClient {...props} />);
  const abas = await screen.findAllByRole('tab');
  expect(abas.map((a) => a.textContent)).toEqual([
    'Dados Gerais', 'Dados Fiscais & Endereço', 'Contatos', 'Preferências Operacionais',
  ]);
});

it('clientes nao usa o termo banido e usa Nome Fantasia e Buscar cliente', async () => {
  const { container } = render(<ClientesClient {...props} />);
  expect(container.innerHTML).not.toMatch(/[Mm]arca/);
  expect(await screen.findByLabelText('Nome Fantasia')).toBeInTheDocument();
  expect(await screen.findByPlaceholderText('Buscar cliente...')).toBeInTheDocument();
});
```

3. Implementar o master-detail fiel: master `w-[400px]`, cards com Nome Fantasia/razão/CNPJ/pílula;
   detalhe com avatar `Building2`, `Switch` "Cliente Ativo", botão "Salvar" e as 4 abas.
4. Aba **Dados Gerais** com o banner azul de herança e os 7 campos; Representante e Rota são
   `Select` alimentados por `/api/cadastros/representantes` e `/api/cadastros/rotas`.
5. Aba **Dados Fiscais & Endereço** (divergência **D-01**): logradouro, número, complemento, bairro,
   cidade, UF, CEP, inscrição estadual, inscrição municipal, e-mail e telefone fiscais — todos já
   previstos em `dadosFiscaisJsonSchema`.
6. Aba **Contatos** (divergência **D-01**): lista editável com nome, cargo, telefone, WhatsApp,
   e-mail, tipo e principal — campos de `dadosContatoJsonSchema`.
7. Aba **Preferências Operacionais** com o banner azul, faixas de peso, perfil de gordura e o
   `Switch` "Necessita Corte de Acerto?" ligado a `preferencias.necessitaCorteAcerto`.
8. Estados de carregamento e erro visíveis; falha da API vira `AlertItem` com a mensagem do backend.

**Commit:** `feat(onda4): tela de clientes fiel ao protótipo com as 4 abas`

---

## Task 15 — Tela `/comercial/pedidos`

**Files:** `pedidos-client.tsx`, `pedido-editor.tsx`, `modal-overbooking.tsx`, `modal-adendo.tsx`,
`modal-liberar-reserva.tsx`, `pedidos/page.tsx`,
`app/frontend/__tests__/onda4-pedidos.test.tsx`.

**Steps (TDD)**

1. **Ler `PedidoVenda.tsx` inteiro antes de escrever.** A tela nova **não** estende
   `pedido-venda-client.tsx`: aquele arquivo é o legado que sai na Task 16 (D29). `pedidos/page.tsx`
   passa a renderizar `<PedidosClient …/>` sem a prop `modo`, porque lista e editor convivem na
   mesma rota, como no protótipo.
2. Testes primeiro (DoD-87 a DoD-90, DoD-120 e DoD-126). O caso de DoD-126 monta um pedido
   persistido com cinco linhas, reduz uma para quantidade positiva, zera outra pelo `input min={0}`,
   remove a terceira pelo `Trash2`, aumenta a quarta e inclui um produto ausente; então inspeciona
   `global.fetch` e exige a matriz completa:

```tsx
it('edicao de rascunho traduz reducao zero remocao aumento e produto ausente para os endpoints reais', async () => {
  render(<PedidosClient {...propsComPedidoPersistido} />);
  await abrirPedidoPersistido();

  await reduzirQuantidade('item-reduzido', 4);
  await zerarQuantidade('item-zerado');
  await removerItemPeloIcone('item-removido');
  await aumentarQuantidadeComoAdendo('item-aumentado', 3, 'Complemento solicitado pelo cliente');
  await adicionarProdutoAusente('item-comercial-novo', 2);

  const chamadas = (global.fetch as jest.Mock).mock.calls;
  expect(chamadas).toContainEqual([
    '/api/comercial/pedidos/pedido-1/itens/item-reduzido',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        novaQuantidade: 4,
        motivo: 'Redução de quantidade no editor de rascunho',
      }),
    }),
  ]);
  expect(chamadas).toContainEqual([
    '/api/comercial/pedidos/pedido-1/itens/item-zerado',
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({
        motivo: 'Remoção de item ao zerar quantidade no editor de rascunho',
      }),
    }),
  ]);
  expect(chamadas).toContainEqual([
    '/api/comercial/pedidos/pedido-1/itens/item-removido',
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ motivo: 'Remoção de item no editor de rascunho' }),
    }),
  ]);
  expect(chamadas).toContainEqual([
    '/api/comercial/pedidos/pedido-1/adendos',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        itemComercialId: 'item-comercial-aumentado',
        quantidadeAdicionada: 3,
        motivo: 'Complemento solicitado pelo cliente',
      }),
    }),
  ]);
  expect(chamadas).toContainEqual([
    '/api/comercial/pedidos/pedido-1/itens',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        itemComercialId: 'item-comercial-novo',
        quantidade: 2,
      }),
    }),
  ]);
  expect(chamadas.some(([url, init]) =>
    url === '/api/comercial/pedidos/pedido-1/itens/item-zerado'
      && init?.method === 'PATCH')).toBe(false);
  expect(chamadas.some(([url, init]) =>
    url === '/api/comercial/pedidos/pedido-1' && init?.method === 'PATCH')).toBe(false);
});
```

   `propsComPedidoPersistido`, `abrirPedidoPersistido`, `reduzirQuantidade`, `zerarQuantidade`,
   `removerItemPeloIcone`, `aumentarQuantidadeComoAdendo` e `adicionarProdutoAusente` são helpers de
   interação definidos no próprio teste sobre os rótulos do protótipo; não são API de produção.
   O mock de `fetch` devolve `new Response(null, { status: 204 })` para as mutações
   item-específicas; assim o consumidor também falha se tentar consumir JSON no sucesso vazio.
3. Lista de pedidos com os filtros, contadores e pílulas do protótipo, usando
   `rotuloStatusPedido(status, temReservaAtiva)`.
4. `PedidoEditor`: seleção de cliente (campo **"Buscar cliente"**), seletor de produto, quantidade,
   tabela de itens com coluna **Origem** (`Físico` | `Virtual` | `Overbooking`), rodapé com "Salvar
   Rascunho" (`salvarComoRascunho: true`) e "Finalizar Pedido" (`POST /:id/finalizar`).
   Para um pedido já persistido, **não existe salvamento em lote nem `PATCH /api/comercial/pedidos/:id`**:
   as mutações da grade seguem D32 e a reserva é atualizada no momento da ação, como exige v1.1 §6.3:

   - produto ainda ausente → `POST /api/comercial/pedidos/:id/itens`; se vier o challenge `409`,
     confirmar em `/itens/confirmar-overbooking`;
   - quantidade menor e ainda positiva → `PATCH
     /api/comercial/pedidos/:id/itens/:itemId` com `{ novaQuantidade, motivo: 'Redução de quantidade
     no editor de rascunho' }`;
   - quantidade igual a `0` no `input min={0}` do protótipo → `DELETE
     /api/comercial/pedidos/:id/itens/:itemId` com
     `{ motivo: 'Remoção de item ao zerar quantidade no editor de rascunho' }`; nunca enviar
     `novaQuantidade: 0`, pois `reduzirItemSchema` exige número positivo;
   - exclusão pelo ícone `Trash2` → `DELETE /api/comercial/pedidos/:id/itens/:itemId` com
     `{ motivo: 'Remoção de item no editor de rascunho' }`;
   - quantidade maior → abrir `ModalAdendo`, obter o `motivo` que o DTO de adendo já exige e enviar
     somente o delta em `POST /api/comercial/pedidos/:id/adendos`; challenge deficitário confirma em
     `/adendos/confirmar-overbooking`.

   Os três motivos fixos descrevem a ação técnica efetivamente executada e alimentam a auditoria
   exigida pelo backend; não são constante de regra de negócio. O helper de mutação testa
   `response.ok` **antes** de ler corpo: em `204` vazio, não chama `json()` e recarrega o detalhe do
   pedido; em `400`/`404`/`409`, lê e mostra o corpo preservado pelo BFF, sem converter falha em
   sucesso. "Salvar Rascunho" em pedido já existente apenas conclui a edição depois que as mutações
   item-específicas terminaram e não altera o status (D12).
5. **Herança representante → rota no editor (D31 / linha 3 da matriz).** Ao escolher o cliente em
   "Buscar cliente", o editor exibe **Representante** (somente leitura, vindo de
   `heranca.representanteNome`) e **Rota** (pré-preenchida com `heranca.rotaNome`, editável — o
   valor digitado vai como `rotaPrevista` e sobrepõe a herança no backend). Nenhum dos dois é
   calculado no cliente: os dois vêm do payload do BFF (RA-01). Cliente sem representante ou sem
   rota renderiza campo vazio com `placeholder="—"`, nunca texto fabricado (RA-06). Teste de
   DoD-120:

```tsx
it('selecionar cliente herda representante e rota do cadastro no editor de pedido', async () => {
  render(<PedidosClient {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Novo pedido' }));
  await userEvent.click(await screen.findByRole('option', { name: /Açougue Central/ }));

  expect(await screen.findByLabelText('Representante')).toHaveValue('Helena Prado');
  expect(screen.getByLabelText('Representante')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Rota')).toHaveValue('Rota Oeste');

  // Cliente sem rota no cadastro não inventa itinerário.
  await userEvent.click(screen.getByRole('option', { name: /Mercado Sem Rota/ }));
  expect(screen.getByLabelText('Rota')).toHaveValue('');
});
```

6. `ModalOverbooking` renderiza **apenas** os números do `409`
   (`disponivelAntes`, `quantidadeSolicitada`, `overbookingGerado`); nada é recalculado no cliente.
   Confirmar chama a rota de confirmação da Onda 1.
7. `ModalAdendo` abre quando o `409` é `PEDIDO_ABERTO_EXISTENTE`, mostra o pedido aberto e a
   quantidade atual, pede motivo e chama `POST /:id/adendos`. O pedido aberto vem de
   `GET /api/comercial/pedidos/aberto?clienteId&itemComercialId&dataOperacao` (Task 6, passo 5).
   Rodapé com badge `Provisório · P5` e o texto de D9.
8. `ModalLiberarReserva` aparece na linha em rascunho com reserva ativa, exige justificativa de 10+
   caracteres e chama `POST /:id/liberar-reserva`. O botão só é renderizado se o usuário tem
   `PEDIDO_RESERVA_LIBERAR` (o `403` também é tratado).
9. Linha do tempo do pedido (`HistoricoEntry`) alimentada por `GET /:id/adendos` + auditoria do
   pedido.
10. Assinar `ADENDO_REGISTRADO` e `RESERVA_LIBERADA_ADMIN` via `conectarRealtime` — sem polling.

**Commit:** `feat(onda4): tela de pedidos com editor, overbooking, adendo e liberação de reserva`

---

## Task 16 — Remoção do legado de pedidos (D29 / Global Constraint 14)

**Files:** `app/frontend/src/app/(admin)/comercial/pedidos/pedido-venda-client.tsx` (remover),
`app/frontend/src/app/(admin)/comercial/pedidos/novo/page.tsx` (remover),
`app/frontend/__tests__/pedido-novo.test.tsx` (remover),
`app/frontend/e2e/jornada-operacional.spec.ts`,
`app/frontend/__tests__/onda4-rotas.test.tsx`.

Executada **depois** da Task 15 (a tela nova já existe) e **antes** da Task 21 (que realinha os
specs herdados), para que o E2E nunca navegue para uma rota que acabou de sumir. Esta task **cria**
`onda4-rotas.test.tsx` com o teste de DoD-115; os outros dois testes do arquivo (DoD-109 e DoD-112)
são escritos na Task 20, depois que as 5 telas existem.

**Steps (TDD)**

1. Teste primeiro (DoD-115), em `app/frontend/__tests__/onda4-rotas.test.tsx`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '../src/app/(admin)/comercial');

it('o cliente legado de pedido e a rota novo nao existem mais', () => {
  expect(existsSync(join(RAIZ, 'pedidos/pedido-venda-client.tsx'))).toBe(false);
  expect(existsSync(join(RAIZ, 'pedidos/novo/page.tsx'))).toBe(false);
});
```

2. Remover os três arquivos e o diretório `pedidos/novo/`. Nada de redirect, nada de reexport, nada
   de componente comentado: `/comercial/pedidos/novo` **não está** entre as 39 rotas da matriz nem
   no menu canônico (`src/common/rbac/menus-canonicos.ts`), então não vira rota permanente. Quem
   chegar por link antigo cai no `not-found` padrão do App Router.
3. Remover o link `<Link href="/comercial/pedidos/novo">Novo pedido</Link>` — na tela nova o botão
   "Novo pedido" abre o `PedidoEditor` na própria rota (Task 15), como no protótipo.
4. Em `e2e/jornada-operacional.spec.ts:551`, trocar
   `await page.goto(\`${BASE_URL}/comercial/pedidos/novo\`)` pela navegação a
   `/comercial/pedidos` + clique em "Novo pedido", **sem afrouxar as asserções seguintes**.
5. Conferir que não sobrou referência:
   `rg -n "pedido-venda-client|pedidos/novo" app/frontend` deve devolver zero linhas.

**Commit:** `refactor(onda4): remove o cliente de pedido legado e a rota /comercial/pedidos/novo`

---

## Task 17 — Tela `/comercial/tabela-precos`

**Files:** `tabela-precos-client.tsx`, `page.tsx`, `onda4-tabela-precos.test.tsx`.

**Steps (TDD)**

1. **Ler `TabelaPrecos.tsx` inteiro antes de escrever.**
2. Testes primeiro (DoD-91, DoD-95).
3. Cabeçalho com data, pílula de status e a barra de ações do protótipo
   (`TabelaPrecos.tsx:199-221`): "Copiar tabela anterior", "Histórico" e "Publicar", com os
   rótulos literais. Some-se a elas **"Salvar"**, que o protótipo não tem porque edita estado
   local — é a mesma tela sobre dados reais da API (divergência **D-05**, já autorizada), e o
   botão apenas dispara `PATCH /precos/tabelas/:id/itens` com as linhas alteradas. "Copiar tabela
   anterior", "Salvar" e "Publicar" só aparecem com `TABELA_PRECO_GERENCIAR`. "Copiar tabela
   anterior" chama `POST /api/precos/tabelas/${tabela.id}/copiar` com corpo `{}` (sem `origemId`:
   a origem é a última publicada anterior, D14), recarrega a grade com o detalhe devolvido e a
   confirmação inline do protótipo *"Preços da tabela anterior copiados. Revise antes de
   publicar."*; `409 SEM_TABELA_PRECO_ANTERIOR` vira alerta explícito com a mensagem do backend,
   nunca cópia silenciosa.
4. Grade com Produto · Unidade · Preço A · B · C · D. Preço `null` renderiza `Input` vazio com
   `placeholder="—"`; nunca `0,00` (DoD-95).
5. Quando não existe tabela do dia, a tela mostra a mensagem "Nenhuma tabela de preços para
   <data>." e, para quem pode gerenciar, o botão **"Criar tabela do dia"** (divergência **D-04**).
6. Banner âmbar quando uma tabela publicada é editada, com o texto do protótipo, e painel de
   histórico alimentado por `GET /precos/tabelas/:id/historico` (D30).
7. `PRECOS_INCOMPLETOS` do backend vira alerta com a lista de produtos faltantes.
8. Assinar `TABELA_PRECO_PUBLICADA` via `conectarRealtime`.

**Commit:** `feat(onda4): tela de tabela de preços com rascunho, publicação e histórico`

---

## Task 18 — Tela `/comercial/disponibilidade` (mapa + grade)

**Files:** `mapa-teatro.tsx`, `detalhe-unidade.tsx`, `page.tsx`, `onda4-disponibilidade.test.tsx`.

**Steps (TDD)**

1. **Ler `Disponibilidade.tsx` inteiro antes de escrever.**
2. Testes primeiro (DoD-101, DoD-103):

```tsx
it('mapa usa o catalogo MVP e nao contem o catalogo legado da grade do prototipo', async () => {
  render(<DisponibilidadePage />);
  expect(await screen.findByText('Traseiro Bovino')).toBeInTheDocument();
  for (const legado of CATALOGO_LEGADO_PROIBIDO) {
    expect(screen.queryByText(legado)).not.toBeInTheDocument();
  }
});
```

3. `MapaTeatro`: uma faixa por produto do catálogo MVP, com os 8 blocos `F/V/R/C/D/O/E/!`, legenda e
   as cores do protótipo (via tokens do DS, nunca hex literal).
4. `DetalheUnidade`: painel lateral com as unidades reais do estado clicado, vindo de
   `/api/comercial/disponibilidade/mapa/[itemComercialId]/detalhe`.
5. Produto com `atributosJson.provisorio === true` exibe badge `Provisório · P11`.
6. A aba **Grade** mantém a tabela real já existente sobre `disponibilidades_virtuais`
   (divergência **D-03** — nenhum item hard-coded).
7. Manter a assinatura realtime já presente na tela (`RESERVA_ATUALIZADA`,
   `DISPONIBILIDADE_GERADA`) e acrescentar `ADENDO_REGISTRADO`.

**Commit:** `feat(onda4): mapa teatro com drill-down e catálogo MVP na disponibilidade`

---

## Task 19 — Tela `/comercial/espelho`

**Files:** `espelho-client.tsx`, `page.tsx`, `onda4-espelho.test.tsx`.

**Steps (TDD)**

1. **Ler `EspelhoComercial.tsx` inteiro antes de escrever.**
2. Teste primeiro (DoD-108) e o de agrupamento na UI.
3. Filtros (data, vendedor, rota, **"Buscar cliente"**) e seletor de agrupamento
   `cliente` | `rota` | `representante`, todos refletidos na query do BFF.
4. Tabela agrupada com quantidade pedida, peso atendido e `StatusBadge` nos 6 status de D19.
5. Botão de exportação aponta para `/api/comercial/espelho?...&formato=csv` (divergência **D-07**).
6. Badge `Provisório · P15` no cabeçalho, com o texto de D19.

**Commit:** `feat(onda4): tela de espelho comercial com agrupamentos e exportação`

---

## Task 20 — Testes transversais das 5 rotas (DoD-109, DoD-112)

**Files:** `app/frontend/__tests__/onda4-rotas.test.tsx` (o mesmo arquivo criado na Task 16).

Task dedicada porque DoD-109 e DoD-112 só podem ficar verdes **depois** da última tela: a Task 16
já cria `onda4-rotas.test.tsx` com o teste de DoD-115 (que depende só da remoção do legado), mas
`as cinco rotas comerciais nao renderizam PlaceholderPage` exige `/comercial/tabela-precos`,
`/comercial/disponibilidade` e `/comercial/espelho` prontas — Tasks 17, 18 e 19. Escrever esses
dois testes na Task 16 os deixaria vermelhos por três tasks seguidas, quebrando o commit verde por
task. Esta task roda **depois da Task 19** e **antes da Task 21**.

**Steps (TDD)**

1. DoD-109 — nenhuma das 5 rotas é `PlaceholderPage`. O teste é estrutural sobre o `page.tsx` de
   cada rota, no mesmo estilo do teste de DoD-115 já escrito no arquivo:

```ts
const ROTAS_DA_ONDA = [
  'clientes', 'pedidos', 'tabela-precos', 'disponibilidade', 'espelho',
] as const;

it('as cinco rotas comerciais nao renderizam PlaceholderPage', () => {
  for (const rota of ROTAS_DA_ONDA) {
    const caminho = join(RAIZ, rota, 'page.tsx');
    expect(existsSync(caminho)).toBe(true);
    const fonte = readFileSync(caminho, 'utf8');
    expect(fonte).not.toMatch(/PlaceholderPage/);
  }
});
```

2. DoD-112 — a palavra banida (v1.1 §6.8) não aparece em nenhum arquivo da onda, nem como rótulo,
   nem como campo, nem como tipo. Varre os `.tsx`/`.ts` das 5 rotas mais os módulos de apoio
   criados nesta onda:

```ts
const ARQUIVOS_DA_ONDA = [
  ...ROTAS_DA_ONDA.map((rota) => join(RAIZ, rota)),
  join(__dirname, '../src/lib/precos.ts'),
  join(__dirname, '../src/lib/espelho.ts'),
  join(__dirname, '../src/lib/mapa-disponibilidade.ts'),
  join(__dirname, '../src/lib/status-pedido.ts'),
];

const TERMO_BANIDO = /\b[Mm]arcas?\b/;

it('nenhum arquivo da onda 4 usa o termo banido como rotulo', () => {
  const infratores = arquivosDeCodigo(ARQUIVOS_DA_ONDA)
    .filter((arquivo) => TERMO_BANIDO.test(readFileSync(arquivo, 'utf8')));
  expect(infratores).toEqual([]);
});
```

   `arquivosDeCodigo` é definido nesta task, no topo do mesmo arquivo:

```ts
/** Expande a lista em caminhos de `.ts`/`.tsx`: diretório vira varredura recursiva, arquivo vai
 *  como está. Entrada inexistente **falha** — todos os caminhos são criados por esta onda e um
 *  `skip` silencioso deixaria o teste verde sem ter varrido nada (RA-05). */
function arquivosDeCodigo(entradas: string[]): string[] {
  return entradas.flatMap((entrada) => {
    if (!existsSync(entrada)) {
      throw new Error(`Caminho da onda 4 não existe: ${entrada}`);
    }
    if (!statSync(entrada).isDirectory()) return [entrada];
    return readdirSync(entrada, { recursive: true, encoding: 'utf8' })
      .filter((relativo) => /\.tsx?$/.test(relativo))
      .map((relativo) => join(entrada, relativo));
  });
}
```

   Os imports do arquivo crescem de `{ existsSync }` para
   `{ existsSync, readdirSync, readFileSync, statSync }` de `node:fs`. O `\b` do `TERMO_BANIDO`
   é obrigatório: sem ele, `marcador`, `demarcar` e `marcado` dariam falso positivo e o teste
   viraria ruído. É o mesmo recorte do `rg -nw` do gate local.
3. Rodar `cd app/frontend && npm run test -- onda4-rotas` até verde. Os três testes do arquivo
   (DoD-109, DoD-112 e DoD-115) passam juntos neste ponto.

**Commit:** `test(onda4): testes transversais das cinco rotas comerciais`

---

## Task 21 — E2E, evidências e dívida 9 da Onda 3

**Files:** `app/backend/test/integration/onda4-comercial.e2e-spec.ts` (D28),
`app/frontend/e2e/onda4-comercial.spec.ts`, `app/frontend/e2e/jornada-operacional.spec.ts`,
`app/frontend/e2e/telas-migradas.spec.ts`, `app/frontend/e2e/telas-reais.spec.ts`,
`docs/evidencias/onda4-comercial/`.

**Steps**

1. E2E de backend cobrindo a jornada: criar pedido → tentar duplicar (`409
   PEDIDO_ABERTO_EXISTENTE`) → adendo com déficit (`409` de overbooking) → confirmar → liberar
   reserva → criar/publicar tabela de preços → consultar mapa e espelho.
2. E2E de frontend (Playwright) percorrendo as 5 telas com `HARDWARE_FAKE=1` e `NFSE_FAKE=1`.
3. Realinhar os 3 specs herdados que ainda apontam para rotas antigas de pedido (dívida 9 do
   relatório da Onda 3), sem afrouxar asserção. `jornada-operacional.spec.ts` já foi corrigido na
   Task 16 quanto a `/comercial/pedidos/novo`; aqui fecha-se o restante da dívida.
4. Capturar 1 screenshot por tela em `docs/evidencias/onda4-comercial/`, no mesmo padrão de
   `docs/evidencias/alpha-jornada-e2e/`, para a comparação lado a lado exigida no Portão 2.

**Commit:** `test(onda4): e2e do comercial, realinhamento dos specs herdados e evidências`

---

## Task 22 — Fechamento: status, gate e PR

**Files:** `docs/execucao/EXECUCAO-STATUS.md`, relatório de implementação.

**Steps**

1. Rodar o **Gate local completo** (seção seguinte) até verde.
2. Escrever o relatório no formato de `pipeline-execucao.md §7`.
3. Atualizar `EXECUCAO-STATUS.md` da Onda 4 para `aguardando_portao2` com o número do PR.
4. Abrir o PR `feat(onda4): Comercial completo` → `develop`.

**Commit:** `docs(onda4): relatório de implementação e status aguardando Portão 2`

---

## Gate local completo (comandos = CI) + abertura do PR

Executar na raiz do worktree de implementação, na ordem. Qualquer falha interrompe o gate.

```bash
npm ci
npm run lint
npm run type-check
cd app/backend && npm run db:migrate && npm run db:seed && cd ../..
cd app/backend && HARDWARE_FAKE=1 NFSE_FAKE=1 npm run test:cov && cd ../..
cd app/frontend && npm run test -- --runInBand bff-onda4.test.ts onda4-pedidos.test.tsx && cd ../..
cd app/frontend && npm run test && cd ../..
cd app/frontend && npx playwright test && cd ../..
npm run build
npm audit --omit=dev --audit-level=high        # AD-08
npx gitleaks detect --no-banner --redact       # secret-scan
```

Verificações manuais que o Worker declara no relatório:

```bash
# Termo banido (v1.1 §6.8) em qualquer arquivo de código da onda — deve devolver zero linhas
rg -nw -e '[Mm]arca' -e '[Mm]arcas' app/backend/src app/frontend/src

# Nenhuma das 5 rotas segue placeholder
rg -n "PlaceholderPage" "app/frontend/src/app/(admin)/comercial"

# Legado de pedido eliminado (D29) — deve devolver zero linhas
rg -n "pedido-venda-client|pedidos/novo" app/frontend

# O comando Jest dirigido acima executa os handlers e prova 204/400/404/409 + matriz do editor.
# Estes greps complementares provam a estrutura aninhada e que a rota raiz não ganhou PATCH.
rg -n "export async function (PATCH|DELETE)|/comercial/pedidos/\\$\\{id\\}/itens/\\$\\{itemId\\}" \
  "app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/route.ts"
rg -n "export async function PATCH" \
  "app/frontend/src/app/api/comercial/pedidos/[id]/route.ts"   # deve devolver zero linhas

# Coluna substituída não sobrou em lugar nenhum (Global Constraint 14)
rg -n "rotaPadrao|rota_padrao" app/backend/src app/backend/test app/frontend/src

# Snapshot de perfis regerado depois das 4 permissões novas
cd app/backend && npm run rbac:snapshot && git diff --exit-code src/common/rbac/perfil-permissoes.snapshot.json; cd ../..

# Cobertura acima do gate
rg -n "All files" app/backend/coverage/lcov-report/index.html
```

Abertura do PR:

```bash
git push -u origin feature/onda4-comercial
gh pr create --base develop --head feature/onda4-comercial \
  --title "feat(onda4): Comercial completo" \
  --body-file docs/execucao/relatorios/onda4-comercial.md
```

---

## Self-Review

**Aderência ao formato do Portão 1.** O plano tem Goal/Architecture/Tech Stack, Global Constraints,
Decisões de design, Referências do protótipo por tela, Estrutura de arquivos, Mapa DoD → teste 1:1,
Tasks numeradas com código literal e commit, Gate local igual ao CI e esta autorrevisão — a ordem
exata de `pipeline-execucao.md §6`.

**Cobertura do escopo pedido.** As 5 rotas das linhas 3–7 da matriz têm task de backend, task de BFF,
task de UI e teste nomeado. O DoD O4 dos quality-gates está integralmente mapeado: adendo com
histórico (DoD-80..82, DoD-116), unicidade AD-03 (DoD-78/79 e o ramo sem operação em DoD-121),
rascunho sem expiração automática com ação administrativa auditada (DoD-83..86), mapa teatro com
drill-down (DoD-98..100) e catálogo MVP correto em vez do legado da Grade (DoD-101/102). A única
lacuna que a matriz apontava e que o plano anterior deixava em aberto — herança
representante→rota no fluxo de pedido, linha 3 — é implementada por D31 e coberta por DoD-119/120.

**Nenhum DoD sem task que o escreva.** Cada linha do mapa DoD aponta para um `it(...)` que alguma
task desta onda escreve, com nome idêntico: DoD-109 e DoD-112 na Task 20, DoD-115 na Task 16,
DoD-113 na Task 3 (o nome citado **não** existia em `menu-rbac.test.ts` e passou a ser escrito lá),
DoD-119/121 na Task 6, DoD-120 na Task 15 e DoD-122/123/124 na Task 9, passo 1. A Task 20 existe precisamente porque DoD-109 e DoD-112
só ficam verdes depois da Task 19 — escrevê-los antes deixaria três tasks com commit vermelho.
DoD-125 é escrito na Task 13 sobre a rota BFF aninhada e DoD-126 na Task 15 sobre seu consumidor
real; os dois impedem a volta do `PATCH` agregado inexistente, o envio de zero ao schema
`positive()` e a perda de status/corpo no proxy.

**Aderência à base real (emenda do Portão 1).** Todo código literal deste plano foi conferido contra
`develop` no worktree em `158da75`, não contra a memória do plano mestre: assinatura de
`planejarSobLock` (3 parâmetros, read-only, sem `OverbookingChallengeException`) e de
`persistirItensPlanejados` (5 parâmetros, sempre `INSERT`); emissão de evento por `EventEmitter2`
pós-commit (não há `RealtimeService.emitir`); decorators `@RequirePermissoes('X')` + `@CurrentUser`
com `user.sub`; helpers decimais reais (`somarQtd`, não `somaDecimal`); helpers de liberação reais
(`liberarTodasReservasDoItem`, `cancelarPendenciasDoPedido`); `pecas` sem `operacao_id` (elo por
`recebimentos.operacao_id`) e produto por `item_comercial_base_id`; testes em `app/backend/test/`
(D28); índices únicos parciais exigindo `targetWhere` no `onConflictDoNothing`. Os quatro métodos
que o plano anterior presumia existir (`carregarAbertoParaAdendo`, `exigirItemDoPedido`,
`aplicarAlocacaoNoItem`, `abrirOuAcumularPendencia`) estão escritos por extenso na Task 7; nenhum
helper é citado sem corpo. Na segunda emenda o mesmo critério foi aplicado à Task 9: `salvarItens`,
`precosDaUltimaPublicada`, `exigirTabela` e `detalhar` deixaram de ser prosa e estão escritos por
extenso, já casados com o DDL real do 0016 — `tabelas_preco_itens` **não tem** `deleted_at` e seu
índice único é total (logo o `onConflictDoUpdate` não leva `targetWhere`, ao contrário de
`uq_tabelas_preco_data`), e o histórico usa a coluna `criado_em`, não `created_at`. O predicado do
estado E do mapa foi reauditado contra os cinco services que tocam `carga_itens` e alinhado ao
`<> 'removido'` que todos usam.

**Fronteira da transação e leitura pós-commit (emenda 3).** O `criar` da Task 9 devolvia
`this.detalhar(...)` de **dentro** de `this.db.transaction`. `detalhar` lê por `this.db`, que é
outra conexão do pool: a linha ainda não commitada não seria visível, o `NotFoundException` do
próprio `detalhar` dispararia e derrubaria a criação inteira — 404 para o usuário e nenhuma tabela
no banco. Agora a transação devolve a linha inserida e a leitura acontece depois do commit, que é o
que `publicar` e `salvarItens` já faziam e o que `PedidosService.criar` faz em `develop`
(`pedidos.service.ts:131-180`: transação → `emitirEventosPosCommit` → retorno). No mesmo passo, a
única desestruturação de `.returning()` da Task 9 passou a `primeiroOuFalha`, o helper real de
`src/common/crud/paginacao.ts` que `PedidosService` e os quatro services de cadastros já usam sob
`noUncheckedIndexedAccess`; as demais desestruturações do plano são `select` guardados por `if (!x)`.
`POST /precos/tabelas/:id/copiar`, que existia como rota sem regra nem teste, ganhou as três regras
em D14 (origem, sobrescrita, destino publicado), corpo literal no service e no controller, e
DoD-122/123/124 — e a Task 17 amarra o botão do protótipo a ela, então nenhuma ponta fica solta.

**Contrato BFF de item na Task 13 (emendas 4–5).** O controller/backend real foi relido:
`PATCH /comercial/pedidos/:id/itens/:itemId` recebe `reduzirItemSchema` (`novaQuantidade` +
`motivo`) e o service rejeita aumento; `DELETE` no mesmo caminho recebe `removerItemSchema`.
O protótipo e a v1.1 §6.3/§6.9 separam reduzir/remover (liberar reserva) de aumentar (adendo).
Por isso D32 cria `api/comercial/pedidos/[id]/itens/[itemId]/route.ts`, preserva o body bruto —
inclusive `204` sem corpo — e mantém `[id]/route.ts` sem `PATCH`. O teste importa os handlers e
prova, com `apiFetch` mockado, método/body, `204` vazio e status+bytes exatos de `400`/`404`/`409`;
não é mais inspeção textual. Task 15 consome a matriz literal: redução positiva=`PATCH` aninhado,
`0`/remoção=`DELETE` aninhado, aumento=`POST adendos`, inclusão nova=`POST itens`. O `0 → DELETE`
vem diretamente do `min={0}`/remoção do protótipo e da liberação de reserva da v1.1 §6.3. Nenhum
endpoint backend novo, divergência autorizada ou decisão de produto foi criado.

**O que este plano deliberadamente não faz.** Não reescreve o motor de reserva/overbooking da Onda 1;
não cria TTL de rascunho (AD-06 proíbe); não fecha as pendências abertas por conta própria — P5, P11
e P15 recebem badge Provisório e ficam rastreáveis; não toca `/admin/usuarios` (dívida 6 da Onda 3
segue aberta e reprogramada por D26, sem invenção de AD); não adiciona cartão em `/admin/parametros`,
preservando os 9 do protótipo.

**Riscos e mitigação.** (a) *Backfill de `rota_padrao`* — o contract do 0017 aborta com exceção se
sobrar linha não migrada, em vez de perder dado silenciosamente. (b) *Seed do catálogo* — é
idempotente, sinalizado Provisório P11 e derivado do protótipo validado, não de suposição. (c)
*Derivação dos 8 estados do mapa* — cada estado tem origem SQL literal em D17 e teste dedicado, o
que impede reinterpretação durante a implementação. (d) *Divergência de códigos no protótipo* —
resolvida por D6 com um conjunto canônico único, evitando três catálogos incompatíveis em runtime.

**Verificação da regra "Zero".** O plano não contém `TBD`, `TODO`, "a definir", "implementar depois"
nem "similar à Task". O termo banido pela v1.1 §6.8 aparece apenas na constraint 10 e no comando de
gate que o proíbem — em nenhum ponto como rótulo, campo, entidade, tipo ou texto de UI.
Quantidade editada para `0` não é pendência: D32 e Task 15 a encaminham explicitamente ao `DELETE`
item-específico com motivo, e DoD-126 falha se reaparecer `PATCH` com zero.

---

## Contagens

**22 tasks · 32 decisões de design · 57 itens de DoD (todos com teste 1:1) · 7 divergências
autorizadas.**

Os 2 itens novos em relação à emenda 3 são **DoD-125** e **DoD-126**: contrato do BFF
item-específico e consumo correto no editor. A decisão nova da emenda 4 é **D32**, agora fechada pela
emenda 5 para `0 → DELETE` e teste de proxy executável, sem nova decisão numerada: redução positiva
usa `PATCH`, zero/remoção usam `DELETE`, aumento usa adendo e produto ausente usa `POST /itens`. A
Task 13 passa de **13 rotas novas + 2 alteradas** para **14 rotas novas + 1 alterada**: entra o
arquivo aninhado e `api/comercial/pedidos/[id]/route.ts` deixa de ser alteração desta onda.

Contagem da estrutura listada: backend = **17 arquivos de código novos + 15 testes novos + 19
alterados**; frontend = **35 novos (14 rotas BFF) + 12 alterados (1 rota BFF) + 3 removidos**. A
emenda 4 não altera o total de arquivos frontend novos+alterados: reclassifica a rota raiz como
inalterada e acrescenta a rota aninhada correta. A emenda 5 altera somente o conteúdo do plano e dos
dois testes já contados; não adiciona, remove nem reclassifica arquivo de implementação.

Divergências autorizadas: **D-01** abas Fiscais/Contatos sem conteúdo no protótipo → conteúdo
derivado do JSONB já existente; **D-02** conjunto canônico único de códigos do catálogo;
**D-03** Grade Tabular sobre dados reais, sem o catálogo legado do protótipo; **D-04** criação
explícita da tabela de preços do dia; **D-05** dados reais da API no lugar dos mocks do protótipo;
**D-06** "Rascunho com reserva ativa" como rótulo derivado, não status de banco; **D-07** export do
espelho gerado no servidor.

**Nenhuma 8ª divergência foi aberta.** A lacuna da **linha 3 da matriz** (*"falta herança automática
representante→rota no fluxo de pedido"*) deixou de ser informativa e passou a ser implementada por
**D31**, com código literal (`rotaHerdadaDoCliente`, herança de `rotaPrevista` no `criar`, `leftJoin`
de representante e rota em `detalhar`/`listar`), task (Task 6 passo 7 no backend, Task 15 passo 5 na
UI) e DoD nomeado (**DoD-119** backend, **DoD-120** UI). O contador de divergências permanece 7.

Pendências tratadas com parâmetro/badge, sem AD nova: **P5** (política de preço em adendo — badge no
modal, D9), **P11** (catálogo oficial — seed Provisório, D5), **P15** (marco de fechamento do pedido
— badge no espelho, D19).
