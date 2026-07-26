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

**D14 — Criar tabela do dia é ação explícita.** `POST /precos/tabelas { data }` cria o rascunho com
uma linha por produto ativo do catálogo, copiando os preços da última tabela **publicada**; se não
houver nenhuma, os 4 preços nascem `NULL` e a UI mostra campo vazio (RA-06). A tela não cria nada
sozinha ao carregar. Divergência **D-04**.

**D15 — Publicar exige tabela completa.** `POST /precos/tabelas/:id/publicar` retorna
`400 PRECOS_INCOMPLETOS` com a lista de produtos sem os 4 preços. Sucesso grava `publicada_por`,
`publicada_em`, linha em `tabelas_preco_publicacoes`, auditoria e evento `TABELA_PRECO_PUBLICADA`.

**D16 — Editar tabela publicada devolve ao rascunho.** `PATCH /precos/tabelas/:id/itens` sobre tabela
`publicada` muda o status para `rascunho` e grava `revertida_para_rascunho` no histórico
(`TabelaPrecos.tsx:152-155`), com o banner âmbar do protótipo (`TabelaPrecos.tsx:223-228`).

**D17 — Mapa teatro: 8 estados derivados de tabelas reais, sem coluna nova.** Nenhum estado é
inventado nem persistido:

| Estado | Rótulo | Origem (SQL, filtrado por operação) |
|---|---|---|
| `F` | Físico disponível | `pecas` com `status_peca = 'pesada'`, `pedido_venda_item_id IS NULL`, `deleted_at IS NULL` |
| `V` | Virtual disponível | `disponibilidades_virtuais.quantidade_disponivel` |
| `R` | Reservado (em elaboração) | `reservas_disponibilidade` ativas, `tipo_consumo IN ('fisico','virtual')`, pedido em `rascunho`/`em_elaboracao_reserva_ativa`/`aguardando_confirmacao_overbooking` |
| `C` | Confirmado | mesmas reservas, pedido em `finalizado`/`parcialmente_atendido`/`atendido`/`faturado` |
| `D` | Em desossa | `pecas` com `status_peca IN ('para_corte','em_transformacao')` |
| `O` | Overbooking | `reservas_disponibilidade` ativas com `tipo_consumo = 'overbooking'` |
| `E` | Expedido | `carga_itens` com `status_carga_item = 'em_carga'` em caminhão com `status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')` |
| `!` | Em ocorrência | `pecas` com `status_peca = 'divergente'` |

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
`representante_id` já existe e é reusado. A herança do protótipo (banner "Representante e Rota
definem a herança…") é informativa: os dois campos são do cliente e propagam para o pedido.

**D24 — `necessitaCorteAcerto` entra em `preferenciasJsonSchema`.** Campo booleano opcional no JSONB
de preferências (`app/backend/src/common/dto/json-cadastros.dto.ts`), sem migração de coluna.

**D25 — `prioridade` do cliente é `normal` | `alta` no DTO.** A coluna `clientes.prioridade` é `TEXT`;
o Zod restringe ao par do protótipo (`Cadastros.tsx`, Select "Prioridade Padrão"). Sem `CHECK` novo,
para não invalidar linha existente fora do par.

**D26 — Dívida 6 da Onda 3 (`usuarios_representantes`) permanece aberta e é reprogramada para a
Onda 5.** Ela pertence a `/admin/usuarios`, que não está nas linhas 3–7 da matriz. O filtro por
representante do Espelho e do Pedido usa `clientes.representante_id`, que já existe, sem depender
daquela tabela.

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
- `HistoricoEntry`: linha do tempo do pedido (inclui adendos).
- `PRODUTOS`, `CLIENTES`, `SEED_PEDIDOS`, `DISPONIBILIDADE_INICIAL` são mock (divergência **D-05**).

### 3. `/comercial/tabela-precos` → `src/app/pages/TabelaPrecos.tsx`

- Cabeçalho com data, pílula de status (`Rascunho` | `Publicada`) e ações "Copiar da anterior",
  "Salvar" e "Publicar".
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

### Backend — novos

```
app/backend/src/database/migrations/0016_onda4_comercial_expand.sql
app/backend/src/database/migrations/0017_onda4_comercial_contract.sql
app/backend/src/database/schema/adendos-pedido.schema.ts
app/backend/src/database/schema/tabelas-preco.schema.ts
app/backend/src/database/seed-catalogo-mvp.ts
app/backend/src/modules/comercial/adendos/adendos.service.ts
app/backend/src/modules/comercial/adendos/adendos.service.spec.ts
app/backend/src/modules/comercial/adendos/dto/adendo.dto.ts
app/backend/src/modules/comercial/precos/precos.module.ts
app/backend/src/modules/comercial/precos/precos.controller.ts
app/backend/src/modules/comercial/precos/precos.service.ts
app/backend/src/modules/comercial/precos/precos.service.spec.ts
app/backend/src/modules/comercial/precos/dto/tabela-preco.dto.ts
app/backend/src/modules/comercial/disponibilidade/mapa.service.ts
app/backend/src/modules/comercial/disponibilidade/mapa.service.spec.ts
app/backend/src/modules/comercial/disponibilidade/dto/mapa.dto.ts
app/backend/src/modules/comercial/espelho/espelho.module.ts
app/backend/src/modules/comercial/espelho/espelho.controller.ts
app/backend/src/modules/comercial/espelho/espelho.service.ts
app/backend/src/modules/comercial/espelho/espelho.service.spec.ts
app/backend/src/modules/comercial/espelho/dto/espelho.dto.ts
app/backend/test/onda4-comercial.e2e-spec.ts
```

### Backend — alterados

```
app/backend/src/database/schema/index.ts              (exporta os 2 schemas novos)
app/backend/src/database/schema/clientes.schema.ts    (+ rota_id, − rota_padrao)
app/backend/src/database/seed.ts                      (chama seedCatalogoMvp)
app/backend/src/common/rbac/permissoes.ts             (+4 permissões, matriz de perfis)
app/backend/src/common/dto/json-cadastros.dto.ts      (+ necessitaCorteAcerto)
app/backend/src/realtime/events/eventos.ts            (+3 eventos e payloads)
app/backend/src/modules/comercial/pedidos/pedidos.module.ts     (+ AdendosService)
app/backend/src/modules/comercial/pedidos/pedidos.controller.ts (+4 rotas)
app/backend/src/modules/comercial/pedidos/pedidos.service.ts    (AD-03, AD-06, rascunho)
app/backend/src/modules/comercial/pedidos/dto/pedido.dto.ts     (+ salvarComoRascunho, liberar)
app/backend/src/modules/comercial/disponibilidade/disponibilidade.module.ts     (+ MapaService)
app/backend/src/modules/comercial/disponibilidade/disponibilidade.controller.ts (+2 rotas)
app/backend/src/modules/cadastros/clientes/dto/cliente.dto.ts   (rotaId, prioridade, preferências)
app/backend/src/modules/cadastros/clientes/clientes.service.ts  (rotaId)
app/backend/src/app.module.ts                          (+ PrecosModule, EspelhoModule)
```

### Frontend — novos

```
app/frontend/src/lib/precos.ts
app/frontend/src/lib/espelho.ts
app/frontend/src/lib/mapa-disponibilidade.ts
app/frontend/src/lib/status-pedido.ts
app/frontend/src/app/api/comercial/pedidos/route.ts
app/frontend/src/app/api/comercial/pedidos/aberto/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/adendos/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/adendos/confirmar-overbooking/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/liberar-reserva/route.ts
app/frontend/src/app/api/comercial/disponibilidade/mapa/route.ts
app/frontend/src/app/api/comercial/disponibilidade/mapa/[itemComercialId]/detalhe/route.ts
app/frontend/src/app/api/comercial/espelho/route.ts
app/frontend/src/app/api/precos/tabelas/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/itens/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/publicar/route.ts
app/frontend/src/app/api/precos/tabelas/[id]/copiar/route.ts
app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx
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
app/frontend/__tests__/bff-onda4.test.ts
app/frontend/e2e/onda4-comercial.spec.ts
```

### Frontend — alterados

```
app/frontend/src/app/(admin)/comercial/clientes/page.tsx        (usa clientes-client)
app/frontend/src/app/(admin)/comercial/pedidos/page.tsx         (usa pedidos-client)
app/frontend/src/app/(admin)/comercial/tabela-precos/page.tsx   (deixa de ser placeholder)
app/frontend/src/app/(admin)/comercial/disponibilidade/page.tsx (mapa + grade)
app/frontend/src/app/(admin)/comercial/espelho/page.tsx         (deixa de ser placeholder)
app/frontend/src/lib/comercial.ts                                (tipos de adendo/mapa/rascunho)
app/frontend/e2e/jornada-operacional.spec.ts                     (dívida 9 da Onda 3)
app/frontend/e2e/telas-migradas.spec.ts                          (dívida 9 da Onda 3)
app/frontend/e2e/telas-reais.spec.ts                             (dívida 9 da Onda 3)
```

---

## Mapa DoD → teste (1:1)

Cada linha: a regra e o **nome exato do teste que falha se a regra for violada**.

### Clientes

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-70 | A tela tem exatamente as 4 abas do protótipo, na ordem | `onda4-clientes.test.tsx` › `clientes exibe as 4 abas do prototipo na ordem` |
| DoD-71 | Nenhum rótulo, atributo ou texto contém `[Mm]arca`; existe "Nome Fantasia" e "Buscar cliente" | `onda4-clientes.test.tsx` › `clientes nao usa o termo banido e usa Nome Fantasia e Buscar cliente` |
| DoD-72 | Representante e Rota vêm da API de cadastros, nunca de lista fixa | `onda4-clientes.test.tsx` › `selects de representante e rota sao populados pela API de cadastros` |
| DoD-73 | Aba Dados Fiscais & Endereço persiste em `dados_fiscais_json` | `clientes.service.spec.ts` › `persiste dados fiscais e endereco no jsonb sem perder chaves` |
| DoD-74 | Aba Contatos persiste em `dados_contato_json` | `clientes.service.spec.ts` › `persiste lista de contatos no jsonb` |
| DoD-75 | `necessitaCorteAcerto` é aceito e persistido nas preferências | `clientes.service.spec.ts` › `aceita necessitaCorteAcerto nas preferencias operacionais` |
| DoD-76 | `rota_padrao` não existe mais; cliente grava `rota_id` FK | `clientes.service.spec.ts` › `cliente grava rota_id e o schema nao expoe rota_padrao` |
| DoD-77 | Badge do cabeçalho mostra a contagem real de clientes ativos | `onda4-clientes.test.tsx` › `badge do cabecalho mostra a contagem real de clientes ativos` |

### Pedidos

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-78 | **AD-03**: pedido aberto duplicado em `(cliente, item, operação)` retorna `409 PEDIDO_ABERTO_EXISTENTE` | `pedidos.service.spec.ts` › `recusa segundo pedido aberto do mesmo cliente item e operacao com 409 PEDIDO_ABERTO_EXISTENTE` |
| DoD-79 | **AD-03**: mesmo cliente e item em **operações diferentes** é permitido | `pedidos.service.spec.ts` › `permite pedidos abertos do mesmo cliente e item em operacoes diferentes` |
| DoD-80 | Adendo grava histórico append-only em `adendos_pedido` + auditoria na mesma transação | `adendos.service.spec.ts` › `adendo grava linha em adendos_pedido e auditoria na mesma transacao` |
| DoD-81 | Adendo com déficit devolve `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` sem persistir nada | `adendos.service.spec.ts` › `adendo com deficit nao persiste e devolve challenge de overbooking` |
| DoD-82 | Confirmação do adendo persiste quantidade, reserva de overbooking e pendência | `adendos.service.spec.ts` › `confirmacao do adendo persiste quantidade reserva overbooking e pendencia` |
| DoD-83 | **AD-06**: não existe TTL/agendador de expiração de rascunho no código | `pedidos.service.spec.ts` › `nao existe expiracao automatica de reserva de rascunho` |
| DoD-84 | **AD-06**: "Liberar reserva" exige justificativa, permissão, libera reservas e audita | `pedidos.service.spec.ts` › `liberar reserva exige justificativa libera reservas e registra auditoria` |
| DoD-85 | `PEDIDO_RESERVA_LIBERAR` ausente → `403` | `pedidos.controller.spec.ts` › `liberar reserva sem permissao retorna 403` |
| DoD-86 | `salvarComoRascunho: true` cria pedido em `rascunho` **com** reserva ativa | `pedidos.service.spec.ts` › `salvarComoRascunho cria pedido em rascunho com reserva ativa` |
| DoD-87 | O rótulo "Rascunho com reserva ativa" é derivado e os 9 rótulos do protótipo existem | `onda4-pedidos.test.tsx` › `deriva os 9 rotulos de status do prototipo incluindo rascunho com reserva ativa` |
| DoD-88 | Modal de overbooking mostra solicitado, disponível e déficit vindos do `409` | `onda4-pedidos.test.tsx` › `modal de overbooking renderiza o payload do 409 sem numero fabricado` |
| DoD-89 | Modal de adendo mostra o pedido aberto existente e envia motivo | `onda4-pedidos.test.tsx` › `modal de adendo mostra pedido aberto existente e envia motivo` |
| DoD-90 | Badge "Provisório · P5" presente no modal de adendo | `onda4-pedidos.test.tsx` › `modal de adendo exibe badge provisorio P5 da politica de preco` |

### Tabela de Preços

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-91 | Grade tem as 4 faixas A/B/C/D e a coluna Unidade | `onda4-tabela-precos.test.tsx` › `grade exibe colunas produto unidade e as quatro faixas A B C D` |
| DoD-92 | Publicar com preço faltando retorna `400 PRECOS_INCOMPLETOS` listando os produtos | `precos.service.spec.ts` › `publicar com preco faltando retorna 400 PRECOS_INCOMPLETOS com os produtos` |
| DoD-93 | Publicação grava histórico, auditoria e emite `TABELA_PRECO_PUBLICADA` pós-commit | `precos.service.spec.ts` › `publicacao grava historico auditoria e emite evento pos commit` |
| DoD-94 | Editar tabela publicada volta para rascunho e registra `revertida_para_rascunho` | `precos.service.spec.ts` › `editar tabela publicada volta para rascunho e registra reversao no historico` |
| DoD-95 | Preço ausente é `null` e a UI mostra campo vazio, nunca `0,00` | `onda4-tabela-precos.test.tsx` › `preco ausente renderiza campo vazio e nunca zero fabricado` |
| DoD-96 | Uma única tabela por data (índice único parcial) | `precos.service.spec.ts` › `recusa segunda tabela de preco para a mesma data` |
| DoD-97 | `TABELA_PRECO_GERENCIAR` ausente → `403` em publicar | `precos.controller.spec.ts` › `publicar sem TABELA_PRECO_GERENCIAR retorna 403` |

### Disponibilidade

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-98 | Mapa agrega exatamente os 8 estados `F/V/R/C/D/O/E/!` | `mapa.service.spec.ts` › `mapa agrega os oito estados F V R C D O E e ocorrencia` |
| DoD-99 | Cada estado é derivado da tabela definida em D17 (peça pesada livre = F, etc.) | `mapa.service.spec.ts` › `deriva cada estado da tabela de origem correta` |
| DoD-100 | Drill-down devolve as unidades reais do estado clicado | `mapa.service.spec.ts` › `drill-down devolve as unidades reais do estado selecionado` |
| DoD-101 | O catálogo do mapa é o MVP seedado, nunca o catálogo legado da Grade do protótipo | `onda4-disponibilidade.test.tsx` › `mapa usa o catalogo MVP e nao contem o catalogo legado da grade do prototipo` |
| DoD-102 | Seed cria os 11 pares item comercial/produto com `legado_item_comercial_id` 1:1 | `seed-catalogo-mvp.spec.ts` › `seed cria onze pares item comercial e produto vinculados um para um` |
| DoD-103 | Itens do catálogo MVP nascem com badge Provisório · P11 na UI | `onda4-disponibilidade.test.tsx` › `catalogo MVP exibe badge provisorio P11` |

### Espelho Comercial

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-104 | Os 3 agrupamentos (cliente, rota, representante) produzem totais coerentes | `espelho.service.spec.ts` › `agrupa por cliente rota e representante com totais coerentes` |
| DoD-105 | Status derivado segue a precedência de D19 | `espelho.service.spec.ts` › `deriva status do item na precedencia cancelado faturado fechado atendido parcial aberto` |
| DoD-106 | Export CSV usa os mesmos filtros e cabeçalho `text/csv` | `espelho.controller.spec.ts` › `export csv respeita filtros e devolve content-type text/csv` |
| DoD-107 | `ESPELHO_COMERCIAL_LER` ausente → `403` | `espelho.controller.spec.ts` › `espelho sem ESPELHO_COMERCIAL_LER retorna 403` |
| DoD-108 | Badge "Provisório · P15" presente no cabeçalho | `onda4-espelho.test.tsx` › `espelho exibe badge provisorio P15 do marco de fechamento` |

### Transversais

| # | Regra (DoD) | Teste que falharia |
|---|---|---|
| DoD-109 | Nenhuma das 5 rotas é `PlaceholderPage` | `onda4-rotas.test.tsx` › `as cinco rotas comerciais nao renderizam PlaceholderPage` |
| DoD-110 | Nenhum literal hexadecimal de cor fora de `globals.css` | `tokens-ds.test.ts` › `nenhum literal hexadecimal de cor em src fora de globals.css` |
| DoD-111 | Nenhum componente chama o backend direto — só BFF (RA-01) | `bff-onda4.test.ts` › `nenhuma tela da onda 4 chama o backend fora do BFF` |
| DoD-112 | A palavra banida não aparece em nenhum arquivo da onda | `onda4-rotas.test.tsx` › `nenhum arquivo da onda 4 usa o termo banido como rotulo` |
| DoD-113 | Menu por perfil continua igual à matriz após as permissões novas | `menu-rbac.test.ts` › `menus visiveis por perfil batem com a matriz` |
| DoD-114 | Cobertura backend ≥ 80% linha e branch | `npm run test:cov` (gate do CI, job `coverage`) |

**45 itens de DoD** (DoD-70 a DoD-114), todos com teste nomeado 1:1 — DoD-114 é o gate de cobertura
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

1. Escrever o teste que falha primeiro, em `clientes.service.spec.ts`:

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
4. Remover `rotaPadrao` de `clientes.schema.ts` e de todo consumidor (`clientes.service.ts`,
   `cliente.dto.ts`, `app/frontend/src/lib/clientes.ts`) — sem leitura dupla, sem fallback.
5. Registrar o passo de rollback em `migrations/ROLLBACK.md` no formato já usado pelas ondas
   anteriores.
6. Rodar `npm run db:migrate` e o teste do passo 1 (agora verde).

**Commit:** `refactor(onda4): contract remove clientes.rota_padrao em favor de rota_id`

---

## Task 3 — Permissões novas e matriz de perfis

**Files:** `permissoes.ts`, `permissoes.spec.ts`, `menu-rbac.test.ts` (verificação).

**Steps (TDD)**

1. Teste primeiro, em `app/backend/src/common/rbac/permissoes.spec.ts`:

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
});
```

2. Em `permissoes.ts`, no bloco da Onda 4:

```ts
  // Onda 4 — Comercial (tabela de preços, espelho e liberação administrativa de reserva).
  TABELA_PRECO_LER: 'TABELA_PRECO_LER',
  TABELA_PRECO_GERENCIAR: 'TABELA_PRECO_GERENCIAR',
  ESPELHO_COMERCIAL_LER: 'ESPELHO_COMERCIAL_LER',
  PEDIDO_RESERVA_LIBERAR: 'PEDIDO_RESERVA_LIBERAR',
