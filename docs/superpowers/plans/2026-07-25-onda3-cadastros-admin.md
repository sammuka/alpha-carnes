# Onda 3 — Cadastros & Regras completos + Administração

**Data:** 2026-07-25
**Branch de implementação:** `feature/onda3-cadastros-admin` (a criar a partir de `develop` já com a Onda 2 mergeada — `18f98bb`)
**Dependência:** Onda 2 (Shell + DS) mergeada. Status registrado em `e840bea`.
**Ciclo:** v1.1, onda 3 de 10 (`docs/governance/roadmap-canonico.md` §8)
**Rito:** `docs/governance/pipeline-execucao.md` — este documento é o artefato do Portão 1.

---

## Goal

Entregar, completas e ponta a ponta, as **12 rotas** das seções *Cadastros & Regras* e *Administração* do
protótipo validado (linhas 30–41 da matriz de rastreabilidade v1.1), com backend real, BFF, tela idêntica
ao protótipo e teste automatizado para cada invariante — e **fechar as três dívidas** que a Onda 2 deixou
explicitamente para esta onda:

| Dívida herdada | Origem | Fechamento nesta onda |
|---|---|---|
| **26 perdas de item por gate de grupo** | decisão 25 da Onda 2 | Decisões 4–9; Tasks 1, 2, 8, 11; invariantes DoD-01…DoD-08 |
| **Conciliação catálogo × matriz (extras sem atribuição)** | decisão 31 da Onda 2 | Decisões 4–7; Tasks 1, 2, 11; invariantes DoD-05, DoD-06, DoD-08 |
| **`/admin/auditoria` — alinhamento de filtros e visual** | decisão 27 da Onda 2 | Decisões 30–32; Tasks 9 e 24; invariantes DoD-33…DoD-35 e DoD-65…DoD-69 |

Ao final da onda: `filtrarMenuPorPermissoes` deixa de existir, **perdas = 0** e **extras = 0** contra a
matriz v1.1, e nenhuma das 12 rotas usa `PlaceholderPage`.

### As 12 rotas do escopo

| # | Linha da matriz | Rota | Estado hoje | Entrega |
|---|---|---|---|---|
| 1 | 30 | `/cadastros/representantes` | `PlaceholderPage` (5 linhas) | tela completa + backend já existente estendido |
| 2 | 31 | `/cadastros/produtos` | cliente real (571 linhas), abas fora do protótipo | alinhamento total ao protótipo |
| 3 | 32 | `/cadastros/fornecedores` | genérico `CadastroMasterDetail` (18 linhas) | tela master-detail do protótipo |
| 4 | 33 | `/cadastros/caminhoes` | `PlaceholderPage` | tabela nova `frota_caminhoes` + tela |
| 5 | 34 | `/cadastros/motoristas` | `PlaceholderPage` | tabela nova `frota_motoristas` + tela |
| 6 | 35 | `/cadastros/rotas` | cliente real (387 linhas), sem paradas nem dias | paradas + dias de atendimento + master-detail |
| 7 | 36 | `/cadastros/regras-transformacao` | cliente real (254 linhas), uma aba só | 2 abas + 2 simuladores |
| 8 | 37 | `/cadastros/modelos-etiqueta` | `PlaceholderPage` | tabela nova `modelos_etiqueta` + tela com preview |
| 9 | 38 | `/admin/usuarios` | cliente real (281 linhas) | alinhamento + resumo de perfis real; "representantes permitidos" diferido para a Onda 4 (decisão 43) |
| 10 | 39 | `/admin/perfis` | `PlaceholderPage` | matriz perfil × permissão + menus visíveis editáveis |
| 11 | 40 | `/admin/parametros` | `PlaceholderPage` | 9 parâmetros seed, 3 grupos, badge Provisório |
| 12 | 41 | `/admin/auditoria` | cliente real (238 linhas), filtros fora do protótipo | filtros + painel de diff + exportação CSV |

---

## Architecture

```
app/backend/  (NestJS 11, modular monolith — um @Module por domínio)
  src/database/schema/           frota.schema.ts (novo), modelos-etiqueta.schema.ts (novo),
                                 auth.schema.ts (+menus_visiveis), rotas.schema.ts (+paradas/dias)
  src/database/migrations/       0015_onda3_cadastros_admin.sql (expand puro, sem contract)
  src/common/rbac/permissoes.ts  +6 permissões (frota, modelos de etiqueta) e ajuste do mapa perfil→permissão
  src/modules/frota/             caminhões e motoristas de cadastro (CRUD + soft delete + auditoria)
  src/modules/modelos-etiqueta/  CRUD dos 6 modelos e seus 12 campos booleanos
  src/modules/perfis/            + menus visíveis por perfil (GET/PUT) + catálogo de permissões
  src/modules/parametros/        + leitura/gravação por chave (o seed cria as 9 chaves da v1.1)
  src/modules/auditoria/         + facetas de filtro (módulos, usuários, tabelas distintos) + CSV
  src/modules/cadastros/rotas/   + paradas ordenadas e dias de atendimento

app/frontend/ (Next.js 16 App Router; BFF em src/app/api/**; nenhuma regra de negócio)
  src/lib/menu-v2.ts             visibilidade de menu passa a vir do perfil (menus visíveis), não do gate de grupo
  src/lib/frota.ts               tipos de caminhão e motorista de cadastro
  src/lib/modelos-etiqueta.ts    os 12 campos canônicos da etiqueta
  src/components/cadastros/cadastro-tabela-drawer.tsx   componente compartilhado lista+drawer (3 telas)
  src/app/(admin)/cadastros/**   8 telas
  src/app/(admin)/admin/**       4 telas
  src/app/api/**                 rotas BFF novas (frota, modelos de etiqueta, perfis/menus, parâmetros, auditoria)
```

**Fluxo de autorização (inalterado onde importa):** o RBAC do backend continua sendo a única fonte de
autorização (`RbacGuard` + `@RequirePermissoes`, resolvido do banco — ADR-008). A visibilidade de menu passa
a ser um atributo **do perfil** (`perfis.menus_visiveis`), exatamente como o protótipo modela em
`PerfisAcesso.tsx` (campo `menus: string[]` por perfil). Menu não concede acesso: uma rota visível cujo
usuário não tenha a permissão da API continua devolvendo 403 no backend e mensagem explícita na tela.

## Tech Stack

| Camada | Tecnologia | Versão fixada no repositório |
|---|---|---|
| Backend | NestJS | 11.1.28 |
| ORM | Drizzle | 0.45.2 (`drizzle-kit` 0.31.10) |
| Banco | PostgreSQL | 18 (`uuidv7()` nativo) |
| Validação | Zod | 4.4.3 |
| Frontend | Next.js | 16.2.11 (App Router) |
| UI | React 19.1.0 + Tailwind 4.1.8 + Radix/Shadcn | conforme `app/frontend/package.json` |
| Ícones | lucide-react | 0.511.0 |
| Teste backend | Jest 29.7.0 + supertest 7.0.0 | `test/unit`, `test/integration` |
| Teste frontend | Jest 29.7.0 + Testing Library 16.3.0 | `app/frontend/__tests__` |
| E2E | Playwright | ^1.60.0 (`app/frontend/e2e`) |

## Global Constraints

1. **Fidelidade ao protótipo (Princípio I, não-negociável).** Cada tela desta onda tem um `.tsx` de
   referência listado na seção "Referências do protótipo". O Worker abre o arquivo antes de escrever a tela
   e reproduz estrutura, ordem de blocos, rótulos, cores hexadecimais, tamanhos de fonte e ícones.
   Divergências permitidas são **apenas** as numeradas nas decisões deste plano.
2. **Completude E2E (Princípio II).** Nenhuma das 12 rotas fica com `PlaceholderPage` ou botão inerte ao
   final da onda. Botão que aparece na tela executa ação real contra o backend.
3. **Regra de negócio só no backend (RA-01).** O BFF do Next.js apenas repassa cookies e corpo.
4. **Transação + auditoria em etapa crítica (RA-02).** Toda escrita desta onda passa por
   `db.transaction` e grava em `auditoria` com `dadosAnteriores`/`dadosNovos`.
5. **Sem falha silenciosa e sem dado inventado (RA-05/RA-06).** Erro do backend vira mensagem na tela;
   contagem que não pode ser calculada não é exibida com número fictício.
6. **Pendências da v1.1 §16 viram parâmetro + badge "Provisório" (Princípio VIII).** Nenhuma regra nova é
   inventada. Só **três** pendências ainda abertas são usadas nesta onda, e apenas duas delas geram badge:
   **P1** (§16.2 — cadência das operações; badge no parâmetro `operacao.cadencia_dias_semana`),
   **P12** (§16.15 — outras transformações além do TZ; badge no parâmetro `operacao.regras_transformacao_tz`
   e na aba 2 de regras de transformação) e **P9** (§16.12 — campos finais da etiqueta; badge apenas na
   tela `/cadastros/modelos-etiqueta`). **P11** (§16.14 — catálogo oficial de produtos) é citada só como
   motivo de **não** semear produtos (decisão 24), sem badge nesta onda.
   **Decisões já registradas não voltam a ser pendência:** **AD-01** (composição do boi casado = 2 TZ +
   2 DT + 2 PA) manda o badge Provisório da composição **sair** de todas as telas, Parâmetros inclusive;
   **AD-02** (EISS Osasco) tira o badge da emissão fiscal e põe no lugar a nota "aguardando homologação";
   **AD-06** (sem expiração automática de reserva de rascunho) proíbe criar TTL, job ou parâmetro pendente
   de expiração. **P15** (marco exato de fechamento do pedido) **não** é usada nesta onda e não se confunde
   com liberação de reserva.
7. **Terminologia.** "Nome Fantasia" e "Buscar cliente". O rótulo banido pela v1.1 §6.8 não aparece em
   nenhuma tela, entidade, coluna, DTO, teste ou comentário desta onda — o teste novo
   `__tests__/terminologia-onda3.test.ts` varre os arquivos criados e alterados.
8. **Migrações estruturais via `drizzle-kit`.** Nunca `ALTER TABLE` manual fora de arquivo de migration.
   Esta onda é **expand puro**: só cria tabelas e colunas novas, não remove nem renomeia nada.
9. **Cobertura ≥ 80 %** de linha e de branch no backend (gate do CI, `npm run test:cov`).
10. **Perfis canônicos.** Os 11 slugs de `PERFIL_SLUGS` são a única lista de perfis. Nenhum perfil novo é
    criado nesta onda.

---

## Referências do protótipo

Repositório: `F:\Projetos\alpha-carnes-prototipo`, branch `feature/completude-v1.1`.
Todos os caminhos são relativos a `src/app/pages/`.

| Rota | Arquivo `.tsx` | Linhas | Blocos que o Worker precisa reproduzir |
|---|---|---|---|
| `/cadastros/representantes` | `Representantes.tsx` | 341 | header + botão "Novo Representante"; banner informativo azul; 3 filtros (busca, canal, status) + contador à direita; tabela de 7 colunas com linhas zebradas; drawer `w-[520px]` com nome, canal, contato, toggle de status, observação, clientes vinculados, usuários vinculados |
| `/cadastros/produtos` | `Produtos.tsx` | 817 | filtros + busca; tabela; drawer com abas Gerais / Comercial / Operacional / Estoque / Fiscal |
| `/cadastros/fornecedores` | `Fornecedores.tsx` | 231 | master `w-[400px]` (busca, botão `+`, 3 chips de contagem, cartões com nota de qualidade) + detail em 2 colunas (Dados Principais, Endereço e Contato, Parâmetros Operacionais, Histórico & Ocorrências) |
| `/cadastros/caminhoes` | `Caminhoes.tsx` | 247 | header + "Novo Caminhão"; busca + filtro de status + contador; tabela de 6 colunas com placa em *chip* monoespaçado e ícone `Truck`; drawer `w-[460px]` |
| `/cadastros/motoristas` | `Motoristas.tsx` | 250 | mesma estrutura de `Caminhoes.tsx` com campos nome, documento, telefone, caminhão padrão |
| `/cadastros/rotas` | `Itinerarios.tsx` | 129 | master `w-1/3` com cartões (nome, badge ativo, paradas, dias) + detail com nome/código, sequência de paradas reordenável e 7 chips de dias |
| `/cadastros/regras-transformacao` | `RegraDesdobramento.tsx` | 548 | 2 abas ("Desdobramento de Compra" e "Transformação na Desossa"); tabela de itens comerciais com soma de fatores; **Simulador** (aba 1) e **Simulador de Disponibilidade** (aba 2) |
| `/cadastros/modelos-etiqueta` | `ModelosEtiqueta.tsx` | 221 | banner âmbar de pendência; 3 colunas: lista `w-[260px]`, 12 *checkboxes* em 2 colunas, preview `w-[380px]` com etiqueta renderizada ao vivo |
| `/admin/usuarios` | `Usuarios.tsx` | 121 | grid 12 colunas: lista de usuários (`col-span-8`) + "Resumo de Perfis" (`col-span-4`) com contagem por perfil e botão "Gerenciar Permissões (RBAC)" |
| `/admin/perfis` | `PerfisAcesso.tsx` | 212 | matriz perfil × permissão com primeira coluna *sticky* e toggles; painel "Menus visíveis — {perfil}" com contador e chips em `grid-cols-3` |
| `/admin/parametros` | `Parametros.tsx` | 182 | 3 grupos (Comercial, Operação, Fiscal) com ícone; cartões em `grid-cols-2`; tipos `toggle`, `texto` e `info`; badge Provisório |
| `/admin/auditoria` | `Auditoria.tsx` | 154 | header com "Exportar CSV" e "Aplicar Filtros"; barra de filtros `grid-cols-6`; grid 12 colunas: tabela (`col-span-8`) + painel de diff escuro (`col-span-4`) com "Dados Anteriores" em vermelho e "Dados Novos" em verde |

Componentes de DS já absorvidos na Onda 2 e reutilizados sem alteração: `AdminHeader`, `StatusPill`,
`BadgeProvisorio`, `Sheet`, `Card`, `Badge`, `Button`, `Input`, `Table`, `Tabs`, `Switch`, `Checkbox`,
`Select`, `Textarea`, `Skeleton`, `Sonner`.

---

## Estado atual verificado (baseline da onda)

Verificado no worktree em `5490189`:

- Migrations existentes: `0000` … `0014` (`meta/_journal.json` termina em `0014_onda1_contract`).
  A migration desta onda é a **0015**.
- Tabelas já existentes e reaproveitadas: `representantes`, `rotas`, `produtos`, `fornecedores`,
  `parametros`, `regras_transformacao`, `regras_transformacao_saidas`, `regras_desdobramento_comercial`,
  `usuarios`, `perfis`, `permissoes`, `perfis_permissoes`, `auditoria`.
- A tabela `caminhoes` **já existe** e pertence à expedição (carga por caminhão, `operacao_id`,
  `status_caminhao`). Ela **não** é o cadastro de frota — por isso as tabelas novas se chamam
  `frota_caminhoes` e `frota_motoristas` (decisão 12).
- `representantes` já tem `tipo_canal`, `contato`, `observacao` e `status`; nada de estrutura falta.
- `rotas` tem `codigo`, `nome`, `regiao`, `representante_padrao`, `caminhao_padrao`, `motorista_padrao`,
  `observacoes`, `status`; faltam paradas e dias de atendimento.
- Catálogo RBAC atual: 55 permissões, 11 perfis, snapshot em
  `app/backend/src/common/rbac/perfil-permissoes.snapshot.json` (regenerado por `npm run rbac:snapshot`).
- `app/frontend/__tests__/menu-rbac.test.ts` contém hoje as tabelas `PERDAS_DECLARADAS` (26 itens) e
  `EXTRAS_DECLARADOS` (11 em `compras` + 3 em `diretoria` = 14 itens) das decisões 25 e 31 da Onda 2.

---

## Decisões de design (fixadas — o Worker não escolhe)

### Escopo e fronteiras

**Decisão 1 — o escopo é exatamente a tabela de 12 rotas do Goal.** Nenhuma rota fora dessa lista é
tocada nesta onda, exceto pelo efeito da reconciliação de menu (decisão 4), que altera a *visibilidade*
das 39 rotas mas não o conteúdo das outras 27 telas.

**Decisão 2 — nenhum dado de demonstração vai para tela.** Os *seeds* do protótipo (`SEED`, `MODELOS`,
`FORNECEDORES`, `eventos`) são referência de layout. As telas leem do backend; lista vazia mostra o
estado vazio do próprio protótipo (por exemplo: "Nenhum representante encontrado para os filtros
aplicados."). O único seed que vai para o banco é o da decisão 25 (parâmetros), decisão 21 (modelos de
etiqueta) e decisão 7 (menus visíveis) — todos com origem documental citada.

**Decisão 3 — nenhuma regra de negócio nova é inventada.** Onde o protótipo mostra um número que hoje
não tem origem no domínio (contagem de ocorrências do fornecedor, nota de qualidade, "45 fornecedores"),
o valor vem do backend ou o bloco exibe o estado vazio — ver decisões 17 e 18.

### Reconciliação RBAC (fecha as decisões 25 e 31 da Onda 2)

**Decisão 4 — a visibilidade de menu passa a ser atributo do perfil, não do gate de grupo.**
O protótipo modela isso literalmente: em `PerfisAcesso.tsx` cada perfil tem `menus: string[]` e a tela
mostra "Menus visíveis — {perfil}". Implementação: coluna `perfis.menus_visiveis TEXT[] NOT NULL
DEFAULT '{}'`, contendo `href`s do catálogo canônico das 39 rotas.
Consequência direta e provável por teste: as **26 perdas** da decisão 25 da Onda 2 iam **todas** do gate
de grupo (a própria Onda 2 provou isso em `toda perda declarada e efeito do gate de grupo, nunca do filtro
de item`). Removido o gate, perdas = 0. E como a lista é semeada a partir da matriz, extras = 0 —
o que fecha a decisão 31.

**Decisão 5 — regra de visibilidade final.** Item aparece se `href ∈ menusVisiveis(perfis do usuário)`
(união quando o usuário tem mais de um perfil). Grupo aparece se tiver ao menos um item visível — o
grupo deixa de ter lista própria de permissões. `filtrarMenuPorPermissoes(permissoes)` é substituída por
`filtrarMenuPorMenusVisiveis(menusVisiveis)` — **este é o único nome usado no plano inteiro**, e quem a
consome é `src/app/(admin)/layout.tsx` (que já monta as `sections` e as passa ao `AppSidebar`, sem alterar
`app-sidebar.tsx`). `MenuGroupDef.permissoesGrupo` e `MenuItemDef.permissoes` saem de `menu-v2.ts`
(decisão 6 explica por quê isso não afrouxa segurança).

**Decisão 6 — menu não é autorização.** A autorização continua exclusivamente no backend
(`RbacGuard` + `@RequirePermissoes`, resolvida do banco por ADR-008) e no *server component* de cada
página, que já checa `user.permissoes.includes(...)` e devolve a mensagem "Você não tem permissão para
visualizar …". Um `href` visível sem permissão de API resulta em mensagem explícita, nunca em tela vazia
silenciosa (RA-05). O `middleware.ts` continua exigindo sessão válida.

**Decisão 7 — o seed de `menus_visiveis` é a transcrição da coluna "Perfis RBAC" da matriz v1.1.**
A tabela literal (39 rotas × 11 perfis) está na Task 1 em `MENUS_VISIVEIS_POR_PERFIL`. Ela é a mesma
tabela `MATRIZ_RASTREABILIDADE` já transcrita em `menu-rbac.test.ts` na Onda 2, invertida de
rota→perfis para perfil→rotas. O teste `menu-rbac.test.ts` reescrito (Task 11) faz a inversão em tempo de
execução e exige igualdade exata nos dois sentidos, de modo que a transcrição não pode divergir da matriz
sem quebrar o CI.

**Decisão 8 — `conferente` e `logistica` deixam de ficar sem menu.** Pela matriz, `conferente` recebe
`/carga/conferencia` e `logistica` recebe `/faturamento/notas-xml`, `/faturamento/seguro-manual` e
`/faturamento/liberacao`. Com a decisão 4 esses perfis passam a ter menu e, portanto, rota de entrada
não nula. A tabela de rotas de entrada da decisão 26 da Onda 2 é recalculada e refixada na Task 11.

**Decisão 9 — `rotaDeEntrada` deixa de ser heurística e passa a ser tabela explícita por perfil.**
A heurística da decisão 26 da Onda 2 ("primeira rota do grupo com mais itens visíveis") produz empate
entre ESTOQUE e CARGA para `expedicao` (3 itens cada) e mandaria o perfil para `/estoque/consulta` em vez
da sua tela de trabalho. Fica fixada `ROTA_ENTRADA_POR_PERFIL`, aterrada na função primária de cada perfil
no doc 013, com fallback `null` só para perfil sem nenhum menu visível:

| perfil | rota de entrada | aterramento |
|---|---|---|
| `administrador` | `/gestao/dashboard` | doc 013 §2.1 |
| `gestor` | `/gestao/dashboard` | doc 013 §2.3 |
| `compras` | `/gestao/compras` | doc 013 §2.2 (comprador cria/confirma compra) |
| `comercial` | `/comercial/clientes` | doc 013 §2.4 |
| `recebimento_pesagem` | `/recebimento/recebimento-carga` | doc 005 §2.2 |
| `corte` | `/desossa/dashboard` | doc 013 (operador de corte) |
| `expedicao` | `/carga/planejamento` | doc 013 (expedição monta carga) |
| `conferente` | `/carga/conferencia` | matriz linha 22 |
| `faturamento` | `/faturamento/pre-faturamento` | doc 008 §4.2 |
| `logistica` | `/faturamento/liberacao` | matriz linha 27 (liberação do caminhão) |
| `diretoria` | `/gestao/dashboard` | matriz linha 6 |

Esta tabela **substitui integralmente** a tabela da decisão 26 da Onda 2 e é a única fonte de verdade da
rota de entrada: `ROTA_ENTRADA_POR_PERFIL` (Task 11.2) e `ROTAS_ENTRADA_ESPERADAS` (Task 11.7) repetem
exatamente estes 11 pares, sem heurística de grupo de trabalho. As mudanças em relação à Onda 2 são
`compras` (`/gestao/dashboard` → `/gestao/compras`, a tela de trabalho do comprador), `diretoria`
(`/comercial/clientes` → `/gestao/dashboard`, matriz linha 6) e `conferente`/`logistica`, que deixam de
ser `null` porque a decisão 4 lhes devolveu menu. `comercial` permanece em `/comercial/clientes`, como na
Onda 2 e no doc 013 §2.4.

Invariante testado (DoD-09): toda rota da tabela pertence ao menu visível do próprio perfil.

**Decisão 10 — edição em runtime dos menus visíveis.** `PUT /perfis/:slug/menus` com corpo
`{ "menus": string[] }`, exigindo `PERFIS_GERENCIAR`, validando que todo `href` pertence ao catálogo
canônico (`400` com a lista de desconhecidos, sem gravar nada) e auditando antes/depois — mesmo contrato
já usado por `PUT /perfis/:slug/permissoes`.

**Decisão 11 — o efeito de uma alteração de menus é imediato na próxima navegação.** O *shell* lê os
menus visíveis a cada render de servidor (`getMe` já roda por requisição), sem cache adicional. Não é
preciso relogar — diferente das permissões, que só mudam no próximo login/refresh (ADR-008 §4). Essa
diferença aparece como nota na tela `/admin/perfis` (texto literal na Task 22).

### Modelo de dados

**Decisão 12 — nomes das tabelas novas: `frota_caminhoes`, `frota_motoristas`, `modelos_etiqueta`.**
O prefixo `frota_` evita colisão com a tabela `caminhoes` da expedição, que é entidade de carga e não de
cadastro.

**Decisão 13 — a ligação entre cadastro de frota e expedição fica fora desta onda.** `frota_caminhoes`
não recebe FK de/para `caminhoes` (expedição), e `caminhoes.placa` não passa a referenciar o cadastro.
Motivo: a expedição é escopo da Onda 7 e alterar sua chave agora violaria o *expand puro* (constraint 8).
Registro explícito de dívida na seção "Dívidas deixadas por esta onda".

**Decisão 14 — `frota_motoristas.caminhao_padrao_id` referencia `frota_caminhoes.id`** (nullable, com
`ON DELETE` implícito ausente: o soft delete do caminhão não apaga a referência; a tela exibe o caminhão
inativo com sufixo " (inativo)").

**Decisão 15 — paradas e dias de atendimento da rota são colunas JSONB em `rotas`.**
`paradas JSONB NOT NULL DEFAULT '[]'` (lista ordenada de `{ "ordem": number, "descricao": string }`) e
`dias_atendimento JSONB NOT NULL DEFAULT '[]'` (subconjunto de `["seg","ter","qua","qui","sex","sab","dom"]`).
Nenhum filtro roda sobre esses campos, então não há índice GIN (convenções de schema §JSONB).

**Decisão 16 — `modelos_etiqueta` guarda os 12 campos como JSONB `campos`**, com as 12 chaves booleanas
do protótipo (`codigo`, `produto`, `peso`, `clientePedido`, `destino`, `origemFrigorifico`, `nfLote`,
`dataHora`, `operador`, `caracteristicas`, `qrCode`, `codigoBarras`). O CHECK garante que o objeto tem
exatamente essas 12 chaves. A tela carrega o badge Provisório da pendência **P9** (campos finais da
etiqueta) — a mesma pendência que o banner âmbar do protótipo anuncia.

**Decisão 17 — os campos do fornecedor que o protótipo mostra e o banco ainda não tem entram em
`parametros_operacionais_json`:** `horarioLimiteRecebimento` (`"HH:MM"`), `capacidadeMaximaKg` (inteiro) e
`toleranciaDivergenciaPercentual` (numérico). São dados de cadastro do fornecedor, não regra nova: a
tolerância só é *exibida*; nenhuma validação de recebimento passa a consumi-la nesta onda.

**Decisão 18 — "Nota de Qualidade", "Total de Ocorrências (Ano)" e "Última Divergência" do fornecedor
vêm do backend real.** Ocorrências e última divergência são calculadas de `ocorrencias_fornecedor`
(tabela já existente) no endpoint `GET /fornecedores/:id/historico`. A **nota de qualidade** não tem
origem no domínio e não é inventada: é campo editável do cadastro
(`parametros_operacionais_json.notaQualidade`, valores `A`, `B`, `C`), exibido com o mesmo *badge* do
protótipo e sem cálculo automático. Quando ausente, o bloco mostra "—".

**Decisão 19 — os chips de contagem do master de fornecedores ("Todos (45)", "Ativos (42)",
"Inativos (3)") usam contagem real** devolvida por `GET /fornecedores/contagens`
(`{ total, ativos, inativos }`). Nenhum número fixo vai para a tela.

**Decisão 20 — `perfis.menus_visiveis` é `TEXT[]`,** não JSONB: é lista curta de strings comparada por
igualdade, e `TEXT[]` deixa o *seed* e o diff de auditoria legíveis.

### Seeds

**Decisão 21 — os 6 modelos de etiqueta do protótipo são seed do banco**, com os mesmos `slug`, nome e
combinação de campos de `ModelosEtiqueta.tsx` (linhas 44–69): `peca-pedido` ("Peça para Pedido"),
`peca-estoque` ("Peça para Estoque"), `peca-desossa` ("Peça para Desossa"), `parte-pedido`
("Parte para Pedido"), `parte-estoque` ("Parte para Estoque") e `produto-unidade`
("Produto por Unidade"). São modelos de configuração de impressão, não dado de demonstração.

**Decisão 22 — o seed é idempotente** (`onConflictDoNothing` por chave natural) e roda em
`npm run db:seed`, junto com o seed de RBAC já existente.

**Decisão 23 — o seed de `menus_visiveis` sobrescreve** (`UPDATE`), porque é reconciliação com a matriz:
rodar o seed sempre devolve os 11 perfis ao estado canônico. Alterações feitas por
`PUT /perfis/:slug/menus` são intencionalmente revertidas pelo seed — comportamento idêntico ao de
`ensurePermissoes`, e declarado no cabeçalho da função.

**Decisão 24 — nenhum produto, representante, fornecedor, caminhão, motorista ou rota é semeado.**
O catálogo oficial de produtos é a pendência **P11**; semear produtos seria inventar dado (RA-06).

**Decisão 25 — as 9 chaves de `parametros` semeadas são exatamente os 9 cartões de `Parametros.tsx`,**
com grupo, tipo, título, descrição e sinalização de provisório idênticos ao protótipo:

| chave | grupo | tipo | provisório | pendência do badge |
|---|---|---|---|---|
| `comercial.overbooking_permitido` | Comercial | toggle (padrão ligado) | não | — |
| `comercial.prioridade_consumo` | Comercial | info | não | — |
| `operacao.fifo_estoque` | Operação | toggle (padrão ligado) | não | — |
| `operacao.cadencia_dias_semana` | Operação | texto | **sim** | **P1** |
| `operacao.composicao_boi_casado` | Operação | info | não (**AD-01**) | — |
| `operacao.regras_transformacao_tz` | Operação | texto | **sim** | **P12** |
| `fiscal.seguro_integrado` | Fiscal | toggle (padrão desligado) | não | — |
| `fiscal.emissao_fiscal` | Fiscal | info | não (**AD-02**) | — |
| `fiscal.expiracao_reserva_rascunho` | Fiscal | info | não (**AD-06**) | — |

**Total de badges Provisório nesta tela: 2** (P1 e P12). O badge usa o componente `BadgeProvisorio` já
existente, com a pendência da última coluna; as duas continuam abertas em `PENDENCIAS_ABERTAS`.

Três cartões divergem do `provisorio: true` do mock de `Parametros.tsx` porque a decisão do cliente já foi
registrada em `docs/execucao/DECISOES.md` — divergências autorizadas, numeradas aqui e registradas no
README de evidências (Task 27.1):

- **D25.a (AD-01)** — `operacao.composicao_boi_casado` deixa de ser provisório. Texto do cartão:
  "2 TZ + 2 DT + 2 PA. Composição confirmada pelo cliente e registrada em AD-01; permanece parametrizável."
  Nenhuma tela desta onda exibe badge Provisório para a composição do boi casado.
- **D25.b (AD-02)** — `fiscal.emissao_fiscal` deixa de ser provisório e ganha a nota de homologação.
  Texto do cartão: "Via sistema externo: NFS-e da Prefeitura de Osasco-SP (EISS), conforme AD-02.
  Integração aguardando homologação."
- **D25.c (AD-06)** — `fiscal.expiracao_reserva_rascunho` deixa de ser provisório e muda de `texto` para
  `info`, porque AD-06 já decidiu o comportamento e um campo livre convidaria a inventar um TTL. Título
  do cartão continua o do protótipo ("Expiração de reserva de rascunho"); o texto passa a ser:
  "Sem expiração automática (AD-06). A reserva do rascunho é liberada por remoção/cancelamento pelo
  vendedor ou pela ação administrativa auditada 'Liberar reserva'." **Nenhum TTL, job ou parâmetro de
  expiração é criado nesta onda** — a ação administrativa é escopo da Onda 4.

A chave da cadência é `operacao.cadencia_dias_semana`, o nome já fixado no plano mestre §7 (P1), com valor
padrão `'1,3,5'` (segunda, quarta e sexta). Nenhum serviço desta onda consome esse valor: a geração por
cadência é escopo da Onda 4.

### Permissões

**Decisão 26 — 6 permissões novas**, seguindo a convenção `<RECURSO>_LER` / `<RECURSO>_GERENCIAR`:
`FROTA_CAMINHOES_LER`, `FROTA_CAMINHOES_GERENCIAR`, `FROTA_MOTORISTAS_LER`,
`FROTA_MOTORISTAS_GERENCIAR`, `MODELOS_ETIQUETA_LER`, `MODELOS_ETIQUETA_GERENCIAR`.

**Decisão 27 — atribuição das 6 permissões novas**, aterrada na matriz (linhas 33, 34 e 37) e no doc 013:
`administrador` e `gestor` recebem as 6; `expedicao` recebe `FROTA_CAMINHOES_LER/GERENCIAR` e
`FROTA_MOTORISTAS_LER/GERENCIAR` (a matriz lhe atribui as duas telas); `recebimento_pesagem` e `corte`
recebem `MODELOS_ETIQUETA_LER` (já operam etiquetagem via `ETIQUETA_GERENCIAR` e precisam consultar o
modelo). Nenhuma permissão existente é removida de nenhum perfil nesta onda — remover permissão é
mudança de superfície de API e sairia do escopo (o menu já não depende dela por causa da decisão 4).

`MODELOS_ETIQUETA_LER` para `recebimento_pesagem` e `corte` é uma **divergência autorizada em relação à
matriz**: a linha 37 dá a tela `/cadastros/modelos-etiqueta` apenas a `administrador` e `gestor`, e essa
atribuição de menu **não muda** (DoD-06 continua exigindo zero extras no menu). A permissão é de leitura de
API, necessária porque pesagem e corte imprimem etiqueta e leem o modelo ativo. Registrada no README de
evidências (Task 27.1). Se o cliente recusar, o efeito é retirar duas entradas do mapa
perfil→permissão — nenhuma tela desta onda depende dela.

**Decisão 28 — o snapshot RBAC é regenerado** por `npm run rbac:snapshot` e commitado; o teste
`menu-rbac.test.ts` lê o snapshot, então esquecer de regenerar quebra o CI.

### Telas

**Decisão 29 — `/admin/perfis` mostra os 11 perfis canônicos e o catálogo real de permissões,
agrupado por módulo**, e não os 8 perfis com 9 rótulos do mock de `PerfisAcesso.tsx`. Justificativa:
**AD-04** e doc 013 fixam 11 perfis; os 9 rótulos do protótipo (`criarPedido`, `alterarPreco`, …) não
existem no catálogo. A **estrutura visual é idêntica** ao protótipo: cartão "Matriz de permissões" com
`ShieldCheck`, cabeçalho `bg-[#F8FAFC]`, primeira coluna *sticky*, linhas zebradas, linha selecionada em
`bg-[#EFF6FF]`, toggles `h-5 w-9`; e cartão "Menus visíveis — {perfil}" com contador e chips
`grid-cols-3`. Divergência autorizada e registrada no README de evidências.

