# Onda 5 — Gestão + Usuários (Painel, Operações UI, Compras, Overbooking, Aprovações, SIF e escopo por representante)

> **Plano tático — padrão Portão 1.**
> Rito: [`pipeline-execucao.md`](../../governance/pipeline-execucao.md) §6 · Constituição: [`constituicao.md`](../../governance/constituicao.md) ·
> Roadmap: [`roadmap-canonico.md`](../../governance/roadmap-canonico.md) §8 (Onda 5) · Gates: [`quality-gates.md`](../../governance/quality-gates.md) §O5.
>
> | Campo | Valor |
> |---|---|
> | Onda | 5 — Gestão |
> | Branch de planejamento | `plan/onda5-usuarios-representantes` (emenda E5.1 sobre o plano original) |
> | Branch de implementação | `feature/onda5-gestao` (PR #28 já aberto; receberá a emenda somente após o merge da Onda 4 e atualização sobre `develop`) |
> | Base desta emenda | `origin/develop` = `b4ad3b39b11000099d19f713637c6bd9d24ff942`; a Onda 4 ainda não está em `develop` nesta base |
> | Protótipo (fonte de verdade de UI) | `F:/Projetos/alpha-carnes-prototipo` @ `feature/completude-v1.1` = `8d32aa4cadff0a91ab155a9d47b019cd3731ce77` |
> | Depende de | Onda 3 (mergeada) e, para aplicar o escopo em Clientes/Pedidos, Onda 4 mergeada em `develop` |
> | Migration desta onda | `0018_onda5_gestao` + `0019_onda5_usuarios_representantes` |
> | Rotas do escopo | 7 (`/gestao/dashboard`, `/gestao/operacoes`, `/gestao/compras`, `/gestao/overbooking`, `/gestao/aprovacoes`, `/gestao/relatorios`, `/admin/usuarios`) + complemento visual em `/cadastros/representantes` |

---

## Goal

Entregar **completas e fiéis ao protótipo** as 6 telas do grupo **Gestão** do menu v1.1 (matriz de
rastreabilidade linhas 8–13) e fechar, na rota existente `/admin/usuarios`, a dívida de completude
O3 D43 → O4 D26 de **Representantes permitidos**, com backend real, RBAC real, auditoria e testes.
Os quatro itens do DoD da Onda 5 declarados em `quality-gates.md` §O5 permanecem:

1. **Painel de impacto na edição de compra confirmada** — alterar quantidade de uma compra já
   confirmada recalcula a disponibilidade virtual **na mesma transação**, mostra o impacto
   **antes** de salvar (`GET /comercial/compras-programadas/:id/impacto`) e exige confirmação
   explícita quando o recálculo projeta déficit.
2. **Fila de pendências de overbooking com decisão em 3 caminhos** — compra complementar,
   redistribuição e postergação (novo pedido), cada caminho com **efeito real** no domínio, não
   apenas mudança de rótulo de status.
3. **Comparativo Pedido × NF × Pesagem imutável** — a tela de Aprovações & Ocorrências lê o
   snapshot `conclusoes_conferencia.quadro_json` gravado no encerramento da conferência tripla; a
   tratativa administrativa **nunca** altera totais históricos (garantia no banco, por trigger).
4. **SIF com versionamento e retificação (P8)** — relatórios por Operação, geração versionada,
   retificação com motivo obrigatório, histórico de versões, tudo marcado **Provisório (P8 /
   v1.1 §16.10)** porque os modelos oficiais ainda não foram entregues pelo cliente.
5. **Escopo efetivo por representantes permitidos** — persistir a relação usuário↔representante,
   administrá-la na tela completa de Usuários, devolver a projeção reversa na tela de
   Representantes e aplicar o escopo, no backend, a Clientes, Pedidos e seus fluxos dependentes.

Ao final da onda, as 6 rotas de Gestão deixam de ser placeholder/parciais e a sétima rota
`/admin/usuarios` passa a governar o escopo comercial real, com dados reais, sem mock em runtime
(RA-06) e sem falha silenciosa (RA-05).

### As 7 rotas do escopo

| # matriz | Rota | Tela | Estado hoje | Estado no fim da onda |
|---|---|---|---|---|
| 8 | `/gestao/dashboard` | Painel Geral da Operação | Divergente — `GET /gestao/dashboard?dataOperacao=` com 5 agregações | 10 KPIs do protótipo + pedidos em andamento + alertas operacionais + atividades recentes, filtrados por `operacaoId` |
| 9 | `/gestao/operacoes` | Operações (cadência, extraordinária, status) | Backend D2 pronto (Onda 1); UI ausente | Tela fiel: lista com filtro de status, contadores por operação, geração de cadência, criação de extraordinária, transição de status |
| 10 | `/gestao/compras` | Compras Programadas | Divergente — CRUD + `/confirmar`; sem painel de impacto e sem edição de compra confirmada | Painel de impacto pré-salvamento, edição de compra confirmada com recálculo atômico, histórico de alterações |
| 11 | `/gestao/overbooking` | Pendências de Overbooking | Backend parcial (Onda 1: tabelas + status + histórico); decisão sem efeito; UI ausente | Fila mestre-detalhe, fontes de cobertura, 3 caminhos com efeito real, histórico e KPIs |
| 12 | `/gestao/aprovacoes` | Aprovações & Ocorrências | Divergente — ocorrências de fornecedor existem (F4a); sem fila unificada nem comparativo | Fila unificada (ocorrências + aprovações operacionais), comparativo imutável, decisão auditada |
| 13 | `/gestao/relatorios` | Relatórios & SIF | Ausente | Módulo `sif`: catálogo por Operação, pendências de dados calculadas, geração versionada, retificação com motivo, preview |
| 38 | `/admin/usuarios` | Usuários | Parcial — nome, login, perfis e status; dívida O3 D43/O4 D26 sem persistência nem aplicação de escopo | CRUD existente + multisseleção de Representantes permitidos; vazio = Todos; escopo efetivo em Clientes/Pedidos; auditoria; estados completos; projeção reversa em Representantes |

---

## Architecture

**Modular monolith** (ADR-002): um `@Module()` por domínio, Drizzle direto nos services, sem CQRS,
sem Event Sourcing, sem microserviços. Frontend Next.js App Router como **BFF**: toda chamada do
browser vai a uma rota `app/api/**` que repassa ao NestJS com o cookie de sessão — o browser nunca
fala direto com o backend.

```
app/backend/src/modules/
├── operacoes/                     [ALTERADO]  filtros de listagem + resumo por operação
├── comercial/
│   ├── compras-programadas/       [ALTERADO]  impacto, edição de compra confirmada, histórico
│   ├── disponibilidade/           [ALTERADO]  recalcularParaCompra + projetarImpacto
│   └── overbooking/               [ALTERADO]  cobertura + 3 caminhos com efeito real
├── gestao/
│   ├── dashboard/                 [ALTERADO]  operacaoId + 10 KPIs + alertas
│   └── aprovacoes/                [NOVO]      fila unificada + decisão + comparativo imutável
└── sif/                           [NOVO]      relatórios SIF: catálogo, geração, versões, retificação
```

Fluxo de uma decisão de gestão (padrão obrigatório em toda mutação desta onda — RA-02):

```
Controller (Zod + JwtAuthGuard + RbacGuard)
   → Service.metodo()
       → db.transaction(tx):
            SELECT ... FOR UPDATE            (trava o agregado)
            valida invariante                (409 explícito se violada)
            UPDATE/INSERT                    (efeito de domínio)
            auditoria.registrar(tx, ...)     (mesma transação)
            coleta eventos em memória
       → após COMMIT: eventEmitter.emit(...) (ADR-004, sem polling)
   → resposta tipada
```

Nenhum evento é emitido dentro da transação; nenhuma regra de negócio vive no frontend (RA-01).

---

## Tech Stack

| Camada | Tecnologia | Observação para esta onda |
|---|---|---|
| Backend | NestJS 11 + TypeScript 5 strict | `noUncheckedIndexedAccess` ligado — usar `primeiroOuFalha` |
| Banco | PostgreSQL 18 | `NUMERIC` nativo para todo cálculo de quantidade/peso (sem float) |
| ORM | Drizzle + `drizzle-kit` | migrations `0018_onda5_gestao.sql` e `0019_onda5_usuarios_representantes.sql` escritas à mão e registradas no `_journal.json` |
| Validação | Zod 4 | um schema por DTO, `ZodValidationPipe` no controller |
| Tempo real | `EventEmitter2` + WebSocket nativo | eventos novos: `COMPRA_ALTERADA_IMPACTO`, `APROVACAO_REGISTRADA`, `APROVACAO_DECIDIDA`, `RELATORIO_SIF_GERADO`. Emitir não basta: cada um precisa de `@OnEvent` + `broadcast` em `realtime.gateway.ts` (Task 2.5) e de `dataOperacao` no payload, porque `roomsDaData(dataOperacao)` é o que define a room |
| Frontend | Next.js 16 App Router + React 19 + Tailwind 4 + Shadcn/ui | DS v2 já absorvido (Onda 2); usar tokens, `KpiCard`, `StatusPill`, `AlertItem`, `ActivityItem`, `BadgeProvisorio` |
| Testes backend | Jest unit + integração com Postgres real | `createTestApp` / `cleanupDb` (`app/backend/test/helpers`) |
| Testes frontend | Jest + Testing Library; Playwright e2e | `app/frontend/__tests__/*.test.tsx`, `app/frontend/e2e/*.spec.ts` |

---

## Global Constraints

1. **Fidelidade absoluta ao protótipo (Princípio I, não-negociável).** Antes de escrever qualquer
   `.tsx`, ler o `.tsx` correspondente do protótipo citado em "Referências do protótipo". Layout,
   ordem das seções, rótulos, cores (via tokens do DS), colunas de tabela e textos de aviso são os
   do protótipo. Divergência só é aceita quando o protótipo usa dado inventado (seed) que o backend
   real não tem — nesse caso o dado vem do backend, o **layout permanece idêntico**.
2. **Completude E2E, não MVP (Princípio II).** Cada uma das 7 telas entra completa: listar, filtrar,
   detalhar, agir, ver histórico. Nenhum botão inerte, nenhuma aba vazia.
3. **Regras de negócio só no backend (RA-01).** O painel de impacto, a projeção de déficit, a
   escolha de fontes de cobertura, o status derivado do relatório SIF e o cálculo do comparativo
   são calculados no NestJS. O frontend apenas renderiza.
4. **Transação + auditoria em toda etapa crítica (RA-02).** Toda mutação desta onda grava em
   `auditoria` dentro da mesma transação, com `usuarioId` real.
5. **Nenhuma falha silenciosa nem dado inventado (RA-05/RA-06).** Sem fallback textual do tipo
   "Desconhecido"; ausência de dado é `null` e a UI mostra vazio explícito ou erro. Mock só em teste.
6. **Migration expand puro.** `0018_onda5_gestao` (número seguinte ao contract da Onda 4) apenas
   **cria** tabelas, índices, CHECKs e um trigger; não altera nem remove coluna existente. Nenhum
   `ALTER TABLE` manual fora da migration.
7. **Convenções de schema** (`docs/data/convencoes-schema.md`): PK `uuid` default `uuidv7()`;
   `TIMESTAMPTZ`; quantidades `NUMERIC(10,3)`; dinheiro `NUMERIC(15,2)`; status como `TEXT` + CHECK
   (nunca `pg ENUM`); soft delete `deleted_at`; `created_at`/`updated_at` em toda tabela de negócio;
   JSONB com índice GIN quando filtrado.
8. **Terminologia (v1.1 §6.8).** "Nome Fantasia" e "Buscar cliente". A palavra banida (M-a-r-c-a)
   não pode aparecer em tela, entidade, campo, comentário ou teste. O teste
   `app/frontend/__tests__/terminologia.test.ts` já vigia isso e será estendido às telas da onda.
9. **Pendências abertas viram parâmetro + badge Provisório (Princípio VIII).** Nesta onda a única
   pendência sinalizada é **P8** (v1.1 §16.10 — modelos oficiais SIF) na tela `/gestao/relatorios`,
   e **P1** (v1.1 §16.2 — cadência) já sinalizada em `/gestao/operacoes`. **É proibido criar AD nova
   nesta onda**: nenhuma pendência aberta é fechada por este plano.
10. **Cobertura ≥ 80% linha e branch** no backend (`npm run test:cov`), gate do CI.
11. **Fakes obrigatórios em teste**: `HARDWARE_FAKE=1`, `NFSE_FAKE=1`. Nenhum teste toca dispositivo
    ou EISS real.
12. **Commits atômicos por task**, mensagem `tipo(onda5): descrição` em português, sem `--no-verify`,
    push non-force.
13. **Precedência obrigatória da Onda 4 para a emenda E5.1.** As Tasks 1–18 originais continuam
    independentes; as Tasks 19–22 só começam depois que a Onda 4 estiver mergeada em `develop` e a
    branch da PR #28 tiver incorporado esse `develop`, pois a autorização será aplicada sobre as
    versões finais de `clientes.service.ts`, `pedidos.service.ts` e `adendos.service.ts`.
14. **Escopo é autorização de dados, não filtro visual.** Somente o backend decide se o usuário
    acessa o representante. A UI não envia parâmetro para ampliar escopo; todo endpoint de leitura
    e mutação de Cliente/Pedido recebe o `usuarioId` autenticado e aplica o mesmo predicado.

---

## Fronteira com a Onda 4

A parte original da Onda 5 e a Onda 4 podem ter sido iniciadas em paralelo. A emenda E5.1,
entretanto, **não** pode ser aplicada sobre a base anterior à Onda 4: ela fecha o escopo diretamente
nos serviços comerciais entregues pela O4. As regras da tabela abaixo continuam válidas para as
Tasks 1–18; as exceções literais das Tasks 19–22 estão na seção "Emenda E5.1".

| Assunto | Regra desta onda |
|---|---|
| `pendencias_overbooking` e `pendencias_overbooking_historico` | **Já existem** (Onda 1, migration `0012_onda1_expand`, `src/database/schema/pendencias-overbooking.schema.ts`). A Onda 5 **reutiliza** e não altera as tabelas. |
| Quem **abre** a pendência | O vendedor, em `PedidosService.persistirItensPlanejados` (Onda 1, `pedidos.service.ts:349-362`). A Onda 5 **consome** a fila; não muda a abertura. Contrato consumido: `{ pedido_venda_id, pedido_venda_item_id, item_comercial_id, cliente_id, vendedor_usuario_id, operacao_id, quantidade_deficit, status }` — matriz linha 11. |
| `pedidos_venda` / `reservas_disponibilidade` | A Onda 5 **chama métodos públicos já existentes** do `PedidosService` (`criar`, `reduzirItem`, `removerItem`) e não edita a lógica de pedidos. Toques em arquivos de pedidos: (a) `exports: [PedidosService]` no `pedidos.module.ts` (Task 6), 1 linha idempotente; (b) extração de `criarNaTx`/`reduzirItemNaTx`/`removerItemNaTx` e `export` do tipo `EventoDominio` em `pedidos.service.ts` (Task 6.4), refatoração sem mudança de comportamento; (c) `dataOperacao` + `operacaoId` no payload do evento `PENDENCIA_OVERBOOKING_ABERTA` (`pedidos.service.ts:359-362`, Task 2.5), que altera só o objeto emitido. Nenhum dos três muda regra de pedido. |
| `/comercial/*` | Fora do escopo. Nenhum arquivo em `app/frontend/src/app/(admin)/comercial/**` é criado ou alterado nesta onda. |
| Disponibilidade | A Onda 5 altera `disponibilidade.service.ts` acrescentando `projetarImpacto` e `recalcularParaCompra` (métodos novos). Não altera `gerarParaCompra` nem `listarPedidosEmRisco`. |
| Migration | A branch da Onda 4 reserva `0016_onda4_comercial_expand` e `0017_onda4_comercial_contract`; a E5.1 só começa depois que ambas estiverem em `develop`. A parte original usa `0018_onda5_gestao` e a emenda usa `0019_onda5_usuarios_representantes`. Se o `develop` pós-O4 ocupar um número, o Executor renumera para os próximos dois livres, preserva a ordem/conteúdo e registra a renumeração na PR #28. |

---

## Referências do protótipo (tela → arquivo)

Protótipo em `F:/Projetos/alpha-carnes-prototipo`, branch `feature/completude-v1.1`, commit
`8d32aa4cadff0a91ab155a9d47b019cd3731ce77`. Rotas confirmadas em `src/app/routes.tsx:63-68`.

| Rota real | Arquivo do protótipo | Linhas-chave a reproduzir |
|---|---|---|
| `/gestao/dashboard` | `src/app/pages/Dashboard.tsx` (207 linhas) | KPIs linha 1 = `12-16`; KPIs linha 2 = `20-24`; grids = `72-110`; "Pedidos em andamento" = `111-159`; "Alertas operacionais" = `160-181`; "Atividades recentes" = `182-200` |
| `/gestao/operacoes` | `src/app/pages/Operacoes.tsx` (212 linhas) | badge Provisório da cadência, filtro de status, cartão de operação, modal "Operação Extraordinária" |
| `/gestao/compras` | `src/app/pages/CompraProgramada.tsx` (791 linhas) | modal de edição + **painel de impacto** = `181-330` (cálculo `210-235`, resumo `247-253`, bloco visual `291-311`, histórico `312-330`); aviso "Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada" = `653`; "Histórico de alterações desta compra" = `725` |
| `/gestao/overbooking` | `src/app/pages/PainelOverbooking.tsx` (684 linhas) | KPIs = `422-435`; busca + filtro de status = `443-460`; campos do detalhe = `536-541`; caminho 1 Compra complementar = `565-589`; caminho 2 Redistribuição = `590-619`; caminho 3 Postergar = `620-645` e modal `258-320`; histórico/timeline = `130,151` |
| `/gestao/aprovacoes` | `src/app/pages/Aprovacoes.tsx` (641 linhas) | tipos de aprovação = `45-51`; aba 1 Ocorrências (mestre-detalhe) e **quadro comparativo Pedido × NF × Pesagem** = `374-410` (colunas em `383`, aviso de imutabilidade em `408`); modal de conclusão da tratativa = `196-250`; aba 2 Aprovações Operacionais = `500-560`; modal de decisão = `460-499` |
| `/gestao/relatorios` | `src/app/pages/RelatoriosSIF.tsx` (309 linhas) | tipos e status = `12-30`; catálogo dos 4 relatórios = `39-84`; KPIs = `228-240`; cartão do relatório com pendências e "Última versão" = `250-285`; modal de versões = `130-160`; ação "Gerar" = `278-282` |
| Dados de operação (todas as telas) | `src/app/data/operacoes.ts` (98 linhas) | `Operacao`, `DIAS_SEMANA`, `CADENCIA_OPERACAO_PADRAO`, `gerarOperacoesEntre`, `OPERACOES_SEED` — o rótulo da operação (`label`) é a fonte do texto exibido nos seletores de Operação de todas as 6 telas |
| `/admin/usuarios` | `src/app/pages/Usuarios.tsx` | Cabeçalho e ações, grade `8/4`, lista de usuários e resumo de perfis; a emenda preserva essa composição e completa o drawer real com o campo funcional exigido pela documentação |
| `/cadastros/representantes` | `src/app/pages/Representantes.tsx` | Sétima coluna "Usuários vinculados" e bloco homônimo no drawer; ambos retornam como projeção reversa real de `usuarios_representantes` |
| Shell autenticado | `src/app/components/Layout.tsx` | Identificação "Escopo" no cabeçalho; o valor deixa de ser seed e passa a vir de `/auth/me` |

Regra de leitura obrigatória para o Worker: **antes de cada task de tela**, abrir o arquivo do
protótipo indicado e a tela real correspondente lado a lado. A tela real reproduz cabeçalho,
espaçamentos, ordem dos blocos e textos; substitui apenas os dados de seed pelos dados do backend.

---

## Estado originalmente verificado para as Tasks 1–18

> Esta seção preserva a auditoria histórica do plano original em `4a3aa02`. A base viva da emenda
> é `b4ad3b39b11000099d19f713637c6bd9d24ff942`, fixada no quadro do topo; os fatos comerciais que
> dependem da O4 devem ser lidos na versão mergeada exigida pela Task 19.

Auditoria feita no worktree `F:/Projetos/AlphaCarnes/.worktrees/onda5-plan`:

**Existe e será reutilizado (não recriar):**

| Ativo | Arquivo | Fato verificado |
|---|---|---|
| Tabela `operacoes` | `src/database/schema/operacoes.schema.ts` | `data` única, `dia_semana`, `rotulo`, `status IN ('aberta','em_andamento','fechada')`, `extraordinaria`, `criada_por_id` |
| Serviço de Operação | `src/modules/operacoes/operacoes.service.ts` | `garantirOperacao`, `listar`, `detalhar`, `gerarCadencia` (lê parâmetro `operacao.cadencia_dias_semana`), `criarExtraordinaria`, `alterarStatus` com `TRANSICOES_OPERACAO` |
| Listagem de Operação **já paginada e filtrável** | `operacoes.service.ts:101-118` | `listar(query)` já devolve `Paginado<Operacao>` via `montarPaginado` e já filtra `de`, `ate`, `status`, `pagina`, `limite`; ordena por `asc(data)`. **A Task 4 não introduz o envelope** — ele existe |
| DTO de Operação | `src/modules/operacoes/dto/operacao.dto.ts` (**nome real: `operacao.dto.ts`, singular**) | `listarOperacoesSchema` **já existe** (`de`, `ate`, `status`, `pagina` default 1, `limite` default 20, `refine` de `de <= ate`), além de `criarExtraordinariaSchema`, `gerarCadenciaSchema`, `alterarStatusOperacaoSchema` |
| Endpoints de Operação | `src/modules/operacoes/operacoes.controller.ts` | `GET /operacoes` (**já com `ZodValidationPipe(listarOperacoesSchema)` na query**), `GET /operacoes/:id`, `POST /operacoes/extraordinaria`, `POST /operacoes/gerar-cadencia`, `PATCH /operacoes/:id/status` |
| Gateway de tempo real | `src/realtime/realtime.gateway.ts`, `src/realtime/events/eventos.ts:58-60` | Um `@OnEvent` por evento chamando `this.broadcast(evento, payload, payload.dataOperacao)`; `roomsDaData(data)` devolve `['dashboard', 'operacao:<data>']`. **Evento sem handler no gateway não chega ao browser** |
| Compras programadas | `compras-programadas.service.ts` / `.controller.ts` | CRUD + `confirmar` idempotente; `assertEditavel` hoje limita mutação a `rascunho`/`em_negociacao` |
| Disponibilidade | `disponibilidade.service.ts:54-104` | `gerarParaCompra` calcula `SUM(fator × quantidade_comprada)` em SQL com `ON CONFLICT (compra_programada_id, item_comercial_id) DO NOTHING` |
| Overbooking | `overbooking.service.ts`, `dto/overbooking.dto.ts` | `listar`/`detalhar`/`alterarStatus` com histórico e `TRANSICOES_PENDENCIA`; `decidir` hoje é apenas alias de `alterarStatus` (troca de status **sem efeito de domínio**) |
| Abertura de pendência | `pedidos.service.ts:338-371` | Cria reserva `tipo_consumo='overbooking'` + `pendencias_overbooking` + histórico `confirmada_pelo_vendedor` + eventos |
| Conferência tripla | `conferencia.service.ts:37-97,256-267` | `QuadroItem` (`qtdPedido`, `qtdNf`, `qtdApurada`, `pesoNf`, `pesoApurado`, `situacao`) persistido em `conclusoes_conferencia.quadro_json` |
| Ocorrência de fornecedor | `ocorrencia-fornecedor.service.ts` | `listar`, `detalhar`, `abrir`/`abrirNaTx`, `atualizar`, `encerrar` |
| Dashboard | `gestao/dashboard/dashboard.service.ts` | `resumoDia(dataOperacao)` com 5 agregações + pedidos em andamento + atividades da auditoria |
| DS/UI | `src/components/ui/` | `KpiCard`, `StatusPill`, `AlertItem`, `ActivityItem`, `PipelineBar`, `BadgeProvisorio`, `CadastroTabelaDrawer` (Onda 3) |
| Menu | `src/lib/menu-v2.ts:33-38`, `src/common/rbac/menus-canonicos.ts:12-17` | As 6 rotas de Gestão já estão no menu canônico e na visibilidade por perfil |
| Permissões | `src/common/rbac/permissoes.ts` | `OPERACOES_GERENCIAR`, `COMPRAS_PROGRAMADAS_LER/GERENCIAR`, `DISPONIBILIDADE_LER`, `PEDIDOS_LER`, `OVERBOOKING_RESOLVER`, `OCORRENCIA_FORNECEDOR_GERENCIAR`, `AUDITORIA_VISUALIZAR` |
| Ocorrências de fornecedor (API) | `ocorrencia-fornecedor.controller.ts` | `@Controller('operacao/ocorrencias-fornecedor')` com `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/encerrar`, todos sob `OCORRENCIA_FORNECEDOR_GERENCIAR`. **Não há nenhuma rota BFF para esse controller** — a Task 10 cria |
| Proxy cru do BFF | `src/lib/api.ts:30-37` | `apiFetch(path, options)` devolve o `Response` bruto (status + corpo íntegros). `fetchBackend` **descarta o corpo do erro** (reduz a `{ message }`) — inutilizável no challenge 409 do painel de impacto |

**Colunas que NÃO existem (checado no schema Drizzle — todo agrupamento por Operação exige JOIN):**

| Tabela | Fato verificado | Caminho real até `operacao_id` |
|---|---|---|
| `transformacoes` | `transformacoes.schema.ts:9-46` — colunas: `peca_origem_id`, `tipo_transformacao`, `motivo`, `status_transformacao`, pesos. **Não tem `operacao_id`** | `transformacoes.peca_origem_id → pecas.id`, `pecas.recebimento_id → recebimentos.id`, `recebimentos.operacao_id` |
| `pecas` | `pesagem.schema.ts:14-51` — tem `compra_programada_id` e `recebimento_id`. **Não tem `operacao_id`** | `pecas.recebimento_id → recebimentos.operacao_id` |
| `notas_fiscais` | `faturamento.schema.ts:55-108` — tem `faturamento_id` e `caminhao_id`. **Não tem `operacao_id`** | `notas_fiscais.caminhao_id → caminhoes.operacao_id` (equivalente: `notas_fiscais.faturamento_id → faturamentos.operacao_id`) |
| `notas_fiscais_fornecedor` | `notas-fiscais-fornecedor.schema.ts:17-34` — a coluna da chave da NF-e chama-se **`chave`** (não `chave_acesso`); tem `recebimento_id`, não tem `operacao_id` | `notas_fiscais_fornecedor.recebimento_id → recebimentos.operacao_id` |
| `divergencias_recebimento` | `recebimentos.schema.ts:96-130` — tem `recebimento_id` e `status IN ('aberta','em_analise','aguardando_fornecedor','resolvida')`; **não tem `deleted_at`** (não filtrar por soft delete aqui) | `divergencias_recebimento.recebimento_id → recebimentos.operacao_id` |
| `recebimentos` | `recebimentos.schema.ts:31-64` — **não tem `numero_lote`**; a referência textual do lote é `romaneio` (nullable), com `nota_fiscal_fornecedor` (nullable) como alternativa | `operacao_id` direto; o alerta de divergência usa `coalesce(romaneio, nota_fiscal_fornecedor)` e omite a referência quando ambos são nulos |
| `caminhoes` | `expedicao.schema.ts:13-36` — **não existe coluna de seguro/averbação**; `fiscal.seguro_integrado` = "Não (manual)" (`seed.ts:112-118`). O estado real equivalente é `status_caminhao = 'faturado'` (NFS-e emitidas, aguardando `liberado_saida`, `liberacao.service.ts:80-102`) | `operacao_id` direto |
| `recebimentos`, `caminhoes`, `faturamentos`, `compras_programadas`, `pedidos_venda`, `pendencias_overbooking` | Têm `operacao_id` direto | filtro direto |

**CHECKs do banco que restringem os `UPDATE`s desta onda (auditados no schema real):**

| CHECK | Arquivo | Consequência para o código da onda |
|---|---|---|
| `chk_reservas_qtd_positiva` (`quantidade_reservada > 0`) | `pedidos.schema.ts:96` | Liberar reserva é **só** `status='liberada'`; nunca gravar `quantidade_reservada = 0` (padrão de `pedidos.service.ts:439-441,484-486,502-509`) |
| `chk_pend_ovb_deficit` (`quantidade_deficit > 0`) | `pendencias-overbooking.schema.ts:34` | Ao zerar o déficit, **não gravar** a coluna: preservar o último valor positivo e encerrar via `status` (contorno já comentado em `pedidos.service.ts:454-458`) |
| `chk_pedidos_itens_pedida_positiva` (`quantidade_pedida > 0`) | `pedidos.schema.ts:64` | Zerar um item é impossível: postergar/retirar um item inteiro é `removerItem` (soft delete), não `reduzirItem` — que além do CHECK também exige `novaQuantidade` positiva no Zod (`dto/pedido.dto.ts:58`) |

**Frontend — estado real das 6 rotas e do BFF:**

| Ativo | Fato verificado |
|---|---|
| `gestao/dashboard/page.tsx` + `dashboard-client.tsx` | Tela real parcial (5 agregações) — **alterar** |
| `gestao/compras/page.tsx` + `compras-client.tsx` | Tela real (CRUD + confirmar) — **alterar** |
| `gestao/operacoes/page.tsx`, `gestao/overbooking/page.tsx`, `gestao/aprovacoes/page.tsx`, `gestao/relatorios/page.tsx` | **Os 4 arquivos já existem** e renderizam `<PlaceholderPage title="…" />`. São **alterados**, não criados; o `*-client.tsx` de cada um é que é novo |
| `src/lib/operacao.ts` | **Já existe** (domínio operacional de F4a/F4b/F5/F6a: recebimento, pesagem, corte, caminhão, conferência). O cliente de Operação desta onda vai em **`src/lib/gestao-operacoes.ts`** para não colidir por proximidade de nome |
| BFF `comercial/compras-programadas/**` | Já existem: `route.ts` (GET, POST), `[id]/route.ts` (GET, PATCH, DELETE), `[id]/confirmar/route.ts` (POST), `[id]/itens/[itemId]/route.ts` (PATCH, hoje com `fetchBackend`) |
| BFF `comercial/overbooking/**` | Já existem: `route.ts` (GET), `[id]/route.ts` (GET), `[id]/decisao/route.ts` (POST, hoje com `fetchBackend`). **Não há rota para `PATCH /:id/status`** |
| BFF `gestao/dashboard/route.ts` | Já existe, hoje repassa `dataOperacao` |
| **Rota catch-all é proibida nesta onda** | `src/app/api/comercial/compras-programadas/` e `src/app/api/comercial/overbooking/` já têm o segmento dinâmico `[id]`. Criar `[...path]` irmão de `[id]` no mesmo nível quebra o build do Next (`You cannot use different slug names for the same dynamic path`). A Task 10 usa **apenas rotas explícitas** |

**Falta (é o que esta onda entrega):**

1. `GET /comercial/compras-programadas/:id/impacto` e edição de compra **confirmada** com recálculo.
2. Histórico de alterações da compra exposto por API.
3. Efeito real dos 3 caminhos de decisão de overbooking + fontes de cobertura + endpoint de histórico.
4. Fila unificada de aprovações, tabela `aprovacoes_operacionais` e leitura do comparativo imutável.
5. Garantia **no banco** da imutabilidade de `conclusoes_conferencia.quadro_json`.
6. Módulo `sif` inteiro (`relatorios_sif`, `relatorios_sif_versoes`).
7. Dashboard por `operacaoId` com os 10 KPIs, alertas operacionais e atividades.
8. As 6 telas (todas as rotas de Gestão hoje são placeholder, exceto o dashboard parcial).

---

## Decisões de design (fixadas — o Worker não escolhe)

### Escopo e fronteiras

**D5.1** — O subescopo original é exatamente as 6 rotas de Gestão da tabela acima. A E5.1
acrescenta `/admin/usuarios` e a projeção visual em `/cadastros/representantes`, além de tocar os
serviços backend de Clientes/Pedidos para aplicar autorização; nenhuma nova tela `/comercial/*`
entra. Continuam fora: `/recebimento/*` (Onda 6), `/desossa/*` (Onda 7), `/estoque/*` (Onda 8),
`/carga/*` (Onda 9), `/faturamento/*` (Onda 10).

**D5.2** — O **seletor de Operação** é o filtro global das 6 telas. Todas as APIs desta onda
recebem `operacaoId` (UUID), nunca `dataOperacao`. Onde o backend precisa da data, resolve por
`SELECT data FROM operacoes WHERE id = :operacaoId`.

**D5.3** — `GET /gestao/dashboard` passa a aceitar **apenas** `operacaoId`. Quando ausente, o
serviço resolve a **operação corrente**: a de menor `data >= CURRENT_DATE` com `status <> 'fechada'`;
se não houver, a de maior `data`; se a tabela estiver vazia, retorna `404 OPERACAO_INEXISTENTE`
(não inventa data — RA-06). O parâmetro `dataOperacao` é **removido** (não há cliente externo; o
único consumidor é o BFF, alterado na mesma onda).

**D5.4** — Nenhuma AD nova é criada. P8 permanece aberta e a tela SIF exibe `BadgeProvisorio` com
`pendencia="P8"`. `/gestao/operacoes` exibe `BadgeProvisorio` com `pendencia="P1"` na cadência.

### Modelo de dados (migration `0018_onda5_gestao`, expand puro)

**D5.5 — `relatorios_sif`** (um registro por Operação × tipo de relatório):

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK default `uuidv7()` | |
| `operacao_id` | `uuid` NOT NULL → `operacoes(id)` | |
| `tipo` | `text` NOT NULL | CHECK `IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')` — os 4 do protótipo (`RelatoriosSIF.tsx:39-84`) |
| `codigo` | `text` NOT NULL | `SIF-01..SIF-04`, derivado do tipo |
| `nome` | `text` NOT NULL | rótulo exibido, sufixo "(provisório)" |
| `status` | `text` NOT NULL default `'pendente_dados'` | CHECK `IN ('pendente_dados','pronto_para_gerar','gerado','retificado')` |
| `perfil_responsavel` | `text` NOT NULL | slug do perfil dono (`recebimento_pesagem`, `corte`, `expedicao`, `administrador`) |
| `pendencias_json` | `jsonb` NOT NULL default `'[]'` | lista de strings calculada pelo serviço a cada leitura/geração |
| `versao_atual` | `integer` NOT NULL default `0` | |
| `provisorio` | `boolean` NOT NULL default `true` | enquanto P8 estiver aberta |
| `created_at`/`updated_at`/`deleted_at` | `timestamptz` | padrão |

Unicidade: `uq_relatorios_sif_operacao_tipo` em `(operacao_id, tipo)` `WHERE deleted_at IS NULL`.

**D5.6 — `relatorios_sif_versoes`** (append-only, nunca sofre UPDATE nem DELETE):

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK | |
| `relatorio_id` | `uuid` NOT NULL → `relatorios_sif(id)` | |
| `versao` | `integer` NOT NULL | `versao_atual + 1` |
| `tipo_geracao` | `text` NOT NULL | CHECK `IN ('gerado','retificado')` |
| `motivo_retificacao` | `text` | CHECK `chk_sif_versao_motivo`: obrigatório quando `tipo_geracao='retificado'`, proibido quando `'gerado'` |
| `conteudo_json` | `jsonb` NOT NULL | snapshot dos números apurados no instante da geração |
| `gerado_por_id` | `uuid` NOT NULL → `usuarios(id)` | |
| `gerado_em` | `timestamptz` NOT NULL default `now()` | |
| `created_at` | `timestamptz` NOT NULL default `now()` | |

Unicidade: `uq_sif_versao` em `(relatorio_id, versao)`.

**D5.7 — `aprovacoes_operacionais`** (solicitações que exigem decisão de gestão — v1.1 §8.6):

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK | |
| `operacao_id` | `uuid` NOT NULL → `operacoes(id)` | |
| `tipo` | `text` NOT NULL | CHECK `IN ('divergencia_transformacao','estorno_fora_regra','reabertura_carga_pedido','ajuste_estoque_relevante')` — exatamente os 4 do protótipo (`Aprovacoes.tsx:45-51`) |
| `origem` | `text` NOT NULL | tela de origem, ex. `Desossa — Pesagem e Destinação` |
| `descricao` | `text` NOT NULL | |
| `impacto` | `text` NOT NULL | |
| `referencia_tabela` | `text` | tabela do registro que originou a solicitação |
| `referencia_id` | `uuid` | id do registro de origem |
| `solicitante_id` | `uuid` NOT NULL → `usuarios(id)` | |
| `solicitado_em` | `timestamptz` NOT NULL default `now()` | |
| `status` | `text` NOT NULL default `'pendente'` | CHECK `IN ('pendente','aprovada','rejeitada')` |
| `decisao_motivo` | `text` | |
| `decidido_por_id` | `uuid` → `usuarios(id)` | |
| `decidido_em` | `timestamptz` | |
| `created_at`/`updated_at`/`deleted_at` | `timestamptz` | padrão |

CHECK `chk_aprovacao_decisao`: `pendente` exige os três campos de decisão nulos; `aprovada`/
`rejeitada` exige os três preenchidos. Isso impede decisão sem motivo e status decidido sem autor.

**D5.8 — Imutabilidade do comparativo, garantida no banco.** A migration cria a função e o trigger:

```sql
CREATE OR REPLACE FUNCTION conclusao_conferencia_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'conclusoes_conferencia e imutavel (v1.1 6.10.7): tentativa de % em %',
    TG_OP, TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conclusoes_conferencia_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();
```

Nenhum código de aplicação hoje faz `UPDATE`/`DELETE` nessa tabela (verificado); o trigger torna a
regra estrutural, não convencional. O mesmo trigger é aplicado a `conclusoes_conferencia_nfs`.

**D5.9 — Nada de tabela nova para histórico de compra.** O histórico exibido em `/gestao/compras`
("Histórico de alterações desta compra", protótipo linha 725) é **derivado de `auditoria`**
(`tabela IN ('compras_programadas','compras_programadas_itens')`, `registro_id` = id da compra ou de
seus itens). Auditoria já grava `dados_anteriores`/`dados_novos` (RA-02) — criar tabela paralela
duplicaria fonte de verdade.

### Painel de impacto e edição de compra confirmada

**D5.10 — Contrato do impacto.** `GET /comercial/compras-programadas/:id/impacto?simulacao=<itemCompraId>:<qtd>[,<itemCompraId>:<qtd>]`.
Verbo `GET` porque a operação é **read-only** (nada é persistido — é "pré-salvamento"); `simulacao`
é opcional (sem ela, retorna a fotografia atual com deltas zerados). Resposta:

```ts
interface ImpactoCompra {
  compraId: string;
  operacaoId: string;
  status: string;
  itens: Array<{
    itemComercialId: string; codigo: string; descricao: string;
    quantidadeGeradaAtual: string;   // disponibilidades_virtuais.quantidade_total_gerada
    quantidadeGeradaProjetada: string;
    delta: string;                    // projetada - atual (pode ser negativo)
    quantidadeReservada: string;
    saldoAtual: string;               // quantidade_disponivel
    saldoProjetado: string;           // max(0, projetada - reservada)
    deficitProjetado: string;         // max(0, reservada - projetada)
  }>;
  deficitTotal: string;
  exigeConfirmacao: boolean;          // deficitTotal > 0
  resumo: string;                     // texto do protótipo (CompraProgramada.tsx:247-253)
}
```

Todo cálculo em SQL/`NUMERIC` (helpers `somarQtd`/`subtrairQtd`/`compararQtd` já existentes) —
nunca `Number` em quantidade.

**D5.11 — Edição de compra confirmada.** `PATCH /comercial/compras-programadas/:id/itens/:itemId`
passa a aceitar compra com status `confirmada`, além de `rascunho` e `em_negociacao`.
`cancelada` continua imutável. Quando o status é `confirmada`, o serviço, **em uma transação**:

1. `SELECT ... FOR UPDATE` na linha da compra **e** na linha do item (`buscarAtivaSobLock` +
   `.for('update')` no item, Task 5.3) — é esse par que serializa duas edições concorrentes; as
   linhas de `disponibilidades_virtuais` são travadas pelo próprio `UPDATE` do passo 5, dentro da
   mesma transação;
2. recalcula o impacto com as quantidades novas;
3. se `deficitTotal > 0` e o corpo não trouxer `confirmarDeficit: true`, lança
   `409 IMPACTO_CONFIRMACAO_NECESSARIA` com o payload `ImpactoCompra` e **não persiste nada**
   (mesmo padrão do challenge de overbooking — AD-05);
4. atualiza `compras_programadas_itens.quantidade_comprada`;
5. `UPDATE disponibilidades_virtuais SET quantidade_total_gerada = <projetada>,
   quantidade_disponivel = GREATEST(0, <projetada> - quantidade_reservada), status = <derivado>`;
6. grava auditoria da compra, do item e de cada disponibilidade afetada;
7. após o commit, emite `COMPRA_ALTERADA_IMPACTO`.

Isto **revoga a guarda de imutabilidade do item** que hoje existe em
`compras-programadas.service.ts:181` (`assertEditavel` dentro de `atualizarItem`) e o teste que a
afirma (`compras-programadas.e2e-spec.ts:75-95`), substituído na Task 5.6. A imutabilidade do
**cabeçalho** da compra confirmada continua valendo.

Contrato do corpo e da resposta (detalhado e justificado na Task 5.2): `quantidadeComprada` passa a
ser **obrigatória** e aceita `string` decimal ou `number`, normalizada para `string` NUMERIC de 3
casas; `observacoes` **continua existindo** e continua sendo persistida — removê-la faria a tela
atual (`compras-client.tsx:167-174`) perder dado em silêncio; a resposta 200 passa a ser
`{ item, impacto }`.

**D5.12 — Déficit não vira pendência automática nesta onda.** O déficit projetado é **exibido**
(painel de impacto, KPI "Overbookings abertos" e alerta do dashboard) e fica registrado na
auditoria e no evento. A abertura de `pendencias_overbooking` continua sendo o caminho do vendedor
(`pedidos.service.ts:349`), porque a pendência exige `pedido_venda_item_id` e vendedor responsável —
atribuir esses campos automaticamente a partir de uma redução de compra seria inventar dado (RA-06).
O gestor enxerga o risco por `GET /comercial/disponibilidade/pedidos-em-risco`, já existente, que a
tela de compras consome para listar os pedidos afetados pelo déficit.

**D5.13 — Status derivado da disponibilidade** após recálculo: `esgotada` quando
`quantidade_disponivel = 0`; `parcialmente_reservada` quando `0 < quantidade_disponivel < quantidade_total_gerada`;
`gerada` quando `quantidade_reservada = 0`. Mesma semântica já usada em `pedidos.service.ts:319-322`.

### Overbooking — os 3 caminhos com efeito real

**D5.14 — Fontes de cobertura.** `GET /comercial/overbooking/:id/cobertura` devolve:

```ts
interface CoberturaPendencia {
  pendenciaId: string;
  itemComercialId: string;
  quantidadeDeficit: string;
  comprasComplementares: Array<{           // compras da operação atual ou futuras que geram o item
    compraProgramadaId: string; operacaoId: string; dataOperacao: string;
    status: string; quantidadeProjetada: string;
  }>;
  redistribuicoes: Array<{                 // reservas ativas de OUTROS pedidos no mesmo item
    pedidoVendaId: string; pedidoVendaItemId: string; clienteNome: string;
    quantidadeReservada: string; reservaId: string; disponibilidadeVirtualId: string;
  }>;
  proximaOperacao: { id: string; data: string; rotulo: string } | null;
}
```

Se não houver fonte, a lista vem vazia e a UI mostra o estado vazio do protótipo — nunca uma opção
fabricada.

**D5.15 — Caminho 1 · compra complementar.** `POST /:id/decisao` com
`{ caminho: 'compra_complementar', compraProgramadaId, quantidade }`. Valida: compra existe, não
cancelada, sua operação tem `data >= data da operação da pendência`, e ela gera o `item_comercial_id`
da pendência (via `regras_desdobramento_comercial`). Efeito: grava `decisao_json`
`{ compraProgramadaId, quantidade, operacaoDestinoId }`, status → `compra_complementar_programada`,
histórico + auditoria. Não altera quantidades da compra (quem altera é o comprador na tela de
Compras) — a decisão é o compromisso rastreável.

**D5.16 — Caminho 2 · redistribuição.** `POST /:id/decisao` com
`{ caminho: 'redistribuicao', reservaOrigemId, quantidade }`. Efeito atômico:

1. trava a reserva doadora (`reservas_disponibilidade`, `tipo_consumo IN ('fisico','virtual')`,
   `status='ativa'`) e a reserva de overbooking do item deficitário;
2. `quantidade` ≤ saldo da doadora e ≤ `quantidade_deficit`, senão `409`;
3. doadora: `quantidade_reservada -= quantidade`; se esgotar, **só** `status='liberada'` — a
   quantidade permanece positiva, porque `chk_reservas_qtd_positiva` (`pedidos.schema.ts:96`) proíbe
   `quantidade_reservada = 0`;
4. item deficitário ganha reserva `tipo_consumo='virtual'` na mesma `disponibilidade_virtual_id` da
   doadora, e sua reserva `overbooking` diminui na mesma quantidade;
5. `pedidos_venda_itens` de ambos: `quantidade_reservada` e `quantidade_overbooking` ajustados;
6. `pendencias_overbooking.quantidade_deficit -= quantidade`; status →
   `redistribuicao_decidida` (ou `resolvida` se o déficit zerar). Ao zerar, o `UPDATE` **não grava**
   `quantidade_deficit`: `chk_pend_ovb_deficit` (`pendencias-overbooking.schema.ts:34`) exige `> 0`,
   então o último déficit positivo é preservado e o encerramento fica no `status` — mesmo contorno
   já em produção em `PedidosService.atualizarOuCancelarPendencia` (`pedidos.service.ts:454-458`);
7. auditoria de cada linha tocada; após o commit, `RESERVA_ATUALIZADA` +
   `PENDENCIA_OVERBOOKING_ATUALIZADA` (ou `..._RESOLVIDA`).

O saldo agregado de `disponibilidades_virtuais` **não muda** (a mesma quantidade só troca de dono):
`quantidade_reservada` e `quantidade_disponivel` permanecem — invariante verificada em teste.

**D5.17 — Caminho 3 · postergar (novo pedido).** `POST /:id/decisao` com
`{ caminho: 'novo_pedido', quantidade, operacaoDestinoId, compraProgramadaId }`. Efeito atômico:

1. valida `quantidade ≤ quantidade_deficit`, que `operacaoDestinoId` é operação **não fechada** com
   `data > data da operação da pendência`, e que `compraProgramadaId` é uma compra não cancelada
   **da operação de destino** (`pedidos_venda.compra_programada_id` é `NOT NULL`, `pedidos.schema.ts:17`);
2. libera o item do pedido original **por uma única via**, escolhida pela quantidade:
   - postergação **parcial** (`quantidade < quantidade_pedida`) → `reduzirItemNaTx`;
   - postergação **total** (`quantidade = quantidade_pedida`) → `removerItemNaTx`, porque
     `chk_pedidos_itens_pedida_positiva` (`pedidos.schema.ts:64`) e `reduzirItemSchema`
     (`dto/pedido.dto.ts:58`) proíbem item com quantidade zero;
3. cria um pedido novo com `PedidosService.criarNaTx({ compraProgramadaId, clienteId, dataOperacao:
   <data da operação de destino>, itens: [{ itemComercialId, quantidadePedida }], observacoesGerais },
   usuarioId, true)` — `confirmado = true` porque a decisão do gestor é a confirmação explícita
   exigida por AD-05;
4. **o déficit não é abatido duas vezes**: tanto `reduzirItemNaTx` quanto `removerItemNaTx` já
   chamam `atualizarOuCancelarPendencia` (`pedidos.service.ts:404,542`), que reduz o
   `quantidade_deficit` ou cancela a pendência. `decidir` **relê a pendência sob o mesmo lock** e
   apenas grava a decisão: nunca subtrai de novo e nunca reabre um status terminal. Resultado:
   parcial → `novo_pedido_criado` com o déficit já reduzido; total → `cancelada`;
   `decisao_json = { quantidade, operacaoDestinoId, compraProgramadaId, itemOrigemRemovido, novoPedidoId }`;
5. auditoria + histórico; após o commit, `PENDENCIA_OVERBOOKING_ATUALIZADA`/`..._RESOLVIDA`.

**D5.18 — Transições.** `TRANSICOES_PENDENCIA` permanece como está (`dto/overbooking.dto.ts:43-62`).
O caminho só é aceito se a transição a partir do status atual for válida; caso contrário `409`.
Quando o déficit chega a zero pelo **caminho 2** (redistribuição), o serviço aplica o status do
caminho e, na mesma transação, a transição para `resolvida` (permitida por `TRANSICOES_PENDENCIA`).
O caminho 1 **não** abate déficit (`quantidadeAbatida='0.000'`, D5.15) e portanto não dispara essa
transição. `resolvida` e `cancelada` são terminais: se o efeito já deixou a pendência em um deles
(caminho 3 total → `cancelada`), esse status prevalece e `decidir` apenas registra a decisão.

### Aprovações & Ocorrências

**D5.19 — Fila unificada.** `GET /gestao/aprovacoes?operacaoId=&aba=ocorrencias|operacionais&status=`
retorna envelope paginado (`montarPaginado`). A aba `ocorrencias` projeta `ocorrencias_fornecedor`
(+ contadores de divergência); a aba `operacionais` projeta `aprovacoes_operacionais`. As duas abas
são endpoints da mesma rota porque a tela do protótipo é uma só com duas abas (`Aprovacoes.tsx`).

**D5.20 — Comparativo imutável.** `GET /gestao/aprovacoes/ocorrencias/:id/comparativo` devolve
`conclusoes_conferencia.quadro_json` **como está**, enriquecido apenas com `codigo`/`descricao` do
item comercial (JOIN de leitura), mais `{ imutavel: true, concluidaEm, concluidaPorNome }`. Se a
ocorrência não tiver conclusão vinculada, responde `404 CONCLUSAO_INEXISTENTE` — não monta quadro
"na hora" (seria recalcular histórico, proibido por v1.1 §6.10.7).

**D5.21 — Decisão de aprovação operacional.** `POST /gestao/aprovacoes/operacionais/:id/decidir`
com `{ decisao: 'aprovada' | 'rejeitada', motivo }` (motivo obrigatório, mínimo 10 caracteres).
Idempotência: decidir uma aprovação já decidida devolve `409 APROVACAO_JA_DECIDIDA`.

**D5.22 — Abertura de aprovação operacional.** `POST /gestao/aprovacoes/operacionais` cria a
solicitação (usado pelas telas de Desossa/Carga/Estoque/Faturamento nas ondas 7–10). O serviço
expõe também `abrirNaTx(tx, dados)` para que essas ondas abram a solicitação dentro da própria
transação, no mesmo padrão de `OcorrenciaFornecedorService.abrirNaTx`.

### SIF

**D5.23 — Catálogo é código, registro é banco.** Os 4 tipos de relatório vivem em
`src/modules/sif/catalogo-sif.ts` (constante tipada com `tipo`, `codigo`, `nome`,
`perfilResponsavel`, `regrasPendencia`). `GET /sif/relatorios?operacaoId=` chama
`garantirRelatoriosDaOperacao(operacaoId)`, que insere idempotentemente as 4 linhas em
`relatorios_sif` (`ON CONFLICT (operacao_id, tipo) DO NOTHING`) e recalcula pendências e status.

**D5.24 — Pendências de dados calculadas, nunca digitadas.** Cada tipo declara suas regras, avaliadas
por SQL sobre dados reais da operação:

| Tipo | Pendência emitida quando | Caminho até a Operação (nenhuma dessas tabelas tem `operacao_id`, exceto `caminhoes`) |
|---|---|---|
| `mapa_recebimento` | há `pecas` com `status_peca = 'pesada'` e `pedido_venda_id IS NULL`; há `notas_fiscais_fornecedor` com a coluna **`chave`** nula ou em branco | `pecas.recebimento_id → recebimentos.operacao_id`; `notas_fiscais_fornecedor.recebimento_id → recebimentos.operacao_id` |
| `producao_desossa` | há `transformacoes` com `status_transformacao NOT IN ('concluida','cancelada')` — cancelada **não** é pendência, por isso `NOT IN` e não `<> 'concluida'` | `transformacoes.peca_origem_id → pecas.id → pecas.recebimento_id → recebimentos.operacao_id` |
| `controle_expedicao` | há `caminhoes` com `status_caminhao IN ('planejado','aguardando_carga','em_carga','em_conferencia')` (todos anteriores a `fechado`) | `caminhoes.operacao_id` (direto) |
| `perdas_destinacao` | há `divergencias_recebimento` com `status <> 'resolvida'` | `divergencias_recebimento.recebimento_id → recebimentos.operacao_id` |

`status = 'pendente_dados'` quando a lista não é vazia; `'pronto_para_gerar'` quando é vazia e
`versao_atual = 0`; `'gerado'`/`'retificado'` conforme o `tipo_geracao` da última versão.

**D5.25 — Geração e retificação.** `POST /sif/relatorios/:id/gerar` exige `status='pronto_para_gerar'`
ou `'gerado'`/`'retificado'` (nova versão sobre relatório já gerado é permitida — protótipo linha
`278`, botão desabilitado só em `pendente_dados`), cria versão `versao_atual + 1` com
`tipo_geracao='gerado'`. `POST /sif/relatorios/:id/retificar` exige `versao_atual >= 1` e
`motivo` (mínimo 10 caracteres), cria versão com `tipo_geracao='retificado'`. Gerar com pendências
abertas → `409 RELATORIO_COM_PENDENCIAS`. `GET /sif/relatorios/:id/versoes` e
`GET /sif/relatorios/:id/preview` (preview = `conteudo_json` da última versão; sem versão →
`404 SEM_VERSAO_GERADA`, jamais um preview fabricado).

**D5.26 — Conteúdo da versão.** `conteudo_json` é o snapshot dos números apurados da operação no
instante da geração (recebido, desossado, expedido, divergências), calculado por
`SifCalculoService`. O **layout oficial** é o que está pendente (P8) — por isso o snapshot é
genérico e a tela exibe o badge Provisório. Nenhum campo é inventado para "parecer" um modelo SIF.

### Seeds

**D5.27** — Novo parâmetro em `PARAMETROS_SEED` (`src/database/seed.ts`), 10ª chave:

```ts
{
  chave: 'gestao.modelos_relatorio_sif',
  descricao: 'Modelos oficiais dos relatórios SIF',
  valorJson: {
    grupo: 'Operação',
    tipo: 'texto',
    titulo: 'Modelos oficiais dos relatórios SIF',
    texto:
      'Lista provisória: mapa de recebimento diário, relatório de produção/desossa, controle de expedição, relatório de perdas e destinação. Nomes e layouts provisórios — a lista oficial e os modelos exigidos pelo SIF ainda não foram entregues pelo cliente.',
    valor: 'mapa_recebimento,producao_desossa,controle_expedicao,perdas_destinacao',
    provisorio: true,
    pendencia: 'P8',
  },
},
```

Nenhum seed de `relatorios_sif`, `aprovacoes_operacionais` ou `pendencias_overbooking`: são dados de
operação, criados pelo uso real (RA-06).

### Permissões (novas)

| Permissão | Descrição | Perfis |
|---|---|---|
| `SIF_LER` | Consultar relatórios SIF e suas versões | `administrador`, `gestor`, `faturamento`, `diretoria` |
| `SIF_GERAR` | Gerar e retificar versões de relatório SIF | `administrador`, `gestor`, `faturamento` |
| `APROVACOES_LER` | Consultar a fila de aprovações e ocorrências | `administrador`, `gestor`, `diretoria`, `recebimento_pesagem` |
| `APROVACOES_DECIDIR` | Aprovar ou rejeitar solicitações operacionais | `administrador`, `gestor` |
| `APROVACOES_SOLICITAR` | Abrir solicitação de aprovação operacional | `administrador`, `gestor`, `recebimento_pesagem`, `corte`, `expedicao`, `faturamento` |

A atribuição segue a coluna "Perfis RBAC" das linhas 12 e 13 da matriz e a visibilidade já declarada
em `menus-canonicos.ts` (`/gestao/relatorios` para `faturamento` e `diretoria`; `/gestao/aprovacoes`
para `recebimento_pesagem` e `diretoria`). Nenhuma permissão existente muda de dono.

Guardas por endpoint desta onda:

| Endpoint | Guarda |
|---|---|
| `GET /gestao/dashboard` | `RequireQualquerPermissao('COMPRAS_PROGRAMADAS_LER','DISPONIBILIDADE_LER')` (mantido) |
| `GET /operacoes*` | autenticado (mantido) · `POST`/`PATCH`: `OPERACOES_GERENCIAR` (mantido) |
| `GET /comercial/compras-programadas/:id/impacto` e `/historico` | `COMPRAS_PROGRAMADAS_LER` |
| `PATCH /comercial/compras-programadas/:id/itens/:itemId` | `COMPRAS_PROGRAMADAS_GERENCIAR` (mantido) |
| `GET /comercial/overbooking*` | `PEDIDOS_LER` (mantido) |
| `POST /comercial/overbooking/:id/decisao`, `PATCH /:id/status` | `OVERBOOKING_RESOLVER` (mantido) |
| `GET /gestao/aprovacoes*` | `APROVACOES_LER` |
| `POST /gestao/aprovacoes/operacionais` | `APROVACOES_SOLICITAR` |
| `POST /gestao/aprovacoes/operacionais/:id/decidir` | `APROVACOES_DECIDIR` |
| `PATCH/POST /operacao/ocorrencias-fornecedor*` | `OCORRENCIA_FORNECEDOR_GERENCIAR` (mantido) |
| `GET /sif/*` | `SIF_LER` |
| `POST /sif/relatorios/:id/gerar` e `/retificar` | `SIF_GERAR` |

### Telas

**D5.28 — Cabeçalho comum.** As 6 telas usam `AdminHeader` (DS v2) com título e subtítulo do
protótipo e, à direita, o **seletor de Operação** (`Select` do DS, opções `GET /operacoes?status=`).
O valor selecionado é mantido em `?operacaoId=` na URL (deep-link e refresh preservam o contexto).

**D5.29 — Estados de UI obrigatórios em toda tela** (RA-05): carregando (skeleton do DS), erro
(mensagem do backend via `error-message.ts`, com botão "Tentar novamente"), vazio (texto do
protótipo). Proibido renderizar zero/traço como se fosse dado carregado.

**D5.30 — Tempo real.** Dashboard, Overbooking e Aprovações assinam `conectarRealtime`
(`src/lib/realtime.ts`) na room `dashboard` e refazem o `fetch` ao receber eventos do escopo. Sem
polling (RA-04).

**D5.31 — `/gestao/compras`.** A tela existente (`compras-client.tsx`) é **estendida**, não
reescrita: ganha o modal de edição com painel de impacto (protótipo `181-330`), o bloco "Histórico
de alterações desta compra" (protótipo `725`) e o aviso do protótipo linha `653`. Ao receber
`409 IMPACTO_CONFIRMACAO_NECESSARIA`, o modal exibe o painel retornado e habilita "Salvar mesmo
assim", que repete a chamada com `confirmarDeficit: true`.

**D5.32 — `/gestao/relatorios`.** `BadgeProvisorio pendencia="P8"` no cabeçalho da tela e em cada
cartão de relatório, mais o banner do protótipo. O botão "Gerar" fica desabilitado com `title`
explicando quando `status='pendente_dados'` (protótipo `278-279`).

---

## Estrutura de arquivos original (Tasks 1–18)

### Backend — arquivos novos (26)

```
src/database/migrations/0018_onda5_gestao.sql
src/database/schema/relatorios-sif.schema.ts
src/database/schema/aprovacoes-operacionais.schema.ts
src/modules/gestao/aprovacoes/aprovacoes.module.ts
src/modules/gestao/aprovacoes/aprovacoes.controller.ts
src/modules/gestao/aprovacoes/aprovacoes.service.ts
src/modules/gestao/aprovacoes/comparativo.service.ts
src/modules/gestao/aprovacoes/dto/aprovacoes.dto.ts
src/modules/sif/sif.module.ts
src/modules/sif/sif.controller.ts
src/modules/sif/sif.service.ts
src/modules/sif/sif-calculo.service.ts
src/modules/sif/catalogo-sif.ts
src/modules/sif/dto/sif.dto.ts
test/unit/impacto-compra.spec.ts
test/unit/catalogo-sif.spec.ts
test/unit/aprovacoes-regras.spec.ts
test/unit/realtime-gateway-onda5.spec.ts
test/unit/permissoes-onda5.spec.ts
test/integration/compras-impacto.e2e-spec.ts
test/integration/overbooking-decisao.e2e-spec.ts
test/integration/aprovacoes.e2e-spec.ts
test/integration/sif.e2e-spec.ts
test/integration/dashboard-operacao.e2e-spec.ts
test/integration/conclusao-imutavel.e2e-spec.ts
test/helpers/recebimento-fixtures.ts
```

### Backend — arquivos alterados (29)

```
src/database/migrations/meta/_journal.json          + entrada 0018 (idx 18, após 0017_onda4_comercial_contract)
src/database/schema/index.ts                        + 2 exports
src/database/seed.ts                                + parâmetro gestao.modelos_relatorio_sif
src/common/rbac/permissoes.ts                       + 5 permissões, descrições e atribuições
src/common/rbac/perfil-permissoes.snapshot.json     regerado por `npm run rbac:snapshot` (arquivo versionado, não é snapshot do Jest)
src/realtime/events/eventos.ts                      + 4 eventos, payloads (todos com dataOperacao), PendenciaOverbookingPayload, os 3 contratos de pendência em PayloadPorEvento e a chave reserva_disponibilidade_atualizada: ReservaAtualizadaPayload
src/realtime/realtime.gateway.ts                    + 7 handlers @OnEvent (4 novos + 3 de pendência de overbooking)
src/app.module.ts                                   + AprovacoesModule, SifModule
src/modules/operacoes/operacoes.service.ts          + extraordinaria, contadores e resolverCorrente
src/modules/operacoes/operacoes.controller.ts       (sem mudança de pipe — só o tipo de retorno)
src/modules/operacoes/dto/operacao.dto.ts           + extraordinaria no listarOperacoesSchema existente
src/modules/comercial/compras-programadas/compras-programadas.service.ts   + impacto, edição confirmada, histórico
src/modules/comercial/compras-programadas/compras-programadas.controller.ts + 2 endpoints
src/modules/comercial/compras-programadas/dto/compra-programada.dto.ts     + impactoQuerySchema; updateCompraItemSchema → atualizarItemCompraSchema (substituição)
src/modules/comercial/disponibilidade/disponibilidade.service.ts           + projetarImpacto, recalcularParaCompra
src/modules/comercial/overbooking/overbooking.service.ts                   + cobertura, 3 caminhos e dataOperacao nos payloads
src/modules/comercial/overbooking/overbooking.controller.ts                + 2 endpoints
src/modules/comercial/overbooking/dto/overbooking.dto.ts                   + DTOs por caminho
src/modules/comercial/overbooking/overbooking.module.ts                    + import PedidosModule
src/modules/comercial/pedidos/pedidos.module.ts                            + exports: [PedidosService]
src/modules/comercial/pedidos/pedidos.service.ts                           + criarNaTx, reduzirItemNaTx e removerItemNaTx (extração sem mudança de comportamento), export de EventoDominio e dataOperacao no payload de PENDENCIA_OVERBOOKING_ABERTA
src/modules/gestao/dashboard/dashboard.service.ts   + operacaoId, 10 KPIs, alertas
src/modules/gestao/dashboard/dashboard.controller.ts + query operacaoId
test/integration/compras-programadas.e2e-spec.ts    ajustado ao novo contrato de item (Task 5.6) — D5.11 revoga a imutabilidade do item
test/unit/compras-programadas-branches.spec.ts      ajustado ao novo contrato de item (Task 5.6)
test/integration/parametros-onda3.e2e-spec.ts       + caso do parâmetro `gestao.modelos_relatorio_sif` (Task 3.2)
test/integration/operacoes.e2e-spec.ts              + contadores e filtros (Task 4)
test/unit/perfil-permissoes-snapshot.spec.ts        passa a validar as 5 permissões novas contra o JSON regerado (Task 2.6)
test/unit/overbooking-branches.spec.ts              ajustado a dataDaOperacao + emissão RESOLVIDA no status terminal (Tasks 2.5.2 / 2.6 / 6.7)
```

### Frontend — arquivos novos (34)

```
src/lib/bff.ts                                      helper `repassar` (status + corpo íntegros)
src/lib/sif.ts
src/lib/aprovacoes.ts
src/lib/overbooking.ts
src/lib/gestao-operacoes.ts                         nome escolhido para não colidir com o `src/lib/operacao.ts` existente
src/components/gestao/seletor-operacao.tsx
src/components/gestao/painel-impacto.tsx
src/components/gestao/quadro-comparativo.tsx
src/app/(admin)/gestao/operacoes/operacoes-client.tsx
src/app/(admin)/gestao/overbooking/overbooking-client.tsx
src/app/(admin)/gestao/aprovacoes/aprovacoes-client.tsx
src/app/(admin)/gestao/relatorios/relatorios-client.tsx
src/app/api/operacoes/route.ts
src/app/api/operacoes/[id]/route.ts
src/app/api/operacoes/[id]/status/route.ts
src/app/api/operacoes/extraordinaria/route.ts
src/app/api/operacoes/gerar-cadencia/route.ts
src/app/api/comercial/compras-programadas/[id]/impacto/route.ts
src/app/api/comercial/compras-programadas/[id]/historico/route.ts
src/app/api/comercial/overbooking/[id]/cobertura/route.ts
src/app/api/comercial/overbooking/[id]/historico/route.ts
src/app/api/comercial/overbooking/[id]/status/route.ts
src/app/api/gestao/aprovacoes/route.ts
src/app/api/gestao/aprovacoes/ocorrencias/[id]/comparativo/route.ts
src/app/api/gestao/aprovacoes/operacionais/route.ts
src/app/api/gestao/aprovacoes/operacionais/[id]/decidir/route.ts
src/app/api/sif/relatorios/route.ts
src/app/api/sif/relatorios/[id]/versoes/route.ts
src/app/api/sif/relatorios/[id]/preview/route.ts
src/app/api/sif/relatorios/[id]/gerar/route.ts
src/app/api/sif/relatorios/[id]/retificar/route.ts
src/app/api/operacao/ocorrencias-fornecedor/route.ts
src/app/api/operacao/ocorrencias-fornecedor/[id]/route.ts
src/app/api/operacao/ocorrencias-fornecedor/[id]/encerrar/route.ts
```

Nenhuma rota `[...path]`: ver a restrição estrutural da Task 10.

### Frontend — arquivos alterados (12)

```
src/lib/gestao.ts                                   + tipos do dashboard v2, alertas, KPIs
src/lib/comercial.ts                                + tipos ImpactoCompra e HistoricoCompra
src/lib/status-ui.ts                                + variantes de status de pendência, aprovação e SIF
src/app/(admin)/gestao/dashboard/dashboard-client.tsx  10 KPIs, alertas, seletor de Operação
src/app/(admin)/gestao/compras/compras-client.tsx   modal de impacto + histórico
src/app/(admin)/gestao/operacoes/page.tsx           hoje `<PlaceholderPage />` → renderiza operacoes-client
src/app/(admin)/gestao/overbooking/page.tsx         hoje `<PlaceholderPage />` → renderiza overbooking-client
src/app/(admin)/gestao/aprovacoes/page.tsx          hoje `<PlaceholderPage />` → renderiza aprovacoes-client
src/app/(admin)/gestao/relatorios/page.tsx          hoje `<PlaceholderPage />` → renderiza relatorios-client
src/app/api/gestao/dashboard/route.ts               operacaoId + `repassar`
src/app/api/comercial/compras-programadas/[id]/itens/[itemId]/route.ts  `repassar` (preserva o 409 com `impacto`)
src/app/api/comercial/overbooking/[id]/decisao/route.ts                 `repassar` (preserva os 409 dos 3 caminhos)
```

### Testes de frontend novos (11)

```
__tests__/seletor-operacao.test.tsx
__tests__/painel-impacto.test.tsx
__tests__/quadro-comparativo.test.tsx
__tests__/operacoes-client.test.tsx
__tests__/compras-client.test.tsx
__tests__/overbooking-client.test.tsx
__tests__/aprovacoes-client.test.tsx
__tests__/relatorios-sif-client.test.tsx
__tests__/dashboard-client.test.tsx
__tests__/bff-onda5.test.ts
e2e/onda5-gestao.spec.ts
```

---

## Mapa DoD → teste (1:1)

Cada item do DoD e cada decisão verificável tem **um teste nomeado**. Nenhuma linha sem teste.

### DoD 1 — Painel de impacto na edição de compra confirmada

| # | Critério | Teste |
|---|---|---|
| 1.1 | `GET /:id/impacto` sem `simulacao` devolve fotografia atual com `delta='0.000'` | `test/integration/compras-impacto.e2e-spec.ts` › "impacto sem simulação zera os deltas" |
| 1.2 | `GET /:id/impacto?simulacao=` projeta gerada/saldo/déficit por item comercial usando as regras de desdobramento | `compras-impacto.e2e-spec.ts` › "projeta desdobramento do boi casado 2 TZ + 2 DT + 2 PA (AD-01)" |
| 1.3 | Redução abaixo do reservado projeta `deficitProjetado > 0` e `exigeConfirmacao=true` | `test/unit/impacto-compra.spec.ts` › "déficit = reservada - projetada, nunca negativo" |
| 1.4 | `PATCH` em compra confirmada com déficit e sem `confirmarDeficit` retorna 409 `IMPACTO_CONFIRMACAO_NECESSARIA` e **não persiste** | `compras-impacto.e2e-spec.ts` › "409 não persiste nada" |
| 1.5 | `PATCH` com `confirmarDeficit: true` atualiza item e recalcula `disponibilidades_virtuais` na mesma transação | `compras-impacto.e2e-spec.ts` › "recálculo atômico da disponibilidade" |
| 1.6 | `quantidade_disponivel` nunca fica negativa (clamp em 0) e `status` deriva conforme D5.13 | `compras-impacto.e2e-spec.ts` › "saldo clampado e status derivado" |
| 1.7 | Compra `cancelada` continua imutável (409) | `compras-impacto.e2e-spec.ts` › "compra cancelada não aceita edição" |
| 1.8 | Auditoria grava compra, item e cada disponibilidade afetada | `compras-impacto.e2e-spec.ts` › "auditoria completa da alteração" |
| 1.9 | Evento `COMPRA_ALTERADA_IMPACTO` é emitido **após** o commit | `compras-impacto.e2e-spec.ts` › "evento pós-commit" |
| 1.10 | `GET /:id/historico` deriva de `auditoria` e traz autor, data e mudança | `compras-impacto.e2e-spec.ts` › "histórico derivado da auditoria" |
| 1.11 | Modal de impacto renderiza colunas e o texto de déficit do protótipo | `__tests__/painel-impacto.test.tsx` |
| 1.12 | Tela reenvia com `confirmarDeficit` após 409 | `__tests__/compras-client.test.tsx` › "salvar mesmo assim" |
| 1.13 | `PATCH` do item aceita quantidade `number` **ou** `string`, preserva `observacoes` e devolve `{ item, impacto }` | `test/integration/compras-programadas.e2e-spec.ts` › "permite editar item enquanto em rascunho" (ajustado) |
| 1.14 | D5.11 revoga a imutabilidade do **item**: compra confirmada sem déficit aceita edição e recalcula; compra **cancelada** continua em 409 | `compras-programadas.e2e-spec.ts` › "D5.11: compra confirmada aceita edição de item e recalcula a disponibilidade" + "IMUTABILIDADE: compra CANCELADA continua recusando edição de item (409)" |

### DoD 2 — Fila de overbooking com 3 caminhos

| # | Critério | Teste |
|---|---|---|
| 2.1 | `GET /:id/cobertura` lista compras complementares elegíveis e opções de redistribuição reais | `test/integration/overbooking-decisao.e2e-spec.ts` › "fontes de cobertura reais" |
| 2.2 | Sem fonte, listas vêm vazias (sem opção fabricada) | `overbooking-decisao.e2e-spec.ts` › "sem fontes retorna listas vazias" |
| 2.3 | Caminho 1 valida compra elegível e grava decisão + histórico | `overbooking-decisao.e2e-spec.ts` › "compra complementar programada" |
| 2.4 | Caminho 1 recusa compra de operação anterior (409) | `overbooking-decisao.e2e-spec.ts` › "compra de operação passada é recusada" |
| 2.5 | Caminho 2 transfere reserva e reduz déficit, mantendo o agregado da disponibilidade | `overbooking-decisao.e2e-spec.ts` › "redistribuição preserva o agregado" |
| 2.6 | Caminho 2 recusa quantidade acima do saldo doador (409) | `overbooking-decisao.e2e-spec.ts` › "redistribuição acima do saldo" |
| 2.7 | Caminho 3 parcial reduz o pedido original, cria pedido novo na operação destino e abate o déficit **uma única vez** | `overbooking-decisao.e2e-spec.ts` › "postergação parcial gera novo pedido e abate o déficit uma única vez" |
| 2.8 | Caminho 3 recusa operação destino fechada ou anterior (409) | `overbooking-decisao.e2e-spec.ts` › "operação destino inválida" |
| 2.9 | Déficit zerado pelo **caminho 2** (redistribuição) leva a `resolvida` na mesma transação. O caminho 1 **não** abate déficit (`quantidadeAbatida='0.000'`, D5.15 / Dívida 4) e não alcança este critério | `overbooking-decisao.e2e-spec.ts` › "déficit zero resolve a pendência" |
| 2.10 | Transição inválida retorna 409 e não muda nada | `overbooking-decisao.e2e-spec.ts` › "transição inválida" |
| 2.11 | `GET /:id/historico` devolve a linha do tempo ordenada | `overbooking-decisao.e2e-spec.ts` › "histórico ordenado" |
| 2.12 | Tela mostra KPIs, filtro, detalhe e os 3 blocos de decisão do protótipo | `__tests__/overbooking-client.test.tsx` |
| 2.13 | Caminho 3 total remove o item de origem (soft delete) e encerra a pendência em `cancelada`, sem reabrir status terminal | `overbooking-decisao.e2e-spec.ts` › "postergação total remove o item de origem e encerra a pendência" |
| 2.14 | Caminho 3 recusa `compraProgramadaId` fora da operação de destino ou cancelada (409) | `overbooking-decisao.e2e-spec.ts` › "compra de destino inválida" |

### DoD 3 — Comparativo Pedido × NF × Pesagem imutável

| # | Critério | Teste |
|---|---|---|
| 3.1 | `UPDATE` em `conclusoes_conferencia` é rejeitado pelo banco | `test/integration/conclusao-imutavel.e2e-spec.ts` › "UPDATE bloqueado por trigger" |
| 3.2 | `DELETE` em `conclusoes_conferencia` é rejeitado pelo banco | `conclusao-imutavel.e2e-spec.ts` › "DELETE bloqueado por trigger" |
| 3.3 | Tratativa administrativa (atualizar/encerrar ocorrência) não altera `quadro_json` | `test/integration/aprovacoes.e2e-spec.ts` › "tratativa não altera o quadro" |
| 3.4 | `GET /gestao/aprovacoes/ocorrencias/:id/comparativo` devolve o snapshot com `imutavel: true` | `aprovacoes.e2e-spec.ts` › "comparativo vem do snapshot" |
| 3.5 | Ocorrência sem conclusão vinculada responde 404 (não recalcula) | `aprovacoes.e2e-spec.ts` › "sem conclusão retorna 404" |
| 3.6 | Fila unificada pagina as duas abas | `aprovacoes.e2e-spec.ts` › "fila unificada nas duas abas" |
| 3.7 | Decidir sem motivo é rejeitado (400) e decidir duas vezes é 409 | `aprovacoes.e2e-spec.ts` › "decisão exige motivo e é única" |
| 3.8 | CHECK do banco impede status decidido sem autor/motivo | `aprovacoes.e2e-spec.ts` › "chk_aprovacao_decisao" |
| 3.9 | Componente renderiza as 8 colunas e o aviso de imutabilidade do protótipo | `__tests__/quadro-comparativo.test.tsx` |

### DoD 4 — SIF com versionamento e retificação (P8)

| # | Critério | Teste |
|---|---|---|
| 4.1 | `GET /sif/relatorios?operacaoId=` cria idempotentemente os 4 relatórios da operação | `test/integration/sif.e2e-spec.ts` › "catálogo idempotente" |
| 4.2 | Pendências de dados são calculadas do estado real | `sif.e2e-spec.ts` › "pendências calculadas" |
| 4.3 | Gerar com pendência aberta retorna 409 | `sif.e2e-spec.ts` › "gerar bloqueado por pendência" |
| 4.4 | Gerar cria versão v1 e status `gerado` | `sif.e2e-spec.ts` › "primeira versão" |
| 4.5 | Gerar de novo cria v2 mantendo v1 intacta | `sif.e2e-spec.ts` › "versionamento incremental" |
| 4.6 | Retificar exige motivo e grava `tipo_geracao='retificado'` | `sif.e2e-spec.ts` › "retificação com motivo" |
| 4.7 | Retificar sem versão anterior retorna 409 | `sif.e2e-spec.ts` › "retificação exige versão" |
| 4.8 | CHECK do banco impede versão retificada sem motivo | `sif.e2e-spec.ts` › "chk_sif_versao_motivo" |
| 4.9 | `preview` sem versão retorna 404 (não fabrica preview) | `sif.e2e-spec.ts` › "preview sem versão" |
| 4.10 | Status derivado segue D5.24 | `test/unit/catalogo-sif.spec.ts` › "derivação de status" |
| 4.11 | Tela exibe badge Provisório P8 e desabilita "Gerar" em `pendente_dados` | `__tests__/relatorios-sif-client.test.tsx` |
| 4.12 | Pendência de `producao_desossa` é apurada pelo join `transformacoes → pecas → recebimentos` (transformação de outra Operação não conta) | `sif.e2e-spec.ts` › "pendência de desossa respeita a operação da peça" |

### Telas, RBAC e navegação

| # | Critério | Teste |
|---|---|---|
| 5.1 | Dashboard aceita `operacaoId` e devolve os 10 KPIs do protótipo | `test/integration/dashboard-operacao.e2e-spec.ts` › "10 KPIs por operação" |
| 5.2 | Sem `operacaoId`, resolve a operação corrente; sem operação, 404 | `dashboard-operacao.e2e-spec.ts` › "operação corrente e 404" |
| 5.3 | Alertas operacionais só aparecem quando há fato real | `dashboard-operacao.e2e-spec.ts` › "alertas derivados de dados reais" |
| 5.4 | `/gestao/operacoes` lista, filtra por status, gera cadência e cria extraordinária | `__tests__/operacoes-client.test.tsx` |
| 5.5 | As 5 permissões novas existem, têm descrição e estão no snapshot RBAC | `test/unit/permissoes-onda5.spec.ts` (novo) + `test/unit/perfil-permissoes-snapshot.spec.ts` (existente, contra o JSON regerado) |
| 5.6 | Perfil sem permissão recebe 403 nos endpoints novos | `aprovacoes.e2e-spec.ts` e `sif.e2e-spec.ts` › "403 sem permissão" |
| 5.7 | Rotas BFF repassam status e mensagem de erro do backend | `__tests__/bff-onda5.test.ts` |
| 5.8 | As 6 rotas navegam pelo menu e renderizam sem erro de console | `e2e/onda5-gestao.spec.ts` |
| 5.9 | Nenhuma tela da onda usa o termo banido; usa "Nome Fantasia"/"Buscar cliente" | `__tests__/terminologia.test.ts` (casos novos) |
| 5.10 | Seletor de Operação sincroniza com `?operacaoId=` | `__tests__/seletor-operacao.test.tsx` |
| 5.11 | Os 7 eventos (4 novos + 3 de pendência de overbooking) chegam ao WebSocket: `broadcast` nas rooms `dashboard` e `operacao:<dataOperacao>` | `test/unit/realtime-gateway-onda5.spec.ts` |
| 5.12 | BFF de ocorrências de fornecedor repassa `PATCH /:id` e `POST /:id/encerrar` com status e corpo do backend | `__tests__/bff-onda5.test.ts` › "ocorrências de fornecedor" |
| 5.13 | `GET /operacoes` mantém o envelope paginado e passa a trazer os 3 contadores, ordenado por `data` desc | `test/integration/operacoes.e2e-spec.ts` (asserções ajustadas + casos novos) |
| 5.14 | `PayloadPorEvento` tipa os 3 eventos de pendência com `operacaoId`/`dataOperacao`, tipa `reserva_disponibilidade_atualizada: ReservaAtualizadaPayload` (necessário para o `as EventoDominio[]` da Task 6.3 caminho 2) e o evento RESOLVIDA aceita `resolvida\|cancelada`; `alterarStatus` emite RESOLVIDA também no `cancelada`, com o payload completo | `npm run type-check` (contrato do mapa — prova TS2352 fechado) + `test/unit/overbooking-branches.spec.ts` › "alterarStatus emite RESOLVIDA no status terminal com operacaoId e dataOperacao" (arquivo existente, casos ajustados) |

**Subtotal original:** 14 + 14 + 9 + 12 + 14 = **63 critérios verificáveis** (DoD 1 = 1.1–1.14; DoD 2 =
2.1–2.14; DoD 3 = 3.1–3.9; DoD 4 = 4.1–4.12; Telas/RBAC = 5.1–5.14), distribuídos em **24 arquivos**
de teste: 6 unitários de backend, 8 de integração de backend, 9 de frontend e 1 suíte e2e
Playwright.

Cinco deles **já existem e são ajustados**, não criados: `compras-programadas.e2e-spec.ts`
(Task 5.6), `overbooking-branches.spec.ts` (Tasks 2.5.2 e 6.7), `operacoes.e2e-spec.ts` (Task 4),
`perfil-permissoes-snapshot.spec.ts` (Task 2.6) e `terminologia.test.ts` (Task 18).
`test/unit/compras-programadas-branches.spec.ts` também é ajustado (Task 5.6), mas como teste de
cobertura de branch não tem linha própria no mapa — entra no gate pelo `test:cov`.

---
## Tasks

Regras válidas para todas as tasks:

- **TDD obrigatório**: escrever o teste que falha, rodar e ver falhar, implementar, rodar e ver
  passar. O teste vai no mesmo commit da implementação.
- **Um commit por task**, mensagem em português no formato indicado ao fim da task.
- Rodar `npm run lint` e `npm run type-check` no workspace tocado antes de commitar.
- Backend: `cd app/backend && npm run test -- <arquivo>` para o ciclo curto; `npm run test:cov`
  antes do gate final.
- Frontend: `cd app/frontend && npm run test -- <arquivo>`.
- Proibido `--no-verify`, proibido `git push --force`.

### Task 1 — Migration `0018_onda5_gestao`, schemas Drizzle e trigger de imutabilidade

**Objetivo:** criar `relatorios_sif`, `relatorios_sif_versoes`, `aprovacoes_operacionais` e o trigger
que torna `conclusoes_conferencia` imutável (D5.5–D5.8).

**1.1** Criar `app/backend/src/database/migrations/0018_onda5_gestao.sql`:

```sql
-- Onda 5 — Gestão. Expand puro: apenas CREATE. Nenhum ALTER/DROP em objeto existente.

CREATE TABLE relatorios_sif (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  operacao_id         uuid NOT NULL REFERENCES operacoes(id),
  tipo                text NOT NULL,
  codigo              text NOT NULL,
  nome                text NOT NULL,
  status              text NOT NULL DEFAULT 'pendente_dados',
  perfil_responsavel  text NOT NULL,
  pendencias_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
  versao_atual        integer NOT NULL DEFAULT 0,
  provisorio          boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT chk_relatorios_sif_tipo CHECK (
    tipo IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')
  ),
  CONSTRAINT chk_relatorios_sif_status CHECK (
    status IN ('pendente_dados','pronto_para_gerar','gerado','retificado')
  ),
  CONSTRAINT chk_relatorios_sif_versao CHECK (versao_atual >= 0)
);

CREATE UNIQUE INDEX uq_relatorios_sif_operacao_tipo
  ON relatorios_sif (operacao_id, tipo) WHERE deleted_at IS NULL;
CREATE INDEX idx_relatorios_sif_status
  ON relatorios_sif (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_relatorios_sif_pendencias_gin
  ON relatorios_sif USING gin (pendencias_json);

CREATE TABLE relatorios_sif_versoes (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  relatorio_id        uuid NOT NULL REFERENCES relatorios_sif(id),
  versao              integer NOT NULL,
  tipo_geracao        text NOT NULL,
  motivo_retificacao  text,
  conteudo_json       jsonb NOT NULL,
  gerado_por_id       uuid NOT NULL REFERENCES usuarios(id),
  gerado_em           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sif_versao_tipo CHECK (tipo_geracao IN ('gerado','retificado')),
  CONSTRAINT chk_sif_versao_positiva CHECK (versao >= 1),
  CONSTRAINT chk_sif_versao_motivo CHECK (
    (tipo_geracao = 'gerado'     AND motivo_retificacao IS NULL)
    OR
    (tipo_geracao = 'retificado' AND motivo_retificacao IS NOT NULL
                                 AND length(btrim(motivo_retificacao)) >= 10)
  )
);

CREATE UNIQUE INDEX uq_sif_versao ON relatorios_sif_versoes (relatorio_id, versao);
CREATE INDEX idx_sif_versao_relatorio ON relatorios_sif_versoes (relatorio_id, versao DESC);

CREATE TABLE aprovacoes_operacionais (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  operacao_id         uuid NOT NULL REFERENCES operacoes(id),
  tipo                text NOT NULL,
  origem              text NOT NULL,
  descricao           text NOT NULL,
  impacto             text NOT NULL,
  referencia_tabela   text,
  referencia_id       uuid,
  solicitante_id      uuid NOT NULL REFERENCES usuarios(id),
  solicitado_em       timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'pendente',
  decisao_motivo      text,
  decidido_por_id     uuid REFERENCES usuarios(id),
  decidido_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT chk_aprovacao_tipo CHECK (
    tipo IN ('divergencia_transformacao','estorno_fora_regra',
             'reabertura_carga_pedido','ajuste_estoque_relevante')
  ),
  CONSTRAINT chk_aprovacao_status CHECK (status IN ('pendente','aprovada','rejeitada')),
  CONSTRAINT chk_aprovacao_decisao CHECK (
    (status = 'pendente'
      AND decisao_motivo IS NULL AND decidido_por_id IS NULL AND decidido_em IS NULL)
    OR
    (status IN ('aprovada','rejeitada')
      AND decisao_motivo IS NOT NULL AND length(btrim(decisao_motivo)) >= 10
      AND decidido_por_id IS NOT NULL AND decidido_em IS NOT NULL)
  )
);

CREATE INDEX idx_aprovacoes_operacao
  ON aprovacoes_operacionais (operacao_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_aprovacoes_status
  ON aprovacoes_operacionais (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_aprovacoes_referencia
  ON aprovacoes_operacionais (referencia_tabela, referencia_id) WHERE deleted_at IS NULL;

-- Imutabilidade do comparativo Pedido x NF x Pesagem (v1.1 6.10.7).
CREATE OR REPLACE FUNCTION conclusao_conferencia_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'conclusoes_conferencia e imutavel (v1.1 6.10.7): tentativa de % em %',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conclusoes_conferencia_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();

CREATE TRIGGER trg_conclusoes_conferencia_nfs_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia_nfs
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();

CREATE TRIGGER trg_relatorios_sif_updated_at
  BEFORE UPDATE ON relatorios_sif
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_aprovacoes_operacionais_updated_at
  BEFORE UPDATE ON aprovacoes_operacionais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

> A função `set_updated_at()` já existe desde a migration `0000`. Se o nome divergir no banco, o
> Executor usa o nome real conferido em `\df` — não cria função duplicada.

**1.2** Registrar no `_journal.json` (após a entrada `0017_onda4_comercial_contract`, que já existe
em `develop`), com `idx: 18`, `version: "7"`, `when` = epoch em milissegundos do momento da criação,
`tag: "0018_onda5_gestao"`, `breakpoints: true`.

**1.3** Criar `src/database/schema/relatorios-sif.schema.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { operacoes } from './operacoes.schema';

export const relatoriosSif = pgTable(
  'relatorios_sif',
  {
    id:                uuid('id').primaryKey().default(sql`uuidv7()`),
    operacaoId:        uuid('operacao_id').notNull().references(() => operacoes.id),
    tipo:              text('tipo').notNull(),
    codigo:            text('codigo').notNull(),
    nome:              text('nome').notNull(),
    status:            text('status').notNull().default('pendente_dados'),
    perfilResponsavel: text('perfil_responsavel').notNull(),
    pendenciasJson:    jsonb('pendencias_json').notNull().default(sql`'[]'::jsonb`),
    versaoAtual:       integer('versao_atual').notNull().default(0),
    provisorio:        boolean('provisorio').notNull().default(true),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:         timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_relatorios_sif_tipo',
      sql`${t.tipo} IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')`,
    ),
    check(
      'chk_relatorios_sif_status',
      sql`${t.status} IN ('pendente_dados','pronto_para_gerar','gerado','retificado')`,
    ),
    check('chk_relatorios_sif_versao', sql`${t.versaoAtual} >= 0`),
    uniqueIndex('uq_relatorios_sif_operacao_tipo')
      .on(t.operacaoId, t.tipo)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_relatorios_sif_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_relatorios_sif_pendencias_gin').using('gin', t.pendenciasJson),
  ],
);

export const relatoriosSifVersoes = pgTable(
  'relatorios_sif_versoes',
  {
    id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
    relatorioId:        uuid('relatorio_id').notNull().references(() => relatoriosSif.id),
    versao:             integer('versao').notNull(),
    tipoGeracao:        text('tipo_geracao').notNull(),
    motivoRetificacao:  text('motivo_retificacao'),
    conteudoJson:       jsonb('conteudo_json').notNull(),
    geradoPorId:        uuid('gerado_por_id').notNull().references(() => usuarios.id),
    geradoEm:           timestamp('gerado_em', { withTimezone: true }).notNull().defaultNow(),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_sif_versao_tipo', sql`${t.tipoGeracao} IN ('gerado','retificado')`),
    check('chk_sif_versao_positiva', sql`${t.versao} >= 1`),
    check(
      'chk_sif_versao_motivo',
      sql`(${t.tipoGeracao} = 'gerado' AND ${t.motivoRetificacao} IS NULL)
          OR (${t.tipoGeracao} = 'retificado' AND ${t.motivoRetificacao} IS NOT NULL
              AND length(btrim(${t.motivoRetificacao})) >= 10)`,
    ),
    uniqueIndex('uq_sif_versao').on(t.relatorioId, t.versao),
    index('idx_sif_versao_relatorio').on(t.relatorioId, t.versao),
  ],
);
```

**1.4** Criar `src/database/schema/aprovacoes-operacionais.schema.ts` — colunas e CHECKs idênticos
a D5.7 e ao SQL de 1.1:

```ts
import { sql } from 'drizzle-orm';
import {
  check, index, pgTable, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { operacoes } from './operacoes.schema';

export const aprovacoesOperacionais = pgTable(
  'aprovacoes_operacionais',
  {
    id:               uuid('id').primaryKey().default(sql`uuidv7()`),
    operacaoId:       uuid('operacao_id').notNull().references(() => operacoes.id),
    tipo:             text('tipo').notNull(),
    origem:           text('origem').notNull(),
    descricao:        text('descricao').notNull(),
    impacto:          text('impacto').notNull(),
    referenciaTabela: text('referencia_tabela'),
    referenciaId:     uuid('referencia_id'),
    solicitanteId:    uuid('solicitante_id').notNull().references(() => usuarios.id),
    solicitadoEm:     timestamp('solicitado_em', { withTimezone: true }).notNull().defaultNow(),
    status:           text('status').notNull().default('pendente'),
    decisaoMotivo:    text('decisao_motivo'),
    decididoPorId:    uuid('decidido_por_id').references(() => usuarios.id),
    decididoEm:       timestamp('decidido_em', { withTimezone: true }),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_aprovacao_tipo',
      sql`${t.tipo} IN ('divergencia_transformacao','estorno_fora_regra',
                        'reabertura_carga_pedido','ajuste_estoque_relevante')`,
    ),
    check('chk_aprovacao_status', sql`${t.status} IN ('pendente','aprovada','rejeitada')`),
    check(
      'chk_aprovacao_decisao',
      sql`(
        (${t.status} = 'pendente'
          AND ${t.decisaoMotivo} IS NULL AND ${t.decididoPorId} IS NULL AND ${t.decididoEm} IS NULL)
        OR
        (${t.status} IN ('aprovada','rejeitada')
          AND ${t.decisaoMotivo} IS NOT NULL AND length(btrim(${t.decisaoMotivo})) >= 10
          AND ${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)
      )`,
    ),
    index('idx_aprovacoes_operacao').on(t.operacaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_aprovacoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_aprovacoes_referencia').on(t.referenciaTabela, t.referenciaId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
```

**1.5** Exportar em `src/database/schema/index.ts`:

```ts
export * from './relatorios-sif.schema';
export * from './aprovacoes-operacionais.schema';
```

**1.6** Teste (`test/integration/conclusao-imutavel.e2e-spec.ts`) — escrever **antes** de rodar a
migration para vê-lo falhar:

```ts
import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { criarConclusaoConferencia } from '../helpers/recebimento-fixtures';

type Db = NodePgDatabase<typeof schema>;

describe('conclusoes_conferencia — imutabilidade (DoD 3)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); }, 60000);
  afterAll(async () => { await cleanupDb(app); await app.close(); });

  const db = () => app.get<{ db: Db }>(DRIZZLE).db;

  it('UPDATE bloqueado por trigger', async () => {
    const { conclusaoId } = await criarConclusaoConferencia(app);
    await expect(
      db().execute(sql`UPDATE conclusoes_conferencia SET quadro_json = '[]'::jsonb WHERE id = ${conclusaoId}`),
    ).rejects.toThrow(/imutavel/i);
  });

  it('DELETE bloqueado por trigger', async () => {
    const { conclusaoId } = await criarConclusaoConferencia(app);
    await expect(
      db().execute(sql`DELETE FROM conclusoes_conferencia WHERE id = ${conclusaoId}`),
    ).rejects.toThrow(/imutavel/i);
  });
});
```

> `test/helpers/test-app.ts` **não exporta `getDb`** — o handle vem de `app.get(DRIZZLE)` e
> `cleanupDb` recebe o `app` (assinaturas reais em `test/helpers/test-app.ts:58` e uso em
> `test/integration/recebimento.e2e-spec.ts:5,12,16,35`, que é o padrão copiado acima).

> `criarConclusaoConferencia` é um helper novo em `test/helpers/recebimento-fixtures.ts` (sufixo
> `-fixtures` é a convenção do diretório: `comercial-fixtures.ts`, `pesagem-fixtures.ts`, …) que monta
> operação → fornecedor → pedido ao fornecedor → recebimento → NF → pesagem → conclusão usando os
> serviços reais (nunca `INSERT` cru), reaproveitando o fluxo já coberto por
> `test/integration/recebimento.e2e-spec.ts`, e devolve `{ conclusaoId }`.

**Verificação:** `cd app/backend && npm run db:migrate && npm run test -- conclusao-imutavel`.

**Commit:** `feat(onda5): migration 0018 com relatórios SIF, aprovações operacionais e trigger de imutabilidade`

---

### Task 2 — Permissões novas, catálogo de eventos e broadcast no gateway

**Objetivo:** registrar as 5 permissões de D5 e os 4 eventos novos, **e ligá-los ao WebSocket** —
sem `@OnEvent` no `realtime.gateway.ts` o evento é emitido, ninguém escuta e nenhuma tela atualiza
(quebraria D5.30 e RA-04).

**2.1** Em `src/common/rbac/permissoes.ts`, no objeto de permissões (após `OVERBOOKING_RESOLVER`):

```ts
  SIF_LER: 'SIF_LER',
  SIF_GERAR: 'SIF_GERAR',
  APROVACOES_LER: 'APROVACOES_LER',
  APROVACOES_DECIDIR: 'APROVACOES_DECIDIR',
  APROVACOES_SOLICITAR: 'APROVACOES_SOLICITAR',
```

**2.2** Em `DESCRICOES_PERMISSOES`:

```ts
  SIF_LER: 'Consultar relatórios SIF e suas versões',
  SIF_GERAR: 'Gerar e retificar versões de relatório SIF',
  APROVACOES_LER: 'Consultar a fila de aprovações e ocorrências',
  APROVACOES_DECIDIR: 'Aprovar ou rejeitar solicitações operacionais',
  APROVACOES_SOLICITAR: 'Abrir solicitação de aprovação operacional',
```

**2.3** Atribuição por perfil, usando o helper `pushPermissoes` já existente no arquivo (mesmo
padrão das linhas 309–317), exatamente conforme a tabela de D5 "Permissões (novas)":

```ts
pushPermissoes('administrador', 'SIF_LER', 'SIF_GERAR', 'APROVACOES_LER', 'APROVACOES_DECIDIR', 'APROVACOES_SOLICITAR');
pushPermissoes('gestor',        'SIF_LER', 'SIF_GERAR', 'APROVACOES_LER', 'APROVACOES_DECIDIR', 'APROVACOES_SOLICITAR');
pushPermissoes('faturamento',   'SIF_LER', 'SIF_GERAR', 'APROVACOES_SOLICITAR');
pushPermissoes('diretoria',     'SIF_LER', 'APROVACOES_LER');
pushPermissoes('recebimento_pesagem', 'APROVACOES_LER', 'APROVACOES_SOLICITAR');
pushPermissoes('corte',         'APROVACOES_SOLICITAR');
pushPermissoes('expedicao',     'APROVACOES_SOLICITAR');
```

**2.4** Em `src/realtime/events/eventos.ts`, no objeto `EVENTOS`:

```ts
  // ── Onda 5 — Gestão ───────────────────────────────────────────────────────
  COMPRA_ALTERADA_IMPACTO: 'compra_programada_alterada_impacto',
  APROVACAO_REGISTRADA: 'aprovacao_operacional_registrada',
  APROVACAO_DECIDIDA: 'aprovacao_operacional_decidida',
  RELATORIO_SIF_GERADO: 'relatorio_sif_gerado',
```

e os payloads tipados. **Todo payload desta onda carrega `dataOperacao`**, porque
`roomsDaData(dataOperacao)` (`eventos.ts:58-60`) é o que decide a room do broadcast; um payload sem
esse campo faria `broadcast` publicar em `operacao:undefined` e nenhum cliente receberia:

```ts
export interface CompraAlteradaImpactoPayload {
  compraId: string;
  operacaoId: string;
  dataOperacao: string;
  deficitTotal: string;
  itens: Array<{ itemComercialId: string; delta: string; deficitProjetado: string }>;
}

export interface AprovacaoOperacionalPayload {
  aprovacaoId: string;
  operacaoId: string;
  dataOperacao: string;
  tipo: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
}

export interface RelatorioSifGeradoPayload {
  relatorioId: string;
  operacaoId: string;
  dataOperacao: string;
  versao: number;
  tipoGeracao: 'gerado' | 'retificado';
}
```

**2.5** Em `src/realtime/realtime.gateway.ts`, importar os 3 tipos novos junto dos demais e
acrescentar, ao fim dos handlers (após o bloco `F6a — Faturamento / NFS-e`), a seção da Onda 5. Sem
isso os eventos não saem do processo:

```ts
  // ── Onda 5 — Gestão ───────────────────────────────────────────────────────

  @OnEvent(EVENTOS.COMPRA_ALTERADA_IMPACTO)
  handleCompraAlteradaImpacto(payload: CompraAlteradaImpactoPayload): void {
    this.broadcast(EVENTOS.COMPRA_ALTERADA_IMPACTO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.APROVACAO_REGISTRADA)
  handleAprovacaoRegistrada(payload: AprovacaoOperacionalPayload): void {
    this.broadcast(EVENTOS.APROVACAO_REGISTRADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.APROVACAO_DECIDIDA)
  handleAprovacaoDecidida(payload: AprovacaoOperacionalPayload): void {
    this.broadcast(EVENTOS.APROVACAO_DECIDIDA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.RELATORIO_SIF_GERADO)
  handleRelatorioSifGerado(payload: RelatorioSifGeradoPayload): void {
    this.broadcast(EVENTOS.RELATORIO_SIF_GERADO, payload, payload.dataOperacao);
  }
```

Os três eventos de pendência de overbooking (`PENDENCIA_OVERBOOKING_ABERTA`, `_ATUALIZADA`,
`_RESOLVIDA`) existem desde a Onda 1 mas **também não têm handler no gateway** e são emitidos sem
`dataOperacao` (`pedidos.service.ts:359-362`, `overbooking.service.ts:103-108`). D5.30 e as Tasks
12.3/15.3 dependem deles para atualizar dashboard e fila em tempo real, então esta task fecha a
lacuna junto:

```ts
export interface PendenciaOverbookingPayload {
  pendenciaId: string;
  operacaoId: string;
  dataOperacao: string;
  status: string;
}
```

**2.5.1 — `PayloadPorEvento` (obrigatório, senão a Task 6 não compila).** Os três eventos de
pendência já estão tipados em `eventos.ts:287-298` e `pedidos.service.ts:71-73` deriva
`EventoDominio` desse mapa. Acrescentar `operacaoId`/`dataOperacao` ao payload emitido **sem
atualizar o mapa** quebraria o type-check em `pedidos.service.ts:359-362`. Além disso, a interface
avulsa `ReservaAtualizadaPayload` (`eventos.ts:77-83`) e o handler `@OnEvent(EVENTOS.RESERVA_ATUALIZADA)`
no gateway (`realtime.gateway.ts:143-146`) **já existem**, mas `reserva_disponibilidade_atualizada`
**não é chave** de `PayloadPorEvento` hoje — só entram os eventos da Onda 1. Sem essa chave, o
retorno literal da Task 6.3 caminho 2 (`aplicarRedistribuicao`) que faz
`eventos: [{ nome: EVENTOS.RESERVA_ATUALIZADA, payload: { … } }] as EventoDominio[]` falha com
**TS2352** (`npx tsc --noEmit` reproduz). Substituir/acrescentar no mapa:

```ts
  // Já existia como interface avulsa + handler no gateway; entra no mapa para
  // EventoDominio aceitar EVENTOS.RESERVA_ATUALIZADA (Task 6.3 caminho 2).
  reserva_disponibilidade_atualizada: ReservaAtualizadaPayload;

  pendencia_overbooking_aberta: PendenciaOverbookingPayload & { pedidoVendaId: string };
  pendencia_overbooking_atualizada: PendenciaOverbookingPayload;
  pendencia_overbooking_resolvida: PendenciaOverbookingPayload & {
    // 'cancelada' também encerra a pendência e a tira da fila — ver Task 6.3.
    status: 'resolvida' | 'cancelada';
  };
```

> **Decisão (status terminal no evento RESOLVIDA).** O `decidir` da Task 6.3 emite
> `PENDENCIA_OVERBOOKING_RESOLVIDA` quando `pendencia.status` é `'resolvida'` **ou** `'cancelada'`
> (postergação total). O literal `status: 'resolvida'` de hoje rejeitaria esse caso. A escolha é
> **alargar a união** no evento existente, não criar um quarto evento: para o consumidor os dois
> status significam "saiu da fila", e um evento novo obrigaria mais um handler, mais uma room e mais
> uma linha de DoD sem ganho funcional. `PendenciaOverbookingPayload` declara `status: string` e a
> interseção estreita apenas onde o contrato é terminal.

Como `EventoDominio` é derivado de `PayloadPorEvento`, essa mudança é o que permite
`pedidos.service.ts` empurrar o payload completo no array de eventos sem `as never`, e o
`as EventoDominio[]` da Task 6.3 tipar sem TS2352 (critério 5.14 / `npm run type-check`).

```ts
  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_ABERTA)
  handlePendenciaAberta(payload: PendenciaOverbookingPayload): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_ABERTA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA)
  handlePendenciaAtualizada(payload: PendenciaOverbookingPayload): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA)
  handlePendenciaResolvida(payload: PendenciaOverbookingPayload): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA, payload, payload.dataOperacao);
  }
```

**2.5.2 — emissores.** Os dois emissores existentes passam a preencher o payload completo. Nenhuma
regra de pedido ou de transição de pendência é tocada — muda o objeto emitido e, em
`alterarStatus`, **a escolha do evento para o status `cancelada`** (declarado abaixo). Isso mantém a
mitigação de conflito com a Onda 4 declarada na seção "Fronteira".

Em `pedidos.service.ts:359-362` a abertura já tem `pedido.operacaoId` em mãos e a data da operação é
a mesma que o método já usa nos demais eventos do pedido:

```ts
        eventos.push({
          nome: EVENTOS.PENDENCIA_OVERBOOKING_ABERTA,
          payload: {
            pendenciaId: pendencia.id,
            pedidoVendaId: pedido.id,
            operacaoId: pedido.operacaoId,
            dataOperacao,
            status: pendencia.status,
          },
        });
```

Em `overbooking.service.ts` o `alterarStatus` hoje emite `{ pendenciaId, status }` fora da transação
(`overbooking.service.ts:103-108`) e **não tem** nenhum helper de data. Esta task cria o helper
privado — literal, no mesmo arquivo, ao lado de `obterAtivaSobLock` (`overbooking.service.ts:121`) —
e a Task 6 apenas o reutiliza (não redefinir lá):

```ts
/** Data da Operação — obrigatória nos payloads: é a room do broadcast (roomsDaData). */
private async dataDaOperacao(tx: Tx, operacaoId: string): Promise<string> {
  const [linha] = await tx.select({ data: operacoes.data }).from(operacoes)
    .where(eq(operacoes.id, operacaoId));
  if (!linha) throw new NotFoundException('Operação da pendência não encontrada');
  return linha.data;
}
```

`alterarStatus` passa a devolver a data junto da pendência (lida **dentro** da transação que já
existe, para não abrir uma segunda conexão) e a emitir o payload completo depois do commit:

```ts
    const resultado = await this.db.transaction(async (tx) => {
      // ... corpo atual inalterado até o `return`
      return { pendencia, dataOperacao: await this.dataDaOperacao(tx, pendencia.operacaoId) };
    });
    this.eventEmitter.emit(
      resultado.pendencia.status === 'resolvida' || resultado.pendencia.status === 'cancelada'
        ? EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA
        : EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA,
      {
        pendenciaId: resultado.pendencia.id,
        operacaoId: resultado.pendencia.operacaoId,
        dataOperacao: resultado.dataOperacao,
        status: resultado.pendencia.status,
      },
    );
    return resultado.pendencia;
```

`alterarStatus` continua devolvendo a pendência para `atualizar` (`overbooking.service.ts:118`) — o
tipo de retorno público não muda. Importar `operacoes` de `../../../database/schema`
(`NotFoundException` já está importado).

> **Mudança de comportamento declarada.** Hoje `alterarStatus` só emite `..._RESOLVIDA` quando o
> status é `'resolvida'`; `'cancelada'` sai como `..._ATUALIZADA` e a pendência **continuaria
> aparecendo na fila** da tela nova. Como `'cancelada'` é terminal em `TRANSICOES_PENDENCIA` e a
> Task 6.3 trata os dois status como "saiu da fila", os dois emissores passam a usar o mesmo
> critério. É a única alteração de comportamento em código da Onda 1 nesta task, e está coberta pelo
> critério 5.14 do mapa DoD.

Nada mais muda no gateway: `broadcast` privado, `roomsDaData` e a guarda `podeAssinar` continuam
como estão. Quem produz o `dataOperacao` é o serviço que emite (Task 5 já o tem; Tasks 6, 7 e 8 leem
`operacoes.data` dentro da transação e o devolvem junto do agregado).

**2.6** Testes:

- `test/unit/permissoes-onda5.spec.ts` (**arquivo novo**, critério 5.5): espelho literal de
  `test/unit/permissoes-onda1.spec.ts`, que é o arquivo real desse padrão no repositório (não existe
  `rbac-permissoes.spec.ts`). Declarar `CHAVES_ONDA5 = ['SIF_LER', 'SIF_GERAR', 'APROVACOES_LER',
  'APROVACOES_DECIDIR', 'APROVACOES_SOLICITAR']` e repetir os dois casos: `PERMISSOES[chave] ===
  chave` e `DESCRICOES_PERMISSOES[chave]` casando `/\S/`. O caso "todo `PERMISSOES` tem descrição e
  vice-versa" já existe em `permissoes-onda1.spec.ts:23` e passa a cobrir as 5 chaves novas sem
  edição.
- `src/common/rbac/perfil-permissoes.snapshot.json` é um **arquivo versionado**, não um snapshot do
  Jest: `test/unit/perfil-permissoes-snapshot.spec.ts:17` compara `MAPA_PERFIL_PERMISSOES` com esse
  JSON. Depois de editar `permissoes.ts`, rodar `npm run rbac:snapshot`
  (`scripts/gerar-snapshot-perfis.ts`), revisar o diff — só as 5 chaves novas nos 7 perfis de 2.3 —
  e commitar o JSON junto. Sem isso o teste existente quebra. `-u` do Jest não tem efeito aqui.
- `test/unit/overbooking-branches.spec.ts` (arquivo existente, critério 5.14): o fake de `db` já
  cobre `alterarStatus` (linhas 43-65 e 145-160); acrescentar ao mock a leitura de `operacoes` que
  `dataDaOperacao` faz e um caso "alterarStatus emite RESOLVIDA no status terminal com `operacaoId`
  e `dataOperacao`", cobrindo `'resolvida'` e `'cancelada'`.
- `test/unit/realtime-gateway-onda5.spec.ts` (**arquivo novo**, critério 5.11): instanciar o gateway
  com um `RealtimeHub` espionado, chamar cada um dos 7 handlers (4 novos + 3 de pendência de
  overbooking) com um payload que traz `dataOperacao: '2026-08-03'` e assertar `hub.broadcast`
  chamado para as rooms `dashboard` e `operacao:2026-08-03`, com o nome de evento correto e o
  payload íntegro.

**Verificação:** `cd app/backend && npm run rbac:snapshot && npm run test -- permissoes-onda5 perfil-permissoes-snapshot realtime-gateway-onda5 overbooking-branches && npm run type-check` (o `type-check` é o que prova que `PayloadPorEvento` e `pedidos.service.ts` continuam coerentes).

**Commit:** `feat(onda5): permissões de SIF e aprovações + eventos de gestão no gateway de tempo real`

---

### Task 3 — Seed do parâmetro provisório dos modelos SIF (P8)

**Objetivo:** materializar D5.27 sem fechar a pendência P8.

**3.1** Em `app/backend/src/database/seed.ts`, acrescentar ao array `PARAMETROS_SEED` o objeto
literal de D5.27 (chave `gestao.modelos_relatorio_sif`), mantendo a ordem alfabética por grupo já
usada no arquivo. Atualizar o comentário do array de "As 9 chaves" para "As 10 chaves".

**3.2** Teste em `test/integration/parametros-onda3.e2e-spec.ts` (arquivo existente — não existe
`parametros.e2e-spec.ts`). O arquivo já autentica por cookie (`loginCookies` + `.set('Cookie', …)`,
`parametros-onda3.e2e-spec.ts:16-21`), que é a convenção de toda a suíte de integração; **não usar
`Authorization: Bearer`**. A rota real de leitura por chave é `GET /parametros/chave/:chave`
(`parametros.controller.ts:30`):

```ts
it('expõe o parâmetro provisório dos modelos SIF (P8)', async () => {
  const { body } = await request(srv())
    .get('/parametros/chave/gestao.modelos_relatorio_sif')
    .set('Cookie', adminCookies)
    .expect(200);

  expect(body.valorJson.provisorio).toBe(true);
  expect(body.valorJson.pendencia).toBe('P8');
});
```

Acrescentar também `'gestao.modelos_relatorio_sif'` ao array `CHAVES`
(`parametros-onda3.e2e-spec.ts:6-10`) e trocar o título do caso existente de "as 9 chaves" para
"as 10 chaves", coerente com o comentário atualizado em 3.1.

**3.3** Rodar `npm run db:seed` e conferir que rodar duas vezes não duplica (o seed é idempotente
por chave).

**Verificação:** `cd app/backend && npm run db:seed && npm run test -- parametros-onda3`.

**Commit:** `feat(onda5): parâmetro provisório dos modelos de relatório SIF (P8)`

---

### Task 4 — Backend `operacoes`: filtros de listagem e contadores por operação

**Objetivo:** dar à tela `/gestao/operacoes` (protótipo `Operacoes.tsx`) exatamente os dados que ela
mostra: lista filtrável por status e período, com contadores de compras e pedidos por operação.

**Delta real desta task** (o baseline já tem mais do que parece): `listarOperacoesSchema`,
`ZodValidationPipe` na query do `GET /operacoes`, os filtros `de`/`ate`/`status` e o envelope
`Paginado` **já existem** (`operacoes.service.ts:101-118`, `dto/operacao.dto.ts:5-13`,
`operacoes.controller.ts:27`). Esta task acrescenta apenas: o filtro `extraordinaria`, os 3
contadores por operação, a ordenação e o método `resolverCorrente`.

**4.1** Em `src/modules/operacoes/dto/operacao.dto.ts` (nome real do arquivo, **singular**),
acrescentar `extraordinaria` ao schema existente — sem recriar o schema nem mexer no `refine`:

```ts
export const listarOperacoesSchema = z.object({
  de: z.string().date().optional(),
  ate: z.string().date().optional(),
  status: statusOperacaoSchema.optional(),
  extraordinaria: z.union([z.boolean(), z.string()]).optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).refine(({ de, ate }) => !de || !ate || de <= ate, {
  message: 'de deve ser anterior ou igual a ate',
});

export type ListarOperacoesDto = z.infer<typeof listarOperacoesSchema>;

export interface OperacaoComContadores {
  id: string;
  data: string;
  diaSemana: number;
  rotulo: string;
  status: 'aberta' | 'em_andamento' | 'fechada';
  extraordinaria: boolean;
  comprasProgramadas: number;
  pedidosVenda: number;
  pendenciasOverbookingAbertas: number;
}
```

**4.2** Em `operacoes.service.ts`, substituir o corpo de `listar` (linhas 101-118) pela versão com
contadores. O retorno continua sendo o envelope `Paginado` montado por `montarPaginado` — **o envelope
não é novidade desta onda**; o que muda é o tipo do item (`Operacao` → `OperacaoComContadores`), o
filtro `extraordinaria` e a ordenação, que passa de `asc(data)` para `desc(data)` (a tela lista a
operação mais recente primeiro, como o protótipo). Contadores por subselect correlacionado, sem N+1:

```ts
async listar(query: ListarOperacoesDto): Promise<Paginado<OperacaoComContadores>> {
  const filtros = [isNull(operacoes.deletedAt)];
  if (query.status) filtros.push(eq(operacoes.status, query.status));
  if (query.de) filtros.push(gte(operacoes.data, query.de));
  if (query.ate) filtros.push(lte(operacoes.data, query.ate));
  if (query.extraordinaria !== undefined) {
    filtros.push(eq(operacoes.extraordinaria, query.extraordinaria));
  }
  const where = and(...filtros);
  const limit = query.limite;
  const offset = (query.pagina - 1) * query.limite;

  const [linhas, totalRow] = await Promise.all([
    this.db
      .select({
        id: operacoes.id,
        data: operacoes.data,
        diaSemana: operacoes.diaSemana,
        rotulo: operacoes.rotulo,
        status: operacoes.status,
        extraordinaria: operacoes.extraordinaria,
        comprasProgramadas: sql<number>`(
          SELECT count(*)::int FROM compras_programadas cp
          WHERE cp.operacao_id = ${operacoes.id} AND cp.deleted_at IS NULL
        )`,
        pedidosVenda: sql<number>`(
          SELECT count(*)::int FROM pedidos_venda pv
          WHERE pv.operacao_id = ${operacoes.id} AND pv.deleted_at IS NULL
        )`,
        pendenciasOverbookingAbertas: sql<number>`(
          SELECT count(*)::int FROM pendencias_overbooking po
          WHERE po.operacao_id = ${operacoes.id} AND po.deleted_at IS NULL
            AND po.status IN ('aberta','em_analise')
        )`,
      })
      .from(operacoes)
      .where(where)
      .orderBy(desc(operacoes.data))
      .limit(limit)
      .offset(offset),
    this.db.select({ total: sql<number>`count(*)::int` }).from(operacoes).where(where),
  ]);

  return montarPaginado(
    linhas as OperacaoComContadores[],
    totalRow[0]?.total ?? 0,
    { page: query.pagina, pageSize: query.limite },
  );
}
```

**4.3** Em `operacoes.controller.ts`, **não reaplicar** o `ZodValidationPipe(listarOperacoesSchema)` —
ele **já existe** no baseline (`operacoes.controller.ts:27`, confirmado na seção "Estado atual
verificado" e na lista de alterados: "sem mudança de pipe"). O único toque permitido neste arquivo
é alinhar o tipo de retorno do `listar` ao `Paginado<OperacaoComContadores>` se o TypeScript do
controller declarar o retorno explicitamente; caso contrário, o arquivo permanece intacto. Os demais
endpoints permanecem inalterados.

**4.4** Acrescentar `resolverCorrente()` ao serviço (usado pelo dashboard, D5.3):

```ts
/** Operação corrente: a próxima não fechada; senão a mais recente. Nunca inventa data. */
async resolverCorrente(): Promise<typeof operacoes.$inferSelect> {
  const hoje = new Date().toISOString().slice(0, 10);
  const proxima = await this.db.select().from(operacoes)
    .where(and(isNull(operacoes.deletedAt), gte(operacoes.data, hoje), ne(operacoes.status, 'fechada')))
    .orderBy(asc(operacoes.data)).limit(1).then((r) => r[0]);
  if (proxima) return proxima;

  const ultima = await this.db.select().from(operacoes)
    .where(isNull(operacoes.deletedAt))
    .orderBy(desc(operacoes.data)).limit(1).then((r) => r[0]);
  if (!ultima) throw new NotFoundException('OPERACAO_INEXISTENTE');
  return ultima;
}
```

**4.5** Testes em `test/integration/operacoes.e2e-spec.ts` (arquivo existente).

Ajuste das asserções existentes: o teste de listagem da linha 94-98 já lê `lista.body.data` (o
envelope existe hoje), então **nada quebra por causa do envelope**. O que precisa de ajuste é o
efeito colateral da mudança de ordenação e do tipo do item:

- na asserção existente `lista.body.data.some((o) => o.id === criar.body.id)`, acrescentar a
  verificação dos 3 contadores no elemento encontrado (`comprasProgramadas`, `pedidosVenda`,
  `pendenciasOverbookingAbertas` presentes e numéricos), para que o contrato novo fique coberto;
- acrescentar a asserção de que `lista.body.data` vem ordenada por `data` **decrescente**, já que a
  ordem mudou de `asc` para `desc`;
- conferir que `lista.body.total`, `page` e `pageSize` continuam presentes (regressão do envelope).

Casos novos: "filtra por status", "filtra por período", "filtra por extraordinaria", "traz contadores
de compras, pedidos e pendências", "resolverCorrente devolve a próxima não fechada",
"resolverCorrente lança OPERACAO_INEXISTENTE em base vazia".

**Verificação:** `cd app/backend && npm run test -- operacoes`.

**Commit:** `feat(onda5): filtros, contadores e operação corrente no módulo de operações`

---

### Task 5 — Backend: painel de impacto e edição de compra confirmada

**Objetivo:** DoD 1 (D5.10–D5.13).

**5.1** Em `disponibilidade.service.ts`, acrescentar os dois métodos novos (sem tocar em
`gerarParaCompra`):

```ts
export interface ItemImpacto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  quantidadeGeradaAtual: string;
  quantidadeGeradaProjetada: string;
  delta: string;
  quantidadeReservada: string;
  saldoAtual: string;
  saldoProjetado: string;
  deficitProjetado: string;
}

/**
 * Projeta, sem persistir, o efeito de novas quantidades compradas sobre a
 * disponibilidade virtual da compra. Todo cálculo em NUMERIC no banco (S4).
 * `simulacao` mapeia item_compra_id -> nova quantidade comprada.
 */
async projetarImpacto(
  tx: Tx,
  compraId: string,
  simulacao: Map<string, string>,
): Promise<ItemImpacto[]> {
  const overrides = [...simulacao.entries()];
  const overrideSql = overrides.length
    ? sql`(VALUES ${sql.join(
        overrides.map(([itemCompraId, qtd]) => sql`(${itemCompraId}::uuid, ${qtd}::numeric)`),
        sql`, `,
      )}) AS o(item_compra_id, quantidade)`
    : sql`(SELECT NULL::uuid AS item_compra_id, NULL::numeric AS quantidade WHERE false) AS o`;

  const linhas = await tx.execute<{
    item_comercial_id: string; codigo: string; descricao: string;
    gerada_atual: string; gerada_projetada: string;
    reservada: string; saldo_atual: string;
  }>(sql`
    WITH projecao AS (
      SELECT r.item_comercial_id,
             SUM(r.fator_quantidade * COALESCE(o.quantidade, cpi.quantidade_comprada)) AS gerada_projetada
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      LEFT JOIN ${overrideSql} ON o.item_compra_id = cpi.item_compra_id
      WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
    )
    SELECT p.item_comercial_id,
           ic.codigo, ic.descricao,
           COALESCE(dv.quantidade_total_gerada, 0)::text AS gerada_atual,
           p.gerada_projetada::text                      AS gerada_projetada,
           COALESCE(dv.quantidade_reservada, 0)::text    AS reservada,
           COALESCE(dv.quantidade_disponivel, 0)::text   AS saldo_atual
    FROM projecao p
    JOIN itens_comerciais ic ON ic.id = p.item_comercial_id
    LEFT JOIN disponibilidades_virtuais dv
      ON dv.compra_programada_id = ${compraId} AND dv.item_comercial_id = p.item_comercial_id
    ORDER BY ic.codigo
  `);

  return linhas.rows.map((l) => {
    const projetada = formatarQtd(l.gerada_projetada);
    const atual = formatarQtd(l.gerada_atual);
    const reservada = formatarQtd(l.reservada);
    const saldoProjetado = compararQtd(projetada, reservada) > 0
      ? subtrairQtd(projetada, reservada) : '0.000';
    const deficitProjetado = compararQtd(reservada, projetada) > 0
      ? subtrairQtd(reservada, projetada) : '0.000';
    return {
      itemComercialId: l.item_comercial_id,
      codigo: l.codigo,
      descricao: l.descricao,
      quantidadeGeradaAtual: atual,
      quantidadeGeradaProjetada: projetada,
      delta: subtrairQtd(projetada, atual),
      quantidadeReservada: reservada,
      saldoAtual: formatarQtd(l.saldo_atual),
      saldoProjetado,
      deficitProjetado,
    };
  });
}

/**
 * Aplica na disponibilidade virtual as quantidades já persistidas na compra.
 * Clampa o saldo em zero (o excedente reservado vira déficit visível — D5.12) e
 * deriva o status (D5.13). Sempre dentro da transação da alteração.
 */
async recalcularParaCompra(
  tx: Tx,
  compra: CompraProgramada,
  usuarioId: string,
): Promise<void> {
  const anteriores = await tx.select().from(disponibilidadesVirtuais)
    .where(eq(disponibilidadesVirtuais.compraProgramadaId, compra.id));

  const atualizadas = await tx.execute<{
    id: string; item_comercial_id: string;
    quantidade_total_gerada: string; quantidade_reservada: string;
    quantidade_disponivel: string; status: string;
  }>(sql`
    WITH projecao AS (
      SELECT r.item_comercial_id,
             SUM(r.fator_quantidade * cpi.quantidade_comprada) AS gerada
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
    )
    UPDATE disponibilidades_virtuais dv
       SET quantidade_total_gerada = p.gerada,
           quantidade_disponivel   = GREATEST(0, p.gerada - dv.quantidade_reservada),
           status = CASE
             WHEN dv.quantidade_reservada = 0 THEN 'gerada'
             WHEN GREATEST(0, p.gerada - dv.quantidade_reservada) = 0 THEN 'esgotada'
             ELSE 'parcialmente_reservada'
           END
      FROM projecao p
     WHERE dv.compra_programada_id = ${compra.id}
       AND dv.item_comercial_id = p.item_comercial_id
    RETURNING dv.id, dv.item_comercial_id, dv.quantidade_total_gerada,
              dv.quantidade_reservada, dv.quantidade_disponivel, dv.status
  `);

  for (const linha of atualizadas.rows) {
    const anterior = anteriores.find((a) => a.id === linha.id) ?? null;
    await this.auditoria.registrar(tx, {
      tabela: 'disponibilidades_virtuais',
      registroId: linha.id,
      operacao: 'UPDATE',
      modulo: 'comercial',
      usuarioId,
      dadosAnteriores: anterior ?? {},
      dadosNovos: linha,
    });
  }
}
```

**5.2** Em `dto/compra-programada.dto.ts` (nome real do arquivo, no singular — é o que
`compras-programadas.service.ts:23` e `compras-programadas.controller.ts:17` importam):

```ts
/** `simulacao=<itemCompraId>:<qtd>,<itemCompraId>:<qtd>` — read-only, pré-salvamento. */
export const impactoQuerySchema = z.object({
  simulacao: z.string().trim().optional().transform((valor, ctx) => {
    const mapa = new Map<string, string>();
    if (!valor) return mapa;
    for (const par of valor.split(',')) {
      const [id, qtd] = par.split(':');
      const idOk = z.string().uuid().safeParse(id ?? '');
      const qtdOk = /^\d+(\.\d{1,3})?$/.test(qtd ?? '');
      if (!idOk.success || !qtdOk) {
        ctx.addIssue({
          code: 'custom',
          message: `Simulação inválida em "${par}": use <itemCompraId>:<quantidade>`,
        });
        return z.NEVER;
      }
      mapa.set(idOk.data, qtd as string);
    }
    return mapa;
  }),
});

/**
 * Substitui `updateCompraItemSchema` (linhas 41-46 do arquivo atual), que é removido no mesmo
 * commit junto do tipo `UpdateCompraItemDto` — sem schema legado em paralelo.
 */
export const atualizarItemCompraSchema = z.object({
  quantidadeComprada: z
    .union([
      z.string().trim().regex(/^\d+(\.\d{1,3})?$/, 'quantidade deve ter até 3 casas decimais'),
      quantidadeSchema, // number positivo já existente no arquivo (linhas 5-8)
    ])
    .transform((valor) => (typeof valor === 'number' ? valor.toFixed(3) : valor))
    .refine((valor) => Number(valor) > 0, 'quantidade deve ser maior que zero'),
  observacoes: z.string().trim().max(500).optional(),
  confirmarDeficit: z.boolean().default(false),
});

export type ImpactoQueryDto = z.infer<typeof impactoQuerySchema>;
export type AtualizarItemCompraDto = z.infer<typeof atualizarItemCompraSchema>;
```

> **Decisão — contrato de `PATCH /comercial/compras-programadas/:id/itens/:itemId`.** O schema atual
> aceita `quantidadeComprada` **number opcional** e `observacoes` opcional
> (`compra-programada.dto.ts:41-46`), e há dois consumidores reais hoje:
> `compras-client.tsx:167-174`, que envia `{ quantidadeComprada: number, observacoes }`, e
> `compras-programadas.e2e-spec.ts:70`, que envia `{ quantidadeComprada: 20 }`. Trocar o campo por
> `string` obrigatória e apagar `observacoes` faria a tela existente receber 400 na quantidade e
> perder silenciosamente a observação já gravada — regressão silenciosa, proibida pelo Princípio
> VIII e por RA-06. Portanto:
> 1. **`quantidadeComprada` passa a ser obrigatória** (era opcional; um `PATCH` sem quantidade não
>    tem o que projetar e hoje só resultava num UPDATE que reescrevia o valor anterior) e aceita
>    `string` decimal **ou** `number`, normalizando para a `string` NUMERIC de 3 casas que D5.11/S4
>    exigem. A borda continua tolerante, o núcleo continua exato.
> 2. **`observacoes` é mantida** e continua sendo persistida pelo service. Não há dívida aberta:
>    nenhum caminho de observação é removido.
> 3. O retorno passa de `CompraProgramadaItem` para `{ item, impacto }` (ver 5.3) — mudança
>    **declarada**, com os consumidores ajustados nas Tasks 5.6 e 14.2 no mesmo ciclo.

**5.3** Em `compras-programadas.service.ts`.

Membros reais do arquivo, para não inventar API: a dependência injetada chama-se
**`this.disponibilidadeService`** (`compras-programadas.service.ts:38`), a leitura da compra é o
privado **`buscarAtiva(id, tx?)`** que devolve `CompraProgramada | null` **sem lock**
(`compras-programadas.service.ts:323-330`), e **não existem** `obterOuFalhar`, `obterSobLock` nem
`dataDaOperacao`. O que esta task acrescenta de infraestrutura interna é um único privado novo,
`buscarAtivaSobLock`, escrito literalmente (mesmo idioma de `pedidos.service.ts:640-644` e
`overbooking.service.ts:121-125`):

```ts
/**
 * Leitura da compra com `SELECT … FOR UPDATE`: D5.11 recalcula a disponibilidade a partir das
 * quantidades da compra, então duas edições concorrentes precisam serializar na linha da compra.
 * `buscarAtiva` (sem lock) continua servindo os GETs.
 */
private async buscarAtivaSobLock(tx: Tx, id: string): Promise<CompraProgramada> {
  const [compra] = await tx
    .select()
    .from(comprasProgramadas)
    .where(and(eq(comprasProgramadas.id, id), isNull(comprasProgramadas.deletedAt)))
    .for('update');
  if (!compra) throw new NotFoundException('Compra programada não encontrada');
  return compra;
}
```

`Tx` ainda não existe neste arquivo: acrescentar `type Tx = NodePgDatabase<typeof schema>;` junto
dos aliases do topo (`compras-programadas.service.ts:25-27`), igual ao que
`disponibilidade.service.ts:12` já faz.

```ts
/** Fotografia (ou simulação) do impacto na disponibilidade — não persiste nada. */
async impacto(compraId: string, simulacao: Map<string, string>): Promise<ImpactoCompra> {
  const compra = await this.buscarAtiva(compraId);
  if (!compra) throw new NotFoundException('Compra programada não encontrada');
  const itens = await this.disponibilidadeService.projetarImpacto(this.db, compraId, simulacao);
  return this.montarImpacto(compra, itens);
}

private montarImpacto(compra: CompraProgramada, itens: ItemImpacto[]): ImpactoCompra {
  const deficitTotal = somarListaQtd(itens.map((i) => i.deficitProjetado));
  const trechos = itens
    .filter((i) => compararQtd(i.delta, '0.000') !== 0)
    .map((i) => {
      const sinal = compararQtd(i.delta, '0.000') > 0 ? '+' : '-';
      const deficit = compararQtd(i.deficitProjetado, '0.000') > 0
        ? `; déficit projetado: ${i.deficitProjetado} ${i.codigo}`
        : '';
      return `${sinal}${i.delta.replace('-', '')} ${i.codigo} virtuais${deficit}`;
    });
  return {
    compraId: compra.id,
    operacaoId: compra.operacaoId,
    status: compra.status,
    itens,
    deficitTotal,
    exigeConfirmacao: compararQtd(deficitTotal, '0.000') > 0,
    resumo: trechos.length ? `${trechos.join('; ')}.` : 'Nenhuma alteração de quantidade.',
  };
}

/**
 * Altera a quantidade de um item. **Substitui** o `atualizarItem` atual
 * (`compras-programadas.service.ts:171-219`), que barrava compra confirmada via `assertEditavel` —
 * é exatamente essa guarda que D5.11 revoga para o item. Compra confirmada recalcula a
 * disponibilidade na mesma transação.
 */
async atualizarItem(
  compraId: string,
  itemId: string,
  dto: AtualizarItemCompraDto,
  usuarioId: string,
): Promise<{ item: CompraProgramadaItem; impacto: ImpactoCompra }> {
  const resultado = await this.db.transaction(async (tx) => {
    const compra = await this.buscarAtivaSobLock(tx, compraId);
    if (compra.status === 'cancelada') {
      throw new ConflictException('Compra cancelada não pode ser alterada');
    }

    const [item] = await tx.select().from(comprasProgramadasItens)
      .where(and(
        eq(comprasProgramadasItens.id, itemId),
        eq(comprasProgramadasItens.compraProgramadaId, compraId),
        isNull(comprasProgramadasItens.deletedAt),
      ))
      .for('update');
    if (!item) throw new NotFoundException('Item da compra não encontrado');

    const confirmada = compra.status === 'confirmada';
    if (confirmada) {
      const projetado = await this.disponibilidadeService.projetarImpacto(
        tx, compraId, new Map([[item.itemCompraId, dto.quantidadeComprada]]),
      );
      const impacto = this.montarImpacto(compra, projetado);
      if (impacto.exigeConfirmacao && !dto.confirmarDeficit) {
        throw new ConflictException({
          codigo: 'IMPACTO_CONFIRMACAO_NECESSARIA',
          mensagem: 'A alteração projeta déficit; confirme para prosseguir.',
          impacto,
        });
      }
    }

    const [atualizado] = await tx.update(comprasProgramadasItens)
      .set({
        quantidadeComprada: dto.quantidadeComprada,
        observacoes: dto.observacoes ?? item.observacoes,
        updatedAt: new Date(),
      })
      .where(eq(comprasProgramadasItens.id, itemId))
      .returning();
    if (!atualizado) throw new Error('Falha ao atualizar item da compra');

    await this.auditoria.registrar(tx, {
      tabela: 'compras_programadas_itens',
      registroId: itemId,
      operacao: 'UPDATE',
      modulo: 'comercial',
      usuarioId,
      dadosAnteriores: item,
      dadosNovos: atualizado,
    });

    if (confirmada) await this.disponibilidadeService.recalcularParaCompra(tx, compra, usuarioId);

    const itens = await this.disponibilidadeService.projetarImpacto(tx, compraId, new Map());
    return { compra, item: atualizado, impacto: this.montarImpacto(compra, itens) };
  });

  if (resultado.compra.status === 'confirmada') {
    // Mesma leitura pós-commit de `confirmar` (compras-programadas.service.ts:265-269), porém sem
    // o `?? ''` de lá: `dataOperacao` é a room do broadcast e uma string vazia publicaria em
    // `operacao:` — falha silenciosa (RA-05/RA-06). A operação é FK obrigatória da compra.
    const [linhaOperacao] = await this.db
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(eq(operacoes.id, resultado.compra.operacaoId));
    if (!linhaOperacao) throw new NotFoundException('Operação da compra não encontrada');
    const dataOperacao = linhaOperacao.data;
    this.eventEmitter.emit(EVENTOS.COMPRA_ALTERADA_IMPACTO, {
      compraId: resultado.compra.id,
      operacaoId: resultado.compra.operacaoId,
      dataOperacao,
      deficitTotal: resultado.impacto.deficitTotal,
      itens: resultado.impacto.itens.map((i) => ({
        itemComercialId: i.itemComercialId,
        delta: i.delta,
        deficitProjetado: i.deficitProjetado,
      })),
    });
  }
  return { item: resultado.item, impacto: resultado.impacto };
}

/** Histórico derivado da auditoria (D5.9) — sem tabela paralela. */
async historico(compraId: string): Promise<Array<{
  id: string; dataHora: string;   usuarioNome: string | null; tabela: string;
  operacao: string; dadosAnteriores: unknown; dadosNovos: unknown;
}>> {
  const compra = await this.buscarAtiva(compraId);
  if (!compra) throw new NotFoundException('Compra programada não encontrada');
  const itens = await this.db.select({ id: comprasProgramadasItens.id })
    .from(comprasProgramadasItens)
    .where(eq(comprasProgramadasItens.compraProgramadaId, compraId));
  const ids = [compraId, ...itens.map((i) => i.id)];

  const linhas = await this.db.select({
    id: auditoria.id,
    tabela: auditoria.tabela,
    operacao: auditoria.operacao,
    dadosAnteriores: auditoria.dadosAnteriores,
    dadosNovos: auditoria.dadosNovos,
    createdAt: auditoria.createdAt,
    usuarioNome: usuarios.nome,
  })
    .from(auditoria)
    .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
    .where(and(
      inArray(auditoria.tabela, ['compras_programadas', 'compras_programadas_itens']),
      inArray(auditoria.registroId, ids),
    ))
    .orderBy(desc(auditoria.createdAt))
    .limit(50);

  return linhas.map((l) => ({
    id: l.id,
    dataHora: l.createdAt.toISOString(),
    // Sem autor conhecido o campo vai `null` — a tela mostra "—". Não inventar nome (RA-06).
    usuarioNome: l.usuarioNome,
    tabela: l.tabela,
    operacao: l.operacao,
    dadosAnteriores: l.dadosAnteriores,
    dadosNovos: l.dadosNovos,
  }));
}
```

> `assertEditavel` (`compras-programadas.service.ts:317-321`) continua existindo e continua guardando
> `atualizar` (campos de cabeçalho da compra) e `cancelar`. A liberação de D5.11 vale **apenas** para
> `atualizarItem`, que deixa de chamá-lo e passa a ter a sua própria guarda (`cancelada` bloqueada) e
> o seu próprio caminho de recálculo. `buscarAtiva` continua sendo usado por `detalhar`, `atualizar`,
> `confirmar` e `cancelar` — nada muda para eles.

**Imports novos no arquivo:** `inArray` (de `drizzle-orm`, junto de `and/desc/eq/isNull/ne/sql`) e
`auditoria` + `usuarios` (de `../../../database/schema`, junto de `comprasProgramadas`,
`comprasProgramadasItens` e `operacoes`); `ItemImpacto` passa a ser importado do
`disponibilidade.service.ts` no mesmo `import type` que já traz `DisponibilidadeGerada`
(`compras-programadas.service.ts:18`). `NotFoundException` e `ConflictException` já estão
importados.

**5.4** Em `compras-programadas.controller.ts`.

Idioma real deste controller (`compras-programadas.controller.ts:1-24`), válido para **todos** os
controllers desta onda: o decorator de RBAC é `@RequirePermissoes(...)` (plural, de
`common/rbac/require-permissoes.decorator.ts`) e o usuário vem de `@CurrentUser() user:
CurrentUserPayload` (de `common/decorators/current-user.decorator.ts`), cujo id é **`user.sub`**.
Não existem `@RequirePermissao`, `@UsuarioAtual` nem `UsuarioAutenticado`. `ParseUUIDPipe` vem de
`@nestjs/common` e é usado só nos endpoints novos; os existentes ficam com `@Param('id')` como
estão, para não mudar o código de erro de rotas já em produção.

O `@Patch(':id/itens/:itemId')` **já existe** (`compras-programadas.controller.ts:56-65`): trocar o
pipe de `updateCompraItemSchema` para `atualizarItemCompraSchema` e remover o import do schema
antigo, que deixa de existir.

```ts
@Get(':id/impacto')
@RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
async impacto(
  @Param('id', ParseUUIDPipe) id: string,
  @Query(new ZodValidationPipe(impactoQuerySchema)) query: ImpactoQueryDto,
) {
  return this.service.impacto(id, query.simulacao);
}

@Get(':id/historico')
@RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
async historico(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.historico(id);
}

@Patch(':id/itens/:itemId')
@RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
async atualizarItem(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('itemId', ParseUUIDPipe) itemId: string,
  @Body(new ZodValidationPipe(atualizarItemCompraSchema)) dto: AtualizarItemCompraDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.atualizarItem(id, itemId, dto, user.sub);
}
```

**5.5** Testes:

`test/unit/impacto-compra.spec.ts` — função pura de montagem do impacto:

```ts
describe('montarImpacto', () => {
  it('déficit = reservada - projetada, nunca negativo', () => { /* casos: 10→6 com 8 reservados => déficit 2; 10→12 => déficit 0 */ });
  it('resumo do protótipo lista sinal, sigla e déficit por item', () => { /* compara com o texto de CompraProgramada.tsx:247-253 */ });
  it('exigeConfirmacao só quando deficitTotal > 0', () => { /* ... */ });
});
```

`test/integration/compras-impacto.e2e-spec.ts` — cenário base: operação + item de compra
"Boi casado" + regras AD-01 (2 TZ, 2 DT, 2 PA) + compra de 100 bois confirmada + pedido reservando
150 TZ. Casos 1.1 a 1.10 do mapa DoD, um `it` por linha.

Autenticação: **cookie**, não `Authorization: Bearer`. Toda a suíte de integração usa
`createTestUser` + `loginCookies` e `.set('Cookie', …)` (ver
`compras-programadas.e2e-spec.ts:12-19`); não há emissão de token bruto nos helpers.

O helper existente é `lerDisponibilidade(app, itemComercialId)`
(`test/helpers/comercial-fixtures.ts:66-82`) — dois argumentos, lendo direto pelo Drizzle, e filtra
só por item comercial. Serve como está para este cenário (uma única compra); **não** inventar uma
assinatura com `compraId`. Se algum caso desta onda precisar distinguir duas compras do mesmo item
(DoD 2.3/2.4), acrescentar um terceiro parâmetro opcional `compraProgramadaId` ao helper, no commit
que precisar dele. Asserts centrais:

```ts
it('409 não persiste nada', async () => {
  const antes = await lerDisponibilidade(app, tzId);
  const { body } = await request(app.getHttpServer())
    .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
    .set('Cookie', comprasCookies)
    .send({ quantidadeComprada: '60.000' })
    .expect(409);

  expect(body.codigo).toBe('IMPACTO_CONFIRMACAO_NECESSARIA');
  expect(body.impacto.deficitTotal).toBe('30.000');
  const depois = await lerDisponibilidade(app, tzId);
  expect(depois).toEqual(antes);
});

it('recálculo atômico da disponibilidade', async () => {
  const { body } = await request(app.getHttpServer())
    .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
    .set('Cookie', comprasCookies)
    .send({ quantidadeComprada: '60.000', confirmarDeficit: true })
    .expect(200);

  expect(body.item.quantidadeComprada).toBe('60.000');
  const dv = await lerDisponibilidade(app, tzId);
  expect(dv.quantidadeTotalGerada).toBe('120.000');
  expect(dv.quantidadeReservada).toBe('150.000');
  expect(dv.quantidadeDisponivel).toBe('0.000');
  expect(dv.status).toBe('esgotada');
});
```

**5.6** Ajustar as suítes existentes que o novo contrato quebra — **no mesmo commit**, senão a Task 5
entrega o CI vermelho.

`test/integration/compras-programadas.e2e-spec.ts`:

- Título do `describe` (linha 6): "CRUD + RBAC + imutabilidade" → "CRUD + RBAC + edição de item",
  porque D5.11 revoga a imutabilidade **do item** (a do cabeçalho, via `assertEditavel`, continua).
- "permite editar item enquanto em rascunho" (linhas 59-73): a resposta agora é
  `{ item, impacto }`. Trocar `expect(Number(res.body.quantidadeComprada)).toBe(20)` por
  `expect(Number(res.body.item.quantidadeComprada)).toBe(20)` e acrescentar
  `expect(res.body.impacto).toBeDefined()`. O payload `{ quantidadeComprada: 20 }` (number) **segue
  válido** pela união do schema de 5.2 — é justamente o caso que prova a decisão de contrato.
- "IMUTABILIDADE: editar item após confirmar retorna 409" (linhas 75-95) — **este teste afirma o
  contrário de D5.11 e é substituído**, não remendado. No lugar dele, dois casos:

```ts
it('D5.11: compra confirmada aceita edição de item e recalcula a disponibilidade', async () => {
  // cenário do arquivo: seedComercialBase({ fator: 4 }), sem reserva nenhuma → sem déficit,
  // portanto não exige confirmarDeficit.
  const criar = await request(app.getHttpServer())
    .post('/comercial/compras-programadas')
    .set('Cookie', comprasCookies)
    .send(novaCompra({ dataOperacao: '2026-07-04' }));
  const compraId = criar.body.id;
  const itemId = criar.body.itens[0].id;

  await request(app.getHttpServer())
    .post(`/comercial/compras-programadas/${compraId}/confirmar`)
    .set('Cookie', comprasCookies)
    .expect(201);

  const editar = await request(app.getHttpServer())
    .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
    .set('Cookie', comprasCookies)
    .send({ quantidadeComprada: '99.000', observacoes: 'ajuste do fornecedor' });

  expect(editar.status).toBe(200);
  expect(editar.body.item.quantidadeComprada).toBe('99.000');
  expect(editar.body.item.observacoes).toBe('ajuste do fornecedor'); // observação preservada
  expect(editar.body.impacto.exigeConfirmacao).toBe(false);

  const dv = await lerDisponibilidade(app, base.itemComercialId);
  expect(Number(dv?.quantidadeTotalGerada)).toBe(99 * base.fator); // fator 4 do fixture
});

it('IMUTABILIDADE: compra CANCELADA continua recusando edição de item (409)', async () => {
  /* cria, cancela via DELETE /:id e espera 409 no PATCH do item */
});
```

O arquivo passa a importar `lerDisponibilidade` junto de `seedComercialBase`
(`compras-programadas.e2e-spec.ts:4`); `base.itemComercialId` e `base.fator` já vêm do fixture
(`comercial-fixtures.ts:56-62`).

`test/unit/compras-programadas-branches.spec.ts` (casos das linhas 108-151):

- os dois casos de 404 passam `{} as never` como dto; passar `{ quantidadeComprada: '25.000',
  confirmarDeficit: false }`, já que a quantidade virou obrigatória;
- "atualizarItem → usa quantidadeComprada informada no dto" espera `v.quantidadeComprada === '25'` a
  partir de `{ quantidadeComprada: 25 }`; com a normalização de 5.2 o service recebe **`'25.000'`**
  do pipe, então o dto do teste passa a ser `{ quantidadeComprada: '25.000' }` e a expectativa
  `'25.000'`. O retorno passa a ser lido como `result.item`;
- o mock precisa cobrir o novo caminho: `buscarAtivaSobLock` usa `.for('update')` e, para compra
  `confirmada`, `atualizarItem` chama `projetarImpacto`/`recalcularParaCompra` — acrescentar os dois
  ao fake de `DisponibilidadeService` já usado no arquivo.

`app/frontend/src/app/api/comercial/compras-programadas/[id]/itens/[itemId]/route.ts`: o tipo do
`fetchBackend` deixa de ser `CompraProgramadaDetalhe` e passa a ser
`{ item: CompraProgramadaItem; impacto: ImpactoCompra }` (Task 14.1 declara os tipos). O repasse de
status/corpo não muda — inclusive no 409, que a tela precisa ler íntegro.

**Verificação:** `cd app/backend && npm run test -- impacto-compra compras-impacto compras-programadas`.

**Commit:** `feat(onda5): painel de impacto e edição de compra confirmada com recálculo atômico`

---
### Task 6 — Backend: fontes de cobertura e os 3 caminhos de decisão do overbooking

**Objetivo:** DoD 2 (D5.14–D5.18).

**6.1** Em `dto/overbooking.dto.ts`, trocar o `decidirPendenciaSchema` genérico por um discriminado
por caminho (cada caminho tem os campos que o seu efeito exige):

```ts
export const decidirPendenciaSchema = z.discriminatedUnion('caminho', [
  z.object({
    caminho: z.literal('compra_complementar'),
    compraProgramadaId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  z.object({
    caminho: z.literal('redistribuicao'),
    reservaOrigemId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  z.object({
    caminho: z.literal('novo_pedido'),
    operacaoDestinoId: z.string().uuid(),
    compraProgramadaId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
]);

export type DecidirPendenciaDto = z.infer<typeof decidirPendenciaSchema>;
```

`STATUS_POR_CAMINHO`, `statusDoCaminho` e `TRANSICOES_PENDENCIA` permanecem como estão.

> O caminho 3 exige `compraProgramadaId` porque `pedidos_venda.compra_programada_id` é `NOT NULL`
> (`pedidos.schema.ts:17`) e `createPedidoSchema` o exige como obrigatório
> (`dto/pedido.dto.ts:31`). A UI escolhe entre as `comprasComplementares` da operação de destino
> devolvidas por `GET /:id/cobertura` (D5.14) — nenhum id é adivinhado pelo backend.

**6.2** Em `overbooking.service.ts`, acrescentar aos imports de `../../../database/schema` as tabelas
usadas pelo código novo — `operacoes`, `reservasDisponibilidade`, `disponibilidadesVirtuais`,
`pedidosVendaItens`, `comprasProgramadas` — e aos de `drizzle-orm` os operadores `asc`, `gt`, `ne`,
`inArray` (hoje o arquivo importa apenas `and, desc, eq, isNull, sql`). Somam-se ainda
`compararQtd`, `ehZero`, `formatarQtd` e `subtrairQtd` de `../../../common/crud/decimal`,
`PedidosService` e o tipo `EventoDominio` de `../pedidos/pedidos.service` (exportado na Task 6.4), e
a injeção de `private readonly pedidos: PedidosService` no construtor.

Em seguida, dois helpers privados (hoje só existe `obterAtivaSobLock`,
`overbooking.service.ts:121-128`) e a leitura de fontes de cobertura:

```ts
/** Leitura sem lock, para os GETs (cobertura/histórico). */
private async obterAtiva(id: string): Promise<Pendencia> {
  const atual = await this.db.select().from(pendenciasOverbooking)
    .where(and(eq(pendenciasOverbooking.id, id), isNull(pendenciasOverbooking.deletedAt)))
    .then((r) => r[0]);
  if (!atual) throw new NotFoundException('Pendência não encontrada');
  return atual;
}

// `dataDaOperacao(tx, operacaoId)` já foi criado neste arquivo pela Task 2.5.2 — reusar, não
// redefinir.

async cobertura(id: string): Promise<CoberturaPendencia> {
  const pendencia = await this.obterAtiva(id);
  const operacao = await this.db.select().from(operacoes)
    .where(eq(operacoes.id, pendencia.operacaoId)).then((r) => r[0]);
  if (!operacao) throw new NotFoundException('Operação da pendência não encontrada');

  const compras = await this.db.execute<{
    compra_programada_id: string; operacao_id: string; data: string;
    status: string; quantidade_projetada: string;
  }>(sql`
    SELECT cp.id AS compra_programada_id, cp.operacao_id, op.data, cp.status,
           SUM(r.fator_quantidade * cpi.quantidade_comprada)::text AS quantidade_projetada
      FROM compras_programadas cp
      JOIN operacoes op ON op.id = cp.operacao_id
      JOIN compras_programadas_itens cpi
        ON cpi.compra_programada_id = cp.id AND cpi.deleted_at IS NULL
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL AND r.status = 'ativo'
       AND r.item_comercial_id = ${pendencia.itemComercialId}
     WHERE cp.deleted_at IS NULL AND cp.status <> 'cancelada'
       AND op.data >= ${operacao.data}
     GROUP BY cp.id, cp.operacao_id, op.data, cp.status
     ORDER BY op.data ASC
  `);

  const redistribuicoes = await this.db.execute<{
    pedido_venda_id: string; pedido_venda_item_id: string; cliente_nome: string;
    quantidade_reservada: string; reserva_id: string; disponibilidade_virtual_id: string;
  }>(sql`
    SELECT pv.id AS pedido_venda_id, pvi.id AS pedido_venda_item_id,
           COALESCE(c.nome_fantasia, c.razao_social) AS cliente_nome,
           rd.quantidade_reservada::text, rd.id AS reserva_id,
           rd.disponibilidade_virtual_id
      FROM reservas_disponibilidade rd
      JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
      JOIN pedidos_venda pv ON pv.id = pvi.pedido_venda_id
      JOIN clientes c ON c.id = pv.cliente_id
     WHERE rd.status = 'ativa'
       AND rd.tipo_consumo IN ('fisico','virtual')
       AND pvi.item_comercial_id = ${pendencia.itemComercialId}
       AND pv.operacao_id = ${pendencia.operacaoId}
       AND pv.id <> ${pendencia.pedidoVendaId}
       AND pv.deleted_at IS NULL AND pvi.deleted_at IS NULL
     ORDER BY rd.created_at ASC
  `);

  const proxima = await this.db.select().from(operacoes)
    .where(and(isNull(operacoes.deletedAt), gt(operacoes.data, operacao.data),
               ne(operacoes.status, 'fechada')))
    .orderBy(asc(operacoes.data)).limit(1).then((r) => r[0] ?? null);

  return {
    pendenciaId: pendencia.id,
    itemComercialId: pendencia.itemComercialId,
    quantidadeDeficit: pendencia.quantidadeDeficit,
    comprasComplementares: compras.rows.map((c) => ({
      compraProgramadaId: c.compra_programada_id,
      operacaoId: c.operacao_id,
      dataOperacao: c.data,
      status: c.status,
      quantidadeProjetada: formatarQtd(c.quantidade_projetada),
    })),
    redistribuicoes: redistribuicoes.rows.map((r) => ({
      pedidoVendaId: r.pedido_venda_id,
      pedidoVendaItemId: r.pedido_venda_item_id,
      clienteNome: r.cliente_nome,
      quantidadeReservada: formatarQtd(r.quantidade_reservada),
      reservaId: r.reserva_id,
      disponibilidadeVirtualId: r.disponibilidade_virtual_id,
    })),
    proximaOperacao: proxima
      ? { id: proxima.id, data: proxima.data, rotulo: proxima.rotulo }
      : null,
  };
}
```

**6.3** Substituir o `decidir` alias por um `decidir` com efeito real, um método privado por caminho:

```ts
async decidir(id: string, dto: DecidirPendenciaDto, usuarioId: string) {
  const { pendencia, eventos, dataOperacao } = await this.db.transaction(async (tx) => {
    const atual = await this.obterAtivaSobLock(tx, id);
    const statusAlvo = statusDoCaminho(dto.caminho);
    if (!TRANSICOES_PENDENCIA[atual.status as StatusPendencia].includes(statusAlvo)) {
      throw new ConflictException(`Transição ${atual.status} → ${statusAlvo} inválida`);
    }
    if (compararQtd(dto.quantidade, atual.quantidadeDeficit) > 0) {
      throw new ConflictException('Quantidade acima do déficit da pendência');
    }

    const efeito = dto.caminho === 'compra_complementar'
      ? await this.aplicarCompraComplementar(tx, atual, dto)
      : dto.caminho === 'redistribuicao'
        ? await this.aplicarRedistribuicao(tx, atual, dto, usuarioId)
        : await this.aplicarNovoPedido(tx, atual, dto, usuarioId);

    // O caminho 3 delega a PedidosService, que já grava o abate na pendência
    // (reduz o déficit ou cancela). Reler sob o lock já mantido e NUNCA subtrair de
    // novo — do contrário o déficit seria abatido duas vezes.
    const aposEfeito = efeito.abatidoPeloEfeito ? await this.obterAtivaSobLock(tx, id) : atual;
    const encerradaPeloEfeito =
      aposEfeito.status === 'cancelada' || aposEfeito.status === 'resolvida';
    const deficitRestante = encerradaPeloEfeito
      ? '0.000'
      : efeito.abatidoPeloEfeito
        ? aposEfeito.quantidadeDeficit
        : subtrairQtd(atual.quantidadeDeficit, efeito.quantidadeAbatida);
    // 'cancelada' e 'resolvida' são terminais em TRANSICOES_PENDENCIA: o status gravado
    // pelo efeito prevalece; decidir registra a decisão mas nunca reabre a pendência.
    const statusFinal: StatusPendencia = encerradaPeloEfeito
      ? (aposEfeito.status as StatusPendencia)
      : ehZero(deficitRestante) ? 'resolvida' : statusAlvo;

    const [pendencia] = await tx.update(pendenciasOverbooking).set({
      // chk_pend_ovb_deficit exige > 0: ao zerar, mantém o último déficit positivo e
      // deixa o encerramento no status — mesmo contorno já usado em
      // PedidosService.atualizarOuCancelarPendencia (pedidos.service.ts:454-458).
      ...(ehZero(deficitRestante) ? {} : { quantidadeDeficit: deficitRestante }),
      status: statusFinal,
      decisaoJson: { caminho: dto.caminho, ...efeito.detalhe },
      responsavelId: usuarioId,
      updatedAt: new Date(),
    }).where(eq(pendenciasOverbooking.id, id)).returning();
    if (!pendencia) throw new NotFoundException('Pendência não encontrada');

    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: id,
      acao: statusAlvo,
      autorId: usuarioId,
      detalheJson: { caminho: dto.caminho, ...efeito.detalhe },
    });
    if (statusFinal !== statusAlvo) {
      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: id, acao: statusFinal, autorId: usuarioId,
        detalheJson: {
          motivo: encerradaPeloEfeito
            ? 'pendência encerrada pelo efeito da decisão sobre o item do pedido'
            : 'déficit zerado pela decisão',
        },
      });
    }
    await this.auditoria.registrar(tx, {
      tabela: 'pendencias_overbooking', registroId: id, operacao: 'UPDATE',
      modulo: 'comercial', usuarioId, dadosAnteriores: atual, dadosNovos: pendencia,
    });

    return {
      pendencia,
      eventos: efeito.eventos,
      dataOperacao: await this.dataDaOperacao(tx, atual.operacaoId),
    };
  });

  for (const evento of eventos) this.eventEmitter.emit(evento.nome, evento.payload);
  // 'cancelada' também tira a pendência da fila: sai como RESOLVIDA para o gateway.
  this.eventEmitter.emit(
    pendencia.status === 'resolvida' || pendencia.status === 'cancelada'
      ? EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA
      : EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA,
    {
      pendenciaId: pendencia.id,
      operacaoId: pendencia.operacaoId,
      dataOperacao,
      status: pendencia.status,
    },
  );
  return pendencia;
}
```

Os três métodos privados devolvem o mesmo contrato:

```ts
interface EfeitoDecisao {
  /** Quanto do déficit a decisão abate agora. */
  quantidadeAbatida: string;
  /** true quando o próprio efeito já gravou o abate na pendência (só o caminho 3, via PedidosService). */
  abatidoPeloEfeito: boolean;
  detalhe: Record<string, unknown>;
  eventos: EventoDominio[];
}
```

Caminho 1 (D5.15):

```ts
private async aplicarCompraComplementar(tx: Tx, pendencia: Pendencia, dto: Extract<DecidirPendenciaDto, { caminho: 'compra_complementar' }>) {
  const linha = await tx.execute<{ operacao_id: string; data: string; data_pendencia: string; gera_item: boolean }>(sql`
    SELECT cp.operacao_id, op.data, op_pend.data AS data_pendencia,
           EXISTS (
             SELECT 1 FROM compras_programadas_itens cpi
             JOIN regras_desdobramento_comercial r
               ON r.item_compra_id = cpi.item_compra_id
              AND r.deleted_at IS NULL AND r.status = 'ativo'
              AND r.item_comercial_id = ${pendencia.itemComercialId}
             WHERE cpi.compra_programada_id = cp.id AND cpi.deleted_at IS NULL
           ) AS gera_item
      FROM compras_programadas cp
      JOIN operacoes op ON op.id = cp.operacao_id
      JOIN operacoes op_pend ON op_pend.id = ${pendencia.operacaoId}
     WHERE cp.id = ${dto.compraProgramadaId}
       AND cp.deleted_at IS NULL AND cp.status <> 'cancelada'
  `).then((r) => r.rows[0]);

  if (!linha) throw new NotFoundException('Compra programada inelegível ou inexistente');
  if (linha.data < linha.data_pendencia) {
    throw new ConflictException('Compra complementar deve estar na operação atual ou em uma futura');
  }
  if (!linha.gera_item) {
    throw new ConflictException('A compra escolhida não gera o item comercial da pendência');
  }

  return {
    quantidadeAbatida: '0.000', // o abate ocorre quando a compra for confirmada/recebida
    abatidoPeloEfeito: false,
    detalhe: {
      compraProgramadaId: dto.compraProgramadaId,
      operacaoDestinoId: linha.operacao_id,
      quantidade: dto.quantidade,
      observacao: dto.observacao ?? null,
    },
    eventos: [] as EventoDominio[],
  };
}
```

> A decisão de compra complementar **compromete** a próxima compra, mas não abate o déficit da
> pendência — o abate real ocorre quando a compra é confirmada e gera disponibilidade. Por isso
> `quantidadeAbatida = '0.000'` e o status fica em `compra_complementar_programada` até o gestor
> encerrar. Isso reproduz o protótipo (`PainelOverbooking.tsx:377-381`), onde o caminho 1 muda o
> status mas mantém a pendência viva.

Caminho 2 (D5.16):

```ts
private async aplicarRedistribuicao(tx: Tx, pendencia: Pendencia, dto: Extract<DecidirPendenciaDto, { caminho: 'redistribuicao' }>, usuarioId: string) {
  const doadora = await tx.select().from(reservasDisponibilidade)
    .where(and(
      eq(reservasDisponibilidade.id, dto.reservaOrigemId),
      eq(reservasDisponibilidade.status, 'ativa'),
      inArray(reservasDisponibilidade.tipoConsumo, ['fisico', 'virtual']),
    )).for('update').then((r) => r[0]);
  if (!doadora) throw new NotFoundException('Reserva de origem não encontrada ou inativa');
  if (compararQtd(dto.quantidade, doadora.quantidadeReservada) > 0) {
    throw new ConflictException('Quantidade acima do saldo da reserva de origem');
  }
  if (doadora.pedidoVendaItemId === pendencia.pedidoVendaItemId) {
    throw new ConflictException('A reserva de origem não pode ser do próprio pedido deficitário');
  }

  const overbooking = await tx.select().from(reservasDisponibilidade)
    .where(and(
      eq(reservasDisponibilidade.pedidoVendaItemId, pendencia.pedidoVendaItemId),
      eq(reservasDisponibilidade.tipoConsumo, 'overbooking'),
      eq(reservasDisponibilidade.status, 'ativa'),
    )).for('update').then((r) => r[0]);
  if (!overbooking) throw new ConflictException('Pedido deficitário não possui reserva de overbooking ativa');
  if (compararQtd(dto.quantidade, overbooking.quantidadeReservada) > 0) {
    throw new ConflictException('Quantidade acima do overbooking do pedido deficitário');
  }

  // chk_reservas_qtd_positiva exige quantidade_reservada > 0 (pedidos.schema.ts:96):
  // ao esgotar, só troca o status para 'liberada' e mantém a quantidade positiva —
  // é o padrão de PedidosService.liberarReservaReal (pedidos.service.ts:484-486) e
  // de reduzirReservaOverbooking (pedidos.service.ts:439-441).
  const saldoDoadora = subtrairQtd(doadora.quantidadeReservada, dto.quantidade);
  await tx.update(reservasDisponibilidade)
    .set(ehZero(saldoDoadora)
      ? { status: 'liberada' }
      : { quantidadeReservada: saldoDoadora })
    .where(eq(reservasDisponibilidade.id, doadora.id));

  const saldoOverbooking = subtrairQtd(overbooking.quantidadeReservada, dto.quantidade);
  await tx.update(reservasDisponibilidade)
    .set(ehZero(saldoOverbooking)
      ? { status: 'liberada' }
      : { quantidadeReservada: saldoOverbooking })
    .where(eq(reservasDisponibilidade.id, overbooking.id));

  await tx.insert(reservasDisponibilidade).values({
    disponibilidadeVirtualId: doadora.disponibilidadeVirtualId,
    pedidoVendaItemId: pendencia.pedidoVendaItemId,
    quantidadeReservada: dto.quantidade,
    tipoConsumo: doadora.tipoConsumo,
    status: 'ativa',
  });

  await this.ajustarItemPedido(tx, doadora.pedidoVendaItemId, `-${dto.quantidade}`, '0.000');
  await this.ajustarItemPedido(tx, pendencia.pedidoVendaItemId, dto.quantidade, `-${dto.quantidade}`);

  // Saldos reais da disponibilidade afetada, lidos APÓS os UPDATEs, para o payload do evento.
  // Nunca publicar saldo literal: se a leitura falhar, o método falha (RA-05/RA-06).
  const saldos = await tx.select({
    quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
    quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
  })
    .from(disponibilidadesVirtuais)
    .where(eq(disponibilidadesVirtuais.id, doadora.disponibilidadeVirtualId))
    .then((r) => r[0]);
  if (!saldos) throw new NotFoundException('Disponibilidade virtual da reserva de origem não encontrada');

  const dataOperacao = await this.dataDaOperacao(tx, pendencia.operacaoId);

  await this.auditoria.registrar(tx, {
    tabela: 'reservas_disponibilidade', registroId: doadora.id, operacao: 'UPDATE',
    modulo: 'comercial', usuarioId,
    dadosAnteriores: doadora,
    dadosNovos: { quantidadeReservada: saldoDoadora, redistribuidoPara: pendencia.pedidoVendaItemId },
  });

  return {
    quantidadeAbatida: dto.quantidade,
    abatidoPeloEfeito: false,
    detalhe: {
      reservaOrigemId: doadora.id,
      pedidoOrigemItemId: doadora.pedidoVendaItemId,
      quantidade: dto.quantidade,
      observacao: dto.observacao ?? null,
    },
    eventos: [{
      nome: EVENTOS.RESERVA_ATUALIZADA,
      payload: {
        disponibilidadeId: doadora.disponibilidadeVirtualId,
        itemComercialId: pendencia.itemComercialId,
        dataOperacao,
        quantidadeReservada: saldos.quantidadeReservada,
        quantidadeDisponivel: saldos.quantidadeDisponivel,
      },
    }] as EventoDominio[],
  };
}

/** Soma deltas (assinados) em quantidade_reservada e quantidade_overbooking do item. */
private async ajustarItemPedido(tx: Tx, itemId: string, deltaReservada: string, deltaOverbooking: string) {
  await tx.execute(sql`
    UPDATE pedidos_venda_itens
       SET quantidade_reservada   = quantidade_reservada   + ${deltaReservada}::numeric,
           quantidade_overbooking = GREATEST(0, quantidade_overbooking + ${deltaOverbooking}::numeric),
           status = CASE
             WHEN GREATEST(0, quantidade_overbooking + ${deltaOverbooking}::numeric) = 0
               THEN 'totalmente_reservado' ELSE 'overbooking_confirmado' END,
           updated_at = now()
     WHERE id = ${itemId}
  `);
}
```

> O único literal `'0.000'` do caminho 2 é o delta nulo de `quantidade_overbooking` passado a
> `ajustarItemPedido` para o pedido doador (a doadora não tinha overbooking) — valor de negócio, não
> lacuna. Nenhum `UPDATE` grava `quantidade_reservada = 0`: o CHECK `chk_reservas_qtd_positiva`
> proíbe, e o esgotamento de uma reserva é representado **apenas** por `status = 'liberada'`. Os
> saldos publicados em `ReservaAtualizadaPayload` são sempre **lidos do banco** após os `UPDATE`s —
> nenhum saldo é digitado no código nem deixado para o Worker resolver depois.

Caminho 3 (D5.17):

```ts
private async aplicarNovoPedido(tx: Tx, pendencia: Pendencia, dto: Extract<DecidirPendenciaDto, { caminho: 'novo_pedido' }>, usuarioId: string) {
  const destino = await tx.select().from(operacoes)
    .where(and(eq(operacoes.id, dto.operacaoDestinoId), isNull(operacoes.deletedAt)))
    .then((r) => r[0]);
  if (!destino) throw new NotFoundException('Operação de destino não encontrada');
  if (destino.status === 'fechada') {
    throw new ConflictException('Operação de destino está fechada');
  }
  const origem = await tx.select().from(operacoes)
    .where(eq(operacoes.id, pendencia.operacaoId)).then((r) => r[0]);
  if (!origem || destino.data <= origem.data) {
    throw new ConflictException('A operação de destino deve ser posterior à da pendência');
  }

  const compra = await tx.select({ id: comprasProgramadas.id }).from(comprasProgramadas)
    .where(and(
      eq(comprasProgramadas.id, dto.compraProgramadaId),
      eq(comprasProgramadas.operacaoId, destino.id),
      ne(comprasProgramadas.status, 'cancelada'),
      isNull(comprasProgramadas.deletedAt),
    )).then((r) => r[0]);
  if (!compra) {
    throw new ConflictException('Compra programada não pertence à operação de destino ou está cancelada');
  }

  const item = await tx.select().from(pedidosVendaItens)
    .where(eq(pedidosVendaItens.id, pendencia.pedidoVendaItemId)).for('update').then((r) => r[0]);
  if (!item) throw new NotFoundException('Item do pedido de origem não encontrado');

  const motivo = `Postergado para a operação ${destino.data} (pendência de overbooking ${pendencia.id})`;
  const novaQuantidade = subtrairQtd(item.quantidadePedida, dto.quantidade);
  if (ehZero(novaQuantidade)) {
    // chk_pedidos_itens_pedida_positiva exige quantidade_pedida > 0 (pedidos.schema.ts:64) e
    // reduzirItemSchema exige novaQuantidade positiva (dto/pedido.dto.ts:58): postergar o item
    // inteiro é REMOÇÃO. removerItemNaTx já libera todas as reservas, abate o déficit e cancela
    // a pendência (pedidos.service.ts:538-561).
    await this.pedidos.removerItemNaTx(tx, pendencia.pedidoVendaId, item.id, motivo, usuarioId);
  } else {
    await this.pedidos.reduzirItemNaTx(
      tx, pendencia.pedidoVendaId, item.id, novaQuantidade, motivo, usuarioId,
    );
  }

  // CreatePedidoDto real (dto/pedido.dto.ts:30-41): compraProgramadaId obrigatório, a operação
  // entra por dataOperacao (YYYY-MM-DD) e não por operacaoId, o item usa quantidadePedida
  // (number) e a observação do pedido é observacoesGerais.
  const novoPedido = await this.pedidos.criarNaTx(tx, {
    compraProgramadaId: compra.id,
    clienteId: pendencia.clienteId,
    dataOperacao: destino.data,
    observacoesGerais: motivo,
    itens: [{
      itemComercialId: pendencia.itemComercialId,
      quantidadePedida: Number(dto.quantidade),
    }],
  }, usuarioId, true);

  return {
    quantidadeAbatida: dto.quantidade,
    // reduzirItemNaTx/removerItemNaTx já chamaram atualizarOuCancelarPendencia: o déficit
    // desta pendência JÁ foi abatido no banco. decidir relê e não subtrai de novo.
    abatidoPeloEfeito: true,
    detalhe: {
      quantidade: dto.quantidade,
      operacaoDestinoId: destino.id,
      compraProgramadaId: compra.id,
      itemOrigemRemovido: ehZero(novaQuantidade),
      novoPedidoId: novoPedido.pedido.id,
      observacao: dto.observacao ?? null,
    },
    eventos: novoPedido.eventos,
  };
}
```

> `criarNaTx` roda com `confirmado = true`: se a operação de destino não tiver saldo, o pedido novo
> nasce em overbooking e **abre a sua própria pendência** na operação de destino (comportamento
> normal de `persistirItensPlanejados`). Isso é o efeito real da postergação, não um erro — a decisão
> do gestor é a confirmação explícita exigida por AD-05.

> Quando o item é removido por inteiro, `atualizarOuCancelarPendencia` deixa a pendência em
> `cancelada` (terminal). `decidir` respeita esse status e apenas registra a decisão em
> `decisao_json` + histórico: o resultado da postergação total é `status = 'cancelada'`, nunca
> `resolvida`. A postergação parcial mantém a pendência viva em `novo_pedido_criado` com o déficit
> já reduzido por `reduzirItemNaTx`.

**6.4** Para que o caminho 3 rode **dentro da mesma transação**, `PedidosService` expõe três
variantes `NaTx` que são exatamente o corpo interno dos métodos públicos existentes, com estas
assinaturas:

```ts
export type EventoDominio<N extends keyof PayloadPorEvento = keyof PayloadPorEvento> = /* já existe, só passa a ser exportado */

async criarNaTx(tx: Tx, dto: CreatePedidoDto, usuarioId: string, confirmado: boolean):
  Promise<{ pedido: PedidoVenda; eventos: EventoDominio[] }>;

async reduzirItemNaTx(tx: Tx, pedidoId: string, itemId: string,
  novaQuantidade: string, motivo: string, usuarioId: string): Promise<void>;

async removerItemNaTx(tx: Tx, pedidoId: string, itemId: string,
  motivo: string, usuarioId: string): Promise<void>;
```

- `criar(dto, usuarioId, confirmado)` vira
  `this.db.transaction((tx) => this.criarNaTx(tx, dto, usuarioId, confirmado))` seguido de
  `emitirEventosPosCommit(resultado.eventos)` e `return resultado.pedido` — o corpo transacional
  atual (`pedidos.service.ts:131-177`) migra inteiro para `criarNaTx`;
- `reduzirItem(pedidoId, itemId, dto, usuarioId)` vira
  `this.db.transaction((tx) => this.reduzirItemNaTx(tx, pedidoId, itemId,
  formatarQtd(dto.novaQuantidade), dto.motivo, usuarioId))`. A quantidade entra na variante `NaTx`
  já como string formatada e o motivo separado, porque `ReduzirItemDto.novaQuantidade` é `number`
  (`dto/pedido.dto.ts:57-60`) e o overbooking já trabalha com strings de 3 casas;
- `removerItem(pedidoId, itemId, dto, usuarioId)` vira
  `this.db.transaction((tx) => this.removerItemNaTx(tx, pedidoId, itemId, dto.motivo, usuarioId))`;
- `type EventoDominio` (`pedidos.service.ts:71-73`) passa a ser **exportado**, para o
  `OverbookingService` tipar `efeito.eventos` sem redeclarar o tipo.

Refatoração **sem mudança de comportamento**: os testes existentes de pedidos (`test/integration/
pedidos.e2e-spec.ts`) devem continuar verdes sem alteração — é o critério de aceite da refatoração.
Em `pedidos.module.ts`, adicionar `exports: [PedidosService]`; em `overbooking.module.ts`, adicionar
`imports: [PedidosModule]`.

**6.5** Em `overbooking.controller.ts`:

```ts
@Get(':id/cobertura')
@RequirePermissoes('PEDIDOS_LER')
async cobertura(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.cobertura(id);
}

@Get(':id/historico')
@RequirePermissoes('PEDIDOS_LER')
async historico(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.historico(id);
}
```

`historico(id)` no serviço — literal (o `detalhar` já embute histórico em `desc`, mas o endpoint
dedicado da tela é a linha do tempo em `ASC` com o nome do autor):

```ts
async historico(id: string): Promise<Array<{
  id: string;
  acao: string;
  autorNome: string | null;
  detalheJson: unknown;
  criadoEm: string;
}>> {
  // 404 se a pendência não existir (reusa a guarda de detalhar).
  await this.detalhar(id);
  const linhas = await this.db.select({
    id: pendenciasOverbookingHistorico.id,
    acao: pendenciasOverbookingHistorico.acao,
    detalheJson: pendenciasOverbookingHistorico.detalheJson,
    criadoEm: pendenciasOverbookingHistorico.criadoEm,
    autorNome: usuarios.nome,
  })
    .from(pendenciasOverbookingHistorico)
    .leftJoin(usuarios, eq(usuarios.id, pendenciasOverbookingHistorico.autorId))
    .where(eq(pendenciasOverbookingHistorico.pendenciaId, id))
    .orderBy(asc(pendenciasOverbookingHistorico.criadoEm));
  return linhas.map((l) => ({
    id: l.id,
    acao: l.acao,
    // Sem autor conhecido → null; a tela mostra "—". Não inventar nome (RA-06).
    autorNome: l.autorNome,
    detalheJson: l.detalheJson,
    criadoEm: l.criadoEm.toISOString(),
  }));
}
```

Importar `asc` de `drizzle-orm` e `usuarios` do schema (já usados noutros serviços). `ParseUUIDPipe`
nos novos `@Get(':id/…')` — o `@Get(':id')` existente continua com `@Param('id')` string; não
alterar a assinatura antiga nesta task.

**6.6** Completar o payload do `alterarStatus` existente (`overbooking.service.ts:103-108`), hoje
`{ pendenciaId, status }`, para o mesmo formato do `decidir` — `{ pendenciaId, operacaoId,
dataOperacao, status }`, com `dataOperacao` lido por `dataDaOperacao(tx, atual.operacaoId)` dentro da
transação e devolvido junto do agregado. Sem `dataOperacao` o handler da Task 2.5 publicaria em
`operacao:undefined`. O comportamento de negócio de `alterarStatus` não muda.

**6.7** Testes: `test/integration/overbooking-decisao.e2e-spec.ts`, casos 2.1 a 2.14 do mapa DoD.
Autenticação por **cookie** (`loginCookies` + `.set('Cookie', …)`), como no restante da suíte — não
há token bruto nos helpers.

Antes dos casos novos, ajustar o **teste existente** que esta task quebra:
`test/unit/overbooking-branches.spec.ts:164-192` ("decidir emite evento de resolvida") chama
`decidir('p1', { status: 'resolvida', detalhe: { ok: true } }, 'user-1')`, que é a assinatura do
`decidir` **alias** substituído em 6.3. Reescrever o caso para o DTO discriminado
(`{ caminho: 'compra_complementar', compraProgramadaId, quantidade }`) e estender o fake de `db`
com as leituras que os novos caminhos fazem. Sem isso a Task 6 entrega o CI vermelho.

Asserts centrais:

```ts
it('redistribuição preserva o agregado', async () => {
  const antes = await lerDisponibilidade(app, tzId);
  await request(app.getHttpServer())
    .post(`/comercial/overbooking/${pendenciaId}/decisao`)
    .set('Cookie', gestorCookies)
    .send({ caminho: 'redistribuicao', reservaOrigemId, quantidade: '4.000' })
    .expect(201);

  const depois = await lerDisponibilidade(app, tzId);
  expect(depois.quantidadeReservada).toBe(antes.quantidadeReservada);
  expect(depois.quantidadeDisponivel).toBe(antes.quantidadeDisponivel);

  const pendencia = await lerPendencia(app, pendenciaId);
  expect(pendencia.quantidadeDeficit).toBe('2.000');
  expect(pendencia.status).toBe('redistribuicao_decidida');
});

it('postergação parcial gera novo pedido e abate o déficit uma única vez', async () => {
  // item de 10, déficit 6 → posterga 4: sobra item de 6 na origem e déficit 2 na pendência
  const { body } = await request(app.getHttpServer())
    .post(`/comercial/overbooking/${pendenciaId}/decisao`)
    .set('Cookie', gestorCookies)
    .send({
      caminho: 'novo_pedido', quantidade: '4.000',
      operacaoDestinoId: proximaOperacaoId, compraProgramadaId: compraDestinoId,
    })
    .expect(201);

  expect(body.status).toBe('novo_pedido_criado');
  expect(body.quantidadeDeficit).toBe('2.000'); // 6 − 4, e NÃO 6 − 4 − 4
  expect(body.decisaoJson.novoPedidoId).toEqual(expect.any(String));
  const novo = await lerPedido(app, body.decisaoJson.novoPedidoId);
  expect(novo.operacaoId).toBe(proximaOperacaoId);
  expect(novo.itens[0].quantidadePedida).toBe('4.000');
});

it('postergação total remove o item de origem e encerra a pendência', async () => {
  // item de 6 inteiramente em overbooking → posterga 6: reduzirItem seria inválido
  const { body } = await request(app.getHttpServer())
    .post(`/comercial/overbooking/${pendenciaId}/decisao`)
    .set('Cookie', gestorCookies)
    .send({
      caminho: 'novo_pedido', quantidade: '6.000',
      operacaoDestinoId: proximaOperacaoId, compraProgramadaId: compraDestinoId,
    })
    .expect(201);

  expect(body.status).toBe('cancelada'); // terminal gravado por removerItemNaTx
  expect(body.decisaoJson.itemOrigemRemovido).toBe(true);
  const origem = await lerPedido(app, pedidoOrigemId);
  expect(origem.itens).toHaveLength(0); // soft delete
  const novo = await lerPedido(app, body.decisaoJson.novoPedidoId);
  expect(novo.itens[0].quantidadePedida).toBe('6.000');
});
```

Fixture mínima dos dois casos: a operação de destino precisa existir com uma compra programada não
cancelada (`compraDestinoId`), porque `pedidos_venda.compra_programada_id` é `NOT NULL`.

**Verificação:** `cd app/backend && npm run test -- overbooking-decisao pedidos`.

**Commit:** `feat(onda5): fontes de cobertura e 3 caminhos de decisão com efeito real no overbooking`

---

### Task 7 — Backend: módulo `gestao/aprovacoes` (fila unificada + comparativo imutável)

**Objetivo:** DoD 3 (D5.19–D5.22).

**7.1** `dto/aprovacoes.dto.ts`:

```ts
export const listarAprovacoesSchema = z.object({
  operacaoId: z.string().uuid(),
  aba: z.enum(['ocorrencias', 'operacionais']).default('ocorrencias'),
  status: z.string().trim().optional(),
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const abrirAprovacaoSchema = z.object({
  operacaoId: z.string().uuid(),
  tipo: z.enum([
    'divergencia_transformacao', 'estorno_fora_regra',
    'reabertura_carga_pedido', 'ajuste_estoque_relevante',
  ]),
  origem: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(10).max(1000),
  impacto: z.string().trim().min(5).max(1000),
  referenciaTabela: z.string().trim().max(63).optional(),
  referenciaId: z.string().uuid().optional(),
});

export const decidirAprovacaoSchema = z.object({
  decisao: z.enum(['aprovada', 'rejeitada']),
  motivo: z.string().trim().min(10).max(1000),
});
```

**7.2** `aprovacoes.service.ts` — fila unificada, abertura e decisão:

```ts
@Injectable()
export class AprovacoesService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ocorrencias: OcorrenciaFornecedorService,
  ) {}

  private get db() { return this.drizzle.db; }

  async listar(query: ListarAprovacoesDto) {
    return query.aba === 'ocorrencias'
      ? this.listarOcorrencias(query)
      : this.listarOperacionais(query);
  }

  private async listarOperacionais(query: ListarAprovacoesDto) {
    const filtros = [
      eq(aprovacoesOperacionais.operacaoId, query.operacaoId),
      isNull(aprovacoesOperacionais.deletedAt),
    ];
    if (query.status) filtros.push(eq(aprovacoesOperacionais.status, query.status));
    if (query.busca) {
      filtros.push(sql`(${aprovacoesOperacionais.descricao} ILIKE ${'%' + query.busca + '%'}
                     OR ${aprovacoesOperacionais.origem} ILIKE ${'%' + query.busca + '%'})`);
    }
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: aprovacoesOperacionais.id,
        tipo: aprovacoesOperacionais.tipo,
        origem: aprovacoesOperacionais.origem,
        descricao: aprovacoesOperacionais.descricao,
        impacto: aprovacoesOperacionais.impacto,
        status: aprovacoesOperacionais.status,
        solicitadoEm: aprovacoesOperacionais.solicitadoEm,
        solicitanteNome: usuarios.nome,
        decisaoMotivo: aprovacoesOperacionais.decisaoMotivo,
        decididoEm: aprovacoesOperacionais.decididoEm,
      })
        .from(aprovacoesOperacionais)
        .leftJoin(usuarios, eq(usuarios.id, aprovacoesOperacionais.solicitanteId))
        .where(where)
        .orderBy(desc(aprovacoesOperacionais.solicitadoEm))
        .limit(query.limite).offset((query.pagina - 1) * query.limite),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(aprovacoesOperacionais).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0,
      { page: query.pagina, pageSize: query.limite });
  }

  async abrir(dto: AbrirAprovacaoDto, usuarioId: string) {
    const { aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const aprovacao = await this.abrirNaTx(tx, dto, usuarioId);
      return { aprovacao, dataOperacao: await this.dataDaOperacao(tx, aprovacao.operacaoId) };
    });
    this.eventEmitter.emit(EVENTOS.APROVACAO_REGISTRADA, {
      aprovacaoId: aprovacao.id, operacaoId: aprovacao.operacaoId, dataOperacao,
      tipo: aprovacao.tipo, status: aprovacao.status,
    });
    return aprovacao;
  }

  /** Data da Operação — obrigatória no payload: é a room do broadcast (roomsDaData). */
  private async dataDaOperacao(tx: Tx, operacaoId: string): Promise<string> {
    const linha = await tx.select({ data: operacoes.data }).from(operacoes)
      .where(eq(operacoes.id, operacaoId)).then((r) => r[0]);
    if (!linha) throw new NotFoundException('Operação da solicitação não encontrada');
    return linha.data;
  }

  /** Usado pelas ondas 7–10 para abrir a solicitação dentro da própria transação. */
  async abrirNaTx(tx: Tx, dto: AbrirAprovacaoDto, usuarioId: string) {
    const [aprovacao] = await tx.insert(aprovacoesOperacionais).values({
      operacaoId: dto.operacaoId, tipo: dto.tipo, origem: dto.origem,
      descricao: dto.descricao, impacto: dto.impacto,
      referenciaTabela: dto.referenciaTabela ?? null,
      referenciaId: dto.referenciaId ?? null,
      solicitanteId: usuarioId,
    }).returning();
    if (!aprovacao) throw new Error('Falha ao registrar solicitação de aprovação');
    await this.auditoria.registrar(tx, {
      tabela: 'aprovacoes_operacionais', registroId: aprovacao.id, operacao: 'INSERT',
      modulo: 'gestao', usuarioId, dadosAnteriores: {}, dadosNovos: aprovacao,
    });
    return aprovacao;
  }

  async decidir(id: string, dto: DecidirAprovacaoDto, usuarioId: string) {
    const { aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const atual = await tx.select().from(aprovacoesOperacionais)
        .where(and(eq(aprovacoesOperacionais.id, id), isNull(aprovacoesOperacionais.deletedAt)))
        .for('update').then((r) => r[0]);
      if (!atual) throw new NotFoundException('Solicitação de aprovação não encontrada');
      if (atual.status !== 'pendente') {
        throw new ConflictException({
          codigo: 'APROVACAO_JA_DECIDIDA',
          mensagem: `Solicitação já ${atual.status}`,
        });
      }
      const [decidida] = await tx.update(aprovacoesOperacionais).set({
        status: dto.decisao, decisaoMotivo: dto.motivo,
        decididoPorId: usuarioId, decididoEm: new Date(), updatedAt: new Date(),
      }).where(eq(aprovacoesOperacionais.id, id)).returning();
      if (!decidida) throw new Error('Falha ao registrar decisão');
      await this.auditoria.registrar(tx, {
        tabela: 'aprovacoes_operacionais', registroId: id, operacao: 'UPDATE',
        modulo: 'gestao', usuarioId, dadosAnteriores: atual, dadosNovos: decidida,
      });
      return {
        aprovacao: decidida,
        dataOperacao: await this.dataDaOperacao(tx, decidida.operacaoId),
      };
    });
    this.eventEmitter.emit(EVENTOS.APROVACAO_DECIDIDA, {
      aprovacaoId: aprovacao.id, operacaoId: aprovacao.operacaoId, dataOperacao,
      tipo: aprovacao.tipo, status: aprovacao.status,
    });
    return aprovacao;
  }

  /**
   * Aba "ocorrências" da fila unificada (D5.19 / protótipo Aprovacoes.tsx:30-43).
   * Caminho até a Operação: compra_programada.operacao_id OU divergencia/NF/conclusão →
   * recebimentos.operacao_id. Colunas reais: notas_fiscais_fornecedor.chave (não chave_acesso);
   * lote = coalesce(recebimentos.romaneio, recebimentos.nota_fiscal_fornecedor) — não existe
   * numero_lote; fornecedor = razao_social (não há nome_fantasia em fornecedores).
   */
  private async listarOcorrencias(query: ListarAprovacoesDto) {
    const daOperacao = sql`(
      EXISTS (
        SELECT 1 FROM compras_programadas cp
         WHERE cp.id = ${ocorrenciasFornecedor.compraProgramadaId}
           AND cp.operacao_id = ${query.operacaoId}
           AND cp.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM divergencias_recebimento d
          JOIN recebimentos r ON r.id = d.recebimento_id
         WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM notas_fiscais_fornecedor nf
          JOIN recebimentos r ON r.id = nf.recebimento_id
         WHERE nf.id = ${ocorrenciasFornecedor.nfFornecedorId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM conclusoes_conferencia cc
          JOIN recebimentos r ON r.id = cc.recebimento_id
         WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
    )`;
    const filtros = [daOperacao];
    if (query.status) filtros.push(eq(ocorrenciasFornecedor.status, query.status));
    if (query.busca) {
      filtros.push(sql`(
        ${fornecedores.razaoSocial} ILIKE ${'%' + query.busca + '%'}
        OR ${ocorrenciasFornecedor.descricao} ILIKE ${'%' + query.busca + '%'}
      )`);
    }
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: ocorrenciasFornecedor.id,
        fornecedorNome: fornecedores.razaoSocial,
        nfChave: sql<string | null>`(
          SELECT nf.chave FROM notas_fiscais_fornecedor nf
           WHERE nf.id = ${ocorrenciasFornecedor.nfFornecedorId}
           LIMIT 1
        )`,
        pedidoLote: sql<string | null>`(
          SELECT coalesce(r.romaneio, r.nota_fiscal_fornecedor)
            FROM divergencias_recebimento d
            JOIN recebimentos r ON r.id = d.recebimento_id
           WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
           LIMIT 1
        )`,
        produtosDivergentes: sql<number>`(
          SELECT count(*)::int FROM divergencias_recebimento d
           WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
              OR d.conclusao_conferencia_id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        difQtdTotal: sql<string | null>`(
          SELECT coalesce(sum((item->>'qtdApurada')::numeric - (item->>'qtdNf')::numeric), 0)::text
            FROM conclusoes_conferencia cc,
                 jsonb_array_elements(cc.quadro_json) AS item
           WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        difPesoTotal: sql<string | null>`(
          SELECT coalesce(sum(
            CASE
              WHEN (item->>'pesoApurado') IS NULL OR (item->>'pesoNf') IS NULL THEN 0
              ELSE (item->>'pesoApurado')::numeric - (item->>'pesoNf')::numeric
            END
          ), 0)::text
            FROM conclusoes_conferencia cc,
                 jsonb_array_elements(cc.quadro_json) AS item
           WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        responsavelNome: usuarios.nome,
        status: ocorrenciasFornecedor.status,
        dataAbertura: ocorrenciasFornecedor.dataHoraAbertura,
      })
        .from(ocorrenciasFornecedor)
        .innerJoin(fornecedores, eq(fornecedores.id, ocorrenciasFornecedor.fornecedorId))
        .leftJoin(usuarios, eq(usuarios.id, ocorrenciasFornecedor.usuarioAberturaId))
        .where(where)
        .orderBy(desc(ocorrenciasFornecedor.dataHoraAbertura))
        .limit(query.limite).offset((query.pagina - 1) * query.limite),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(ocorrenciasFornecedor)
        .innerJoin(fornecedores, eq(fornecedores.id, ocorrenciasFornecedor.fornecedorId))
        .where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0,
      { page: query.pagina, pageSize: query.limite });
  }
}
```

**7.3** `comparativo.service.ts` (D5.20):

```ts
@Injectable()
export class ComparativoService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}

  private get db() { return this.drizzle.db; }

  async doOcorrencia(ocorrenciaId: string) {
    const ocorrencia = await this.db.select().from(ocorrenciasFornecedor)
      .where(and(eq(ocorrenciasFornecedor.id, ocorrenciaId), isNull(ocorrenciasFornecedor.deletedAt)))
      .then((r) => r[0]);
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');
    if (!ocorrencia.conclusaoConferenciaId) {
      throw new NotFoundException({
        codigo: 'CONCLUSAO_INEXISTENTE',
        mensagem: 'Ocorrência sem conferência tripla concluída; não há comparativo histórico.',
      });
    }

    const conclusao = await this.db.select({
      id: conclusoesConferencia.id,
      quadroJson: conclusoesConferencia.quadroJson,
      resultado: conclusoesConferencia.resultado,
      concluidaEm: conclusoesConferencia.concluidaEm,
      concluidaPorNome: usuarios.nome,
    })
      .from(conclusoesConferencia)
      .leftJoin(usuarios, eq(usuarios.id, conclusoesConferencia.concluidaPorId))
      .where(eq(conclusoesConferencia.id, ocorrencia.conclusaoConferenciaId))
      .then((r) => r[0]);
    if (!conclusao) throw new NotFoundException('Conclusão de conferência não encontrada');

    const itens = conclusao.quadroJson as QuadroItem[];
    const catalogo = await this.db.select({
      id: itensComerciais.id, codigo: itensComerciais.codigo, descricao: itensComerciais.descricao,
    }).from(itensComerciais)
      .where(inArray(itensComerciais.id, itens.map((i) => i.itemComercialId)));

    return {
      conclusaoId: conclusao.id,
      imutavel: true,
      resultado: conclusao.resultado,
      concluidaEm: conclusao.concluidaEm.toISOString(),
      concluidaPorNome: conclusao.concluidaPorNome ?? null,
      itens: itens.map((i) => {
        const produto = catalogo.find((c) => c.id === i.itemComercialId) ?? null;
        return {
          itemComercialId: i.itemComercialId,
          codigo: produto?.codigo ?? null,
          descricao: produto?.descricao ?? null,
          qtdPedido: i.qtdPedido,
          qtdNf: i.qtdNf,
          qtdApurada: i.qtdApurada,
          pesoNf: i.pesoNf,
          pesoApurado: i.pesoApurado,
          difQtd: subtrairQtd(i.qtdApurada, i.qtdNf),
          difPeso: i.pesoNf !== null && i.pesoApurado !== null
            ? subtrairQtd(i.pesoApurado, i.pesoNf) : null,
          situacao: i.situacao,
        };
      }),
    };
  }
}
```

As diferenças (`difQtd`, `difPeso`) são **derivadas na leitura** a partir do snapshot — não são
gravadas nem recalculadas contra o estado atual do recebimento (v1.1 §6.10.7). `codigo`/`descricao`
nulos quando o item foi removido do catálogo: mostra-se o id, nunca um nome inventado.

**7.4** `aprovacoes.controller.ts`:

```ts
@Controller('gestao/aprovacoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AprovacoesController {
  constructor(
    private readonly service: AprovacoesService,
    private readonly comparativo: ComparativoService,
  ) {}

  @Get()
  @RequirePermissoes('APROVACOES_LER')
  listar(@Query(new ZodValidationPipe(listarAprovacoesSchema)) query: ListarAprovacoesDto) {
    return this.service.listar(query);
  }

  @Get('ocorrencias/:id/comparativo')
  @RequirePermissoes('APROVACOES_LER')
  comparativoDaOcorrencia(@Param('id', ParseUUIDPipe) id: string) {
    return this.comparativo.doOcorrencia(id);
  }

  @Post('operacionais')
  @RequirePermissoes('APROVACOES_SOLICITAR')
  abrir(
    @Body(new ZodValidationPipe(abrirAprovacaoSchema)) dto: AbrirAprovacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.abrir(dto, user.sub);
  }

  @Post('operacionais/:id/decidir')
  @RequirePermissoes('APROVACOES_DECIDIR')
  decidir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decidirAprovacaoSchema)) dto: DecidirAprovacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.decidir(id, dto, user.sub);
  }
}
```

**7.5** `aprovacoes.module.ts` — literal. `RecebimentoModule` já exporta `OcorrenciaFornecedorService`
(`recebimento.module.ts:12-13,26-33`):

```ts
import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../../common/auditoria/auditoria.module';
import { DatabaseModule } from '../../../database/database.module';
import { RecebimentoModule } from '../../operacao/recebimento/recebimento.module';
import { AprovacoesController } from './aprovacoes.controller';
import { AprovacoesService } from './aprovacoes.service';
import { ComparativoService } from './comparativo.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule, RecebimentoModule],
  controllers: [AprovacoesController],
  providers: [AprovacoesService, ComparativoService],
  exports: [AprovacoesService],
})
export class AprovacoesModule {}
```

Registrar em `app.module.ts` junto de `SifModule` (Task 8.4):
`imports: […, AprovacoesModule, SifModule]`.

**7.6** Testes: `test/unit/aprovacoes-regras.spec.ts` (derivação de `difQtd`/`difPeso` e validação de
motivo) e `test/integration/aprovacoes.e2e-spec.ts` (casos 3.3 a 3.8 e 5.6 do mapa DoD).

**Verificação:** `cd app/backend && npm run test -- aprovacoes`.

**Commit:** `feat(onda5): fila unificada de aprovações e comparativo Pedido × NF × Pesagem imutável`

---

### Task 8 — Backend: módulo `sif` (catálogo, pendências, geração, versões, retificação)

**Objetivo:** DoD 4 (D5.23–D5.26).

**8.1** `catalogo-sif.ts`:

```ts
export type TipoRelatorioSif =
  | 'mapa_recebimento' | 'producao_desossa' | 'controle_expedicao' | 'perdas_destinacao';

export interface DefinicaoRelatorioSif {
  tipo: TipoRelatorioSif;
  codigo: string;
  nome: string;
  perfilResponsavel: string;
}

/**
 * Catálogo provisório (P8 / v1.1 §16.10): os modelos oficiais do SIF ainda não
 * foram entregues pelo cliente. Nomes e escopo saem do protótipo
 * (RelatoriosSIF.tsx:39-84) e são substituíveis por parâmetro sem redesenho.
 */
export const CATALOGO_SIF: readonly DefinicaoRelatorioSif[] = [
  { tipo: 'mapa_recebimento',  codigo: 'SIF-01', nome: 'Mapa de recebimento diário (provisório)',      perfilResponsavel: 'recebimento_pesagem' },
  { tipo: 'producao_desossa',  codigo: 'SIF-02', nome: 'Relatório de produção/desossa (provisório)',   perfilResponsavel: 'corte' },
  { tipo: 'controle_expedicao',codigo: 'SIF-03', nome: 'Controle de expedição (provisório)',           perfilResponsavel: 'expedicao' },
  { tipo: 'perdas_destinacao', codigo: 'SIF-04', nome: 'Relatório de perdas e destinação (provisório)',perfilResponsavel: 'administrador' },
] as const;

export function derivarStatus(
  pendencias: string[],
  versaoAtual: number,
  ultimoTipoGeracao: 'gerado' | 'retificado' | null,
): 'pendente_dados' | 'pronto_para_gerar' | 'gerado' | 'retificado' {
  if (pendencias.length > 0) return 'pendente_dados';
  if (versaoAtual === 0 || ultimoTipoGeracao === null) return 'pronto_para_gerar';
  return ultimoTipoGeracao;
}
```

**8.2** `sif-calculo.service.ts` — pendências (D5.24) e conteúdo da versão (D5.26).

Regra de leitura obrigatória deste código: `pecas`, `transformacoes`, `notas_fiscais_fornecedor` e
`divergencias_recebimento` **não têm `operacao_id`** — todo filtro por Operação passa por
`recebimentos.operacao_id`, e `transformacoes` precisa de **dois saltos**
(`transformacoes → pecas → recebimentos`). A coluna da chave da NF do fornecedor é `chave`.

```ts
@Injectable()
export class SifCalculoService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}

  private get db() { return this.drizzle.db; }

  async pendencias(operacaoId: string, tipo: TipoRelatorioSif): Promise<string[]> {
    switch (tipo) {
      case 'mapa_recebimento': {
        const linha = await this.db.execute<{ pecas_sem_destino: number; nfs_sem_chave: number }>(sql`
          SELECT
            (SELECT count(*)::int FROM pecas p
               JOIN recebimentos r ON r.id = p.recebimento_id
              WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
                AND p.status_peca = 'pesada' AND p.pedido_venda_id IS NULL) AS pecas_sem_destino,
            (SELECT count(*)::int FROM notas_fiscais_fornecedor nf
               JOIN recebimentos r ON r.id = nf.recebimento_id
              WHERE r.operacao_id = ${operacaoId} AND nf.deleted_at IS NULL
                AND (nf.chave IS NULL OR length(btrim(nf.chave)) = 0)) AS nfs_sem_chave
        `).then((r) => r.rows[0]);
        const pendencias: string[] = [];
        if ((linha?.pecas_sem_destino ?? 0) > 0) {
          pendencias.push(`${linha!.pecas_sem_destino} pesagem(ns) sem origem informada`);
        }
        if ((linha?.nfs_sem_chave ?? 0) > 0) {
          pendencias.push(`${linha!.nfs_sem_chave} NF-e sem chave completa cadastrada`);
        }
        return pendencias;
      }
      case 'producao_desossa': {
        // transformacoes não tem operacao_id: peca_origem_id → pecas → recebimentos.operacao_id.
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM transformacoes t
             JOIN pecas p ON p.id = t.peca_origem_id
             JOIN recebimentos r ON r.id = p.recebimento_id
           WHERE r.operacao_id = ${operacaoId} AND t.deleted_at IS NULL
             AND t.status_transformacao NOT IN ('concluida','cancelada')`);
        return total > 0 ? [`${total} transformação(ões) em aberto na desossa`] : [];
      }
      case 'controle_expedicao': {
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM caminhoes c
           WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
             AND c.status_caminhao IN ('planejado','aguardando_carga','em_carga','em_conferencia')`);
        return total > 0 ? [`${total} caminhão(ões) com carga não fechada`] : [];
      }
      case 'perdas_destinacao': {
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM divergencias_recebimento d
             JOIN recebimentos r ON r.id = d.recebimento_id
           WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida'`);
        return total > 0 ? [`${total} divergência(s) de recebimento em aberto`] : [];
      }
    }
  }

  private async contar(consulta: SQL): Promise<number> {
    const linha = await this.db.execute<{ total: number }>(consulta).then((r) => r.rows[0]);
    return linha?.total ?? 0;
  }

  /** Snapshot dos números apurados no instante da geração. Layout oficial pendente (P8). */
  async conteudo(operacaoId: string, tipo: TipoRelatorioSif): Promise<Record<string, unknown>> {
    const operacao = await this.db.select().from(operacoes)
      .where(eq(operacoes.id, operacaoId)).then((r) => r[0]);
    if (!operacao) throw new NotFoundException('Operação não encontrada');

    const numeros = await this.db.execute<Record<string, string>>(sql`
      SELECT
        (SELECT count(*)::int FROM recebimentos r
          WHERE r.operacao_id = ${operacaoId} AND r.deleted_at IS NULL)::text AS recebimentos,
        (SELECT coalesce(sum(p.peso_original), 0)::text FROM pecas p
           JOIN recebimentos r ON r.id = p.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL) AS peso_recebido,
        (SELECT count(*)::int FROM transformacoes t
           JOIN pecas p2 ON p2.id = t.peca_origem_id
           JOIN recebimentos r2 ON r2.id = p2.recebimento_id
          WHERE r2.operacao_id = ${operacaoId} AND t.deleted_at IS NULL
            AND t.status_transformacao = 'concluida')::text AS transformacoes_concluidas,
        (SELECT count(*)::int FROM caminhoes c
          WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
            AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido'))::text AS caminhoes_fechados,
        (SELECT count(*)::int FROM divergencias_recebimento d
           JOIN recebimentos r ON r.id = d.recebimento_id
          WHERE r.operacao_id = ${operacaoId})::text AS divergencias
    `).then((r) => r.rows[0] ?? {});

    return {
      versaoLayout: 'provisorio-p8',
      operacao: { id: operacao.id, data: operacao.data, rotulo: operacao.rotulo },
      tipo,
      apuradoEm: new Date().toISOString(),
      numeros,
    };
  }
}
```

**8.3** `sif.service.ts`:

```ts
@Injectable()
export class SifService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly calculo: SifCalculoService,
  ) {}

  private get db() { return this.drizzle.db; }

  /** Idempotente: garante as 4 linhas da operação e atualiza pendências/status. */
  async listar(operacaoId: string) {
    await this.db.transaction(async (tx) => {
      for (const def of CATALOGO_SIF) {
        await tx.insert(relatoriosSif).values({
          operacaoId, tipo: def.tipo, codigo: def.codigo,
          nome: def.nome, perfilResponsavel: def.perfilResponsavel,
        }).onConflictDoNothing();
      }
    });

    const linhas = await this.db.select().from(relatoriosSif)
      .where(and(eq(relatoriosSif.operacaoId, operacaoId), isNull(relatoriosSif.deletedAt)))
      .orderBy(asc(relatoriosSif.codigo));

    const resultado = [];
    for (const relatorio of linhas) {
      const pendencias = await this.calculo.pendencias(operacaoId, relatorio.tipo as TipoRelatorioSif);
      const ultima = await this.ultimaVersao(relatorio.id);
      const status = derivarStatus(pendencias, relatorio.versaoAtual, ultima?.tipoGeracao ?? null);
      if (status !== relatorio.status
          || JSON.stringify(pendencias) !== JSON.stringify(relatorio.pendenciasJson)) {
        await this.db.update(relatoriosSif)
          .set({ status, pendenciasJson: pendencias, updatedAt: new Date() })
          .where(eq(relatoriosSif.id, relatorio.id));
      }
      resultado.push({ ...relatorio, status, pendenciasJson: pendencias, ultimaVersao: ultima });
    }
    return resultado;
  }

  async gerar(id: string, usuarioId: string) {
    return this.novaVersao(id, usuarioId, 'gerado', null);
  }

  async retificar(id: string, usuarioId: string, motivo: string) {
    return this.novaVersao(id, usuarioId, 'retificado', motivo);
  }

  private async novaVersao(
    id: string, usuarioId: string,
    tipoGeracao: 'gerado' | 'retificado', motivo: string | null,
  ) {
    const resultado = await this.db.transaction(async (tx) => {
      const relatorio = await tx.select().from(relatoriosSif)
        .where(and(eq(relatoriosSif.id, id), isNull(relatoriosSif.deletedAt)))
        .for('update').then((r) => r[0]);
      if (!relatorio) throw new NotFoundException('Relatório SIF não encontrado');

      const pendencias = await this.calculo.pendencias(
        relatorio.operacaoId, relatorio.tipo as TipoRelatorioSif,
      );
      if (pendencias.length > 0) {
        throw new ConflictException({
          codigo: 'RELATORIO_COM_PENDENCIAS',
          mensagem: 'Resolva as pendências de dados antes de gerar',
          pendencias,
        });
      }
      if (tipoGeracao === 'retificado' && relatorio.versaoAtual < 1) {
        throw new ConflictException({
          codigo: 'SEM_VERSAO_PARA_RETIFICAR',
          mensagem: 'Não há versão gerada para retificar',
        });
      }

      const conteudo = await this.calculo.conteudo(
        relatorio.operacaoId, relatorio.tipo as TipoRelatorioSif,
      );
      const versao = relatorio.versaoAtual + 1;
      const [linha] = await tx.insert(relatoriosSifVersoes).values({
        relatorioId: relatorio.id, versao, tipoGeracao,
        motivoRetificacao: motivo, conteudoJson: conteudo, geradoPorId: usuarioId,
      }).returning();
      if (!linha) throw new Error('Falha ao gravar versão do relatório SIF');

      const [atualizado] = await tx.update(relatoriosSif).set({
        versaoAtual: versao, status: tipoGeracao, pendenciasJson: [], updatedAt: new Date(),
      }).where(eq(relatoriosSif.id, relatorio.id)).returning();
      if (!atualizado) throw new Error('Falha ao atualizar relatório SIF');

      await this.auditoria.registrar(tx, {
        tabela: 'relatorios_sif', registroId: relatorio.id, operacao: 'UPDATE',
        modulo: 'gestao', usuarioId, dadosAnteriores: relatorio, dadosNovos: atualizado,
      });

      // dataOperacao é a room do broadcast (roomsDaData) — sem ela o evento não chega ao browser.
      const operacao = await tx.select({ data: operacoes.data }).from(operacoes)
        .where(eq(operacoes.id, relatorio.operacaoId)).then((r) => r[0]);
      if (!operacao) throw new NotFoundException('Operação do relatório não encontrada');

      return { relatorio: atualizado, versao: linha, dataOperacao: operacao.data };
    });

    this.eventEmitter.emit(EVENTOS.RELATORIO_SIF_GERADO, {
      relatorioId: resultado.relatorio.id,
      operacaoId: resultado.relatorio.operacaoId,
      dataOperacao: resultado.dataOperacao,
      versao: resultado.versao.versao,
      tipoGeracao,
    });
    return resultado;
  }

  async versoes(id: string) {
    return this.db.select({
      id: relatoriosSifVersoes.id,
      versao: relatoriosSifVersoes.versao,
      tipoGeracao: relatoriosSifVersoes.tipoGeracao,
      motivoRetificacao: relatoriosSifVersoes.motivoRetificacao,
      geradoEm: relatoriosSifVersoes.geradoEm,
      geradoPorNome: usuarios.nome,
    })
      .from(relatoriosSifVersoes)
      .leftJoin(usuarios, eq(usuarios.id, relatoriosSifVersoes.geradoPorId))
      .where(eq(relatoriosSifVersoes.relatorioId, id))
      .orderBy(asc(relatoriosSifVersoes.versao));
  }

  async preview(id: string) {
    const ultima = await this.ultimaVersao(id);
    if (!ultima) {
      throw new NotFoundException({
        codigo: 'SEM_VERSAO_GERADA',
        mensagem: 'Nenhuma versão gerada ainda para este relatório.',
      });
    }
    return ultima;
  }

  private async ultimaVersao(relatorioId: string) {
    return this.db.select().from(relatoriosSifVersoes)
      .where(eq(relatoriosSifVersoes.relatorioId, relatorioId))
      .orderBy(desc(relatoriosSifVersoes.versao)).limit(1).then((r) => r[0] ?? null);
  }
}
```

**8.4** `dto/sif.dto.ts`, `sif.controller.ts` e `sif.module.ts` — literais:

```ts
// dto/sif.dto.ts
import { z } from 'zod';

export const listarSifSchema = z.object({
  operacaoId: z.string().uuid(),
});
export type ListarSifDto = z.infer<typeof listarSifSchema>;

export const retificarSifSchema = z.object({
  motivo: z.string().trim().min(10).max(1000),
});
export type RetificarSifDto = z.infer<typeof retificarSifSchema>;
```

```ts
// sif.controller.ts
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import {
  listarSifSchema, retificarSifSchema,
  type ListarSifDto, type RetificarSifDto,
} from './dto/sif.dto';
import { SifService } from './sif.service';

@Controller('sif/relatorios')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SifController {
  constructor(private readonly service: SifService) {}

  @Get()
  @RequirePermissoes('SIF_LER')
  listar(@Query(new ZodValidationPipe(listarSifSchema)) query: ListarSifDto) {
    return this.service.listar(query.operacaoId);
  }

  @Get(':id/versoes')
  @RequirePermissoes('SIF_LER')
  versoes(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.versoes(id);
  }

  @Get(':id/preview')
  @RequirePermissoes('SIF_LER')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.preview(id);
  }

  @Post(':id/gerar')
  @RequirePermissoes('SIF_GERAR')
  gerar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.gerar(id, user.sub);
  }

  @Post(':id/retificar')
  @RequirePermissoes('SIF_GERAR')
  retificar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(retificarSifSchema)) dto: RetificarSifDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.retificar(id, user.sub, dto.motivo);
  }
}
```

```ts
// sif.module.ts
import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { DatabaseModule } from '../../database/database.module';
import { SifCalculoService } from './sif-calculo.service';
import { SifController } from './sif.controller';
import { SifService } from './sif.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [SifController],
  providers: [SifService, SifCalculoService],
  exports: [SifService],
})
export class SifModule {}
```

Registrar `SifModule` (e `AprovacoesModule` da Task 7.5) em `app.module.ts`.

**8.5** Testes: `test/unit/catalogo-sif.spec.ts` (derivação de status, 4 tipos, códigos) e
`test/integration/sif.e2e-spec.ts` (casos 4.1 a 4.9, 4.12 e 5.6). O caso 4.12 é obrigatório e prova o
join de dois saltos: semear duas operações, cada uma com um recebimento e uma peça, criar uma
`transformacoes` em aberto **apenas** na operação B e assertar que `GET /sif/relatorios?operacaoId=A`
devolve `producao_desossa` com `status='pronto_para_gerar'` e `pendenciasJson: []`, enquanto a
operação B devolve `pendente_dados`. Se o SQL usasse `transformacoes.operacao_id`, o teste falharia
com erro de coluna inexistente.

**Verificação:** `cd app/backend && npm run test -- catalogo-sif sif`.

**Commit:** `feat(onda5): módulo SIF com catálogo por operação, versionamento e retificação (P8)`

---

### Task 9 — Backend: dashboard por Operação com os 10 KPIs, alertas e atividades

**Objetivo:** critérios 5.1 a 5.3 (D5.3).

**9.1** Novo contrato em `dashboard.service.ts` (substitui `DashboardDia`):

```ts
export interface KpiDashboard {
  chave: string;
  valor: string;
  detalhe: string;
}

export interface AlertaOperacional {
  chave: 'overbooking_aberto' | 'divergencia_recebimento' | 'tz_aguardando_desossa' | 'seguro_pendente';
  titulo: string;
  descricao: string;
  severidade: 'critico' | 'atencao' | 'informativo';
  ocorridoEm: string;
}

export interface DashboardOperacao {
  operacao: { id: string; data: string; rotulo: string; status: string; extraordinaria: boolean };
  kpis: KpiDashboard[];              // 10 itens, na ordem do protótipo
  pedidosEmAndamento: PedidoEmAndamento[];
  alertas: AlertaOperacional[];
  atividadesRecentes: AtividadeRecente[];
}
```

**9.2** `resumo(operacaoId?: string)` resolve a operação (`OperacoesService.resolverCorrente()`
quando ausente) e monta os 10 KPIs **na ordem do protótipo** (`Dashboard.tsx:12-24`):

| Ordem | `chave` | Fonte | Chegada à Operação |
|---|---|---|---|
| 1 | `compras_programadas` | `count(compras_programadas)` da operação, não canceladas | `operacao_id` direto |
| 2 | `disponibilidade_total` | `sum(quantidade_disponivel)` de `disponibilidades_virtuais` da operação | via `compras_programadas.operacao_id` |
| 3 | `reservas_em_elaboracao` | `count(distinct pedidos_venda)` com `status IN ('rascunho','em_elaboracao_reserva_ativa')` e reserva ativa — o default da tabela é `em_elaboracao_reserva_ativa` (`pedidos.schema.ts:23,33-36`), contar só `rascunho` daria zero permanente | `operacao_id` direto |
| 4 | `pedidos_finalizados` | `count(pedidos_venda)` com `status='finalizado'` | `operacao_id` direto |
| 5 | `overbookings_abertos` | `count(pendencias_overbooking)` com `status IN ('aberta','em_analise')` | `operacao_id` direto |
| 6 | `recebimentos_aguardados` | `count(recebimentos)` com `status IN ('pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final')` | `operacao_id` direto |
| 7 | `divergencias_abertas` | `count(divergencias_recebimento)` com `status <> 'resolvida'` | **JOIN** `recebimentos` |
| 8 | `pecas_em_desossa` | `count(pecas)` com `status_peca IN ('para_corte','em_transformacao')` | **JOIN** `recebimentos` — `pecas` **não tem** `operacao_id` |
| 9 | `relatorios_sif_pendentes` | `count(relatorios_sif)` com `status='pendente_dados'` | `operacao_id` direto |
| 10 | `faturamentos_pendentes` | `count(notas_fiscais)` com `status_nfse IN ('pendente','erro_emissao')` | **JOIN** `caminhoes` — `notas_fiscais` **não tem** `operacao_id` |

Todas as contagens em **uma** query com subselects (padrão já usado em Task 4), evitando N+1. Os
KPIs 7, 8 e 10 só existem com JOIN explícito; escrever `p.operacao_id` ou `nf.operacao_id` quebra em
tempo de execução com "column does not exist":

```ts
const linha = await this.db.execute<Record<string, string>>(sql`
  SELECT
    (SELECT count(*)::int FROM compras_programadas cp
      WHERE cp.operacao_id = ${operacaoId} AND cp.deleted_at IS NULL
        AND cp.status <> 'cancelada')::text AS compras_programadas,
    (SELECT coalesce(sum(dv.quantidade_disponivel), 0)::text FROM disponibilidades_virtuais dv
       JOIN compras_programadas cp2 ON cp2.id = dv.compra_programada_id
      WHERE cp2.operacao_id = ${operacaoId} AND cp2.deleted_at IS NULL) AS disponibilidade_total,
    (SELECT count(DISTINCT pv.id)::int FROM pedidos_venda pv
       JOIN pedidos_venda_itens pvi ON pvi.pedido_venda_id = pv.id AND pvi.deleted_at IS NULL
       JOIN reservas_disponibilidade rd ON rd.pedido_venda_item_id = pvi.id AND rd.status = 'ativa'
      WHERE pv.operacao_id = ${operacaoId} AND pv.deleted_at IS NULL
        AND pv.status IN ('rascunho','em_elaboracao_reserva_ativa'))::text AS reservas_em_elaboracao,
    (SELECT count(*)::int FROM pedidos_venda pv
      WHERE pv.operacao_id = ${operacaoId} AND pv.deleted_at IS NULL
        AND pv.status = 'finalizado')::text AS pedidos_finalizados,
    (SELECT count(*)::int FROM pendencias_overbooking po
      WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
        AND po.status IN ('aberta','em_analise'))::text AS overbookings_abertos,
    (SELECT count(*)::int FROM recebimentos r
      WHERE r.operacao_id = ${operacaoId} AND r.deleted_at IS NULL
        AND r.status IN ('pesagem_em_andamento','aguardando_conclusao_pesagem',
                         'aguardando_conferencia_final'))::text AS recebimentos_aguardados,
    -- divergencias_recebimento não tem operacao_id nem deleted_at
    (SELECT count(*)::int FROM divergencias_recebimento d
       JOIN recebimentos rd2 ON rd2.id = d.recebimento_id
      WHERE rd2.operacao_id = ${operacaoId}
        AND d.status <> 'resolvida')::text AS divergencias_abertas,
    -- KPI 8: pecas.recebimento_id → recebimentos.operacao_id
    (SELECT count(*)::int FROM pecas p
       JOIN recebimentos rp ON rp.id = p.recebimento_id
      WHERE rp.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
        AND p.status_peca IN ('para_corte','em_transformacao'))::text AS pecas_em_desossa,
    (SELECT count(*)::int FROM relatorios_sif rs
      WHERE rs.operacao_id = ${operacaoId} AND rs.deleted_at IS NULL
        AND rs.status = 'pendente_dados')::text AS relatorios_sif_pendentes,
    -- KPI 10: notas_fiscais.caminhao_id → caminhoes.operacao_id
    (SELECT count(*)::int FROM notas_fiscais nf
       JOIN caminhoes cam ON cam.id = nf.caminhao_id
      WHERE cam.operacao_id = ${operacaoId} AND nf.deleted_at IS NULL
        AND nf.status_nfse IN ('pendente','erro_emissao'))::text AS faturamentos_pendentes
`).then((r) => r.rows[0]);
if (!linha) throw new Error('Falha ao apurar os KPIs da operação');
```

`detalhe` reproduz o texto secundário do protótipo ("operações do dia", "saldo consolidado", …).
Os valores vão para `KpiDashboard.valor` como texto, na ordem acima; nenhum KPI é preenchido com
zero por falta de leitura (RA-06).

**9.3** Alertas (critério 5.3): os **4 alertas** do protótipo (`Dashboard.tsx:37-42` — "Overbooking em
aberto", "Divergência de recebimento", "TZ aguardando desossa", "Seguro pendente"), cada um emitido
**só** se a consulta correspondente retornar > 0. Nenhum alerta fixo, nenhum texto de exemplo, nenhum
horário sintético: `ocorridoEm` é sempre o instante do fato mais recente lido do banco (o protótipo
mostra esse horário em `alerta.time`, `Dashboard.tsx:175`).

```ts
private async montarAlertas(operacaoId: string): Promise<AlertaOperacional[]> {
  const linha = await this.db.execute<{
    overbooking: number; overbooking_deficit: string; overbooking_em: string | null;
    divergencias: number; divergencia_lote: string | null; divergencia_em: string | null;
    tz_aguardando: number; tz_em: string | null;
    seguro_pendente: number; seguro_placa: string | null; seguro_em: string | null;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM pendencias_overbooking po
        WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
          AND po.status IN ('aberta','em_analise')) AS overbooking,
      (SELECT coalesce(sum(po.quantidade_deficit), 0)::text FROM pendencias_overbooking po
        WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
          AND po.status IN ('aberta','em_analise')) AS overbooking_deficit,
      (SELECT max(po.created_at)::text FROM pendencias_overbooking po
        WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
          AND po.status IN ('aberta','em_analise')) AS overbooking_em,
      -- divergencias_recebimento não tem operacao_id nem deleted_at
      (SELECT count(*)::int FROM divergencias_recebimento d
         JOIN recebimentos r ON r.id = d.recebimento_id
        WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida') AS divergencias,
      -- recebimentos NÃO tem numero_lote: a referência real é romaneio, com a NF do
      -- fornecedor como alternativa; ambas são nullable, então pode vir NULL.
      (SELECT coalesce(r.romaneio, r.nota_fiscal_fornecedor) FROM divergencias_recebimento d
         JOIN recebimentos r ON r.id = d.recebimento_id
        WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida'
        ORDER BY d.created_at DESC LIMIT 1) AS divergencia_lote,
      (SELECT max(d.created_at)::text FROM divergencias_recebimento d
         JOIN recebimentos r ON r.id = d.recebimento_id
        WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida') AS divergencia_em,
      -- pecas não tem operacao_id: chega por recebimentos
      (SELECT count(*)::int FROM pecas p
         JOIN recebimentos r ON r.id = p.recebimento_id
        WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
          AND p.status_peca = 'para_corte') AS tz_aguardando,
      (SELECT max(p.updated_at)::text FROM pecas p
         JOIN recebimentos r ON r.id = p.recebimento_id
        WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
          AND p.status_peca = 'para_corte') AS tz_em,
      (SELECT count(*)::int FROM caminhoes c
        WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
          AND c.status_caminhao = 'faturado') AS seguro_pendente,
      (SELECT c.placa FROM caminhoes c
        WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
          AND c.status_caminhao = 'faturado'
        ORDER BY c.updated_at DESC LIMIT 1) AS seguro_placa,
      (SELECT max(c.updated_at)::text FROM caminhoes c
        WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
          AND c.status_caminhao = 'faturado') AS seguro_em
  `).then((r) => r.rows[0]);
  if (!linha) throw new Error('Falha ao apurar os alertas da operação');

  const alertas: AlertaOperacional[] = [];

  if (linha.overbooking > 0 && linha.overbooking_em) {
    alertas.push({
      chave: 'overbooking_aberto',
      titulo: 'Overbooking em aberto',
      descricao: `${linha.overbooking} pendência(s) com déficit de `
        + `${formatarQtd(linha.overbooking_deficit)} aguardando decisão.`,
      severidade: 'critico',
      ocorridoEm: linha.overbooking_em,
    });
  }

  if (linha.divergencias > 0 && linha.divergencia_em) {
    // Sem romaneio nem NF do fornecedor, o alerta sai sem a referência do lote —
    // nunca com um número inventado (RA-06).
    const lote = linha.divergencia_lote ? `Lote ${linha.divergencia_lote} — ` : '';
    alertas.push({
      chave: 'divergencia_recebimento',
      titulo: 'Divergência de recebimento',
      descricao: `${lote}${linha.divergencias} divergência(s) encaminhada(s) ao administrativo.`,
      severidade: 'atencao',
      ocorridoEm: linha.divergencia_em,
    });
  }

  if (linha.tz_aguardando > 0 && linha.tz_em) {
    alertas.push({
      chave: 'tz_aguardando_desossa',
      titulo: 'TZ aguardando desossa',
      descricao: `${linha.tz_aguardando} peça(s) disponível(is) aguardando encaminhamento à desossa.`,
      severidade: 'informativo',
      ocorridoEm: linha.tz_em,
    });
  }

  if (linha.seguro_pendente > 0 && linha.seguro_placa && linha.seguro_em) {
    alertas.push({
      chave: 'seguro_pendente',
      titulo: 'Seguro pendente',
      descricao: `Caminhão ${linha.seguro_placa} faturado aguardando averbação manual de seguro `
        + 'para liberação de saída.',
      severidade: 'informativo',
      ocorridoEm: linha.seguro_em,
    });
  }

  return alertas;
}
```

Acrescentar aos imports de `dashboard.service.ts` (hoje `dashboard.service.ts:1-6`)
`formatarQtd` de `../../../common/crud/decimal`.

> Severidade mapeia a cor do ponto no protótipo: `#FC5241` → `critico`, `#F5B019` → `atencao`,
> `#7C3AED` e `#94A3B8` → `informativo` (`Dashboard.tsx:38-41`).

> **Seguro não é campo do banco.** O parâmetro `fiscal.seguro_integrado` registra "Não (manual)"
> (`seed.ts:112-118`) e não existe coluna de seguro/averbação em `caminhoes`
> (`expedicao.schema.ts:13-36`). O único estado real que corresponde ao alerta é
> `status_caminhao = 'faturado'` — NFS-e emitidas, aguardando `liberado_saida`, cujo passo restante
> é manual (`liberacao.service.ts:80-102`). Nada de seguro é inventado: o alerta descreve o estado
> que existe (Princípio VIII).

**9.4** `dashboard.controller.ts`: query `z.object({ operacaoId: z.string().uuid().optional() })`;
remover `dataOperacao`. Guarda inalterada.

**9.5** Testes: `test/integration/dashboard-operacao.e2e-spec.ts` (5.1 a 5.3), incluindo
"sem operação cadastrada retorna 404 OPERACAO_INEXISTENTE" e "nenhum alerta quando não há fato".

**Verificação:** `cd app/backend && npm run test -- dashboard-operacao`.

**Commit:** `feat(onda5): dashboard por operação com 10 KPIs, alertas reais e atividades`

---
### Task 10 — Frontend: rotas BFF da Onda 5

**Objetivo:** expor ao browser, sob `/api`, os endpoints das tasks 4–9 **e os de ocorrências de
fornecedor consumidos pela Task 16.2**, preservando status e corpo de erro (crítico para o challenge
409 do painel de impacto).

**Restrição estrutural — proibido catch-all nesta onda.** `src/app/api/comercial/compras-programadas/`
e `src/app/api/comercial/overbooking/` já contêm o segmento dinâmico `[id]`. Criar um `[...path]`
irmão de `[id]` no mesmo nível faz o Next falhar no build com *"You cannot use different slug names
for the same dynamic path"*. Todas as rotas desta task são **explícitas**, uma por endpoint, no mesmo
padrão dos ~120 arquivos já existentes em `src/app/api/**`.

**10.1** Helper único de repasse, para não duplicar o mesmo bloco em 20 arquivos (DRY) e para
garantir que o corpo do erro chegue íntegro à tela. Arquivo novo `src/lib/bff.ts`:

```ts
import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

/**
 * Repassa a chamada ao backend preservando status e corpo — inclusive os de erro.
 * `fetchBackend` não serve aqui: ele reduz o erro a `{ message }` e descarta o
 * `impacto` do challenge 409 (D5.31) e as `pendencias` do 409 do SIF (D5.25).
 */
export async function repassar(
  caminho: string,
  init: { method?: string; body?: string } = {},
): Promise<NextResponse> {
  const resposta = await apiFetch(caminho, {
    method: init.method ?? 'GET',
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  const texto = await resposta.text();
  return new NextResponse(texto === '' ? null : texto, {
    status: resposta.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**10.2** Modelo literal de uma rota com parâmetro e query
(`src/app/api/comercial/compras-programadas/[id]/impacto/route.ts`):

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/comercial/compras-programadas/${id}/impacto${req.nextUrl.search}`);
}
```

e de uma rota com corpo (`src/app/api/sif/relatorios/[id]/retificar/route.ts`):

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/sif/relatorios/${id}/retificar`, {
    method: 'POST',
    body: await req.text(),
  });
}
```

**10.3** Rotas BFF **novas** (19 arquivos), uma por endpoint, todas com `repassar`:

| Arquivo | Verbo(s) | Endpoint do backend |
|---|---|---|
| `src/app/api/operacoes/route.ts` | GET | `/operacoes` (repassa `search`) |
| `src/app/api/operacoes/[id]/route.ts` | GET | `/operacoes/:id` |
| `src/app/api/operacoes/[id]/status/route.ts` | PATCH | `/operacoes/:id/status` |
| `src/app/api/operacoes/extraordinaria/route.ts` | POST | `/operacoes/extraordinaria` |
| `src/app/api/operacoes/gerar-cadencia/route.ts` | POST | `/operacoes/gerar-cadencia` |
| `src/app/api/comercial/compras-programadas/[id]/impacto/route.ts` | GET | `/comercial/compras-programadas/:id/impacto` |
| `src/app/api/comercial/compras-programadas/[id]/historico/route.ts` | GET | `/comercial/compras-programadas/:id/historico` |
| `src/app/api/comercial/overbooking/[id]/cobertura/route.ts` | GET | `/comercial/overbooking/:id/cobertura` |
| `src/app/api/comercial/overbooking/[id]/historico/route.ts` | GET | `/comercial/overbooking/:id/historico` |
| `src/app/api/comercial/overbooking/[id]/status/route.ts` | PATCH | `/comercial/overbooking/:id/status` |
| `src/app/api/gestao/aprovacoes/route.ts` | GET | `/gestao/aprovacoes` (repassa `search`) |
| `src/app/api/gestao/aprovacoes/ocorrencias/[id]/comparativo/route.ts` | GET | `/gestao/aprovacoes/ocorrencias/:id/comparativo` |
| `src/app/api/gestao/aprovacoes/operacionais/route.ts` | POST | `/gestao/aprovacoes/operacionais` |
| `src/app/api/gestao/aprovacoes/operacionais/[id]/decidir/route.ts` | POST | `/gestao/aprovacoes/operacionais/:id/decidir` |
| `src/app/api/sif/relatorios/route.ts` | GET | `/sif/relatorios` (repassa `search`) |
| `src/app/api/sif/relatorios/[id]/versoes/route.ts` | GET | `/sif/relatorios/:id/versoes` |
| `src/app/api/sif/relatorios/[id]/preview/route.ts` | GET | `/sif/relatorios/:id/preview` |
| `src/app/api/sif/relatorios/[id]/gerar/route.ts` | POST | `/sif/relatorios/:id/gerar` |
| `src/app/api/sif/relatorios/[id]/retificar/route.ts` | POST | `/sif/relatorios/:id/retificar` |

Em `src/app/api/operacoes/`, os segmentos estáticos `extraordinaria/` e `gerar-cadencia/` convivem
com `[id]/` sem conflito: o Next resolve o estático antes do dinâmico. O conflito proibido é só entre
**dois slugs diferentes** no mesmo nível.

**10.4** Rotas BFF de **ocorrências de fornecedor** (3 arquivos novos) — a Task 16.2 chama
`PATCH /operacao/ocorrencias-fornecedor/:id` e `POST .../:id/encerrar`, e hoje **não existe nenhuma
rota BFF** para o `OcorrenciaFornecedorController`. Sem estes arquivos a aba 1 de `/gestao/aprovacoes`
seria um 404:

| Arquivo | Verbo(s) | Endpoint do backend |
|---|---|---|
| `src/app/api/operacao/ocorrencias-fornecedor/route.ts` | GET | `/operacao/ocorrencias-fornecedor` (repassa `search`) |
| `src/app/api/operacao/ocorrencias-fornecedor/[id]/route.ts` | GET, PATCH | `/operacao/ocorrencias-fornecedor/:id` |
| `src/app/api/operacao/ocorrencias-fornecedor/[id]/encerrar/route.ts` | POST | `/operacao/ocorrencias-fornecedor/:id/encerrar` |

**10.5** Rotas BFF **alteradas** (3 arquivos existentes), todas trocando `fetchBackend` por
`repassar`, porque as três participam de fluxos com corpo de erro significativo:

| Arquivo | Motivo |
|---|---|
| `src/app/api/comercial/compras-programadas/[id]/itens/[itemId]/route.ts` | O `PATCH` é o do challenge 409: hoje usa `fetchBackend` e o `impacto` do corpo do erro é descartado, o que impede o "Salvar mesmo assim" (D5.31) |
| `src/app/api/comercial/overbooking/[id]/decisao/route.ts` | Os 409 dos 3 caminhos (quantidade acima do saldo, operação destino inválida, transição inválida) precisam chegar com código e mensagem do backend |
| `src/app/api/gestao/dashboard/route.ts` | Passa a repassar `operacaoId` e o 404 `OPERACAO_INEXISTENTE` íntegro (item 10.6) |

**10.6** `src/app/api/gestao/dashboard/route.ts` repassando `operacaoId`:

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const operacaoId = req.nextUrl.searchParams.get('operacaoId');
  const qs = operacaoId ? `?operacaoId=${encodeURIComponent(operacaoId)}` : '';
  return repassar(`/gestao/dashboard${qs}`);
}
```

**10.7** Testes:

- `__tests__/bff-onda5.test.ts` (critério 5.7): mockar `@/lib/api` e verificar, para cada rota, que o
  caminho montado é o esperado, que a query string é repassada, que um 409 do backend chega ao
  cliente com status 409 **e corpo íntegro** (assertar a presença de `impacto` no corpo do 409 de
  `PATCH .../itens/:itemId` e de `pendencias` no 409 de `POST /sif/relatorios/:id/gerar`) e que o
  `PATCH` de ocorrência e o `POST .../encerrar` batem no caminho certo (critério 5.12).
- Rodar `cd app/frontend && npm run build` ao fim da task: é o gate que provaria qualquer conflito de
  slug se alguém reintroduzisse um catch-all.

**Verificação:** `cd app/frontend && npm run test -- bff-onda5 && npm run build`.

**Commit:** `feat(onda5): rotas BFF de operações, overbooking, aprovações, SIF, compras e ocorrências`

---

### Task 11 — Frontend: componentes compartilhados da Gestão

**Objetivo:** evitar duplicação (DRY) nas 6 telas: seletor de Operação, painel de impacto e quadro
comparativo.

**11.1** `src/lib/gestao-operacoes.ts` — tipos e cliente. **O nome do arquivo não é `operacoes.ts`**:
`src/lib/operacao.ts` já existe e concentra o domínio operacional das ondas F4a–F6a (recebimento,
pesagem, corte, caminhão, conferência). Dois arquivos com nomes quase idênticos no mesmo diretório
confundiriam import e revisão; o cliente de Operação da Gestão vive em `gestao-operacoes.ts` e
`operacao.ts` não é tocado.

```ts
export interface Operacao {
  id: string;
  data: string;
  diaSemana: number;
  rotulo: string;
  status: 'aberta' | 'em_andamento' | 'fechada';
  extraordinaria: boolean;
  comprasProgramadas: number;
  pedidosVenda: number;
  pendenciasOverbookingAbertas: number;
}

export const ROTULO_STATUS_OPERACAO: Record<Operacao['status'], string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  fechada: 'Fechada',
};

export async function listarOperacoes(params: {
  status?: Operacao['status']; de?: string; ate?: string;
} = {}): Promise<Operacao[]> {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) if (valor) busca.set(chave, valor);
  const resposta = await fetch(`/api/operacoes?${busca.toString()}`);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  const corpo = await resposta.json();
  return corpo.data as Operacao[];
}
```

**11.2** `src/components/gestao/seletor-operacao.tsx` (D5.28, critério 5.10): componente cliente que
lista operações, sincroniza com `?operacaoId=` via `useRouter`/`useSearchParams`, seleciona a
primeira não fechada quando a URL não traz o parâmetro, e mostra o `rotulo` (fonte:
`data/operacoes.ts` do protótipo). Estados de carregando/erro obrigatórios (D5.29).

**11.3** `src/components/gestao/painel-impacto.tsx` (protótipo `CompraProgramada.tsx:181-330`):
recebe `ImpactoCompra` e renderiza o bloco âmbar com uma linha por item comercial
(`-N SIGLA virtuais`, e quando há déficit `Déficit resultante: N SIGLA → aparecerá como
overbooking/risco no mapa e no painel da gestão.`), mais o total. Não calcula nada — apenas exibe
(RA-01).

**11.4** `src/components/gestao/quadro-comparativo.tsx` (protótipo `Aprovacoes.tsx:374-410`): tabela
com as 8 colunas exatas — `Produto`, `Pedido: qtd.`, `NF: qtd.`, `Pesado: qtd.`, `NF: peso`,
`Peso apurado`, `Dif. qtd.`, `Dif. peso` — linha divergente destacada e o rodapé com o aviso literal
do protótipo sobre imutabilidade.

**11.5** Testes: `__tests__/seletor-operacao.test.tsx`, `__tests__/painel-impacto.test.tsx`,
`__tests__/quadro-comparativo.test.tsx` (critérios 1.11, 3.9, 5.10).

**Verificação:** `cd app/frontend && npm run test -- seletor-operacao painel-impacto quadro-comparativo`.

**Commit:** `feat(onda5): componentes compartilhados de gestão (seletor de operação, impacto, comparativo)`

---

### Task 12 — Tela `/gestao/dashboard`

**Protótipo:** `src/app/pages/Dashboard.tsx` (207 linhas).

**12.1** Atualizar `src/lib/gestao.ts` com `KpiDashboard`, `AlertaOperacional` e `DashboardOperacao`
(espelho dos tipos da Task 9) e o mapa de ícone/cor por `chave` de KPI, reproduzindo as cores do
protótipo via tokens do DS (`Dashboard.tsx:12-24`).

**12.2** Reescrever `dashboard-client.tsx` mantendo a estrutura visual do protótipo:
cabeçalho com `SeletorOperacao` → grid de KPIs linha 1 (5 cartões) → grid linha 2 (5 cartões) →
coluna esquerda "Pedidos em andamento" → coluna direita "Alertas operacionais" + "Atividades
recentes". Reaproveitar `KpiCard`, `AlertItem`, `ActivityItem` (DS v2).

**12.3** Tempo real (D5.30): assinar `conectarRealtime` e refazer o `fetch` ao receber
`pendencia_overbooking_aberta`, `pendencia_overbooking_resolvida`, `compra_programada_confirmada`,
`compra_programada_alterada_impacto`, `divergencia_recebimento_aberta`, `relatorio_sif_gerado`.

**12.4** Estados: skeleton por bloco; erro com "Tentar novamente"; lista vazia com o texto do
protótipo. Quando o backend responde 404 `OPERACAO_INEXISTENTE`, a tela mostra "Nenhuma operação
cadastrada" com link para `/gestao/operacoes` — não renderiza KPIs zerados.

**12.5** Teste `__tests__/dashboard-client.test.tsx`: renderiza 10 KPIs na ordem do protótipo; alerta
some quando a lista vem vazia; erro do backend aparece; troca de operação refaz o fetch.

**Verificação:** `cd app/frontend && npm run test -- dashboard-client`.

**Commit:** `feat(onda5): tela do painel geral da operação com 10 KPIs e alertas`

---

### Task 13 — Tela `/gestao/operacoes`

**Protótipo:** `src/app/pages/Operacoes.tsx` (212 linhas) + `src/app/data/operacoes.ts`.

**13.1** `page.tsx` **já existe** e hoje devolve `<PlaceholderPage title="Operações" />`. É um
arquivo **alterado**: passa a ser o server component que renderiza `operacoes-client.tsx`. O mesmo
vale para os `page.tsx` de `/gestao/overbooking`, `/gestao/aprovacoes` e `/gestao/relatorios` nas
Tasks 15, 16 e 17 — nenhum dos quatro é criado do zero, e o import de `PlaceholderPage` sai do
arquivo (deixá-lo geraria lint de import não usado).

**13.2** `operacoes-client.tsx`:
- cabeçalho com título "Operações", subtítulo do protótipo e `BadgeProvisorio pendencia="P1"`
  ao lado do texto de cadência;
- barra de filtro por status (Todos / Aberta / Em andamento / Fechada) idêntica ao protótipo;
- lista de cartões por operação, com `rotulo`, data, dia da semana, `StatusPill`, selo de operação
  extraordinária e os três contadores da Task 4;
- ação "Gerar cadência" (`POST /api/operacoes/gerar-cadencia`) com confirmação e feedback;
- modal "Operação Extraordinária" (`POST /api/operacoes/extraordinaria`) com data e rótulo,
  validação client-side apenas de formato; a regra é do backend;
- ação de transição de status (`PATCH /api/operacoes/:id/status`), habilitada conforme a transição
  permitida devolvida pelo backend; erro 409 exibido como mensagem, não como estado quebrado.

**13.3** Teste `__tests__/operacoes-client.test.tsx` (critério 5.4): lista, filtra, abre o modal de
extraordinária, envia e trata erro do backend; badge P1 presente.

**Verificação:** `cd app/frontend && npm run test -- operacoes-client`.

**Commit:** `feat(onda5): tela de operações com cadência, extraordinárias e transição de status`

---

### Task 14 — Tela `/gestao/compras` com painel de impacto

**Protótipo:** `src/app/pages/CompraProgramada.tsx` (791 linhas).

**14.1** `src/lib/comercial.ts`: acrescentar `ImpactoCompra`, `ItemImpacto`, `HistoricoCompraItem`
(com `usuarioNome: string | null`) e `RespostaEdicaoItem = { item: CompraProgramadaItem; impacto:
ImpactoCompra }` — espelho dos contratos da Task 5.

**14.2** Em `compras-client.tsx` (D5.31), acrescentar:
- o aviso do protótipo linha `653` acima da lista;
- botão "Editar" no cartão da compra **confirmada** que abre o modal de edição;
- no modal, ao alterar qualquer quantidade, chamar
  `GET /api/comercial/compras-programadas/:id/impacto?simulacao=...` (debounce de 300 ms) e renderizar
  `<PainelImpacto />` com a resposta;
- "Salvar alteração" → `PATCH /api/comercial/compras-programadas/:id/itens/:itemId`;
- ao receber 409 com `codigo === 'IMPACTO_CONFIRMACAO_NECESSARIA'`, exibir o `impacto` do corpo do
  erro e habilitar "Salvar mesmo assim", que repete a chamada com `confirmarDeficit: true`;
- bloco "Histórico de alterações desta compra" (`GET /:id/historico`), com data/hora, autor
  (`usuarioNome` nulo renderiza "—", nunca um nome inventado) e descrição da mudança montada a
  partir de `dadosAnteriores`/`dadosNovos`.

**14.2.1 — ajuste do caminho de salvamento que já existe.** `compras-client.tsx:164-176` já faz
`PATCH /itens/:itemId` para cada item ao salvar, enviando `{ quantidadeComprada: number,
observacoes }`. Com o contrato da Task 5.2 esse envio **continua válido** (a união aceita number e
`observacoes` foi mantida), mas a resposta deixa de ser o item cru e passa a ser `{ item, impacto }`
— hoje o retorno é ignorado, então nada quebra em runtime; o que muda é o tipo em
`api/comercial/compras-programadas/[id]/itens/[itemId]/route.ts` (Task 5.6). O laço também passa a
tratar o 409 `IMPACTO_CONFIRMACAO_NECESSARIA`: em vez de seguir para o próximo item silenciosamente,
interrompe o salvamento e abre o painel de impacto (RA-05 — nenhuma falha silenciosa).

**14.3** Teste `__tests__/painel-impacto.test.tsx` cobre o componente; o fluxo do modal (409 →
"Salvar mesmo assim") é coberto em `__tests__/compras-client.test.tsx` (arquivo novo, mesmo commit).

**Verificação:** `cd app/frontend && npm run test -- compras-client painel-impacto`.

**Commit:** `feat(onda5): edição de compra confirmada com painel de impacto e histórico`

---

### Task 15 — Tela `/gestao/overbooking`

**Protótipo:** `src/app/pages/PainelOverbooking.tsx` (684 linhas).

**15.1** `src/lib/overbooking.ts`: tipos `Pendencia`, `CoberturaPendencia`, `HistoricoPendencia`,
mapa de rótulo por status (`aberta` → "Aberto", `em_analise` → "Em análise",
`compra_complementar_programada` → "Compra complementar programada", `redistribuicao_decidida` →
"Redistribuição decidida", `novo_pedido_criado` → "Novo pedido criado", `resolvida` → "Resolvido",
`cancelada` → "Cancelado") — os mesmos rótulos do filtro do protótipo (`PainelOverbooking.tsx:453`).

**15.2** `overbooking-client.tsx`, layout mestre-detalhe do protótipo:
- 4 KPIs (`Pendências abertas`, `Em análise`, `Déficit total`, `Resolvidas hoje`);
- busca textual + filtro de status;
- lista à esquerda, detalhe à direita com os campos `Quantidade deficitária`, `Pedido de origem`,
  `Cliente`, `Vendedor`, `Operação prevista`, `Confirmação do overbooking`;
- três blocos de decisão, alimentados por `GET /:id/cobertura`:
  1. **Compra complementar** — seletor de compra elegível + quantidade → `POST /:id/decisao`;
  2. **Redistribuição** — lista de reservas doadoras com cliente e quantidade; botão por opção;
  3. **Postergar para próxima operação** — modal com quantidade e operação destino, texto literal
     "A quantidade postergada gera um novo pedido de venda para o mesmo cliente, a ser atendido em
     uma próxima operação.";
- linha do tempo do histórico (`GET /:id/historico`);
- ações de status (`Iniciar análise`, `Cancelar`) via `PATCH /:id/status`;
- quando `cobertura` volta com listas vazias, exibir o estado vazio — nunca opção fabricada.

**15.3** Tempo real: refazer o fetch ao receber `pendencia_overbooking_*`.

**15.4** Teste `__tests__/overbooking-client.test.tsx` (critério 2.12): KPIs, filtro, os 3 blocos,
envio de cada caminho e tratamento de 409.

**Verificação:** `cd app/frontend && npm run test -- overbooking-client`.

**Commit:** `feat(onda5): tela de pendências de overbooking com os 3 caminhos de decisão`

---

### Task 16 — Tela `/gestao/aprovacoes`

**Protótipo:** `src/app/pages/Aprovacoes.tsx` (641 linhas).

**16.1** `src/lib/aprovacoes.ts`: tipos das duas abas, rótulos dos 4 tipos de aprovação
("Divergência de transformação", "Estorno fora da regra", "Reabertura de carga/pedido",
"Ajuste de estoque relevante") e dos status ("Pendente", "Aprovada", "Rejeitada"; ocorrências:
"Aberta", "Em tratativa", "Concluída").

**16.2** `aprovacoes-client.tsx` com as duas abas do protótipo:
- **Aba 1 — Fila Administrativa de Ocorrências**: mestre-detalhe; no detalhe, dados do fornecedor,
  NF, pedido/lote, andamentos, ação "Registrar andamento" (`PATCH /operacao/ocorrencias-fornecedor/:id`)
  e "Concluir tratativa" (`POST .../encerrar`) com tipo de resultado e observação; abaixo,
  `<QuadroComparativo />` com o retorno de `GET /api/gestao/aprovacoes/ocorrencias/:id/comparativo`.
  Quando o comparativo responde 404 `CONCLUSAO_INEXISTENTE`, exibir "Sem conferência tripla
  concluída para esta ocorrência" no lugar da tabela.
- **Aba 2 — Aprovações Operacionais**: lista com tipo, origem, descrição, impacto, solicitante e
  status; modais "Aprovar solicitação" / "Rejeitar solicitação" com motivo obrigatório →
  `POST /api/gestao/aprovacoes/operacionais/:id/decidir`. Solicitações já decididas mostram decisão
  e responsável, sem botões de ação.

**16.3** Teste `__tests__/aprovacoes-client.test.tsx`: alterna abas; renderiza o quadro com o aviso
de imutabilidade; bloqueia decisão sem motivo; mostra erro 409 de decisão duplicada.

**Verificação:** `cd app/frontend && npm run test -- aprovacoes-client`.

**Commit:** `feat(onda5): tela de aprovações e ocorrências com comparativo imutável`

---

### Task 17 — Tela `/gestao/relatorios` (SIF)

**Protótipo:** `src/app/pages/RelatoriosSIF.tsx` (309 linhas).

**17.1** `src/lib/sif.ts`: tipos `RelatorioSif`, `VersaoSif`, rótulos de status ("Pendente de dados",
"Pronto para gerar", "Gerado", "Retificado") e do tipo de geração.

**17.2** `relatorios-client.tsx`:
- banner provisório do protótipo + `BadgeProvisorio pendencia="P8"` no cabeçalho e em cada cartão
  (D5.32);
- 3 KPIs do protótipo (`Pendentes de dados`, `Prontos para gerar`, `Gerados/Retificados`);
- cartão por relatório com nome, código, operação, `StatusPill`, responsável, lista de pendências e
  "Última versão: vN em DD/MM/AAAA HH:mm";
- ação "Gerar" (`POST /api/sif/relatorios/:id/gerar`), desabilitada com `title` explicativo quando
  `status === 'pendente_dados'`;
- ação "Retificar" (`POST /api/sif/relatorios/:id/retificar`) com modal de motivo obrigatório
  (mínimo 10 caracteres, validado também no backend);
- modal "Histórico de versões" (`GET /:id/versoes`) com versão, data/hora, autor e selo
  Gerado/Retificado; estado vazio "Nenhuma versão gerada ainda para este relatório.";
- modal de preview (`GET /:id/preview`); em 404 `SEM_VERSAO_GERADA`, mostrar o estado vazio.

**17.3** Teste `__tests__/relatorios-sif-client.test.tsx` (critério 4.11): badge P8 presente; botão
"Gerar" desabilitado em `pendente_dados`; retificação exige motivo; histórico de versões renderiza.

**Verificação:** `cd app/frontend && npm run test -- relatorios-sif-client`.

**Commit:** `feat(onda5): tela de relatórios SIF com versionamento e retificação (provisório P8)`

---

### Task 18 — E2E, terminologia, evidências e gate local

**18.1** `app/frontend/e2e/onda5-gestao.spec.ts` (critério 5.8): logar como `gestor`, navegar pelas
6 rotas via menu, verificar título, ausência de erro no console e presença dos blocos-chave
(10 KPIs no dashboard; filtro de status em operações; painel de impacto ao editar compra confirmada;
3 blocos de decisão no overbooking; 2 abas em aprovações; badge P8 em relatórios).

**18.2** Estender `__tests__/terminologia.test.ts` (critério 5.9) para varrer
`src/app/(admin)/gestao/**` e `src/components/gestao/**` procurando o termo banido e conferindo o
uso de "Nome Fantasia"/"Buscar cliente" onde houver cliente.

**18.3** Evidências em `docs/evidencias/onda5-gestao/`: um PNG por rota (`01-dashboard.png` a
`06-relatorios.png`), mais `07-impacto-deficit.png` (modal com déficit projetado),
`08-overbooking-decisao.png`, `09-comparativo-imutavel.png`, `10-sif-versoes.png` e um `index.html`
no mesmo formato do usado em `docs/evidencias/alpha-jornada-e2e/`. Capturas geradas pelo Playwright
contra o app real com banco semeado — proibido print do protótipo.

**18.4** Consolidar no README de evidências da onda os comandos executados, resultados, cobertura,
SHAs e caminhos das capturas produzidas em 18.1–18.3. O Worker encerra a task entregando ao
Executor esse pacote de código, testes e evidências; **não** edita `docs/execucao/EXECUCAO-STATUS.md`
nem este plano. As cinco dívidas já estão fixadas na seção "Dívidas deixadas por esta onda"; qualquer
mudança futura nelas exige uma nova atuação do Planner, nunca uma edição pelo Worker.

**18.5** Gate local completo, na raiz do repositório:

```bash
npm ci
npm run lint
npm run type-check
cd app/backend && npm run db:migrate && npm run db:seed && npm run test:cov
cd ../frontend && npm run test && npx playwright test
cd ../.. && npm run build
npm audit --omit=dev --audit-level=high   # AD-08
```

Critérios de aprovação do gate local: lint e type-check sem erro; cobertura de linha **e** branch
≥ 80%; todos os testes verdes; build sem erro; audit sem high/critical na árvore de produção.

**Commit:** `test(onda5): e2e das 6 rotas de gestão, terminologia e evidências`

---

## Ordem de execução e dependências

```
Task 1 (migration + schemas)
  ├─ Task 2 (permissões + eventos)
  ├─ Task 3 (seed P8)
  ├─ Task 4 (operações: filtros, contadores, corrente)
  ├─ Task 5 (impacto + edição de compra confirmada)      ← depende de 1
  ├─ Task 6 (overbooking: cobertura + 3 caminhos)        ← depende de 1
  ├─ Task 7 (aprovações)                                  ← depende de 1, 2
  ├─ Task 8 (SIF)                                         ← depende de 1, 2, 3
  └─ Task 9 (dashboard)                                   ← depende de 1, 4, 8
Task 10 (BFF)                                             ← depende de 4–9
Task 11 (componentes compartilhados)                      ← depende de 10
Task 12 (dashboard UI)                                    ← depende de 11
Task 13 (operações UI)                                    ← depende de 11
Task 14 (compras UI)                                      ← depende de 11
Task 15 (overbooking UI)                                  ← depende de 11
Task 16 (aprovações UI)                                   ← depende de 11
Task 17 (SIF UI)                                          ← depende de 11
Task 18 (e2e, terminologia, evidências, gate)             ← depende de 12–17
```

Tasks 4 a 9 podem ser paralelizadas entre Workers depois da Task 1; tasks 12 a 17 podem ser
paralelizadas depois da Task 11. Tasks 1, 10, 11 e 18 são sequenciais e bloqueantes.

---

## Dívidas deixadas por esta onda

| # | Dívida | Por quê | Destino |
|---|---|---|---|
| 1 | Déficit gerado por redução de compra confirmada não abre `pendencias_overbooking` automaticamente | A pendência exige `pedido_venda_item_id` e vendedor responsável; atribuí-los automaticamente inventaria dado (D5.12) | Onda 6, junto com o recebimento real, ou AD do Quality Owner definindo a regra de atribuição |
| 2 | Layout oficial dos relatórios SIF | P8 aberta (v1.1 §16.10): modelos não entregues pelo cliente | Fecha quando houver AD; o `conteudo_json` e a tela já suportam troca de layout sem redesenho |
| 3 | Aprovações operacionais não são abertas por nenhuma tela ainda | As origens (Desossa, Carga, Estoque, Faturamento) são das ondas 7–10; esta onda entrega a fila, o contrato e `abrirNaTx` | Ondas 7 a 10 |
| 4 | Caminho "compra complementar" não abate o déficit da pendência | O abate real depende da confirmação da compra complementar (fluxo de Compras) | Onda 6, quando o recebimento fechar o ciclo compra → disponibilidade → pendência |
| 5 | KPI "Faturamentos pendentes" conta `notas_fiscais` pendentes/em erro | O conceito completo de pendência de faturamento depende do checklist de liberação | Onda 10 |

Nenhuma dívida desta onda bloqueia o DoD da Onda 5; todas estão registradas para entrar no mapa
DoD→teste da onda de destino.

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Conflito de merge com a Onda 4 em `pedidos.service.ts` (extração dos métodos `NaTx`, Task 6.4) | Média | Médio | Refatoração sem mudança de comportamento, coberta pelos testes existentes de pedidos; se a Onda 4 mergear antes, reaplicar a extração sobre o código novo e rodar `pedidos.e2e-spec.ts` como critério de aceite |
| Número da migration colidir com a Onda 4 | Baixa (já mitigado: Onda 4 = `0016`/`0017`, Onda 5 = `0018`) | Baixo | Se `develop` ocupar o 0018 antes do merge, renumerar mantendo o SQL e registrar no PR |
| Trigger de imutabilidade quebrar teste existente que faça `UPDATE` em `conclusoes_conferencia` | Baixa | Médio | Rodar a suíte inteira logo após a Task 1; se algum teste fizer `UPDATE`, o teste é que está errado (v1.1 §6.10.7) e deve ser corrigido no mesmo commit |
| Cobertura cair abaixo de 80% pelo volume de código novo | Média | Alto (gate) | Cada task já traz o seu teste; rodar `test:cov` ao fim das tasks 5, 8 e 9, não só no gate final |
| `projetarImpacto` com `VALUES` dinâmico gerar SQL inválido quando a simulação é vazia | Média | Médio | O ramo vazio usa `SELECT ... WHERE false`, coberto pelo caso 1.1 do mapa DoD |
| Divergência visual com o protótipo detectada só no Portão 2 | Média | Alto | Evidência PNG por rota na Task 18 e leitura obrigatória do `.tsx` do protótipo antes de cada task de tela |
| Escopo aplicado só à listagem, deixando detalhe ou mutação acessível | Média | Crítico | Matriz literal de métodos em D5.39–D5.40 e testes 6.12–6.17 com prova de não mutação |
| Inativar/remover representante ampliar usuário restrito para Todos | Baixa | Crítico | Preservar associação, autorizar pelo ID sem filtrar status/delete e provar com 6.11 |
| Aplicar E5.1 antes do merge O4 ou perder código ao atualizar a PR #28 | Média | Alto | Task 19 bloqueia; E5.1.6 fixa conferência de SHAs, conflito conhecido e `--force-with-lease` apenas com coordenação |

---

## Gate local completo e PR de implementação (Executor)

A PR #28 já existe em draft. Portanto, **não** executar `gh pr create` nem abrir segunda PR.
Depois da Task 22 e com o gate local verde:

```bash
cd F:/Projetos/AlphaCarnes
git checkout feature/onda5-gestao
git status                       # árvore limpa
git log --oneline develop..HEAD  # conferir a série real; 22 commits previstos pelo plano
git push origin feature/onda5-gestao
gh pr view 28 --json headRefOid,baseRefName,isDraft,statusCheckRollup,url
```

Com o pacote de evidências entregue pelo Worker, o **Executor** atualiza, em commit de coordenação
separado, a linha da Onda 5 em `docs/execucao/EXECUCAO-STATUS.md` para `aguardando_portao2` e registra
o número real da PR de implementação. O Executor não edita este plano nem redefine suas dívidas; o
Worker não participa dessa mudança de estado.

Atualizar a descrição da PR #28 com os quatro itens originais, o quinto item de escopo por
representante, o hash deste plano, as evidências e o gate descritos na Task 22. O procedimento de
incorporação do `develop` pós-O4 e a proteção contra sobrescrita remota estão fixados na E5.1.6.

O Portão 2 é solicitado somente depois do CI verde no head do PR. Nenhum veredito é escrito por
quem implementa.

---

## Autorrevisão do plano (checklist do Portão 1)

| Item | Situação |
|---|---|
| Goal, Architecture e Tech Stack presentes | Sim — 3 seções no topo |
| Global Constraints explícitas | Sim — 14 restrições |
| Decisões de design fixadas (o Worker não escolhe) | Sim — D5.1 a D5.32 |
| Referências do protótipo por tela, com arquivo e linhas | Sim — 10 linhas na tabela, commit do protótipo fixado |
| Estrutura de arquivos (novos e alterados) | Sim — união final recalculada na E5.1.8: 30 novos + 43 alterados no backend; 37 novos + 19 alterados no frontend |
| Mapa DoD → teste 1:1 | Sim — 91 critérios (63 originais + 28 da E5.1), cada um com arquivo e nome de teste |
| Schemas e caminhos auditados no código real, não presumidos | Sim — seção "Estado atual verificado" lista as colunas que **não** existem (`transformacoes.operacao_id`, `pecas.operacao_id`, `notas_fiscais.operacao_id`, `notas_fiscais_fornecedor.chave_acesso`, `recebimentos.numero_lote`, campo de seguro em `caminhoes`) e o JOIN correto de cada uma; os CHECKs que restringem os `UPDATE`s da onda (`chk_reservas_qtd_positiva`, `chk_pend_ovb_deficit`, `chk_pedidos_itens_pedida_positiva`) estão citados com arquivo e linha no ponto de uso |
| Eventos novos com destino real (não só emitidos) | Sim — Task 2.5 liga os 7 eventos ao `realtime.gateway.ts`, com `dataOperacao` no payload (é a room) |
| Rotas BFF compatíveis com o roteador do Next | Sim — só rotas explícitas; catch-all irmão de `[id]` é proibido e o `npm run build` da Task 10.7 é o gate |
| Tasks com código literal | Sim — SQL, schemas Drizzle, DTOs Zod, métodos de service, controllers e testes escritos por extenso |
| TDD explícito por task | Sim — cada task nomeia o teste e o comando de verificação |
| Commit declarado por task | Sim — 22 mensagens |
| Gate local completo | Sim — Task 18.5 |
| PR de implementação descrita | Sim — PR #28 existente é atualizada após a Task 22; segunda PR é proibida |
| Ordem de execução e paralelismo | Sim — grafo original + cadeia bloqueante das 22 tasks na E5.1.6 |
| Dívidas registradas | Sim — 5 remanescentes, com destino; dívida O3 D43/O4 D26 reparada pela E5.1 |
| Riscos com mitigação | Sim — 9 |
| Nenhuma AD inventada para pendência aberta | Sim — P8 e P1 seguem abertas, tratadas por parâmetro + badge (D5.4) |
| Dependência da Onda 4 controlada | Sim — Tasks 19–22 só iniciam pós-merge O4 e atualização da PR #28; conflitos e regressões estão fixados na E5.1.6 |
| Terminologia respeitada (termo banido ausente) | Sim — verificado no texto do plano e vigiado por teste (critério 5.9) |
| Varredura dos marcadores de incompletude proibidos pelo gate textual | Sim — o comando abaixo retorna zero no conteúdo normativo sem fazer a própria especificação gerar falso positivo |

```powershell
$plano = 'docs/superpowers/plans/2026-07-26-onda5-gestao.md'
$marcadores = @(
  ('TB' + 'D'),
  ('TO' + 'DO'),
  ('a def' + 'inir'),
  ('implementar de' + 'pois'),
  ('similar à Ta' + 'sk')
)
rg -n -e ($marcadores -join '|') -- $plano
if ($LASTEXITCODE -eq 1) { 'OK: nenhum marcador proibido'; exit 0 }
exit $LASTEXITCODE
```

### Contagens

| Métrica | Valor |
|---|---|
| Rotas entregues | 7 + complemento em `/cadastros/representantes` |
| Tasks | 22 |
| Commits previstos | 22 |
| Decisões de design fixadas | 46 (D5.1–D5.46) |
| Critérios no mapa DoD → teste | 91 |
| Migrations | 2 (`0018_onda5_gestao` + `0019_onda5_usuarios_representantes`) |
| Tabelas novas | 4 (`relatorios_sif`, `relatorios_sif_versoes`, `aprovacoes_operacionais`, `usuarios_representantes`) |
| Triggers novos | 4 (2 de imutabilidade + 2 de `updated_at`) |
| Módulos NestJS novos | 2 (`gestao/aprovacoes`, `sif`) |
| Endpoints novos | 14 (+2 alterados: `PATCH` de item da compra e `GET /gestao/dashboard`) |
| Permissões novas | 5 |
| Eventos novos | 4 (+3 existentes de pendência de overbooking ganham payload completo e handler no gateway; + chave `reserva_disponibilidade_atualizada` em `PayloadPorEvento`) |
| Handlers `@OnEvent` novos no gateway | 7 |
| Parâmetros novos | 1 (`gestao.modelos_relatorio_sif`, provisório P8) |
| Arquivos novos no backend | 30 |
| Arquivos alterados no backend | 43 (união, sem contar `_journal.json` e `pedidos.service.ts` duas vezes) |
| Arquivos novos no frontend | 37 sem testes (15 de tela/lib/componente + 22 rotas BFF) |
| Arquivos alterados no frontend | 19 |
| Rotas BFF novas | 22 (19 dos endpoints das tasks 4–9 + 3 de ocorrências de fornecedor) |
| Rotas BFF `[...path]` (catch-all) | 0 — proibidas: conflitariam com o `[id]` já existente |
| Arquivos de teste novos | 13 specs backend (+1 helper de fixtures) + 12 frontend |
| Pendências fechadas | 0 (nenhuma AD nova — Princípio VIII) |
| Dívidas deixadas | 5 |

---

# Emenda E5.1 — Representantes permitidos em Usuários

> **Esta emenda é normativa e autossuficiente.** Ela incorpora à Onda 5 a dívida explicitamente
> diferida por O3 D43 e O3 D13.b, reprogramada por O4 D26 e ausente da primeira versão deste plano.
> Em qualquer conflito de base, dependência, contagem, ordem, fronteira de arquivo ou gate entre o
> texto original e esta seção, **prevalece a Emenda E5.1**.

## E5.1.1 Fontes e contrato herdado

| Fonte | Contrato que o Worker deve preservar |
|---|---|
| `docs_v2/03_menu_personas_permissoes.md` §1.2, §5.1 e §5.3 | Representantes permitidos definem o escopo de dados; o cadastro de Usuário contém esse campo; Representantes mostra Clientes vinculados e Usuários vinculados |
| Matriz de rastreabilidade, linha 38 | `/admin/usuarios` administra `usuarios`, `usuarios_perfis`, representantes permitidos e status; acesso somente administrativo |
| Onda 3 D43 | Criar `usuarios_representantes`, expor `PUT /usuarios/:id/representantes`, auditar antes/depois, renderizar multisseleção e restringir Clientes/Pedidos quando a lista for não vazia |
| Onda 3 D13.b | A sétima coluna e o bloco "Usuários vinculados" de Representantes retornam junto com a relação real |
| Onda 4 D26 | A dívida pertence à Onda 5; o representante de Pedido é sempre derivado de `clientes.representante_id` |
| Protótipo `Usuarios.tsx` | Preservar cabeçalho, ações, grade `8/4`, lista e resumo de perfis; completar o drawer sem redesenhar a página |
| Protótipo `Representantes.tsx` | Repor a sétima coluna e o bloco "Usuários vinculados" no drawer |
| Protótipo `src/app/components/Layout.tsx` + dívida da Onda 2 D16 | Repor "Escopo" no cabeçalho com valor real de `/auth/me`, sem seed |

### Regra fechada, sem decisão local

1. A lista **vazia** de vínculos significa **Todos**. Essa semântica já decorre de O3 D43
   ("usuário com lista não vazia só enxerga...") e do exemplo "Todos" da documentação.
2. A lista **não vazia** significa escopo restrito exatamente aos IDs vinculados.
3. O escopo é uma dimensão do usuário, não um novo perfil. `comercialInterno` e
   `comercialExterno` continuam sendo o perfil canônico `comercial`.
4. Não há permissão nova. Leitura continua sob `USUARIOS_LER`; criar usuário e definir
   representantes continuam sob `USUARIOS_GERENCIAR`. Somente `administrador` possui essas
   permissões no snapshot atual.
5. Pedido não ganha `representante_id`. Toda autorização de Pedido resolve
   `pedidos_venda.cliente_id → clientes.representante_id`.
6. Um recurso fora do escopo responde com o mesmo `404` e a mesma mensagem de inexistência já
   usados pelo serviço. Isso evita revelar dados e evita um segundo contrato de erro.
7. A autorização é reaplicada em **toda leitura e mutação**, inclusive detalhe, restauração,
   ações de item, transições e adendos. Filtrar apenas a listagem não fecha o DoD.

## E5.1.2 Decisões de design adicionais

### D5.33 — Tabela de associação e exceção estrutural

Criar `usuarios_representantes` na migration
`app/backend/src/database/migrations/0019_onda5_usuarios_representantes.sql`:

```sql
CREATE TABLE usuarios_representantes (
  usuario_id uuid NOT NULL
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  representante_id uuid NOT NULL
    REFERENCES representantes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_usuarios_representantes
    PRIMARY KEY (usuario_id, representante_id)
);

CREATE INDEX idx_usuarios_representantes_representante
  ON usuarios_representantes (representante_id);
```

A PK composta já fixa unicidade e indexa `usuario_id`; o índice reverso cobre a projeção por
representante. Essa tabela é uma associação, não uma entidade de negócio independente: por isso
usa a PK composta determinada em O3 D43 e não recebe `id`, `updated_at` nem `deleted_at`.

Registrar a migration no
`app/backend/src/database/migrations/meta/_journal.json` depois de `0018_onda5_gestao`.
Acrescentar em `app/backend/src/database/schema/auth.schema.ts` a tabela Drizzle, relations
`usuarios.representantesPermitidos` e `representantes.usuariosVinculados`, e exportá-la pelo
caminho já usado pelo schema. Acrescentar o rollback explícito em
`app/backend/src/database/migrations/ROLLBACK.md`.

### D5.34 — Política de remoção e inativação

- `DELETE /usuarios/:id` e `DELETE /representantes/:id` continuam sendo soft delete; não apagam
  vínculos. Restaurar o usuário restaura o mesmo escopo.
- Inativar ou remover logicamente um representante não transforma silenciosamente um usuário
  restrito em "Todos". O vínculo permanece e o predicado usa o ID, mesmo se o representante não
  estiver ativo.
- O formulário devolve vínculos preexistentes inativos/removidos com badge de estado. Eles podem
  ser mantidos ou retirados, mas não podem ser adicionados a outro usuário.
- A substituição via `PUT` pode apagar fisicamente **somente linhas da associação**, na mesma
  transação que insere o novo conjunto e registra auditoria. Entidades de negócio nunca sofrem
  hard delete.
- A FK `RESTRICT` protege contra remoção física acidental. Nenhuma FK usa cascade.

### D5.35 — DTOs e respostas

Em `app/backend/src/modules/usuarios/dto/update-usuario.dto.ts`, declarar e exportar a validação
compartilhada e o `definirRepresentantesSchema`; em
`app/backend/src/modules/usuarios/dto/create-usuario.dto.ts`, importar a validação e estender o
schema de criação:

```ts
export const representantesPermitidosSchema = z
  .array(z.string().uuid())
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Representantes permitidos não podem conter duplicidades',
      });
    }
  });

export const definirRepresentantesSchema = z.object({
  representantes: representantesPermitidosSchema,
});
```

`createUsuarioSchema` ganha
`representantes: representantesPermitidosSchema.optional().default([])` para criar usuário,
perfis e escopo atomicamente. `updateUsuarioSchema` não ganha esse campo: a edição usa o `PUT`
dedicado e preserva a separação de responsabilidades fixada por O3 D43.

`GET /usuarios` e `GET /usuarios/:id` passam a devolver:

```ts
ultimoAcesso: string | null;
representantesPermitidos: Array<{
  id: string;
  nome: string;
  status: string;
  deletedAt: string | null;
}>;
escopoRepresentantes: 'todos' | 'restrito';
```

A API sempre ordena o array por `nome`, depois `id`. A UI não deriva o significado pela presença
de texto; usa `escopoRepresentantes`. `PROJECAO_USUARIO` passa a projetar literalmente
`ultimoAcesso: schema.usuarios.ultimoAcesso`; a coluna já existe e é atualizada por
`AuthRepository.updateUltimoAcesso`, portanto é proibido fabricar ou recalcular esse valor no
frontend.

### D5.36 — Serviço e auditoria da associação

Em `UsuariosService`, acrescentar `BadRequestException` aos imports de `@nestjs/common`, `asc` aos
imports de `drizzle-orm` e usar o tipo de banco já vigente no arquivo:

```ts
type Db = NodePgDatabase<typeof schema>;

type RepresentantePermitido = {
  id: string;
  nome: string;
  status: string;
  deletedAt: Date | null;
};

function mesmosIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, indice) => id === b[indice]);
}
```

O carregador abaixo é a única leitura da associação usada por lista, detalhe e resposta das
mutações. Ele faz uma consulta em lote, inclui vínculos com representante inativo/removido e fixa
a ordenação `nome`, depois `id`:

```ts
private async representantesPorUsuario(
  exec: Db,
  usuariosIds: string[],
): Promise<Map<string, RepresentantePermitido[]>> {
  const resultado = new Map<string, RepresentantePermitido[]>();
  for (const id of usuariosIds) resultado.set(id, []);
  if (usuariosIds.length === 0) return resultado;

  const linhas = await exec
    .select({
      usuarioId: schema.usuariosRepresentantes.usuarioId,
      id: schema.representantes.id,
      nome: schema.representantes.nome,
      status: schema.representantes.status,
      deletedAt: schema.representantes.deletedAt,
    })
    .from(schema.usuariosRepresentantes)
    .innerJoin(
      schema.representantes,
      eq(
        schema.representantes.id,
        schema.usuariosRepresentantes.representanteId,
      ),
    )
    .where(inArray(schema.usuariosRepresentantes.usuarioId, usuariosIds))
    .orderBy(
      schema.usuariosRepresentantes.usuarioId,
      asc(schema.representantes.nome),
      asc(schema.representantes.id),
    );

  for (const linha of linhas) {
    resultado.get(linha.usuarioId)?.push({
      id: linha.id,
      nome: linha.nome,
      status: linha.status,
      deletedAt: linha.deletedAt,
    });
  }
  return resultado;
}

private async detalharNaTx(id: string, tx: Db) {
  const usuario = await tx
    .select(PROJECAO_USUARIO)
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id, id), isNull(schema.usuarios.deletedAt)))
    .then((linhas) => linhas[0] ?? null);
  if (!usuario) throw new NotFoundException('Usuário não encontrado');

  const [perfis, porUsuario] = await Promise.all([
    this.perfisDoUsuario(id, tx),
    this.representantesPorUsuario(tx, [id]),
  ]);
  const representantesPermitidos = porUsuario.get(id) ?? [];
  return {
    ...usuario,
    perfis,
    representantesPermitidos,
    escopoRepresentantes:
      representantesPermitidos.length === 0 ? 'todos' as const : 'restrito' as const,
  };
}
```

O helper transacional é literal. O lock acontece antes da leitura do conjunto anterior; a
validação diferencia ID inexistente de vínculo removido já herdado; o no-op retorna o detalhe real
sem `DELETE`, `INSERT` nem auditoria:

```ts
private async definirRepresentantesNaTx(
  tx: Db,
  usuarioId: string,
  representantesSolicitados: string[],
  autorUsuarioId: string,
) {
  const usuario = await tx
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(and(
      eq(schema.usuarios.id, usuarioId),
      isNull(schema.usuarios.deletedAt),
    ))
    .for('update')
    .limit(1)
    .then((linhas) => linhas[0] ?? null);
  if (!usuario) throw new NotFoundException('Usuário não encontrado');

  const anterioresRows = await tx
    .select({ representanteId: schema.usuariosRepresentantes.representanteId })
    .from(schema.usuariosRepresentantes)
    .where(eq(schema.usuariosRepresentantes.usuarioId, usuarioId))
    .orderBy(schema.usuariosRepresentantes.representanteId);
  const idsAnterioresOrdenados = anterioresRows.map((linha) => linha.representanteId);
  const anteriores = new Set(idsAnterioresOrdenados);
  const idsNovosOrdenados = [...representantesSolicitados].sort();

  const candidatos = idsNovosOrdenados.length === 0
    ? []
    : await tx
      .select({
        id: schema.representantes.id,
        deletedAt: schema.representantes.deletedAt,
      })
      .from(schema.representantes)
      .where(inArray(schema.representantes.id, idsNovosOrdenados));
  const candidatosPorId = new Map(candidatos.map((linha) => [linha.id, linha]));
  const invalidos = idsNovosOrdenados.filter((id) => {
    const candidato = candidatosPorId.get(id);
    return !candidato || (candidato.deletedAt !== null && !anteriores.has(id));
  });
  if (invalidos.length > 0) {
    throw new BadRequestException({
      code: 'REPRESENTANTES_INVALIDOS',
      message: 'Representantes permitidos contêm ID inexistente ou removido',
      representantes: invalidos,
    });
  }

  if (mesmosIds(idsAnterioresOrdenados, idsNovosOrdenados)) {
    return this.detalharNaTx(usuarioId, tx);
  }

  await tx
    .delete(schema.usuariosRepresentantes)
    .where(eq(schema.usuariosRepresentantes.usuarioId, usuarioId));
  if (idsNovosOrdenados.length > 0) {
    await tx.insert(schema.usuariosRepresentantes).values(
      idsNovosOrdenados.map((representanteId) => ({
        usuarioId,
        representanteId,
      })),
    );
  }

  await this.auditoria.registrar(tx, {
    tabela: 'usuarios_representantes',
    registroId: usuarioId,
    operacao: 'UPDATE',
    modulo: 'usuarios',
    usuarioId: autorUsuarioId,
    dadosAnteriores: { representantes: idsAnterioresOrdenados },
    dadosNovos: { representantes: idsNovosOrdenados },
  });
  return this.detalharNaTx(usuarioId, tx);
}

async definirRepresentantes(
  usuarioId: string,
  representantes: string[],
  autorUsuarioId: string,
) {
  return this.db.transaction((tx) =>
    this.definirRepresentantesNaTx(
      tx,
      usuarioId,
      representantes,
      autorUsuarioId,
    ),
  );
}
```

`createUsuarioSchema` já normaliza duplicidade; o service ainda ordena para estabilizar no-op e
auditoria. No corpo transacional existente de `criar`, depois de `vincularPerfis` e antes da
auditoria de `usuarios`, executar:

```ts
await this.definirRepresentantesNaTx(
  tx,
  usuario.id,
  dto.representantes,
  criadorId,
);

await this.auditoria.registrar(tx, {
  tabela: 'usuarios',
  registroId: usuario.id,
  operacao: 'INSERT',
  modulo: 'usuarios',
  usuarioId: criadorId,
  dadosAnteriores: {},
  dadosNovos: usuario,
});
return this.detalharNaTx(usuario.id, tx);
```

Assim usuário, perfis, vínculos e as duas auditorias aplicáveis ficam na mesma transação. Conjunto
inicial vazio não cria auditoria falsa da associação; a auditoria do novo usuário permanece.

Em `listar()`, manter a consulta única de usuários e trocar as leituras auxiliares por um
`Promise.all` de **duas consultas em lote** — Perfis e Representantes — usando todos os IDs da
página. O mapper final é literal:

```ts
const [perfisRows, representantesPorUsuario] = await Promise.all([
  this.db
    .select({ usuarioId: schema.usuariosPerfis.usuarioId, slug: schema.perfis.slug })
    .from(schema.usuariosPerfis)
    .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
    .where(inArray(schema.usuariosPerfis.usuarioId, ids)),
  this.representantesPorUsuario(this.db, ids),
]);

const perfisPorUsuario = new Map<string, string[]>();
for (const row of perfisRows) {
  const atuais = perfisPorUsuario.get(row.usuarioId) ?? [];
  atuais.push(row.slug);
  perfisPorUsuario.set(row.usuarioId, atuais);
}

return usuarios.map((usuario) => {
  const representantesPermitidos = representantesPorUsuario.get(usuario.id) ?? [];
  return {
    ...usuario,
    perfis: perfisPorUsuario.get(usuario.id) ?? [],
    representantesPermitidos,
    escopoRepresentantes:
      representantesPermitidos.length === 0 ? 'todos' as const : 'restrito' as const,
  };
});
```

`detalhar(id)` passa a chamar `detalharNaTx(id, this.db)`. É proibida query por usuário na lista.

### D5.37 — Controller e RBAC fixos

Em `UsuariosController`:

```ts
@Put(':id/representantes')
@RequirePermissoes('USUARIOS_GERENCIAR')
definirRepresentantes(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(definirRepresentantesSchema)) dto: DefinirRepresentantesDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.usuariosService.definirRepresentantes(
    id,
    dto.representantes,
    user.sub,
  );
}
```

Não criar `USUARIOS_REPRESENTANTES_GERENCIAR`, não conceder o endpoint a `gestor` e não usar
`PERFIS_GERENCIAR`. Os guards globais atuais continuam obrigatórios.

### D5.38 — Predicado único de autorização

Criar `app/backend/src/common/rbac/escopo-representantes.ts` com este conteúdo completo:

```ts
import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { usuariosRepresentantes } from '../../database/schema';

/**
 * Autorização correlacionada por representante.
 *
 * Sem linha em usuarios_representantes: Todos.
 * Com ao menos uma linha: somente igualdade com um ID vinculado.
 * representanteId NULL: autorizado apenas no caso Todos; no caso restrito,
 * `IS NOT NULL` é falso e o recurso permanece oculto.
 */
export function escopoRepresentantes(
  usuarioId: string,
  representanteId: AnyPgColumn,
): SQL<boolean> {
  return sql<boolean>`(
    NOT EXISTS (
      SELECT 1
      FROM ${usuariosRepresentantes} AS ur_any
      WHERE ur_any.usuario_id = ${usuarioId}
    )
    OR (
      ${representanteId} IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM ${usuariosRepresentantes} AS ur_allowed
        WHERE ur_allowed.usuario_id = ${usuarioId}
          AND ur_allowed.representante_id = ${representanteId}
      )
    )
  )`;
}
```

Este é o builder usado em todos os `where` abaixo; não criar uma segunda variante por módulo. Ele
não consulta `representantes.status` nem `deleted_at`, portanto inativar/remover logicamente um
representante nunca transforma escopo restrito em Todos. O teste 6.11 exercita também
`representante_id IS NULL`: Todos enxerga, restrito recebe 404/linha ausente. Linhas e todas as
contagens usam o mesmo fragmento.

### D5.39 — Cobertura completa de Clientes

Depois do merge da Onda 4, alterar literalmente:

- `app/backend/src/modules/cadastros/clientes/clientes.controller.ts`;
- `app/backend/src/modules/cadastros/clientes/clientes.service.ts`.

No controller, os seis métodos recebem `@CurrentUser()`; nenhuma assinatura de rota fica implícita:

| Método HTTP | Chamada literal ao service |
|---|---|
| `GET /clientes` | `listar(query, user.sub)` |
| `GET /clientes/:id` | `detalhar(id, user.sub)` |
| `POST /clientes` | `criar(dto, user.sub)` |
| `PATCH /clientes/:id` | `atualizar(id, dto, user.sub)` |
| `DELETE /clientes/:id` | `remover(id, user.sub)` |
| `POST /clientes/:id/restaurar` | `restaurar(id, user.sub)` |

Os quatro métodos que hoje não recebem usuário ficam assim; os outros dois já têm o decorator e
apenas preservam a chamada mostrada na tabela:

```ts
async listar(
  @Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.clientesService.listar(query, user.sub);
}

async detalhar(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.clientesService.detalhar(id, user.sub);
}
```

No service, importar `escopoRepresentantes` e substituir `buscarAtivo` pelo lookup único abaixo.
`incluirRemovido=true` existe exclusivamente para a restauração; o escopo continua aplicado:

```ts
private async buscarNoEscopo(
  id: string,
  usuarioId: string,
  exec: NodePgDatabase<typeof schema> = this.db,
  incluirRemovido = false,
): Promise<Cliente | null> {
  return exec
    .select()
    .from(clientes)
    .where(and(
      eq(clientes.id, id),
      incluirRemovido ? undefined : isNull(clientes.deletedAt),
      escopoRepresentantes(usuarioId, clientes.representanteId),
    ))
    .then((linhas) => linhas[0] ?? null);
}

private async exigirRepresentanteNoEscopo(
  tx: NodePgDatabase<typeof schema>,
  representanteId: string,
  usuarioId: string,
): Promise<void> {
  const permitido = await tx
    .select({ id: representantes.id })
    .from(representantes)
    .where(and(
      eq(representantes.id, representanteId),
      escopoRepresentantes(usuarioId, representantes.id),
    ))
    .limit(1)
    .then((linhas) => linhas[0] ?? null);
  if (!permitido) throw new NotFoundException('Cliente não encontrado');
}
```

As assinaturas e os pontos de guarda são fixos:

```ts
async listar(query: ListarQuery, usuarioId: string)
async detalhar(id: string, usuarioId: string)
async criar(dto: CreateClienteDto, usuarioId: string)
async atualizar(id: string, dto: UpdateClienteDto, usuarioId: string)
async remover(id: string, usuarioId: string)
async restaurar(id: string, usuarioId: string)
```

- `listar`: acrescentar
  `escopoRepresentantes(usuarioId, clientes.representanteId)` ao `where` usado por linhas e
  `totalRow`; acrescentá-lo também ao `where` independente de `totalAtivosRow`. Assim busca,
  paginação, total e badge ativo têm a mesma fronteira.
- `detalhar`: usar `buscarNoEscopo(id, usuarioId)`; a query de nomes de rota/representante só roda
  depois desse retorno autorizado e continua filtrada pelo mesmo `id`.
- `criar`: dentro da transação e antes de `assertUnico`/`INSERT`, executar
  `exigirRepresentanteNoEscopo(tx, dto.representanteId, usuarioId)`.
- `atualizar`: a primeira leitura dentro da transação é
  `buscarNoEscopo(id, usuarioId, tx)`; se `dto.representanteId` estiver presente, executar
  `exigirRepresentanteNoEscopo(tx, dto.representanteId, usuarioId)` antes do `UPDATE`, mesmo quando
  o valor coincide com o anterior.
- `remover`: a primeira leitura dentro da transação é
  `buscarNoEscopo(id, usuarioId, tx)`.
- `restaurar`: a primeira leitura dentro da transação é
  `buscarNoEscopo(id, usuarioId, tx, true)`; registro fora do escopo e ID inexistente produzem o
  mesmo `NotFoundException('Cliente não encontrado')`.

O restante dos corpos O4 — unicidade, `representanteId` obrigatório, rota, auditoria e retorno —
permanece byte a byte. Não existe bypass de administrador no frontend: administrador sem vínculos
já satisfaz Todos pelo builder D5.38.

### D5.40 — Cobertura completa de Pedidos e Adendos

Depois do merge da Onda 4 e da atualização da PR #28, alterar literalmente:

- `app/backend/src/modules/comercial/pedidos/pedidos.controller.ts`;
- `app/backend/src/modules/comercial/pedidos/pedidos.service.ts`;
- `app/backend/src/modules/comercial/pedidos/adendos.service.ts`.

O controller passa `user.sub` em **cada** rota. Este é o mapa normativo completo, conferido contra
o controller pós-O4:

| Endpoint | Chamada ao service |
|---|---|
| `GET /comercial/pedidos` | `service.listar(query, user.sub)` |
| `GET /comercial/pedidos/aberto` | `service.buscarAberto(query, user.sub)` |
| `GET /comercial/pedidos/:id` | `service.detalhar(id, user.sub)` |
| `POST /comercial/pedidos` | `service.criar(dto, user.sub, false)` |
| `POST /comercial/pedidos/confirmar-overbooking` | `service.criar(dto, user.sub, true)` |
| `POST /comercial/pedidos/:id/itens` | `service.incluirItem(id, dto, user.sub, false)` |
| `POST /comercial/pedidos/:id/itens/confirmar-overbooking` | `service.incluirItem(id, dto, user.sub, true)` |
| `PATCH /comercial/pedidos/:id/itens/:itemId` | `service.reduzirItem(id, itemId, dto, user.sub)` |
| `DELETE /comercial/pedidos/:id/itens/:itemId` | `service.removerItem(id, itemId, dto, user.sub)` |
| `POST /comercial/pedidos/:id/finalizar` | `service.finalizar(id, user.sub)` |
| `DELETE /comercial/pedidos/:id` | `service.cancelarPedido(id, dto.motivo, user.sub)` |
| `POST /comercial/pedidos/:id/liberar-reserva` | `service.liberarReservaAdministrativa(id, dto, user.sub)` |
| `GET /comercial/pedidos/:id/adendos` | `adendos.listar(id, user.sub)` |
| `POST /comercial/pedidos/:id/adendos` | `adendos.registrar(id, dto, user.sub, false)` |
| `POST /comercial/pedidos/:id/adendos/confirmar-overbooking` | `adendos.registrar(id, dto, user.sub, true)` |

Os três `GET` atuais ganham o decorator literalmente:

```ts
async listar(
  @Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.listar(query, user.sub);
}

async buscarAberto(
  @Query(new ZodValidationPipe(buscarPedidoAbertoSchema)) query: BuscarPedidoAbertoDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.buscarAberto(query, user.sub);
}

async detalhar(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.detalhar(id, user.sub);
}

async listarAdendos(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.adendos.listar(id, user.sub);
}
```

No `PedidosService`, importar `getTableColumns` e `escopoRepresentantes`. O guard único do
agregado, com e sem lock, é:

```ts
async exigirPedidoNoEscopo(
  tx: NodePgDatabase<typeof schema>,
  pedidoId: string,
  usuarioId: string,
  bloquear: boolean,
): Promise<PedidoVenda> {
  const consulta = tx
    .select(getTableColumns(pedidosVenda))
    .from(pedidosVenda)
    .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
    .where(and(
      eq(pedidosVenda.id, pedidoId),
      isNull(pedidosVenda.deletedAt),
      escopoRepresentantes(usuarioId, clientes.representanteId),
    ));
  const linhas = bloquear
    ? await consulta.for('update').limit(1)
    : await consulta.limit(1);
  const pedido = linhas[0];
  if (!pedido) throw new NotFoundException('Pedido não encontrado');
  return pedido;
}

private async exigirClienteNoEscopo(
  tx: NodePgDatabase<typeof schema>,
  clienteId: string,
  usuarioId: string,
) {
  const cliente = await tx
    .select({
      id: clientes.id,
      representanteId: clientes.representanteId,
      rotaId: clientes.rotaId,
    })
    .from(clientes)
    .where(and(
      eq(clientes.id, clienteId),
      isNull(clientes.deletedAt),
      escopoRepresentantes(usuarioId, clientes.representanteId),
    ))
    .limit(1)
    .then((linhas) => linhas[0] ?? null);
  if (!cliente) throw new NotFoundException('Cliente não encontrado');
  return cliente;
}
```

`obterPedidoAtivoSobLock` passa a receber `usuarioId` e delega sem outro lookup:

```ts
private obterPedidoAtivoSobLock(
  tx: NodePgDatabase<typeof schema>,
  pedidoId: string,
  usuarioId: string,
): Promise<PedidoVenda> {
  return this.exigirPedidoNoEscopo(tx, pedidoId, usuarioId, true);
}
```

O guard do item primeiro autoriza o Pedido e só depois lê/trava o item; assim ID de item válido em
Pedido proibido também vira 404:

```ts
private async obterItemAtivoSobLock(
  tx: NodePgDatabase<typeof schema>,
  pedidoId: string,
  itemId: string,
  usuarioId: string,
): Promise<PedidoVendaItem> {
  await this.exigirPedidoNoEscopo(tx, pedidoId, usuarioId, true);
  const item = await tx
    .select()
    .from(pedidosVendaItens)
    .where(and(
      eq(pedidosVendaItens.id, itemId),
      eq(pedidosVendaItens.pedidoVendaId, pedidoId),
      isNull(pedidosVendaItens.deletedAt),
    ))
    .for('update')
    .limit(1)
    .then((linhas) => linhas[0] ?? null);
  if (!item) throw new NotFoundException('Item do pedido não encontrado');
  return item;
}
```

Aplicação método a método no service:

| Método público pós-O4 | Guarda literal antes de ler/mutar |
|---|---|
| `listar(query, usuarioId)` | `innerJoin(clientes, ...)` + D5.38 tanto na query de linhas quanto em `totalRow` |
| `detalhar(id, usuarioId)` | abrir `db.transaction`; `exigirPedidoNoEscopo(tx, id, usuarioId, false)` antes da query relacional existente |
| `buscarAberto(query, usuarioId)` | acrescentar `innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))` e D5.38 ao `where` que já filtra cliente/operação/item/status |
| `criar(dto, usuarioId, confirmado)` | `exigirClienteNoEscopo(tx, dto.clienteId, usuarioId)` como primeira leitura na transação, antes de unicidade, planejamento, challenge ou `garantirOperacao` |
| `incluirItem(...)` / `incluirItemTransacional(...)` | `obterPedidoAtivoSobLock(tx, pedidoId, usuarioId)` |
| `reduzirItem(...)` | `obterItemAtivoSobLock(tx, pedidoId, itemId, usuarioId)` substitui o `select` atual |
| `removerItem(...)` | `obterItemAtivoSobLock(tx, pedidoId, itemId, usuarioId)` |
| `cancelarPedido(...)` | `obterPedidoAtivoSobLock(tx, pedidoId, usuarioId)` |
| `finalizar(...)` | `obterPedidoAtivoSobLock(tx, pedidoId, usuarioId)` |
| `liberarReservaAdministrativa(...)` | `obterPedidoAtivoSobLock(tx, pedidoId, usuarioId)` antes de ler itens/reservas |
| `carregarAbertoParaAdendo(tx, pedidoId, usuarioId)` | `exigirPedidoNoEscopo(tx, pedidoId, usuarioId, true)` e depois a validação dos status abertos |
| `exigirItemDoPedido(tx, pedidoId, itemComercialId, usuarioId)` | `exigirPedidoNoEscopo(tx, pedidoId, usuarioId, true)` antes do lookup do item |

Em `listar`, a query de total deixa de ler apenas `pedidosVenda`; ela repete o mesmo join e
predicado:

```ts
const filtroEscopo = escopoRepresentantes(usuarioId, clientes.representanteId);
const where = and(
  query.incluirRemovidos ? undefined : isNull(pedidosVenda.deletedAt),
  filtroEscopo,
);

const totalRow = await this.db
  .select({ total: sql<number>`count(*)::int` })
  .from(pedidosVenda)
  .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
  .where(where);
```

Em `AdendosService`, `registrar` mantém a assinatura pós-O4 e substitui exatamente as duas
primeiras leituras da transação pelo bloco abaixo; todo o corpo posterior — planejamento,
challenge read-only, update, reservas, adendo, auditoria, coleta e emissão pós-commit — permanece
inalterado:

```ts
const pedido = await this.pedidos.carregarAbertoParaAdendo(
  tx,
  pedidoId,
  usuarioId,
);
const item = await this.pedidos.exigirItemDoPedido(
  tx,
  pedidoId,
  dto.itemComercialId,
  usuarioId,
);
```

`listar` recebe o usuário e tem corpo completo:

```ts

async listar(pedidoId: string, usuarioId: string) {
  return this.db.transaction(async (tx) => {
    await this.pedidos.exigirPedidoNoEscopo(tx, pedidoId, usuarioId, false);
    return tx
      .select()
      .from(adendosPedido)
      .where(eq(adendosPedido.pedidoVendaId, pedidoId))
      .orderBy(desc(adendosPedido.criadoEm));
  });
}
```

Essa substituição não autoriza implementação alternativa. Os helpers transacionais de saldo/reserva/evento
(`planejarSobLock`, `persistirItensPlanejados`, `aplicarAlocacaoNoItem`,
`reduzirReservaOverbooking`, `liberarReservaReal`, `liberarTodasReservasDoItem`,
`cancelarPendenciasDoPedido`) não são entradas HTTP e só podem ser chamados no `tx` iniciado por
um método da tabela acima, após o guard. Os `*NaTx` introduzidos pela Task 6.4 obedecem à mesma
regra e não criam caminho público sem `usuarioId`.

Nenhuma ação fora do escopo chega a `INSERT`, `UPDATE`, `DELETE`, reserva, evento ou auditoria. O
conflito esperado em `pedidos.service.ts` é resolvido reaplicando a extração `NaTx` da Task 6.4
sobre a versão final da Onda 4 e mantendo `clientes.representante_id` como fonte única.

### D5.41 — Projeção reversa em Representantes

Em `RepresentantesService`, a lista passa a calcular `usuariosVinculadosCount` com usuários não
removidos. Acrescentar ao `select` já existente de `listar`:

```ts
const contagemUsuarios = sql<number>`(
  SELECT count(DISTINCT ur.usuario_id)::int
  FROM usuarios_representantes ur
  INNER JOIN usuarios u ON u.id = ur.usuario_id
  WHERE ur.representante_id = "representantes"."id"
    AND u.deleted_at IS NULL
)`;

// No select da lista:
usuariosVinculadosCount: contagemUsuarios,
```

O tipo da linha da lista ganha `usuariosVinculadosCount: number`; ele nunca recebe o array de
detalhe. No método `detalhar`, depois de autorizar/carregar o representante, executar esta query:

```ts
const usuariosVinculados = await this.db
  .select({
    id: schema.usuarios.id,
    nome: schema.usuarios.nome,
    email: schema.usuarios.email,
    ativo: schema.usuarios.ativo,
  })
  .from(schema.usuariosRepresentantes)
  .innerJoin(
    schema.usuarios,
    eq(schema.usuarios.id, schema.usuariosRepresentantes.usuarioId),
  )
  .where(and(
    eq(schema.usuariosRepresentantes.representanteId, id),
    isNull(schema.usuarios.deletedAt),
  ))
  .orderBy(asc(schema.usuarios.nome), asc(schema.usuarios.id));

return {
  ...representante,
  clientesVinculados,
  usuariosVinculados,
};
```

No frontend, `app/frontend/src/lib/representantes.ts` declara sem união ambígua:

```ts
export interface UsuarioVinculado {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface Representante {
  // campos vigentes
  clientesVinculados?: number | ClienteVinculado[];
  usuariosVinculadosCount: number;
  usuariosVinculados?: UsuarioVinculado[];
}
```

A tabela de `representantes-client.tsx` acrescenta a sétima coluna literal do protótipo:

```tsx
{
  chave: 'usuariosVinculadosCount',
  titulo: 'Usuários vinculados',
  render: (representante) => (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-text-slate">
      {representante.usuariosVinculadosCount}
    </span>
  ),
}
```

O registro da lista **não** é usado como detalhe. Criar
`app/frontend/src/app/(admin)/cadastros/representantes/usuarios-vinculados.tsx`; este componente é
o consumidor fixo de `GET /api/cadastros/representantes/:id`, BFF de detalhe já existente:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { extrairMensagemErro } from '@/lib/error-message';
import type { Representante, UsuarioVinculado } from '@/lib/representantes';
import { Button } from '@/components/ui/button';

export function UsuariosVinculados({
  representanteId,
}: {
  representanteId: string;
}) {
  const [usuarios, setUsuarios] = useState<UsuarioVinculado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setUsuarios(null);
    setErro(null);
    try {
      const resposta = await fetch(
        `/api/cadastros/representantes/${representanteId}`,
        { cache: 'no-store' },
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        setErro(extrairMensagemErro(
          corpo,
          'Não foi possível carregar os usuários vinculados.',
        ));
        return;
      }
      const detalhe = (await resposta.json()) as Representante;
      setUsuarios(detalhe.usuariosVinculados ?? []);
    } catch {
      setErro('Não foi possível carregar os usuários vinculados.');
    }
  }, [representanteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-semibold text-text-graphite">
        Usuários vinculados{usuarios !== null ? ` (${usuarios.length})` : ''}
      </p>
      {erro ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-[12px] text-destructive">{erro}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void carregar()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : usuarios === null ? (
        <p aria-busy="true" className="text-[12px] text-text-muted">
          Carregando usuários vinculados…
        </p>
      ) : usuarios.length === 0 ? (
        <p className="text-[12px] text-text-muted">Nenhum usuário vinculado.</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-subtle p-3">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="text-[12px] text-text-ink">
              <span className="font-medium">{usuario.nome}</span>
              <span className="ml-1 text-text-muted">{usuario.email}</span>
              {!usuario.ativo && <span className="ml-1">(Inativo)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Em `representantes-client.tsx`, o consumidor do drawer fica explícito e preserva a ordem do
protótipo — Clientes, depois Usuários:

```tsx
blocosDrawer={(representante) => (
  representante ? (
    <>
      <ClientesVinculados representanteId={representante.id} />
      <UsuariosVinculados representanteId={representante.id} />
    </>
  ) : null
)}
```

`representantes-client.test.tsx` importa `UsuariosVinculados` e prova, no teste nomeado do critério
6.24, a URL exata do BFF, estado `aria-busy`, resposta com dois usuários ordenados, vazio, erro real
e clique em `Tentar novamente`. Um mutante que renderiza apenas
`usuariosVinculadosCount` do registro resumido deve falhar. Não materializar contagem em coluna de
banco; zero na tabela vira `0` e o drawer usa o estado vazio literal, nunca dado de exemplo.

O teste 6.24 é escrito por extenso no arquivo existente:

```tsx
it('busca o detalhe e mostra usuários vinculados em todos os estados', async () => {
  let concluirPrimeira!: (response: Response) => void;
  const fetchMock = jest.fn()
    .mockImplementationOnce(() => new Promise<Response>((resolve) => {
      concluirPrimeira = resolve;
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'r1',
      usuariosVinculados: [
        { id: 'u1', nome: 'Ana', email: 'ana@alpha.test', ativo: true },
        { id: 'u2', nome: 'Beto', email: 'beto@alpha.test', ativo: false },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'r1',
      usuariosVinculados: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  global.fetch = fetchMock as unknown as typeof fetch;

  const primeira = render(<UsuariosVinculados representanteId="r1" />);
  expect(screen.getByText('Carregando usuários vinculados…')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  concluirPrimeira(new Response(JSON.stringify({
    message: 'Falha real do backend',
  }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha real do backend');

  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('ana@alpha.test')).toBeInTheDocument();
  expect(screen.getByText('beto@alpha.test')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/cadastros/representantes/r1',
    { cache: 'no-store' },
  );

  primeira.unmount();
  render(<UsuariosVinculados representanteId="r1" />);
  expect(await screen.findByText('Nenhum usuário vinculado.')).toBeInTheDocument();
});
```

### D5.42 — `/auth/me` e identificação do escopo

Em `AuthRepository`, acrescentar `asc` ao import de `drizzle-orm` e implementar a leitura completa,
sem filtrar `status`/`deletedAt` do representante:

```ts
export interface RepresentanteDoEscopo {
  id: string;
  nome: string;
}

async representantesDoUsuario(
  usuarioId: string,
): Promise<RepresentanteDoEscopo[]> {
  return this.db
    .select({
      id: schema.representantes.id,
      nome: schema.representantes.nome,
    })
    .from(schema.usuariosRepresentantes)
    .innerJoin(
      schema.representantes,
      eq(
        schema.representantes.id,
        schema.usuariosRepresentantes.representanteId,
      ),
    )
    .where(eq(schema.usuariosRepresentantes.usuarioId, usuarioId))
    .orderBy(asc(schema.representantes.nome), asc(schema.representantes.id));
}
```

`AuthService.montarMe` substitui o corpo atual por:

```ts
async montarMe(user: CurrentUserPayload): Promise<
  CurrentUserPayload & {
    menusVisiveis: string[];
    escopoRepresentantes: {
      tipo: 'todos' | 'restrito';
      representantes: Array<{ id: string; nome: string }>;
    };
  }
> {
  const [menusVisiveis, representantes] = await Promise.all([
    this.rbacService.menusVisiveisDePerfis(user.perfis),
    this.authRepository.representantesDoUsuario(user.sub),
  ]);
  return {
    ...user,
    menusVisiveis,
    escopoRepresentantes: {
      tipo: representantes.length === 0 ? 'todos' : 'restrito',
      representantes,
    },
  };
}
```

O JWT não ganha IDs de representante e não vira cache de autorização; cada `/auth/me` e cada
endpoint de domínio consultam o banco vigente. `tipo='todos'` somente quando não há linha na
associação.

O frontend estende `UserPayload` literalmente:

```ts
escopoRepresentantes: {
  tipo: 'todos' | 'restrito';
  representantes: Array<{ id: string; nome: string }>;
};
```

`app/frontend/src/app/(admin)/layout.tsx` passa `user.escopoRepresentantes` ao `AdminHeader`; o
header repõe o rótulo "Escopo" do protótipo `src/app/components/Layout.tsx`:

- Todos → `Todos`;
- um vínculo → nome do representante;
- mais de um → nomes separados por vírgula, truncados visualmente, com a lista completa no
  atributo `title`.

O cabeçalho não decide autorização e não oferece seletor. É apenas identificação do escopo real.

### D5.43 — BFF

Criar somente a rota nova
`app/frontend/src/app/api/admin/usuarios/[id]/representantes/route.ts`, com este conteúdo completo.
Ela usa `apiFetch`, não `fetchBackend`, e encaminha o `ReadableStream` da resposta: bytes,
`Content-Type` e status 200/400/403/404 permanecem os do backend.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(
  request: NextRequest,
  contexto: Contexto,
): Promise<NextResponse> {
  const { id } = await contexto.params;
  const contentType = request.headers.get('content-type') ?? 'application/json';
  const resposta = await apiFetch(
    `/usuarios/${encodeURIComponent(id)}/representantes`,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: await request.arrayBuffer(),
    },
  );

  const headers = new Headers();
  const responseContentType = resposta.headers.get('content-type');
  if (responseContentType) headers.set('Content-Type', responseContentType);
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers,
  });
}
```

O teste 6.21 instancia o handler real, mocka `apiFetch` com um corpo binário conhecido e compara
`Uint8Array(await response.arrayBuffer())`, status e `Content-Type`; deve falhar se o handler
chamar `response.json()`, `response.text()`, `fetchBackend`, hardcodar status ou reconstruir
`{ message }`.

Bloco literal em `bff-onda5.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import { PUT as putRepresentantes } from
  '@/app/api/admin/usuarios/[id]/representantes/route';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
const apiFetchMock = jest.mocked(apiFetch);

it.each([400, 403] as const)(
  'repassa representantes permitidos sem mascarar erro HTTP %s',
  async (statusBackend) => {
    const requestBytes = new TextEncoder().encode(
      '{"representantes":["00000000-0000-4000-8000-000000000001"]}',
    );
    const responseBytes = new TextEncoder().encode(
      '{"code":"REPRESENTANTES_INVALIDOS","detalhe":"á"}',
    );
    apiFetchMock.mockResolvedValueOnce(new Response(responseBytes, {
      status: statusBackend,
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    }));

    const request = new NextRequest(
      'http://localhost/api/admin/usuarios/u-1/representantes',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: requestBytes,
      },
    );
    const response = await putRepresentantes(request, {
      params: Promise.resolve({ id: 'u-1' }),
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/usuarios/u-1/representantes',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [, init] = apiFetchMock.mock.calls[0]!;
    expect(new Uint8Array(init!.body as ArrayBuffer)).toEqual(requestBytes);
    expect(response.status).toBe(statusBackend);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(responseBytes);
  },
);
```

Criação já usa `POST /api/admin/usuarios`; o body ganha `representantes`. Opções usam o BFF
paginado existente de `GET /api/cadastros/representantes`: a UI percorre as páginas, mantendo
`page` e `pageSize`, e oferece `Carregar mais` enquanto `data.length < total`. Busca envia
`search` ao servidor e reinicia em `page=1`; não truncar silenciosamente no primeiro lote. Não
criar catch-all, proxy direto do browser, fallback ou mock.

### D5.44 — UI completa de `/admin/usuarios`

Preservar a página e o drawer existentes e criar
`app/frontend/src/app/(admin)/admin/usuarios/_components/representantes-permitidos.tsx`:

- título literal **Representantes permitidos**;
- ajuda literal **Sem seleção, o usuário acessa Todos os representantes**;
- busca por nome e lista de checkboxes com nome, canal e badge de status;
- resumo visível `Todos` quando vazio e "`N` selecionado(s)" quando restrito;
- ordem alfabética; itens inativos/removidos já vinculados permanecem visíveis e podem ser
  desmarcados, mas não podem ser selecionados novamente;
- estado inicial carregado do usuário em edição;
- criação envia `representantes` junto do `POST`, portanto não existe usuário parcialmente criado;
- edição salva dados básicos primeiro e executa o `PUT` somente se o conjunto mudou; se uma das
  ações falhar, o drawer permanece aberto, mostra o erro real e recarrega o estado confirmado pelo
  backend antes de permitir nova tentativa.

O cabeçalho e a tabela reproduzem também os dois elementos existentes no protótipo
`src/app/pages/Usuarios.tsx`, hoje ausentes na tela real:

1. botão `Filtros`, com ícone `Filter`, `variant="outline"` e posição imediatamente antes de
   `Novo Usuário`;
2. coluna `Último Acesso` entre `Status` e `Ações`.

`Filtros` não pode ser inerte. Ele é o trigger de um `Popover` com dois filtros sobre dados reais
já carregados: `Perfil de acesso` (`Todos` + os perfis retornados por `/api/admin/perfis`) e
`Status` (`Todos`, `Ativo`, `Inativo`), além de `Limpar filtros`. O estado fechado mantém
exatamente a composição do protótipo; o protótipo não define a superfície aberta, portanto o
popover usa apenas componentes/tokens do DS e não altera a grade `8/4`. Aplicação literal:

```tsx
const [perfilFiltro, setPerfilFiltro] = useState('todos');
const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');

const usuariosFiltrados = usuarios.filter((usuario) => {
  const atendePerfil =
    perfilFiltro === 'todos' || usuario.perfis.includes(perfilFiltro);
  const atendeStatus =
    statusFiltro === 'todos'
    || (statusFiltro === 'ativo' ? usuario.ativo : !usuario.ativo);
  return atendePerfil && atendeStatus;
});
```

O trigger e os controles têm nomes acessíveis fixos:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" aria-label="Filtros">
      <Filter className="mr-2 h-4 w-4" />
      Filtros
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-72 space-y-3">
    <label className="block text-sm font-medium" htmlFor="filtro-perfil">
      Perfil de acesso
    </label>
    <select
      id="filtro-perfil"
      value={perfilFiltro}
      onChange={(event) => setPerfilFiltro(event.target.value)}
      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
    >
      <option value="todos">Todos</option>
      {perfis.map((perfil) => (
        <option key={perfil.slug} value={perfil.slug}>{perfil.nome}</option>
      ))}
    </select>
    <label className="block text-sm font-medium" htmlFor="filtro-status">
      Status
    </label>
    <select
      id="filtro-status"
      value={statusFiltro}
      onChange={(event) =>
        setStatusFiltro(event.target.value as 'todos' | 'ativo' | 'inativo')
      }
      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
    >
      <option value="todos">Todos</option>
      <option value="ativo">Ativo</option>
      <option value="inativo">Inativo</option>
    </select>
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        setPerfilFiltro('todos');
        setStatusFiltro('todos');
      }}
    >
      Limpar filtros
    </Button>
  </PopoverContent>
</Popover>
```

O `tbody` itera `usuariosFiltrados`. Combinação sem resultado renderiza
`Nenhum usuário encontrado para os filtros aplicados.`; a lista não é sobrescrita e limpar repõe
todos os registros.

`Usuario` em `src/lib/usuarios.ts` ganha `ultimoAcesso: string | null`. A célula usa somente o
valor real entregue pelo backend:

```tsx
function formatarUltimoAcesso(valor: string | null): string {
  if (valor === null) return 'Nunca acessou';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));
}

<th className="pb-3 font-medium">Último Acesso</th>
// na linha:
<td className="py-4 text-muted-foreground">
  {formatarUltimoAcesso(usuario.ultimoAcesso)}
</td>
```

Não usar `createdAt`, relógio local relativo, seed nem texto de exemplo como substituto de
`ultimoAcesso`. `null` é mostrado explicitamente como `Nunca acessou`.

Em `usuarios-client.test.tsx`, os dois testes novos usam a resposta realista abaixo para
`/api/admin/usuarios` e a lista de perfis para `/api/admin/perfis`; o mock de
`/resumo-perfis` continua devolvendo seu array vigente:

```ts
const USUARIOS_FILTRO = [
  {
    id: 'u-admin',
    nome: 'Ana Costa',
    email: 'ana@alphacarnes.com',
    ativo: true,
    perfis: ['administrador'],
    ultimoAcesso: '2026-07-28T11:30:00.000Z',
    representantesPermitidos: [],
    escopoRepresentantes: 'todos',
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-28T11:30:00.000Z',
    deletedAt: null,
  },
  {
    id: 'u-comercial',
    nome: 'Carlos Souza',
    email: 'carlos@alphacarnes.com',
    ativo: false,
    perfis: ['comercial'],
    ultimoAcesso: null,
    representantesPermitidos: [],
    escopoRepresentantes: 'todos',
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    deletedAt: null,
  },
];

beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/admin/usuarios')) {
      return { ok: true, json: async () => USUARIOS_FILTRO };
    }
    if (url.endsWith('/api/admin/perfis')) {
      return {
        ok: true,
        json: async () => [
          { slug: 'administrador', nome: 'Administrador', permissoes: [] },
          { slug: 'comercial', nome: 'Comercial', permissoes: [] },
        ],
      };
    }
    if (url.endsWith('/api/admin/usuarios/resumo-perfis')) {
      return { ok: true, json: async () => [] };
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  }) as unknown as typeof fetch;
});

it('filtra usuários por perfil e status sem ação inerte', async () => {
  render(<UsuariosAdminClient permissoes={['USUARIOS_LER']} />);
  await screen.findByText('Ana Costa');

  fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
  fireEvent.change(screen.getByLabelText('Perfil de acesso'), {
    target: { value: 'comercial' },
  });
  expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
  expect(screen.getByText('Carlos Souza')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'ativo' },
  });
  expect(screen.getByText(
    'Nenhum usuário encontrado para os filtros aplicados.',
  )).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByText('Ana Costa')).toBeInTheDocument();
  expect(screen.getByText('Carlos Souza')).toBeInTheDocument();
});

it('renderiza último acesso real e ausência explícita', async () => {
  render(<UsuariosAdminClient permissoes={['USUARIOS_LER']} />);
  await screen.findByText('Ana Costa');

  const cabecalhos = screen
    .getAllByRole('columnheader')
    .map((elemento) => elemento.textContent);
  expect(cabecalhos).toEqual([
    'Nome / E-mail',
    'Perfis',
    'Status',
    'Último Acesso',
    'Ações',
  ]);
  expect(screen.getByText(/28\/07\/2026.*08:30/)).toBeInTheDocument();
  expect(screen.getByText('Nunca acessou')).toBeInTheDocument();
});
```

Antes de cada teste, o mock obrigatório roteia URLs por pathname; é proibido responder com o
mesmo shape a Usuários, Perfis e Resumo. O primeiro teste mata botão inerte, filtro que não combina
Perfil+Status e limpeza que não repõe a lista; o segundo mata coluna ausente, uso de `createdAt` e
placeholder para `null`.

Estados obrigatórios:

| Estado | Renderização/ação |
|---|---|
| Carregando opções | skeleton dentro do bloco; Salvar desabilitado |
| Erro ao carregar | `role="alert"`, mensagem real e botão `Tentar novamente`; Salvar desabilitado |
| Nenhum representante cadastrado | estado vazio e significado `Todos`; sem checkbox inventado |
| Lista vazia selecionada | resumo `Todos` + texto de ajuda |
| Lista não vazia | checkboxes selecionados + contagem |
| Erro 400 de validação | mensagem no bloco; manter seleções |
| Erro 403 | banner do drawer; nenhuma alteração otimista |
| Salvando | controles e fechamento desabilitados; texto `Salvando...` |
| Sucesso | atualizar lista/detalhe com resposta real, toast e fechar drawer |

O drawer mantém largura, espaçamentos, grade e ordem existentes. O bloco entra depois de Perfis e
antes das ações, acompanhando o significado funcional da documentação. Nenhum controle inerte.

### D5.45 — Eventos e cache

Alterar escopo não emite evento operacional nem WebSocket: a regra vale na próxima requisição e
não há tela colaborativa que dependa de broadcast. Depois do `PUT`, o frontend invalida apenas os
dados locais de Usuários e Representantes. A sessão do próprio usuário obtém o novo escopo no
próximo `/auth/me`; não há cache persistente de autorização no backend.

### D5.46 — Evidência e proibições

- Não criar perfil, permissão, representante sentinela "Todos", coluna de representante em Pedido,
  regra no frontend, seed de vínculo, fallback, botão inerte ou dado de demonstração.
- Não alterar `DECISOES.md`, `EXECUCAO-STATUS.md`, `GATE-STATUS.md` ou outro plano nesta emenda.
- O Worker registra evidências reais:
  `docs/evidencias/onda5-gestao/admin-usuarios-todos.png`,
  `docs/evidencias/onda5-gestao/admin-usuarios-restrito.png` e
  `docs/evidencias/onda5-gestao/representante-usuarios-vinculados.png`.

## E5.1.3 Estrutura de arquivos da emenda

### Backend novos — delta +4; total da Onda 5 = 30

```text
app/backend/src/database/migrations/0019_onda5_usuarios_representantes.sql
app/backend/src/common/rbac/escopo-representantes.ts
app/backend/test/integration/usuarios-representantes.e2e-spec.ts
app/backend/test/integration/escopo-representantes.e2e-spec.ts
```

### Backend alterados — delta exclusivo +14; união da Onda 5 = 43

`_journal.json` e `pedidos.service.ts` já estavam na lista original; por isso os 16 toques abaixo
acrescentam 14 caminhos à união:

```text
app/backend/src/database/migrations/meta/_journal.json
app/backend/src/database/migrations/ROLLBACK.md
app/backend/src/database/schema/auth.schema.ts
app/backend/src/modules/usuarios/dto/create-usuario.dto.ts
app/backend/src/modules/usuarios/dto/update-usuario.dto.ts
app/backend/src/modules/usuarios/usuarios.controller.ts
app/backend/src/modules/usuarios/usuarios.service.ts
app/backend/src/modules/cadastros/representantes/representantes.service.ts
app/backend/src/modules/cadastros/clientes/clientes.controller.ts
app/backend/src/modules/cadastros/clientes/clientes.service.ts
app/backend/src/modules/comercial/pedidos/pedidos.controller.ts
app/backend/src/modules/comercial/pedidos/pedidos.service.ts
app/backend/src/modules/comercial/pedidos/adendos.service.ts
app/backend/src/modules/auth/auth.repository.ts
app/backend/src/modules/auth/auth.service.ts
app/backend/test/helpers/test-app.ts
```

Se a Onda 4 localizar `adendos.*` em subpasta diferente, o Worker segue o arquivo real que declara
`AdendosController`/`AdendosService`, registra o caminho no PR e não cria uma segunda classe.

### Frontend novos — delta +3; união sem testes = 37

```text
app/frontend/src/app/api/admin/usuarios/[id]/representantes/route.ts
app/frontend/src/app/(admin)/admin/usuarios/_components/representantes-permitidos.tsx
app/frontend/src/app/(admin)/cadastros/representantes/usuarios-vinculados.tsx
```

### Frontend alterados — delta +7; união da Onda 5 = 19

```text
app/frontend/src/lib/usuarios.ts
app/frontend/src/app/(admin)/admin/usuarios/usuarios-client.tsx
app/frontend/src/lib/representantes.ts
app/frontend/src/app/(admin)/cadastros/representantes/representantes-client.tsx
app/frontend/src/lib/auth.ts
app/frontend/src/components/ui/admin-header.tsx
app/frontend/src/app/(admin)/layout.tsx
```

### Testes frontend

Novo — delta +1; total de specs frontend novas = 12:

```text
app/frontend/e2e/onda5-usuarios-representantes.spec.ts
```

Alterar, sem criar contagem falsa:

```text
app/frontend/__tests__/usuarios-client.test.tsx
app/frontend/__tests__/representantes-client.test.tsx
app/frontend/__tests__/admin-header.test.tsx
app/frontend/__tests__/bff-onda5.test.ts
app/frontend/__tests__/terminologia.test.ts
```

## E5.1.4 Mapa DoD → teste 1:1 adicional

As 28 linhas abaixo somam-se às 63 originais. Total normativo: **91** critérios.

| # | Critério | Teste literal |
|---|---|---|
| 6.1 | Migration cria PK composta, duas FKs `RESTRICT`, `created_at` e índice reverso | `usuarios-representantes.e2e-spec.ts` › "migration materializa constraints e índices de usuarios_representantes" |
| 6.2 | Migration sobe em banco limpo, reaplica sem drift e rollback documentado remove primeiro a associação | `usuarios-representantes.e2e-spec.ts` › "migração 0019 integra a journal sem drift" |
| 6.3 | `PUT /usuarios/:id/representantes` exige JWT e `USUARIOS_GERENCIAR` | `usuarios-representantes.e2e-spec.ts` › "nega anônimo e gestor e permite administrador" |
| 6.4 | DTO rejeita UUID inválido e duplicidade | `usuarios-representantes.e2e-spec.ts` › "valida o conjunto de representantes" |
| 6.5 | ID inexistente ou novo vínculo removido retorna 400 e rollback integral | `usuarios-representantes.e2e-spec.ts` › "não grava conjunto parcialmente inválido" |
| 6.6 | Lista vazia persiste como `todos`; lista não vazia como `restrito` | `usuarios-representantes.e2e-spec.ts` › "expõe semântica todos e restrito sem sentinela" |
| 6.7 | Repetir conjunto normalizado não reescreve nem audita | `usuarios-representantes.e2e-spec.ts` › "mesmo conjunto é no-op" |
| 6.8 | Troca grava before/after ordenado na auditoria na mesma transação | `usuarios-representantes.e2e-spec.ts` › "audita substituição com antes e depois" |
| 6.9 | `POST /usuarios` cria usuário, perfis, vínculos e auditoria atomicamente | `usuarios-representantes.e2e-spec.ts` › "criação com escopo é atômica" |
| 6.10 | Soft delete/restore de usuário preserva vínculos e escopo | `usuarios-representantes.e2e-spec.ts` › "restauração preserva representantes permitidos" |
| 6.11 | Representante inativo/removido vinculado não converte escopo restrito em Todos | `escopo-representantes.e2e-spec.ts` › "inativação não amplia autorização" |
| 6.12 | Cliente: lista e total contêm somente representantes permitidos | `escopo-representantes.e2e-spec.ts` › "dois usuários obtêm linhas e totais distintos de clientes" |
| 6.13 | Cliente: detalhe/update/remove/restore fora do escopo retornam 404 e não mutam | `escopo-representantes.e2e-spec.ts` › "oculta e protege todas as mutações de cliente fora do escopo" |
| 6.14 | Cliente: create e troca de representante rejeitam destino fora do escopo | `escopo-representantes.e2e-spec.ts` › "não cria nem transfere cliente para representante proibido" |
| 6.15 | Pedido: lista e total usam o representante do Cliente | `escopo-representantes.e2e-spec.ts` › "dois usuários obtêm pedidos distintos pelo cliente" |
| 6.16 | Pedido: detalhe, pedido aberto, transições e itens fora do escopo retornam 404 e não mutam | `escopo-representantes.e2e-spec.ts` › "protege leituras e mutações de pedido fora do escopo" |
| 6.17 | Adendos fora do escopo não podem ser listados, criados nem confirmados com overbooking | `escopo-representantes.e2e-spec.ts` › "protege ciclo completo de adendo pelo cliente do pedido" |
| 6.18 | Pedido não recebe coluna/valor duplicado de representante | `escopo-representantes.e2e-spec.ts` › "deriva representante somente de clientes.representante_id" |
| 6.19 | Representantes lista contagem e detalhe lista usuários vinculados reais | `usuarios-representantes.e2e-spec.ts` › "projeta usuários vinculados ordenados por representante" |
| 6.20 | `/auth/me` devolve `todos` ou nomes reais do conjunto restrito | `usuarios-representantes.e2e-spec.ts` › "auth me expõe escopo real da sessão" |
| 6.21 | BFF do `PUT` preserva cookie, body, status 400/403 e corpo | `bff-onda5.test.ts` › `it.each([400, 403])` "repassa representantes permitidos sem mascarar erro HTTP %s" |
| 6.22 | Drawer mostra loading, erro+retry, vazio Todos e lista real | `usuarios-client.test.tsx` › "renderiza todos os estados de representantes permitidos" |
| 6.23 | Criação envia representantes no POST; edição usa PUT só quando muda; erro mantém drawer aberto | `usuarios-client.test.tsx` › "salva criação atômica e edição dedicada sem estado otimista falso" |
| 6.24 | Representantes repõe sétima coluna com `usuariosVinculadosCount`; o drawer busca `GET /api/cadastros/representantes/:id` e mostra loading, erro+retry, vazio e `usuariosVinculados[]` real | `representantes-client.test.tsx` › "busca o detalhe e mostra usuários vinculados em todos os estados" |
| 6.25 | Header identifica Todos, um nome e múltiplos sem permitir editar escopo | `admin-header.test.tsx` › "renderiza o escopo real da sessão" |
| 6.26 | Jornada admin define escopo e dois usuários comerciais veem clientes/pedidos distintos | `e2e/onda5-usuarios-representantes.spec.ts` › "admin configura escopo e backend o aplica ponta a ponta" |
| 6.27 | Ação `Filtros` ocupa a posição do protótipo, abre controles funcionais de Perfil/Status, combina os predicados, mostra vazio e `Limpar filtros` repõe a lista | `usuarios-client.test.tsx` › "filtra usuários por perfil e status sem ação inerte" |
| 6.28 | Coluna `Último Acesso` ocupa a posição do protótipo, formata o timestamp real e mostra `Nunca acessou` somente para `null` | `usuarios-client.test.tsx` › "renderiza último acesso real e ausência explícita" |

`terminologia.test.ts` inclui `usuarios-client.tsx`,
`representantes-permitidos.tsx`, `representantes-client.tsx` e `admin-header.tsx` na varredura. O
snapshot de RBAC existente ganha uma asserção negativa: a emenda não acrescenta permissão.

## E5.1.5 Tasks executáveis

### Task 19 — Base pós-O4, migration, schema e contrato

**Pré-condição bloqueante:** O4 mergeada em `develop`; PR #28 atualizada sobre esse head; árvore
limpa. O Executor registra no comentário da PR #28 os SHAs de `develop` e `HEAD` antes da emenda.
Se a O4 não estiver mergeada, parar como `blocked`; é uma dependência técnica ainda não satisfeita,
não uma decisão do Quality Owner, e não autoriza implementar um segundo contrato comercial.

1. Rodar os testes 6.1–6.5 em vermelho.
2. Criar `0019_onda5_usuarios_representantes.sql`, atualizar `_journal.json`,
   `auth.schema.ts`, `ROLLBACK.md` e helpers de limpeza.
3. Implementar os schemas Zod D5.35.
4. Rodar:

```bash
cd app/backend
npm run db:migrate
npm run db:migrate
npm run type-check
npm test -- usuarios-representantes.e2e-spec.ts --runInBand
```

**Commit:** `feat(onda5): criar escopo de representantes por usuário`

### Task 20 — Service/controller, autorização comercial e projeções

1. Escrever os testes 6.6–6.20 em vermelho.
2. Implementar D5.36–D5.42 exatamente nos arquivos inventariados.
3. Aplicar o predicado único a todas as rotas de Cliente, Pedido e Adendo. Buscar cada método
   público com `rg` e provar que recebe `usuarioId` ou é privado e chamado após guard no mesmo
   `tx`.
4. Rodar primeiro as specs focadas e depois as regressões O3/O4:

```bash
cd app/backend
npm test -- usuarios-representantes.e2e-spec.ts escopo-representantes.e2e-spec.ts --runInBand
npm test -- clientes pedidos adendos auth representantes --runInBand
npm run type-check
```

**Commit:** `feat(onda5): aplicar escopo de representantes em clientes e pedidos`

### Task 21 — BFF, Usuários, Representantes e header

1. Escrever 6.21–6.25 e 6.27–6.28 em vermelho.
2. Criar o BFF e os dois componentes; alterar os sete arquivos frontend inventariados.
3. Conferir `src/app/pages/Usuarios.tsx`, `src/app/pages/Representantes.tsx` e
   `src/app/components/Layout.tsx` no commit de protótipo fixado antes de editar cada superfície.
4. Provar que o drawer de Representantes chama o BFF de detalhe; o item da lista só fornece
   `usuariosVinculadosCount` e não pode alimentar o bloco de usuários.
5. Provar que `Filtros` altera o conjunto renderizado e que `Último Acesso` usa
   `usuarios.ultimo_acesso`, incluindo o caso `null`.
6. Rodar:

```bash
cd app/frontend
npm test -- usuarios-client representantes-client admin-header bff-onda5 terminologia --runInBand
npm run type-check
npm run build
```

**Commit:** `feat(onda5): completar representantes permitidos na interface`

### Task 22 — E2E, regressão, evidências e atualização da PR #28

1. Escrever e executar 6.26 com dois usuários comerciais, dois representantes, dois clientes e
   dois pedidos. Não usar seed como prova de autorização.
2. Capturar as três evidências D5.46 contra backend real.
3. Rodar o gate completo da Task 18.5, incluindo suites O4 e o novo E2E.
4. Acrescentar à descrição da PR #28:
   - referência à emenda E5.1 e hash do plano;
   - SHA da O4 mergeada e SHA da atualização da branch;
   - migration `0019`;
   - matriz dos 28 testes;
   - evidências das três superfícies;
   - conflitos resolvidos, especialmente `pedidos.service.ts`;
   - confirmação de que nenhum perfil/permissão novo foi criado.
5. Não abrir uma segunda PR de implementação. Não pedir Portão 2 até o CI ficar verde no novo
   head da PR #28.

**Commit:** `test(onda5): provar escopo por representante ponta a ponta`

## E5.1.6 Ordem completa e impacto na PR #28

```text
Tasks 1–18 originais
  └─ Onda 4 mergeada em develop
      └─ atualizar feature/onda5-gestao (PR #28) sobre develop
          └─ Task 19 migration/schema/DTO
              └─ Task 20 backend e autorização
                  └─ Task 21 BFF/UI
                      └─ Task 22 E2E/evidências/gate/PR
```

Na data desta emenda, a PR #28 é draft, head `feature/onda5-gestao` em
`b5ed772c7c12dd8015343ba1fabd7263b8772b9c`, base `develop`; a O4 ainda não está mergeada em
`develop`. Esses SHAs são evidência de planejamento, não autorização para executar.

O Executor pode incorporar o novo `develop` por merge ou por rebase conforme o rito vigente, mas
não pode sobrescrever trabalho remoto sem conferir `git status`, `git log --left-right` e o head
da PR. Se usar rebase em branch publicada, qualquer atualização não fast-forward exige
coordenação explícita e `--force-with-lease`, nunca `--force`. O conflito conhecido é
`pedidos.service.ts`; resolver preservando simultaneamente a implementação O4 e os métodos `NaTx`
da O5, depois executar todas as suites citadas na Task 20.

## E5.1.7 Dívida reparada e dívidas remanescentes

**Reparada nesta onda:** O3 D43/O4 D26 — `usuarios_representantes`, Representantes permitidos,
escopo real de Clientes/Pedidos, projeção reversa de Usuários vinculados e identificação de escopo
no shell. Ela não pode permanecer em `EXECUCAO-STATUS` como dívida diferida após o aceite da Task
22.

As cinco dívidas originais da Onda 5 permanecem exatamente como registradas; esta emenda não cria
uma sexta dívida e não fecha P1/P8.

## E5.1.8 Autorrevisão e contagens normativas

| Item | Resultado |
|---|---|
| Contrato O3→O4→O5 recuperado | Sim — D43, D13.b e D26 estão materializados |
| Sem decisão humana pendente | Sim — vazio=Todos e não vazio=restrito já eram contratos de fonte |
| Migration/constraints/índices/política de remoção | Sim — D5.33–D5.34 |
| DTO/service/controller/RBAC/auditoria | Sim — D5.35–D5.37 |
| Escopo completo em Clientes/Pedidos/Adendos | Sim — D5.38–D5.40 |
| BFF e UI com todos os estados | Sim — D5.41, D5.43–D5.44 fixam produtor, detalhe, bytes/status, loading, erro/retry, vazio, filtros e Último Acesso |
| Fidelidade a Usuários/Representantes/Layout | Sim — `Usuarios.tsx`, `Representantes.tsx` e `src/app/components/Layout.tsx` no pin fixado |
| Mapa DoD→teste 1:1 | Sim — 28 critérios adicionais, todos nomeados |
| Arquivos, tasks, ordem e commits literais | Sim — inventário e Tasks 19–22 |
| Impacto pós-O4 na PR #28 | Sim — pré-condição, conflito, atualização e gate explícitos |
| Perfil ou permissão inventados | Não — snapshot deve permanecer sem nova chave |
| Dado, fallback, seed de runtime ou controle inerte | Não |
| Dívida órfã ainda aberta | Não — E5.1.7 fecha o único item em escopo |

| Métrica final da Onda 5 | Valor normativo |
|---|---|
| Rotas completas | 7 + complemento em `/cadastros/representantes` |
| Tasks | 22 |
| Commits previstos | 22 |
| Decisões fixadas | 46 (D5.1–D5.46) |
| Critérios DoD→teste | 91 (63 + 28) |
| Migrations | 2 (`0018` + `0019`) |
| Tabelas novas | 4 (3 originais + `usuarios_representantes`) |
| Endpoints novos | 14 (13 originais + `PUT /usuarios/:id/representantes`) |
| Permissões novas | 5 originais; **0** pela emenda |
| Arquivos backend novos | 30 |
| Arquivos backend alterados, união | 43 |
| Arquivos frontend novos, sem testes | 37 |
| Arquivos frontend alterados, união | 19 |
| Specs backend novas | 13 + 1 helper original |
| Specs frontend novas | 12 |
| Dívidas remanescentes | 5 originais; dívida O3 D43/O4 D26 reparada |