```

3. Distribuir na `MAPA_PERFIL_PERMISSOES` conforme a tabela de D21.
4. Rodar `npm run db:seed` e confirmar que `menu-rbac.test.ts` continua verde (DoD-113).

**Commit:** `feat(onda4): permissões de tabela de preços, espelho e liberação de reserva`

---

## Task 4 — Eventos de domínio novos

**Files:** `realtime/events/eventos.ts`, `eventos.spec.ts`.

**Steps (TDD)**

1. Teste primeiro:

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

**Files:** `seed-catalogo-mvp.ts`, `seed-catalogo-mvp.spec.ts`, `seed.ts`.

**Steps (TDD)**

1. Teste primeiro, em `seed-catalogo-mvp.spec.ts`:

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
    const [item] = await db.insert(itensComerciais)
      .values({
        codigo: linha.codigo,
        descricao: linha.nome,
        unidadeComercial: linha.unidadePreco,
      })
      .onConflictDoNothing({ target: itensComerciais.codigo })
      .returning();
    const itemId = item?.id ?? (await db.select({ id: itensComerciais.id })
      .from(itensComerciais).where(eq(itensComerciais.codigo, linha.codigo)))[0].id;
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
      .onConflictDoNothing({ target: produtos.codigo });
  }
}
```

3. Chamar `seedCatalogoMvp(db)` em `seed()`, depois do seed de RBAC.
4. Atualizar a nota da Decisão 24 da Onda 3 **apenas no relatório da onda**, citando D5 deste plano
   (não editar o plano da Onda 3).