**Decisão 30 — `/admin/auditoria` (fecha a decisão 27 da Onda 2).** Os 5 filtros passam a ser exatamente
os do protótipo: **Período** (`col-span-2`, dois campos `datetime-local` — início e fim), **Usuário**
(`select` populado por `GET /auditoria/facetas`), **Módulo** (`select`, mesma fonte), **Operação**
(`select` com `INSERT`, `UPDATE`, `DELETE`, `ACAO_MANUAL`) e **Registro (ID)** (`input` texto). O layout
passa a ser `grid grid-cols-12` com tabela em `col-span-8` e painel de diff em `col-span-4`, com fundo
`bg-[#1E293B]`, "Dados Anteriores" em `text-[#FC5241]` e "Dados Novos" em `text-[#18A84A]`. O botão
"Aplicar Filtros" dispara a consulta; o botão "Exportar CSV" baixa o resultado do filtro corrente.

**Decisão 31 — "Registro (ID)" aceita UUID e prefixo.** O protótipo sugere `PED-123`. Como `registro_id`
é UUID no banco, o filtro passa a aceitar UUID completo (comparação exata, campo `registroId`) **ou**
qualquer texto (comparação `ILIKE` sobre `registro_id::text`, campo `registroBusca`). O `placeholder` do
input passa a ser "UUID completo ou parte dele" — divergência de texto autorizada, porque o formato
`PED-123` não existe no modelo de dados (RA-06).

**Decisão 32 — a exportação CSV é gerada no BFF** a partir do mesmo endpoint de listagem, com
`pageSize=100` e paginação sequencial até esgotar (limite duro de 50 páginas = 5 000 linhas; ao atingir o
limite o arquivo traz a linha final `# limite de 5000 registros atingido — refine o período` e a tela
mostra `toast` de aviso). Separador `;`, `BOM UTF-8`, colunas: `Data/Hora;Usuário;Módulo;Operação;Tabela;
Registro;Justificativa;IP`.

**Decisão 33 — o "Resumo de Perfis" de `/admin/usuarios` usa contagem real** por perfil
(`GET /usuarios/resumo-perfis` → `[{ slug, nome, total }]`), lista os 11 perfis em ordem canônica e
mostra `0 usuários` quando vazio. As três cores fixas do protótipo (`#8B5CF6`, `#3B7FD4`, `#18A84A`)
são aplicadas ciclicamente na ordem canônica dos perfis. O botão "Gerenciar Permissões (RBAC)" navega
para `/admin/perfis`.

**Decisão 34 — o drawer de usuário** (o protótipo tem o botão "Novo Usuário" sem drawer) reutiliza o
padrão de drawer do próprio protótipo (`Representantes.tsx`, `w-[520px]`) com os campos que a API já
aceita: nome, e-mail, senha (só na criação), ativo e perfis (múltipla escolha entre os 11). Aprovação
(`POST /usuarios/:id/aprovar`) é botão do drawer, visível apenas com `USUARIOS_APROVAR`, e a segregação
criador ≠ aprovador continua sendo aplicada pelo backend.

**Decisão 35 — as três telas lista+drawer (`representantes`, `caminhoes`, `motoristas`) usam um único
componente compartilhado** `CadastroTabelaDrawer`, parametrizado por colunas, campos do drawer e rótulos.
O componente é escrito com as classes exatas do protótipo (Task 12) e as três telas passam apenas
configuração — DRY sem perder fidelidade, porque as três telas do protótipo já são o mesmo layout.

**Decisão 36 — `/cadastros/produtos` mantém a lista e o CRUD atuais e ganha as 5 abas do protótipo**
no drawer: Gerais, Comercial, Operacional, Estoque, Fiscal. Os campos fiscais (`ncm`, `cfop`,
`origemFiscal`, `cestOpcional`) entram em `atributos_json.fiscal`, sem coluna nova: são dados
semiestruturados de baixa cardinalidade de uso e o `atributos_json` já existe (convenções §JSONB).

**Decisão 37 — `/cadastros/regras-transformacao` ganha as 2 abas do protótipo.** Aba 1
("Desdobramento de Compra") edita `regras_desdobramento_comercial` e traz o **Simulador**: campo
"Se eu comprar (Boi Casado)" e resultado = quantidade × fator por item comercial, com "Total de partes
geradas". Aba 2 ("Transformação na Desossa") edita `regras_transformacao`/`regras_transformacao_saidas`
e traz o **Simulador de Disponibilidade**: quantidade de TZ livre, produto a reservar e quantidade,
devolvendo por produto o disponível e o bloqueio, mais "Alternativas ainda possíveis". Os dois
simuladores são **calculados no backend** (`POST /regras-desdobramento/simular` e
`POST /desossa/regras-transformacao/simular`) — RA-01.

**Decisão 38 — as duas regras de transformação do TZ continuam provisórias** (pendência **P12**): a aba 2
exibe `BadgeProvisorio` com `pendencia="P12"` e o texto do protótipo "Cada unidade de TZ atende
exatamente uma das alternativas abaixo." Nenhuma terceira alternativa é criada pelo plano; a tela permite
cadastrar novas regras porque o backend já suporta, e cada regra cadastrada aparece na simulação.

**Decisão 39 — exclusividade por unidade de TZ é regra de exibição do simulador, não regra nova:**
o simulador da aba 2 aplica a exclusividade já implementada no serviço de desossa (uma unidade de TZ
atende uma única alternativa). O plano não altera essa regra; apenas expõe seu resultado.

**Decisão 40 — telas de leitura sem permissão de gerenciar ficam somente leitura, com os botões de
escrita ausentes** (não desabilitados), como já faz `produtos-client.tsx` com `podeGerenciar`.

**Decisão 41 — todas as listagens desta onda usam paginação do backend** (`page`, `pageSize`, `search`),
com `pageSize` 20 por padrão, e o contador do protótipo ("N representantes", "N caminhões") mostra o
`total` devolvido pelo backend, não o tamanho da página.

**Decisão 42 — as mensagens de erro são as do backend.** O helper `mensagemDeErro` de
`src/lib/error-message.ts` já traduz o envelope de erro; a tela mostra `toast` de `sonner` com essa
mensagem e mantém o formulário aberto com os dados digitados.

**Decisão 43 — "representantes permitidos" do usuário (linha 38 da matriz) é diferido para a Onda 4
(Comercial), com escopo declarado aqui.** A matriz pede o campo em `/admin/usuarios`, mas o valor dele é
um **filtro de dados comerciais** (docs_v2 03 §1.2 e §5.1: pedidos e clientes filtrados por representantes
permitidos). Entregar só o campo nesta onda produziria uma configuração que a API ignora — exatamente a
meia-entrega que o Princípio II proíbe. O que a Onda 4 entrega, junto das telas de pedidos e clientes:

1. tabela `usuarios_representantes` (`usuario_id`, `representante_id`, PK composta, `created_at`) em
   migração expand;
2. `PUT /usuarios/:id/representantes` com auditoria antes/depois, no mesmo padrão de
   `PUT /perfis/:slug/menus`;
3. o multisseletor "Representantes permitidos" no drawer de `/admin/usuarios`;
4. **a aplicação do escopo** nos serviços comerciais (`pedidos` e `clientes`): usuário com lista não vazia
   só enxerga registros dos representantes listados, provado por teste de integração com dois usuários.

Nesta onda, o drawer de `/admin/usuarios` entrega perfil e status (o que já existe no backend) e **não**
exibe campo de representantes — nada de controle inerte na tela (RA-06). A dívida está registrada na
seção "Dívidas deixadas por esta onda".

---

## Estrutura de arquivos

### Backend — arquivos novos

```
app/backend/src/database/migrations/0015_onda3_cadastros_admin.sql
app/backend/src/database/migrations/meta/0015_snapshot.json        (gerado por drizzle-kit)
app/backend/src/database/schema/frota.schema.ts
app/backend/src/database/schema/modelos-etiqueta.schema.ts
app/backend/src/modules/frota/frota.module.ts
app/backend/src/modules/frota/caminhoes-cadastro.controller.ts
app/backend/src/modules/frota/caminhoes-cadastro.service.ts
app/backend/src/modules/frota/motoristas.controller.ts
app/backend/src/modules/frota/motoristas.service.ts
app/backend/src/modules/frota/dto/caminhao-cadastro.dto.ts
app/backend/src/modules/frota/dto/motorista.dto.ts
app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.module.ts
app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.controller.ts
app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.service.ts
app/backend/src/modules/modelos-etiqueta/dto/modelo-etiqueta.dto.ts
app/backend/src/common/rbac/menus-canonicos.ts
app/backend/src/common/rbac/perfil-menus.snapshot.json            (gerado por npm run rbac:snapshot)
app/backend/test/integration/frota.e2e-spec.ts
app/backend/test/integration/modelos-etiqueta.e2e-spec.ts
app/backend/test/integration/perfis-menus.e2e-spec.ts
app/backend/test/integration/parametros-onda3.e2e-spec.ts
app/backend/test/integration/auditoria-facetas.e2e-spec.ts
app/backend/test/integration/rotas-paradas.e2e-spec.ts
app/backend/test/unit/menus-canonicos.spec.ts
app/backend/test/unit/simulador-desdobramento.spec.ts
app/backend/test/unit/simulador-desossa.spec.ts
app/backend/test/unit/cobertura-config.spec.ts
```

### Backend — arquivos alterados

```
app/backend/src/database/schema/index.ts             exporta os 2 schemas novos
app/backend/src/database/schema/auth.schema.ts       perfis.menusVisiveis
app/backend/src/database/schema/rotas.schema.ts      paradas, diasAtendimento
app/backend/src/database/seed.ts                     seeds das decisões 21, 23 e 25
app/backend/src/app.module.ts                        FrotaModule, ModelosEtiquetaModule
app/backend/src/common/rbac/permissoes.ts            6 permissões novas + atribuição (decisões 26 e 27)
app/backend/src/common/rbac/perfil-permissoes.snapshot.json   regenerado
app/backend/scripts/gerar-snapshot-perfis.ts         grava também o snapshot de menus (Task 11.1)
app/backend/src/modules/auth/rbac.service.ts         menus visíveis no listar/definir
app/backend/src/modules/perfis/perfis.controller.ts  GET /perfis/catalogo, PUT /perfis/:slug/menus
app/backend/src/modules/perfis/perfis.service.ts     definirMenus + catálogo
app/backend/src/modules/perfis/dto/perfil.dto.ts     definirMenusSchema
app/backend/src/modules/usuarios/usuarios.controller.ts   GET /usuarios/resumo-perfis
app/backend/src/modules/usuarios/usuarios.service.ts      resumoPerfis
app/backend/src/modules/auditoria/auditoria.controller.ts GET /auditoria/facetas
app/backend/src/modules/auditoria/auditoria.service.ts    facetas + filtro registroBusca
app/backend/src/modules/auditoria/dto/auditoria.dto.ts    registroBusca
app/backend/src/modules/parametros/parametros.controller.ts  GET/PATCH por chave
app/backend/src/modules/parametros/parametros.service.ts     detalharPorChave, atualizarPorChave
app/backend/src/modules/cadastros/rotas/dto/rota.dto.ts      paradas, diasAtendimento
app/backend/src/modules/cadastros/rotas/rotas.service.ts     persistência dos 2 campos
app/backend/src/modules/cadastros/fornecedores/fornecedores.controller.ts  /contagens, /:id/historico
app/backend/src/modules/cadastros/fornecedores/fornecedores.service.ts     contagens, historico
app/backend/src/modules/cadastros/produtos/dto/produto.dto.ts              bloco fiscal em atributosJson
app/backend/src/modules/operacao/desossa/desossa.controller.ts             POST /desossa/regras-transformacao/simular
app/backend/src/modules/operacao/desossa/regras-transformacao.service.ts   simular
app/backend/src/modules/cadastros/regras-desdobramento/regras-desdobramento.controller.ts  POST /simular
app/backend/src/modules/cadastros/regras-desdobramento/regras-desdobramento.service.ts     simular
app/backend/test/integration/cadastros-diversos.e2e-spec.ts  +2 casos (Task 7.3)
app/backend/test/integration/cadastros-f7.e2e-spec.ts        +1 caso (Task 19.2)
app/backend/test/integration/rbac.e2e-spec.ts                +1 caso (Task 9.8)
```

### Frontend — arquivos novos

```
app/frontend/src/lib/frota.ts
app/frontend/src/lib/modelos-etiqueta.ts
app/frontend/src/components/cadastros/cadastro-tabela-drawer.tsx
app/frontend/src/app/(admin)/cadastros/representantes/representantes-client.tsx
app/frontend/src/app/(admin)/cadastros/caminhoes/caminhoes-client.tsx
app/frontend/src/app/(admin)/cadastros/motoristas/motoristas-client.tsx
app/frontend/src/app/(admin)/cadastros/modelos-etiqueta/modelos-etiqueta-client.tsx
app/frontend/src/app/(admin)/cadastros/regras-transformacao/simulador-desdobramento.tsx
app/frontend/src/app/(admin)/cadastros/regras-transformacao/simulador-desossa.tsx
app/frontend/src/app/(admin)/admin/usuarios/resumo-perfis.tsx
app/frontend/src/app/(admin)/admin/perfis/perfis-client.tsx
app/frontend/src/app/(admin)/admin/parametros/parametros-client.tsx
app/frontend/src/app/api/cadastros/frota-caminhoes/route.ts
app/frontend/src/app/api/cadastros/frota-caminhoes/[id]/route.ts
app/frontend/src/app/api/cadastros/frota-motoristas/route.ts
app/frontend/src/app/api/cadastros/frota-motoristas/[id]/route.ts
app/frontend/src/app/api/cadastros/modelos-etiqueta/route.ts
app/frontend/src/app/api/cadastros/modelos-etiqueta/[id]/route.ts
app/frontend/src/app/api/cadastros/fornecedores/contagens/route.ts
app/frontend/src/app/api/cadastros/fornecedores/[id]/historico/route.ts
app/frontend/src/app/api/cadastros/regras-desdobramento/simular/route.ts
app/frontend/src/app/api/desossa/regras-transformacao/simular/route.ts
app/frontend/src/app/api/admin/perfis/catalogo/route.ts
app/frontend/src/app/api/admin/perfis/[slug]/menus/route.ts
app/frontend/src/app/api/admin/parametros/route.ts
app/frontend/src/app/api/admin/parametros/chave/[chave]/route.ts
app/frontend/src/app/api/admin/usuarios/resumo-perfis/route.ts
app/frontend/src/app/api/admin/auditoria/facetas/route.ts
app/frontend/src/app/api/admin/auditoria/export/route.ts
app/frontend/__tests__/cadastro-tabela-drawer.test.tsx
app/frontend/__tests__/fornecedores-contagens.test.tsx
app/frontend/__tests__/rotas-paradas.test.tsx
app/frontend/__tests__/modelos-etiqueta.test.tsx
app/frontend/__tests__/produtos-client.test.tsx
app/frontend/__tests__/simuladores-transformacao.test.tsx
app/frontend/__tests__/usuarios-client.test.tsx
app/frontend/__tests__/perfis-client.test.tsx
app/frontend/__tests__/parametros-client.test.tsx
app/frontend/__tests__/auditoria-filtros.test.tsx
app/frontend/__tests__/bff-onda3.test.ts
app/frontend/__tests__/terminologia-onda3.test.ts
app/frontend/e2e/onda3-cadastros-admin.spec.ts
docs/execucao/evidencias/onda3-cadastros-admin/README.md
```

### Frontend — arquivos alterados

```
app/frontend/src/lib/menu-v2.ts                      decisões 4, 5 e 9
app/frontend/src/lib/auth.ts                         menusVisiveis no payload de getMe
app/frontend/src/lib/cadastros-config.ts             fornecedor: 3 campos da decisão 17 + nota de qualidade
app/frontend/src/app/(admin)/layout.tsx              consome filtrarMenuPorMenusVisiveis (Task 11.4)
app/frontend/__tests__/menu-rbac.test.ts             reescrito (Task 11.7)
app/frontend/__tests__/menu-v2.test.ts               ajustado à nova assinatura (Task 11.6)
app/frontend/src/app/(admin)/cadastros/representantes/page.tsx
app/frontend/src/app/(admin)/cadastros/caminhoes/page.tsx
app/frontend/src/app/(admin)/cadastros/motoristas/page.tsx
app/frontend/src/app/(admin)/cadastros/modelos-etiqueta/page.tsx
app/frontend/src/app/(admin)/cadastros/fornecedores/fornecedores-client.tsx
app/frontend/src/app/(admin)/cadastros/rotas/rotas-client.tsx
app/frontend/src/app/(admin)/cadastros/produtos/produtos-client.tsx
app/frontend/src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx
app/frontend/src/app/(admin)/admin/perfis/page.tsx
app/frontend/src/app/(admin)/admin/parametros/page.tsx
app/frontend/src/app/(admin)/admin/usuarios/usuarios-client.tsx
app/frontend/src/app/(admin)/admin/auditoria/auditoria-client.tsx
```

---

## Mapa DoD → teste (1:1)

Cada invariante tem **um** teste nomeado que o prova; o Portão 2 confere esta tabela linha a linha.
Quando a task descreve o teste em prosa, **o nome do caso é o desta tabela** — o Worker usa exatamente
essa string no `it(...)`.

### Reconciliação RBAC — fecha as decisões 25 e 31 da Onda 2

| # | Invariante | Teste | Arquivo |
|---|---|---|---|
| DoD-01 | O snapshot de menus cobre exatamente os 11 perfis canônicos do snapshot de permissões | `o snapshot de menus cobre os 11 perfis canonicos do snapshot de permissoes` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-02 | A matriz transcrita cobre exatamente as 39 rotas do menu canônico | `a matriz transcrita cobre exatamente as 39 rotas do menu` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-03 | `menus_visiveis` de cada perfil é a inversão exata da matriz v1.1 (rota→perfis ⇄ perfil→rotas) | `menus_visiveis do perfil sao exatamente os da matriz: %s` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-04 | A matriz soma 126 atribuições perfil × rota, nos dois sentidos da transcrição | `a matriz soma 126 atribuicoes perfil x rota` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-05 | **Perdas = 0**: nenhuma rota que a matriz atribui a um perfil fica fora do menu desse perfil | `zero perdas: nenhuma rota da matriz fica fora do menu do perfil` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-06 | **Extras = 0**: nenhuma rota aparece para um perfil que a matriz não nomeia | `zero extras: nenhum item visivel sem atribuicao na matriz` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-07 | As **26 perdas** declaradas na decisão 25 da Onda 2 estão, uma a uma, visíveis | `as 26 perdas herdadas da Onda 2 estao visiveis` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-08 | Os **14 extras** declarados na decisão 31 da Onda 2 sumiram do menu de cada perfil | `os 14 extras herdados da Onda 2 sumiram do menu` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-09 | A rota de entrada de cada perfil é a função primária da decisão 9 e pertence ao menu do próprio perfil | `rota de entrada bate com a funcao primaria do perfil: %s` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-10 | Grupos visíveis por perfil batem com a tabela fixada (grupo aparece se e somente se tiver item visível) | `grupos visiveis batem com a tabela fixada: %s` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-11 | `href` fora do catálogo canônico não vira item de menu | `href fora do catalogo nao vira item de menu` | `app/frontend/__tests__/menu-rbac.test.ts` |
| DoD-12 | `PUT /perfis/:slug/menus` grava, audita antes/depois e rejeita `href` fora do catálogo com 400 sem gravar | `define menus visiveis, audita e rejeita href desconhecido` | `app/backend/test/integration/perfis-menus.e2e-spec.ts` |
| DoD-13 | O seed devolve os 11 perfis ao estado canônico mesmo após alteração manual (decisão 23) | `seed de menus visiveis reconcilia perfil alterado` | `app/backend/test/integration/perfis-menus.e2e-spec.ts` |
| DoD-14 | Menu visível não concede acesso: perfil com a rota visível e sem a permissão recebe 403 na API | `menu visivel nao concede acesso a api` | `app/backend/test/integration/perfis-menus.e2e-spec.ts` |

### Cadastros — backend

| # | Invariante | Teste | Arquivo |
|---|---|---|---|
| DoD-15 | `frota_caminhoes`: CRUD com soft delete, restauração e placa única entre ativos (409 na duplicata) | `caminhao de frota: ciclo CRUD, placa duplicada e restauracao` | `app/backend/test/integration/frota.e2e-spec.ts` |
| DoD-16 | `frota_motoristas`: CRUD, documento único entre ativos e caminhão padrão opcional referenciando a frota | `motorista: ciclo CRUD, documento duplicado e caminhao padrao` | `app/backend/test/integration/frota.e2e-spec.ts` |
| DoD-17 | Frota respeita RBAC: leitura sem `*_LER` e escrita sem `*_GERENCIAR` devolvem 403 | `frota respeita RBAC de leitura e escrita` | `app/backend/test/integration/frota.e2e-spec.ts` |
| DoD-18 | Toda escrita em frota grava linha em `auditoria` com dados anteriores e novos | `frota audita insert, update e delete` | `app/backend/test/integration/frota.e2e-spec.ts` |
| DoD-19 | Os 6 modelos de etiqueta do protótipo existem após o seed, com os campos da decisão 21 | `seed cria os 6 modelos com os campos do prototipo` | `app/backend/test/integration/modelos-etiqueta.e2e-spec.ts` |
| DoD-20 | Alterar campos persiste as 12 chaves e rejeita objeto com chave desconhecida ou faltante (400) | `atualiza campos e rejeita conjunto de chaves invalido` | `app/backend/test/integration/modelos-etiqueta.e2e-spec.ts` |
| DoD-21 | Rota persiste paradas com ordem normalizada e aceita só os 7 dias canônicos | `rota persiste paradas ordenadas e dias validos` | `app/backend/test/integration/rotas-paradas.e2e-spec.ts` |
| DoD-22 | Reordenar paradas persiste a nova ordem sem perder descrição | `reordenacao de paradas preserva descricoes` | `app/backend/test/integration/rotas-paradas.e2e-spec.ts` |
| DoD-23 | `GET /fornecedores/contagens` devolve total, ativos e inativos coerentes com o banco | `contagens de fornecedores batem com o banco` | `app/backend/test/integration/cadastros-diversos.e2e-spec.ts` |
| DoD-24 | `GET /fornecedores/:id/historico` vem de `ocorrencias_fornecedor` e devolve `null` quando não há ocorrência | `historico do fornecedor vem de ocorrencias reais` | `app/backend/test/integration/cadastros-diversos.e2e-spec.ts` |
| DoD-25 | O bloco fiscal do produto persiste em `atributos_json.fiscal` e volta no detalhe | `produto persiste bloco fiscal em atributos_json` | `app/backend/test/integration/cadastros-f7.e2e-spec.ts` |
| DoD-26 | Simulador de desdobramento: quantidade × fator por item comercial e total de partes, no backend | `simulador de desdobramento multiplica fatores e soma partes` | `app/backend/test/unit/simulador-desdobramento.spec.ts` |
| DoD-27 | Simulador da desossa respeita a exclusividade por unidade de TZ e marca o produto bloqueado | `simulador de desossa respeita exclusividade por unidade de TZ` | `app/backend/test/unit/simulador-desossa.spec.ts` |
| DoD-28 | Simulador da desossa lista as alternativas possíveis e devolve vazio sem regra ativa | `simulador de desossa lista alternativas possiveis` | `app/backend/test/unit/simulador-desossa.spec.ts` |

### Administração — backend

| # | Invariante | Teste | Arquivo |
|---|---|---|---|
| DoD-29 | `GET /perfis/catalogo` cobre 100 % de `DESCRICOES_PERMISSOES`, agrupado por módulo, e lista os 39 menus | `catalogo de permissoes cobre todo o mapa de descricoes` | `app/backend/test/integration/perfis-menus.e2e-spec.ts` |
| DoD-30 | `GET /usuarios/resumo-perfis` devolve os 11 perfis em ordem canônica, com contagem real e zero quando vazio | `resumo de perfis conta usuarios reais e inclui perfil vazio` | `app/backend/test/integration/rbac.e2e-spec.ts` |
| DoD-31 | As 9 chaves da decisão 25 existem após o seed; exatamente 2 são provisórias (P1 e P12) e composição do boi casado, emissão fiscal e reserva de rascunho **não** são provisórias (AD-01, AD-02, AD-06) | `seed cria as 9 chaves de parametro da v1.1 com AD-01, AD-02 e AD-06 honradas` | `app/backend/test/integration/parametros-onda3.e2e-spec.ts` |
| DoD-32 | `PATCH /parametros/chave/:chave` grava, audita e devolve 404 para chave inexistente | `atualiza parametro por chave, audita e 404 em chave desconhecida` | `app/backend/test/integration/parametros-onda3.e2e-spec.ts` |
| DoD-33 | **(decisão 27 da Onda 2)** A auditoria filtra por período, usuário, módulo, operação e registro, combinados | `auditoria filtra por periodo, usuario, modulo, operacao e registro` | `app/backend/test/integration/auditoria-facetas.e2e-spec.ts` |
| DoD-34 | **(decisão 30)** `GET /auditoria/facetas` devolve módulos, tabelas e usuários distintos reais do log | `facetas de auditoria listam valores distintos reais` | `app/backend/test/integration/auditoria-facetas.e2e-spec.ts` |
| DoD-35 | **(decisão 30)** `registroBusca` casa por trecho; `registroId` exige UUID e rejeita texto livre com 400 | `filtro de registro aceita trecho e valida uuid` | `app/backend/test/integration/auditoria-facetas.e2e-spec.ts` |

### Telas — fidelidade e comportamento

| # | Invariante | Teste | Arquivo |
|---|---|---|---|
| DoD-36 | O componente de lista+drawer mostra os registros do backend e o total real | `lista registros do backend e mostra o total real` | `app/frontend/__tests__/cadastro-tabela-drawer.test.tsx` |
| DoD-37 | Sem permissão de gerenciar não há botão "Novo" nem ações de linha (decisão 40) | `sem permissao de gerenciar nao ha botao novo nem acoes de linha` | `app/frontend/__tests__/cadastro-tabela-drawer.test.tsx` |
| DoD-38 | O drawer abre em modo edição com os dados da linha selecionada | `drawer abre em modo edicao com os dados da linha` | `app/frontend/__tests__/cadastro-tabela-drawer.test.tsx` |
| DoD-39 | Erro do backend vira mensagem na tela e nenhuma linha falsa é exibida | `erro do backend aparece como mensagem, sem lista falsa` | `app/frontend/__tests__/cadastro-tabela-drawer.test.tsx` |
| DoD-40 | Os chips de fornecedores mostram a contagem devolvida pelo backend | `chips mostram a contagem devolvida pelo backend` | `app/frontend/__tests__/fornecedores-contagens.test.tsx` |
| DoD-41 | Falha na contagem mostra erro e não inventa número (RA-06) | `falha nas contagens mostra erro e nao inventa numero` | `app/frontend/__tests__/fornecedores-contagens.test.tsx` |
| DoD-42 | Reordenar parada na tela preserva as descrições e renumera a ordem | `reordena parada para cima preservando descricoes` | `app/frontend/__tests__/rotas-paradas.test.tsx` |
| DoD-43 | Alternar dia de atendimento reflete no estado do botão | `alterna dia de atendimento` | `app/frontend/__tests__/rotas-paradas.test.tsx` |
| DoD-44 | A tela de etiquetas mostra os 12 campos canônicos com `Switch` | `modelos de etiqueta mostra os 12 campos canonicos` | `app/frontend/__tests__/modelos-etiqueta.test.tsx` |
| DoD-45 | A pré-visualização reflete em tempo real cada campo ligado ou desligado | `preview reflete os campos ligados` | `app/frontend/__tests__/modelos-etiqueta.test.tsx` |
| DoD-46 | A tela exibe o badge Provisório da pendência P9 | `modelos de etiqueta exibe badge provisorio P9` | `app/frontend/__tests__/modelos-etiqueta.test.tsx` |
| DoD-47 | Sem `MODELOS_ETIQUETA_GERENCIAR` os `Switch` ficam desabilitados e não há botão de salvar | `sem permissao de gerenciar modelo fica somente leitura` | `app/frontend/__tests__/modelos-etiqueta.test.tsx` |
| DoD-48 | O drawer de produto tem as 5 abas do protótipo | `drawer de produto tem as 5 abas do prototipo` | `app/frontend/__tests__/produtos-client.test.tsx` |
| DoD-49 | A aba Fiscal envia os campos dentro de `atributosJson.fiscal` | `aba fiscal envia ncm dentro de atributosJson` | `app/frontend/__tests__/produtos-client.test.tsx` |
| DoD-50 | O simulador de desdobramento exibe quantidade × fator por item e o total devolvido pela API | `simulador de desdobramento exibe fatores e total do backend` | `app/frontend/__tests__/simuladores-transformacao.test.tsx` |
| DoD-51 | O simulador da desossa marca o produto bloqueado e lista as alternativas possíveis | `simulador de desossa marca bloqueado e lista alternativas` | `app/frontend/__tests__/simuladores-transformacao.test.tsx` |
| DoD-52 | Erro do backend no simulador vira mensagem e nenhum número é exibido | `erro do simulador nao exibe numero` | `app/frontend/__tests__/simuladores-transformacao.test.tsx` |
| DoD-53 | O "Resumo de Perfis" usa contagem real do backend, inclusive perfil com zero usuários | `resumo de perfis usa contagem real do backend` | `app/frontend/__tests__/usuarios-client.test.tsx` |
| DoD-54 | Sem `USUARIOS_APROVAR` não existe botão de aprovar (segregação de funções, doc 013) | `sem USUARIOS_APROVAR nao ha botao de aprovar` | `app/frontend/__tests__/usuarios-client.test.tsx` |
| DoD-55 | `/admin/perfis` renderiza uma coluna por perfil e uma linha por permissão do catálogo, agrupadas por módulo | `matriz renderiza 11 perfis e o catalogo agrupado por modulo` | `app/frontend/__tests__/perfis-client.test.tsx` |
| DoD-56 | Alternar um chip de menu chama `PUT /perfis/:slug/menus` com a lista completa atualizada | `alterar menu visivel envia lista completa ao backend` | `app/frontend/__tests__/perfis-client.test.tsx` |
| DoD-57 | O painel mostra o contador "N de 39 menus" do perfil selecionado | `painel de menus mostra contador de 39` | `app/frontend/__tests__/perfis-client.test.tsx` |
| DoD-58 | A nota sobre menu valer na próxima navegação e permissão no próximo login está na tela (decisão 11) | `tela explica diferenca entre menu e permissao` | `app/frontend/__tests__/perfis-client.test.tsx` |
| DoD-59 | Erro do backend não altera a matriz exibida e aparece como mensagem | `erro ao salvar perfil nao altera a matriz` | `app/frontend/__tests__/perfis-client.test.tsx` |
| DoD-60 | `/admin/parametros` mostra os 3 grupos e os 9 cartões na ordem Comercial → Operação → Fiscal | `parametros mostra 3 grupos e 9 cartoes na ordem do prototipo` | `app/frontend/__tests__/parametros-client.test.tsx` |
| DoD-61 | Exatamente 2 cartões exibem badge Provisório (`operacao.cadencia_dias_semana` com P1 e `operacao.regras_transformacao_tz` com P12); os outros 7 não exibem badge nenhum | `apenas os 2 parametros provisorios exibem badge` | `app/frontend/__tests__/parametros-client.test.tsx` |
| DoD-62 | Cartão do tipo `info` não tem botão "Salvar" | `parametro informativo nao tem botao salvar` | `app/frontend/__tests__/parametros-client.test.tsx` |
| DoD-63 | Sem `PARAMETROS_GERENCIAR` nenhum controle é editável e não há botão "Salvar" | `sem permissao de gerenciar parametros fica somente leitura` | `app/frontend/__tests__/parametros-client.test.tsx` |
| DoD-64 | Salvar envia `PATCH /parametros/chave/:chave` preservando as demais chaves de `valorJson` | `salvar parametro preserva as demais chaves do valorJson` | `app/frontend/__tests__/parametros-client.test.tsx` |
| DoD-65 | **(decisão 30)** A tela mostra os 5 filtros do protótipo: Período, Usuário, Módulo, Operação e Registro | `auditoria mostra os cinco filtros do prototipo` | `app/frontend/__tests__/auditoria-filtros.test.tsx` |
| DoD-66 | **(decisão 30)** Usuário e Módulo são populados por `GET /auditoria/facetas` | `selects de usuario e modulo vem das facetas` | `app/frontend/__tests__/auditoria-filtros.test.tsx` |
| DoD-67 | **(decisão 31)** UUID completo vira `registroId`; texto parcial vira `registroBusca` | `campo registro escolhe entre registroId e registroBusca` | `app/frontend/__tests__/auditoria-filtros.test.tsx` |
| DoD-68 | **(decisão 32)** "Exportar CSV" chama a rota de exportação com os filtros correntes | `exportar csv usa os filtros correntes` | `app/frontend/__tests__/auditoria-filtros.test.tsx` |
| DoD-69 | **(decisão 32)** Exportação truncada em 5 000 registros avisa o usuário | `exportacao truncada avisa o usuario` | `app/frontend/__tests__/auditoria-filtros.test.tsx` |
| DoD-70 | As 17 rotas BFF da onda existem nos caminhos previstos | `todas as rotas BFF da Onda 3 existem` | `app/frontend/__tests__/bff-onda3.test.ts` |
| DoD-71 | O BFF repassa status e mensagem do backend em caso de erro, sem mascarar (RA-05) | `erro do backend vira status e message no BFF` | `app/frontend/__tests__/bff-onda3.test.ts` |
| DoD-72 | Cada uma das 12 rotas abre com o título do protótipo, sem placeholder e sem erro de console | `rota <rota> abre com titulo e sem placeholder` | `app/frontend/e2e/onda3-cadastros-admin.spec.ts` |
| DoD-73 | O menu do administrador leva às 12 rotas da onda | `menu do administrador leva as 12 rotas da onda` | `app/frontend/e2e/onda3-cadastros-admin.spec.ts` |
| DoD-74 | O rótulo banido pela v1.1 §6.8 não aparece em nenhum arquivo da onda | `nenhum arquivo da onda usa o rotulo banido pela v1.1` | `app/frontend/__tests__/terminologia-onda3.test.ts` |
| DoD-75 | Nenhum arquivo da onda tem marcador de pendência textual ou dado de demonstração | `nenhum arquivo da onda tem marcador de pendencia ou dado de demonstracao` | `app/frontend/__tests__/terminologia-onda3.test.ts` |
| DoD-76 | Nenhuma tela da onda usa `PlaceholderPage` | `nenhuma tela da onda usa PlaceholderPage` | `app/frontend/__tests__/terminologia-onda3.test.ts` |
| DoD-77 | Cobertura de linha e de branch do backend ≥ 80 % é exigida pela configuração do Jest (o gate falha o build, não só avisa) | `jest exige 80 por cento de linha e de branch` | `app/backend/test/unit/cobertura-config.spec.ts` |
| DoD-78 | Usuário sem menu nenhum não tem grupo visível nem rota de entrada | `usuario sem menu nao tem grupo nem rota de entrada` | `app/frontend/__tests__/menu-rbac.test.ts` |