**Commit:** `feat(onda4): seed do catálogo MVP com 11 pares sinalizados provisório P11`

---

## Task 6 — Unicidade AD-03 no backend

**Files:** `pedidos.service.ts`, `pedidos.controller.ts`, `pedido.dto.ts`, `pedidos.service.spec.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-78, DoD-79):

```ts
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

3. Chamar `exigirUnicidadeAd03` em `criar`, em `incluirItem` (passando o próprio `pedidoId` como
   ignorado) e nos dois endpoints de confirmação de overbooking, **antes** de qualquer mutação.
4. Expor `GET /comercial/pedidos/aberto?clienteId&itemComercialId&operacaoId`, que devolve o pedido
   aberto e a quantidade atual (payload do `ModalAdendo`) ou `null`.

**Commit:** `feat(onda4): unicidade AD-03 de pedido aberto por cliente, produto e operação`

---

## Task 7 — Adendo com histórico

**Files:** `adendos.service.ts`, `adendos.service.spec.ts`, `dto/adendo.dto.ts`,
`pedidos.controller.ts`, `pedidos.module.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-80, DoD-81, DoD-82) com os nomes exatos do mapa DoD.
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

3. Service — reusa `planejarSobLock` da Onda 1 e nunca duplica a regra de reserva:

```ts
async registrar(
  pedidoId: string, dto: RegistrarAdendoDto, usuarioId: string, confirmado: boolean,
): Promise<AdendoResultado> {
  return this.db.transaction(async (tx) => {
    const pedido = await this.pedidos.carregarAbertoParaAdendo(tx, pedidoId);
    const item = await this.pedidos.exigirItemDoPedido(tx, pedidoId, dto.itemComercialId);
    const plano = await this.pedidos.planejarSobLock(tx, pedido.operacaoId, [{
      itemComercialId: dto.itemComercialId, quantidade: dto.quantidadeAdicionada,
    }], { permitirOverbooking: confirmado });

    const anterior = item.quantidadePedida;
    const resultante = somaDecimal(anterior, dto.quantidadeAdicionada);
    await this.pedidos.persistirItensPlanejados(tx, pedido, plano, { itemExistenteId: item.id });

    const [adendo] = await tx.insert(adendosPedido).values({
      pedidoVendaId: pedido.id,
      pedidoVendaItemId: item.id,
      itemComercialId: dto.itemComercialId,
      operacaoId: pedido.operacaoId,
      quantidadeAnterior: anterior,
      quantidadeAdicionada: String(dto.quantidadeAdicionada),
      quantidadeResultante: resultante,
      origemConsumo: plano.origemPredominante,
      motivo: dto.motivo,
      autorId: usuarioId,
    }).returning();

    await this.auditoria.registrar(tx, {
      tabela: 'adendos_pedido', registroId: adendo.id, operacao: 'INSERT',
      modulo: 'comercial.adendo', usuarioId,
      dadosNovos: { pedidoVendaId: pedido.id, ...dto, quantidadeResultante: resultante },
      justificativa: dto.motivo,
    });
    return { adendo, item: { ...item, quantidadePedida: resultante } };
  });
}
```

   `planejarSobLock` com `permitirOverbooking: false` já lança
   `OverbookingChallengeException` (`409`) **antes** de qualquer escrita — é o que garante DoD-81.
4. Após o commit, emitir `ADENDO_REGISTRADO` pelo `RealtimeService`, no mesmo padrão dos serviços da
   Onda 1 (nunca dentro da transação).
5. Controller:

```ts
@Post(':id/adendos')
@RequerPermissao(PERMISSOES.PEDIDOS_GERENCIAR)
registrarAdendo(
  @Param('id', ParseUUIDPipe) id: string,
  @Body(new ZodValidationPipe(registrarAdendoSchema)) dto: RegistrarAdendoDto,
  @UsuarioAtual() usuario: UsuarioAutenticado,
) { return this.adendos.registrar(id, dto, usuario.id, false); }