---

## Tasks

Ordem obrigatória: 1 → 27. Cada task termina com o comando de verificação e a saída esperada.
Commit ao final de cada task, mensagem `feat(onda3): <título da task>` (ou `test`/`docs` conforme o caso).

---

### Task 1 — Catálogo canônico de menus, colunas novas e migration 0015

**1.1** Criar `app/backend/src/common/rbac/menus-canonicos.ts`:

```ts
/**
 * Catálogo canônico das 39 rotas do menu (protótipo Layout.tsx → ALL_NAV_GROUPS).
 * É a fonte única de verdade para `perfis.menus_visiveis`: nenhum href fora desta
 * lista pode ser gravado (decisão 10 do plano da Onda 3).
 */
export const MENUS_CANONICOS = [
  '/comercial/clientes',
  '/comercial/pedidos',
  '/comercial/tabela-precos',
  '/comercial/disponibilidade',
  '/comercial/espelho',
  '/gestao/dashboard',
  '/gestao/operacoes',
  '/gestao/compras',
  '/gestao/overbooking',
  '/gestao/aprovacoes',
  '/gestao/relatorios',
  '/recebimento/recebimento-carga',
  '/recebimento/pesagem-destinacao',
  '/recebimento/etiquetas',
  '/desossa/dashboard',
  '/desossa/pesagem-destinacao',
  '/desossa/etiquetas',
  '/estoque/consulta',
  '/estoque/entrada-itens',
  '/estoque/ajustes',
  '/carga/planejamento',
  '/carga/conferencia',
  '/carga/enviar-faturamento',
  '/faturamento/pre-faturamento',
  '/faturamento/notas-xml',
  '/faturamento/seguro-manual',
  '/faturamento/liberacao',
  '/cadastros/representantes',
  '/cadastros/produtos',
  '/cadastros/fornecedores',
  '/cadastros/caminhoes',
  '/cadastros/motoristas',
  '/cadastros/rotas',
  '/cadastros/regras-transformacao',
  '/cadastros/modelos-etiqueta',
  '/admin/usuarios',
  '/admin/perfis',
  '/admin/parametros',
  '/admin/auditoria',
] as const;

export type MenuCanonico = (typeof MENUS_CANONICOS)[number];

const SET_MENUS = new Set<string>(MENUS_CANONICOS);

export function menusDesconhecidos(hrefs: string[]): string[] {
  return hrefs.filter((href) => !SET_MENUS.has(href));
}

/**
 * Menus visíveis por perfil — transcrição da coluna "Perfis RBAC" da matriz de
 * rastreabilidade v1.1 (linhas 3–41), invertida de rota→perfis para perfil→rotas.
 * Total: 126 pares perfil×rota. Alterar aqui exige alterar a matriz (decisão 7).
 */
export const MENUS_VISIVEIS_POR_PERFIL: Record<string, string[]> = {
  administrador: [...MENUS_CANONICOS],
  gestor: [
    '/comercial/clientes',
    '/comercial/pedidos',
    '/comercial/tabela-precos',
    '/comercial/disponibilidade',
    '/comercial/espelho',
    '/gestao/dashboard',
    '/gestao/operacoes',
    '/gestao/compras',
    '/gestao/overbooking',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/recebimento/recebimento-carga',
    '/recebimento/pesagem-destinacao',
    '/recebimento/etiquetas',
    '/desossa/dashboard',
    '/desossa/pesagem-destinacao',
    '/desossa/etiquetas',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
    '/carga/planejamento',
    '/carga/conferencia',
    '/carga/enviar-faturamento',
    '/faturamento/pre-faturamento',
    '/faturamento/notas-xml',
    '/faturamento/seguro-manual',
    '/faturamento/liberacao',
    '/cadastros/representantes',
    '/cadastros/produtos',
    '/cadastros/fornecedores',
    '/cadastros/caminhoes',
    '/cadastros/motoristas',
    '/cadastros/rotas',
    '/cadastros/regras-transformacao',
    '/cadastros/modelos-etiqueta',
    '/admin/auditoria',
  ],
  compras: [
    '/gestao/operacoes',
    '/gestao/compras',
    '/gestao/overbooking',
    '/recebimento/recebimento-carga',
    '/cadastros/fornecedores',
  ],
  comercial: [
    '/comercial/clientes',
    '/comercial/pedidos',
    '/comercial/tabela-precos',
    '/comercial/disponibilidade',
    '/comercial/espelho',
    '/gestao/compras',
    '/gestao/overbooking',
    '/desossa/dashboard',
  ],
  recebimento_pesagem: [
    '/gestao/aprovacoes',
    '/recebimento/recebimento-carga',
    '/recebimento/pesagem-destinacao',
    '/recebimento/etiquetas',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
  ],
  corte: ['/desossa/dashboard', '/desossa/pesagem-destinacao', '/desossa/etiquetas'],
  expedicao: [
    '/comercial/pedidos',
    '/comercial/espelho',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
    '/carga/planejamento',
    '/carga/conferencia',
    '/carga/enviar-faturamento',
    '/cadastros/caminhoes',
    '/cadastros/motoristas',
  ],
  conferente: ['/carga/conferencia'],
  faturamento: [
    '/comercial/clientes',
    '/comercial/pedidos',
    '/gestao/relatorios',
    '/recebimento/recebimento-carga',
    '/faturamento/pre-faturamento',
    '/faturamento/notas-xml',
    '/faturamento/seguro-manual',
    '/faturamento/liberacao',
  ],
  logistica: ['/faturamento/notas-xml', '/faturamento/seguro-manual', '/faturamento/liberacao'],
  diretoria: [
    '/comercial/disponibilidade',
    '/gestao/dashboard',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/faturamento/notas-xml',
    '/admin/auditoria',
  ],
};
```

**1.2** Em `app/backend/src/database/schema/auth.schema.ts`, acrescentar a coluna em `perfis`
(importar `text` já está importado; adicionar o import de `type AnyPgColumn` não é necessário):

```ts
    descricao: text('descricao'),
    menusVisiveis: text('menus_visiveis').array().notNull().default(sql`'{}'::text[]`),
```

**1.3** Em `app/backend/src/database/schema/rotas.schema.ts`, acrescentar (importar `jsonb`):

```ts
    observacoes: text('observacoes'),
    paradas: jsonb('paradas').notNull().default(sql`'[]'::jsonb`),
    diasAtendimento: jsonb('dias_atendimento').notNull().default(sql`'[]'::jsonb`),
```

**1.4** Criar `app/backend/src/database/schema/frota.schema.ts`:

```ts
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── frota_caminhoes ───────────────────────────────────────────────────────────
// Cadastro da frota (Cadastros & Regras / Caminhões). Não confundir com `caminhoes`,
// que é a carga da expedição (decisão 12 da Onda 3).
export const frotaCaminhoes = pgTable(
  'frota_caminhoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    placa: text('placa').notNull(),
    descricao: text('descricao'),
    capacidadeKg: integer('capacidade_kg').notNull().default(0),
    rotaPadraoId: uuid('rota_padrao_id'),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_caminhoes_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_frota_caminhoes_capacidade', sql`${t.capacidadeKg} >= 0`),
    uniqueIndex('uq_frota_caminhoes_placa').on(t.placa).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_caminhoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── frota_motoristas ──────────────────────────────────────────────────────────
export const frotaMotoristas = pgTable(
  'frota_motoristas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    nome: text('nome').notNull(),
    documento: text('documento').notNull(),
    telefone: text('telefone'),
    caminhaoPadraoId: uuid('caminhao_padrao_id').references(() => frotaCaminhoes.id),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_motoristas_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_frota_motoristas_documento').on(t.documento).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_caminhao').on(t.caminhaoPadraoId),
  ],
);

export const frotaCaminhoesRelations = relations(frotaCaminhoes, ({ many }) => ({
  motoristas: many(frotaMotoristas),
}));

export const frotaMotoristasRelations = relations(frotaMotoristas, ({ one }) => ({
  caminhaoPadrao: one(frotaCaminhoes, {
    fields: [frotaMotoristas.caminhaoPadraoId],
    references: [frotaCaminhoes.id],
  }),
}));
```

**1.5** Criar `app/backend/src/database/schema/modelos-etiqueta.schema.ts`:

```ts
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** As 12 chaves booleanas de ModelosEtiqueta.tsx (decisão 16 da Onda 3). */
export const CAMPOS_ETIQUETA = [
  'codigo', 'produto', 'peso', 'clientePedido', 'destino', 'origemFrigorifico',
  'nfLote', 'dataHora', 'operador', 'caracteristicas', 'qrCode', 'codigoBarras',
] as const;

export const modelosEtiqueta = pgTable(
  'modelos_etiqueta',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    slug: text('slug').notNull(),
    nome: text('nome').notNull(),
    campos: jsonb('campos').notNull(),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_modelos_etiqueta_status', sql`${t.status} IN ('ativo','inativo')`),
    check(
      'chk_modelos_etiqueta_campos',
      sql`(SELECT count(*) FROM jsonb_object_keys(${t.campos})) = 12`,
    ),
    uniqueIndex('uq_modelos_etiqueta_slug').on(t.slug).where(sql`${t.deletedAt} IS NULL`),
    index('idx_modelos_etiqueta_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
```

**1.6** Em `app/backend/src/database/schema/index.ts`, acrescentar as duas linhas de reexport junto às
demais (ordem alfabética do arquivo):

```ts
export * from './frota.schema';
export * from './modelos-etiqueta.schema';
```

**1.7** Criar `app/backend/src/database/migrations/0015_onda3_cadastros_admin.sql`:

```sql
-- Onda 3 — Cadastros & Regras + Administração. Expand puro: só cria.
CREATE TABLE IF NOT EXISTS "frota_caminhoes" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "placa" text NOT NULL,
  "descricao" text,
  "capacidade_kg" integer DEFAULT 0 NOT NULL,
  "rota_padrao_id" uuid,
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_frota_caminhoes_status" CHECK ("status" IN ('ativo','inativo')),
  CONSTRAINT "chk_frota_caminhoes_capacidade" CHECK ("capacidade_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frota_motoristas" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "nome" text NOT NULL,
  "documento" text NOT NULL,
  "telefone" text,
  "caminhao_padrao_id" uuid REFERENCES "frota_caminhoes"("id"),
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_frota_motoristas_status" CHECK ("status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modelos_etiqueta" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "slug" text NOT NULL,
  "nome" text NOT NULL,
  "campos" jsonb NOT NULL,
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_modelos_etiqueta_status" CHECK ("status" IN ('ativo','inativo')),
  CONSTRAINT "chk_modelos_etiqueta_campos"
    CHECK ((SELECT count(*) FROM jsonb_object_keys("campos")) = 12)
);
--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN IF NOT EXISTS "menus_visiveis" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN IF NOT EXISTS "paradas" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN IF NOT EXISTS "dias_atendimento" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_frota_caminhoes_placa"
  ON "frota_caminhoes" ("placa") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_caminhoes_status"
  ON "frota_caminhoes" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_frota_motoristas_documento"
  ON "frota_motoristas" ("documento") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_motoristas_status"
  ON "frota_motoristas" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_motoristas_caminhao"
  ON "frota_motoristas" ("caminhao_padrao_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_modelos_etiqueta_slug"
  ON "modelos_etiqueta" ("slug") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_modelos_etiqueta_status"
  ON "modelos_etiqueta" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER "trg_frota_caminhoes_updated_at" BEFORE UPDATE ON "frota_caminhoes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "trg_frota_motoristas_updated_at" BEFORE UPDATE ON "frota_motoristas"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "trg_modelos_etiqueta_updated_at" BEFORE UPDATE ON "modelos_etiqueta"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**1.8** Registrar a migration no journal: acrescentar ao final do array `entries` de
`app/backend/src/database/migrations/meta/_journal.json`:

```json
    {
      "idx": 15,
      "version": "7",
      "when": 1785024000000,
      "tag": "0015_onda3_cadastros_admin",
      "breakpoints": true
    }
```

**1.9** Gerar o snapshot da migration:

```bash
cd app/backend && npm run db:generate
```

Saída esperada: `drizzle-kit` reconhece o schema já materializado e escreve
`src/database/migrations/meta/0015_snapshot.json`. Se ele propuser um `.sql` adicional, **apagar o `.sql`
gerado** e manter apenas o snapshot — o SQL desta onda é o escrito à mão em 1.7 (mesmo procedimento das
migrations `0012`–`0014`).

**1.10** Documentar a reversão em `app/backend/src/database/migrations/ROLLBACK.md`, na seção nova
`## 0015 — Onda 3`:

```sql
DROP TRIGGER IF EXISTS "trg_modelos_etiqueta_updated_at" ON "modelos_etiqueta";
DROP TRIGGER IF EXISTS "trg_frota_motoristas_updated_at" ON "frota_motoristas";
DROP TRIGGER IF EXISTS "trg_frota_caminhoes_updated_at" ON "frota_caminhoes";
DROP TABLE IF EXISTS "modelos_etiqueta";
DROP TABLE IF EXISTS "frota_motoristas";
DROP TABLE IF EXISTS "frota_caminhoes";
ALTER TABLE "rotas" DROP COLUMN IF EXISTS "dias_atendimento";
ALTER TABLE "rotas" DROP COLUMN IF EXISTS "paradas";
ALTER TABLE "perfis" DROP COLUMN IF EXISTS "menus_visiveis";
```

**1.11** Acrescentar as 3 tabelas novas ao `TRUNCATE` de `app/backend/test/helpers/test-app.ts`,
antes de `produtos, rotas, representantes`:

```ts
      modelos_etiqueta, frota_motoristas, frota_caminhoes,
```

**Verificação:**

```bash
cd app/backend && npm run db:migrate && npm run type-check
```

Saída esperada: `migrations aplicadas` sem erro, `tsc --noEmit` sem saída (código 0).

---

### Task 2 — Seeds: menus visíveis, parâmetros e modelos de etiqueta

**2.1** Em `app/backend/src/database/seed.ts`, acrescentar as três funções abaixo e chamá-las na função
principal, **depois** do seed de perfis/permissões já existente:

```ts
import { eq, sql } from 'drizzle-orm';
import { MENUS_VISIVEIS_POR_PERFIL } from '../common/rbac/menus-canonicos';
import { modelosEtiqueta, parametros, perfis } from './schema';

/**
 * Reconcilia `perfis.menus_visiveis` com a matriz de rastreabilidade v1.1.
 * Sobrescreve alterações feitas em runtime (decisão 23 da Onda 3): rodar o seed
 * sempre devolve os 11 perfis ao estado canônico.
 */
async function seedMenusVisiveis(db: Db): Promise<void> {
  for (const [slug, menus] of Object.entries(MENUS_VISIVEIS_POR_PERFIL)) {
    await db.update(perfis).set({ menusVisiveis: menus }).where(eq(perfis.slug, slug));
  }
}

/** As 9 chaves da v1.1 §16 exibidas em Administração / Parâmetros (decisão 25 da Onda 3). */
const PARAMETROS_SEED = [
  {
    chave: 'comercial.overbooking_permitido',
    descricao: 'Permitir overbooking',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'toggle',
      titulo: 'Permitir overbooking',
      texto:
        'Sim (sem limite, com confirmação). Qualquer vendedor pode realizar overbooking; o sistema solicita confirmação explícita quando a disponibilidade for insuficiente.',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'comercial.prioridade_consumo',
    descricao: 'Prioridade de consumo',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'info',
      titulo: 'Prioridade de consumo',
      texto:
        'Físico → Virtual → Overbooking. O consumo segue automaticamente essa ordem, sem exigir escolha manual do comercial.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.fifo_estoque',
    descricao: 'Estoque anterior sai primeiro (FIFO)',
    valorJson: {
      grupo: 'Operação',
      tipo: 'toggle',
      titulo: 'Estoque anterior sai primeiro (FIFO)',
      texto: 'Sim. O estoque físico já existente é priorizado antes do estoque virtual programado.',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.cadencia_dias_semana',
    descricao: 'Cadência de geração de Operações',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Cadência de geração de Operações',
      texto:
        'Segunda, quarta e sexta. Dias da semana em que uma Operação é criada automaticamente (ver Gestão / Operações). Compra Programada e Pedido de Venda sempre se vinculam a uma Operação desta cadência, ou a uma extraordinária criada manualmente para datas fora do padrão. Cadência provisória — pendente de validação formal.',
      valor: '1,3,5',
      provisorio: true,
      pendencia: 'P1',
    },
  },
  {
    chave: 'operacao.composicao_boi_casado',
    descricao: 'Composição do boi casado (AD-01)',
    valorJson: {
      grupo: 'Operação',
      tipo: 'info',
      titulo: 'Composição do boi casado',
      texto:
        '2 TZ + 2 DT + 2 PA. Composição confirmada pelo cliente e registrada em AD-01; permanece parametrizável.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.regras_transformacao_tz',
    descricao: 'Regras de transformação do TZ',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Regras de transformação do TZ',
      texto:
        '2 alternativas: (A) Coxão-bola + Jacaré; (B) Coxão-bola com alcatra + Filé curto. Regra parametrizável, não fixada em código.',
      valor: '',
      provisorio: true,
      pendencia: 'P12',
    },
  },
  {
    chave: 'fiscal.seguro_integrado',
    descricao: 'Seguro integrado',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'toggle',
      titulo: 'Seguro integrado',
      texto: 'Não (manual). O controle de envio e confirmação do seguro é feito manualmente pelo faturamento.',
      valor: false,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'fiscal.emissao_fiscal',
    descricao: 'Emissão fiscal (AD-02)',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info',
      titulo: 'Emissão fiscal',
      texto:
        'Via sistema externo: NFS-e da Prefeitura de Osasco-SP (EISS), conforme AD-02. Integração aguardando homologação.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'fiscal.expiracao_reserva_rascunho',
    descricao: 'Expiração de reserva de rascunho (AD-06)',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info',
      titulo: 'Expiração de reserva de rascunho',
      texto:
        "Sem expiração automática (AD-06). A reserva do rascunho é liberada por remoção/cancelamento pelo vendedor ou pela ação administrativa auditada 'Liberar reserva'.",
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
] as const;

async function seedParametros(db: Db): Promise<void> {
  for (const p of PARAMETROS_SEED) {
    await db
      .insert(parametros)
      .values({ chave: p.chave, descricao: p.descricao, valorJson: p.valorJson })
      .onConflictDoNothing({ target: parametros.chave });
  }
}

/** Campos padrão das etiquetas — ModelosEtiqueta.tsx linhas 33–40. */
function camposEtiqueta(overrides: Record<string, boolean>): Record<string, boolean> {
  return {
    codigo: true, produto: true, peso: true, clientePedido: false, destino: true,
    origemFrigorifico: true, nfLote: true, dataHora: true, operador: true,
    caracteristicas: false, qrCode: true, codigoBarras: false,
    ...overrides,
  };
}

/** Os 6 modelos de ModelosEtiqueta.tsx linhas 44–69 (decisão 21 da Onda 3). */
const MODELOS_ETIQUETA_SEED = [
  { slug: 'peca-pedido', nome: 'Peça para Pedido', campos: camposEtiqueta({ clientePedido: true, caracteristicas: true }) },
  { slug: 'peca-estoque', nome: 'Peça para Estoque', campos: camposEtiqueta({ clientePedido: false, destino: true }) },
  { slug: 'peca-desossa', nome: 'Peça para Desossa', campos: camposEtiqueta({ clientePedido: false, caracteristicas: true }) },
  { slug: 'parte-pedido', nome: 'Parte para Pedido', campos: camposEtiqueta({ clientePedido: true, caracteristicas: true, origemFrigorifico: true }) },
  { slug: 'parte-estoque', nome: 'Parte para Estoque', campos: camposEtiqueta({ clientePedido: false }) },
  { slug: 'produto-unidade', nome: 'Produto por Unidade', campos: camposEtiqueta({ peso: false, caracteristicas: false, qrCode: false, codigoBarras: true }) },
];

async function seedModelosEtiqueta(db: Db): Promise<void> {
  for (const m of MODELOS_ETIQUETA_SEED) {
    await db
      .insert(modelosEtiqueta)
      .values({ slug: m.slug, nome: m.nome, campos: m.campos })
      .onConflictDoNothing();
  }
}
```

> `Db` é o alias de tipo já usado no arquivo para `NodePgDatabase<typeof schema>`; reutilizar o alias
> existente em vez de criar um novo. `sql` é importado apenas se o arquivo ainda não o importar.

**2.2** Chamar as três no corpo principal do seed, nesta ordem, após o seed de RBAC:

```ts
  await seedMenusVisiveis(db);
  await seedParametros(db);
  await seedModelosEtiqueta(db);
```

**Verificação:**

```bash
cd app/backend && npm run db:seed
```

Saída esperada: o script termina com código 0. Conferência direta:

```bash
psql "$DATABASE_URL" -c "SELECT slug, cardinality(menus_visiveis) FROM perfis ORDER BY slug;"
```

Saída esperada (11 linhas): `administrador 39`, `comercial 8`, `compras 5`, `conferente 1`, `corte 3`,
`diretoria 6`, `expedicao 10`, `faturamento 8`, `gestor 36`, `logistica 3`, `recebimento_pesagem 7`.
Soma = 126.

---

### Task 3 — Permissões novas e snapshot RBAC

**3.1** Em `app/backend/src/common/rbac/permissoes.ts`, acrescentar ao objeto `PERMISSOES`, logo após o
bloco `// ── F2 — Cadastros Base …`:

```ts
  FROTA_CAMINHOES_LER: 'FROTA_CAMINHOES_LER',
  FROTA_CAMINHOES_GERENCIAR: 'FROTA_CAMINHOES_GERENCIAR',
  FROTA_MOTORISTAS_LER: 'FROTA_MOTORISTAS_LER',
  FROTA_MOTORISTAS_GERENCIAR: 'FROTA_MOTORISTAS_GERENCIAR',
  MODELOS_ETIQUETA_LER: 'MODELOS_ETIQUETA_LER',
  MODELOS_ETIQUETA_GERENCIAR: 'MODELOS_ETIQUETA_GERENCIAR',
```

**3.2** Acrescentar as descrições em `DESCRICOES_PERMISSOES`:

```ts
  FROTA_CAMINHOES_LER: 'Consultar caminhões da frota',
  FROTA_CAMINHOES_GERENCIAR: 'Criar, editar, excluir e restaurar caminhões da frota',
  FROTA_MOTORISTAS_LER: 'Consultar motoristas',
  FROTA_MOTORISTAS_GERENCIAR: 'Criar, editar, excluir e restaurar motoristas',
  MODELOS_ETIQUETA_LER: 'Consultar modelos de etiqueta',
  MODELOS_ETIQUETA_GERENCIAR: 'Configurar campos dos modelos de etiqueta',
```

**3.3** Atribuir (decisão 27) usando o helper `pushPermissoes` já existente, após os `pushPermissoes` da
Onda 1:

```ts
pushPermissoes(
  'administrador',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
  'MODELOS_ETIQUETA_LER', 'MODELOS_ETIQUETA_GERENCIAR',
);
pushPermissoes(
  'gestor',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
  'MODELOS_ETIQUETA_LER', 'MODELOS_ETIQUETA_GERENCIAR',
);
pushPermissoes(
  'expedicao',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
);
pushPermissoes('recebimento_pesagem', 'MODELOS_ETIQUETA_LER');
pushPermissoes('corte', 'MODELOS_ETIQUETA_LER');
```

**3.4** Regenerar o snapshot:

```bash
cd app/backend && npm run rbac:snapshot
```

Saída esperada: `perfil-permissoes.snapshot.json` reescrito. Contagens após a alteração:
`administrador 61`, `gestor 54`, `expedicao 17`, `recebimento_pesagem 21`, `corte 19`; os demais 6 perfis
ficam inalterados (`comercial 17`, `compras 19`, `conferente 10`, `diretoria 13`, `faturamento 16`,
`logistica 11`).

**Verificação:**

```bash
cd app/backend && npx jest test/integration/rbac.e2e-spec.ts
```

Saída esperada: suíte verde.

---

### Task 4 — Backend: módulo `frota` (caminhões de cadastro e motoristas)

**4.1** `app/backend/src/modules/frota/dto/caminhao-cadastro.dto.ts`:

```ts
import { z } from 'zod';

export const createCaminhaoCadastroSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, 'Placa inválida. Use o formato ABC-1D23'),
  descricao: z.string().trim().max(200).optional(),
  capacidadeKg: z.coerce.number().int().min(0).default(0),
  rotaPadraoId: z.string().uuid().nullable().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateCaminhaoCadastroDto = z.infer<typeof createCaminhaoCadastroSchema>;

export const updateCaminhaoCadastroSchema = createCaminhaoCadastroSchema.partial();
export type UpdateCaminhaoCadastroDto = z.infer<typeof updateCaminhaoCadastroSchema>;
```

**4.2** `app/backend/src/modules/frota/dto/motorista.dto.ts`:

```ts
import { z } from 'zod';

export const createMotoristaSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  documento: z.string().trim().min(1).max(100),
  telefone: z.string().trim().max(50).optional(),
  caminhaoPadraoId: z.string().uuid().nullable().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateMotoristaDto = z.infer<typeof createMotoristaSchema>;

export const updateMotoristaSchema = createMotoristaSchema.partial();
export type UpdateMotoristaDto = z.infer<typeof updateMotoristaSchema>;
```

**4.3** `app/backend/src/modules/frota/caminhoes-cadastro.service.ts`:

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { frotaCaminhoes, rotas } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateCaminhaoCadastroDto, UpdateCaminhaoCadastroDto } from './dto/caminhao-cadastro.dto';

type CaminhaoCadastro = typeof frotaCaminhoes.$inferSelect;
type CaminhaoCadastroLista = CaminhaoCadastro & { rotaPadraoNome: string | null };

@Injectable()
export class CaminhoesCadastroService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<CaminhaoCadastroLista>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(frotaCaminhoes.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(frotaCaminhoes.placa, termo), ilike(frotaCaminhoes.descricao, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: frotaCaminhoes.id,
          placa: frotaCaminhoes.placa,
          descricao: frotaCaminhoes.descricao,
          capacidadeKg: frotaCaminhoes.capacidadeKg,
          rotaPadraoId: frotaCaminhoes.rotaPadraoId,
          rotaPadraoNome: rotas.nome,
          status: frotaCaminhoes.status,
          createdAt: frotaCaminhoes.createdAt,
          updatedAt: frotaCaminhoes.updatedAt,
          deletedAt: frotaCaminhoes.deletedAt,
        })
        .from(frotaCaminhoes)
        .leftJoin(rotas, eq(frotaCaminhoes.rotaPadraoId, rotas.id))
        .where(where)
        .orderBy(desc(frotaCaminhoes.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(frotaCaminhoes).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<CaminhaoCadastro> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Caminhão não encontrado');
    return registro;
  }

  async criar(dto: CreateCaminhaoCadastroDto, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      await this.assertPlacaLivre(tx, dto.placa);

      const criado = primeiroOuFalha(
        await tx.insert(frotaCaminhoes).values({
          placa: dto.placa,
          descricao: dto.descricao,
          capacidadeKg: dto.capacidadeKg,
          rotaPadraoId: dto.rotaPadraoId ?? null,
          status: dto.status,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateCaminhaoCadastroDto, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');
      if (dto.placa && dto.placa !== anterior.placa) await this.assertPlacaLivre(tx, dto.placa);

      const atualizado = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({
          placa: dto.placa ?? anterior.placa,
          descricao: dto.descricao ?? anterior.descricao,
          capacidadeKg: dto.capacidadeKg ?? anterior.capacidadeKg,
          rotaPadraoId: dto.rotaPadraoId === undefined ? anterior.rotaPadraoId : dto.rotaPadraoId,
          status: dto.status ?? anterior.status,
        }).where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({ deletedAt: new Date() })
          .where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(frotaCaminhoes)
        .where(eq(frotaCaminhoes.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Caminhão não está removido');
      await this.assertPlacaLivre(tx, anterior.placa);

      const restaurado = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({ deletedAt: null })
          .where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertPlacaLivre(
    tx: NodePgDatabase<typeof schema>,
    placa: string,
  ): Promise<void> {
    const existente = await tx.select({ id: frotaCaminhoes.id }).from(frotaCaminhoes)
      .where(and(isNull(frotaCaminhoes.deletedAt), eq(frotaCaminhoes.placa, placa)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe caminhão ativo com esta placa');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<CaminhaoCadastro | null> {
    const exec = tx ?? this.db;
    return exec.select().from(frotaCaminhoes)
      .where(and(eq(frotaCaminhoes.id, id), isNull(frotaCaminhoes.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
```

**4.4** `app/backend/src/modules/frota/motoristas.service.ts`:

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { frotaCaminhoes, frotaMotoristas } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateMotoristaDto, UpdateMotoristaDto } from './dto/motorista.dto';

type Motorista = typeof frotaMotoristas.$inferSelect;
type MotoristaLista = Motorista & {
  caminhaoPadraoPlaca: string | null;
  caminhaoPadraoAtivo: boolean | null;
};

@Injectable()
export class MotoristasService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<MotoristaLista>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(frotaMotoristas.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(frotaMotoristas.nome, termo),
          ilike(frotaMotoristas.documento, termo),
          ilike(frotaMotoristas.telefone, termo),
        ),
      );
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: frotaMotoristas.id,
          nome: frotaMotoristas.nome,
          documento: frotaMotoristas.documento,
          telefone: frotaMotoristas.telefone,
          caminhaoPadraoId: frotaMotoristas.caminhaoPadraoId,
          caminhaoPadraoPlaca: frotaCaminhoes.placa,
          caminhaoPadraoAtivo: sql<boolean | null>`${frotaCaminhoes.deletedAt} IS NULL`,
          status: frotaMotoristas.status,
          createdAt: frotaMotoristas.createdAt,
          updatedAt: frotaMotoristas.updatedAt,
          deletedAt: frotaMotoristas.deletedAt,
        })
        .from(frotaMotoristas)
        .leftJoin(frotaCaminhoes, eq(frotaMotoristas.caminhaoPadraoId, frotaCaminhoes.id))
        .where(where)
        .orderBy(desc(frotaMotoristas.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(frotaMotoristas).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Motorista> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Motorista não encontrado');
    return registro;
  }

  async criar(dto: CreateMotoristaDto, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      await this.assertDocumentoLivre(tx, dto.documento);

      const criado = primeiroOuFalha(
        await tx.insert(frotaMotoristas).values({
          nome: dto.nome,
          documento: dto.documento,
          telefone: dto.telefone,
          caminhaoPadraoId: dto.caminhaoPadraoId ?? null,
          status: dto.status,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateMotoristaDto, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');
      if (dto.documento && dto.documento !== anterior.documento) {
        await this.assertDocumentoLivre(tx, dto.documento);
      }

      const atualizado = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({
          nome: dto.nome ?? anterior.nome,
          documento: dto.documento ?? anterior.documento,
          telefone: dto.telefone ?? anterior.telefone,
          caminhaoPadraoId:
            dto.caminhaoPadraoId === undefined ? anterior.caminhaoPadraoId : dto.caminhaoPadraoId,
          status: dto.status ?? anterior.status,
        }).where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({ deletedAt: new Date() })
          .where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(frotaMotoristas)
        .where(eq(frotaMotoristas.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Motorista não está removido');
      await this.assertDocumentoLivre(tx, anterior.documento);

      const restaurado = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({ deletedAt: null })
          .where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertDocumentoLivre(
    tx: NodePgDatabase<typeof schema>,
    documento: string,
  ): Promise<void> {
    const existente = await tx.select({ id: frotaMotoristas.id }).from(frotaMotoristas)
      .where(and(isNull(frotaMotoristas.deletedAt), eq(frotaMotoristas.documento, documento)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe motorista ativo com este documento');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Motorista | null> {
    const exec = tx ?? this.db;
    return exec.select().from(frotaMotoristas)
      .where(and(eq(frotaMotoristas.id, id), isNull(frotaMotoristas.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
```

**4.5** `app/backend/src/modules/frota/caminhoes-cadastro.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../common/crud/paginacao';
import { CaminhoesCadastroService } from './caminhoes-cadastro.service';
import {
  createCaminhaoCadastroSchema, updateCaminhaoCadastroSchema,
  type CreateCaminhaoCadastroDto, type UpdateCaminhaoCadastroDto,
} from './dto/caminhao-cadastro.dto';

@SkipThrottle()
@Controller('frota/caminhoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CaminhoesCadastroController {
  constructor(private readonly service: CaminhoesCadastroService) {}

  @Get()
  @RequirePermissoes('FROTA_CAMINHOES_LER')
  listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('FROTA_CAMINHOES_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('FROTA_CAMINHOES_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createCaminhaoCadastroSchema)) dto: CreateCaminhaoCadastroDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FROTA_CAMINHOES_GERENCIAR')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCaminhaoCadastroSchema)) dto: UpdateCaminhaoCadastroDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FROTA_CAMINHOES_GERENCIAR')
  remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('FROTA_CAMINHOES_GERENCIAR')
  restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.restaurar(id, user.sub);
  }
}
```

**4.6** `app/backend/src/modules/frota/motoristas.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../common/crud/paginacao';
import { MotoristasService } from './motoristas.service';
import {
  createMotoristaSchema, updateMotoristaSchema,
  type CreateMotoristaDto, type UpdateMotoristaDto,
} from './dto/motorista.dto';

@SkipThrottle()
@Controller('frota/motoristas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MotoristasController {
  constructor(private readonly service: MotoristasService) {}

  @Get()
  @RequirePermissoes('FROTA_MOTORISTAS_LER')
  listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createMotoristaSchema)) dto: CreateMotoristaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMotoristaSchema)) dto: UpdateMotoristaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.restaurar(id, user.sub);
  }
}
```

**4.7** `app/backend/src/modules/frota/frota.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { CaminhoesCadastroController } from './caminhoes-cadastro.controller';
import { CaminhoesCadastroService } from './caminhoes-cadastro.service';
import { MotoristasController } from './motoristas.controller';
import { MotoristasService } from './motoristas.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [CaminhoesCadastroController, MotoristasController],
  providers: [CaminhoesCadastroService, MotoristasService],
  exports: [CaminhoesCadastroService, MotoristasService],
})
export class FrotaModule {}
```

**4.8** Registrar `FrotaModule` na lista `imports` de `app/backend/src/app.module.ts`, na mesma posição
alfabética dos demais módulos de cadastro.

**4.9** Criar `app/backend/test/integration/frota.e2e-spec.ts` cobrindo DoD-15 a DoD-18:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Frota e2e (caminhões de cadastro e motoristas)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('caminhao de frota: ciclo CRUD, placa duplicada e restauracao', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'ABC-1D23', descricao: 'Baú refrigerado', capacidadeKg: 4500 });
    expect(criar.status).toBe(201);
    const id = criar.body.id as string;

    const dup = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'ABC-1D23' });
    expect(dup.status).toBe(409);

    const editar = await request(srv()).patch(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)
      .send({ capacidadeKg: 6000, status: 'inativo' });
    expect(editar.status).toBe(200);
    expect(editar.body.capacidadeKg).toBe(6000);

    const lista = await request(srv()).get('/frota/caminhoes?search=ABC').set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(1);

    expect((await request(srv()).delete(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)).status).toBe(200);
    expect((await request(srv()).get(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)).status).toBe(404);
    expect((await request(srv()).post(`/frota/caminhoes/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
  });

  it('motorista: ciclo CRUD, documento duplicado e caminhao padrao', async () => {
    const caminhao = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'DEF-2E34' });
    const criar = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies)
      .send({ nome: 'Carlos Souza', documento: 'CNH 123', telefone: '(11) 98811-0011', caminhaoPadraoId: caminhao.body.id });
    expect(criar.status).toBe(201);

    const dup = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies)
      .send({ nome: 'Outro', documento: 'CNH 123' });
    expect(dup.status).toBe(409);

    const lista = await request(srv()).get('/frota/motoristas').set('Cookie', adminCookies);
    expect(lista.body.data[0].caminhaoPadraoPlaca).toBe('DEF-2E34');

    const semCaminhao = await request(srv())
      .patch(`/frota/motoristas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({ caminhaoPadraoId: null });
    expect(semCaminhao.status).toBe(200);
    expect(semCaminhao.body.caminhaoPadraoId).toBeNull();
  });

  it('frota respeita RBAC de leitura e escrita', async () => {
    expect((await request(srv()).get('/frota/caminhoes').set('Cookie', comercialCookies)).status).toBe(403);
    expect((await request(srv()).post('/frota/caminhoes').set('Cookie', comercialCookies)
      .send({ placa: 'XYZ-9Z99' })).status).toBe(403);
    expect((await request(srv()).get('/frota/motoristas').set('Cookie', comercialCookies)).status).toBe(403);
  });

  it('frota audita insert, update e delete', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'GHI-3F45' });
    const id = criar.body.id as string;
    await request(srv()).patch(`/frota/caminhoes/${id}`).set('Cookie', adminCookies).send({ descricao: 'x' });
    await request(srv()).delete(`/frota/caminhoes/${id}`).set('Cookie', adminCookies);

    const log = await request(srv())
      .get(`/auditoria?tabela=frota_caminhoes&registroId=${id}`).set('Cookie', adminCookies);
    expect(log.status).toBe(200);
    expect(log.body.data.map((l: { operacao: string }) => l.operacao).sort())
      .toEqual(['DELETE', 'INSERT', 'UPDATE']);
  });
});
```

**Verificação:**

```bash
cd app/backend && npx jest test/integration/frota.e2e-spec.ts
```

Saída esperada: `Tests: 4 passed, 4 total`.

---

### Task 5 — Backend: módulo `modelos-etiqueta`

**5.1** `app/backend/src/modules/modelos-etiqueta/dto/modelo-etiqueta.dto.ts`:

```ts
import { z } from 'zod';
import { CAMPOS_ETIQUETA } from '../../../database/schema/modelos-etiqueta.schema';

/** Objeto com exatamente as 12 chaves booleanas — nem a mais, nem a menos (DoD-20). */
export const camposEtiquetaSchema = z
  .object(
    Object.fromEntries(CAMPOS_ETIQUETA.map((c) => [c, z.boolean()])) as Record<
      (typeof CAMPOS_ETIQUETA)[number],
      z.ZodBoolean
    >,
  )
  .strict();

export const createModeloEtiquetaSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Use apenas minúsculas, números e hífen'),
  nome: z.string().trim().min(1).max(120),
  campos: camposEtiquetaSchema,
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateModeloEtiquetaDto = z.infer<typeof createModeloEtiquetaSchema>;

export const updateModeloEtiquetaSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  campos: camposEtiquetaSchema.optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
});

export type UpdateModeloEtiquetaDto = z.infer<typeof updateModeloEtiquetaSchema>;
```

**5.2** `app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.service.ts`:

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { modelosEtiqueta } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateModeloEtiquetaDto, UpdateModeloEtiquetaDto } from './dto/modelo-etiqueta.dto';

type ModeloEtiqueta = typeof modelosEtiqueta.$inferSelect;

@Injectable()
export class ModelosEtiquetaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<ModeloEtiqueta>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(modelosEtiqueta.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(modelosEtiqueta.nome, termo), ilike(modelosEtiqueta.slug, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(modelosEtiqueta).where(where)
        .orderBy(asc(modelosEtiqueta.nome)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(modelosEtiqueta).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<ModeloEtiqueta> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Modelo de etiqueta não encontrado');
    return registro;
  }

  async criar(dto: CreateModeloEtiquetaDto, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      await this.assertSlugLivre(tx, dto.slug);

      const criado = primeiroOuFalha(
        await tx.insert(modelosEtiqueta).values({
          slug: dto.slug,
          nome: dto.nome,
          campos: dto.campos,
          status: dto.status,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateModeloEtiquetaDto, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');

      const atualizado = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({
          nome: dto.nome ?? anterior.nome,
          campos: dto.campos ?? anterior.campos,
          status: dto.status ?? anterior.status,
        }).where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({ deletedAt: new Date() })
          .where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(modelosEtiqueta)
        .where(eq(modelosEtiqueta.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Modelo de etiqueta não está removido');
      await this.assertSlugLivre(tx, anterior.slug);

      const restaurado = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({ deletedAt: null })
          .where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertSlugLivre(tx: NodePgDatabase<typeof schema>, slug: string): Promise<void> {
    const existente = await tx.select({ id: modelosEtiqueta.id }).from(modelosEtiqueta)
      .where(and(isNull(modelosEtiqueta.deletedAt), eq(modelosEtiqueta.slug, slug)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe modelo ativo com este slug');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<ModeloEtiqueta | null> {
    const exec = tx ?? this.db;
    return exec.select().from(modelosEtiqueta)
      .where(and(eq(modelosEtiqueta.id, id), isNull(modelosEtiqueta.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
```

**5.3** `app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../common/crud/paginacao';
import { ModelosEtiquetaService } from './modelos-etiqueta.service';
import {
  createModeloEtiquetaSchema, updateModeloEtiquetaSchema,
  type CreateModeloEtiquetaDto, type UpdateModeloEtiquetaDto,
} from './dto/modelo-etiqueta.dto';

@SkipThrottle()
@Controller('modelos-etiqueta')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ModelosEtiquetaController {
  constructor(private readonly service: ModelosEtiquetaService) {}

  @Get()
  @RequirePermissoes('MODELOS_ETIQUETA_LER')
  listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createModeloEtiquetaSchema)) dto: CreateModeloEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModeloEtiquetaSchema)) dto: UpdateModeloEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.restaurar(id, user.sub);
  }
}
```

**5.4** `app/backend/src/modules/modelos-etiqueta/modelos-etiqueta.module.ts`, registrado na lista
`imports` de `app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { ModelosEtiquetaController } from './modelos-etiqueta.controller';
import { ModelosEtiquetaService } from './modelos-etiqueta.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [ModelosEtiquetaController],
  providers: [ModelosEtiquetaService],
  exports: [ModelosEtiquetaService],
})
export class ModelosEtiquetaModule {}
```

**5.5** `app/backend/test/integration/modelos-etiqueta.e2e-spec.ts` cobrindo DoD-19 e DoD-20:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

const SLUGS = ['peca-pedido', 'peca-estoque', 'peca-desossa', 'parte-pedido', 'parte-estoque', 'produto-unidade'];

describe('Modelos de etiqueta e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    for (const slug of SLUGS) {
      await request(app.getHttpServer()).post('/modelos-etiqueta').set('Cookie', adminCookies).send({
        slug,
        nome: slug,
        campos: {
          codigo: true, produto: true, peso: true, clientePedido: slug.endsWith('pedido'),
          destino: true, origemFrigorifico: true, nfLote: true, dataHora: true,
          operador: true, caracteristicas: false, qrCode: slug !== 'produto-unidade',
          codigoBarras: slug === 'produto-unidade',
        },
      });
    }
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('seed cria os 6 modelos com os campos do prototipo', async () => {
    const lista = await request(srv()).get('/modelos-etiqueta').set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((m: { slug: string }) => m.slug).sort()).toEqual([...SLUGS].sort());
    const unidade = lista.body.data.find((m: { slug: string }) => m.slug === 'produto-unidade');
    expect(unidade.campos.codigoBarras).toBe(true);
    expect(unidade.campos.qrCode).toBe(false);
  });

  it('atualiza campos e rejeita conjunto de chaves invalido', async () => {
    const lista = await request(srv()).get('/modelos-etiqueta').set('Cookie', adminCookies);
    const alvo = lista.body.data[0];

    const ok = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { ...alvo.campos, caracteristicas: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.campos.caracteristicas).toBe(true);

    const faltando = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { codigo: true } });
    expect(faltando.status).toBe(400);

    const sobrando = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { ...alvo.campos, inventado: true } });
    expect(sobrando.status).toBe(400);
  });
});
```

**Verificação:**

```bash
cd app/backend && npx jest test/integration/modelos-etiqueta.e2e-spec.ts
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 6 — Backend: paradas e dias de atendimento da rota

**6.1** Em `app/backend/src/modules/cadastros/rotas/dto/rota.dto.ts`, acrescentar ao objeto do
`createRotaSchema` (e o `update` continua sendo o `.partial()` dele):

```ts
export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const paradaSchema = z.object({
  ordem: z.coerce.number().int().min(1),
  descricao: z.string().trim().min(1).max(120),
});

  paradas: z.array(paradaSchema).max(100).default([]),
  diasAtendimento: z.array(z.enum(DIAS_SEMANA)).max(7).default([]),
```

**6.2** Em `rotas.service.ts`, normalizar a ordem antes de gravar (a tela envia a lista já reordenada;
o backend reescreve `ordem` para `1..n` para não depender do cliente — RA-01) e persistir os dois campos
em `criar` e `atualizar`:

```ts
  private normalizarParadas(paradas: { ordem: number; descricao: string }[]) {
    return [...paradas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((p, i) => ({ ordem: i + 1, descricao: p.descricao }));
  }

  private normalizarDias(dias: string[]): string[] {
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    return [...new Set(dias)].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  }
```

No `values(...)` de `criar`:

```ts
        paradas: this.normalizarParadas(dto.paradas),
        diasAtendimento: this.normalizarDias(dto.diasAtendimento),
```

No `set(...)` de `atualizar`:

```ts
        paradas: dto.paradas ? this.normalizarParadas(dto.paradas) : anterior.paradas,
        diasAtendimento: dto.diasAtendimento
          ? this.normalizarDias(dto.diasAtendimento)
          : anterior.diasAtendimento,
```

**6.3** Criar `app/backend/test/integration/rotas-paradas.e2e-spec.ts` (DoD-21 e DoD-22):

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Rotas — paradas e dias de atendimento', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('rota persiste paradas ordenadas e dias validos', async () => {
    const criar = await request(srv()).post('/rotas').set('Cookie', adminCookies).send({
      codigo: 'L1',
      nome: 'Rota L1 · Centro',
      regiao: 'Centro',
      paradas: [
        { ordem: 2, descricao: 'Jardim Paulista' },
        { ordem: 1, descricao: 'Centro' },
        { ordem: 3, descricao: 'Bela Vista' },
      ],
      diasAtendimento: ['sex', 'seg', 'seg'],
    });
    expect(criar.status).toBe(201);
    expect(criar.body.paradas).toEqual([
      { ordem: 1, descricao: 'Centro' },
      { ordem: 2, descricao: 'Jardim Paulista' },
      { ordem: 3, descricao: 'Bela Vista' },
    ]);
    expect(criar.body.diasAtendimento).toEqual(['seg', 'sex']);

    const invalido = await request(srv()).post('/rotas').set('Cookie', adminCookies)
      .send({ codigo: 'L2', nome: 'X', diasAtendimento: ['segunda'] });
    expect(invalido.status).toBe(400);
  });

  it('reordenacao de paradas preserva descricoes', async () => {
    const criar = await request(srv()).post('/rotas').set('Cookie', adminCookies).send({
      codigo: 'SUL', nome: 'Rota Sul',
      paradas: [
        { ordem: 1, descricao: 'Santo Amaro' },
        { ordem: 2, descricao: 'Moema' },
        { ordem: 3, descricao: 'Brooklin' },
      ],
    });
    const editar = await request(srv()).patch(`/rotas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({
        paradas: [
          { ordem: 1, descricao: 'Brooklin' },
          { ordem: 2, descricao: 'Santo Amaro' },
          { ordem: 3, descricao: 'Moema' },
        ],
      });
    expect(editar.status).toBe(200);
    expect(editar.body.paradas.map((p: { descricao: string }) => p.descricao))
      .toEqual(['Brooklin', 'Santo Amaro', 'Moema']);
  });
});
```

**Verificação:**

```bash
cd app/backend && npx jest test/integration/rotas-paradas.e2e-spec.ts
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 7 — Backend: contagens e histórico do fornecedor

**7.1** Em `fornecedores.service.ts`, acrescentar:

```ts
  async contagens(): Promise<{ total: number; ativos: number; inativos: number }> {
    const linha = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        ativos: sql<number>`count(*) FILTER (WHERE ${fornecedores.status} = 'ativo')::int`,
        inativos: sql<number>`count(*) FILTER (WHERE ${fornecedores.status} = 'inativo')::int`,
      })
      .from(fornecedores)
      .where(isNull(fornecedores.deletedAt))
      .then((r) => r[0]);
    return linha ?? { total: 0, ativos: 0, inativos: 0 };
  }

  /**
   * Histórico real de ocorrências do fornecedor (decisão 18 da Onda 3).
   * `ultimaDivergencia` é null quando não há ocorrência — a tela mostra "—".
   */
  async historico(id: string): Promise<{
    ocorrenciasAno: number;
    ultimaDivergencia: { data: Date; tipo: string } | null;
  }> {
    const fornecedor = await this.detalhar(id);
    const inicioDoAno = new Date(new Date().getFullYear(), 0, 1);

    const [contagem, ultima] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(ocorrenciasFornecedor)
        .where(and(
          eq(ocorrenciasFornecedor.fornecedorId, fornecedor.id),
          gte(ocorrenciasFornecedor.createdAt, inicioDoAno),
        )),
      this.db
        .select({ data: ocorrenciasFornecedor.createdAt, tipo: ocorrenciasFornecedor.tipo })
        .from(ocorrenciasFornecedor)
        .where(eq(ocorrenciasFornecedor.fornecedorId, fornecedor.id))
        .orderBy(desc(ocorrenciasFornecedor.createdAt))
        .limit(1),
    ]);

    return {
      ocorrenciasAno: contagem[0]?.total ?? 0,
      ultimaDivergencia: ultima[0] ?? null,
    };
  }
```

**7.2** Em `fornecedores.controller.ts`, acrescentar as duas rotas **antes** de `@Get(':id')` (senão
`contagens` é capturado como `:id`):

```ts
  @Get('contagens')
  @RequirePermissoes('FORNECEDORES_LER')
  contagens() {
    return this.fornecedoresService.contagens();
  }

  @Get(':id/historico')
  @RequirePermissoes('FORNECEDORES_LER')
  historico(@Param('id') id: string) {
    return this.fornecedoresService.historico(id);
  }
```

**7.3** Em `app/backend/test/integration/cadastros-diversos.e2e-spec.ts`, acrescentar os dois testes de
DoD-23 e DoD-24:

```ts
  it('contagens de fornecedores batem com o banco', async () => {
    await request(srv()).post('/fornecedores').set('Cookie', adminCookies)
      .send({ codigo: 'FOR-C1', razaoSocial: 'Ativo 1', documentoFiscal: '12345678000190' });
    const inativo = await request(srv()).post('/fornecedores').set('Cookie', adminCookies)
      .send({ codigo: 'FOR-C2', razaoSocial: 'Inativo 1', documentoFiscal: '98765432000110', status: 'inativo' });
    expect(inativo.status).toBe(201);

    const contagens = await request(srv()).get('/fornecedores/contagens').set('Cookie', adminCookies);
    expect(contagens.status).toBe(200);
    expect(contagens.body.total).toBe(contagens.body.ativos + contagens.body.inativos);
    expect(contagens.body.inativos).toBeGreaterThanOrEqual(1);
  });

  it('historico do fornecedor vem de ocorrencias reais', async () => {
    const criar = await request(srv()).post('/fornecedores').set('Cookie', adminCookies)
      .send({ codigo: 'FOR-H1', razaoSocial: 'Com histórico', documentoFiscal: '11222333000144' });
    const semOcorrencia = await request(srv())
      .get(`/fornecedores/${criar.body.id}/historico`).set('Cookie', adminCookies);
    expect(semOcorrencia.status).toBe(200);
    expect(semOcorrencia.body).toEqual({ ocorrenciasAno: 0, ultimaDivergencia: null });
  });
```

**7.4** Em `app/frontend/src/lib/cadastros-config.ts`, acrescentar ao `fornecedoresConfig` os campos da
decisão 17 e a nota de qualidade, na aba `parametros`:

```ts
    {
      nome: 'horarioLimiteRecebimento',
      rotulo: 'Horário Limite Recebimento',
      tipo: 'text',
      placeholder: 'HH:MM',
      aba: 'parametros',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'capacidadeMaximaKg',
      rotulo: 'Capacidade Max. Caminhão (kg)',
      tipo: 'number',
      aba: 'parametros',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'toleranciaDivergenciaPercentual',
      rotulo: 'Tolerância de Divergência (%)',
      tipo: 'number',
      aba: 'parametros',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'notaQualidade',
      rotulo: 'Nota de Qualidade',
      tipo: 'select',
      opcoes: [
        { valor: 'A', rotulo: 'A (Excelente)' },
        { valor: 'B', rotulo: 'B (Bom)' },
        { valor: 'C', rotulo: 'C (Regular)' },
      ],
      aba: 'parametros',
      jsonCampo: 'parametrosOperacionaisJson',
    },
```

E ao `parametrosFornecedorFormSchema`:

```ts
    horarioLimiteRecebimento: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),
    capacidadeMaximaKg: z.coerce.number().int().min(0).optional(),
    toleranciaDivergenciaPercentual: z.coerce.number().min(0).max(100).optional(),
    notaQualidade: z.enum(['A', 'B', 'C']).optional(),
```

**Verificação:**

```bash
cd app/backend && npx jest test/integration/cadastros-diversos.e2e-spec.ts
```

Saída esperada: suíte verde, incluindo os dois testes novos.

---

### Task 8 — Backend: menus visíveis do perfil e catálogo de permissões

**8.1** Em `app/backend/src/modules/perfis/dto/perfil.dto.ts`, acrescentar:

```ts
export const definirMenusSchema = z.object({
  menus: z.array(z.string().trim().min(1)).max(39),
});

export type DefinirMenusDto = z.infer<typeof definirMenusSchema>;
```

**8.2** Em `rbac.service.ts`, incluir os menus em `listarPerfisComPermissoes` e criar `definirMenusDoPerfil`:

```ts
  /** Lista todos os perfis com permissões e menus visíveis (PERFIS_GERENCIAR). */
  async listarPerfisComPermissoes(): Promise<
    Array<{ id: string; slug: string; nome: string; permissoes: string[]; menusVisiveis: string[] }>
  > {
    const perfis = await this.db.select().from(schema.perfis).orderBy(schema.perfis.slug);
    const vinculos = await this.db
      .select({ perfilId: schema.perfisPermissoes.perfilId, codigo: schema.permissoes.codigo })
      .from(schema.perfisPermissoes)
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id));

    return perfis.map((p) => ({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      permissoes: vinculos.filter((v) => v.perfilId === p.id).map((v) => v.codigo),
      menusVisiveis: p.menusVisiveis,
    }));
  }

  /** Substitui a lista de menus visíveis do perfil. Devolve anterior e novo para auditoria. */
  async definirMenusDoPerfil(
    slug: string,
    menus: string[],
  ): Promise<{ anterior: string[]; novo: string[] } | null> {
    return this.db.transaction(async (tx) => {
      const perfil = await tx
        .select()
        .from(schema.perfis)
        .where(eq(schema.perfis.slug, slug))
        .then((r) => r[0] ?? null);
      if (!perfil) return null;

      const novo = [...new Set(menus)];
      await tx.update(schema.perfis).set({ menusVisiveis: novo }).where(eq(schema.perfis.id, perfil.id));

      return { anterior: perfil.menusVisiveis, novo };
    });
  }
```

**8.3** Em `perfis.service.ts`, acrescentar `definirMenus` e `catalogo`:

```ts
import { MENUS_CANONICOS, menusDesconhecidos } from '../../common/rbac/menus-canonicos';
import { DESCRICOES_PERMISSOES } from '../../common/rbac/permissoes';

  /**
   * Define os menus visíveis do perfil (decisão 10 da Onda 3). Valida ANTES de mutar:
   * href fora do catálogo canônico devolve 400 sem alterar nada (RA-05).
   */
  async definirMenus(slug: string, menus: string[], usuarioId: string) {
    const desconhecidos = menusDesconhecidos(menus);
    if (desconhecidos.length > 0) {
      throw new BadRequestException(`Menus desconhecidos: ${desconhecidos.join(', ')}`);
    }

    const resultado = await this.rbacService.definirMenusDoPerfil(slug, menus);
    if (!resultado) throw new NotFoundException('Perfil não encontrado');

    await this.auditoria.registrar(this.db, {
      tabela: 'perfis',
      registroId: '00000000-0000-0000-0000-000000000000',
      operacao: 'UPDATE',
      modulo: 'perfis',
      usuarioId,
      dadosAnteriores: { slug, menusVisiveis: resultado.anterior },
      dadosNovos: { slug, menusVisiveis: resultado.novo },
    });

    return { slug, menusVisiveis: resultado.novo };
  }

  /**
   * Catálogo para a tela de perfis: permissões agrupadas por módulo (prefixo do código)
   * e a lista canônica de menus. Cobre 100% de DESCRICOES_PERMISSOES (DoD-29).
   */
  catalogo() {
    const MODULOS: Array<{ modulo: string; prefixos: string[] }> = [
      { modulo: 'Administração', prefixos: ['USUARIOS_', 'PERFIS_', 'AUDITORIA_', 'PARAMETROS_'] },
      { modulo: 'Cadastros', prefixos: ['CLIENTES_', 'FORNECEDORES_', 'ITENS_', 'PRODUTOS_', 'REPRESENTANTES_', 'ROTAS_', 'REGRAS_', 'FROTA_', 'MODELOS_ETIQUETA_'] },
      { modulo: 'Comercial', prefixos: ['COMPRAS_PROGRAMADAS_', 'DISPONIBILIDADE_', 'PEDIDOS_', 'PEDIDO_', 'OVERBOOKING_', 'OPERACOES_'] },
      { modulo: 'Recebimento', prefixos: ['RECEBIMENTO_', 'DIVERGENCIA_', 'OCORRENCIA_', 'CONFERENCIA_'] },
      { modulo: 'Pesagem e Desossa', prefixos: ['PESAGEM_', 'PESO_', 'ASSOCIACAO_', 'LEITURA_', 'ETIQUETA_', 'CORTE_', 'DESOSSA_', 'ESTOQUE_'] },
      { modulo: 'Expedição e Faturamento', prefixos: ['EXPEDICAO_', 'FATURAMENTO_', 'NFSE_'] },
    ];

    const codigos = Object.keys(DESCRICOES_PERMISSOES).sort();
    const usados = new Set<string>();
    const grupos = MODULOS.map(({ modulo, prefixos }) => {
      const permissoes = codigos
        .filter((c) => !usados.has(c) && prefixos.some((p) => c.startsWith(p)))
        .map((codigo) => {
          usados.add(codigo);
          return { codigo, descricao: DESCRICOES_PERMISSOES[codigo as keyof typeof DESCRICOES_PERMISSOES] };
        });
      return { modulo, permissoes };
    });

    const restantes = codigos.filter((c) => !usados.has(c));
    if (restantes.length > 0) {
      // Falha explícita: permissão nova sem módulo é erro de configuração, não silêncio (RA-05).
      throw new Error(`Permissões sem módulo no catálogo: ${restantes.join(', ')}`);
    }

    return { grupos, menus: [...MENUS_CANONICOS] };
  }
```

**8.4** Em `perfis.controller.ts`, acrescentar:

```ts
  @Get('catalogo')
  @RequirePermissoes('PERFIS_GERENCIAR')
  catalogo() {
    return this.perfisService.catalogo();
  }

  @Put(':slug/menus')
  @RequirePermissoes('PERFIS_GERENCIAR')
  async definirMenus(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(definirMenusSchema)) dto: DefinirMenusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.perfisService.definirMenus(slug, dto.menus, user.sub);
  }
```

> `@Get('catalogo')` precisa vir **antes** de qualquer rota com parâmetro no mesmo controller.

**8.5** Em `auth.service.ts` (ou onde `getMe` monta o payload do usuário), incluir a união dos menus
visíveis dos perfis do usuário no retorno de `/auth/me`:

```ts
    const menusVisiveis = [
      ...new Set(
        (
          await this.db
            .select({ menus: schema.perfis.menusVisiveis })
            .from(schema.perfis)
            .where(inArray(schema.perfis.slug, perfisDoUsuario))
        ).flatMap((r) => r.menus),
      ),
    ];
```

e devolver `menusVisiveis` junto de `permissoes` no corpo de `/auth/me`.

**8.6** Criar `app/backend/test/integration/perfis-menus.e2e-spec.ts` (DoD-12, DoD-13, DoD-14, DoD-29):

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { MENUS_CANONICOS, MENUS_VISIVEIS_POR_PERFIL } from '../../src/common/rbac/menus-canonicos';
import { DESCRICOES_PERMISSOES } from '../../src/common/rbac/permissoes';
import { DRIZZLE } from '../../src/database/database.module';

describe('Perfis — menus visíveis e catálogo', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('define menus visiveis, audita e rejeita href desconhecido', async () => {
    const antes = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    const conferente = antes.body.find((p: { slug: string }) => p.slug === 'conferente');
    expect(conferente.menusVisiveis).toEqual(['/carga/conferencia']);

    const ok = await request(srv()).put('/perfis/conferente/menus').set('Cookie', adminCookies)
      .send({ menus: ['/carga/conferencia', '/estoque/consulta'] });
    expect(ok.status).toBe(200);
    expect(ok.body.menusVisiveis).toEqual(['/carga/conferencia', '/estoque/consulta']);

    const ruim = await request(srv()).put('/perfis/conferente/menus').set('Cookie', adminCookies)
      .send({ menus: ['/rota/inexistente'] });
    expect(ruim.status).toBe(400);

    const inalterado = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    expect(inalterado.body.find((p: { slug: string }) => p.slug === 'conferente').menusVisiveis)
      .toEqual(['/carga/conferencia', '/estoque/consulta']);

    const log = await request(srv()).get('/auditoria?modulo=perfis').set('Cookie', adminCookies);
    expect(log.body.data.some((l: { dadosNovos: { slug?: string } }) => l.dadosNovos.slug === 'conferente')).toBe(true);
  });

  it('seed de menus visiveis reconcilia perfil alterado', async () => {
    await request(srv()).put('/perfis/corte/menus').set('Cookie', adminCookies).send({ menus: [] });
    const { seedMenusVisiveis } = await import('../../src/database/seed');
    await seedMenusVisiveis(app.get(DRIZZLE).db);

    const depois = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    expect(depois.body.find((p: { slug: string }) => p.slug === 'corte').menusVisiveis)
      .toEqual(MENUS_VISIVEIS_POR_PERFIL.corte);
  });

  it('menu visivel nao concede acesso a api', async () => {
    await request(srv()).put('/perfis/comercial/menus').set('Cookie', adminCookies)
      .send({ menus: [...MENUS_CANONICOS] });
    const negado = await request(srv()).get('/frota/caminhoes').set('Cookie', comercialCookies);
    expect(negado.status).toBe(403);
  });

  it('catalogo de permissoes cobre todo o mapa de descricoes', async () => {
    const res = await request(srv()).get('/perfis/catalogo').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    const codigos = res.body.grupos
      .flatMap((g: { permissoes: { codigo: string }[] }) => g.permissoes.map((p) => p.codigo))
      .sort();
    expect(codigos).toEqual(Object.keys(DESCRICOES_PERMISSOES).sort());
    expect(res.body.menus).toHaveLength(39);
  });
});
```

> Para o teste 2 funcionar, `seedMenusVisiveis` precisa ser exportada de `seed.ts` (a Task 2 já a define;
> acrescentar `export` na declaração).

**Verificação:**

```bash
cd app/backend && npx jest test/integration/perfis-menus.e2e-spec.ts
```

Saída esperada: `Tests: 4 passed, 4 total`.

---

### Task 9 — Backend: resumo de perfis, facetas de auditoria e parâmetros por chave

**9.1** Em `usuarios.service.ts`:

```ts
  /** Contagem de usuários ativos por perfil, nos 11 perfis canônicos e em ordem canônica. */
  async resumoPerfis(): Promise<Array<{ slug: string; nome: string; total: number }>> {
    const linhas = await this.db
      .select({
        slug: schema.perfis.slug,
        nome: schema.perfis.nome,
        total: sql<number>`count(${schema.usuariosPerfis.usuarioId}) FILTER (WHERE ${schema.usuarios.deletedAt} IS NULL)::int`,
      })
      .from(schema.perfis)
      .leftJoin(schema.usuariosPerfis, eq(schema.perfis.id, schema.usuariosPerfis.perfilId))
      .leftJoin(schema.usuarios, eq(schema.usuariosPerfis.usuarioId, schema.usuarios.id))
      .groupBy(schema.perfis.slug, schema.perfis.nome);

    const ORDEM = [
      'administrador', 'gestor', 'compras', 'comercial', 'recebimento_pesagem', 'corte',
      'expedicao', 'conferente', 'faturamento', 'logistica', 'diretoria',
    ];
    return ORDEM.map((slug) => linhas.find((l) => l.slug === slug) ?? { slug, nome: slug, total: 0 });
  }
```

**9.2** Em `usuarios.controller.ts`, **antes** de `@Get(':id')`:

```ts
  @Get('resumo-perfis')
  @RequirePermissoes('USUARIOS_LER')
  resumoPerfis() {
    return this.usuariosService.resumoPerfis();
  }
```

**9.3** Em `auditoria/dto/auditoria.dto.ts`, acrescentar o filtro por trecho (decisão 31):

```ts
  registroBusca: z.string().trim().min(1).max(64).optional(),
```

**9.4** Em `auditoria.service.ts`, no bloco de filtros:

```ts
    if (query.registroBusca) {
      filtros.push(sql`${auditoria.registroId}::text ILIKE ${`%${query.registroBusca}%`}`);
    }
```

e acrescentar as facetas:

```ts
  /** Valores distintos existentes no log, para popular os selects da tela (decisão 30). */
  async facetas(): Promise<{
    modulos: string[];
    tabelas: string[];
    usuarios: Array<{ id: string; nome: string }>;
  }> {
    const [modulos, tabelas, pessoas] = await Promise.all([
      this.db.selectDistinct({ modulo: auditoria.modulo }).from(auditoria).orderBy(auditoria.modulo),
      this.db.selectDistinct({ tabela: auditoria.tabela }).from(auditoria).orderBy(auditoria.tabela),
      this.db
        .selectDistinct({ id: usuarios.id, nome: usuarios.nome })
        .from(auditoria)
        .innerJoin(usuarios, eq(auditoria.usuarioId, usuarios.id))
        .orderBy(usuarios.nome),
    ]);

    return {
      modulos: modulos.map((m) => m.modulo).filter((m): m is string => m !== null),
      tabelas: tabelas.map((t) => t.tabela),
      usuarios: pessoas,
    };
  }
```

**9.5** Em `auditoria.controller.ts`, **antes** de qualquer rota com parâmetro:

```ts
  @Get('facetas')
  @RequirePermissoes('AUDITORIA_VISUALIZAR')
  facetas() {
    return this.service.facetas();
  }
```