@Post(':id/adendos/confirmar-overbooking')
@RequerPermissao(PERMISSOES.PEDIDO_OVERBOOKING_CONFIRMAR)
confirmarAdendoOverbooking(
  @Param('id', ParseUUIDPipe) id: string,
  @Body(new ZodValidationPipe(confirmarAdendoOverbookingSchema)) dto: RegistrarAdendoDto,
  @UsuarioAtual() usuario: UsuarioAutenticado,
) { return this.adendos.registrar(id, dto, usuario.id, true); }

@Get(':id/adendos')
@RequerPermissao(PERMISSOES.PEDIDOS_LER)
listarAdendos(@Param('id', ParseUUIDPipe) id: string) { return this.adendos.listar(id); }
```

**Commit:** `feat(onda4): adendo de pedido com histórico append-only e overbooking AD-05`

---

## Task 8 — AD-06: liberar reserva e rascunho explícito

**Files:** `pedidos.service.ts`, `pedidos.controller.ts`, `pedido.dto.ts`, `pedidos.service.spec.ts`,
`pedidos.controller.spec.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-83 a DoD-86). DoD-83 é um teste estrutural que impede a volta do TTL:

```ts
it('nao existe expiracao automatica de reserva de rascunho', () => {
  const fontes = arquivosDoModulo('src/modules/comercial');
  const suspeitos = fontes.filter((f) =>
    /@Cron|SchedulerRegistry|setTimeout\(|setInterval\(|expiraEm|ttlReserva/.test(ler(f)));
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
4. Novo método, reusando o cancelamento existente para não duplicar a liberação de reservas:

```ts
/** AD-06 — única liberação além de remoção/cancelamento pelo vendedor. Sem TTL, sem job. */
async liberarReservaAdministrativa(
  pedidoId: string, dto: LiberarReservaDto, usuarioId: string,
): Promise<{ id: string; status: string }> {
  const resultado = await this.db.transaction(async (tx) => {
    const pedido = await this.carregarComReservaAtiva(tx, pedidoId);
    if (pedido.status !== 'rascunho') {
      throw new BadRequestException({
        code: 'PEDIDO_NAO_ESTA_EM_RASCUNHO',
        message: 'A liberação administrativa só se aplica a rascunho com reserva ativa.',
      });
    }
    await this.liberarTodasReservasDoPedido(tx, pedido.id);
    await this.cancelarPendenciasOverbookingDoPedido(tx, pedido.id, usuarioId);
    await tx.update(pedidosVenda)
      .set({ status: 'cancelado', updatedAt: new Date() })
      .where(eq(pedidosVenda.id, pedido.id));
    await this.auditoria.registrar(tx, {
      tabela: 'pedidos_venda', registroId: pedido.id, operacao: 'UPDATE',
      modulo: 'comercial.pedido', usuarioId,
      dadosAnteriores: { status: pedido.status },
      dadosNovos: { status: 'cancelado', acao: 'liberar_reserva' },
      justificativa: dto.justificativa,
    });
    return { id: pedido.id, status: 'cancelado' as const };
  });
  this.realtime.emitir(EVENTOS.RESERVA_LIBERADA_ADMIN, {
    pedidoVendaId: resultado.id, autorId: usuarioId, justificativa: dto.justificativa,
  });
  return resultado;
}
```

5. Controller:

```ts
@Post(':id/liberar-reserva')
@RequerPermissao(PERMISSOES.PEDIDO_RESERVA_LIBERAR)
liberarReserva(
  @Param('id', ParseUUIDPipe) id: string,
  @Body(new ZodValidationPipe(liberarReservaSchema)) dto: LiberarReservaDto,
  @UsuarioAtual() usuario: UsuarioAutenticado,
) { return this.pedidos.liberarReservaAdministrativa(id, dto, usuario.id); }
```

**Commit:** `feat(onda4): liberação administrativa auditada de reserva e rascunho explícito (AD-06)`

---

## Task 9 — Módulo de Tabela de Preços

**Files:** `precos.module.ts`, `precos.controller.ts`, `precos.service.ts`,
`dto/tabela-preco.dto.ts`, `precos.service.spec.ts`, `precos.controller.spec.ts`, `app.module.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-92 a DoD-94, DoD-96, DoD-97).
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
  return this.db.transaction(async (tx) => {
    const [existente] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(eq(tabelasPreco.data, dto.data), isNull(tabelasPreco.deletedAt)));
    if (existente) {
      throw new ConflictException({
        code: 'TABELA_PRECO_DUPLICADA',
        message: `Já existe tabela de preços para ${dto.data}.`,
      });
    }
    const [tabela] = await tx.insert(tabelasPreco)
      .values({ data: dto.data, observacao: dto.observacao }).returning();
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
    return this.detalhar(tabela.id);
  });
}
```

   `publicar` valida a completude antes de escrever:

```ts
async publicar(id: string, dto: PublicarTabelaPrecoDto, usuarioId: string) {
  const resultado = await this.db.transaction(async (tx) => {
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
  this.realtime.emitir(EVENTOS.TABELA_PRECO_PUBLICADA, { ...resultado, autorId: usuarioId });
  return this.detalhar(id);
}
```

   `salvarItens` faz o upsert e, se a tabela estava `publicada`, volta para `rascunho` gravando
   `revertida_para_rascunho` em `tabelas_preco_publicacoes` (D16).
4. Controller com as rotas `GET /precos/tabelas`, `GET /precos/tabelas/:id`,
   `POST /precos/tabelas`, `PATCH /precos/tabelas/:id/itens`, `POST /precos/tabelas/:id/copiar`,
   `POST /precos/tabelas/:id/publicar` e `GET /precos/tabelas/:id/publicacoes` — leitura com
   `TABELA_PRECO_LER`, escrita com `TABELA_PRECO_GERENCIAR`.
5. Registrar `PrecosModule` em `app.module.ts`.

**Commit:** `feat(onda4): módulo de tabela de preços A/B/C/D com publicação auditada`

---

## Task 10 — Mapa teatro e drill-down da Disponibilidade

**Files:** `mapa.service.ts`, `mapa.service.spec.ts`, `dto/mapa.dto.ts`,
`disponibilidade.controller.ts`, `disponibilidade.module.ts`.

**Steps (TDD)**

1. Testes primeiro (DoD-98 a DoD-100), montando fixtures que cobrem os 8 estados de D17.
2. DTO e contrato:

```ts
export const consultarMapaSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itemComercialId: z.string().uuid().optional(),
});