**9.6** Em `parametros.service.ts` e `parametros.controller.ts`, acrescentar acesso por chave:

```ts
  async detalharPorChave(chave: string): Promise<Parametro> {
    const param = await this.db
      .select()
      .from(parametros)
      .where(and(eq(parametros.chave, chave), isNull(parametros.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!param) throw new NotFoundException('Parâmetro não encontrado');
    return param;
  }

  async atualizarPorChave(
    chave: string,
    valorJson: Record<string, unknown>,
    usuarioId: string,
  ): Promise<Parametro> {
    const atual = await this.detalharPorChave(chave);
    return this.atualizar(atual.id, { valorJson }, usuarioId);
  }
```

```ts
  @Get('chave/:chave')
  @RequirePermissoes('PARAMETROS_LER')
  detalharPorChave(@Param('chave') chave: string) {
    return this.parametrosService.detalharPorChave(chave);
  }

  @Patch('chave/:chave')
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  atualizarPorChave(
    @Param('chave') chave: string,
    @Body(new ZodValidationPipe(atualizarValorSchema)) dto: { valorJson: Record<string, unknown> },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.parametrosService.atualizarPorChave(chave, dto.valorJson, user.sub);
  }
```

com `atualizarValorSchema = z.object({ valorJson: z.record(z.string(), z.unknown()) })` em
`dto/parametro.dto.ts`.

**9.7** Criar `app/backend/test/integration/parametros-onda3.e2e-spec.ts` (DoD-31 e DoD-32) e
`app/backend/test/integration/auditoria-facetas.e2e-spec.ts` (DoD-33, DoD-34, DoD-35):

```ts
// parametros-onda3.e2e-spec.ts
import { DRIZZLE } from '../../src/database/database.module';

const CHAVES = [
  'comercial.overbooking_permitido', 'comercial.prioridade_consumo', 'operacao.fifo_estoque',
  'operacao.cadencia_dias_semana', 'operacao.composicao_boi_casado', 'operacao.regras_transformacao_tz',
  'fiscal.seguro_integrado', 'fiscal.emissao_fiscal', 'fiscal.expiracao_reserva_rascunho',
];

it('seed cria as 9 chaves de parametro da v1.1 com AD-01, AD-02 e AD-06 honradas', async () => {
  const { seedParametros } = await import('../../src/database/seed');
  await seedParametros(app.get(DRIZZLE).db);

  const lista = await request(srv()).get('/parametros?pageSize=100').set('Cookie', adminCookies);
  const chaves = lista.body.data.map((p: { chave: string }) => p.chave);
  for (const chave of CHAVES) expect(chaves).toContain(chave);

  const porChave = (chave: string) =>
    lista.body.data.find((p: { chave: string }) => p.chave === chave).valorJson as {
      texto: string; provisorio: boolean; pendencia: string | null; tipo: string;
    };

  // AD-01: composição confirmada — sem badge Provisório.
  const boi = porChave('operacao.composicao_boi_casado');
  expect(boi.texto).toContain('2 TZ + 2 DT + 2 PA');
  expect(boi.provisorio).toBe(false);
  expect(boi.pendencia).toBeNull();

  // AD-02: emissão fiscal decidida — nota de homologação no lugar do badge.
  const fiscal = porChave('fiscal.emissao_fiscal');
  expect(fiscal.provisorio).toBe(false);
  expect(fiscal.texto).toContain('aguardando homologação');

  // AD-06: sem TTL de reserva — cartão informativo, não parâmetro pendente.
  const reserva = porChave('fiscal.expiracao_reserva_rascunho');
  expect(reserva.provisorio).toBe(false);
  expect(reserva.tipo).toBe('info');
  expect(reserva.texto).toContain('Sem expiração automática');

  const provisorios = lista.body.data
    .filter(
      (p: { chave: string; valorJson: { provisorio?: boolean } }) =>
        CHAVES.includes(p.chave) && p.valorJson.provisorio === true,
    )
    .map((p: { chave: string; valorJson: { pendencia: string } }) => [p.chave, p.valorJson.pendencia])
    .sort();
  expect(provisorios).toEqual([
    ['operacao.cadencia_dias_semana', 'P1'],
    ['operacao.regras_transformacao_tz', 'P12'],
  ]);
});

it('atualiza parametro por chave, audita e 404 em chave desconhecida', async () => {
  const patch = await request(srv())
    .patch('/parametros/chave/fiscal.seguro_integrado').set('Cookie', adminCookies)
    .send({ valorJson: { grupo: 'Fiscal', tipo: 'toggle', titulo: 'Seguro integrado', texto: 'x', valor: true, provisorio: false, pendencia: null } });
  expect(patch.status).toBe(200);
  expect(patch.body.valorJson.valor).toBe(true);

  const log = await request(srv())
    .get('/auditoria?tabela=parametros&operacao=UPDATE').set('Cookie', adminCookies);
  expect(log.body.total).toBeGreaterThanOrEqual(1);

  const inexistente = await request(srv())
    .patch('/parametros/chave/nao.existe').set('Cookie', adminCookies).send({ valorJson: {} });
  expect(inexistente.status).toBe(404);
});
```

```ts
// auditoria-facetas.e2e-spec.ts
it('auditoria filtra por periodo, usuario, modulo, operacao e registro', async () => {
  const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
    .send({ placa: 'AUD-1A11' });
  const registroId = criar.body.id as string;
  const inicio = new Date(Date.now() - 60_000).toISOString();
  const fim = new Date(Date.now() + 60_000).toISOString();

  const filtrado = await request(srv())
    .get(`/auditoria?modulo=cadastros&operacao=INSERT&tabela=frota_caminhoes&registroId=${registroId}&dataInicio=${inicio}&dataFim=${fim}`)
    .set('Cookie', adminCookies);
  expect(filtrado.status).toBe(200);
  expect(filtrado.body.total).toBe(1);

  const foraDaJanela = await request(srv())
    .get(`/auditoria?dataInicio=${new Date(Date.now() + 3_600_000).toISOString()}`)
    .set('Cookie', adminCookies);
  expect(foraDaJanela.body.total).toBe(0);
});

it('facetas de auditoria listam valores distintos reais', async () => {
  const res = await request(srv()).get('/auditoria/facetas').set('Cookie', adminCookies);
  expect(res.status).toBe(200);
  expect(res.body.modulos).toContain('cadastros');
  expect(res.body.tabelas).toContain('frota_caminhoes');
  expect(res.body.usuarios.length).toBeGreaterThanOrEqual(1);
});

it('filtro de registro aceita trecho e valida uuid', async () => {
  const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
    .send({ placa: 'AUD-2B22' });
  const trecho = (criar.body.id as string).slice(0, 8);

  const porTrecho = await request(srv())
    .get(`/auditoria?registroBusca=${trecho}`).set('Cookie', adminCookies);
  expect(porTrecho.body.total).toBeGreaterThanOrEqual(1);

  const uuidInvalido = await request(srv())
    .get('/auditoria?registroId=PED-123').set('Cookie', adminCookies);
  expect(uuidInvalido.status).toBe(400);
});
```

**Verificação:**

```bash
cd app/backend && npx jest test/integration/parametros-onda3.e2e-spec.ts test/integration/auditoria-facetas.e2e-spec.ts
```

Saída esperada: `Tests: 5 passed, 5 total`.

**9.8** Em `app/backend/test/integration/rbac.e2e-spec.ts`, acrescentar o teste de DoD-30:

```ts
  it('resumo de perfis conta usuarios reais e inclui perfil vazio', async () => {
    const res = await request(srv()).get('/usuarios/resumo-perfis').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(11);
    expect(res.body[0].slug).toBe('administrador');
    expect(res.body[0].total).toBeGreaterThanOrEqual(1);
    expect(res.body.find((l: { slug: string }) => l.slug === 'logistica')).toEqual(
      expect.objectContaining({ slug: 'logistica', total: 0 }),
    );
  });
```

Rodar `cd app/backend && npx jest test/integration/rbac.e2e-spec.ts` — saída esperada: suíte verde com o
caso novo.

---

### Task 10 — Backend: simuladores de desdobramento e de disponibilidade da desossa

**10.1** No serviço de regras de desdobramento, acrescentar (função pura, sem I/O além da leitura):

```ts
  /**
   * Simulador da aba "Desdobramento de Compra" (RegraDesdobramento.tsx, linhas 203–240).
   * Multiplica a quantidade comprada pelo fator de cada item comercial ativo do item de compra.
   */
  async simular(itemCompraId: string, quantidade: number): Promise<{
    quantidade: number;
    itens: Array<{ itemComercialId: string; descricao: string; fator: string; total: number }>;
    somaFatores: number;
    totalPartes: number;
  }> {
    const regras = await this.db
      .select({
        itemComercialId: regrasDesdobramentoComercial.itemComercialId,
        descricao: itensComerciais.descricao,
        fator: regrasDesdobramentoComercial.fatorQuantidade,
      })
      .from(regrasDesdobramentoComercial)
      .innerJoin(itensComerciais, eq(regrasDesdobramentoComercial.itemComercialId, itensComerciais.id))
      .where(and(
        eq(regrasDesdobramentoComercial.itemCompraId, itemCompraId),
        eq(regrasDesdobramentoComercial.status, 'ativo'),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ))
      .orderBy(itensComerciais.descricao);

    const itens = regras.map((r) => ({
      itemComercialId: r.itemComercialId,
      descricao: r.descricao,
      fator: r.fator,
      total: multiplicar(r.fator, quantidade),
    }));

    return {
      quantidade,
      itens,
      somaFatores: itens.reduce((s, i) => s + Number(i.fator), 0),
      totalPartes: itens.reduce((s, i) => s + i.total, 0),
    };
  }
```

`multiplicar` vem de `src/common/crud/decimal.ts` (helper já existente para não usar aritmética de ponto
flutuante em quantidade); se a assinatura existente for diferente, usar a função de multiplicação decimal
já exportada por esse módulo.

Controller: `POST /regras-desdobramento/simular` com
`@RequirePermissoes('REGRAS_DESDOBRAMENTO_LER')` e corpo validado por
`z.object({ itemCompraId: z.string().uuid(), quantidade: z.coerce.number().int().min(1).max(100000) })`.

**10.2** No serviço de regras de transformação da desossa, acrescentar o simulador de disponibilidade
(`RegraDesdobramento.tsx`, linhas 322–500). A exclusividade por unidade de TZ é a regra já implementada
no domínio da desossa (decisão 39): cada unidade de TZ atende **uma** alternativa.

```ts
  /**
   * Simulador da aba "Transformação na Desossa".
   * Dado o total de TZ livre e uma reserva pretendida, devolve o disponível por produto
   * e as alternativas ainda possíveis depois da reserva.
   */
  async simular(input: { tzLivre: number; produtoId?: string; quantidade?: number }) {
    const regras = await this.listarAtivasComSaidas();

    const disponivelPorProduto = new Map<string, { produtoId: string; nome: string; disponivel: number }>();
    for (const regra of regras) {
      for (const saida of regra.saidas) {
        const atual = disponivelPorProduto.get(saida.produtoId);
        const disponivel = Number(saida.quantidadeFixa) * input.tzLivre;
        if (!atual || disponivel > atual.disponivel) {
          disponivelPorProduto.set(saida.produtoId, {
            produtoId: saida.produtoId,
            nome: saida.produtoNome,
            disponivel,
          });
        }
      }
    }

    const reserva = input.produtoId && input.quantidade ? { produtoId: input.produtoId, quantidade: input.quantidade } : null;

    // Exclusividade: reservar N unidades de um produto consome N unidades de TZ na alternativa
    // que o produz, e essas unidades deixam de estar disponíveis para as demais alternativas.
    const alternativasPossiveis = regras
      .filter((regra) => {
        if (!reserva) return true;
        const produz = regra.saidas.find((s) => s.produtoId === reserva.produtoId);
        if (!produz) return tzRestante(regras, reserva, input.tzLivre) > 0;
        return Number(produz.quantidadeFixa) * input.tzLivre >= reserva.quantidade;
      })
      .map((regra) => ({ id: regra.id, nome: regra.nome }));

    const resultados = [...disponivelPorProduto.values()].map((p) => ({
      ...p,
      bloqueado:
        reserva !== null &&
        p.produtoId !== reserva.produtoId &&
        alternativasPossiveis.length > 0 &&
        !regras.some(
          (r) =>
            alternativasPossiveis.some((a) => a.id === r.id) &&
            r.saidas.some((s) => s.produtoId === p.produtoId),
        ),
    }));

    return { tzLivre: input.tzLivre, resultados, alternativasPossiveis };
  }
```

com o auxiliar:

```ts
/** TZ que sobra depois de atender a reserva na alternativa que produz o produto pedido. */
function tzRestante(
  regras: Array<{ saidas: Array<{ produtoId: string; quantidadeFixa: string }> }>,
  reserva: { produtoId: string; quantidade: number },
  tzLivre: number,
): number {
  const produtora = regras.find((r) => r.saidas.some((s) => s.produtoId === reserva.produtoId));
  if (!produtora) return tzLivre;
  const saida = produtora.saidas.find((s) => s.produtoId === reserva.produtoId);
  const porTz = Number(saida?.quantidadeFixa ?? 0);
  if (porTz <= 0) return tzLivre;
  return Math.max(0, tzLivre - Math.ceil(reserva.quantidade / porTz));
}
```

Controller: `POST /desossa/regras-transformacao/simular`, `@RequirePermissoes('DESOSSA_LER')`, corpo
`z.object({ tzLivre: z.coerce.number().int().min(0).max(100000), produtoId: z.string().uuid().optional(), quantidade: z.coerce.number().int().min(1).optional() })`.

**10.3** Testes unitários `test/unit/simulador-desdobramento.spec.ts` e
`test/unit/simulador-desossa.spec.ts` (DoD-26, DoD-27, DoD-28), com o serviço instanciado sobre um duplo
de `db` que devolve as regras fixas do exemplo do protótipo:

```ts
// simulador-desdobramento.spec.ts — DoD-26
it('simulador de desdobramento multiplica fatores e soma partes', async () => {
  const service = criarServiceCom([
    { itemComercialId: 'c1', descricao: 'Traseiro', fator: '2' },
    { itemComercialId: 'c2', descricao: 'Dianteiro', fator: '2' },
    { itemComercialId: 'c3', descricao: 'Ponta de agulha', fator: '2' },
  ]);
  const r = await service.simular('compra-1', 100);
  expect(r.itens.map((i) => i.total)).toEqual([200, 200, 200]);
  expect(r.somaFatores).toBe(6);
  expect(r.totalPartes).toBe(600);
});
```

```ts
// simulador-desossa.spec.ts — DoD-27 e DoD-28
it('simulador de desossa respeita exclusividade por unidade de TZ', async () => {
  const service = criarServiceCom([
    { id: 'a', nome: 'Alternativa A', saidas: [
      { produtoId: 'coxao-bola', produtoNome: 'Coxão-bola', quantidadeFixa: '1' },
      { produtoId: 'jacare', produtoNome: 'Jacaré', quantidadeFixa: '1' },
    ] },
    { id: 'b', nome: 'Alternativa B', saidas: [
      { produtoId: 'coxao-bola-alcatra', produtoNome: 'Coxão-bola com alcatra', quantidadeFixa: '1' },
      { produtoId: 'file-curto', produtoNome: 'Filé curto', quantidadeFixa: '1' },
    ] },
  ]);

  const r = await service.simular({ tzLivre: 10, produtoId: 'jacare', quantidade: 10 });
  expect(r.alternativasPossiveis.map((a) => a.id)).toEqual(['a']);
  expect(r.resultados.find((x) => x.produtoId === 'file-curto')?.bloqueado).toBe(true);
  expect(r.resultados.find((x) => x.produtoId === 'coxao-bola')?.bloqueado).toBe(false);
});

it('simulador de desossa lista alternativas possiveis', async () => {
  const service = criarServiceCom([]);
  const r = await service.simular({ tzLivre: 10 });
  expect(r.alternativasPossiveis).toEqual([]);
  expect(r.resultados).toEqual([]);
});
```

**Verificação:**

```bash
cd app/backend && npx jest test/unit/simulador-desdobramento.spec.ts test/unit/simulador-desossa.spec.ts
```

Saída esperada: `Tests: 3 passed, 3 total`.

---

### Task 11 — Reconciliação do menu: visibilidade por `menusVisiveis` (decisões 25 e 31)

Esta é a task que quita as duas dívidas da Onda 2. O menu deixa de ser derivado de permissões de API e
passa a ser lido de `menusVisiveis`, semeado da matriz. Consequência aritmética: **26 perdas → 0** e
**14 extras → 0**.

**11.1** Em `app/backend/scripts/gerar-snapshot-perfis.ts`, gravar também o snapshot de menus (é o
contrato que o teste do frontend lê, já que o frontend não compila TypeScript do backend):

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../src/common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../src/common/rbac/menus-canonicos';

const rbac = join(__dirname, '..', 'src', 'common', 'rbac');

const snapshotPermissoes = Object.fromEntries(
  Object.entries(MAPA_PERFIL_PERMISSOES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, permissoes]) => [perfil, [...new Set(permissoes)].sort()]),
);
const destinoPermissoes = join(rbac, 'perfil-permissoes.snapshot.json');
writeFileSync(destinoPermissoes, `${JSON.stringify(snapshotPermissoes, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destinoPermissoes}\n`);

const snapshotMenus = Object.fromEntries(
  Object.entries(MENUS_VISIVEIS_POR_PERFIL)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, menus]) => [perfil, [...new Set(menus)].sort()]),
);
const destinoMenus = join(rbac, 'perfil-menus.snapshot.json');
writeFileSync(destinoMenus, `${JSON.stringify(snapshotMenus, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destinoMenus}\n`);
```

Rodar `cd app/backend && npm run rbac:snapshot` — saída esperada: duas linhas `snapshot gravado: …`, e
`git status` mostra `perfil-menus.snapshot.json` como arquivo novo.

**11.2** Substituir `app/frontend/src/lib/menu-v2.ts` inteiro pelo conteúdo abaixo. Os 9 grupos, 39
rótulos, rotas, ícones e a ordem **não mudam** (Princípio I); some o acoplamento a permissões:

```ts
/**
 * Menu canônico v2 — estrutura de navegação do protótipo (Layout.tsx → ALL_NAV_GROUPS).
 * A visibilidade vem de `perfis.menus_visiveis` (decisão 4 da Onda 3), semeada da matriz de
 * rastreabilidade: o menu mostra exatamente o que a matriz atribui ao perfil, nem mais nem menos.
 * Permissão de API é assunto do backend (RbacGuard) e não filtra menu.
 */

export interface MenuItemDef {
  href: string;
  label: string;
  iconKey: string;
}

export interface MenuGroupDef {
  title: string;
  items: MenuItemDef[];
}

export const MENU_V2: MenuGroupDef[] = [
  {
    title: 'COMERCIAL',
    items: [
      { href: '/comercial/clientes', label: 'Clientes', iconKey: 'Users' },
      { href: '/comercial/pedidos', label: 'Pedidos de Venda', iconKey: 'ClipboardList' },
      { href: '/comercial/tabela-precos', label: 'Tabela de Preços', iconKey: 'Tags' },
      { href: '/comercial/disponibilidade', label: 'Disponibilidade', iconKey: 'BarChart3' },
      { href: '/comercial/espelho', label: 'Espelho Comercial', iconKey: 'FileSpreadsheet' },
    ],
  },
  {
    title: 'GESTÃO',
    items: [
      { href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard' },
      { href: '/gestao/operacoes', label: 'Operações', iconKey: 'CalendarRange' },
      { href: '/gestao/compras', label: 'Compras', iconKey: 'ShoppingCart' },
      { href: '/gestao/overbooking', label: 'Pendências de Overbooking', iconKey: 'AlertTriangle' },
      { href: '/gestao/aprovacoes', label: 'Aprovações & Ocorrências', iconKey: 'CheckCircle' },
      { href: '/gestao/relatorios', label: 'Relatórios & SIF', iconKey: 'PieChart' },
    ],
  },
  {
    title: 'RECEBIMENTO & BALANÇA',
    items: [
      { href: '/recebimento/recebimento-carga', label: 'Recebimento de Carga', iconKey: 'PackageCheck' },
      { href: '/recebimento/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scale' },
      { href: '/recebimento/etiquetas', label: 'Etiquetas', iconKey: 'Tag' },
    ],
  },
  {
    title: 'DESOSSA',
    items: [
      { href: '/desossa/dashboard', label: 'Dashboard da Desossa', iconKey: 'LayoutDashboard' },
      { href: '/desossa/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scissors' },
      { href: '/desossa/etiquetas', label: 'Etiquetas', iconKey: 'Tag' },
    ],
  },
  {
    title: 'ESTOQUE',
    items: [
      { href: '/estoque/consulta', label: 'Consulta de Estoque', iconKey: 'Warehouse' },
      { href: '/estoque/entrada-itens', label: 'Entrada de Itens', iconKey: 'PackagePlus' },
      { href: '/estoque/ajustes', label: 'Ajustes', iconKey: 'SlidersHorizontal' },
    ],
  },
  {
    title: 'CARGA',
    items: [
      { href: '/carga/planejamento', label: 'Planejamento de Carga', iconKey: 'Truck' },
      { href: '/carga/conferencia', label: 'Conferência', iconKey: 'ClipboardCheck' },
      { href: '/carga/enviar-faturamento', label: 'Enviar para Faturamento', iconKey: 'Send' },
    ],
  },
  {
    title: 'FATURAMENTO',
    items: [
      { href: '/faturamento/pre-faturamento', label: 'Pré-Faturamento', iconKey: 'FileText' },
      { href: '/faturamento/notas-xml', label: 'Notas / XML', iconKey: 'FileCode' },
      { href: '/faturamento/seguro-manual', label: 'Seguro Manual', iconKey: 'ShieldCheck' },
      { href: '/faturamento/liberacao', label: 'Liberação do Caminhão', iconKey: 'DoorOpen' },
    ],
  },
  {
    title: 'CADASTROS & REGRAS',
    items: [
      { href: '/cadastros/representantes', label: 'Representantes', iconKey: 'UserCircle' },
      { href: '/cadastros/produtos', label: 'Produtos', iconKey: 'Package' },
      { href: '/cadastros/fornecedores', label: 'Fornecedores / Frigoríficos', iconKey: 'Building2' },
      { href: '/cadastros/caminhoes', label: 'Caminhões', iconKey: 'Truck' },
      { href: '/cadastros/motoristas', label: 'Motoristas', iconKey: 'Contact' },
      { href: '/cadastros/rotas', label: 'Rotas / Itinerários', iconKey: 'Map' },
      { href: '/cadastros/regras-transformacao', label: 'Regras de Transformação', iconKey: 'GitBranch' },
      { href: '/cadastros/modelos-etiqueta', label: 'Modelos de Etiqueta', iconKey: 'Sticker' },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    items: [
      { href: '/admin/usuarios', label: 'Usuários', iconKey: 'Users' },
      { href: '/admin/perfis', label: 'Perfis de Acesso', iconKey: 'Shield' },
      { href: '/admin/parametros', label: 'Parâmetros', iconKey: 'Settings' },
      { href: '/admin/auditoria', label: 'Auditoria', iconKey: 'ScrollText' },
    ],
  },
];

export const ROTAS_CANONICAS: string[] = MENU_V2.flatMap((grupo) =>
  grupo.items.map((item) => item.href),
);

export interface MenuGrupoVisivel {
  title: string;
  items: MenuItemDef[];
}

/**
 * Grupos e itens visíveis para a lista de menus do usuário (união dos perfis, vinda de /auth/me).
 * Grupo sem item visível não aparece; href fora do catálogo é ignorado (não inventa entrada de menu).
 */
export function filtrarMenuPorMenusVisiveis(menusVisiveis: string[]): MenuGrupoVisivel[] {
  const visiveis = new Set(menusVisiveis);
  return MENU_V2.map((grupo) => ({
    title: grupo.title,
    items: grupo.items.filter((item) => visiveis.has(item.href)),
  })).filter((grupo) => grupo.items.length > 0);
}

/**
 * Rota de entrada por perfil — função primária de cada perfil no doc 013 e na matriz (decisão 8).
 * Perfil fora desta tabela (perfil criado pelo administrador) cai no primeiro menu visível.
 */
export const ROTA_ENTRADA_POR_PERFIL: Record<string, string> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  diretoria: '/gestao/dashboard',
  compras: '/gestao/compras',
  comercial: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  conferente: '/carga/conferencia',
  faturamento: '/faturamento/pre-faturamento',
  logistica: '/faturamento/liberacao',
};

/**
 * Destino após o login: a rota primária do perfil quando ela está visível para o usuário;
 * senão o primeiro menu visível na ordem canônica; senão `null` (nenhum módulo liberado).
 * Nunca devolve rota fora do menu do próprio usuário (RA-05).
 */
export function rotaDeEntrada(menusVisiveis: string[], perfis: string[]): string | null {
  const visiveis = new Set(menusVisiveis);

  for (const perfil of perfis) {
    const rota = ROTA_ENTRADA_POR_PERFIL[perfil];
    if (rota && visiveis.has(rota)) return rota;
  }

  return ROTAS_CANONICAS.find((href) => visiveis.has(href)) ?? null;
}
```

**11.3** Em `app/frontend/src/lib/auth.ts`, acrescentar o campo ao contrato:

```ts
export interface UserPayload {
  sub: string;
  nome: string;
  perfis: string[];
  permissoes: string[];
  menusVisiveis: string[];
}
```

**11.4** Em `app/frontend/src/app/(admin)/layout.tsx`, trocar a linha 3 e a linha 12:

```ts
import { filtrarMenuPorMenusVisiveis } from '@/lib/menu-v2';
```

```ts
  const sections = filtrarMenuPorMenusVisiveis(user.menusVisiveis);
```

**11.5** Em `app/frontend/src/app/(admin)/page.tsx`, trocar a linha 9:

```ts
  const rota = rotaDeEntrada(user.menusVisiveis, user.perfis);
```

**11.6** Em `app/frontend/__tests__/menu-v2.test.ts`, substituir o teste
`'todo grupo declara ao menos uma permissao de grupo e todo item ao menos uma permissao'` por:

```ts
  it('MENU_V2 nao tem rota duplicada e todo item declara icone', () => {
    const hrefs = MENU_V2.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const grupo of MENU_V2) {
      for (const item of grupo.items) {
        expect(item.iconKey.length).toBeGreaterThan(0);
      }
    }
  });
```

**11.7** Substituir `app/frontend/__tests__/menu-rbac.test.ts` inteiro. O arquivo passa a provar a
reconciliacao (DoD-01 a DoD-11):

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MENU_V2,
  ROTAS_CANONICAS,
  ROTA_ENTRADA_POR_PERFIL,
  filtrarMenuPorMenusVisiveis,
  rotaDeEntrada,
} from '../src/lib/menu-v2';

const RBAC = join(__dirname, '..', '..', 'backend', 'src', 'common', 'rbac');
const MENUS_POR_PERFIL = JSON.parse(
  readFileSync(join(RBAC, 'perfil-menus.snapshot.json'), 'utf8'),
) as Record<string, string[]>;
const PERMISSOES_POR_PERFIL = JSON.parse(
  readFileSync(join(RBAC, 'perfil-permissoes.snapshot.json'), 'utf8'),
) as Record<string, string[]>;

/**
 * Coluna "Perfis RBAC" da matriz de rastreabilidade v1.1 (linhas 3–41), transcrita rota a rota.
 * É a fonte contra a qual `menus_visiveis` é conferido: são as mesmas 126 atribuições.
 */
const MATRIZ_RASTREABILIDADE: Record<string, string[]> = {
  '/comercial/clientes': ['comercial', 'gestor', 'administrador', 'faturamento'],
  '/comercial/pedidos': ['comercial', 'gestor', 'administrador', 'faturamento', 'expedicao'],
  '/comercial/tabela-precos': ['gestor', 'administrador', 'comercial'],
  '/comercial/disponibilidade': ['comercial', 'gestor', 'diretoria', 'administrador'],
  '/comercial/espelho': ['comercial', 'gestor', 'expedicao', 'administrador'],
  '/gestao/dashboard': ['gestor', 'diretoria', 'administrador'],
  '/gestao/operacoes': ['gestor', 'compras', 'administrador'],
  '/gestao/compras': ['compras', 'gestor', 'administrador', 'comercial'],
  '/gestao/overbooking': ['gestor', 'administrador', 'comercial', 'compras'],
  '/gestao/aprovacoes': ['gestor', 'administrador', 'recebimento_pesagem', 'diretoria'],
  '/gestao/relatorios': ['gestor', 'faturamento', 'administrador', 'diretoria'],
  '/recebimento/recebimento-carga': ['recebimento_pesagem', 'gestor', 'administrador', 'compras', 'faturamento'],
  '/recebimento/pesagem-destinacao': ['recebimento_pesagem', 'gestor', 'administrador'],
  '/recebimento/etiquetas': ['recebimento_pesagem', 'gestor', 'administrador'],
  '/desossa/dashboard': ['corte', 'gestor', 'administrador', 'comercial'],
  '/desossa/pesagem-destinacao': ['corte', 'gestor', 'administrador'],
  '/desossa/etiquetas': ['corte', 'gestor', 'administrador'],
  '/estoque/consulta': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/estoque/entrada-itens': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/estoque/ajustes': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/carga/planejamento': ['expedicao', 'gestor', 'administrador'],
  '/carga/conferencia': ['conferente', 'expedicao', 'gestor', 'administrador'],
  '/carga/enviar-faturamento': ['expedicao', 'gestor', 'administrador'],
  '/faturamento/pre-faturamento': ['faturamento', 'gestor', 'administrador'],
  '/faturamento/notas-xml': ['faturamento', 'gestor', 'administrador', 'logistica', 'diretoria'],
  '/faturamento/seguro-manual': ['faturamento', 'logistica', 'gestor', 'administrador'],
  '/faturamento/liberacao': ['logistica', 'faturamento', 'gestor', 'administrador'],
  '/cadastros/representantes': ['administrador', 'gestor'],
  '/cadastros/produtos': ['administrador', 'gestor'],
  '/cadastros/fornecedores': ['administrador', 'gestor', 'compras'],
  '/cadastros/caminhoes': ['administrador', 'gestor', 'expedicao'],
  '/cadastros/motoristas': ['administrador', 'gestor', 'expedicao'],
  '/cadastros/rotas': ['administrador', 'gestor'],
  '/cadastros/regras-transformacao': ['administrador', 'gestor'],
  '/cadastros/modelos-etiqueta': ['administrador', 'gestor'],
  '/admin/usuarios': ['administrador'],
  '/admin/perfis': ['administrador'],
  '/admin/parametros': ['administrador'],
  '/admin/auditoria': ['administrador', 'diretoria', 'gestor'],
};

/** Decisão 25 da Onda 2 — as 26 rotas que o gate de grupo retirava do menu. Devem estar visíveis. */
const PERDAS_HERDADAS: Record<string, string[]> = {
  compras: ['/recebimento/recebimento-carga'],
  comercial: ['/gestao/compras', '/gestao/overbooking', '/desossa/dashboard'],
  recebimento_pesagem: ['/gestao/aprovacoes', '/estoque/consulta', '/estoque/entrada-itens', '/estoque/ajustes'],
  expedicao: [
    '/comercial/pedidos', '/comercial/espelho', '/estoque/consulta', '/estoque/entrada-itens',
    '/estoque/ajustes', '/cadastros/caminhoes', '/cadastros/motoristas',
  ],
  conferente: ['/carga/conferencia'],
  faturamento: ['/comercial/clientes', '/comercial/pedidos', '/recebimento/recebimento-carga'],
  logistica: ['/faturamento/notas-xml', '/faturamento/seguro-manual', '/faturamento/liberacao'],
  diretoria: ['/gestao/dashboard', '/gestao/aprovacoes', '/gestao/relatorios', '/faturamento/notas-xml'],
};

/** Decisão 31 da Onda 2 — os 14 itens visíveis sem atribuição na matriz. Devem sumir. */
const EXTRAS_HERDADOS: Record<string, string[]> = {
  compras: [
    '/comercial/clientes', '/comercial/pedidos', '/comercial/disponibilidade', '/comercial/espelho',
    '/gestao/dashboard', '/gestao/aprovacoes', '/gestao/relatorios', '/cadastros/representantes',
    '/cadastros/produtos', '/cadastros/rotas', '/cadastros/regras-transformacao',
  ],
  diretoria: ['/comercial/clientes', '/comercial/pedidos', '/comercial/espelho'],
};

/** Grupos visíveis por perfil — consequência direta de `menus_visiveis` (decisão 9). */
const TODOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
  'CARGA', 'FATURAMENTO', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];
const GRUPOS_ESPERADOS: Record<string, string[]> = {
  administrador: TODOS,
  gestor: TODOS,
  compras: ['GESTÃO', 'RECEBIMENTO & BALANÇA', 'CADASTROS & REGRAS'],
  comercial: ['COMERCIAL', 'GESTÃO', 'DESOSSA'],
  recebimento_pesagem: ['GESTÃO', 'RECEBIMENTO & BALANÇA', 'ESTOQUE'],
  corte: ['DESOSSA'],
  expedicao: ['COMERCIAL', 'ESTOQUE', 'CARGA', 'CADASTROS & REGRAS'],
  conferente: ['CARGA'],
  faturamento: ['COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'FATURAMENTO'],
  logistica: ['FATURAMENTO'],
  diretoria: ['COMERCIAL', 'GESTÃO', 'FATURAMENTO', 'ADMINISTRAÇÃO'],
};

const ROTAS_ENTRADA_ESPERADAS: Record<string, string> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  diretoria: '/gestao/dashboard',
  compras: '/gestao/compras',
  comercial: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  conferente: '/carga/conferencia',
  faturamento: '/faturamento/pre-faturamento',
  logistica: '/faturamento/liberacao',
};

const PERFIS = Object.keys(MENUS_POR_PERFIL).sort();

/** Acessos explícitos: sob `noUncheckedIndexedAccess`, indexar Record devolve `| undefined`. */
function menusDe(perfil: string): string[] {
  const menus = MENUS_POR_PERFIL[perfil];
  if (!menus) throw new Error(`perfil ausente no snapshot de menus: ${perfil}`);
  return menus;
}

function esperadoDe(tabela: Record<string, string[]>, perfil: string): string[] {
  const lista = tabela[perfil];
  if (!lista) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return [...lista].sort();
}

/** Matriz invertida: rota→perfis vira perfil→rotas. */
function menusDaMatriz(perfil: string): string[] {
  return Object.entries(MATRIZ_RASTREABILIDADE)
    .filter(([, perfis]) => perfis.includes(perfil))
    .map(([href]) => href)
    .sort();
}

function rotasVisiveis(perfil: string): string[] {
  return filtrarMenuPorMenusVisiveis(menusDe(perfil)).flatMap((grupo) =>
    grupo.items.map((item) => item.href),
  );
}

describe('menu por menus_visiveis — reconciliação com a matriz', () => {
  it('o snapshot de menus cobre os 11 perfis canonicos do snapshot de permissoes', () => {
    expect(PERFIS).toEqual(Object.keys(PERMISSOES_POR_PERFIL).sort());
    expect(PERFIS).toHaveLength(11);
  });

  it('a matriz transcrita cobre exatamente as 39 rotas do menu', () => {
    expect(Object.keys(MATRIZ_RASTREABILIDADE).sort()).toEqual([...ROTAS_CANONICAS].sort());
    expect(ROTAS_CANONICAS).toHaveLength(39);
  });

  it.each(PERFIS)('menus_visiveis do perfil sao exatamente os da matriz: %s', (perfil) => {
    expect([...menusDe(perfil)].sort()).toEqual(menusDaMatriz(perfil));
  });

  it('a matriz soma 126 atribuicoes perfil x rota', () => {
    const total = PERFIS.reduce((soma, perfil) => soma + menusDe(perfil).length, 0);
    expect(total).toBe(126);
    expect(Object.values(MATRIZ_RASTREABILIDADE).reduce((s, p) => s + p.length, 0)).toBe(126);
  });

  it('zero perdas: nenhuma rota da matriz fica fora do menu do perfil', () => {
    const perdas = PERFIS.flatMap((perfil) => {
      const visiveis = new Set(rotasVisiveis(perfil));
      return menusDaMatriz(perfil).filter((href) => !visiveis.has(href)).map((href) => `${perfil}:${href}`);
    });
    expect(perdas).toEqual([]);
  });

  it('zero extras: nenhum item visivel sem atribuicao na matriz', () => {
    const extras = PERFIS.flatMap((perfil) =>
      rotasVisiveis(perfil)
        .filter((href) => !(MATRIZ_RASTREABILIDADE[href] ?? []).includes(perfil))
        .map((href) => `${perfil}:${href}`),
    );
    expect(extras).toEqual([]);
  });

  it('as 26 perdas herdadas da Onda 2 estao visiveis', () => {
    const total = Object.values(PERDAS_HERDADAS).reduce((s, l) => s + l.length, 0);
    expect(total).toBe(26);
    for (const perfil of Object.keys(PERDAS_HERDADAS)) {
      const visiveis = rotasVisiveis(perfil);
      for (const href of esperadoDe(PERDAS_HERDADAS, perfil)) {
        expect(visiveis).toContain(href);
      }
    }
  });

  it('os 14 extras herdados da Onda 2 sumiram do menu', () => {
    const total = Object.values(EXTRAS_HERDADOS).reduce((s, l) => s + l.length, 0);
    expect(total).toBe(14);
    for (const perfil of Object.keys(EXTRAS_HERDADOS)) {
      const visiveis = rotasVisiveis(perfil);
      for (const href of esperadoDe(EXTRAS_HERDADOS, perfil)) {
        expect(visiveis).not.toContain(href);
      }
    }
  });

  it.each(PERFIS)('grupos visiveis batem com a tabela fixada: %s', (perfil) => {
    const grupos = filtrarMenuPorMenusVisiveis(menusDe(perfil)).map((g) => g.title);
    expect(grupos).toEqual(esperadoDe(GRUPOS_ESPERADOS, perfil));
  });

  it.each(PERFIS)('rota de entrada bate com a funcao primaria do perfil: %s', (perfil) => {
    const esperada = ROTAS_ENTRADA_ESPERADAS[perfil];
    if (!esperada) throw new Error(`perfil fora da tabela de rota de entrada: ${perfil}`);
    expect(rotaDeEntrada(menusDe(perfil), [perfil])).toBe(esperada);
    expect(rotasVisiveis(perfil)).toContain(esperada);
    expect(ROTA_ENTRADA_POR_PERFIL[perfil]).toBe(esperada);
  });

  it('usuario sem menu nao tem grupo nem rota de entrada', () => {
    expect(filtrarMenuPorMenusVisiveis([])).toEqual([]);
    expect(rotaDeEntrada([], ['administrador'])).toBeNull();
  });

  it('perfil sem rota primaria cai no primeiro menu visivel da ordem canonica', () => {
    expect(rotaDeEntrada(['/cadastros/produtos', '/comercial/clientes'], ['perfil_customizado']))
      .toBe('/comercial/clientes');
  });

  it('rota primaria nao visivel nao e usada', () => {
    expect(rotaDeEntrada(['/carga/conferencia'], ['gestor'])).toBe('/carga/conferencia');
  });

  it('href fora do catalogo nao vira item de menu', () => {
    expect(filtrarMenuPorMenusVisiveis(['/rota/inexistente'])).toEqual([]);
    expect(rotaDeEntrada(['/rota/inexistente'], ['gestor'])).toBeNull();
  });

  it('auditoria visivel para administrador, gestor e diretoria (matriz linha 41)', () => {
    for (const perfil of ['administrador', 'gestor', 'diretoria']) {
      expect(rotasVisiveis(perfil)).toContain('/admin/auditoria');
    }
    for (const perfil of ['compras', 'comercial', 'recebimento_pesagem', 'corte', 'expedicao', 'faturamento', 'conferente', 'logistica']) {
      expect(rotasVisiveis(perfil)).not.toContain('/admin/auditoria');
    }
  });

  it('gestor ve ADMINISTRAÇÃO apenas com Auditoria', () => {
    const admin = filtrarMenuPorMenusVisiveis(menusDe('gestor')).find((g) => g.title === 'ADMINISTRAÇÃO');
    expect(admin?.items.map((i) => i.href)).toEqual(['/admin/auditoria']);
  });

  it('todo grupo do MENU_V2 aparece para ao menos um perfil', () => {
    const titulos = new Set(PERFIS.flatMap((p) => filtrarMenuPorMenusVisiveis(menusDe(p)).map((g) => g.title)));
    expect([...titulos].sort()).toEqual(MENU_V2.map((g) => g.title).sort());
  });
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/menu-rbac.test.ts __tests__/menu-v2.test.ts
```

Saída esperada: `Tests: 51 passed, 51 total` — 47 em `menu-rbac.test.ts` (14 casos simples + três
blocos `it.each` sobre os 11 perfis) e 4 em `menu-v2.test.ts`. Devem constar as linhas
`✓ zero perdas: nenhuma rota da matriz fica fora do menu do perfil` e
`✓ zero extras: nenhum item visivel sem atribuicao na matriz`.

---

### Task 12 — Componente compartilhado `CadastroTabelaDrawer`

As telas de Representantes, Caminhões e Motoristas do protótipo têm o mesmo layout: cabeçalho com título,
subtítulo e botão primário; barra de busca com `Search` à esquerda e botão "Filtros"; tabela com cabeçalho
`bg-[#F8FAFC]`, linhas `hover:bg-[#F8FAFC]` e ações `Pencil`/`Trash2` à direita; rodapé "Mostrando N de M";
e drawer lateral `w-[520px]` deslizando da direita (decisão 35).

**12.1** Criar `app/frontend/src/components/cadastros/cadastro-tabela-drawer.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { mensagemDeErro } from '@/lib/error-message';

export interface ColunaCadastro<T> {
  chave: string;
  titulo: string;
  alinhamento?: 'esquerda' | 'direita';
  render: (registro: T) => React.ReactNode;
}

export interface CampoCadastro {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'numero' | 'data' | 'textarea' | 'select' | 'switch';
  obrigatorio?: boolean;
  placeholder?: string;
  colSpan?: 1 | 2;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  ajuda?: string;
}

export interface CadastroTabelaDrawerProps<T extends { id: string }> {
  titulo: string;
  subtitulo: string;
  rotuloNovo: string;
  tituloDrawerNovo: string;
  tituloDrawerEdicao: string;
  placeholderBusca: string;
  substantivoPlural: string;
  endpoint: string;
  colunas: ColunaCadastro<T>[];
  campos: CampoCadastro[];
  podeGerenciar: boolean;
  paraFormulario: (registro: T) => Record<string, string | boolean>;
  formularioVazio: Record<string, string | boolean>;
  paraPayload: (form: Record<string, string | boolean>) => Record<string, unknown>;
  mensagemVazia: string;
  cabecalhoExtra?: React.ReactNode;
}

interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function CadastroTabelaDrawer<T extends { id: string }>({
  titulo,
  subtitulo,
  rotuloNovo,
  tituloDrawerNovo,
  tituloDrawerEdicao,
  placeholderBusca,
  substantivoPlural,
  endpoint,
  colunas,
  campos,
  podeGerenciar,
  paraFormulario,
  formularioVazio,
  paraPayload,
  mensagemVazia,
  cabecalhoExtra,
}: CadastroTabelaDrawerProps<T>) {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Paginado<T> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editando, setEditando] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>(formularioVazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: String(pagina), pageSize: '20' });
      if (buscaAplicada) params.set('search', buscaAplicada);
      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      setResultado((await res.json()) as Paginado<T>);
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [endpoint, pagina, buscaAplicada]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...formularioVazio });
    setDrawerAberto(true);
  };

  const abrirEdicao = (registro: T) => {
    setEditando(registro);
    setForm(paraFormulario(registro));
    setDrawerAberto(true);
  };

  const fechar = () => {
    setDrawerAberto(false);
    setEditando(null);
  };

  const faltando = useMemo(
    () => campos.filter((c) => c.obrigatorio && String(form[c.nome] ?? '').trim() === ''),
    [campos, form],
  );

  const salvar = async () => {
    if (faltando.length > 0) {
      toast.error(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}`);
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(editando ? `${endpoint}/${editando.id}` : endpoint, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paraPayload(form)),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success(editando ? 'Registro atualizado.' : 'Registro criado.');
      fechar();
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (registro: T) => {
    if (!window.confirm('Confirma a exclusão deste registro?')) return;
    try {
      const res = await fetch(`${endpoint}/${registro.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Registro removido.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    }
  };

  const total = resultado?.total ?? 0;
  const linhas = resultado?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        {podeGerenciar && (
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 size-4" />
            {rotuloNovo}
          </Button>
        )}
      </div>

      {cabecalhoExtra}

      <Card className="overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={placeholderBusca}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => void carregar()}>
            <SlidersHorizontal className="mr-2 size-4" />
            Filtros
          </Button>
        </div>

        {erro && (
          <p role="alert" className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {erro}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                {colunas.map((coluna) => (
                  <th
                    key={coluna.chave}
                    className={`px-4 py-3 ${coluna.alinhamento === 'direita' ? 'text-right' : ''}`}
                  >
                    {coluna.titulo}
                  </th>
                ))}
                {podeGerenciar && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {carregando && (
                <tr>
                  <td colSpan={colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!carregando && linhas.length === 0 && (
                <tr>
                  <td colSpan={colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    {mensagemVazia}
                  </td>
                </tr>
              )}
              {!carregando &&
                linhas.map((registro) => (
                  <tr key={registro.id} className="hover:bg-[#F8FAFC]">
                    {colunas.map((coluna) => (
                      <td
                        key={coluna.chave}
                        className={`px-4 py-3 ${coluna.alinhamento === 'direita' ? 'text-right' : ''}`}
                      >
                        {coluna.render(registro)}
                      </td>
                    ))}
                    {podeGerenciar && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(registro)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover"
                          onClick={() => void remover(registro)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            Mostrando {linhas.length} de {total} {substantivoPlural}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina * 20 >= total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      {drawerAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
          <div className="flex h-full w-[520px] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-bold">{editando ? tituloDrawerEdicao : tituloDrawerNovo}</h2>
              <Button variant="ghost" size="icon" aria-label="Fechar" onClick={fechar}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-4">
                {campos.map((campo) => (
                  <div
                    key={campo.nome}
                    className={`space-y-1.5 ${campo.colSpan === 2 ? 'col-span-2' : ''}`}
                  >
                    <Label htmlFor={campo.nome}>
                      {campo.rotulo}
                      {campo.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                    </Label>

                    {campo.tipo === 'textarea' && (
                      <Textarea
                        id={campo.nome}
                        rows={3}
                        value={String(form[campo.nome] ?? '')}
                        placeholder={campo.placeholder}
                        onChange={(e) => setForm((f) => ({ ...f, [campo.nome]: e.target.value }))}
                      />
                    )}

                    {campo.tipo === 'select' && (
                      <Select
                        value={String(form[campo.nome] ?? '')}
                        onValueChange={(v) => setForm((f) => ({ ...f, [campo.nome]: v }))}
                      >
                        <SelectTrigger id={campo.nome}>
                          <SelectValue placeholder={campo.placeholder ?? 'Selecione'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(campo.opcoes ?? []).map((opcao) => (
                            <SelectItem key={opcao.valor} value={opcao.valor}>
                              {opcao.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {campo.tipo === 'switch' && (
                      <div className="flex h-9 items-center gap-2">
                        <Switch
                          id={campo.nome}
                          checked={form[campo.nome] === true}
                          onCheckedChange={(v) => setForm((f) => ({ ...f, [campo.nome]: v }))}
                        />
                        <span className="text-sm text-muted-foreground">
                          {form[campo.nome] === true ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    )}

                    {(campo.tipo === 'texto' || campo.tipo === 'numero' || campo.tipo === 'data') && (
                      <Input
                        id={campo.nome}
                        type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
                        value={String(form[campo.nome] ?? '')}
                        placeholder={campo.placeholder}
                        onChange={(e) => setForm((f) => ({ ...f, [campo.nome]: e.target.value }))}
                      />
                    )}

                    {campo.ajuda && <p className="text-xs text-muted-foreground">{campo.ajuda}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-5">
              <Button variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**12.2** Criar `app/frontend/__tests__/cadastro-tabela-drawer.test.tsx` (DoD-36 a DoD-39):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CadastroTabelaDrawer } from '../src/components/cadastros/cadastro-tabela-drawer';

interface Linha { id: string; nome: string }

const props = {
  titulo: 'Representantes',
  subtitulo: 'Gestão da equipe comercial',
  rotuloNovo: 'Novo Representante',
  tituloDrawerNovo: 'Novo Representante',
  tituloDrawerEdicao: 'Editar Representante',
  placeholderBusca: 'Buscar representante...',
  substantivoPlural: 'representantes',
  endpoint: '/api/cadastros/representantes',
  colunas: [{ chave: 'nome', titulo: 'Nome', render: (r: Linha) => r.nome }],
  campos: [{ nome: 'nome', rotulo: 'Nome', tipo: 'texto' as const, obrigatorio: true }],
  paraFormulario: (r: Linha) => ({ nome: r.nome }),
  formularioVazio: { nome: '' },
  paraPayload: (f: Record<string, string | boolean>) => ({ nome: f.nome }),
  mensagemVazia: 'Nenhum representante encontrado para os filtros aplicados.',
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ id: 'r1', nome: 'Carlos Silva' }], total: 1, page: 1, pageSize: 20 }),
  }) as unknown as typeof fetch;
});

it('lista registros do backend e mostra o total real', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  expect(await screen.findByText('Carlos Silva')).toBeInTheDocument();
  expect(screen.getByText('Mostrando 1 de 1 representantes')).toBeInTheDocument();
});

it('sem permissao de gerenciar nao ha botao novo nem acoes de linha', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar={false} />);
  await screen.findByText('Carlos Silva');
  expect(screen.queryByRole('button', { name: 'Novo Representante' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
});

it('drawer abre em modo edicao com os dados da linha', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByText('Editar Representante')).toBeInTheDocument();
  expect(screen.getByLabelText(/Nome/)).toHaveValue('Carlos Silva');
});

it('erro do backend aparece como mensagem, sem lista falsa', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Sem permissão' }),
  }) as unknown as typeof fetch;
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão');
  expect(screen.queryByText('Carlos Silva')).not.toBeInTheDocument();
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/cadastro-tabela-drawer.test.tsx
```

Saída esperada: `Tests: 4 passed, 4 total`.

---

### Task 13 — Tela `/cadastros/representantes`

Protótipo: `Representantes.tsx`. Colunas: Código, Nome, Contato (e-mail + telefone em duas linhas),
Região, Comissão (%), Status, Ações. Drawer com Código, Nome completo, E-mail, Telefone, Região,
Comissão (%), Data de Admissão e Observações.

**13.1** Substituir `app/frontend/src/app/(admin)/cadastros/representantes/page.tsx`:

```tsx
import { getMe } from '@/lib/auth';
import { RepresentantesClient } from './representantes-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('REPRESENTANTES_LER')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar representantes.
      </p>
    );
  }

  return <RepresentantesClient podeGerenciar={user.permissoes.includes('REPRESENTANTES_GERENCIAR')} />;
}
```

**13.2** Criar `app/frontend/src/app/(admin)/cadastros/representantes/representantes-client.tsx`:

```tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import type { Representante } from '@/lib/representantes';

export function RepresentantesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  return (
    <CadastroTabelaDrawer<Representante>
      titulo="Representantes"
      subtitulo="Gestão da equipe comercial e suas regiões de atuação"
      rotuloNovo="Novo Representante"
      tituloDrawerNovo="Novo Representante"
      tituloDrawerEdicao="Editar Representante"
      placeholderBusca="Buscar por nome, código ou região..."
      substantivoPlural="representantes"
      endpoint="/api/cadastros/representantes"
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum representante encontrado para os filtros aplicados."
      colunas={[
        { chave: 'codigo', titulo: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
        { chave: 'nome', titulo: 'Nome', render: (r) => <span className="font-medium">{r.nome}</span> },
        {
          chave: 'contato',
          titulo: 'Contato',
          render: (r) => (
            <div className="text-xs text-muted-foreground">
              <p>{r.email ?? '—'}</p>
              <p>{r.telefone ?? '—'}</p>
            </div>
          ),
        },
        { chave: 'regiao', titulo: 'Região', render: (r) => r.regiao ?? '—' },
        {
          chave: 'comissao',
          titulo: 'Comissão',
          alinhamento: 'direita',
          render: (r) => (r.comissaoPercentual ? `${r.comissaoPercentual}%` : '—'),
        },
        {
          chave: 'status',
          titulo: 'Status',
          render: (r) => (
            <Badge
              variant="outline"
              className={
                r.status === 'ativo'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-muted bg-muted/50 text-muted-foreground'
              }
            >
              {r.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
          ),
        },
      ]}
      campos={[
        { nome: 'codigo', rotulo: 'Código', tipo: 'texto', obrigatorio: true, placeholder: 'REP-001' },
        { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, colSpan: 2 },
        { nome: 'email', rotulo: 'E-mail', tipo: 'texto', placeholder: 'nome@alphacarnes.com.br' },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', placeholder: '(11) 90000-0000' },
        { nome: 'regiao', rotulo: 'Região', tipo: 'texto' },
        { nome: 'comissaoPercentual', rotulo: 'Comissão (%)', tipo: 'numero' },
        { nome: 'dataAdmissao', rotulo: 'Data de admissão', tipo: 'data' },
        {
          nome: 'status',
          rotulo: 'Status',
          tipo: 'select',
          opcoes: [
            { valor: 'ativo', rotulo: 'Ativo' },
            { valor: 'inativo', rotulo: 'Inativo' },
          ],
        },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', colSpan: 2 },
      ]}
      formularioVazio={{
        codigo: '', nome: '', email: '', telefone: '', regiao: '',
        comissaoPercentual: '', dataAdmissao: '', status: 'ativo', observacoes: '',
      }}
      paraFormulario={(r) => ({
        codigo: r.codigo,
        nome: r.nome,
        email: r.email ?? '',
        telefone: r.telefone ?? '',
        regiao: r.regiao ?? '',
        comissaoPercentual: r.comissaoPercentual ?? '',
        dataAdmissao: r.dataAdmissao ?? '',
        status: r.status,
        observacoes: r.observacoes ?? '',
      })}
      paraPayload={(f) => ({
        codigo: String(f.codigo).trim(),
        nome: String(f.nome).trim(),
        email: String(f.email).trim() || undefined,
        telefone: String(f.telefone).trim() || undefined,
        regiao: String(f.regiao).trim() || undefined,
        comissaoPercentual: String(f.comissaoPercentual).trim() || undefined,
        dataAdmissao: String(f.dataAdmissao).trim() || undefined,
        status: String(f.status),
        observacoes: String(f.observacoes).trim() || undefined,
      })}
    />
  );
}
```

**13.3** Em `app/frontend/src/lib/representantes.ts`, garantir que a interface `Representante` tem
`dataAdmissao?: string | null` e `observacoes?: string | null` — se faltar, acrescentar os dois campos
(o backend já os devolve).

**Verificação:**

```bash
cd app/frontend && npx tsc --noEmit
```

Saída esperada: sem erros.

---

### Task 14 — Tela `/cadastros/caminhoes`

Protótipo: `Caminhoes.tsx` (247 linhas). A entidade tem **exatamente** cinco campos além do id —
`placa`, `descricao`, `capacidadeKg`, `rotaPadrao` e `status` (`Ativo`/`Inativo`, linhas 9–16) — e a
tabela tem **6 colunas**: `Placa`, `Descrição`, `Capacidade (kg)`, `Rota padrão`, `Status`, `Ações`
(linha 198). Nenhum outro campo existe no protótipo, no schema da Task 1.4 ou no DTO da Task 4.1;
nenhum é criado aqui (Princípio I e RA-06).

**14.1** `app/frontend/src/app/(admin)/cadastros/caminhoes/page.tsx` segue o mesmo molde da Task 13.1,
com `FROTA_CAMINHOES_LER` / `FROTA_CAMINHOES_GERENCIAR` e a mensagem
"Você não tem permissão para visualizar caminhões.", renderizando `<CaminhoesClient ... />`.

**14.2** Criar `app/frontend/src/app/(admin)/cadastros/caminhoes/caminhoes-client.tsx`. A lista de rotas
alimenta o `select` "Rota padrão" e vem da rota BFF de cadastros já existente:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao } from '@/lib/frota';

interface RotaOpcao {
  id: string;
  nome: string;
}

export function CaminhoesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [rotas, setRotas] = useState<RotaOpcao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/rotas?page=1&pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: RotaOpcao[] };
      setRotas(dados.data);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Caminhao>
      titulo="Caminhões"
      subtitulo="Frota utilizada nas cargas e rotas de expedição."
      rotuloNovo="Novo Caminhão"
      tituloDrawerNovo="Novo Caminhão"
      tituloDrawerEdicao="Editar Caminhão"
      placeholderBusca="Buscar por placa ou descrição"
      substantivoPlural="caminhões"
      endpoint="/api/cadastros/frota-caminhoes"
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum caminhão encontrado para os filtros aplicados."
      colunas={[
        {
          chave: 'placa',
          titulo: 'Placa',
          render: (c) => (
            <span className="flex w-fit items-center gap-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
              <Truck className="size-3" /> {c.placa}
            </span>
          ),
        },
        { chave: 'descricao', titulo: 'Descrição', render: (c) => c.descricao ?? '—' },
        {
          chave: 'capacidadeKg',
          titulo: 'Capacidade (kg)',
          alinhamento: 'direita',
          render: (c) => `${c.capacidadeKg.toLocaleString('pt-BR')} kg`,
        },
        { chave: 'rotaPadrao', titulo: 'Rota padrão', render: (c) => c.rotaPadraoNome ?? '—' },
        {
          chave: 'status',
          titulo: 'Status',
          render: (c) => (
            <Badge
              variant="outline"
              className={
                c.status === 'ativo'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-muted bg-muted/50 text-muted-foreground'
              }
            >
              {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
          ),
        },
      ]}
      campos={[
        { nome: 'placa', rotulo: 'Placa', tipo: 'texto', obrigatorio: true, placeholder: 'ABC-1D23' },
        {
          nome: 'descricao',
          rotulo: 'Descrição',
          tipo: 'texto',
          colSpan: 2,
          placeholder: 'Ex: Baú refrigerado — Mercedes 710',
        },
        { nome: 'capacidadeKg', rotulo: 'Capacidade (kg)', tipo: 'numero' },
        {
          nome: 'rotaPadraoId',
          rotulo: 'Rota padrão',
          tipo: 'select',
          opcoes: [
            { valor: '', rotulo: 'Sem rota padrão' },
            ...rotas.map((r) => ({ valor: r.id, rotulo: r.nome })),
          ],
        },
        {
          nome: 'status',
          rotulo: 'Status',
          tipo: 'select',
          opcoes: [
            { valor: 'ativo', rotulo: 'Ativo' },
            { valor: 'inativo', rotulo: 'Inativo' },
          ],
        },
      ]}
      formularioVazio={{ placa: '', descricao: '', capacidadeKg: '0', rotaPadraoId: '', status: 'ativo' }}
      paraFormulario={(c) => ({
        placa: c.placa,
        descricao: c.descricao ?? '',
        capacidadeKg: String(c.capacidadeKg),
        rotaPadraoId: c.rotaPadraoId ?? '',
        status: c.status,
      })}
      paraPayload={(f) => ({
        placa: String(f.placa).trim().toUpperCase(),
        descricao: String(f.descricao).trim() || undefined,
        capacidadeKg: String(f.capacidadeKg).trim() || '0',
        rotaPadraoId: String(f.rotaPadraoId).trim() || null,
        status: String(f.status),
      })}
    />
  );
}
```

**14.3** Criar `app/frontend/src/lib/frota.ts` com os tipos consumidos pelas duas telas — um campo por
coluna real do schema da Task 1.4, mais os dois campos derivados dos `leftJoin` das Tasks 4.3 e 4.4:

```ts
export interface Caminhao {
  id: string;
  placa: string;
  descricao: string | null;
  capacidadeKg: number;
  rotaPadraoId: string | null;
  rotaPadraoNome: string | null;
  status: 'ativo' | 'inativo';
}

export interface Motorista {
  id: string;
  nome: string;
  documento: string;
  telefone: string | null;
  caminhaoPadraoId: string | null;
  caminhaoPadraoPlaca: string | null;
  caminhaoPadraoAtivo: boolean | null;
  status: 'ativo' | 'inativo';
}
```

**Verificação:**

```bash
cd app/frontend && npx tsc --noEmit && npx eslint src/app/\(admin\)/cadastros/caminhoes
```

Saída esperada: sem erros.

---

### Task 15 — Tela `/cadastros/motoristas`

Protótipo: `Motoristas.tsx` (250 linhas). A entidade tem `nome`, `documento`, `telefone`,
`caminhaoPadrao` e `status` (linhas 9–16) e a tabela tem **6 colunas**: `Nome`, `Documento`, `Telefone`,
`Caminhão padrão`, `Status`, `Ações` (linha 199). O documento é **um campo de texto livre único**
(o protótipo semeia `"CNH 123.456.789-01"`); não existem `cpf`, `cnh`, `categoriaCnh`, `validadeCnh`,
`observacoes` nem alerta de vencimento — nenhum deles é criado aqui (Princípio I e RA-06).

**15.1** `page.tsx` no molde da Task 13.1 com `FROTA_MOTORISTAS_LER` / `FROTA_MOTORISTAS_GERENCIAR` e a
mensagem "Você não tem permissão para visualizar motoristas.".

**15.2** Criar `app/frontend/src/app/(admin)/cadastros/motoristas/motoristas-client.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao, Motorista } from '@/lib/frota';

export function MotoristasClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/frota-caminhoes?page=1&pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: Caminhao[] };
      setCaminhoes(dados.data);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Motorista>
      titulo="Motoristas"
      subtitulo="Motoristas vinculados às cargas e caminhões de expedição."
      rotuloNovo="Novo Motorista"
      tituloDrawerNovo="Novo Motorista"
      tituloDrawerEdicao="Editar Motorista"
      placeholderBusca="Buscar por nome ou documento"
      substantivoPlural="motoristas"
      endpoint="/api/cadastros/frota-motoristas"
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum motorista encontrado para os filtros aplicados."
      colunas={[
        {
          chave: 'nome',
          titulo: 'Nome',
          render: (m) => (
            <span className="flex items-center gap-1.5 font-bold">
              <User className="size-3.5 text-muted-foreground" /> {m.nome}
            </span>
          ),
        },
        { chave: 'documento', titulo: 'Documento', render: (m) => <span className="font-mono">{m.documento}</span> },
        { chave: 'telefone', titulo: 'Telefone', render: (m) => m.telefone ?? '—' },
        {
          chave: 'caminhaoPadrao',
          titulo: 'Caminhão padrão',
          render: (m) =>
            m.caminhaoPadraoPlaca ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {m.caminhaoPadraoAtivo === false ? `${m.caminhaoPadraoPlaca} (inativo)` : m.caminhaoPadraoPlaca}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          chave: 'status',
          titulo: 'Status',
          render: (m) => (
            <Badge
              variant="outline"
              className={
                m.status === 'ativo'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-muted bg-muted/50 text-muted-foreground'
              }
            >
              {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
          ),
        },
      ]}
      campos={[
        { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, colSpan: 2, placeholder: 'Ex: Carlos Souza' },
        { nome: 'documento', rotulo: 'Documento', tipo: 'texto', obrigatorio: true, placeholder: 'CNH nº' },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', placeholder: '(11) 90000-0000' },
        {
          nome: 'caminhaoPadraoId',
          rotulo: 'Caminhão padrão',
          tipo: 'select',
          opcoes: [
            { valor: '', rotulo: 'Sem caminhão padrão' },
            ...caminhoes.map((c) => ({
              valor: c.id,
              rotulo: c.status === 'ativo' ? c.placa : `${c.placa} (inativo)`,
            })),
          ],
        },
        {
          nome: 'status',
          rotulo: 'Status',
          tipo: 'select',
          opcoes: [
            { valor: 'ativo', rotulo: 'Ativo' },
            { valor: 'inativo', rotulo: 'Inativo' },
          ],
        },
      ]}
      formularioVazio={{ nome: '', documento: '', telefone: '', caminhaoPadraoId: '', status: 'ativo' }}
      paraFormulario={(m) => ({
        nome: m.nome,
        documento: m.documento,
        telefone: m.telefone ?? '',
        caminhaoPadraoId: m.caminhaoPadraoId ?? '',
        status: m.status,
      })}
      paraPayload={(f) => ({
        nome: String(f.nome).trim(),
        documento: String(f.documento).trim(),
        telefone: String(f.telefone).trim() || undefined,
        caminhaoPadraoId: String(f.caminhaoPadraoId).trim() || null,
        status: String(f.status),
      })}
    />
  );
}
```

**Verificação:**

```bash
cd app/frontend && npx tsc --noEmit && npx eslint src/app/\(admin\)/cadastros/motoristas
```

Saída esperada: sem erros.

---

### Task 16 — Tela `/cadastros/fornecedores`

Protótipo: `Fornecedores.tsx` — mestre-detalhe com chips de contagem no topo da lista e abas
"Dados Cadastrais", "Parâmetros Operacionais" e "Histórico" no detalhe. A tela já usa
`CadastroMasterDetail`; esta task acrescenta os chips reais (decisão 19) e o bloco de histórico real
(decisão 18). Os campos novos do cadastro entraram na Task 7.4.

**16.1** Em `app/frontend/src/components/cadastro-master-detail.tsx`, acrescentar duas props opcionais à
interface (linha 19) e ao destructuring (linha 162):

```tsx
interface CadastroMasterDetailProps {
  config: Omit<CadastroConfig, 'schema'>;
  tituloPagina: string;
  subtitulo?: string;
  podeGerenciar: boolean;
  filtrosExtras?: React.ReactNode;
  blocoDetalheExtra?: (registroId: string) => React.ReactNode;
}
```

```tsx
export function CadastroMasterDetail({
  config,
  tituloPagina,
  subtitulo,
  podeGerenciar,
  filtrosExtras,
  blocoDetalheExtra,
}: CadastroMasterDetailProps) {
```

Renderizar `filtrosExtras` logo abaixo do campo de busca da coluna mestre e
`{selecionadoId && blocoDetalheExtra?.(selecionadoId)}` como último bloco do painel de detalhe (depois do
`Tabs`/`renderCampos`). Props ausentes não mudam nada nas outras telas que usam o componente.

**16.2** Substituir `app/frontend/src/app/(admin)/cadastros/fornecedores/fornecedores-client.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Award } from 'lucide-react';
import { CadastroMasterDetail } from '@/components/cadastro-master-detail';
import { Badge } from '@/components/ui/badge';
import { fornecedoresConfig } from '@/lib/cadastros-config';
import { mensagemDeErro } from '@/lib/error-message';

interface Contagens {
  total: number;
  ativos: number;
  inativos: number;
}

interface Historico {
  ocorrenciasAno: number;
  ultimaDivergencia: { data: string; tipo: string } | null;
}

function Chips() {
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/cadastros/fornecedores/contagens', { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setContagens((await res.json()) as Contagens);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, []);

  if (erro) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {erro}
      </p>
    );
  }
  if (!contagens) return <p className="text-xs text-muted-foreground">Carregando contagens…</p>;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">Todos ({contagens.total})</Badge>
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
        Ativos ({contagens.ativos})
      </Badge>
      <Badge variant="outline" className="border-muted bg-muted/50 text-muted-foreground">
        Inativos ({contagens.inativos})
      </Badge>
    </div>
  );
}