export const drillDownSchema = consultarMapaSchema.extend({
  estado: z.enum(['F', 'V', 'R', 'C', 'D', 'O', 'E', '!']),
});

export interface MapaProduto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  provisorio: boolean;          // badge P11 do catálogo MVP
  estados: Record<'F' | 'V' | 'R' | 'C' | 'D' | 'O' | 'E' | '!', number>;
  saldoComercial: number;       // F + V − R − O
}
```

3. `MapaService.consultar` executa uma consulta por estado, cada uma com a origem literal de D17, e
   agrega por `item_comercial_id`. Nenhuma coluna nova, nenhum estado persistido.
4. `MapaService.detalhar(itemComercialId, estado, dataOperacao)` devolve as unidades reais do estado:
   peça (código, peso, recebimento de origem) para `F`/`D`/`E`/`!`; linha de disponibilidade virtual
   (compra programada, fornecedor esperado) para `V`; reserva com pedido e cliente para `R`/`C`/`O`.
5. Rotas: `GET /comercial/disponibilidade/mapa` e
   `GET /comercial/disponibilidade/mapa/:itemComercialId/detalhe`, ambas com `DISPONIBILIDADE_LER`.
   A rota `GET /comercial/disponibilidade` existente permanece intacta (Grade Tabular).

**Commit:** `feat(onda4): mapa teatro de disponibilidade com 8 estados e drill-down`

---

## Task 11 — Espelho Comercial

**Files:** `espelho.module.ts`, `espelho.controller.ts`, `espelho.service.ts`,
`dto/espelho.dto.ts`, `espelho.service.spec.ts`, `espelho.controller.spec.ts`, `app.module.ts`.

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
`clientes.service.spec.ts`.

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

**Files:** as 15 rotas listadas em *Estrutura de arquivos* + `bff-onda4.test.ts` +
`lib/precos.ts`, `lib/espelho.ts`, `lib/mapa-disponibilidade.ts`, `lib/status-pedido.ts`.

**Steps (TDD)**

1. Teste primeiro (DoD-111):

```ts
it('nenhuma tela da onda 4 chama o backend fora do BFF', () => {
  const telas = arquivos('src/app/(admin)/comercial');
  const vazamentos = telas.filter((f) =>
    /fetchBackend|process\.env\.BACKEND_URL|http:\/\/localhost:3001/.test(ler(f)));
  expect(vazamentos).toEqual([]);
});
```

2. Implementar cada rota no padrão já usado no repositório (`fetchBackend`, erro repassado com o
   status original, sem `catch` silencioso):

```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<AdendoResultado>(
    `/comercial/pedidos/${id}/adendos`, { method: 'POST', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error, status }, { status });
  return NextResponse.json(data, { status: 201 });
}
```

   O BFF do adendo **repassa o corpo do `409`** (challenge de overbooking e
   `PEDIDO_ABERTO_EXISTENTE`) sem reescrever, porque a UI depende dele para montar os modais.
3. Criar os tipos compartilhados em `lib/*`, incluindo `status-pedido.ts` com a derivação de D11:

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

**Files:** `clientes-client.tsx`, `page.tsx`, `onda4-clientes.test.tsx`.

**Steps (TDD)**

1. **Ler `F:\Projetos\alpha-carnes-prototipo\src\app\pages\Cadastros.tsx` inteiro antes de escrever**
   (Princípio I).
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
`modal-liberar-reserva.tsx`, `page.tsx`, `onda4-pedidos.test.tsx`.

**Steps (TDD)**

1. **Ler `PedidoVenda.tsx` inteiro antes de escrever.**
2. Testes primeiro (DoD-87 a DoD-90).
3. Lista de pedidos com os filtros, contadores e pílulas do protótipo, usando
   `rotuloStatusPedido(status, temReservaAtiva)`.
4. `PedidoEditor`: seleção de cliente (campo **"Buscar cliente"**), seletor de produto, quantidade,
   tabela de itens com coluna **Origem** (`Físico` | `Virtual` | `Overbooking`), rodapé com "Salvar
   Rascunho" (`salvarComoRascunho: true`) e "Finalizar Pedido" (`POST /:id/finalizar`).
5. `ModalOverbooking` renderiza **apenas** os números do `409`
   (`disponivelAntes`, `quantidadeSolicitada`, `overbookingGerado`); nada é recalculado no cliente.
   Confirmar chama a rota de confirmação da Onda 1.
6. `ModalAdendo` abre quando o `409` é `PEDIDO_ABERTO_EXISTENTE`, mostra o pedido aberto e a
   quantidade atual, pede motivo e chama `POST /:id/adendos`. Rodapé com badge
   `Provisório · P5` e o texto de D9.
7. `ModalLiberarReserva` aparece na linha em rascunho com reserva ativa, exige justificativa de 10+
   caracteres e chama `POST /:id/liberar-reserva`. O botão só é renderizado se o usuário tem
   `PEDIDO_RESERVA_LIBERAR` (o `403` também é tratado).
8. Linha do tempo do pedido (`HistoricoEntry`) alimentada por `GET /:id/adendos` + auditoria do
   pedido.
9. Assinar `ADENDO_REGISTRADO` e `RESERVA_LIBERADA_ADMIN` via `conectarRealtime` — sem polling.

**Commit:** `feat(onda4): tela de pedidos com editor, overbooking, adendo e liberação de reserva`

---

## Task 16 — Tela `/comercial/tabela-precos`

**Files:** `tabela-precos-client.tsx`, `page.tsx`, `onda4-tabela-precos.test.tsx`.

**Steps (TDD)**

1. **Ler `TabelaPrecos.tsx` inteiro antes de escrever.**
2. Testes primeiro (DoD-91, DoD-95).
3. Cabeçalho com data, pílula de status e as ações "Copiar da anterior", "Salvar" e "Publicar"
   (as duas últimas só com `TABELA_PRECO_GERENCIAR`).
4. Grade com Produto · Unidade · Preço A · B · C · D. Preço `null` renderiza `Input` vazio com
   `placeholder="—"`; nunca `0,00` (DoD-95).
5. Quando não existe tabela do dia, a tela mostra a mensagem "Nenhuma tabela de preços para
   <data>." e, para quem pode gerenciar, o botão **"Criar tabela do dia"** (divergência **D-04**).
6. Banner âmbar quando uma tabela publicada é editada, com o texto do protótipo, e painel de
   histórico alimentado por `GET /precos/tabelas/:id/publicacoes`.
7. `PRECOS_INCOMPLETOS` do backend vira alerta com a lista de produtos faltantes.
8. Assinar `TABELA_PRECO_PUBLICADA` via `conectarRealtime`.

**Commit:** `feat(onda4): tela de tabela de preços com rascunho, publicação e histórico`

---

## Task 17 — Tela `/comercial/disponibilidade` (mapa + grade)

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

## Task 18 — Tela `/comercial/espelho`

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

## Task 19 — E2E, evidências e dívida 9 da Onda 3

**Files:** `app/backend/test/onda4-comercial.e2e-spec.ts`,
`app/frontend/e2e/onda4-comercial.spec.ts`, `e2e/jornada-operacional.spec.ts`,
`e2e/telas-migradas.spec.ts`, `e2e/telas-reais.spec.ts`,
`docs/evidencias/onda4-comercial/`.

**Steps**

1. E2E de backend cobrindo a jornada: criar pedido → tentar duplicar (`409
   PEDIDO_ABERTO_EXISTENTE`) → adendo com déficit (`409` de overbooking) → confirmar → liberar
   reserva → criar/publicar tabela de preços → consultar mapa e espelho.
2. E2E de frontend (Playwright) percorrendo as 5 telas com `HARDWARE_FAKE=1` e `NFSE_FAKE=1`.
3. Realinhar os 3 specs herdados que ainda apontam para rotas antigas de pedido (dívida 9 do
   relatório da Onda 3), sem afrouxar asserção.
4. Capturar 1 screenshot por tela em `docs/evidencias/onda4-comercial/`, no mesmo padrão de
   `docs/evidencias/alpha-jornada-e2e/`, para a comparação lado a lado exigida no Portão 2.

**Commit:** `test(onda4): e2e do comercial, realinhamento dos specs herdados e evidências`

---

## Task 20 — Fechamento: status, gate e PR

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
histórico (DoD-80..82), unicidade AD-03 (DoD-78/79), rascunho sem expiração automática com ação
administrativa auditada (DoD-83..86), mapa teatro com drill-down (DoD-98..100) e catálogo MVP correto
em vez do legado da Grade (DoD-101/102).

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

---

## Contagens

**20 tasks · 26 decisões de design · 45 itens de DoD (todos com teste 1:1) · 7 divergências
autorizadas.**

Divergências autorizadas: **D-01** abas Fiscais/Contatos sem conteúdo no protótipo → conteúdo
derivado do JSONB já existente; **D-02** conjunto canônico único de códigos do catálogo;
**D-03** Grade Tabular sobre dados reais, sem o catálogo legado do protótipo; **D-04** criação
explícita da tabela de preços do dia; **D-05** dados reais da API no lugar dos mocks do protótipo;
**D-06** "Rascunho com reserva ativa" como rótulo derivado, não status de banco; **D-07** export do
espelho gerado no servidor.

Pendências tratadas com parâmetro/badge, sem AD nova: **P5** (política de preço em adendo — badge no
modal, D9), **P11** (catálogo oficial — seed Provisório, D5), **P15** (marco de fechamento do pedido
— badge no espelho, D19).