function BlocoHistorico({ fornecedorId }: { fornecedorId: string }) {
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setHistorico(null);
    setErro(null);
    void (async () => {
      try {
        const res = await fetch(`/api/cadastros/fornecedores/${fornecedorId}/historico`, { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setHistorico((await res.json()) as Historico);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, [fornecedorId]);

  if (erro) {
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {erro}
      </p>
    );
  }
  if (!historico) return <p className="mt-6 text-sm text-muted-foreground">Carregando histórico…</p>;

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <AlertTriangle className="size-4" />
          Total de Ocorrências (Ano)
        </p>
        <p className="mt-2 text-2xl font-bold">{historico.ocorrenciasAno}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <Award className="size-4" />
          Última Divergência
        </p>
        <p className="mt-2 text-sm font-medium">
          {historico.ultimaDivergencia
            ? `${new Date(historico.ultimaDivergencia.data).toLocaleDateString('pt-BR')} · ${historico.ultimaDivergencia.tipo}`
            : '—'}
        </p>
      </div>
    </section>
  );
}

export function FornecedoresClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const { schema: _s, ...config } = fornecedoresConfig;
  void _s;

  return (
    <CadastroMasterDetail
      config={config}
      tituloPagina="Fornecedores / Frigoríficos"
      subtitulo="Cadastro de fornecedores e parâmetros operacionais"
      podeGerenciar={podeGerenciar}
      filtrosExtras={<Chips />}
      blocoDetalheExtra={(id) => <BlocoHistorico fornecedorId={id} />}
    />
  );
}
```

**16.3** Criar `app/frontend/__tests__/fornecedores-contagens.test.tsx` (DoD-40 e DoD-41):

```tsx
import { render, screen } from '@testing-library/react';
import { FornecedoresClient } from '../src/app/(admin)/cadastros/fornecedores/fornecedores-client';

it('chips mostram a contagem devolvida pelo backend', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/contagens')) {
      return Promise.resolve({ ok: true, json: async () => ({ total: 3, ativos: 2, inativos: 1 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) });
  }) as unknown as typeof fetch;

  render(<FornecedoresClient podeGerenciar />);
  expect(await screen.findByText('Todos (3)')).toBeInTheDocument();
  expect(screen.getByText('Ativos (2)')).toBeInTheDocument();
  expect(screen.getByText('Inativos (1)')).toBeInTheDocument();
});

it('falha nas contagens mostra erro e nao inventa numero', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/contagens')) {
      return Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Falha interna' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) });
  }) as unknown as typeof fetch;

  render(<FornecedoresClient podeGerenciar />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha interna');
  expect(screen.queryByText(/^Todos \(/)).not.toBeInTheDocument();
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/fornecedores-contagens.test.tsx && npx tsc --noEmit
```

Saída esperada: `Tests: 2 passed, 2 total` e nenhum erro de tipo.

---

### Task 17 — Tela `/cadastros/rotas`: paradas e dias de atendimento

Protótipo: `Itinerarios.tsx` — o painel de detalhe tem, abaixo dos campos, a lista "Paradas / Bairros"
com `GripVertical`, botões de subir/descer, `Trash2` por linha e o campo "Adicionar parada"; e a faixa
"Dias de Atendimento" com sete botões alternáveis.

**17.1** Em `app/frontend/src/lib/rotas.ts`, acrescentar:

```ts
export interface ParadaRota {
  ordem: number;
  descricao: string;
}

export const DIAS_SEMANA = [
  { valor: 'seg', rotulo: 'Seg' },
  { valor: 'ter', rotulo: 'Ter' },
  { valor: 'qua', rotulo: 'Qua' },
  { valor: 'qui', rotulo: 'Qui' },
  { valor: 'sex', rotulo: 'Sex' },
  { valor: 'sab', rotulo: 'Sáb' },
  { valor: 'dom', rotulo: 'Dom' },
] as const;
```

e os campos `paradas: ParadaRota[]` e `diasAtendimento: string[]` em `Rota` e em `CriarRotaDto`.

**17.2** Em `rotas-client.tsx`: incluir `paradas: []` e `diasAtendimento: []` em `FORM_VAZIO`, copiá-los em
`rotaParaForm`, enviá-los em `formParaPayload` e acrescentar, depois do bloco de Observações (linha 374),
os dois blocos novos:

```tsx
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Paradas / Bairros</Label>
                    <span className="text-xs text-muted-foreground">{form.paradas.length} paradas</span>
                  </div>

                  {form.paradas.length === 0 && (
                    <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Nenhuma parada cadastrada nesta rota.
                    </p>
                  )}

                  {form.paradas.map((parada, indice) => (
                    <div key={`${parada.ordem}-${parada.descricao}`} className="flex items-center gap-2 rounded-md border p-2">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <span className="w-6 text-center text-xs font-medium text-muted-foreground">{indice + 1}</span>
                      <span className="flex-1 text-sm">{parada.descricao}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Subir parada"
                        disabled={!podeGerenciar || indice === 0}
                        onClick={() => moverParada(indice, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Descer parada"
                        disabled={!podeGerenciar || indice === form.paradas.length - 1}
                        onClick={() => moverParada(indice, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover parada"
                        disabled={!podeGerenciar}
                        onClick={() => removerParada(indice)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {podeGerenciar && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Adicionar parada (bairro, referência)"
                        value={novaParada}
                        onChange={(e) => setNovaParada(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            adicionarParada();
                          }
                        }}
                      />
                      <Button variant="outline" onClick={adicionarParada}>
                        <Plus className="mr-1 size-4" />
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Dias de Atendimento</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => {
                      const marcado = form.diasAtendimento.includes(dia.valor);
                      return (
                        <Button
                          key={dia.valor}
                          type="button"
                          variant={marcado ? 'default' : 'outline'}
                          size="sm"
                          aria-pressed={marcado}
                          disabled={!podeGerenciar}
                          onClick={() => alternarDia(dia.valor)}
                        >
                          {dia.rotulo}
                        </Button>
                      );
                    })}
                  </div>
                </div>
```

com o import
`import { ArrowDown, ArrowUp, GripVertical, Map, MapPin, Plus, Search, Trash2 } from 'lucide-react';`
e os manipuladores acima do `return`:

```tsx
  const [novaParada, setNovaParada] = useState('');

  const renumerar = (lista: ParadaRota[]) =>
    lista.map((parada, indice) => ({ ordem: indice + 1, descricao: parada.descricao }));

  const adicionarParada = () => {
    const descricao = novaParada.trim();
    if (!descricao) return;
    setCampo('paradas', renumerar([...form.paradas, { ordem: form.paradas.length + 1, descricao }]));
    setNovaParada('');
  };

  const removerParada = (indice: number) =>
    setCampo('paradas', renumerar(form.paradas.filter((_, i) => i !== indice)));

  const moverParada = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= form.paradas.length) return;
    const lista = [...form.paradas];
    const atual = lista[indice];
    const outro = lista[destino];
    if (!atual || !outro) return;
    lista[indice] = outro;
    lista[destino] = atual;
    setCampo('paradas', renumerar(lista));
  };

  const alternarDia = (dia: string) =>
    setCampo(
      'diasAtendimento',
      form.diasAtendimento.includes(dia)
        ? form.diasAtendimento.filter((d) => d !== dia)
        : [...form.diasAtendimento, dia],
    );
```

**17.3** Criar `app/frontend/__tests__/rotas-paradas.test.tsx` (DoD-42 e DoD-43):

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { RotasClient } from '../src/app/(admin)/cadastros/rotas/rotas-client';

const ROTA = {
  id: 'r1', codigo: 'L1', nome: 'Rota L1', regiao: 'Centro', status: 'ativo',
  representantePadrao: null, caminhaoPadrao: null, motoristaPadrao: null, observacoes: null,
  paradas: [
    { ordem: 1, descricao: 'Centro' },
    { ordem: 2, descricao: 'Bela Vista' },
  ],
  diasAtendimento: ['seg'],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [ROTA], total: 1, page: 1, pageSize: 100 }),
  }) as unknown as typeof fetch;
});

it('reordena parada para cima preservando descricoes', async () => {
  render(<RotasClient permissoes={['ROTAS_LER', 'ROTAS_GERENCIAR']} />);
  fireEvent.click(await screen.findByText('Rota L1'));

  fireEvent.click(screen.getAllByRole('button', { name: 'Subir parada' })[1]!);

  expect(screen.getAllByText(/Centro|Bela Vista/).map((el) => el.textContent))
    .toEqual(['Bela Vista', 'Centro']);
});

it('alterna dia de atendimento', async () => {
  render(<RotasClient permissoes={['ROTAS_LER', 'ROTAS_GERENCIAR']} />);
  fireEvent.click(await screen.findByText('Rota L1'));

  const terca = screen.getByRole('button', { name: 'Ter' });
  expect(terca).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(terca);
  expect(terca).toHaveAttribute('aria-pressed', 'true');
});
```

> `RotasClient` hoje libera escrita com `EXPEDICAO_GERENCIAR`; trocar por
> `permissoes.includes('ROTAS_GERENCIAR')` (a rota da tela é de cadastro, e a permissão de rotas já
> existe no catálogo).

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/rotas-paradas.test.tsx
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 18 — Tela `/cadastros/modelos-etiqueta`

Protótipo: `ModelosEtiqueta.tsx` — banner âmbar de pendência no topo e três colunas: lista de modelos
(`w-[260px]`, cartões com nome e "N de 12 campos ativos"), campos configuráveis em `grid-cols-2` e
"Preview ao vivo" (`w-[380px]`).

**Divergência autorizada D18.a** — o preview do protótipo renderiza uma etiqueta com valores de exemplo
(`EXEMPLO`, linhas 73–84: "ETQ-88391", "Restaurante Grill / #PV-1029", "Frigorífico Boi Forte"). Esses
valores são dado de demonstração e não vão para a tela (decisão 2 e RA-06). O preview desta onda mantém a
coluna, o título e a moldura da etiqueta e lista **os rótulos dos campos ligados**, atualizando a cada
`Switch`. Registrada no README de evidências (Task 27.1).

**18.1** `page.tsx` no molde da Task 13.1, com `MODELOS_ETIQUETA_LER` / `MODELOS_ETIQUETA_GERENCIAR` e a
mensagem "Você não tem permissão para visualizar modelos de etiqueta.".

**18.2** Criar `app/frontend/src/lib/modelos-etiqueta.ts`:

```ts
/** Rótulos idênticos a ModelosEtiqueta.tsx linhas 18–31 — sem reescrita. */
export const CAMPOS_ETIQUETA = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'produto', rotulo: 'Produto' },
  { chave: 'peso', rotulo: 'Peso' },
  { chave: 'clientePedido', rotulo: 'Cliente/Pedido' },
  { chave: 'destino', rotulo: 'Destino' },
  { chave: 'origemFrigorifico', rotulo: 'Origem/Frigorífico' },
  { chave: 'nfLote', rotulo: 'NF/Lote' },
  { chave: 'dataHora', rotulo: 'Data/hora' },
  { chave: 'operador', rotulo: 'Operador' },
  { chave: 'caracteristicas', rotulo: 'Características' },
  { chave: 'qrCode', rotulo: 'QR Code' },
  { chave: 'codigoBarras', rotulo: 'Código de barras' },
] as const;

export type CampoEtiqueta = (typeof CAMPOS_ETIQUETA)[number]['chave'];

export interface ModeloEtiqueta {
  id: string;
  slug: string;
  nome: string;
  campos: Record<CampoEtiqueta, boolean>;
  status: 'ativo' | 'inativo';
}
```

> A tabela `modelos_etiqueta` (Task 1.5) e os DTOs (Task 5.1) têm `slug`, `nome`, `campos` e `status`.
> `descricao` não existe no protótipo nem no schema e **não** é lido em lugar nenhum da tela.

**18.3** Criar `app/frontend/src/app/(admin)/cadastros/modelos-etiqueta/modelos-etiqueta-client.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sticker } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { mensagemDeErro } from '@/lib/error-message';
import { CAMPOS_ETIQUETA, type CampoEtiqueta, type ModeloEtiqueta } from '@/lib/modelos-etiqueta';

export function ModelosEtiquetaClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [modelos, setModelos] = useState<ModeloEtiqueta[]>([]);
  const [selecionado, setSelecionado] = useState<ModeloEtiqueta | null>(null);
  const [campos, setCampos] = useState<Record<CampoEtiqueta, boolean> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/modelos-etiqueta?page=1&pageSize=50', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: ModeloEtiqueta[] };
      setModelos(dados.data);
      setSelecionado((atual) => dados.data.find((m) => m.id === atual?.id) ?? dados.data[0] ?? null);
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setCampos(selecionado ? { ...selecionado.campos } : null);
  }, [selecionado]);

  const salvar = async () => {
    if (!selecionado || !campos) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/cadastros/modelos-etiqueta/${selecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos }),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Modelo atualizado.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const marcados = campos ? CAMPOS_ETIQUETA.filter((c) => campos[c.chave]) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Modelos de Etiqueta</h1>
        <p className="text-sm text-muted-foreground">
          Configure os campos exibidos em cada modelo de etiqueta usado na operação.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <BadgeProvisorio pendencia="P9" />
        <p className="text-sm text-amber-900">
          Modelo físico/campos finais da etiqueta pendentes de definição.
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="space-y-2 p-4 lg:col-span-3">
          <p className="text-xs font-bold">Modelos</p>
          {modelos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>}
          {modelos.map((modelo) => {
            const ativos = CAMPOS_ETIQUETA.filter((c) => modelo.campos[c.chave]).length;
            return (
              <button
                key={modelo.id}
                type="button"
                onClick={() => setSelecionado(modelo)}
                className={`w-full rounded-md border p-4 text-left transition-colors ${
                  selecionado?.id === modelo.id
                    ? 'border-primary bg-background shadow-sm'
                    : 'border-transparent bg-background hover:border-border'
                }`}
              >
                <p className="text-sm font-bold">{modelo.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {ativos} de {CAMPOS_ETIQUETA.length} campos ativos
                </p>
              </button>
            );
          })}
        </Card>

        <Card className="p-6 lg:col-span-5">
          {!selecionado || !campos ? (
            <p className="text-sm text-muted-foreground">Selecione um modelo.</p>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sticker className="size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-bold">Campos configuráveis — {selecionado.nome}</h2>
                    <p className="text-xs text-muted-foreground">
                      {marcados.length} de {CAMPOS_ETIQUETA.length} campos ativos
                    </p>
                  </div>
                </div>
                {podeGerenciar && (
                  <Button onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? 'Salvando…' : 'Salvar Modelo'}
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {CAMPOS_ETIQUETA.map((campo) => (
                  <div key={campo.chave} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <Label htmlFor={`campo-${campo.chave}`}>{campo.rotulo}</Label>
                    <Switch
                      id={`campo-${campo.chave}`}
                      checked={campos[campo.chave]}
                      disabled={!podeGerenciar}
                      onCheckedChange={(v) => setCampos((c) => (c ? { ...c, [campo.chave]: v } : c))}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-4 lg:col-span-4">
          <p className="mb-3 text-xs font-bold">Preview ao vivo</p>
          <div className="rounded-xl border-2 border-primary bg-muted/30 p-4 font-mono text-xs">
            <p className="mb-3 text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase">
              ALFA CARNES
            </p>
            {marcados.length === 0 ? (
              <p className="text-muted-foreground">Nenhum campo selecionado.</p>
            ) : (
              <ul className="space-y-1">
                {marcados.map((campo) => (
                  <li key={campo.chave}>{campo.rotulo}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
```

**18.4** Criar `app/frontend/__tests__/modelos-etiqueta.test.tsx` (DoD-44 a DoD-47) cobrindo: os 12
`Switch` aparecem com os rótulos de `CAMPOS_ETIQUETA`; o badge `P9` está presente; sem
`MODELOS_ETIQUETA_GERENCIAR` não há botão "Salvar Modelo" e os `Switch` ficam desabilitados; o `PATCH`
envia o objeto `campos` com as 12 chaves.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/modelos-etiqueta.test.tsx
```

Saída esperada: `Tests: 4 passed, 4 total`.

---

### Task 19 — Tela `/cadastros/produtos`: 5 abas do protótipo

Protótipo: `Produtos.tsx` — o drawer tem as abas Gerais, Comercial, Operacional, Estoque e Fiscal.
A tela já existe com os campos em coluna única; esta task reorganiza os campos existentes nas 5 abas e
acrescenta os 4 campos fiscais (decisão 36).

**19.1** Backend — em `app/backend/src/modules/cadastros/produtos/dto/produto.dto.ts`, acrescentar ao
objeto do schema de criação:

```ts
  atributosJson: z
    .object({
      fiscal: z
        .object({
          ncm: z.string().trim().max(10).optional(),
          cfop: z.string().trim().max(6).optional(),
          origemFiscal: z.string().trim().max(60).optional(),
          cestOpcional: z.string().trim().max(10).optional(),
        })
        .optional(),
    })
    .optional(),
```

e garantir que `produtos.service.ts` grava `atributosJson` no `values` de `criar` e no `set` de
`atualizar`, como os demais campos opcionais. Em
`app/backend/test/integration/cadastros-f7.e2e-spec.ts`, acrescentar o teste de DoD-25:

```ts
  it('produto persiste bloco fiscal em atributos_json', async () => {
    const criar = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
      codigo: 'PRD-FISCAL',
      nome: 'Coxão mole',
      tipoOperacional: 'peca_inteira_pesavel',
      unidadePedido: 'Peça',
      unidadePreco: 'kg',
      atributosJson: { fiscal: { ncm: '0201.30.00', cfop: '5102' } },
    });
    expect(criar.status).toBe(201);

    const detalhe = await request(srv()).get(`/produtos/${criar.body.id}`).set('Cookie', adminCookies);
    expect(detalhe.body.atributosJson.fiscal).toEqual({ ncm: '0201.30.00', cfop: '5102' });
  });
```

**19.2** Frontend — em `produtos-client.tsx`:

- acrescentar a `FormProduto`, `FORM_VAZIO`, `produtoParaForm` e `formParaPayload` os campos
  `ncm`, `cfop`, `origemFiscal`, `cestOpcional` (strings; vazio vira `undefined`), montando e lendo
  `atributosJson.fiscal`;
- envolver o conteúdo do formulário no `SheetContent` com `Tabs`, distribuindo os campos **exatamente**
  assim (nenhum campo existente é removido):

| aba | `TabsTrigger` | campos |
|---|---|---|
| `gerais` | Gerais | `codigo`, `categoria`, `nome`, `nomeOperacional`, `status` |
| `comercial` | Comercial | `precoPorKg`, `unidadePreco`, `ativoVenda`, `ativoCompra` |
| `operacional` | Operacional | `tipoOperacional`, `unidadePedido`, `exigePeso`, `passaBalanca`, `passaDesossa`, `origemTransformacao`, `saidaTransformacao`, `observacoesOperacionais` |
| `estoque` | Estoque | `podeEstoque` |
| `fiscal` | Fiscal | `ncm`, `cfop`, `origemFiscal`, `cestOpcional` |

```tsx
              <Tabs defaultValue="gerais" className="gap-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="gerais">Gerais</TabsTrigger>
                  <TabsTrigger value="comercial">Comercial</TabsTrigger>
                  <TabsTrigger value="operacional">Operacional</TabsTrigger>
                  <TabsTrigger value="estoque">Estoque</TabsTrigger>
                  <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                </TabsList>

                <TabsContent value="fiscal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ncm">NCM</Label>
                      <Input
                        id="ncm"
                        value={form.ncm ?? ''}
                        disabled={!podeGerenciar}
                        placeholder="0201.30.00"
                        onChange={(e) => setCampo('ncm', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cfop">CFOP</Label>
                      <Input
                        id="cfop"
                        value={form.cfop ?? ''}
                        disabled={!podeGerenciar}
                        placeholder="5102"
                        onChange={(e) => setCampo('cfop', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="origemFiscal">Origem fiscal</Label>
                      <Input
                        id="origemFiscal"
                        value={form.origemFiscal ?? ''}
                        disabled={!podeGerenciar}
                        onChange={(e) => setCampo('origemFiscal', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cestOpcional">CEST (opcional)</Label>
                      <Input
                        id="cestOpcional"
                        value={form.cestOpcional ?? ''}
                        disabled={!podeGerenciar}
                        onChange={(e) => setCampo('cestOpcional', e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
```

As outras quatro `TabsContent` recebem, sem alterar o markup interno, os blocos de campos já existentes na
ordem da tabela acima.

**19.3** Criar `app/frontend/__tests__/produtos-client.test.tsx` (DoD-48 e DoD-49), com o cabeçalho
padrão dos testes de tela do repositório (`import { render, screen, fireEvent, waitFor } from
'@testing-library/react'` e `import ProdutosClient from
'@/app/(admin)/cadastros/produtos/produtos-client'`):

```tsx
it('drawer de produto tem as 5 abas do prototipo', async () => {
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  for (const aba of ['Gerais', 'Comercial', 'Operacional', 'Estoque', 'Fiscal']) {
    expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
  }
});

it('aba fiscal envia ncm dentro de atributosJson', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  fireEvent.change(screen.getByLabelText('Código interno'), { target: { value: 'PRD-1' } });
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Coxão mole' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Fiscal' }));
  fireEvent.change(screen.getByLabelText('NCM'), { target: { value: '0201.30.00' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

  await waitFor(() => {
    const chamada = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(chamada).toBeDefined();
    const corpo = JSON.parse(String((chamada?.[1] as RequestInit).body)) as {
      atributosJson: { fiscal: { ncm: string } };
    };
    expect(corpo.atributosJson.fiscal.ncm).toBe('0201.30.00');
  });
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/produtos-client.test.tsx
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 20 — Tela `/cadastros/regras-transformacao`: 2 abas e simuladores

Protótipo: `RegraDesdobramento.tsx` — aba 1 "Desdobramento de Compra" (regras + simulador
"Se eu comprar (Boi Casado)") e aba 2 "Transformação na Desossa" (alternativas + simulador de
disponibilidade), com o aviso de exclusividade por unidade de TZ.

**20.1** Em `regras-transformacao-client.tsx`, envolver o conteúdo em `Tabs`:

```tsx
      <Tabs defaultValue="desdobramento" className="gap-4">
        <TabsList>
          <TabsTrigger value="desdobramento">Desdobramento de Compra</TabsTrigger>
          <TabsTrigger value="desossa">Transformação na Desossa</TabsTrigger>
        </TabsList>

        <TabsContent value="desdobramento" className="space-y-6">
          {/* tabela de regras de desdobramento já existente */}
          <SimuladorDesdobramento itemCompraId={itemCompraSelecionadoId} />
        </TabsContent>

        <TabsContent value="desossa" className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <BadgeProvisorio pendencia="P12" />
            <p className="text-sm text-amber-900">
              Cada unidade de TZ atende exatamente uma das alternativas abaixo.
            </p>
          </div>
          {/* lista de alternativas de transformação já existente */}
          <SimuladorDesossa />
        </TabsContent>
      </Tabs>
```

**20.2** Criar `app/frontend/src/app/(admin)/cadastros/regras-transformacao/simulador-desdobramento.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mensagemDeErro } from '@/lib/error-message';

interface Resultado {
  quantidade: number;
  itens: Array<{ itemComercialId: string; descricao: string; fator: string; total: number }>;
  somaFatores: number;
  totalPartes: number;
}

export function SimuladorDesdobramento({ itemCompraId }: { itemCompraId: string | null }) {
  const [quantidade, setQuantidade] = useState('100');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  const simular = async () => {
    if (!itemCompraId) {
      setErro('Selecione um item de compra para simular.');
      setResultado(null);
      return;
    }
    setCalculando(true);
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/regras-desdobramento/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCompraId, quantidade: Number(quantidade) }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        setResultado(null);
        return;
      }
      setResultado((await res.json()) as Resultado);
    } catch {
      setErro('Erro de conexão com o servidor.');
      setResultado(null);
    } finally {
      setCalculando(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-primary" />
        <h3 className="font-bold">Simulador</h3>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qtd-simulacao">Se eu comprar (Boi Casado)</Label>
          <Input
            id="qtd-simulacao"
            type="number"
            min={1}
            className="w-40"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>
        <Button onClick={() => void simular()} disabled={calculando}>
          {calculando ? 'Calculando…' : 'Simular'}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="space-y-2">
          {resultado.itens.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra de desdobramento ativa para este item.</p>
          )}
          {resultado.itens.map((item) => (
            <div key={item.itemComercialId} className="flex justify-between rounded-md border px-4 py-2 text-sm">
              <span>{item.descricao}</span>
              <span className="font-mono">
                {resultado.quantidade} × {item.fator} = <strong>{item.total}</strong>
              </span>
            </div>
          ))}
          <p className="text-sm font-medium">Total de partes geradas: {resultado.totalPartes}</p>
        </div>
      )}
    </Card>
  );
}
```

**20.3** Criar `app/frontend/src/app/(admin)/cadastros/regras-transformacao/simulador-desossa.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mensagemDeErro } from '@/lib/error-message';

interface Resultado {
  tzLivre: number;
  resultados: Array<{ produtoId: string; nome: string; disponivel: number; bloqueado: boolean }>;
  alternativasPossiveis: Array<{ id: string; nome: string }>;
}

export function SimuladorDesossa() {
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string }>>([]);
  const [tzLivre, setTzLivre] = useState('100');
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/produtos?pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const corpo = (await res.json()) as { data: Array<{ id: string; nome: string }> };
      setProdutos(corpo.data);
    })();
  }, []);

  const simular = async () => {
    setCalculando(true);
    setErro(null);
    try {
      const res = await fetch('/api/desossa/regras-transformacao/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tzLivre: Number(tzLivre),
          produtoId: produtoId || undefined,
          quantidade: quantidade ? Number(quantidade) : undefined,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        setResultado(null);
        return;
      }
      setResultado((await res.json()) as Resultado);
    } catch {
      setErro('Erro de conexão com o servidor.');
      setResultado(null);
    } finally {
      setCalculando(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-primary" />
        <h3 className="font-bold">Simulador</h3>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tz-livre">Quantidade de TZ livre</Label>
          <Input
            id="tz-livre"
            type="number"
            min={0}
            className="w-40"
            value={tzLivre}
            onChange={(e) => setTzLivre(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="produto-reserva">Produto a reservar</Label>
          <select
            id="produto-reserva"
            className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qtd-reserva">Quantidade</Label>
          <Input
            id="qtd-reserva"
            type="number"
            min={1}
            className="w-32"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>
        <Button onClick={() => void simular()} disabled={calculando}>
          {calculando ? 'Calculando…' : 'Simular'}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="space-y-2">
          {resultado.resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra de transformação ativa cadastrada.</p>
          ) : (
            resultado.resultados.map((item) => (
              <div key={item.produtoId} className="flex justify-between rounded-md border px-4 py-2 text-sm">
                <span>{item.nome}</span>
                <span className="font-mono">
                  {item.disponivel}
                  {item.bloqueado && (
                    <span className="ml-2 font-sans text-destructive">Bloqueado pela reserva</span>
                  )}
                </span>
              </div>
            ))
          )}
          <div>
            <p className="text-sm font-medium">Alternativas ainda possíveis</p>
            <ul className="text-sm text-muted-foreground">
              {resultado.alternativasPossiveis.map((a) => (
                <li key={a.id}>{a.nome}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
```

**20.4** Criar `app/frontend/__tests__/simuladores-transformacao.test.tsx` (DoD-50 a DoD-52) cobrindo:
(a) o simulador de desdobramento mostra `100 × 2 = 200` por item e o total devolvido pela API;
(b) o simulador de desossa marca "Bloqueado pela reserva" no produto que a API marcou e lista as
alternativas possíveis; (c) erro do backend vira `role="alert"` e nenhum número é exibido.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/simuladores-transformacao.test.tsx
```

Saída esperada: `Tests: 3 passed, 3 total`.

---

### Task 21 — Tela `/admin/usuarios`: resumo de perfis e drawer

Protótipo: `Usuarios.tsx` — cabeçalho com "Novo Usuário", tabela de usuários e, à direita, o cartão
"Resumo de Perfis" com barra por perfil e o botão "Gerenciar Permissões (RBAC)".

**21.1** Criar `app/frontend/src/app/(admin)/admin/usuarios/resumo-perfis.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { mensagemDeErro } from '@/lib/error-message';

interface LinhaResumo {
  slug: string;
  nome: string;
  total: number;
}

const CORES = ['#8B5CF6', '#3B7FD4', '#18A84A'];

export function ResumoPerfis() {
  const [linhas, setLinhas] = useState<LinhaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/usuarios/resumo-perfis', { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setLinhas((await res.json()) as LinhaResumo[]);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, []);

  const maior = linhas?.reduce((max, l) => Math.max(max, l.total), 0) ?? 0;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-primary" />
        <h2 className="font-bold">Resumo de Perfis</h2>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {!erro && !linhas && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {linhas?.map((linha, indice) => (
        <div key={linha.slug} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{linha.nome}</span>
            <span className="text-muted-foreground">
              {linha.total} {linha.total === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full"
              style={{
                width: maior > 0 ? `${(linha.total / maior) * 100}%` : '0%',
                backgroundColor: CORES[indice % CORES.length],
              }}
            />
          </div>
        </div>
      ))}

      <Button asChild variant="outline" className="w-full">
        <Link href="/admin/perfis">Gerenciar Permissões (RBAC)</Link>
      </Button>
    </Card>
  );
}
```

**21.2** Em `usuarios-client.tsx`, envolver a tabela e o resumo em
`<div className="grid gap-6 lg:grid-cols-12">`, com a tabela em `lg:col-span-8` e
`<ResumoPerfis />` em `lg:col-span-4`.

**21.3** No mesmo arquivo, acrescentar o drawer de usuário (decisão 34) usando `Sheet` do DS, aberto pelo
botão "Novo Usuário" e pelo `Pencil` de cada linha, com os campos:

| campo | tipo | regra |
|---|---|---|
| Nome | `Input` texto | obrigatório |
| E-mail | `Input` e-mail | obrigatório; desabilitado na edição |
| Senha | `Input` password | só na criação, obrigatório, mínimo 8 caracteres |
| Ativo | `Switch` | padrão ligado |
| Perfis | lista de `Checkbox` com os 11 perfis de `GET /api/admin/perfis` | ao menos um |

`POST /api/admin/usuarios` na criação, `PATCH /api/admin/usuarios/:id` na edição e
`PUT /api/admin/usuarios/:id/perfis` para os perfis (rota BFF já existente). Botão "Aprovar usuário"
aparece somente com `USUARIOS_APROVAR` e chama `POST /api/admin/usuarios/:id/aprovar`; o erro de
segregação criador ≠ aprovador vindo do backend aparece como `toast.error` com a mensagem do backend.

**21.4** Criar `app/frontend/__tests__/usuarios-client.test.tsx` (DoD-53 e DoD-54), com o cabeçalho
padrão dos testes de tela (`@testing-library/react` + `import UsuariosClient from
'@/app/(admin)/admin/usuarios/usuarios-client'`):

```tsx
it('resumo de perfis usa contagem real do backend', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('resumo-perfis')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { slug: 'administrador', nome: 'Administrador', total: 2 },
          { slug: 'conferente', nome: 'Conferente', total: 0 },
        ],
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) });
  }) as unknown as typeof fetch;

  render(<UsuariosClient permissoes={['USUARIOS_LER']} />);
  expect(await screen.findByText('2 usuários')).toBeInTheDocument();
  expect(screen.getByText('0 usuários')).toBeInTheDocument();
});

it('sem USUARIOS_APROVAR nao ha botao de aprovar', async () => {
  render(<UsuariosClient permissoes={['USUARIOS_LER', 'USUARIOS_GERENCIAR']} />);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Aprovar/i })).not.toBeInTheDocument());
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/usuarios-client.test.tsx
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 22 — Tela `/admin/perfis`

Protótipo: `PerfisAcesso.tsx` — cartão "Matriz de permissões" com `ShieldCheck`, cabeçalho
`bg-[#F8FAFC]`, primeira coluna fixa, linha selecionada em `bg-[#EFF6FF]` e toggles `h-5 w-9`; e cartão
"Menus visíveis — {perfil}" com contador e chips em `grid-cols-3`. O conteúdo são os 11 perfis canônicos
e o catálogo real de permissões (decisão 29).

**22.1** `app/frontend/src/app/(admin)/admin/perfis/page.tsx`:

```tsx
import { getMe } from '@/lib/auth';
import { PerfisClient } from './perfis-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('PERFIS_GERENCIAR')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar perfis de acesso.
      </p>
    );
  }

  return <PerfisClient />;
}
```

**22.2** Criar `app/frontend/src/app/(admin)/admin/perfis/perfis-client.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { mensagemDeErro } from '@/lib/error-message';
import { MENU_V2 } from '@/lib/menu-v2';

interface Perfil {
  id: string;
  slug: string;
  nome: string;
  permissoes: string[];
  menusVisiveis: string[];
}

interface Catalogo {
  grupos: Array<{ modulo: string; permissoes: Array<{ codigo: string; descricao: string }> }>;
  menus: string[];
}

const ROTULO_MENU = new Map(
  MENU_V2.flatMap((grupo) => grupo.items.map((item) => [item.href, `${grupo.title} · ${item.label}`])),
);

export function PerfisClient() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [slugSelecionado, setSlugSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [resPerfis, resCatalogo] = await Promise.all([
        fetch('/api/admin/perfis', { cache: 'no-store' }),
        fetch('/api/admin/perfis/catalogo', { cache: 'no-store' }),
      ]);
      if (!resPerfis.ok) {
        setErro(await mensagemDeErro(resPerfis));
        return;
      }
      if (!resCatalogo.ok) {
        setErro(await mensagemDeErro(resCatalogo));
        return;
      }
      const lista = (await resPerfis.json()) as Perfil[];
      setPerfis(lista);
      setCatalogo((await resCatalogo.json()) as Catalogo);
      setSlugSelecionado((atual) => atual ?? lista[0]?.slug ?? null);
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionado = useMemo(
    () => perfis.find((p) => p.slug === slugSelecionado) ?? null,
    [perfis, slugSelecionado],
  );

  const alternarPermissao = async (perfil: Perfil, codigo: string) => {
    const permissoes = perfil.permissoes.includes(codigo)
      ? perfil.permissoes.filter((c) => c !== codigo)
      : [...perfil.permissoes, codigo];
    await enviar(`/api/admin/perfis/${perfil.slug}/permissoes`, { permissoes });
  };

  const alternarMenu = async (perfil: Perfil, href: string) => {
    const menus = perfil.menusVisiveis.includes(href)
      ? perfil.menusVisiveis.filter((m) => m !== href)
      : [...perfil.menusVisiveis, href];
    await enviar(`/api/admin/perfis/${perfil.slug}/menus`, { menus });
  };

  const enviar = async (url: string, corpo: Record<string, string[]>) => {
    setSalvando(true);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Perfil atualizado.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Perfis de Acesso</h1>
        <p className="text-sm text-muted-foreground">
          Permissões de API e menus visíveis dos 11 perfis com segregação de funções
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <Card className="overflow-hidden py-0">
        <div className="flex items-center gap-2 border-b p-5">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-bold">Matriz de permissões</h2>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#F8FAFC] text-left text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="sticky left-0 z-10 bg-[#F8FAFC] px-4 py-3">Permissão</th>
                {perfis.map((perfil) => (
                  <th key={perfil.slug} className="px-3 py-3 text-center whitespace-nowrap">
                    {perfil.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogo?.grupos.map((grupo) => (
                <>
                  <tr key={grupo.modulo} className="bg-muted/40">
                    <td className="sticky left-0 bg-muted/40 px-4 py-2 text-xs font-bold uppercase" colSpan={1}>
                      {grupo.modulo}
                    </td>
                    <td colSpan={perfis.length} />
                  </tr>
                  {grupo.permissoes.map((permissao, indice) => (
                    <tr
                      key={permissao.codigo}
                      className={indice % 2 === 1 ? 'bg-[#FAFAFA]' : undefined}
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <p className="font-mono text-xs">{permissao.codigo}</p>
                        <p className="text-xs text-muted-foreground">{permissao.descricao}</p>
                      </td>
                      {perfis.map((perfil) => (
                        <td key={perfil.slug} className="px-3 py-2 text-center">
                          <Switch
                            className="h-5 w-9"
                            aria-label={`${permissao.codigo} para ${perfil.nome}`}
                            checked={perfil.permissoes.includes(permissao.codigo)}
                            disabled={salvando}
                            onCheckedChange={() => void alternarPermissao(perfil, permissao.codigo)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">
            Menus visíveis — {selecionado?.nome ?? 'selecione um perfil'}
          </h2>
          <span className="text-xs text-muted-foreground">
            {selecionado ? `${selecionado.menusVisiveis.length} de 39 menus` : '—'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {perfis.map((perfil) => (
            <Button
              key={perfil.slug}
              variant={perfil.slug === slugSelecionado ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSlugSelecionado(perfil.slug)}
            >
              {perfil.nome}
            </Button>
          ))}
        </div>

        {selecionado && (
          <div className="grid gap-2 md:grid-cols-3">
            {(catalogo?.menus ?? []).map((href) => {
              const marcado = selecionado.menusVisiveis.includes(href);
              return (
                <button
                  key={href}
                  type="button"
                  aria-pressed={marcado}
                  disabled={salvando}
                  onClick={() => void alternarMenu(selecionado, href)}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    marcado
                      ? 'border-primary bg-[#EFF6FF] text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {ROTULO_MENU.get(href) ?? href}
                </button>
              );
            })}
          </div>
        )}

        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4" />
          Alterar menus visíveis vale na próxima navegação do usuário. Alterar permissões de API vale no
          próximo login ou renovação de sessão.
        </p>
      </Card>
    </div>
  );
}
```

**22.3** Criar `app/frontend/__tests__/perfis-client.test.tsx` (DoD-55 a DoD-59) cobrindo:
a matriz renderiza uma coluna por perfil devolvido e uma linha por permissão do catálogo, agrupadas por
módulo; clicar num chip de menu dispara `PUT /api/admin/perfis/:slug/menus` com a lista atualizada;
o contador mostra "N de 39 menus"; o texto da nota sobre menu × permissão está presente; erro do backend
vira `toast`/`role="alert"` sem alterar a matriz na tela.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/perfis-client.test.tsx
```

Saída esperada: `Tests: 5 passed, 5 total`.

---

### Task 23 — Tela `/admin/parametros`

Protótipo: `Parametros.tsx` — cartões agrupados por seção (Comercial, Operação, Fiscal), cada um com
título, descrição e controle (`Switch` para toggle, `Input` para texto, texto estático para info),
`BadgeProvisorio` quando provisório e botão "Salvar" por cartão.

**23.1** `page.tsx` no molde da Task 22.1 com `PARAMETROS_LER` para leitura e
`PARAMETROS_GERENCIAR` passado como `podeGerenciar`.

**23.2** Criar `app/frontend/src/app/(admin)/admin/parametros/parametros-client.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { mensagemDeErro } from '@/lib/error-message';

interface ValorParametro {
  grupo: string;
  tipo: 'toggle' | 'texto' | 'info';
  titulo: string;
  texto: string;
  valor?: boolean | string;
  provisorio: boolean;
  pendencia: string | null;
}

interface Parametro {
  id: string;
  chave: string;
  valorJson: ValorParametro;
}

const GRUPOS = ['Comercial', 'Operação', 'Fiscal'];

export function ParametrosClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, boolean | string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch('/api/admin/parametros?page=1&pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: Parametro[] };
      setParametros(dados.data);
      setRascunho(
        Object.fromEntries(
          dados.data
            .filter((p) => p.valorJson.valor !== undefined)
            .map((p) => [p.chave, p.valorJson.valor as boolean | string]),
        ),
      );
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async (parametro: Parametro) => {
    setSalvandoChave(parametro.chave);
    try {
      const res = await fetch(`/api/admin/parametros/chave/${encodeURIComponent(parametro.chave)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorJson: { ...parametro.valorJson, valor: rascunho[parametro.chave] },
        }),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Parâmetro salvo.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvandoChave(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Parâmetros do Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Regras configuráveis da operação; itens provisórios aguardam definição do cliente
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {GRUPOS.map((grupo) => {
        const doGrupo = parametros.filter((p) => p.valorJson.grupo === grupo);
        if (doGrupo.length === 0) return null;

        return (
          <section key={grupo} className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase">{grupo}</h2>

            {doGrupo.map((parametro) => (
              <Card key={parametro.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-[240px] flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{parametro.valorJson.titulo}</h3>
                    {parametro.valorJson.provisorio && parametro.valorJson.pendencia && (
                      <BadgeProvisorio pendencia={parametro.valorJson.pendencia} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{parametro.valorJson.texto}</p>
                </div>

                <div className="flex items-center gap-3">
                  {parametro.valorJson.tipo === 'toggle' && (
                    <Switch
                      aria-label={parametro.valorJson.titulo}
                      checked={rascunho[parametro.chave] === true}
                      disabled={!podeGerenciar}
                      onCheckedChange={(v) => setRascunho((r) => ({ ...r, [parametro.chave]: v }))}
                    />
                  )}

                  {parametro.valorJson.tipo === 'texto' && (
                    <Input
                      aria-label={parametro.valorJson.titulo}
                      className="w-56"
                      value={String(rascunho[parametro.chave] ?? '')}
                      disabled={!podeGerenciar}
                      onChange={(e) => setRascunho((r) => ({ ...r, [parametro.chave]: e.target.value }))}
                    />
                  )}

                  {parametro.valorJson.tipo !== 'info' && podeGerenciar && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={salvandoChave === parametro.chave}
                      onClick={() => void salvar(parametro)}
                    >
                      {salvandoChave === parametro.chave ? 'Salvando…' : 'Salvar'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </section>
        );
      })}
    </div>
  );
}
```

**23.3** Criar `app/frontend/__tests__/parametros-client.test.tsx` (DoD-60 a DoD-64) cobrindo:
os 9 parâmetros aparecem nos 3 grupos na ordem Comercial → Operação → Fiscal; **exatamente 2** cartões
exibem `BadgeProvisorio` (`operacao.cadencia_dias_semana` com `P1` e `operacao.regras_transformacao_tz`
com `P12`) e os outros 7 não exibem badge — inclusive composição do boi casado (AD-01), emissão fiscal
(AD-02) e expiração de reserva de rascunho (AD-06); o cartão `info` não tem botão
"Salvar"; sem `PARAMETROS_GERENCIAR` nenhum controle é editável e não há botão "Salvar"; salvar envia
`PATCH /api/admin/parametros/chave/<chave>` preservando as demais chaves de `valorJson`.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/parametros-client.test.tsx
```

Saída esperada: `Tests: 5 passed, 5 total`.

---

### Task 24 — Tela `/admin/auditoria` (fecha a decisão 27 da Onda 2)

Protótipo: `Auditoria.tsx` — barra de filtros com **Período** (`col-span-2`), **Usuário**, **Módulo**,
**Operação** e **Registro (ID)**, botões "Aplicar Filtros" e "Exportar CSV", tabela em `col-span-8` e
painel de diff em `col-span-4` com fundo escuro (decisões 30, 31 e 32).

**24.1** Em `app/frontend/src/lib/auditoria.ts`, acrescentar a `FiltrosAuditoria` os campos
`dataInicio?: string`, `dataFim?: string` e `registroBusca?: string`, e o tipo das facetas:

```ts
export interface FacetasAuditoria {
  modulos: string[];
  tabelas: string[];
  usuarios: Array<{ id: string; nome: string }>;
}
```

**24.2** Em `auditoria-client.tsx`, substituir o `CardContent` de filtros (linhas 77–131) por:

```tsx
        <CardContent className="grid gap-4 p-5 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label htmlFor="periodo-inicio">Período</Label>
            <div className="flex gap-2">
              <Input
                id="periodo-inicio"
                type="datetime-local"
                value={filtros.dataInicio ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataInicio: e.target.value || undefined, page: 1 }))}
              />
              <Input
                aria-label="Período — fim"
                type="datetime-local"
                value={filtros.dataFim ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataFim: e.target.value || undefined, page: 1 }))}
              />
            </div>
          </div>

          <div>
            <Label>Usuário</Label>
            <Select
              value={filtros.usuarioId ?? 'todos'}
              onValueChange={(v) =>
                setFiltros((s) => ({ ...s, usuarioId: v === 'todos' ? undefined : v, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(facetas?.usuarios ?? []).map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Módulo</Label>
            <Select
              value={filtros.modulo ?? 'todos'}
              onValueChange={(v) =>
                setFiltros((s) => ({ ...s, modulo: v === 'todos' ? undefined : v, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(facetas?.modulos ?? []).map((modulo) => (
                  <SelectItem key={modulo} value={modulo}>
                    {modulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Operação</Label>
            <Select
              value={filtros.operacao ?? 'todas'}
              onValueChange={(v) =>
                setFiltros((s) => ({
                  ...s,
                  operacao: v === 'todas' ? undefined : (v as OperacaoAuditoria),
                  page: 1,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="ACAO_MANUAL">ACAO_MANUAL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="registro">Registro (ID)</Label>
            <Input
              id="registro"
              placeholder="UUID completo ou parte dele"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
            />
          </div>
        </CardContent>
```

com o estado e o carregamento das facetas:

```tsx
  const [facetas, setFacetas] = useState<FacetasAuditoria | null>(null);
  const [registro, setRegistro] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/auditoria/facetas', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      setFacetas((await res.json()) as FacetasAuditoria);
    })();
  }, []);
```

e a tradução do campo "Registro (ID)" no clique de "Aplicar Filtros" (decisão 31):

```tsx
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const aplicarFiltros = () => {
    const valor = registro.trim();
    setFiltros((s) => ({
      ...s,
      registroId: UUID.test(valor) ? valor : undefined,
      registroBusca: valor && !UUID.test(valor) ? valor : undefined,
      page: 1,
    }));
  };
```

O botão do cabeçalho passa a chamar `aplicarFiltros`, e ao lado dele entra:

```tsx
        <Button variant="outline" onClick={() => void exportarCsv()} disabled={exportando}>
          <Download className="mr-2 size-4" />
          {exportando ? 'Exportando…' : 'Exportar CSV'}
        </Button>
```

**24.3** Ajustar o painel de diff para as cores do protótipo (decisão 30): o container recebe
`bg-[#1E293B]`, os rótulos `text-slate-300`, o `pre` de "Dados Anteriores" `text-[#FC5241]` e o de
"Dados Novos" `text-[#18A84A]`.

**24.4** Criar a rota de exportação `app/frontend/src/app/api/admin/auditoria/export/route.ts`
(decisão 32):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

interface Registro {
  createdAt: string;
  usuarioNome: string | null;
  modulo: string | null;
  operacao: string;
  tabela: string;
  registroId: string;
  justificativa: string | null;
  ip: string | null;
}

interface Pagina {
  data: Registro[];
  total: number;
}

const LIMITE_PAGINAS = 50;

function celula(valor: string | null): string {
  return `"${(valor ?? '').replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const filtros = new URLSearchParams(request.nextUrl.searchParams);
  filtros.delete('page');
  filtros.set('pageSize', '100');

  const linhas: string[] = [
    'Data/Hora;Usuário;Módulo;Operação;Tabela;Registro;Justificativa;IP',
  ];
  let pagina = 1;
  let truncado = false;

  for (;;) {
    filtros.set('page', String(pagina));
    const { data, error } = await fetchBackend<Pagina>(`/auditoria?${filtros.toString()}`);
    if (error || !data) {
      return NextResponse.json({ message: error ?? 'Falha ao exportar auditoria' }, { status: 502 });
    }

    for (const registro of data.data) {
      linhas.push(
        [
          celula(new Date(registro.createdAt).toLocaleString('pt-BR')),
          celula(registro.usuarioNome),
          celula(registro.modulo),
          celula(registro.operacao),
          celula(registro.tabela),
          celula(registro.registroId),
          celula(registro.justificativa),
          celula(registro.ip),
        ].join(';'),
      );
    }

    if (pagina * 100 >= data.total) break;
    if (pagina >= LIMITE_PAGINAS) {
      truncado = true;
      break;
    }
    pagina += 1;
  }

  if (truncado) {
    linhas.push('# limite de 5000 registros atingido — refine o período');
  }

  return new NextResponse(`\uFEFF${linhas.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Auditoria-Truncado': truncado ? '1' : '0',
    },
  });
}
```

e no client:

```tsx
  const exportarCsv = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && k !== 'page' && k !== 'pageSize') params.set(k, String(v));
      });
      const res = await fetch(`/api/admin/auditoria/export?${params.toString()}`);
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      if (res.headers.get('X-Auditoria-Truncado') === '1') {
        toast.warning('Exportação truncada em 5000 registros. Refine o período.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setExportando(false);
    }
  };
```

**24.5** Criar `app/frontend/__tests__/auditoria-filtros.test.tsx` (DoD-65 a DoD-69) cobrindo:
os 5 filtros do protótipo estão presentes com esses rótulos; os selects de Usuário e Módulo são
populados por `/api/admin/auditoria/facetas`; digitar um UUID completo manda `registroId` e digitar
`abc123` manda `registroBusca`; "Exportar CSV" chama `/api/admin/auditoria/export` com os filtros
correntes e dispara o download; cabeçalho `X-Auditoria-Truncado: 1` mostra o aviso de truncamento.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/auditoria-filtros.test.tsx
```

Saída esperada: `Tests: 5 passed, 5 total`.

---

### Task 25 — Rotas BFF

Toda chamada do browser passa pelo BFF; o cliente nunca fala com o backend direto. O padrão é o de
`src/app/api/cadastros/[recurso]/route.ts`: repassar querystring/corpo, devolver `{ message }` com o
status do backend em caso de erro.

**25.1** `app/frontend/src/app/api/cadastros/frota-caminhoes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend(`/frota/caminhoes${qs ? `?${qs}` : ''}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend('/frota/caminhoes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
```

**25.2** `app/frontend/src/app/api/cadastros/frota-caminhoes/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/frota/caminhoes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { error, status } = await fetchBackend(`/frota/caminhoes/${id}`, { method: 'DELETE' });
  if (error) return NextResponse.json({ message: error }, { status });
  return new NextResponse(null, { status: 204 });
}
```

**25.3** Repetir 25.1 e 25.2, trocando apenas o caminho do backend, para:

| rota BFF | rota do backend |
|---|---|
| `/api/cadastros/frota-motoristas` | `/frota/motoristas` |
| `/api/cadastros/modelos-etiqueta` | `/modelos-etiqueta` |

**25.4** Rotas de leitura simples (só `GET`, mesmo corpo da 25.1 com o caminho trocado):

| rota BFF | rota do backend |
|---|---|
| `/api/admin/parametros` | `/parametros` |
| `/api/cadastros/fornecedores/contagens` | `/fornecedores/contagens` |
| `/api/cadastros/fornecedores/[id]/historico` | `/fornecedores/{id}/historico` |
| `/api/admin/perfis/catalogo` | `/perfis/catalogo` |
| `/api/admin/usuarios/resumo-perfis` | `/usuarios/resumo-perfis` |
| `/api/admin/auditoria/facetas` | `/auditoria/facetas` |

> Segmento estático vence segmento dinâmico no App Router, então
> `/api/cadastros/fornecedores/contagens` não é capturado por `[recurso]/[id]`, e
> `/api/cadastros/fornecedores` continua atendido por `[recurso]/route.ts`.

**25.5** Rotas de escrita adicionais:

| rota BFF | método | rota do backend |
|---|---|---|
| `/api/admin/perfis/[slug]/menus` | `PUT` | `/perfis/{slug}/menus` |
| `/api/admin/parametros/chave/[chave]` | `GET`, `PATCH` | `/parametros/chave/{chave}` |
| `/api/cadastros/regras-desdobramento/simular` | `POST` | `/regras-desdobramento/simular` |
| `/api/desossa/regras-transformacao/simular` | `POST` | `/desossa/regras-transformacao/simular` |

Exemplo literal do `PUT` (os outros seguem o mesmo formato, devolvendo `200`):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/perfis/${slug}/menus`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
```

**25.6** Criar `app/frontend/__tests__/bff-onda3.test.ts` (DoD-70 e DoD-71) verificando, para cada uma das 17
rotas novas, que o arquivo existe e que o handler devolve o status do backend em caso de erro:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROTAS = [
  'cadastros/frota-caminhoes/route.ts',
  'cadastros/frota-caminhoes/[id]/route.ts',
  'cadastros/frota-motoristas/route.ts',
  'cadastros/frota-motoristas/[id]/route.ts',
  'cadastros/modelos-etiqueta/route.ts',
  'cadastros/modelos-etiqueta/[id]/route.ts',
  'cadastros/fornecedores/contagens/route.ts',
  'cadastros/fornecedores/[id]/historico/route.ts',
  'cadastros/regras-desdobramento/simular/route.ts',
  'desossa/regras-transformacao/simular/route.ts',
  'admin/perfis/catalogo/route.ts',
  'admin/perfis/[slug]/menus/route.ts',
  'admin/usuarios/resumo-perfis/route.ts',
  'admin/auditoria/facetas/route.ts',
  'admin/auditoria/export/route.ts',
  'admin/parametros/route.ts',
  'admin/parametros/chave/[chave]/route.ts',
];

it('todas as rotas BFF da Onda 3 existem', () => {
  const faltando = ROTAS.filter((rota) => !existsSync(join('src', 'app', 'api', rota)));
  expect(faltando).toEqual([]);
});

it('erro do backend vira status e message no BFF', async () => {
  jest.doMock('@/lib/api', () => ({
    fetchBackend: async () => ({ data: null, error: 'Sem permissão', status: 403 }),
  }));
  const { GET } = await import('../src/app/api/admin/perfis/catalogo/route');
  const res = await GET(new Request('http://localhost/api/admin/perfis/catalogo') as never);
  expect(res.status).toBe(403);
  await expect(res.json()).resolves.toEqual({ message: 'Sem permissão' });
});
```

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/bff-onda3.test.ts
```

Saída esperada: `Tests: 2 passed, 2 total`.

---

### Task 26 — E2E, terminologia e navegação das 12 rotas

**26.1** Criar `app/frontend/e2e/onda3-cadastros-admin.spec.ts` (DoD-72 e DoD-73), no mesmo padrão dos
`spec` da Onda 2 (login por `storageState` de administrador):

```ts
import { test, expect } from '@playwright/test';

const ROTAS: Array<[string, string]> = [
  ['/cadastros/representantes', 'Representantes'],
  ['/cadastros/produtos', 'Produtos'],
  ['/cadastros/fornecedores', 'Fornecedores / Frigoríficos'],
  ['/cadastros/caminhoes', 'Caminhões'],
  ['/cadastros/motoristas', 'Motoristas'],
  ['/cadastros/rotas', 'Rotas / Itinerários'],
  ['/cadastros/regras-transformacao', 'Regras de Transformação'],
  ['/cadastros/modelos-etiqueta', 'Modelos de Etiqueta'],
  ['/admin/usuarios', 'Usuários'],
  ['/admin/perfis', 'Perfis de Acesso'],
  ['/admin/parametros', 'Parâmetros do Sistema'],
  ['/admin/auditoria', 'Auditoria'],
];

for (const [rota, titulo] of ROTAS) {
  test(`rota ${rota} abre com titulo e sem placeholder`, async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });

    await page.goto(rota);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo);
    await expect(page.getByText('Em construção')).toHaveCount(0);
    expect(erros).toEqual([]);
  });
}

test('menu do administrador leva as 12 rotas da onda', async ({ page }) => {
  await page.goto('/');
  for (const [rota] of ROTAS) {
    await expect(page.locator(`a[href="${rota}"]`)).toBeVisible();
  }
});
```

**26.2** Criar `app/frontend/__tests__/terminologia-onda3.test.ts` (DoD-74 a DoD-76), varrendo os arquivos criados
ou alterados nesta onda em busca do rótulo banido e de sobras de protótipo:

```ts
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const ALVOS = globSync('src/app/(admin)/{cadastros,admin}/**/*.tsx', { cwd: process.cwd() })
  .concat(globSync('src/components/cadastros/**/*.tsx', { cwd: process.cwd() }))
  .concat(['src/lib/menu-v2.ts', 'src/lib/modelos-etiqueta.ts', 'src/lib/frota.ts']);

it('nenhum arquivo da onda usa o rotulo banido pela v1.1', () => {
  const banido = /\bmarcas?\b/i;
  const infratores = ALVOS.filter((arquivo) => banido.test(readFileSync(join(process.cwd(), arquivo), 'utf8')));
  expect(infratores).toEqual([]);
});

it('nenhum arquivo da onda tem marcador de pendencia ou dado de demonstracao', () => {
  const proibidos = /\b(TODO|TBD|FIXME|lorem ipsum)\b/i;
  const infratores = ALVOS.filter((arquivo) => proibidos.test(readFileSync(join(process.cwd(), arquivo), 'utf8')));
  expect(infratores).toEqual([]);
});

it('nenhuma tela da onda usa PlaceholderPage', () => {
  const infratores = ALVOS.filter((arquivo) => readFileSync(join(process.cwd(), arquivo), 'utf8').includes('PlaceholderPage'));
  expect(infratores).toEqual([]);
});
```

> `globSync` vem de `node:fs` (Node 22+, já exigido pelo `.nvmrc`). Se o ambiente reclamar do import,
> usar `glob` do pacote `glob` já presente em `devDependencies` do frontend.

**26.3** Criar `app/backend/test/unit/cobertura-config.spec.ts` (DoD-77). O gate de cobertura só protege a
onda se estiver declarado no `jest.config.cjs` — este teste prova que o limite existe e continua em 80 %,
para que ninguém o afrouxe junto com o volume de código novo:

```ts
import { createRequire } from 'node:module';

const require = createRequire(__filename);

it('jest exige 80 por cento de linha e de branch', () => {
  const config = require('../../jest.config.cjs') as {
    coverageThreshold?: { global?: { lines?: number; branches?: number } };
  };
  expect(config.coverageThreshold?.global?.lines).toBeGreaterThanOrEqual(80);
  expect(config.coverageThreshold?.global?.branches).toBeGreaterThanOrEqual(80);
});
```

`app/backend/jest.config.cjs` já traz `coverageThreshold: { global: { lines: 80, branches: 80 } }` na
linha 27; o teste apenas impede que esse limite seja afrouxado sem alguém notar.

**Verificação:**

```bash
cd app/frontend && npx jest __tests__/terminologia-onda3.test.ts
cd app/frontend && npx playwright test e2e/onda3-cadastros-admin.spec.ts
cd app/backend && npx jest test/unit/cobertura-config.spec.ts
```

Saída esperada: `Tests: 3 passed, 3 total` no frontend, `13 passed` no Playwright e
`Tests: 1 passed, 1 total` no backend.

---

### Task 27 — Evidências, status e gate local

**27.1** Criar `docs/execucao/evidencias/onda3-cadastros-admin/README.md` com:

- as 12 capturas lado a lado (protótipo × implementação), nomeadas
  `<rota-com-hifens>-prototipo.png` e `<rota-com-hifens>-app.png`;
- a tabela das **26 perdas** da decisão 25 da Onda 2 com a coluna "situação após a Onda 3" preenchida com
  `visível` para todas as 26, e a saída do teste `as 26 perdas herdadas da Onda 2 estao visiveis`;
- a tabela dos **14 extras** da decisão 31 com "situação" = `removido`, e a saída do teste
  `os 14 extras herdados da Onda 2 sumiram do menu`;
- as quatro divergências autorizadas: `/admin/perfis` (11 perfis canônicos e permissões reais em vez dos
  8 perfis e 9 rótulos do mock — decisão 29), o `placeholder` do campo "Registro (ID)" da auditoria
  (decisão 31), `MODELOS_ETIQUETA_LER` concedida a `recebimento_pesagem` e `corte` além da
  linha 37 da matriz (decisão 27) e o preview de etiqueta sem valores de exemplo (D18.a);
- a lista dos 3 badges Provisório da onda e onde aparecem: P1 em `/admin/parametros`
  (`operacao.cadencia_dias_semana`), P12 em `/admin/parametros` (`operacao.regras_transformacao_tz`) e
  P9 em `/cadastros/modelos-etiqueta`; e a nota de que AD-01, AD-02 e AD-06 retiraram os badges de
  composição do boi casado, emissão fiscal e expiração de reserva.

**27.2** Atualizar `docs/execucao/EXECUCAO-STATUS.md`: linha da Onda 3 para `aguardando_portao2`, com o sha
do commit da implementação, e a seção de dívidas com as duas dívidas desta onda (ligação frota × expedição
e a nota de qualidade do fornecedor como campo manual).

**27.3** Gate local completo, na ordem:

```bash
cd app/backend && npm run lint
cd app/backend && npx tsc --noEmit
cd app/backend && npm run db:migrate
cd app/backend && npm run db:seed
cd app/backend && npm run rbac:snapshot && git diff --exit-code src/common/rbac
cd app/backend && npm run test:cov
cd app/frontend && npm run lint
cd app/frontend && npx tsc --noEmit
cd app/frontend && npm run test
cd app/frontend && npm run build
cd app/frontend && npx playwright test
```

Saída esperada, em ordem: lint sem avisos; `tsc` silencioso; migrations aplicando `0015` uma única vez
(`applied 0015_onda3_cadastros_admin`); seed idempotente (rodar duas vezes não muda contagens);
`git diff --exit-code` sem diferença no snapshot (prova que o snapshot commitado está atualizado —
decisão 28); cobertura **≥ 80%** de linha e de branch no backend; Jest do frontend verde; `next build`
sem erro; Playwright com todos os `spec` verdes.

**27.4** Conferência final de aritmética da reconciliação (roda em segundos e é o resumo que vai no PR):

```bash
cd app/frontend && npx jest __tests__/menu-rbac.test.ts --verbose
```

Saída esperada: entre as linhas verdes, obrigatoriamente:

```
✓ a matriz soma 126 atribuicoes perfil x rota
✓ zero perdas: nenhuma rota da matriz fica fora do menu do perfil
✓ zero extras: nenhum item visivel sem atribuicao na matriz
✓ as 26 perdas herdadas da Onda 2 estao visiveis
✓ os 14 extras herdados da Onda 2 sumiram do menu
```

---

## Ordem de execução e dependências

```
1 → 2 → 3            (schema, seeds e permissões: base de tudo)
        ├── 4, 5     (módulos novos: frota, modelos de etiqueta)
        ├── 6, 7     (rotas e fornecedores: backend dos campos novos)
        ├── 8, 9, 10 (perfis/menus, admin diverso, simuladores)
        └── 11       (reconciliação do menu — depende de 1, 2, 3 e 8)
11 → 12              (componente compartilhado depende do menu já reconciliado só para o E2E; pode
                      começar em paralelo, mas 12 entra antes de 13, 14 e 15)
12 → 13, 14, 15
4 → 14, 15           (as telas de frota exigem o módulo backend)
5 → 18
6 → 17 · 7 → 16 · 8 → 22 · 9 → 21, 23, 24 · 10 → 20 · 19 é independente após 3
25 depende de 4, 5, 7, 8, 9, 10 (as rotas BFF espelham os endpoints)
26 depende de todas as telas; 27 é a última.
```

O Worker executa na ordem numérica: as dependências acima estão satisfeitas por construção.

---

## Dívidas deixadas por esta onda

1. **Ligação frota × expedição (decisão 13).** `frota_caminhoes` e a tabela `caminhoes` da expedição
   continuam desconectadas. Fechar na Onda 7 (Expedição), fazendo `caminhoes.caminhao_cadastro_id`
   referenciar `frota_caminhoes.id` em migração expand → backfill → contract.
2. **Nota de qualidade do fornecedor (decisão 18).** Continua sendo campo manual. Se o cliente definir
   uma fórmula (por exemplo, derivada de ocorrências por recebimento), a mudança exige AD-xx em
   `docs/execucao/DECISOES.md` antes de virar cálculo.
3. **Modelos de etiqueta com campos provisórios (P9).** O conjunto final de campos depende do cliente;
   quando fechar, o badge Provisório sai por AD-xx e o CHECK das 12 chaves é revisto.
4. **Exclusividade da desossa restrita a TZ (P12).** As duas alternativas continuam sendo as únicas.
   Regra para outros cortes exige decisão registrada.
5. **Exportação de auditoria limitada a 5 000 linhas (decisão 32).** Se o volume exigir exportação
   completa, o caminho é um endpoint de streaming no backend, não aumentar o limite no BFF.
6. **"Representantes permitidos" no usuário (decisão 43).** Linha 38 da matriz continua **Divergente**
   depois desta onda. Fecha na **Onda 4 (Comercial)** com tabela `usuarios_representantes`,
   `PUT /usuarios/:id/representantes`, o multisseletor no drawer e o filtro aplicado em pedidos e clientes.

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação embutida no plano |
|---|---|---|---|
| A troca do gate de grupo por `menus_visiveis` esconder um item que hoje aparece para alguém | média | alto | DoD-05 a DoD-08 comparam os 11 perfis contra a matriz nos dois sentidos e reexecutam as tabelas de perdas e extras da Onda 2 |
| Perfil alterado por `PUT /perfis/:slug/menus` ser silenciosamente revertido pelo seed | média | médio | Decisão 23 declara o comportamento; DoD-13 o prova; o cabeçalho da função de seed repete o aviso |
| Colisão de nome entre o cadastro de caminhões e a tabela `caminhoes` da expedição | alta | médio | Decisão 12 fixa o prefixo `frota_`; decisão 13 proíbe FK cruzada nesta onda |
| Tela de perfis divergir do protótipo por causa dos 11 perfis reais | certa | baixo | Decisão 29 autoriza e delimita a divergência (conteúdo muda, estrutura visual não); registrada no README de evidências |
| Simulador da desossa reimplementar regra de domínio no frontend | média | alto | Decisão 39 e Task 10: o cálculo é do backend; o frontend só exibe o resultado |
| Cobertura cair abaixo de 80 % com o volume de código novo | média | alto | Cada task backend entrega o teste junto; o gate de cobertura roda na Task 27 antes do PR |

---

## Autorrevisão do plano (checklist do Portão 1)

- [x] Toda tela do escopo tem `.tsx` de referência do protótipo citado com caminho e linhas.
- [x] Todas as decisões estão numeradas (1–43) e nenhuma deixa escolha para o Worker.
- [x] Nenhum marcador de pendência textual e nenhuma promessa de entrega adiada dentro de uma tela do
      escopo. O único item diferido é o escopo comercial "representantes permitidos" (linha 38 da
      matriz), com decisão numerada (43), onda de destino (4) e dívida registrada — o campo não aparece
      inerte em tela nesta onda.
- [x] As quatro divergências autorizadas estão numeradas e registradas no README de evidências:
      decisão 29 (`/admin/perfis`), decisão 31 (placeholder do campo Registro), decisão 27
      (`MODELOS_ETIQUETA_LER` além da linha 37 da matriz) e D18.a (preview de etiqueta sem valores de
      exemplo).
- [x] O rótulo banido pela v1.1 §6.8 não aparece no plano nem nos códigos propostos.
- [x] As três dívidas herdadas da Onda 2 (decisões 25, 27 e 31 **da Onda 2**) estão no mapa DoD → teste,
      com invariante próprio e teste nomeado; nesta onda elas são fechadas pelas decisões 4/5 (menu),
      30 (filtros da auditoria) e 11.7 (aritmética das perdas e extras).
- [x] Mapa DoD → teste é 1:1: 78 invariantes, cada um com um nome de teste e um arquivo.
- [x] Todas as pendências §16 usadas viram badge Provisório (P1 e P12 em `/admin/parametros`, P9 em
      modelos de etiqueta); AD-01, AD-02 e AD-06 retiram os badges que fecharam; nenhuma regra nova
      foi inventada.
- [x] Migração é expand puro, com rollback documentado e snapshot gerado por `drizzle-kit`.
- [x] Todo comando tem saída esperada; o gate local cobre lint, tipos, migração, seed, snapshot RBAC,
      cobertura, build e E2E.
- [x] Nenhuma regra de negócio no frontend: simuladores, contagens e histórico vêm do backend.
