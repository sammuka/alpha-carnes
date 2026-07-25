# Onda 2 — Shell + Design System fiel ao protótipo — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Executar as Tasks na ordem, com TDD (teste primeiro, falhando pelo motivo certo, depois implementação). Se um trecho literal não casar com o código, um teste continuar falhando após uma correção, ou uma pré-condição não existir, **parar e reportar ao Executor** — não improvisar.
> **Pré-condição processual:** Onda 1 mergeada em `develop` (squash `231f6843d29296d0b87ff69f1246cb54b2a6bc7e`), registrada em `docs/execucao/EXECUCAO-STATUS.md`. Este plano **não autoriza** o Worker a alterar `EXECUCAO-STATUS.md`, `DECISOES.md`, `quality-gates.md` nem `roadmap-canonico.md`.

**Goal:** Centralizar o Design System do protótipo validado (paleta completa em tokens, zero hex avulso), entregar o shell definitivo (sidebar em gradiente, menu com os 9 grupos e 39 itens nos rótulos/ordem do protótipo, breadcrumb, colapso por grupo, visibilidade de grupo dirigida pelo RBAC real e não por simulador de perfil), portar os componentes compartilhados que faltam (`PipelineBar`, badge `Provisório`, base do modal `TrocaPeca`) e alinhar `StatusPill`/`KpiCard`/`AlertItem`, além de deixar o login fiel ao protótipo mantendo o fluxo JWT real. Nenhuma tela de domínio das Ondas 3–10 é implementada.

**Architecture:** Next.js 16 App Router. A **única** fonte de cor é `app/frontend/src/app/globals.css` (`@theme` do Tailwind 4) — todo componente consome utilitários/tokens gerados a partir dela. O shell é composto por `app/(admin)/layout.tsx` (server component, resolve `GET /auth/me` e filtra o menu), `AppSidebar` + `NavGroup` + `NavItem` (client components de navegação) e `AdminHeader` (breadcrumb + identidade). A visibilidade do menu passa a ser decidida em **dois níveis**: permissões do **grupo** (segregação de funções do doc 013) e permissões do **item**; ambas resolvidas a partir das permissões que o backend já emite no JWT/`/auth/me`. Nenhuma regra de negócio nova entra no frontend (RA-01); a única alteração no backend é um script gerador + snapshot JSON do catálogo RBAC **já existente**, usado como fixture verificada pelos testes dos dois lados.

**Tech Stack:** Node 22, Next.js 16 (App Router, BFF), React 19, TypeScript 5 strict, Tailwind CSS 4 (`@theme`), Shadcn/ui, lucide-react, Jest + Testing Library (jsdom), Playwright (chromium), NestJS 11 + `tsx` (apenas para o script de snapshot RBAC).

**Branch:** `feature/onda2-shell-ds`

## Global Constraints

- Constituição I–X, com ênfase em **I (fidelidade absoluta ao protótipo)**, **II (completude E2E)**, **VI**, **VIII (não inventar o que está pendente)** e **RA-05/RA-06 (nenhuma falha silenciosa, nenhum dado inventado)**.
- Onda 2 é **transversal**: é proibido implementar tela de domínio das Ondas 3–10, criar endpoint de domínio, migration, permissão nova ou perfil novo.
- Alteração permitida no backend: **apenas** `scripts/gerar-snapshot-perfis.ts`, o JSON gerado, o script npm `rbac:snapshot` e o teste que guarda o snapshot. `src/common/rbac/permissoes.ts` **não** é editado. As sete dívidas herdadas do Portão 2 da Onda 1 têm destino nomeado na seção "Dívidas herdadas da Onda 1" (decisão 28) e **não** são executadas aqui — tocar nelas é desvio de plano.
- Zero literal hexadecimal **de cor aplicada** em `app/frontend/src/**/*.{ts,tsx}`; `globals.css` é a única fonte de cor. A única forma remanescente tolerada é hex **dentro de seletor de atributo CSS** (`[stroke='#ccc']`), que casa marcação de terceiro e não pinta nada — critério e inventário pinado na decisão 23. Zero `rgba(` fora de `globals.css`.
- Fonte única Inter (já configurada em `--font-sans`); nenhuma fonte nova.
- Terminologia: "Nome Fantasia"/"Buscar cliente"; **zero** ocorrência do rótulo banido — `__tests__/terminologia.test.ts` continua verde sem alteração.
- Pendências abertas (P1, P3, P5–P12, P15) só aparecem via badge `Provisório` com `title` citando a pendência e sua referência. Pendências fechadas (P2, P4, P13, P14 → AD-03..AD-06) **não podem** receber badge: o catálogo do componente não as contém.
- AD-01..AD-08 vigentes. AD-04 (11 perfis, recorte `ESTOQUE_*`) delimita o que a Onda 2 pode assumir sobre RBAC; a matriz completa de permissões por perfil é entrega da **Onda 3**.
- Cobertura: o gate numérico ≥80% é do backend e não é afetado (o backend só ganha script + teste). No frontend, **todo componente novo ou reescrito nesta onda tem smoke test de render**.
- Nada de fallback inventado: quando um dado não existe no contrato `/auth/me` (ex.: escopo/representante), o elemento **não é renderizado** — não se preenche com `"Todos"`, `"—"` ou similar.

## Decisões de design fixadas

1. **`globals.css` é a única fonte de cor.** Os tokens existentes (`--color-status-*`, `--color-sidebar-*`, `--color-primary`, …) **mantêm os nomes atuais**; a Onda 2 apenas **adiciona** os tokens que faltam. Nenhum rename, para não invalidar `StatusPill`, `KpiCard`, `AlertItem` e `PlaceholderPage`, que já consomem `var(--color-*)`.
2. A paleta canônica é a do Figma do protótipo (`src/imports/──PaletaDeCores──/index.tsx`, 14 entradas: `brand/navy #265389`, `brand/navy-hover #1E4070`, `brand/blue-mid #3B7FD4`, `brand/navy-10 #E8EEF5`, `bg/app #F5F7FA`, `text/primary #1A2332`, `text/secondary #64748B`, `text/muted #94A3B8`, `status/aceite #18A84A`, `status/pendente #F5B019`, `status/bloqueado #FC5241`, `status/recebido #3B7FD4`, `status/pesado #7C3AED`, `border/subtle #E2E8F0`). `src/styles/theme.css` do protótipo é o tema default do Figma Make (oklch genérico) e **não** é fonte de verdade de cor — está registrado aqui para evitar que alguém o porte por engano.
3. Os hexadecimais que o protótipo usa nas telas além das 14 entradas (família de ação `#2563EB`/`#1D4ED8`/`#1844B8`, superfícies `#F8FAFC`/`#F0EFF5`/`#E5E3ED`, login `#1F2633`/`#70748C`/`#B0B4BD`/`#1F1D2D`/`#6B7081`, pipeline `#10B981`/`#A1A5B3`, badge `#FEF3C7`/`#92400E`/`#FDE68A`, sinalizações `#15803D`/`#F0FDF4`/`#DC2626`/`#FFF1F2`/`#1E293B`/`#475569`/`#374151`/`#EFF6FF`/`#BFDBFE`/`#1E3A8A`, violeta `#8B5CF6`/`#F5F3FF`, popover da sidebar `#0F2645`) **entram como tokens nomeados**. Nenhuma cor é inventada: cada token tem origem rastreada no protótipo (tabela da Task 1).
4. O gate de hex é **global** em `app/frontend/src`, sem exceção por path e sem lista de tolerância por arquivo. Hoje **6** arquivos casam o padrão de hex: 5 deles usam hex como **cor aplicada** e todos são tocados nesta onda (`app-sidebar.tsx`, `activity-item.tsx`, `(admin)/layout.tsx`, `(auth)/login/page.tsx`, `cadastros/regras-transformacao/regras-transformacao-client.tsx`); o sexto (`components/ui/chart.tsx:58`) usa hex **dentro de seletor de atributo CSS** e é tratado pelo critério sintático da decisão 23 — não por exceção de caminho.
5. O menu canônico tem **9 grupos e 39 itens**, com os rótulos e as rotas de `ALL_NAV_GROUPS` (`src/app/components/Layout.tsx` do protótipo). Correções obrigatórias em `menu-v2.ts`: `Dashboard Operacional` → **`Painel Geral da Operação`**, `Aprovações` → **`Aprovações & Ocorrências`**, `Relatórios de Gestão` → **`Relatórios & SIF`**, e inclusão de **`Operações` (`/gestao/operacoes`)** e **`Pendências de Overbooking` (`/gestao/overbooking`)** na posição do protótipo. Pela mesma razão, o `<h1>` de `/gestao/dashboard` (`dashboard-client.tsx:193`) sai de `Dashboard Operacional` para **`Painel Geral da Operação`**, igual ao protótipo (`src/app/pages/Dashboard.tsx:56`), ao item de menu e ao breadcrumb — é troca de string de microcopy, não implementação da tela (a tela de Gestão é da Onda 5). Os specs Playwright existentes que afirmam o título antigo (`e2e/telas-reais.spec.ts:102`, `e2e/telas-migradas.spec.ts:130`, `e2e/jornada-operacional.spec.ts:442` e `:447`) são atualizados na mesma Task, senão a suíte fica vermelha.
6. Item de menu **nunca** aponta para rota inexistente (RA-05). As duas rotas novas recebem `page.tsx` usando o `PlaceholderPage` já existente (mesmo padrão das outras 11 telas ausentes). As telas reais são das Ondas 5 (`/gestao/operacoes`, `/gestao/overbooking`).
7. O breadcrumb continua derivado do menu (`BREADCRUMB_MAP` gerado de `MENU_V2` em `breadcrumb-v2.ts`): corrigir rótulo/rota no menu corrige o breadcrumb por construção. Nenhum segundo mapa é criado.
8. **O simulador de perfil do protótipo (`PROFILES`, `PROFILE_ORDER`, "SIMULAR PERFIL") não é portado** — é andaime de protótipo e o DoD manda RBAC real. Um teste garante que a string `SIMULAR PERFIL` não existe no código.
9. **`visibleGroups` por RBAC real, com permissões declaradas no grupo.** `MenuGroupDef` ganha `permissoesGrupo: string[]`; o grupo aparece se o usuário tiver ≥1 permissão do grupo, e cada item continua filtrado por suas próprias permissões (OR). Motivo: `LEITURA_CADASTROS` (`CLIENTES_LER`, `PRODUTOS_LER`, `PARAMETROS_LER`, …) é concedida a **todos** os 11 perfis; sem o nível de grupo, qualquer operador veria `CADASTROS & REGRAS`, o que contraria a segregação do doc 013 e a visibilidade por persona do protótipo.
10. Permissões de grupo fixadas (todas já existentes no catálogo, nenhuma nova):
    - `COMERCIAL`: `PEDIDOS_LER`, `PEDIDOS_GERENCIAR`
    - `GESTÃO`: `COMPRAS_PROGRAMADAS_GERENCIAR`, `OPERACOES_GERENCIAR`, `OVERBOOKING_RESOLVER`, `EXPEDICAO_REABRIR`
    - `RECEBIMENTO & BALANÇA`: `RECEBIMENTO_GERENCIAR`, `PESAGEM_GERENCIAR`, `CONFERENCIA_CONCLUIR`
    - `DESOSSA`: `CORTE_GERENCIAR`, `DESOSSA_GERENCIAR`
    - `ESTOQUE`: `ESTOQUE_LER`, `ESTOQUE_GERENCIAR`
    - `CARGA`: `EXPEDICAO_GERENCIAR`
    - `FATURAMENTO`: `FATURAMENTO_GERENCIAR`, `NFSE_EMITIR`
    - `CADASTROS & REGRAS`: `CLIENTES_GERENCIAR`, `PRODUTOS_GERENCIAR`, `FORNECEDORES_GERENCIAR`, `REPRESENTANTES_GERENCIAR`, `ROTAS_GERENCIAR`, `REGRAS_DESDOBRAMENTO_GERENCIAR`
    - `ADMINISTRAÇÃO`: `USUARIOS_GERENCIAR`, `PERFIS_GERENCIAR`, `PARAMETROS_GERENCIAR`, `AUDITORIA_VISUALIZAR`
11. **Equivalência com as personas do protótipo é provada por teste**, não afirmada: `comercial → [COMERCIAL]`, `recebimento_pesagem → [RECEBIMENTO & BALANÇA]`, `corte → [DESOSSA]`, `expedicao → [CARGA]`, `administrador → 9 grupos`. Divergências **autorizadas** e justificadas:
    - `gestor` também vê `ADMINISTRAÇÃO`, com **apenas** o item `Auditoria` visível, porque `gestor` tem `AUDITORIA_VISUALIZAR` no catálogo e a matriz de rastreabilidade (linha 41) lista `administrador`, `diretoria` e `gestor` como leitores da auditoria. A persona "Gestão" do protótipo escondia o grupo inteiro; aqui o RBAC canônico (doc 013) prevalece sobre o simulador, que o próprio DoD manda remover.
    - `diretoria` vê `[COMERCIAL, ADMINISTRAÇÃO]`; `compras` vê `[COMERCIAL, GESTÃO, CADASTROS & REGRAS]`. O protótipo não tem persona para esses perfis, logo não há divergência visual a conciliar.
    - `conferente` e `logistica` não têm, no catálogo pós-Onda 1, nenhuma permissão de grupo (só `LEITURA_CADASTROS` + `DISPONIBILIDADE_LER` (+ `FATURAMENTO_LER` para `logistica`)) e portanto ficam com **zero** grupos. A Onda 3 (matriz AD-04, incluindo o recorte `ESTOQUE_*`) é quem lhes atribui permissões. A Onda 2 não inventa acesso.
    - `faturamento → [GESTÃO, FATURAMENTO]`, com `GESTÃO` restrita ao item `Relatórios & SIF`: a matriz (linha 13) lista `faturamento` como perfil **primário** desse relatório e a decisão 30 restaura o item; a persona "Faturamento" do protótipo mostrava só o grupo `FATURAMENTO`. Vale aqui o mesmo critério do `gestor`: o RBAC canônico + matriz prevalecem sobre o simulador, que o próprio DoD manda remover.
    - Os itens que **cada um dos 11 perfis** perde por efeito do gate de grupo estão declarados um a um na decisão 25; as correções aplicadas para restaurar fidelidade à matriz estão na decisão 30; os itens visíveis que a matriz não nomeia estão na decisão 31.
12. **Zero grupo visível não pode virar sidebar vazia silenciosa** (RA-05): `AppSidebar` renderiza estado vazio explícito — "Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador." — coberto por teste.
13. **`ESTOQUE_*` é a permissão canônica do grupo `ESTOQUE`** (AD-04). Os itens do grupo passam a exigir `ESTOQUE_LER`/`ESTOQUE_GERENCIAR` (hoje `Consulta` aceita `PESAGEM_LER`/`CORTE_GERENCIAR` e `Ajustes` aceita só `PARAMETROS_GERENCIAR`). Consequência aceita e documentada: até a Onda 3 distribuir `ESTOQUE_*`, somente `administrador` e `gestor` veem o grupo `ESTOQUE`.
14. **`/admin/parametros` passa a exigir `PARAMETROS_GERENCIAR`** (e não `PARAMETROS_LER`), pois `PARAMETROS_LER` é transversal via `LEITURA_CADASTROS` e exporia parâmetros do sistema a todos os perfis. `/cadastros/representantes` passa a exigir `REPRESENTANTES_LER`/`REPRESENTANTES_GERENCIAR` (hoje exige `CLIENTES_GERENCIAR`, o que é incoerente com o recurso).
15. **A fixture RBAC do frontend é um snapshot gerado do backend, guardado por teste nos dois lados.** `app/backend/src/common/rbac/perfil-permissoes.snapshot.json` é gerado por `npm run rbac:snapshot` a partir de `MAPA_PERFIL_PERMISSOES`; um teste no backend falha se o snapshot divergir do runtime e o teste de RBAC do menu no frontend lê esse JSON por `readFileSync`. Assim não existe duplicação manual de permissões nem import cruzado de TypeScript entre workspaces.
16. **Cabeçalho e rodapé de identidade só mostram dado real.** `GET /auth/me` devolve `{ sub, nome, perfis, permissoes }` — não há representante/escopo. Portanto: `perfil` = perfis do usuário formatados pelos rótulos canônicos dos 11 perfis (`src/lib/perfis.ts`; chave desconhecida é exibida como veio, sem inventar rótulo) e o chip **`Escopo` é removido** enquanto o contrato não expor representante (entrega da Onda 3, junto de Usuários/Perfis). Fica proibido o `'Todos'`/`'N perfis'` atual, que é dado inventado.
17. **Badge `Provisório`**: componente `BadgeProvisorio` com catálogo tipado **apenas** das pendências abertas (P1, P3, P5, P6, P7, P8, P9, P10, P11, P12, P15) e suas referências reais do plano mestre §7; `title` obrigatório citando pendência + referência + a natureza provisória. Pendência fechada por AD não está no catálogo — usar `P2`/`P4`/`P13`/`P14` é erro de tipo e de runtime.
18. **`PipelineBar`** é porte 1:1 de `src/app/components/PipelineBar.tsx` (4 etapas fixas `Recebimento → Conferência & Destinação → Carga → Faturamento`, contadores opcionais, etapa passada com check verde, atual em azul de ação, futura em cinza), tokenizado. Fica em `src/components/ui/pipeline-bar.tsx`, sem consumidor nesta onda (as telas que o usam são das Ondas 6/9) — DoD pede o componente compartilhado, não a tela.
19. **`TrocaPecaModal` é só a base visual** (DoD: "base do modal"): chrome do wizard de 6 passos (cabeçalho, indicador de passo, área de conteúdo por `children`, rodapé `Voltar`/`Avançar`/`Confirmar Troca`, painel de sucesso com nova etiqueta e histórico), **controlado por props**. Nenhum seed mockado do protótipo (`PEDIDOS_TROCA`, `PECAS_DISPONIVEIS`) é portado, nenhuma regra de atomicidade/estorno é escrita — isso é Onda 6 (`trocas_peca`, transação única). O componente não decide nada de negócio.
20. **Login fiel com JWT real.** Portar do protótipo: layout 45%/55%, painel institucional em `#1F2633` com gradiente, logo + "AlphaCarnes" + "Sistema Integrado", headline "Distribuição inteligente ponta a ponta." e subtítulo, logo mobile, chip de ambiente, títulos "Bem-vindo de volta"/"Insira suas credenciais para acessar a operação.", campos E-mail/Senha com altura 12, botão **"Acessar Sistema"**. Divergências autorizadas, todas por regra de projeto:
    - **Sem a foto do Unsplash**: instalação é on-premises; buscar imagem de CDN externo em runtime é dependência externa não autorizada e a foto é asset de mock, não da AlphaCarnes. Mantém-se o gradiente do painel (que no protótipo é a camada dominante sobre a foto).
    - **Sem `defaultValue` de e-mail/senha** (credencial mockada) — proibido.
    - **Sem "Esqueci a senha"** e **sem "Lembrar minhas credenciais"**: não existem no backend F1 (fluxo é access 15min + refresh 8h); link/checkbox sem efeito é falha silenciosa (RA-05). Entram quando o backend oferecer o fluxo.
    - **Sem o rodapé "Protótipo de alta fidelidade — Design System Aplicado"**: texto sobre o protótipo, não sobre o produto.
    - **Chip de ambiente vem de `NEXT_PUBLIC_AMBIENTE`**; ausente a variável, o chip não é renderizado (nada de "Produção" fixo, que seria dado inventado).
21. **Evidência de shell** é um par screenshot app × referência do protótipo em `docs/evidencias/onda2-shell/`, mais asserções estruturais em Playwright (9 grupos na ordem canônica, gradiente da sidebar resolvido a partir dos tokens, breadcrumb do dashboard). Não há comparação por pixel: o protótipo é Vite/React Router com dados mockados e a comparação pixel-perfect entre stacks geraria falso negativo permanente. A referência é fixture versionada (procedimento de captura na Task 8).
22. Nenhum componente Shadcn de `src/components/ui` fora do escopo desta onda é editado, exceto: `activity-item.tsx` e `regras-transformacao-client.tsx` (**apenas** substituição de hex por token) e `button.tsx` (**apenas** a adição da variante `acao`, decisão 29 — nenhuma variante existente é alterada). `chart.tsx` **não** é editado (decisão 23).
23. **O invariante de cor é "zero hex de cor aplicada", e o teste implementa esse critério de forma sintática.** `components/ui/chart.tsx:58` traz `#ccc` (3×) e `#fff` (2×) — as **únicas 5 ocorrências de hex do arquivo**, todas **dentro de seletores de atributo CSS** (`[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50`, `[&_.recharts-dot[stroke='#fff']]:stroke-transparent`, …). Esses hex não pintam nada: são o valor que o **recharts** escreve no atributo `stroke` do SVG e que o seletor precisa casar literalmente. Trocá-los por token quebraria o casamento e o estilo deixaria de ser aplicado — falha silenciosa (RA-05) e regressão visual, além de divergir do protótipo, que carrega o mesmo arquivo (`src/app/components/ui/chart.tsx`, recharts 2.15.2). Portanto: `chart.tsx` fica **intacto** e o teste de hex remove de todo arquivo, antes de varrer, o padrão `[<atributo>='#hex']` — regra **sintática e global**, não exceção de caminho (decisão 4). Para que a tolerância não vire porta aberta, um segundo caso pina o **inventário** desses seletores em `src`: hoje exatamente 5 ocorrências, todas em `src/components/ui/chart.tsx`; qualquer nova ocorrência falha o teste e exige decisão numerada. `chart.tsx` não tem consumidor hoje (verificado por `rg`); ele permanece como componente do DS absorvido para as telas com gráfico das Ondas 5/9.
24. **Correções de RBAC de UI complementares à decisão 14** (nenhuma permissão nova; apenas alinhamento recurso × permissão, auditável no Portão 2):
    - `/cadastros/rotas` passa a exigir `ROTAS_LER`/`ROTAS_GERENCIAR` (hoje exige `EXPEDICAO_GERENCIAR`/`CLIENTES_LER`): rota/itinerário é o recurso `ROTAS_*` do catálogo; exigir `CLIENTES_LER` abriria o item para os 11 perfis via `LEITURA_CADASTROS`.
    - `/desossa/dashboard` deixa de aceitar `DISPONIBILIDADE_LER` e passa a exigir `DESOSSA_LER`/`CORTE_GERENCIAR`: `DISPONIBILIDADE_LER` é transversal (10 dos 11 perfis) e não expressa acesso à desossa. Consequência: dentro do grupo `DESOSSA` (visível só para `administrador`, `gestor` e `corte`), os três mantêm o item — nenhum perfil perde acesso real.
25. **Efeitos do gate de grupo declarados item a item — conjunto completo, calculado sobre 39 itens × 11 perfis** (Princípio II + RA-05). O cálculo compara, para cada par (perfil, rota), o que a coluna "Perfis RBAC" da matriz de rastreabilidade v1.1 atribui ao perfil (incluindo os papéis secundários "consulta"/"registro") com o que o menu desta onda mostra, já considerando as correções da decisão 30. Sobram **26 perdas**, e **todas** têm a mesma causa: o grupo inteiro não é visível para o perfil (em 15 delas o perfil também não teria a permissão do item). Nenhuma perda vem do filtro de item — isso é invariante testado.

    | Perfil | Rota que a matriz atribui e o menu não mostra | Papel na matriz | Grupo que ficou invisível | Por que não é corrigida nesta onda | Destino |
    |---|---|---|---|---|---|
    | `compras` | `/recebimento/recebimento-carga` (linha 14) | consulta | `RECEBIMENTO & BALANÇA` | o único gancho é `RECEBIMENTO_LER`, que 6 dos 11 perfis têm: no gate, abriria o módulo inteiro para `comercial` (3 itens não atribuídos) e traria 2 itens não atribuídos a `faturamento` | Onda 3 |
    | `comercial` | `/gestao/compras` (10), `/gestao/overbooking` (11) | consulta | `GESTÃO` | abrir `GESTÃO` para `comercial` quebraria a persona `comercial → [COMERCIAL]` do protótipo (Princípio I) e traria `Painel Geral`/`Relatórios & SIF` não atribuídos | Onda 3 |
    | `comercial` | `/desossa/dashboard` (17) | consulta | `DESOSSA` | mesma razão; além disso a decisão 24 tirou `DISPONIBILIDADE_LER` do item por ser transversal a 10 dos 11 perfis | Onda 3 |
    | `recebimento_pesagem` | `/gestao/aprovacoes` (12) | registro | `GESTÃO` | o único gancho seria `CONFERENCIA_CONCLUIR` no gate de `GESTÃO`, o que traria junto `Relatórios & SIF`, não atribuído ao perfil — troca uma divergência por outra | Onda 3 |
    | `recebimento_pesagem` | `/estoque/consulta`, `/estoque/entrada-itens`, `/estoque/ajustes` (20–22) | primário **condicionado** a `ESTOQUE_*` (AD-04) | `ESTOQUE` | a própria matriz condiciona o acesso ao recorte `ESTOQUE_*`, que o catálogo pós-Onda 1 só dá a `administrador`/`gestor` (decisão 13) | Onda 3 |
    | `expedicao` | `/comercial/pedidos` (4), `/comercial/espelho` (7) | consulta | `COMERCIAL` | `expedicao` não tem `PEDIDOS_LER` no catálogo; concedê-la é a entrega da matriz AD-04 | Onda 3 |
    | `expedicao` | `/estoque/consulta`, `/estoque/entrada-itens`, `/estoque/ajustes` (20–22) | primário **condicionado** a `ESTOQUE_*` (AD-04) | `ESTOQUE` | idem `recebimento_pesagem` (decisão 13) | Onda 3 |
    | `expedicao` | `/cadastros/caminhoes` (33), `/cadastros/motoristas` (34) | secundário (leitor) | `CADASTROS & REGRAS` | o gate exige um `*_GERENCIAR` de cadastro; `expedicao` só tem `LEITURA_CADASTROS` + `EXPEDICAO_GERENCIAR`. Abrir o gate para `EXPEDICAO_GERENCIAR` traria 6 itens de cadastro não atribuídos | Onda 3 |
    | `conferente` | `/carga/conferencia` (24) | **primário** | `CARGA` | restaurar exigiria conceder `EXPEDICAO_GERENCIAR` a `conferente` — permissão de gestão de carga, que fere a segregação do doc 013 e inventaria acesso (Princípio VIII); o catálogo (`permissoes.ts`) é imutável nesta onda | Onda 3 |
    | `faturamento` | `/comercial/clientes` (3), `/comercial/pedidos` (4) | consulta | `COMERCIAL` | `faturamento` não tem `PEDIDOS_LER`; abrir `COMERCIAL` por `CLIENTES_LER` (transversal) reabriria o problema que a decisão 9 fechou | Onda 3 |
    | `faturamento` | `/recebimento/recebimento-carga` (14) | consulta | `RECEBIMENTO & BALANÇA` | mesma razão do caso `compras` acima | Onda 3 |
    | `logistica` | `/faturamento/notas-xml` (27) | consulta | `FATURAMENTO` | `logistica` só tem `FATURAMENTO_LER`; pôr `FATURAMENTO_LER` no gate daria o grupo inteiro a `expedicao` também (3 itens não atribuídos) e ainda assim não restauraria os dois itens abaixo | Onda 3 |
    | `logistica` | `/faturamento/seguro-manual` (28) | secundário | `FATURAMENTO` | itens exigem `FATURAMENTO_GERENCIAR`, que `logistica` não tem no catálogo | Onda 3 |
    | `logistica` | `/faturamento/liberacao` (29) | **primário** | `FATURAMENTO` | idem — restaurar exigiria conceder `FATURAMENTO_GERENCIAR` a `logistica`, permissão de gestão fiscal; é decisão da matriz AD-04 | Onda 3 |
    | `diretoria` | `/gestao/dashboard` (8) | primário (leitura) | `GESTÃO` | o gate de `GESTÃO` exige um `*_GERENCIAR`/`*_RESOLVER` e `diretoria` é perfil somente-leitura (`COMPRAS_PROGRAMADAS_LER`, `DISPONIBILIDADE_LER`, `PEDIDOS_LER`, `AUDITORIA_VISUALIZAR`) | Onda 3 |
    | `diretoria` | `/gestao/aprovacoes` (12), `/gestao/relatorios` (13) | consulta | `GESTÃO` | idem | Onda 3 |
    | `diretoria` | `/faturamento/notas-xml` (27) | consulta | `FATURAMENTO` | idem `logistica`: só teria acesso abrindo o gate para uma permissão de leitura ampla | Onda 3 |

    `conferente` e `logistica` ficam com **zero** grupos (decisão 11) e caem no estado vazio explícito da decisão 12 + na página de entrada explícita da decisão 26 — nenhuma tela morta e nenhum 404.

    Regra de decisão usada em toda a tabela, para não virar arbítrio: **corrigir** quando o perfil é primário na matriz **e** existe permissão no catálogo que restaure o item sem expor item algum não atribuído (foi o caso dos dois itens da decisão 30); **declarar e diferir** quando restaurar exigiria conceder permissão nova (vedado — Princípio VIII, catálogo congelado nesta onda) ou produziria nova divergência do outro lado. Todas as 26 rotas continuam existindo e acessíveis por URL, com o RBAC do backend intacto: o que muda é apenas a navegação. A matriz completa de permissões por perfil (AD-04, incluindo `ESTOQUE_*`) é entrega da **Onda 3**, cujo plano tático deve tratar estas 26 linhas no seu mapa DoD→teste.
26. **Rota de entrada `/` e destino pós-login resolvidos pelo menu real, nunca em rota morta** (matriz linha 2 + RA-05). Hoje `/` não tem `page.tsx` (404) e `login-form-client.tsx` empurra todos para `/gestao/dashboard`, que após esta onda fica fora do menu de 7 dos 11 perfis. Fica fixado:
    - nasce `src/app/(admin)/page.tsx` (rota `/`, dentro do shell): resolve `GET /auth/me`, calcula os grupos visíveis e redireciona para `rotaDeEntrada(permissoes)`;
    - `rotaDeEntrada` devolve `/gestao/dashboard` **quando essa rota está visível** para o usuário (preserva o destino do protótipo e da matriz linha 2 para `administrador`, `gestor` e `compras`); senão, a primeira rota visível do **grupo de trabalho** — o grupo com **mais itens visíveis**, empate resolvido pela ordem canônica do menu; senão `null`. O critério é "grupo de trabalho" e não "primeira rota visível" porque um perfil pode enxergar, antes do seu módulo operacional, um grupo com um único item de consulta: `faturamento` vê `GESTÃO` só com `Relatórios & SIF` (decisão 30) e precisa entrar em `Pré-Faturamento`, não no relatório;
    - com `null` (nenhum grupo liberado), `/` **não** redireciona: renderiza aviso explícito ("Nenhum módulo liberado…"), dentro do shell com a sidebar em estado vazio (decisão 12). Nada de 403 genérico, nada de tela branca;
    - o login passa a navegar para `/` — a decisão de destino fica **num único lugar no servidor**, não duplicada no cliente.
    Tabela fixada (calculada sobre `MAPA_PERFIL_PERMISSOES` e provada por teste, 11 casos): `administrador`, `gestor`, `compras` → `/gestao/dashboard`; `comercial`, `diretoria` → `/comercial/clientes`; `recebimento_pesagem` → `/recebimento/recebimento-carga`; `corte` → `/desossa/dashboard`; `expedicao` → `/carga/planejamento`; `faturamento` → `/faturamento/pre-faturamento`; `conferente`, `logistica` → `null` (aviso explícito).
27. **`/admin/auditoria` (matriz linha 41): a Onda 2 entrega o DS que a tela consome; o alinhamento de filtros/visual ao protótipo é executado na Onda 3.** A matriz diz "alinhar filtros/visual ao protótipo na Onda 2", mas o roadmap §8 aloca todo o módulo Admin (Usuários, Perfis de Acesso, Parâmetros, Auditoria) à Onda 3, e Princípio II proíbe entregar metade de uma tela: os filtros de auditoria dependem do catálogo de entidades/permissões que a própria Onda 3 fecha. Reconciliação registrada: **a linha 41 é diferida para a Onda 3**, cujo plano deve incluí-la no mapa DoD→teste. O que a Onda 2 garante e testa: a rota existe, permanece no menu do grupo `ADMINISTRAÇÃO` exigindo `AUDITORIA_VISUALIZAR` e continua visível exatamente para os três perfis da matriz linha 41 (`administrador`, `gestor`, `diretoria`) — caso `menu-rbac.test.ts`. Nenhuma alteração de `/admin/auditoria` é feita nesta onda além dos tokens que o shell/DS já impõe.
28. **As sete dívidas herdadas do Portão 2 da Onda 1 são formalmente redirecionadas para a Onda 6** — ver a tabela da seção "Dívidas herdadas da Onda 1". Nenhuma delas é executada aqui e nenhuma fica órfã.
29. **O CTA do login usa a cor de ação do protótipo.** `Login.tsx` do protótipo pinta "Acessar Sistema" com `#2563EB` e hover `#1844B8`; a variante `default` de `button.tsx` é `bg-primary` (`#3B7FD4`, hover `#265389`) — usá-la perderia a cor do protótipo (Princípio I). Em vez de sobrescrever por `className` (o resultado dependeria da precedência do `tailwind-merge`), `button.tsx` **ganha** a variante `acao`: `bg-action-blue text-white hover:bg-action-blue-strong`. É adição pura ao `cva` (nenhuma variante existente muda), autorizada nominalmente pela decisão 22, e o login passa a usar `variant="acao"`. O teste afere as classes do botão, não a cor computada.
30. **Duas perdas do gate de grupo são corrigidas no próprio menu, para preservar fidelidade à matriz** (nenhuma permissão nova; só recomposição de `permissoesGrupo`/`permissoes` de item):
    - **`faturamento` recupera `Relatórios & SIF` (`/gestao/relatorios`)** — a matriz linha 13 lista `faturamento` como perfil **primário** desse relatório. `FATURAMENTO_GERENCIAR` entra no `permissoesGrupo` de `GESTÃO`; como a permissão só existe para `administrador`, `gestor` e `faturamento`, o gate continua fechado para os demais. Para que a abertura não traga item não atribuído, `/gestao/dashboard` deixa de aceitar `DISPONIBILIDADE_LER` (transversal a 10 dos 11 perfis) e passa a exigir `COMPRAS_PROGRAMADAS_LER`/`PEDIDOS_LER`: `administrador`, `gestor` e `compras` mantêm o item (todos têm `COMPRAS_PROGRAMADAS_LER`) e `faturamento` não o ganha, exatamente como a matriz linha 8 quer. Resultado: o grupo `GESTÃO` de `faturamento` contém **um** item, `Relatórios & SIF`.
    - **`compras` recupera `Pendências de Overbooking` (`/gestao/overbooking`)** — matriz linha 11 lista `compras` em consulta. `COMPRAS_PROGRAMADAS_GERENCIAR` entra nas `permissoes` do item, coerente com o recurso: uma das decisões da pendência é "compra complementar programada" (v1.1 §6.4). Detentores: `administrador`, `gestor`, `compras` — os três atribuídos pela matriz, sem efeito colateral. Aqui a perda era de **item**, não de grupo (`compras` já vê `GESTÃO`).

    Trade-offs registrados: (i) `faturamento` deixa de ser idêntico à persona do protótipo (`visibleGroups: ["FATURAMENTO"]`) e passa a `[GESTÃO, FATURAMENTO]` — divergência autorizada na decisão 11, pelo mesmo critério já aceito para o `gestor` (RBAC canônico + matriz prevalecem sobre o simulador, que o DoD manda remover), e limitada a um único item de leitura; (ii) a rota de entrada de `faturamento` continuaria correta apenas porque a decisão 26 passou a usar o "grupo de trabalho" — sem esse refinamento, `faturamento` entraria em `Relatórios & SIF`; (iii) o estreitamento de `/gestao/dashboard` não tira o item de ninguém que o tenha hoje pelo gate de grupo. Efeito líquido: as divergências contra a matriz caem de 28 para 26, e nenhuma nova é criada.
31. **Itens que o menu mostra sem que a matriz nomeie o perfil também são declarados** (a auditoria do Portão 1 recalcula os dois lados, não só as perdas). Ocorrem em dois perfis, ambos **sem persona no protótipo** — logo sem divergência visual a conciliar:
    - `compras` (11): `/comercial/clientes`, `/comercial/pedidos`, `/comercial/disponibilidade`, `/comercial/espelho`, `/gestao/dashboard`, `/gestao/aprovacoes`, `/gestao/relatorios`, `/cadastros/representantes`, `/cadastros/produtos`, `/cadastros/rotas`, `/cadastros/regras-transformacao`.
    - `diretoria` (3): `/comercial/clientes`, `/comercial/pedidos`, `/comercial/espelho`.

    Todos decorrem de permissões que o **catálogo real** (doc 013) concede ao perfil — `PEDIDOS_LER`, `COMPRAS_PROGRAMADAS_LER`, `DIVERGENCIA_RECEBIMENTO_GERENCIAR`, `LEITURA_CADASTROS` —, e a coluna "Perfis RBAC" da matriz nomeia os donos do fluxo de cada tela, não uma lista negativa exaustiva. Nenhum deles abre escrita: o RBAC do backend continua sendo o guarda do dado. Retirá-los exigiria remover permissão do catálogo, o que esta onda não pode fazer. A Onda 3 concilia catálogo × matriz de uma vez. O conjunto é **pinado por teste**: qualquer item extra novo falha o `menu-rbac.test.ts`.

## Dívidas herdadas da Onda 1 — fora do escopo desta onda, com destino nomeado

O Portão 2 da Onda 1 (veredito `22d3f51`, `docs/execucao/GATE-VEREDITOS.md`) aceitou sete ressalvas com a anotação "resolver na Onda 2". Todas pertencem ao **módulo NF/Recebimento** — domínio da **Onda 6 (Recebimento & Balança)** —, enquanto a Onda 2 é transversal (shell + DS) e não altera backend nem BFF de domínio. Redirecionamento formalizado aqui (decisão 28) e a ser homologado no Portão 1 desta onda:

| # | Dívida | Natureza | Destino | Por que não nesta onda |
|---|---|---|---|---|
| (h) | `mesclarPayloadNfCabecalho(..., true)` incondicional carimba `cabecalho_sem_itens: true` em NF **que tem** itens; correto é `marcarCabecalhoSemItens = (itensAtivos === 0)` | Backend — `nota-fiscal-fornecedor.persistence.ts` | **Onda 6**, no mapa DoD→teste da onda | Atributo de documento fiscal auditável: exige teste de NF com/sem itens e a tela que o consome (Onda 6). Sem leitor hoje (verificado no veredito), logo sem urgência funcional |
| (a) | Gate ACMR de cobertura por arquivo cobre só `app/backend/src/**/*.service.ts` (`scripts/check-coverage-lib.mjs:20`), deixando 458 L de regra de NF fora | CI/gate transversal | **Onda 6**, junto de (h), como o veredito determinou | Estender o glob torna `nota-fiscal-fornecedor.persistence.ts` sujeito a ≥80%; fechar isso é escrever teste de regra de NF — trabalho de domínio, não de shell/DS |
| (b) | Nenhuma tela consome `POST /pedidos-fornecedor/[id]/nf` nem `/conferencia/concluir`: captura dos itens da NF em tela | Frontend de domínio | **Onda 6** | É a tela de Recebimento de Carga da Onda 6; construí-la aqui violaria a proibição de implementar tela de domínio das Ondas 3–10 |
| (c) | `buscarCabecalhoParaCompletar` renumera o cabeçalho órfão silenciosamente (audita o UPDATE, mas não sinaliza a troca) | Backend | **Onda 6** | Decidir entre bloquear, exigir confirmação ou registrar ocorrência é regra de negócio de recebimento (RA-01) |
| (d) | `completarCabecalhoComItensNaTx` sem `SELECT … FOR UPDATE`: dois `registrarNf` concorrentes podem completar o mesmo órfão | Backend (concorrência) | **Onda 6** | Exige teste de concorrência com Postgres e o contexto transacional da conferência (RA-02) |
| (e) | `app/api/operacao/recebimentos/[id]/nf/route.ts` duplica `[id]/nfe/route.ts` sem consumidor | Frontend (BFF de domínio) | **Onda 6** | Remover a rota junto do reaproveitamento do contrato na tela que a substitui evita mexer duas vezes no mesmo módulo |
| (f) | `lib/operacao.ts:83` declara `nfeVolumes: string \| null`, backend devolve `number` | Frontend (contrato de domínio) | **Onda 6** | O acerto de tipo vem com a tela que lê o campo; alterar o contrato sem consumidor é mudança não verificável nesta onda |

Obrigação processual: o Executor registra este redirecionamento nas observações de `EXECUCAO-STATUS.md` e o **plano tático da Onda 6 precisa conter as sete linhas acima no seu mapa DoD→teste** — o Portão 1 da Onda 6 verifica isso. Nenhum Worker desta onda toca nesses arquivos.

## Referências do protótipo

Protótipo: `F:\Projetos\alpha-carnes-prototipo`, branch `feature/completude-v1.1`.

| Tela/artefato tocado nesta onda | Arquivo-fonte no protótipo | Uso nesta onda |
|---|---|---|
| Paleta / tokens | `src/imports/──PaletaDeCores──/index.tsx` | as 14 entradas canônicas (nome + hex) que viram tokens |
| Shell — sidebar, grupos, colapso, header, breadcrumb | `src/app/components/Layout.tsx` (`ALL_NAV_GROUPS`, `NavGroup`, `getBreadcrumb`, `<aside>`/`<header>`) | ordem/rótulos/rotas dos 9 grupos e 39 itens, gradiente `#1E3A5F→#1B4E9B`, alturas (item 34px, header 56px, sidebar 256px), tipografia (grupo 10px bold uppercase tracking-widest; item 13px medium), animação de colapso (max-height 220ms, chevron `-rotate-90` fechado), breadcrumb "Grupo / Item" |
| Shell — simulador de perfil | `src/app/components/Layout.tsx` (`PROFILES`, `PROFILE_ORDER`, bloco "SIMULAR PERFIL") | **referência negativa**: não portar; substituído por RBAC real |
| `/login` | `src/app/pages/Login.tsx` | estrutura 45%/55%, painel institucional, microcopy, campos, botão "Acessar Sistema", chip de ambiente |
| `PipelineBar` | `src/app/components/PipelineBar.tsx` | 4 etapas, contadores, estados passado/atual/futuro, separador `ChevronRight` |
| Base do modal Troca de Peça | `src/app/components/TrocaPeca.tsx` | chrome do wizard (título `ArrowLeftRight` + "Trocar Peça", "Passo N de 6 · <título>", barra de 6 segmentos, rodapé, painel de sucesso com etiqueta e histórico), `STEP_TITULOS` |
| Badge `Provisório` | `src/app/pages/RegraDesdobramento.tsx` (`BadgeProvisorio`), `src/app/pages/CompraProgramada.tsx`, `src/app/pages/Parametros.tsx`, `src/app/pages/Operacoes.tsx`, `src/app/pages/DesossaPesagem.tsx` | forma canônica: `span` âmbar com `AlertTriangle`, `title` explicativo, `cursor-help`, `whitespace-nowrap` |
| `StatusPill` (local no protótipo) | `src/app/pages/LiberacaoCaminhao.tsx` | pílula com ponto colorido, 10px bold, `rounded-full` — alvo do alinhamento do componente do DS |
| Violeta de destaque (`#8B5CF6`) | `src/app/pages/Disponibilidade.tsx`, `src/app/pages/RegraDesdobramento.tsx`, `src/app/pages/Usuarios.tsx` | origem do token `--color-violet-accent`, usado por `regras-transformacao-client.tsx` |
| Screenshots de referência | `src/imports/01-login.png`, `src/imports/02-dashboard.png` | fixture de comparação do shell/login (Task 8) |

## Estrutura de arquivos

```text
app/frontend/src/
  app/globals.css                                   # + tokens da paleta completa (única fonte de cor)
  app/(admin)/layout.tsx                            # header/sidebar por tokens; identidade sem dado inventado
  app/(admin)/page.tsx                              # NOVO — rota `/`: entra pela rota visível do perfil (decisão 26)
  app/(admin)/gestao/operacoes/page.tsx             # NOVO placeholder (rota do menu; tela real = Onda 5)
  app/(admin)/gestao/overbooking/page.tsx           # NOVO placeholder (rota do menu; tela real = Onda 5)
  app/(admin)/gestao/dashboard/dashboard-client.tsx # só o texto do h1 → "Painel Geral da Operação" (decisão 5)
  app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx  # hex → token
  app/(auth)/login/page.tsx                         # painel institucional fiel, tokens, chip de ambiente
  app/(auth)/login/login-form-client.tsx            # microcopy/rótulos do protótipo, JWT real intacto
  components/ui/app-sidebar.tsx                     # gradiente por token, rodapé de identidade real, estado vazio
  components/ui/nav-group.tsx                        # colapso com animação do protótipo
  components/ui/nav-item.tsx                        # item 34px/13px por tokens
  components/ui/admin-header.tsx                     # breadcrumb + identidade real (sem "Escopo" inventado)
  components/ui/activity-item.tsx                    # hex/rgba → tokens
  components/ui/button.tsx                           # + variante `acao` (token de ação do protótipo, decisão 29)
  components/ui/badge-provisorio.tsx                 # NOVO — badge + catálogo das pendências abertas
  components/ui/pipeline-bar.tsx                     # NOVO — porte do PipelineBar
  components/ui/troca-peca-modal.tsx                 # NOVO — base visual do wizard (sem regra de negócio)
  lib/menu-v2.ts                                     # 9 grupos × 39 itens + permissoesGrupo + rotaDeEntrada
  lib/perfis.ts                                      # NOVO — rótulos canônicos dos 11 perfis
app/frontend/__tests__/
  tokens-ds.test.ts                                  # NOVO — zero hex fora de globals.css + paleta completa
  menu-v2.test.ts                                    # NOVO — 9 grupos/39 itens, ordem e rótulos do protótipo
  menu-rbac.test.ts                                  # NOVO — visibilidade por perfil real (snapshot do backend)
  app-sidebar.test.tsx                               # NOVO — gradiente, identidade, estado vazio, sem simulador
  nav-group.test.tsx                                 # NOVO — colapso/expansão e abertura por item ativo
  admin-header.test.tsx                              # NOVO — breadcrumb Grupo / Item
  entrada.test.tsx                                   # NOVO — rota `/`: redirect por perfil e aviso explícito
  badge-provisorio.test.tsx                          # NOVO — title cita pendência; catálogo sem pendência fechada
  pipeline-bar.test.tsx                              # NOVO — estados passado/atual/futuro e contadores
  troca-peca-modal.test.tsx                          # NOVO — chrome do wizard e painel de sucesso
  status-pill.test.tsx                               # NOVO — 6 variantes e rótulos
  kpi-card.test.tsx                                  # NOVO — valor, tendência e variantes
  alert-item.test.tsx                                # NOVO — título/descrição/hora + pílula
  login.test.tsx                                     # ESTENDIDO — microcopy e botão do protótipo
  perfis.test.ts                                     # NOVO — rótulos dos 11 perfis, chave desconhecida preservada
app/frontend/e2e/
  shell-ds.spec.ts                                   # NOVO — asserções do shell + screenshots de evidência
  telas-reais.spec.ts, telas-migradas.spec.ts        # só o título do dashboard nas asserções (decisão 5)
  jornada-operacional.spec.ts                        # título do dashboard + CTA "Acessar Sistema" (decisões 5 e 20)
app/backend/
  scripts/gerar-snapshot-perfis.ts                   # NOVO — gera o snapshot do catálogo RBAC
  src/common/rbac/perfil-permissoes.snapshot.json    # NOVO — fixture versionada (gerada, nunca editada à mão)
  test/unit/perfil-permissoes-snapshot.spec.ts       # NOVO — snapshot === runtime; 11 perfis
  package.json                                       # + script "rbac:snapshot"
docs/evidencias/onda2-shell/
  01-login.png, 02-shell-dashboard.png, 03-shell-sidebar-9-grupos.png
  referencia-prototipo/01-login-prototipo.png, referencia-prototipo/02-shell-prototipo.png
  README.md                                          # procedimento de captura e critério de comparação
```

## Mapa DoD → teste

DoD da Onda 2 conforme `docs/governance/quality-gates.md` § "Onda 2 — Shell + DS". Cada bullet é decomposto em invariantes com teste nomeado 1:1.

| # | Invariante (DoD) | Teste exato |
|---|---|---|
| 1 | Tokens completos da paleta do protótipo centralizados em `globals.css`/`@theme` | `tokens-ds.test.ts` — `globals.css declara as 14 cores canônicas da paleta do prototipo` |
| 2 | Tokens cobrem também as cores de tela do protótipo usadas pelo shell/DS | `tokens-ds.test.ts` — `globals.css declara os tokens de acao, superficie, login, pipeline e provisorio` |
| 3 | **Zero hex avulso** nas telas (grep) | `tokens-ds.test.ts` — `nenhum literal hexadecimal de cor em src fora de globals.css` |
| 3b | Hex remanescente só em seletor de atributo CSS, com inventário pinado (decisão 23) | `tokens-ds.test.ts` — `hex em seletor de atributo CSS esta restrito ao inventario pinado` |
| 4 | Zero cor opaca fora de token (`rgba` avulso) | `tokens-ds.test.ts` — `nenhum literal rgba em src fora de globals.css` |
| 5 | Sidebar em gradiente | `app-sidebar.test.tsx` — `aplica o gradiente da sidebar pelos tokens do DS`; `e2e/shell-ds.spec.ts` — `sidebar resolve o gradiente 1E3A5F→1B4E9B` |
| 6 | Menu com 9 grupos na ordem do protótipo | `menu-v2.test.ts` — `MENU_V2 tem os 9 grupos na ordem do prototipo` |
| 7 | Rótulos e rotas idênticos ao protótipo (39 itens) | `menu-v2.test.ts` — `MENU_V2 tem os 39 itens com rotulo e rota do prototipo` |
| 8 | Toda rota do menu existe (nenhum item aponta para 404) | `menu-v2.test.ts` — `toda rota do menu tem page.tsx correspondente` |
| 9 | Breadcrumb "Grupo / Item" | `admin-header.test.tsx` — `exibe o breadcrumb Grupo / Item da rota ativa`; `e2e/shell-ds.spec.ts` — `breadcrumb do dashboard e Gestão / Painel Geral da Operação` |
| 10 | Colapso por grupo | `nav-group.test.tsx` — `colapsa e expande o grupo ao clicar no cabecalho`, `o painel de itens declara o mecanismo de colapso do prototipo` e `abre o grupo automaticamente quando um item esta ativo`; `e2e/shell-ds.spec.ts` — `colapso por grupo funciona no shell renderizado` |
| 11 | `visibleGroups` dirigido por RBAC real | `menu-rbac.test.ts` — `visibilidade de grupo por perfil canonico bate com a tabela fixada` (11 casos `it.each`) |
| 12 | RBAC real, **não simulador** | `app-sidebar.test.tsx` — `nao renderiza simulador de perfil`; `tokens-ds.test.ts` — `nenhum residuo do simulador de perfil do prototipo em src` |
| 13 | Fixture de RBAC é o catálogo real do backend | `perfil-permissoes-snapshot.spec.ts` — `snapshot reflete exatamente MAPA_PERFIL_PERMISSOES` e `cobre os 11 perfis canonicos` |
| 14 | Perfil sem grupo elegível não vira tela morta | `menu-rbac.test.ts` — `perfil sem permissao de grupo resulta em zero grupos`; `app-sidebar.test.tsx` — `exibe estado vazio explicito quando nenhum grupo esta liberado` |
| 15 | Identidade do shell sem dado inventado | `app-sidebar.test.tsx` — `nao inventa escopo quando o contrato nao traz representante`; `admin-header.test.tsx` — `nao renderiza chip de escopo`; `perfis.test.ts` — `rotula os 11 perfis canonicos e preserva chave desconhecida` |
| 16 | Componente compartilhado `PipelineBar` portado | `pipeline-bar.test.tsx` — `marca etapa concluida, atual e futura conforme o prototipo` e `exibe contadores por etapa quando informados` |
| 17 | Badge "Provisório" com `title` citando a pendência | `badge-provisorio.test.tsx` — `title cita a pendencia e a referencia do plano mestre` |
| 18 | Badge não sinaliza pendência já fechada por AD | `badge-provisorio.test.tsx` — `catalogo contem so as pendencias abertas P1..P15 sem P2/P4/P13/P14` |
| 19 | Base do modal `TrocaPeca` portada | `troca-peca-modal.test.tsx` — `renderiza o chrome do wizard de 6 passos com o titulo do passo`, `desabilita Voltar no passo 1 e mostra Confirmar Troca no passo 6`, `renderiza o painel de sucesso com nova etiqueta e historico` |
| 20 | Base do modal não implementa regra de negócio | `troca-peca-modal.test.tsx` — `nao decide transicao de passo por conta propria` (avanço só via callback) |
| 21 | `StatusPill` alinhado | `status-pill.test.tsx` — `renderiza as 6 variantes com rotulo canonico e cor por token` |
| 22 | `KpiCard` alinhado | `kpi-card.test.tsx` — `renderiza rotulo, valor, tendencia e variante por token` |
| 23 | `AlertItem` alinhado | `alert-item.test.tsx` — `renderiza titulo, descricao, hora e a pilha de status` |
| 24 | Login fiel ao protótipo (painel institucional + formulário) | `login.test.tsx` — `usa a microcopy e o botao Acessar Sistema do prototipo`; `e2e/shell-ds.spec.ts` — `login exibe painel institucional e formulario fieis` |
| 25 | Login mantém o fluxo JWT real | `login.test.tsx` — `envia credenciais para /api/auth/login e navega apos 200` e `exibe erro explicito quando o backend recusa` |
| 26 | Smoke test de render por componente | suíte `npm run test` no frontend cobrindo os **14** arquivos novos de `__tests__` (`tokens-ds`, `menu-v2`, `menu-rbac`, `app-sidebar`, `nav-group`, `admin-header`, `entrada`, `badge-provisorio`, `pipeline-bar`, `troca-peca-modal`, `status-pill`, `kpi-card`, `alert-item`, `perfis`) mais `login.test.tsx` reescrito — cada componente novo/reescrito tem ao menos um caso de render |
| 27 | Screenshot de shell comparado ao protótipo | `e2e/shell-ds.spec.ts` — `captura evidencias do shell e do login` + `docs/evidencias/onda2-shell/README.md` com o par app × protótipo |
| 28 | Terminologia banida continua ausente | `terminologia.test.ts` (existente) — `strings de UI não contêm o rótulo banido` |
| 29 | Rota de entrada `/` e destino pós-login nunca caem fora do menu do perfil (decisão 26) | `menu-rbac.test.ts` — `rota de entrada por perfil canonico bate com a tabela fixada` (11 casos `it.each`); `entrada.test.tsx` — `redireciona para a rota de entrada do perfil`; `login.test.tsx` — `envia credenciais para /api/auth/login e navega para a rota de entrada` |
| 30 | Perfil sem módulo liberado recebe aviso explícito, não 404 nem redirect para rota morta | `entrada.test.tsx` — `sem modulo liberado exibe aviso explicito sem redirecionar` |
| 31 | Auditoria segue visível exatamente para os perfis da matriz linha 41 (decisão 27) | `menu-rbac.test.ts` — `auditoria fica visivel para administrador, gestor e diretoria (matriz linha 41)` |
| 32 | Efeitos do gate de grupo conferem com o catálogo, **item a item, nos 11 perfis** (decisão 25) | `menu-rbac.test.ts` — `perdas declaradas conferem com o catalogo e a matriz` (11 casos `it.each`, cobrindo as 26 rotas da tabela) e `toda perda declarada e efeito do gate de grupo, nunca do filtro de item` |
| 33 | CTA do login usa a cor de ação do protótipo (decisão 29) | `login.test.tsx` — `botao Acessar Sistema usa a variante de acao do DS` |
| 34 | Correções da decisão 30 restauram os itens que a matriz atribui ao perfil primário | `menu-rbac.test.ts` — `faturamento ve Relatorios & SIF e nada mais em GESTÃO (matriz linha 13)` e `compras ve Pendencias de Overbooking (matriz linha 11)` |
| 35 | Itens visíveis sem atribuição na matriz ficam pinados (decisão 31) | `menu-rbac.test.ts` — `itens visiveis sem atribuicao na matriz conferem com a lista declarada` (11 casos `it.each`) |
| 36 | Microcopy do Painel Geral alinhada ao protótipo (decisão 5) | `e2e/shell-ds.spec.ts` — `captura evidencias do shell e do login` (heading `Painel Geral da Operação`) |

## Task 1 — Tokens da paleta e erradicação do hex avulso

**Files:** `app/frontend/src/app/globals.css`, `components/ui/app-sidebar.tsx`, `components/ui/activity-item.tsx`, `app/(admin)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx`, `__tests__/tokens-ds.test.ts`.

Origem de cada token novo (nenhuma cor inventada):

| Token | Hex | Origem no protótipo |
|---|---|---|
| `--color-brand-navy` | `#265389` | `──PaletaDeCores──` `brand/navy` |
| `--color-brand-navy-hover` | `#1E4070` | `──PaletaDeCores──` `brand/navy-hover` |
| `--color-brand-navy-10` | `#E8EEF5` | `──PaletaDeCores──` `brand/navy-10` |
| `--color-brand-blue-mid` | `#3B7FD4` | `──PaletaDeCores──` `brand/blue-mid` |
| `--color-action-blue` | `#2563EB` | `Login.tsx` botão/checkbox; `PipelineBar.tsx` etapa atual |
| `--color-action-blue-hover` | `#1D4ED8` | `TrocaPeca.tsx` hover de "Confirmar Troca" |
| `--color-action-blue-strong` | `#1844B8` | `Login.tsx` hover do botão e do link |
| `--color-action-blue-bg` | `#EFF6FF` | `TrocaPeca.tsx` aviso de impacto; `Layout.tsx` avatar do header |
| `--color-action-blue-border` | `#BFDBFE` | `TrocaPeca.tsx` borda do aviso |
| `--color-action-blue-text` | `#1E3A8A` | `TrocaPeca.tsx` texto do aviso |
| `--color-surface-subtle` | `#F8FAFC` | `TrocaPeca.tsx` blocos de resumo |
| `--color-surface-chip` | `#F0EFF5` | `Login.tsx` chip de ambiente; `PipelineBar.tsx` contador |
| `--color-border-chip` | `#E5E3ED` | `Login.tsx` bordas; `PipelineBar.tsx` moldura |
| `--color-text-strong` | `#1E293B` | `TrocaPeca.tsx` textos fortes |
| `--color-text-slate` | `#475569` | `TrocaPeca.tsx` textos secundários densos |
| `--color-text-graphite` | `#374151` | `TrocaPeca.tsx` rótulos de formulário |
| `--color-login-panel` | `#1F2633` | `Login.tsx` painel institucional |
| `--color-login-panel-caption` | `#70748C` | `Login.tsx` "Sistema Integrado" |
| `--color-login-panel-text` | `#B0B4BD` | `Login.tsx` subtítulo do painel |
| `--color-login-heading` | `#1F1D2D` | `Login.tsx` títulos do formulário |
| `--color-login-text` | `#6B7081` | `Login.tsx` textos auxiliares; `PipelineBar.tsx` etapa neutra |
| `--color-pipeline-done` | `#10B981` | `PipelineBar.tsx` etapa concluída |
| `--color-pipeline-future` | `#A1A5B3` | `PipelineBar.tsx` etapa futura |
| `--color-provisorio-bg` | `#FEF3C7` | `RegraDesdobramento.tsx` badge |
| `--color-provisorio-text` | `#92400E` | `RegraDesdobramento.tsx` badge |
| `--color-provisorio-border` | `#FDE68A` | `RegraDesdobramento.tsx` badge |
| `--color-success-strong` | `#15803D` | `TrocaPeca.tsx` / `LiberacaoCaminhao.tsx` |
| `--color-success-surface` | `#F0FDF4` | `TrocaPeca.tsx` / `LiberacaoCaminhao.tsx` |
| `--color-danger-strong` | `#DC2626` | `TrocaPeca.tsx` "Será invalidada" |
| `--color-danger-surface` | `#FFF1F2` | `TrocaPeca.tsx` "Será invalidada" |
| `--color-violet-accent` | `#8B5CF6` | `Disponibilidade.tsx`, `RegraDesdobramento.tsx`, `Usuarios.tsx` |
| `--color-violet-surface` | `#F5F3FF` | `TrocaPeca.tsx` destaque violeta |
| `--color-sidebar-popover` | `#0F2645` | `Layout.tsx` popover da sidebar |
| `--color-avatar-blue-bg` … `--color-avatar-amber-bg` | `rgba(...,0.14)` | opacidade 14% sobre `status/recebido`, `status/pesado`, `status/aceite`, `status/pendente` da paleta (uso atual de `activity-item.tsx`) |

- [ ] Teste primeiro — criar `app/frontend/__tests__/tokens-ds.test.ts`:

```typescript
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS = join('src', 'app', 'globals.css');
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

/**
 * Hex dentro de seletor de atributo CSS (ex.: `[stroke='#ccc']`) não é cor aplicada:
 * é o valor que a biblioteca de terceiro escreve no atributo e que o seletor precisa
 * casar literalmente. Critério global e sintático — decisão 23, sem exceção por path.
 */
const SELETOR_ATRIBUTO = /\[[a-zA-Z-]+=['"]#[0-9a-fA-F]{3,8}['"]\]/g;

function semSeletoresDeAtributo(texto: string): string {
  return texto.replace(SELETOR_ATRIBUTO, '');
}

function caminhoPosix(file: string): string {
  return file.split('\\').join('/');
}

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fontes(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function folhas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return folhas(path);
    return entry.name.endsWith('.css') && path !== GLOBALS ? [path] : [];
  });
}

function literaisDeCor(file: string, padrao: RegExp): string[] {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    const ehTexto =
      ts.isStringLiteralLike(node) ||
      ts.isJsxText(node) ||
      ts.isTemplateExpression(node) ||
      ts.isNoSubstitutionTemplateLiteral(node);
    if (ehTexto && padrao.test(semSeletoresDeAtributo(node.getText(sf)))) {
      hits.push(`${caminhoPosix(file)}:${sf.getLineAndCharacterOfPosition(node.pos).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('tokens do DS', () => {
  const globals = readFileSync(GLOBALS, 'utf8');

  it('globals.css declara as 14 cores canônicas da paleta do prototipo', () => {
    const paleta: [string, string][] = [
      ['--color-brand-navy', '#265389'],
      ['--color-brand-navy-hover', '#1E4070'],
      ['--color-brand-blue-mid', '#3B7FD4'],
      ['--color-brand-navy-10', '#E8EEF5'],
      ['--color-background', '#F5F7FA'],
      ['--color-foreground', '#1A2332'],
      ['--color-text-secondary', '#64748B'],
      ['--color-text-muted', '#94A3B8'],
      ['--color-status-expedido', '#18A84A'],
      ['--color-status-divergencia', '#F5B019'],
      ['--color-status-bloqueado', '#FC5241'],
      ['--color-status-recebido', '#3B7FD4'],
      ['--color-status-pesado', '#7C3AED'],
      ['--color-border', '#E2E8F0'],
    ];
    const ausentes = paleta.filter(([token, hex]) => !globals.includes(`${token}: ${hex};`));
    expect(ausentes).toEqual([]);
  });

  it('globals.css declara os tokens de acao, superficie, login, pipeline e provisorio', () => {
    const tokens = [
      '--color-action-blue', '--color-action-blue-hover', '--color-action-blue-strong',
      '--color-action-blue-bg', '--color-action-blue-border', '--color-action-blue-text',
      '--color-surface-subtle', '--color-surface-chip', '--color-border-chip',
      '--color-text-strong', '--color-text-slate', '--color-text-graphite',
      '--color-login-panel', '--color-login-panel-caption', '--color-login-panel-text',
      '--color-login-heading', '--color-login-text',
      '--color-pipeline-done', '--color-pipeline-future',
      '--color-provisorio-bg', '--color-provisorio-text', '--color-provisorio-border',
      '--color-success-strong', '--color-success-surface',
      '--color-danger-strong', '--color-danger-surface',
      '--color-violet-accent', '--color-violet-surface',
      '--color-sidebar-popover',
      '--color-avatar-blue-bg', '--color-avatar-violet-bg',
      '--color-avatar-green-bg', '--color-avatar-amber-bg',
    ];
    expect(tokens.filter((token) => !globals.includes(`${token}:`))).toEqual([]);
  });

  it('nenhum literal hexadecimal de cor em src fora de globals.css', () => {
    const hits = fontes('src').flatMap((file) => literaisDeCor(file, HEX));
    expect(hits).toEqual([]);
  });

  it('nenhum literal rgba em src fora de globals.css', () => {
    const hits = fontes('src').flatMap((file) => literaisDeCor(file, /rgba?\(/));
    expect(hits).toEqual([]);
  });

  it('hex em seletor de atributo CSS esta restrito ao inventario pinado', () => {
    const inventario: Record<string, string[]> = {};
    for (const file of fontes('src')) {
      const seletores = readFileSync(file, 'utf8').match(SELETOR_ATRIBUTO);
      if (seletores) inventario[caminhoPosix(file)] = seletores;
    }
    expect(inventario).toEqual({
      'src/components/ui/chart.tsx': [
        "[stroke='#ccc']",
        "[stroke='#ccc']",
        "[stroke='#ccc']",
        "[stroke='#fff']",
        "[stroke='#fff']",
      ],
    });
  });

  it('globals.css e a unica folha de estilo do frontend', () => {
    expect(folhas('src')).toEqual([]);
  });

  it('nenhum residuo do simulador de perfil do prototipo em src', () => {
    const hits = fontes('src').filter((file) =>
      /SIMULAR PERFIL|PROFILE_ORDER|activeProfile/.test(readFileSync(file, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- tokens-ds`.
Expected: FAIL nos casos de token ausente e nos dois casos de hex/rgba (5 arquivos hoje têm literal de **cor aplicada**). O caso `hex em seletor de atributo CSS esta restrito ao inventario pinado` já passa desde o início — `chart.tsx` não é editado nesta onda (decisão 23); se ele falhar, alguém acrescentou seletor com hex e o Worker deve parar e reportar.

- [ ] Adicionar os tokens em `src/app/globals.css`, dentro do bloco `@theme` existente, imediatamente antes do comentário `/* Raios */`:

```css
  /* Paleta canônica do protótipo — src/imports/──PaletaDeCores──/index.tsx */
  --color-brand-navy: #265389;
  --color-brand-navy-hover: #1E4070;
  --color-brand-navy-10: #E8EEF5;
  --color-brand-blue-mid: #3B7FD4;

  /* Ações — Login.tsx / PipelineBar.tsx / TrocaPeca.tsx */
  --color-action-blue: #2563EB;
  --color-action-blue-hover: #1D4ED8;
  --color-action-blue-strong: #1844B8;
  --color-action-blue-bg: #EFF6FF;
  --color-action-blue-border: #BFDBFE;
  --color-action-blue-text: #1E3A8A;

  /* Superfícies, bordas e textos densos do protótipo */
  --color-surface-subtle: #F8FAFC;
  --color-surface-chip: #F0EFF5;
  --color-border-chip: #E5E3ED;
  --color-text-strong: #1E293B;
  --color-text-slate: #475569;
  --color-text-graphite: #374151;

  /* Login — painel institucional (Login.tsx) */
  --color-login-panel: #1F2633;
  --color-login-panel-caption: #70748C;
  --color-login-panel-text: #B0B4BD;
  --color-login-heading: #1F1D2D;
  --color-login-text: #6B7081;

  /* PipelineBar */
  --color-pipeline-done: #10B981;
  --color-pipeline-future: #A1A5B3;

  /* Badge "Provisório" (RegraDesdobramento.tsx) */
  --color-provisorio-bg: #FEF3C7;
  --color-provisorio-text: #92400E;
  --color-provisorio-border: #FDE68A;

  /* Sinalizações densas (TrocaPeca.tsx, LiberacaoCaminhao.tsx, Disponibilidade.tsx) */
  --color-success-strong: #15803D;
  --color-success-surface: #F0FDF4;
  --color-danger-strong: #DC2626;
  --color-danger-surface: #FFF1F2;
  --color-violet-accent: #8B5CF6;
  --color-violet-surface: #F5F3FF;

  /* Popover da sidebar (Layout.tsx) */
  --color-sidebar-popover: #0F2645;

  /* Avatares de atividade — 14% sobre a paleta de status */
  --color-avatar-blue-bg: rgba(59, 127, 212, 0.14);
  --color-avatar-violet-bg: rgba(124, 58, 237, 0.14);
  --color-avatar-green-bg: rgba(24, 168, 74, 0.14);
  --color-avatar-amber-bg: rgba(245, 176, 25, 0.14);
```

- [ ] Substituir o gradiente literal em `src/components/ui/app-sidebar.tsx` (linha 103) pela versão por token — o restante do arquivo é reescrito na Task 2/3:

```tsx
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end">
```

- [ ] Reescrever a paleta de avatar em `src/components/ui/activity-item.tsx`:

```tsx
const AVATAR_PALETTE = [
  { bg: 'var(--color-avatar-blue-bg)', text: 'var(--color-status-recebido)' },
  { bg: 'var(--color-avatar-violet-bg)', text: 'var(--color-status-pesado)' },
  { bg: 'var(--color-avatar-green-bg)', text: 'var(--color-status-expedido)' },
  { bg: 'var(--color-avatar-amber-bg)', text: 'var(--color-status-divergencia)' },
] as const;

function avatarColors(initials: string): { bg: string; text: string } {
  const index = initials.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? AVATAR_PALETTE[0];
}
```

- [ ] Trocar o fundo literal por classe de token em `src/app/(admin)/layout.tsx` (as duas ocorrências de `style={{ background: '#F5F7FA' }}`):

```tsx
    <div className="flex min-h-screen bg-background">
```

```tsx
        <main className="flex-1 bg-background p-4">
```

- [ ] Em `src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx`, substituir as quatro ocorrências de `#8B5CF6` pelo token:

```tsx
          <Card className="h-full rounded-xl border-border border-t-4 border-t-violet-accent shadow-sm">
```

```tsx
                <Calculator className="h-5 w-5 text-violet-accent" />
```

```tsx
                <p className="text-xs font-bold uppercase tracking-wider text-violet-accent">Resultado estimado</p>
```

```tsx
                          <span className="font-bold text-violet-accent">{resultado}</span>
```

- [ ] As cores literais de `src/app/(auth)/login/page.tsx` são eliminadas na Task 7 (reescrita do login). Até lá, o caso `nenhum literal hexadecimal de cor em src fora de globals.css` fica vermelho; esta Task fecha os demais.

- [ ] Run: `cd app/frontend && npm run test -- tokens-ds`.
Expected: todos os casos PASS, exceto `nenhum literal hexadecimal de cor em src fora de globals.css`, que lista apenas `src/app/(auth)/login/page.tsx` (fechado na Task 7). Registrar a saída no relatório.

- [ ] Run: `cd app/frontend && npm run lint && npm run type-check` → exit 0.
- [ ] Commit previsto: `feat(onda2): tokens da paleta do prototipo e remocao de hex avulso`

## Task 2 — Menu de 9 grupos, sidebar em gradiente, breadcrumb e colapso

**Files:** `src/lib/menu-v2.ts`, `src/components/ui/app-sidebar.tsx`, `src/components/ui/nav-group.tsx`, `src/components/ui/nav-item.tsx`, `src/app/(admin)/gestao/operacoes/page.tsx`, `src/app/(admin)/gestao/overbooking/page.tsx`, `__tests__/menu-v2.test.ts`, `__tests__/nav-group.test.tsx`, `__tests__/admin-header.test.tsx`.

- [ ] Teste primeiro — `app/frontend/__tests__/menu-v2.test.ts`:

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_V2 } from '../src/lib/menu-v2';

const GRUPOS = [
  'COMERCIAL',
  'GESTÃO',
  'RECEBIMENTO & BALANÇA',
  'DESOSSA',
  'ESTOQUE',
  'CARGA',
  'FATURAMENTO',
  'CADASTROS & REGRAS',
  'ADMINISTRAÇÃO',
];

/** ALL_NAV_GROUPS de src/app/components/Layout.tsx do protótipo (feature/completude-v1.1). */
const ITENS_PROTOTIPO: [string, string, string][] = [
  ['COMERCIAL', 'Clientes', '/comercial/clientes'],
  ['COMERCIAL', 'Pedidos de Venda', '/comercial/pedidos'],
  ['COMERCIAL', 'Tabela de Preços', '/comercial/tabela-precos'],
  ['COMERCIAL', 'Disponibilidade', '/comercial/disponibilidade'],
  ['COMERCIAL', 'Espelho Comercial', '/comercial/espelho'],
  ['GESTÃO', 'Painel Geral da Operação', '/gestao/dashboard'],
  ['GESTÃO', 'Operações', '/gestao/operacoes'],
  ['GESTÃO', 'Compras', '/gestao/compras'],
  ['GESTÃO', 'Pendências de Overbooking', '/gestao/overbooking'],
  ['GESTÃO', 'Aprovações & Ocorrências', '/gestao/aprovacoes'],
  ['GESTÃO', 'Relatórios & SIF', '/gestao/relatorios'],
  ['RECEBIMENTO & BALANÇA', 'Recebimento de Carga', '/recebimento/recebimento-carga'],
  ['RECEBIMENTO & BALANÇA', 'Pesagem e Destinação', '/recebimento/pesagem-destinacao'],
  ['RECEBIMENTO & BALANÇA', 'Etiquetas', '/recebimento/etiquetas'],
  ['DESOSSA', 'Dashboard da Desossa', '/desossa/dashboard'],
  ['DESOSSA', 'Pesagem e Destinação', '/desossa/pesagem-destinacao'],
  ['DESOSSA', 'Etiquetas', '/desossa/etiquetas'],
  ['ESTOQUE', 'Consulta de Estoque', '/estoque/consulta'],
  ['ESTOQUE', 'Entrada de Itens', '/estoque/entrada-itens'],
  ['ESTOQUE', 'Ajustes', '/estoque/ajustes'],
  ['CARGA', 'Planejamento de Carga', '/carga/planejamento'],
  ['CARGA', 'Conferência', '/carga/conferencia'],
  ['CARGA', 'Enviar para Faturamento', '/carga/enviar-faturamento'],
  ['FATURAMENTO', 'Pré-Faturamento', '/faturamento/pre-faturamento'],
  ['FATURAMENTO', 'Notas / XML', '/faturamento/notas-xml'],
  ['FATURAMENTO', 'Seguro Manual', '/faturamento/seguro-manual'],
  ['FATURAMENTO', 'Liberação do Caminhão', '/faturamento/liberacao'],
  ['CADASTROS & REGRAS', 'Representantes', '/cadastros/representantes'],
  ['CADASTROS & REGRAS', 'Produtos', '/cadastros/produtos'],
  ['CADASTROS & REGRAS', 'Fornecedores / Frigoríficos', '/cadastros/fornecedores'],
  ['CADASTROS & REGRAS', 'Caminhões', '/cadastros/caminhoes'],
  ['CADASTROS & REGRAS', 'Motoristas', '/cadastros/motoristas'],
  ['CADASTROS & REGRAS', 'Rotas / Itinerários', '/cadastros/rotas'],
  ['CADASTROS & REGRAS', 'Regras de Transformação', '/cadastros/regras-transformacao'],
  ['CADASTROS & REGRAS', 'Modelos de Etiqueta', '/cadastros/modelos-etiqueta'],
  ['ADMINISTRAÇÃO', 'Usuários', '/admin/usuarios'],
  ['ADMINISTRAÇÃO', 'Perfis de Acesso', '/admin/perfis'],
  ['ADMINISTRAÇÃO', 'Parâmetros', '/admin/parametros'],
  ['ADMINISTRAÇÃO', 'Auditoria', '/admin/auditoria'],
];

describe('menu canônico v2', () => {
  it('MENU_V2 tem os 9 grupos na ordem do prototipo', () => {
    expect(MENU_V2.map((g) => g.title)).toEqual(GRUPOS);
  });

  it('MENU_V2 tem os 39 itens com rotulo e rota do prototipo', () => {
    const atual = MENU_V2.flatMap((g) => g.items.map((i) => [g.title, i.label, i.href]));
    expect(atual).toEqual(ITENS_PROTOTIPO);
    expect(atual).toHaveLength(39);
  });

  it('todo grupo declara ao menos uma permissao de grupo e todo item ao menos uma permissao', () => {
    for (const grupo of MENU_V2) {
      expect(grupo.permissoesGrupo.length).toBeGreaterThan(0);
      for (const item of grupo.items) {
        expect(item.permissoes.length).toBeGreaterThan(0);
      }
    }
  });

  it('toda rota do menu tem page.tsx correspondente', () => {
    const semRota = MENU_V2.flatMap((g) => g.items)
      .map((i) => i.href)
      .filter((href) => !existsSync(join('src', 'app', '(admin)', ...href.slice(1).split('/'), 'page.tsx')));
    expect(semRota).toEqual([]);
  });
});
```

- [ ] Teste primeiro — `app/frontend/__tests__/nav-group.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutDashboard } from 'lucide-react';
import { NavGroup } from '../src/components/ui/nav-group';

const mockPathname = jest.fn(() => '/comercial/clientes');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const itens = [
  { href: '/gestao/dashboard', label: 'Painel Geral da Operação', Icon: LayoutDashboard },
  { href: '/gestao/compras', label: 'Compras', Icon: LayoutDashboard },
];

/**
 * O colapso do protótipo mantém os itens montados e anima `max-height` (220ms) com
 * `overflow-hidden`. `toBeVisible()` do jest-dom não olha `max-height` e o Tailwind não
 * compila no jsdom: um link dentro do painel fechado passaria em `toBeVisible()`. Por isso
 * o teste afere o mecanismo real — `aria-expanded`, `data-state` e a `max-height` inline —,
 * que fica vermelho se o colapso desaparecer. O componente emite unidade (`'0px'` /
 * `` `${alturaItens}px` ``): React serializa `maxHeight: 0` (número) como `"0"` no jsdom,
 * e `.toBe('0px')` / `toHaveStyle({ maxHeight: '0px' })` falhariam.
 */
function painelDe(cabecalho: HTMLElement): HTMLElement {
  const id = cabecalho.getAttribute('aria-controls');
  const painel = id ? document.getElementById(id) : null;
  if (!painel) throw new Error('cabeçalho do grupo não aponta para o painel de itens via aria-controls');
  return painel;
}

describe('NavGroup', () => {
  it('colapsa e expande o grupo ao clicar no cabecalho', async () => {
    mockPathname.mockReturnValue('/comercial/clientes');
    render(<NavGroup title="GESTÃO" items={itens} defaultOpen />);

    const cabecalho = screen.getByRole('button', { name: /GESTÃO/ });
    const painel = painelDe(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(painel).toHaveAttribute('data-state', 'aberto');
    // 2 itens × 36px + 4px, conforme alturaItens do componente
    expect(painel.style.maxHeight).toBe('76px');

    await userEvent.click(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    expect(painel).toHaveAttribute('data-state', 'fechado');
    expect(painel.style.maxHeight).toBe('0px');

    await userEvent.click(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(painel).toHaveAttribute('data-state', 'aberto');
    expect(painel.style.maxHeight).toBe('76px');
  });

  it('o painel de itens declara o mecanismo de colapso do prototipo', () => {
    mockPathname.mockReturnValue('/comercial/clientes');
    render(<NavGroup title="GESTÃO" items={itens} defaultOpen />);

    const painel = painelDe(screen.getByRole('button', { name: /GESTÃO/ }));
    expect(painel.className).toContain('overflow-hidden');
    expect(painel.className).toContain('transition-[max-height]');
    expect(painel.className).toContain('duration-200');
  });

  it('abre o grupo automaticamente quando um item esta ativo', () => {
    mockPathname.mockReturnValue('/gestao/compras');
    render(<NavGroup title="GESTÃO" items={itens} />);
    expect(screen.getByRole('button', { name: /GESTÃO/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('marca o item ativo com aria-current', () => {
    mockPathname.mockReturnValue('/gestao/compras');
    render(<NavGroup title="GESTÃO" items={itens} />);
    expect(screen.getByRole('link', { name: 'Compras' })).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] Teste primeiro — `app/frontend/__tests__/admin-header.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { AdminHeader } from '../src/components/ui/admin-header';

jest.mock('next/navigation', () => ({
  usePathname: () => '/gestao/dashboard',
}));

/**
 * O perfil da fixture é `Administrador` de propósito: com `Gestão` o texto do
 * breadcrumb (`formatMenuGroupTitle('GESTÃO')`) e o valor da meta "Perfil"
 * ficariam idênticos e as consultas por texto casariam dois nós.
 */
const user = { nome: 'Fabrício', perfil: 'Administrador', inicial: 'F' };

describe('AdminHeader', () => {
  it('exibe o breadcrumb Grupo / Item da rota ativa', () => {
    render(<AdminHeader user={user} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Gestão')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Painel Geral da Operação')).toBeInTheDocument();
  });

  it('exibe usuario e perfil reais fora do breadcrumb', () => {
    render(<AdminHeader user={user} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(screen.getByText('Fabrício')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Administrador')).not.toBeInTheDocument();
  });

  it('nao renderiza chip de escopo', () => {
    render(<AdminHeader user={user} />);
    expect(screen.queryByText(/Escopo/)).not.toBeInTheDocument();
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- "menu-v2|nav-group|admin-header"`.
Expected: FAIL — `permissoesGrupo` não existe, rótulos/itens divergem, `AdminHeader` ainda exige `escopo`.

- [ ] Reescrever `src/lib/menu-v2.ts` (interfaces + grupos + filtro). Conteúdo final:

```typescript
/**
 * Menu canônico v2 — estrutura de navegação e mapeamento RBAC.
 * Ordem, rótulos e rotas idênticos a ALL_NAV_GROUPS do protótipo (Layout.tsx).
 * Grupo aparece se o usuário tiver ao menos uma permissão de `permissoesGrupo`
 * (segregação por função, doc 013); item aparece se tiver ao menos uma das suas.
 */

export interface MenuItemDef {
  href: string;
  label: string;
  iconKey: string;
  permissoes: string[];
}

export interface MenuGroupDef {
  title: string;
  permissoesGrupo: string[];
  items: MenuItemDef[];
}

export const MENU_V2: MenuGroupDef[] = [
  {
    title: 'COMERCIAL',
    permissoesGrupo: ['PEDIDOS_LER', 'PEDIDOS_GERENCIAR'],
    items: [
      { href: '/comercial/clientes', label: 'Clientes', iconKey: 'Users', permissoes: ['CLIENTES_LER'] },
      { href: '/comercial/pedidos', label: 'Pedidos de Venda', iconKey: 'ClipboardList', permissoes: ['PEDIDOS_LER', 'PEDIDOS_GERENCIAR'] },
      { href: '/comercial/tabela-precos', label: 'Tabela de Preços', iconKey: 'Tags', permissoes: ['PEDIDOS_GERENCIAR'] },
      { href: '/comercial/disponibilidade', label: 'Disponibilidade', iconKey: 'BarChart3', permissoes: ['DISPONIBILIDADE_LER'] },
      { href: '/comercial/espelho', label: 'Espelho Comercial', iconKey: 'FileSpreadsheet', permissoes: ['PEDIDOS_LER'] },
    ],
  },
  {
    title: 'GESTÃO',
    // FATURAMENTO_GERENCIAR abre o grupo para `faturamento`, primário em Relatórios & SIF (decisão 30)
    permissoesGrupo: [
      'COMPRAS_PROGRAMADAS_GERENCIAR',
      'OPERACOES_GERENCIAR',
      'OVERBOOKING_RESOLVER',
      'EXPEDICAO_REABRIR',
      'FATURAMENTO_GERENCIAR',
    ],
    items: [
      { href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'PEDIDOS_LER'] },
      { href: '/gestao/operacoes', label: 'Operações', iconKey: 'CalendarRange', permissoes: ['OPERACOES_GERENCIAR'] },
      { href: '/gestao/compras', label: 'Compras', iconKey: 'ShoppingCart', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR'] },
      { href: '/gestao/overbooking', label: 'Pendências de Overbooking', iconKey: 'AlertTriangle', permissoes: ['OVERBOOKING_RESOLVER', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'COMPRAS_PROGRAMADAS_GERENCIAR'] },
      { href: '/gestao/aprovacoes', label: 'Aprovações & Ocorrências', iconKey: 'CheckCircle', permissoes: ['DIVERGENCIA_RECEBIMENTO_GERENCIAR', 'EXPEDICAO_REABRIR'] },
      { href: '/gestao/relatorios', label: 'Relatórios & SIF', iconKey: 'PieChart', permissoes: ['DISPONIBILIDADE_LER'] },
    ],
  },
  {
    title: 'RECEBIMENTO & BALANÇA',
    permissoesGrupo: ['RECEBIMENTO_GERENCIAR', 'PESAGEM_GERENCIAR', 'CONFERENCIA_CONCLUIR'],
    items: [
      { href: '/recebimento/recebimento-carga', label: 'Recebimento de Carga', iconKey: 'PackageCheck', permissoes: ['RECEBIMENTO_LER', 'RECEBIMENTO_GERENCIAR'] },
      { href: '/recebimento/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scale', permissoes: ['PESAGEM_LER', 'PESAGEM_GERENCIAR'] },
      { href: '/recebimento/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'PESAGEM_LER'] },
    ],
  },
  {
    title: 'DESOSSA',
    permissoesGrupo: ['CORTE_GERENCIAR', 'DESOSSA_GERENCIAR'],
    items: [
      { href: '/desossa/dashboard', label: 'Dashboard da Desossa', iconKey: 'LayoutDashboard', permissoes: ['DESOSSA_LER', 'CORTE_GERENCIAR'] },
      { href: '/desossa/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scissors', permissoes: ['CORTE_GERENCIAR'] },
      { href: '/desossa/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'CORTE_GERENCIAR'] },
    ],
  },
  {
    title: 'ESTOQUE',
    permissoesGrupo: ['ESTOQUE_LER', 'ESTOQUE_GERENCIAR'],
    items: [
      { href: '/estoque/consulta', label: 'Consulta de Estoque', iconKey: 'Warehouse', permissoes: ['ESTOQUE_LER', 'ESTOQUE_GERENCIAR'] },
      { href: '/estoque/entrada-itens', label: 'Entrada de Itens', iconKey: 'PackagePlus', permissoes: ['ESTOQUE_GERENCIAR'] },
      { href: '/estoque/ajustes', label: 'Ajustes', iconKey: 'SlidersHorizontal', permissoes: ['ESTOQUE_GERENCIAR'] },
    ],
  },
  {
    title: 'CARGA',
    permissoesGrupo: ['EXPEDICAO_GERENCIAR'],
    items: [
      { href: '/carga/planejamento', label: 'Planejamento de Carga', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/conferencia', label: 'Conferência', iconKey: 'ClipboardCheck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/enviar-faturamento', label: 'Enviar para Faturamento', iconKey: 'Send', permissoes: ['EXPEDICAO_GERENCIAR', 'FATURAMENTO_GERENCIAR'] },
    ],
  },
  {
    title: 'FATURAMENTO',
    permissoesGrupo: ['FATURAMENTO_GERENCIAR', 'NFSE_EMITIR'],
    items: [
      { href: '/faturamento/pre-faturamento', label: 'Pré-Faturamento', iconKey: 'FileText', permissoes: ['FATURAMENTO_LER', 'FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/notas-xml', label: 'Notas / XML', iconKey: 'FileCode', permissoes: ['NFSE_EMITIR', 'FATURAMENTO_LER'] },
      { href: '/faturamento/seguro-manual', label: 'Seguro Manual', iconKey: 'ShieldCheck', permissoes: ['FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/liberacao', label: 'Liberação do Caminhão', iconKey: 'DoorOpen', permissoes: ['FATURAMENTO_GERENCIAR', 'EXPEDICAO_GERENCIAR'] },
    ],
  },
  {
    title: 'CADASTROS & REGRAS',
    permissoesGrupo: [
      'CLIENTES_GERENCIAR',
      'PRODUTOS_GERENCIAR',
      'FORNECEDORES_GERENCIAR',
      'REPRESENTANTES_GERENCIAR',
      'ROTAS_GERENCIAR',
      'REGRAS_DESDOBRAMENTO_GERENCIAR',
    ],
    items: [
      { href: '/cadastros/representantes', label: 'Representantes', iconKey: 'UserCircle', permissoes: ['REPRESENTANTES_LER', 'REPRESENTANTES_GERENCIAR'] },
      { href: '/cadastros/produtos', label: 'Produtos', iconKey: 'Package', permissoes: ['PRODUTOS_LER'] },
      { href: '/cadastros/fornecedores', label: 'Fornecedores / Frigoríficos', iconKey: 'Building2', permissoes: ['FORNECEDORES_LER'] },
      { href: '/cadastros/caminhoes', label: 'Caminhões', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/motoristas', label: 'Motoristas', iconKey: 'Contact', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/rotas', label: 'Rotas / Itinerários', iconKey: 'Map', permissoes: ['ROTAS_LER', 'ROTAS_GERENCIAR'] },
      { href: '/cadastros/regras-transformacao', label: 'Regras de Transformação', iconKey: 'GitBranch', permissoes: ['REGRAS_DESDOBRAMENTO_LER', 'CORTE_GERENCIAR'] },
      { href: '/cadastros/modelos-etiqueta', label: 'Modelos de Etiqueta', iconKey: 'Sticker', permissoes: ['ETIQUETA_GERENCIAR'] },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    permissoesGrupo: ['USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR', 'PARAMETROS_GERENCIAR', 'AUDITORIA_VISUALIZAR'],
    items: [
      { href: '/admin/usuarios', label: 'Usuários', iconKey: 'Users', permissoes: ['USUARIOS_LER', 'USUARIOS_GERENCIAR'] },
      { href: '/admin/perfis', label: 'Perfis de Acesso', iconKey: 'Shield', permissoes: ['PERFIS_GERENCIAR'] },
      { href: '/admin/parametros', label: 'Parâmetros', iconKey: 'Settings', permissoes: ['PARAMETROS_GERENCIAR'] },
      { href: '/admin/auditoria', label: 'Auditoria', iconKey: 'ScrollText', permissoes: ['AUDITORIA_VISUALIZAR'] },
    ],
  },
];

export interface MenuGrupoVisivel {
  title: string;
  items: Omit<MenuItemDef, 'permissoes'>[];
}

export function filtrarMenuPorPermissoes(permissoes: string[]): MenuGrupoVisivel[] {
  const concedidas = new Set(permissoes);
  return MENU_V2.filter((group) => group.permissoesGrupo.some((p) => concedidas.has(p)))
    .map((group) => ({
      title: group.title,
      items: group.items
        .filter((item) => item.permissoes.some((p) => concedidas.has(p)))
        .map(({ permissoes: _p, ...rest }) => rest),
    }))
    .filter((group) => group.items.length > 0);
}

/** Destino do protótipo/matriz linha 2 — usado quando visível para o usuário (decisão 26). */
export const ROTA_PREFERENCIAL_ENTRADA = '/gestao/dashboard';

/**
 * Rota de entrada do usuário: a preferencial quando visível, senão a primeira rota do
 * grupo de trabalho — o grupo com mais itens visíveis, empate pela ordem canônica —,
 * senão `null` (nenhum módulo liberado). O grupo de trabalho evita entrar por um grupo
 * que o perfil só enxerga para consulta de um item (decisões 26 e 30).
 * Nunca devolve rota fora do menu do próprio usuário (RA-05).
 */
export function rotaDeEntrada(permissoes: string[]): string | null {
  const grupos = filtrarMenuPorPermissoes(permissoes);
  const temPreferencial = grupos.some((grupo) =>
    grupo.items.some((item) => item.href === ROTA_PREFERENCIAL_ENTRADA),
  );
  if (temPreferencial) return ROTA_PREFERENCIAL_ENTRADA;

  const grupoDeTrabalho = grupos.reduce<MenuGrupoVisivel | null>(
    (maior, grupo) => (maior && maior.items.length >= grupo.items.length ? maior : grupo),
    null,
  );
  return grupoDeTrabalho?.items[0]?.href ?? null;
}
```

- [ ] Criar `src/app/(admin)/gestao/operacoes/page.tsx`:

```tsx
import { PlaceholderPage } from '@/components/placeholder-page';

export default function Page() {
  return <PlaceholderPage title="Operações" />;
}
```

- [ ] Criar `src/app/(admin)/gestao/overbooking/page.tsx`:

```tsx
import { PlaceholderPage } from '@/components/placeholder-page';

export default function Page() {
  return <PlaceholderPage title="Pendências de Overbooking" />;
}
```

- [ ] Alinhar a microcopy do Painel Geral (decisão 5) — em `src/app/(admin)/gestao/dashboard/dashboard-client.tsx:193`, trocar **só** o texto do `<h1>` (nada mais da tela é tocado; a tela de Gestão é da Onda 5):

```tsx
          <h1 className="text-[22px] font-bold text-foreground">Painel Geral da Operação</h1>
```

- [ ] Atualizar as asserções Playwright existentes que afirmam o título antigo, senão a suíte fica vermelha — `e2e/telas-reais.spec.ts:102` e `e2e/telas-migradas.spec.ts:130`:

```typescript
  await expect(page.getByRole('heading', { name: /Painel Geral da Operação/i })).toBeVisible({
```

e `e2e/jornada-operacional.spec.ts:442` e `:447`:

```typescript
    await expect(page.getByRole('heading', { name: 'Painel Geral da Operação' })).toBeVisible({ timeout: 15_000 });
```

```typescript
      'Painel Geral da Operação',
```

- [ ] Reescrever `src/components/ui/nav-group.tsx` com a animação de colapso do protótipo (max-height 220ms, chevron `-rotate-90` quando fechado, `aria-expanded`/`aria-controls`, itens de 34px com gap de 2px). O painel expõe `data-state` porque `max-height` inline é invisível para `toBeVisible()` no jsdom: sem um estado declarado, o colapso não teria como ser aferido:

```tsx
'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NavItem } from './nav-item';

export interface NavGroupItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroupProps {
  title: string;
  items: NavGroupItem[];
  defaultOpen?: boolean;
}

export function NavGroup({ title, items, defaultOpen = false }: NavGroupProps) {
  const idPainel = useId();
  const pathname = usePathname();
  const hasActive = items.some(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
  );
  const [open, setOpen] = useState(defaultOpen || hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // item de 34px + 2px de gap, conforme Layout.tsx do protótipo
  const alturaItens = items.length * 36 + 4;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/hdr mb-1.5 flex w-full items-center justify-between px-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-text-muted transition-colors hover:text-white"
        aria-expanded={open}
        aria-controls={idPainel}
      >
        <span>{title}</span>
        <ChevronDown
          size={12}
          className={cn('shrink-0 transition-transform duration-200', !open && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div
        id={idPainel}
        data-state={open ? 'aberto' : 'fechado'}
        className="overflow-hidden transition-[max-height] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ maxHeight: open ? `${alturaItens}px` : '0px' }}
      >
        <div className="flex w-full flex-col gap-0.5 pb-1">
          {items.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} Icon={item.Icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] Ajustar `src/components/ui/nav-item.tsx` para marcar a rota ativa de forma acessível e usar os tokens da sidebar:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItemProps {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export function NavItem({ href, label, Icon }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-[34px] w-full items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-sidebar-item-active text-white'
          : 'text-sidebar-text hover:bg-sidebar-item-hover hover:text-white',
      )}
    >
      <Icon size={18} strokeWidth={1.5} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
```

- [ ] Em `src/components/ui/app-sidebar.tsx`, acrescentar os dois ícones novos ao import de `lucide-react` e ao `ICON_MAP` — o mesmo par de nomes nos dois blocos, porque `ICON_MAP` usa propriedade abreviada. As listas atuais seguem a ordem do menu, não alfabética: **inserir no fim de cada bloco, sem reordenar o que já existe**:

```tsx
  AlertTriangle,
  CalendarRange,
```

```tsx
  AlertTriangle,
  CalendarRange,
```

- [ ] Ajustar `src/components/ui/admin-header.tsx`: remover `escopo` de `AdminHeaderUser` e o `MetaInline` correspondente. Bloco final da meta-informação:

```tsx
export interface AdminHeaderUser {
  nome: string;
  perfil: string;
  inicial: string;
}
```

```tsx
        <div className="hidden items-center gap-2 text-xs sm:flex">
          <MetaInline label="Usuário" value={user.nome} />
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <MetaInline label="Perfil" value={user.perfil} />
        </div>
```

- [ ] Run: `cd app/frontend && npm run test -- "menu-v2|nav-group|admin-header"` → PASS (o teste de rota confirma as duas páginas novas).
- [ ] Run: `cd app/frontend && npm run type-check` → exit 0 (o `SidebarUser`/`layout.tsx` são ajustados na Task 3; se o type-check acusar `escopo`, seguir para a Task 3 antes do commit).
- [ ] Commit previsto: `feat(onda2): menu de 9 grupos e colapso fieis ao prototipo`

## Task 3 — `visibleGroups` pelo RBAC real (snapshot do catálogo, sem simulador)

**Files:** `app/backend/scripts/gerar-snapshot-perfis.ts`, `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`, `app/backend/package.json`, `app/backend/test/unit/perfil-permissoes-snapshot.spec.ts`, `app/frontend/src/lib/perfis.ts`, `app/frontend/src/components/ui/app-sidebar.tsx`, `app/frontend/src/app/(admin)/layout.tsx`, `app/frontend/src/app/(admin)/page.tsx`, `app/frontend/__tests__/{menu-rbac,app-sidebar,perfis,entrada}.test.*`.

- [ ] Teste primeiro (backend) — `app/backend/test/unit/perfil-permissoes-snapshot.spec.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../../src/common/rbac/permissoes';

const CAMINHO = join(__dirname, '..', '..', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json');

describe('snapshot perfil → permissões', () => {
  const snapshot = JSON.parse(readFileSync(CAMINHO, 'utf8')) as Record<string, string[]>;

  it('cobre os 11 perfis canonicos', () => {
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(MAPA_PERFIL_PERMISSOES).sort());
    expect(Object.keys(snapshot)).toHaveLength(11);
  });

  it('snapshot reflete exatamente MAPA_PERFIL_PERMISSOES', () => {
    for (const [perfil, permissoes] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      expect(snapshot[perfil]).toEqual([...new Set(permissoes)].sort());
    }
  });
});
```

- [ ] Criar `app/backend/scripts/gerar-snapshot-perfis.ts`:

```typescript
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../src/common/rbac/permissoes';

const snapshot = Object.fromEntries(
  Object.entries(MAPA_PERFIL_PERMISSOES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, permissoes]) => [perfil, [...new Set(permissoes)].sort()]),
);

const destino = join(__dirname, '..', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json');
writeFileSync(destino, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destino}\n`);
```

- [ ] Adicionar o script em `app/backend/package.json`, na lista `scripts`, logo após `db:seed`:

```json
    "rbac:snapshot": "tsx scripts/gerar-snapshot-perfis.ts",
```

- [ ] Run: `cd app/backend && npm run rbac:snapshot && npm run test -- perfil-permissoes-snapshot`.
Expected: JSON gerado com 11 chaves e ambos os casos PASS. O JSON **nunca** é editado à mão.

- [ ] Teste primeiro (frontend) — `app/frontend/__tests__/menu-rbac.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_V2, filtrarMenuPorPermissoes, rotaDeEntrada } from '../src/lib/menu-v2';

const SNAPSHOT = join(
  __dirname, '..', '..', 'backend', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json',
);
const PERMISSOES_POR_PERFIL = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string[]>;

const TODOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
  'CARGA', 'FATURAMENTO', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];

/**
 * Tabela fixada no plano da Onda 2 (decisões 10–13, 25 e 30).
 * Personas do protótipo cobertas: administrador, gestor, comercial,
 * recebimento_pesagem, corte (Desossa), expedicao (Carga).
 * `faturamento` também vê GESTÃO, restrita a Relatórios & SIF (decisões 11 e 30).
 * conferente/logistica ficam sem grupo até a matriz AD-04 da Onda 3.
 */
const GRUPOS_ESPERADOS: Record<string, string[]> = {
  administrador: TODOS,
  gestor: TODOS,
  compras: ['COMERCIAL', 'GESTÃO', 'CADASTROS & REGRAS'],
  comercial: ['COMERCIAL'],
  recebimento_pesagem: ['RECEBIMENTO & BALANÇA'],
  corte: ['DESOSSA'],
  expedicao: ['CARGA'],
  faturamento: ['GESTÃO', 'FATURAMENTO'],
  diretoria: ['COMERCIAL', 'ADMINISTRAÇÃO'],
  conferente: [],
  logistica: [],
};

/**
 * Coluna "Perfis RBAC" da matriz de rastreabilidade v1.1 (linhas 3–41), transcrita rota a
 * rota — inclui os papéis secundários ("consulta", "registro"). É a referência contra a qual
 * as decisões 25, 30 e 31 são aferidas.
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

/** Decisão 25 — as 26 rotas que a matriz atribui e o gate de grupo retira do menu. */
const PERDAS_DECLARADAS: Record<string, string[]> = {
  administrador: [],
  gestor: [],
  compras: ['/recebimento/recebimento-carga'],
  comercial: ['/gestao/compras', '/gestao/overbooking', '/desossa/dashboard'],
  recebimento_pesagem: [
    '/gestao/aprovacoes',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
  ],
  corte: [],
  expedicao: [
    '/comercial/pedidos',
    '/comercial/espelho',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
    '/cadastros/caminhoes',
    '/cadastros/motoristas',
  ],
  conferente: ['/carga/conferencia'],
  faturamento: ['/comercial/clientes', '/comercial/pedidos', '/recebimento/recebimento-carga'],
  logistica: ['/faturamento/notas-xml', '/faturamento/seguro-manual', '/faturamento/liberacao'],
  diretoria: [
    '/gestao/dashboard',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/faturamento/notas-xml',
  ],
};

/** Decisão 31 — itens visíveis cujo perfil a matriz não nomeia (perfis sem persona no protótipo). */
const EXTRAS_DECLARADOS: Record<string, string[]> = {
  administrador: [],
  gestor: [],
  compras: [
    '/comercial/clientes',
    '/comercial/pedidos',
    '/comercial/disponibilidade',
    '/comercial/espelho',
    '/gestao/dashboard',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/cadastros/representantes',
    '/cadastros/produtos',
    '/cadastros/rotas',
    '/cadastros/regras-transformacao',
  ],
  comercial: [],
  recebimento_pesagem: [],
  corte: [],
  expedicao: [],
  conferente: [],
  faturamento: [],
  logistica: [],
  diretoria: ['/comercial/clientes', '/comercial/pedidos', '/comercial/espelho'],
};

/** Tabela fixada da decisão 26 — rota de entrada por perfil. */
const ROTAS_ENTRADA_ESPERADAS: Record<string, string | null> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  compras: '/gestao/dashboard',
  comercial: '/comercial/clientes',
  diretoria: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  faturamento: '/faturamento/pre-faturamento',
  conferente: null,
  logistica: null,
};

/** Acessos explícitos: sob `noUncheckedIndexedAccess`, indexar Record devolve `| undefined`. */
function permissoesDe(perfil: string): string[] {
  const permissoes = PERMISSOES_POR_PERFIL[perfil];
  if (!permissoes) throw new Error(`perfil ausente no snapshot RBAC do backend: ${perfil}`);
  return permissoes;
}

function gruposEsperadosDe(perfil: string): string[] {
  const grupos = GRUPOS_ESPERADOS[perfil];
  if (!grupos) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return grupos;
}

function rotaEsperadaDe(perfil: string): string | null {
  if (!(perfil in ROTAS_ENTRADA_ESPERADAS)) {
    throw new Error(`perfil fora da tabela de rota de entrada do plano: ${perfil}`);
  }
  return ROTAS_ENTRADA_ESPERADAS[perfil] ?? null;
}

function rotasVisiveis(perfil: string): string[] {
  return filtrarMenuPorPermissoes(permissoesDe(perfil)).flatMap((grupo) =>
    grupo.items.map((item) => item.href),
  );
}

function listaDeclarada(tabela: Record<string, string[]>, perfil: string): string[] {
  const lista = tabela[perfil];
  if (!lista) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return [...lista].sort();
}

/** Rotas que a matriz atribui ao perfil e o menu não mostra. */
function perdasCalculadas(perfil: string): string[] {
  const visiveis = new Set(rotasVisiveis(perfil));
  return Object.entries(MATRIZ_RASTREABILIDADE)
    .filter(([href, perfis]) => perfis.includes(perfil) && !visiveis.has(href))
    .map(([href]) => href)
    .sort();
}

/** Rotas que o menu mostra e a matriz não atribui ao perfil. */
function extrasCalculados(perfil: string): string[] {
  return rotasVisiveis(perfil)
    .filter((href) => !(MATRIZ_RASTREABILIDADE[href] ?? []).includes(perfil))
    .sort();
}

function grupoDaRota(href: string) {
  const grupo = MENU_V2.find((g) => g.items.some((item) => item.href === href));
  if (!grupo) throw new Error(`rota fora do MENU_V2: ${href}`);
  return grupo;
}

describe('visibilidade do menu por RBAC real', () => {
  it('a tabela fixada cobre os 11 perfis do catalogo', () => {
    const perfis = Object.keys(PERMISSOES_POR_PERFIL).sort();
    expect(Object.keys(GRUPOS_ESPERADOS).sort()).toEqual(perfis);
    expect(Object.keys(ROTAS_ENTRADA_ESPERADAS).sort()).toEqual(perfis);
    expect(Object.keys(PERDAS_DECLARADAS).sort()).toEqual(perfis);
    expect(Object.keys(EXTRAS_DECLARADOS).sort()).toEqual(perfis);
  });

  it('a matriz transcrita cobre exatamente as 39 rotas do menu', () => {
    const rotasMenu = MENU_V2.flatMap((grupo) => grupo.items.map((item) => item.href)).sort();
    expect(Object.keys(MATRIZ_RASTREABILIDADE).sort()).toEqual(rotasMenu);
    expect(rotasMenu).toHaveLength(39);
  });

  it.each(Object.keys(GRUPOS_ESPERADOS))(
    'visibilidade de grupo por perfil canonico bate com a tabela fixada: %s',
    (perfil) => {
      const grupos = filtrarMenuPorPermissoes(permissoesDe(perfil)).map((g) => g.title);
      expect(grupos).toEqual(gruposEsperadosDe(perfil));
    },
  );

  it.each(Object.keys(ROTAS_ENTRADA_ESPERADAS))(
    'rota de entrada por perfil canonico bate com a tabela fixada: %s',
    (perfil) => {
      expect(rotaDeEntrada(permissoesDe(perfil))).toBe(rotaEsperadaDe(perfil));
    },
  );

  it('rota de entrada esta sempre dentro do menu visivel do proprio perfil', () => {
    for (const perfil of Object.keys(ROTAS_ENTRADA_ESPERADAS)) {
      const rota = rotaDeEntrada(permissoesDe(perfil));
      if (rota) expect(rotasVisiveis(perfil)).toContain(rota);
      else expect(rotasVisiveis(perfil)).toEqual([]);
    }
  });

  it('perfil sem permissao de grupo resulta em zero grupos', () => {
    expect(filtrarMenuPorPermissoes([])).toEqual([]);
    expect(rotaDeEntrada([])).toBeNull();
    expect(filtrarMenuPorPermissoes(permissoesDe('conferente'))).toEqual([]);
  });

  it('gestor ve ADMINISTRAÇÃO apenas com Auditoria (matriz linha 41)', () => {
    const admin = filtrarMenuPorPermissoes(permissoesDe('gestor')).find(
      (g) => g.title === 'ADMINISTRAÇÃO',
    );
    expect(admin?.items.map((i) => i.href)).toEqual(['/admin/auditoria']);
  });

  it('auditoria fica visivel para administrador, gestor e diretoria (matriz linha 41)', () => {
    for (const perfil of ['administrador', 'gestor', 'diretoria']) {
      expect(rotasVisiveis(perfil)).toContain('/admin/auditoria');
    }
    for (const perfil of ['compras', 'comercial', 'recebimento_pesagem', 'corte', 'expedicao', 'faturamento', 'conferente', 'logistica']) {
      expect(rotasVisiveis(perfil)).not.toContain('/admin/auditoria');
    }
  });

  it.each(Object.keys(PERDAS_DECLARADAS))(
    'perdas declaradas conferem com o catalogo e a matriz: %s',
    (perfil) => {
      expect(perdasCalculadas(perfil)).toEqual(listaDeclarada(PERDAS_DECLARADAS, perfil));
    },
  );

  it('a decisao 25 declara exatamente 26 perdas', () => {
    const total = Object.keys(PERDAS_DECLARADAS).reduce(
      (soma, perfil) => soma + perdasCalculadas(perfil).length,
      0,
    );
    expect(total).toBe(26);
  });

  it('toda perda declarada e efeito do gate de grupo, nunca do filtro de item', () => {
    for (const perfil of Object.keys(PERDAS_DECLARADAS)) {
      const concedidas = new Set(permissoesDe(perfil));
      for (const href of listaDeclarada(PERDAS_DECLARADAS, perfil)) {
        const grupo = grupoDaRota(href);
        expect(grupo.permissoesGrupo.some((p) => concedidas.has(p))).toBe(false);
      }
    }
  });

  it.each(Object.keys(EXTRAS_DECLARADOS))(
    'itens visiveis sem atribuicao na matriz conferem com a lista declarada: %s',
    (perfil) => {
      expect(extrasCalculados(perfil)).toEqual(listaDeclarada(EXTRAS_DECLARADOS, perfil));
    },
  );

  it('faturamento ve Relatorios & SIF e nada mais em GESTÃO (matriz linha 13)', () => {
    const gestao = filtrarMenuPorPermissoes(permissoesDe('faturamento')).find(
      (grupo) => grupo.title === 'GESTÃO',
    );
    expect(gestao?.items.map((item) => item.href)).toEqual(['/gestao/relatorios']);
  });

  it('compras ve Pendencias de Overbooking (matriz linha 11)', () => {
    expect(rotasVisiveis('compras')).toContain('/gestao/overbooking');
  });

  it('comercial nao ve tabela de precos sem PEDIDOS_GERENCIAR', () => {
    const permissoes = permissoesDe('comercial').filter((p) => p !== 'PEDIDOS_GERENCIAR');
    const comercial = filtrarMenuPorPermissoes(permissoes).find((g) => g.title === 'COMERCIAL');
    expect(comercial?.items.map((i) => i.href)).not.toContain('/comercial/tabela-precos');
  });
});
```

- [ ] Teste primeiro — `app/frontend/__tests__/perfis.test.ts`:

```typescript
import { formatarPerfis, ROTULOS_PERFIS } from '../src/lib/perfis';

describe('rótulos de perfil', () => {
  it('rotula os 11 perfis canonicos e preserva chave desconhecida', () => {
    expect(Object.keys(ROTULOS_PERFIS)).toHaveLength(11);
    expect(formatarPerfis(['recebimento_pesagem'])).toBe('Recebimento & Balança');
    expect(formatarPerfis(['gestor', 'comercial'])).toBe('Gestão · Comercial');
    expect(formatarPerfis(['perfil_novo'])).toBe('perfil_novo');
  });

  it('lista vazia nao inventa perfil', () => {
    expect(formatarPerfis([])).toBeNull();
  });
});
```

- [ ] Teste primeiro — `app/frontend/__tests__/app-sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '../src/components/ui/app-sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/gestao/dashboard',
}));

const sections = [
  {
    title: 'GESTÃO',
    items: [{ href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard' }],
  },
];

describe('AppSidebar', () => {
  it('aplica o gradiente da sidebar pelos tokens do DS', () => {
    render(<AppSidebar user={{ nome: 'Admin', perfil: 'Administrador', inicial: 'A' }} sections={sections} />);
    const aside = screen.getByRole('complementary', { name: 'Navegação principal' });
    expect(aside.className).toContain('from-sidebar-gradient-start');
    expect(aside.className).toContain('to-sidebar-gradient-end');
  });

  it('renderiza identidade real do usuario', () => {
    render(<AppSidebar user={{ nome: 'Fabrício', perfil: 'Gestão', inicial: 'F' }} sections={sections} />);
    expect(screen.getByText('Fabrício')).toBeInTheDocument();
    expect(screen.getByText('Gestão')).toBeInTheDocument();
  });

  it('nao inventa escopo quando o contrato nao traz representante', () => {
    render(<AppSidebar user={{ nome: 'Fabrício', perfil: 'Gestão', inicial: 'F' }} sections={sections} />);
    expect(screen.queryByText(/Todos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/perfis$/)).not.toBeInTheDocument();
  });

  it('nao renderiza simulador de perfil', () => {
    render(<AppSidebar user={{ nome: 'Admin', perfil: 'Administrador', inicial: 'A' }} sections={sections} />);
    expect(screen.queryByText(/SIMULAR PERFIL/i)).not.toBeInTheDocument();
  });

  it('exibe estado vazio explicito quando nenhum grupo esta liberado', () => {
    render(<AppSidebar user={{ nome: 'Conferente', perfil: 'Conferência', inicial: 'C' }} sections={[]} />);
    expect(
      screen.getByText('Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.'),
    ).toBeInTheDocument();
  });
});
```

- [ ] Teste primeiro — `app/frontend/__tests__/entrada.test.tsx` (rota `/`, decisão 26):

```tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import EntradaPage from '../src/app/(admin)/page';
import { getMe } from '../src/lib/auth';

jest.mock('../src/lib/auth', () => ({ getMe: jest.fn() }));

jest.mock('next/navigation', () => ({
  redirect: (rota: string) => {
    throw new Error(`REDIRECT:${rota}`);
  },
}));

const SNAPSHOT = join(
  __dirname, '..', '..', 'backend', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json',
);
const PERMISSOES_POR_PERFIL = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string[]>;

function permissoesDe(perfil: string): string[] {
  const permissoes = PERMISSOES_POR_PERFIL[perfil];
  if (!permissoes) throw new Error(`perfil ausente no snapshot RBAC do backend: ${perfil}`);
  return permissoes;
}

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;

describe('rota de entrada /', () => {
  beforeEach(() => {
    mockGetMe.mockReset();
  });

  it('redireciona para a rota de entrada do perfil', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u1', nome: 'Admin', perfis: ['administrador'], permissoes: permissoesDe('administrador'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/gestao/dashboard');
  });

  it('redireciona para a rota do grupo de trabalho quando o dashboard nao esta no menu', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u2', nome: 'Ludmila', perfis: ['expedicao'], permissoes: permissoesDe('expedicao'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/carga/planejamento');
  });

  // `faturamento` vê GESTÃO só com Relatórios & SIF (decisão 30); o grupo de trabalho é FATURAMENTO
  it('ignora grupo de consulta com item unico ao escolher a entrada', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u4', nome: 'Carla', perfis: ['faturamento'], permissoes: permissoesDe('faturamento'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/faturamento/pre-faturamento');
  });

  it('sem modulo liberado exibe aviso explicito sem redirecionar', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u3', nome: 'Conferente', perfis: ['conferente'], permissoes: permissoesDe('conferente'),
    });
    render(await EntradaPage());
    expect(screen.getByRole('heading', { name: 'Nenhum módulo liberado' })).toBeInTheDocument();
    expect(
      screen.getByText('Seu perfil ainda não tem módulos liberados. Solicite acesso ao administrador.'),
    ).toBeInTheDocument();
  });

  it('sem sessao valida volta para o login', async () => {
    mockGetMe.mockResolvedValue(null);
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/login');
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- "menu-rbac|perfis|app-sidebar|entrada"` → FAIL (arquivos e comportamentos inexistentes).

- [ ] Criar `app/frontend/src/lib/perfis.ts`:

```typescript
/** Rótulos dos 11 perfis canônicos (doc 013 / AD-04). Chave desconhecida é exibida como veio. */
export const ROTULOS_PERFIS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestão',
  compras: 'Compras',
  comercial: 'Comercial',
  recebimento_pesagem: 'Recebimento & Balança',
  corte: 'Desossa',
  expedicao: 'Carga',
  conferente: 'Conferência',
  faturamento: 'Faturamento',
  logistica: 'Logística',
  diretoria: 'Diretoria',
};

export function formatarPerfis(perfis: string[]): string | null {
  if (perfis.length === 0) return null;
  return perfis.map((perfil) => ROTULOS_PERFIS[perfil] ?? perfil).join(' · ');
}
```

- [ ] Reescrever `src/components/ui/app-sidebar.tsx` (cabeçalho, nav, rodapé de identidade e estado vazio). Trechos finais — `ICON_MAP` e imports de ícones permanecem como estão após a Task 2:

```tsx
export interface SidebarUser {
  nome: string;
  perfil: string;
  inicial: string;
}

interface AppSidebarProps {
  user: SidebarUser;
  sections: SidebarSection[];
}
```

```tsx
export function AppSidebar({ user, sections }: AppSidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end px-4 pb-6 pt-5"
    >
      <div className="mb-4 flex h-12 w-full items-center gap-3 px-1">
        <AlphaLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-tight text-white">AlphaCarnes</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase leading-none tracking-widest text-sidebar-text-muted">
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex w-full flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {sections.length === 0 ? (
          <p className="px-1 text-[12px] leading-relaxed text-sidebar-text-muted">
            Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.
          </p>
        ) : (
          sections.map((section) => (
            <NavGroup
              key={section.title}
              title={section.title}
              defaultOpen={sections.length <= 3}
              items={section.items.map((item) => ({
                href: item.href,
                label: item.label,
                Icon: ICON_MAP[item.iconKey] ?? LayoutDashboard,
              }))}
            />
          ))
        )}
      </nav>

      <div className="mt-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-mid text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">{user.nome}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-sidebar-text-muted">
              {user.perfil}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] Reescrever `src/app/(admin)/layout.tsx` — identidade só com dado real, sem `escopo`:

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { filtrarMenuPorPermissoes } from '@/lib/menu-v2';
import { formatarPerfis } from '@/lib/perfis';
import { AppSidebar, type SidebarUser } from '@/components/ui/app-sidebar';
import { AdminHeader } from '@/components/ui/admin-header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  const sections = filtrarMenuPorPermissoes(user.permissoes);

  const sidebarUser: SidebarUser = {
    nome: user.nome,
    perfil: formatarPerfis(user.perfis ?? []) ?? 'Sem perfil atribuído',
    inicial: user.nome.charAt(0).toUpperCase(),
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={sidebarUser} sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={sidebarUser} />
        <main className="flex-1 bg-background p-4">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] Criar `src/app/(admin)/page.tsx` — rota `/` dentro do shell, destino resolvido pelo menu real (decisão 26):

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { rotaDeEntrada } from '@/lib/menu-v2';

export default async function EntradaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const rota = rotaDeEntrada(user.permissoes);
  if (rota) redirect(rota);

  return (
    <section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
      <h1 className="text-base font-semibold text-foreground">Nenhum módulo liberado</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Seu perfil ainda não tem módulos liberados. Solicite acesso ao administrador.
      </p>
    </section>
  );
}
```

- [ ] Run: `cd app/frontend && npm run test -- "menu-rbac|perfis|app-sidebar|admin-header|entrada"` → PASS.
- [ ] Run: `cd app/frontend && npm run type-check && npm run lint` → exit 0.
- [ ] Run: `cd app/backend && npm run test -- perfil-permissoes-snapshot` → PASS.
- [ ] Commit previsto: `feat(onda2): visibilidade do menu e rota de entrada por RBAC real`

## Task 4 — Badge "Provisório" e alinhamento de StatusPill/KpiCard/AlertItem

**Files:** `src/components/ui/badge-provisorio.tsx`, `__tests__/badge-provisorio.test.tsx`, `__tests__/status-pill.test.tsx`, `__tests__/kpi-card.test.tsx`, `__tests__/alert-item.test.tsx`.

- [ ] Teste primeiro — `app/frontend/__tests__/badge-provisorio.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { BadgeProvisorio, PENDENCIAS_ABERTAS } from '../src/components/ui/badge-provisorio';

describe('BadgeProvisorio', () => {
  it('title cita a pendencia e a referencia do plano mestre', () => {
    render(<BadgeProvisorio pendencia="P1" />);
    const badge = screen.getByText('Provisório');
    expect(badge).toHaveAttribute(
      'title',
      'Provisório — pendência P1 (v1.1 §16.2): separação obrigatória do estoque por operação seg/qua/sex (cadência). Valor parametrizável até decisão registrada em DECISOES.md.',
    );
  });

  it('aceita rotulo especifico sem perder o title da pendencia', () => {
    render(<BadgeProvisorio pendencia="P12" texto="Regra provisória" />);
    const badge = screen.getByText('Regra provisória');
    expect(badge.getAttribute('title')).toContain('pendência P12 (v1.1 §16.15)');
  });

  it('catalogo contem so as pendencias abertas P1..P15 sem P2/P4/P13/P14', () => {
    expect(Object.keys(PENDENCIAS_ABERTAS)).toEqual([
      'P1', 'P3', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P15',
    ]);
  });

  it('usa os tokens ambar do DS', () => {
    render(<BadgeProvisorio pendencia="P3" />);
    const badge = screen.getByText('Provisório');
    expect(badge.className).toContain('bg-provisorio-bg');
    expect(badge.className).toContain('text-provisorio-text');
    expect(badge.className).toContain('border-provisorio-border');
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- badge-provisorio` → FAIL (componente inexistente).

- [ ] Criar `src/components/ui/badge-provisorio.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Pendências ainda abertas (plano mestre §7). P2, P4, P13 e P14 foram fechadas
 * por AD-03..AD-06 e por isso não podem receber badge "Provisório".
 */
export const PENDENCIAS_ABERTAS = {
  P1: { ref: 'v1.1 §16.2', descricao: 'separação obrigatória do estoque por operação seg/qua/sex (cadência)' },
  P3: { ref: 'v1.1 §16.4', descricao: 'ordem detalhada de consumo FIFO entre peças físicas' },
  P5: { ref: 'v1.1 §16.6', descricao: 'política de preço em adendos' },
  P6: { ref: 'v1.1 §16.7', descricao: 'momento exato da escolha da transformação na desossa' },
  P7: { ref: 'v1.1 §16.8/§16.9', descricao: 'N caminhões/NFs por pedido ao fornecedor e N pedidos por caminhão' },
  P8: { ref: 'v1.1 §16.10', descricao: 'lista e modelos oficiais dos relatórios SIF' },
  P9: { ref: 'v1.1 §16.12', descricao: 'campos finais da etiqueta' },
  P10: { ref: 'v1.1 §16.13', descricao: 'procedimento físico de substituição de etiqueta com peça no caminhão' },
  P11: { ref: 'v1.1 §16.14', descricao: 'catálogo oficial completo e saneado de produtos' },
  P12: { ref: 'v1.1 §16.15', descricao: 'outras transformações além do TZ' },
  P15: { ref: 'docs_v2/05 §3.3', descricao: 'marco exato de fechamento do pedido' },
} as const;

export type PendenciaAberta = keyof typeof PENDENCIAS_ABERTAS;

interface BadgeProvisorioProps {
  pendencia: PendenciaAberta;
  texto?: string;
  className?: string;
}

export function BadgeProvisorio({ pendencia, texto, className }: BadgeProvisorioProps) {
  const { ref, descricao } = PENDENCIAS_ABERTAS[pendencia];
  const title = `Provisório — pendência ${pendencia} (${ref}): ${descricao}. Valor parametrizável até decisão registrada em DECISOES.md.`;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-full border border-provisorio-border bg-provisorio-bg px-2 py-0.5 text-[10px] font-bold text-provisorio-text',
        className,
      )}
    >
      <AlertTriangle size={10} strokeWidth={2} aria-hidden="true" />
      {texto ?? 'Provisório'}
    </span>
  );
}
```

- [ ] Teste — `app/frontend/__tests__/status-pill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { StatusPill, type StatusPillVariant } from '../src/components/ui/status-pill';

const CASOS: [StatusPillVariant, string][] = [
  ['recebido', 'Recebido'],
  ['pesado', 'Pesado'],
  ['expedido', 'Expedido'],
  ['divergencia', 'Divergência'],
  ['bloqueado', 'Bloqueado'],
  ['pendente', 'Pendente'],
];

describe('StatusPill', () => {
  it.each(CASOS)('renderiza as 6 variantes com rotulo canonico e cor por token: %s', (variant, rotulo) => {
    const { container } = render(<StatusPill variant={variant} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({
      color: `var(--color-status-${variant})`,
      backgroundColor: `var(--color-status-${variant}-bg)`,
    });
  });

  it('aceita rotulo customizado', () => {
    render(<StatusPill variant="pendente" label="Aguardando conferência" />);
    expect(screen.getByText('Aguardando conferência')).toBeInTheDocument();
  });
});
```

- [ ] Teste — `app/frontend/__tests__/kpi-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Scale } from 'lucide-react';
import { KpiCard } from '../src/components/ui/kpi-card';

describe('KpiCard', () => {
  it('renderiza rotulo, valor, tendencia e variante por token', () => {
    render(
      <KpiCard label="Peças pesadas" value="1.284" trend="+12%" sub="vs. operação anterior" variant="violet" Icon={Scale} />,
    );
    expect(screen.getByText('Peças pesadas')).toBeInTheDocument();
    expect(screen.getByText('1.284')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toHaveStyle({ color: 'var(--color-status-expedido)' });
    expect(screen.getByText('vs. operação anterior')).toBeInTheDocument();
  });

  it('tendencia negativa usa o token de bloqueio', () => {
    render(<KpiCard label="Divergências" value={3} trend="-4%" trendPositive={false} Icon={Scale} />);
    expect(screen.getByText('-4%')).toHaveStyle({ color: 'var(--color-status-bloqueado)' });
  });

  it('sem tendencia exibe apenas o subtexto', () => {
    render(<KpiCard label="Cargas" value={7} sub="em conferência" Icon={Scale} />);
    expect(screen.getByText('em conferência')).toBeInTheDocument();
  });
});
```

- [ ] Teste — `app/frontend/__tests__/alert-item.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { AlertItem } from '../src/components/ui/alert-item';

describe('AlertItem', () => {
  it('renderiza titulo, descricao, hora e a pilha de status', () => {
    render(
      <AlertItem
        title="Divergência no recebimento"
        description="Pedido ao fornecedor PF-0031 com falta de 2 peças."
        time="09:42"
        variant="divergencia"
        Icon={AlertTriangle}
      />,
    );
    expect(screen.getByText('Divergência no recebimento')).toBeInTheDocument();
    expect(screen.getByText('Pedido ao fornecedor PF-0031 com falta de 2 peças.')).toBeInTheDocument();
    expect(screen.getByText('09:42')).toBeInTheDocument();
    expect(screen.getByText('Divergência')).toBeInTheDocument();
  });

  it('usa a variante pendente por padrao', () => {
    render(<AlertItem title="Aguardando" description="Sem ação." time="10:00" />);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- "badge-provisorio|status-pill|kpi-card|alert-item"` → PASS.
Expected: se algum caso de `StatusPill`/`KpiCard`/`AlertItem` falhar, o alinhamento é feito **no componente**, mantendo `var(--color-*)` (nunca hex) e os rótulos canônicos.
- [ ] Commit previsto: `feat(onda2): badge Provisorio e alinhamento de StatusPill KpiCard AlertItem`

## Task 5 — PipelineBar

**Files:** `src/components/ui/pipeline-bar.tsx`, `__tests__/pipeline-bar.test.tsx`.

- [ ] Teste primeiro — `app/frontend/__tests__/pipeline-bar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PipelineBar, ETAPAS_PIPELINE } from '../src/components/ui/pipeline-bar';

describe('PipelineBar', () => {
  it('lista as 4 etapas do prototipo na ordem canonica', () => {
    expect(ETAPAS_PIPELINE).toEqual([
      'Recebimento',
      'Conferência & Destinação',
      'Carga',
      'Faturamento',
    ]);
  });

  it('marca etapa concluida, atual e futura conforme o prototipo', () => {
    render(<PipelineBar etapaAtual="Carga" />);
    expect(screen.getByText('Recebimento').closest('[data-estado]')).toHaveAttribute('data-estado', 'concluida');
    expect(screen.getByText('Carga').closest('[data-estado]')).toHaveAttribute('data-estado', 'atual');
    expect(screen.getByText('Faturamento').closest('[data-estado]')).toHaveAttribute('data-estado', 'futura');
    expect(screen.getByRole('list')).toHaveAccessibleName('Etapas da operação');
  });

  it('exibe contadores por etapa quando informados', () => {
    render(<PipelineBar etapaAtual="Recebimento" contadores={{ recebimento: '12', carga: '3' }} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marca a etapa atual para leitores de tela', () => {
    render(<PipelineBar etapaAtual="Faturamento" />);
    expect(screen.getByText('Faturamento').closest('li')).toHaveAttribute('aria-current', 'step');
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- pipeline-bar` → FAIL.

- [ ] Criar `src/components/ui/pipeline-bar.tsx` (porte de `src/app/components/PipelineBar.tsx`, tokenizado e com semântica de lista):

```tsx
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export const ETAPAS_PIPELINE = [
  'Recebimento',
  'Conferência & Destinação',
  'Carga',
  'Faturamento',
] as const;

export type EtapaPipeline = (typeof ETAPAS_PIPELINE)[number];

interface PipelineBarProps {
  etapaAtual: EtapaPipeline;
  contadores?: {
    recebimento?: string;
    conferencia?: string;
    carga?: string;
    faturamento?: string;
  };
  className?: string;
}

const CHAVES_CONTADOR = ['recebimento', 'conferencia', 'carga', 'faturamento'] as const;

export function PipelineBar({ etapaAtual, contadores, className }: PipelineBarProps) {
  const indiceAtual = ETAPAS_PIPELINE.indexOf(etapaAtual);

  return (
    <ul
      aria-label="Etapas da operação"
      className={cn(
        'mb-6 flex items-center overflow-hidden rounded-lg border border-border-chip bg-card shadow-sm',
        className,
      )}
    >
      {ETAPAS_PIPELINE.map((etapa, index) => {
        const estado = index < indiceAtual ? 'concluida' : index === indiceAtual ? 'atual' : 'futura';
        // `noUncheckedIndexedAccess`: o índice devolve `| undefined`, então a chave é estreitada antes de indexar.
        const chave = CHAVES_CONTADOR[index];
        const contador = chave ? contadores?.[chave] : undefined;

        return (
          <li
            key={etapa}
            aria-current={estado === 'atual' ? 'step' : undefined}
            className="flex flex-1 items-center"
          >
            <div
              data-estado={estado}
              className={cn(
                'flex flex-1 items-center justify-center px-4 py-3 transition-colors',
                estado === 'concluida' && 'font-medium text-pipeline-done',
                estado === 'atual' && 'bg-action-blue font-bold text-white',
                estado === 'futura' && 'text-pipeline-future',
              )}
            >
              {estado === 'concluida' && (
                <CheckCircle2 size={16} className="mr-2 text-pipeline-done" aria-hidden="true" />
              )}
              <span className="text-sm tracking-wide">{etapa}</span>
              {contador && (
                <span
                  className={cn(
                    'ml-3 rounded-full px-2 py-0.5 text-xs font-bold',
                    estado === 'atual' ? 'bg-white/20 text-white' : 'bg-surface-chip text-login-text',
                  )}
                >
                  {contador}
                </span>
              )}
            </div>
            {index < ETAPAS_PIPELINE.length - 1 && (
              <div className="shrink-0 px-1 text-border-chip" aria-hidden="true">
                <ChevronRight size={20} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] Run: `cd app/frontend && npm run test -- pipeline-bar` → PASS.
- [ ] Run: `cd app/frontend && npm run type-check` → exit 0 (o trecho do contador é o que quebrava sob `noUncheckedIndexedAccess`).
- [ ] Commit previsto: `feat(onda2): PipelineBar compartilhada portada do prototipo`

## Task 6 — Base visual do modal Troca de Peça

**Files:** `src/components/ui/troca-peca-modal.tsx`, `__tests__/troca-peca-modal.test.tsx`.

Escopo desta Task (decisão 19): **somente o chrome do wizard**, controlado por props. Nenhum seed mockado, nenhuma seleção de peça, nenhuma regra de atomicidade/estorno/etiqueta — Onda 6 implementa a transação e as telas que o consomem.

- [ ] Teste primeiro — `app/frontend/__tests__/troca-peca-modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrocaPecaModal, PASSOS_TROCA_PECA } from '../src/components/ui/troca-peca-modal';

describe('TrocaPecaModal (base visual)', () => {
  it('lista os 6 passos do prototipo', () => {
    expect(PASSOS_TROCA_PECA).toEqual([
      'Selecionar pedido',
      'Peça atual associada',
      'Nova peça',
      'Destino da peça retirada',
      'Motivo da troca',
      'Revisão de impactos',
    ]);
  });

  it('renderiza o chrome do wizard de 6 passos com o titulo do passo', () => {
    render(
      <TrocaPecaModal open passo={3} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()}>
        <p>conteúdo do passo</p>
      </TrocaPecaModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Trocar Peça' })).toBeInTheDocument();
    expect(screen.getByText('Passo 3 de 6 · Nova peça')).toBeInTheDocument();
    expect(screen.getByText('conteúdo do passo')).toBeInTheDocument();
  });

  it('desabilita Voltar no passo 1 e mostra Confirmar Troca no passo 6', () => {
    const { rerender } = render(
      <TrocaPecaModal open passo={1} podeAvancar={false} onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Voltar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Avançar/ })).toBeDisabled();

    rerender(
      <TrocaPecaModal open passo={6} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Confirmar Troca' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Avançar/ })).not.toBeInTheDocument();
  });

  it('nao decide transicao de passo por conta propria', async () => {
    const onAvancar = jest.fn();
    render(
      <TrocaPecaModal open passo={2} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={onAvancar} onConfirmar={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    expect(onAvancar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Passo 2 de 6 · Peça atual associada')).toBeInTheDocument();
  });

  it('renderiza o painel de sucesso com nova etiqueta e historico', () => {
    render(
      <TrocaPecaModal
        open
        passo={6}
        podeAvancar
        onFechar={jest.fn()}
        onVoltar={jest.fn()}
        onAvancar={jest.fn()}
        onConfirmar={jest.fn()}
        resultado={{
          novaEtiqueta: 'ETQ-88412',
          etiquetaInvalidada: 'ETQ-88391',
          usuario: 'Richard',
          dataHora: '25/07/2026 09:42',
          motivo: 'Peça mais adequada ao cliente',
        }}
      />,
    );
    expect(screen.getByText('Troca realizada com sucesso')).toBeInTheDocument();
    expect(screen.getByText('ETQ-88412')).toBeInTheDocument();
    expect(screen.getByText('ETQ-88391')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
  });

  it('nao renderiza nada quando fechado', () => {
    render(<TrocaPecaModal open={false} passo={1} podeAvancar={false} onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- troca-peca-modal` → FAIL.

- [ ] Criar `src/components/ui/troca-peca-modal.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, CheckCircle2, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/cn';

/** Passos de STEP_TITULOS em src/app/components/TrocaPeca.tsx do protótipo. */
export const PASSOS_TROCA_PECA = [
  'Selecionar pedido',
  'Peça atual associada',
  'Nova peça',
  'Destino da peça retirada',
  'Motivo da troca',
  'Revisão de impactos',
] as const;

export interface ResultadoTrocaPeca {
  novaEtiqueta: string;
  etiquetaInvalidada: string;
  usuario: string;
  dataHora: string;
  motivo: string;
}

interface TrocaPecaModalProps {
  open: boolean;
  /** 1..6 — controlado por quem usa o modal; a base não avança sozinha. */
  passo: number;
  podeAvancar: boolean;
  onFechar: () => void;
  onVoltar: () => void;
  onAvancar: () => void;
  onConfirmar: () => void;
  /** Presente somente após a troca ser efetivada pelo backend (Onda 6). */
  resultado?: ResultadoTrocaPeca;
  children?: ReactNode;
}

function LinhaHistorico({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{rotulo}</span>
      <span className="font-semibold text-text-strong">{valor}</span>
    </div>
  );
}

export function TrocaPecaModal({
  open,
  passo,
  podeAvancar,
  onFechar,
  onVoltar,
  onAvancar,
  onConfirmar,
  resultado,
  children,
}: TrocaPecaModalProps) {
  if (!open) return null;

  const total = PASSOS_TROCA_PECA.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto bg-card p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-strong">
            <ArrowLeftRight size={16} className="text-sidebar-gradient-start" aria-hidden="true" />
            Trocar Peça
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-surface">
                <CheckCircle2 size={28} className="text-success-strong" aria-hidden="true" />
              </div>
              <p className="text-[15px] font-bold text-text-strong">Troca realizada com sucesso</p>
              <p className="text-center text-[12px] text-text-secondary">
                A peça foi trocada de forma atômica. O peso original das duas peças foi preservado.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border-2 border-sidebar-gradient-start bg-surface-subtle p-4 font-mono">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-secondary">Nova etiqueta</p>
                <p className="text-[20px] font-black leading-tight text-sidebar-gradient-start">
                  {resultado.novaEtiqueta}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar-gradient-start">
                <QrCode size={32} className="text-white" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg bg-surface-subtle p-3 text-[12px]">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Histórico da troca
              </p>
              <LinhaHistorico rotulo="Usuário" valor={resultado.usuario} />
              <LinhaHistorico rotulo="Data/hora" valor={resultado.dataHora} />
              <LinhaHistorico rotulo="Motivo" valor={resultado.motivo} />
              <LinhaHistorico rotulo="Etiqueta invalidada" valor={resultado.etiquetaInvalidada} />
            </div>

            <button
              type="button"
              onClick={onFechar}
              className="h-8 rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white transition-colors hover:bg-action-blue"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 px-5 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Passo {passo} de {total} · {PASSOS_TROCA_PECA[passo - 1]}
              </p>
              <div className="flex gap-1">
                {PASSOS_TROCA_PECA.map((titulo, index) => (
                  <span
                    key={titulo}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      index < passo ? 'bg-action-blue' : 'bg-border',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex min-h-[280px] flex-col gap-4 p-5">{children}</div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={onVoltar}
                disabled={passo === 1}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-border text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" /> Voltar
              </button>
              {passo < total ? (
                <button
                  type="button"
                  onClick={onAvancar}
                  disabled={!podeAvancar}
                  className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white transition-colors hover:bg-action-blue disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Avançar <ChevronRight size={14} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConfirmar}
                  disabled={!podeAvancar}
                  className="h-8 flex-1 rounded-md bg-action-blue text-[13px] font-semibold text-white transition-colors hover:bg-action-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmar Troca
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] Run: `cd app/frontend && npm run test -- troca-peca-modal` → PASS.
Expected: se o `Dialog` do DS exigir `aria-describedby`/`DialogDescription`, adicionar `DialogDescription` com o título do passo — sem mudar o teste de nome acessível.
- [ ] Commit previsto: `feat(onda2): base visual do modal Troca de Peca`

## Task 7 — Login fiel ao protótipo com JWT real

**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/login-form-client.tsx`, `src/components/ui/button.tsx`, `.env.example`, `__tests__/login.test.tsx`.

- [ ] Teste primeiro — substituir `app/frontend/__tests__/login.test.tsx` por:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginFormClient } from '../src/app/(auth)/login/login-form-client';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('LoginFormClient', () => {
  beforeEach(() => {
    push.mockReset();
    global.fetch = jest.fn();
  });

  it('usa a microcopy e o botao Acessar Sistema do prototipo', () => {
    render(<LoginFormClient />);
    expect(screen.getByText('Bem-vindo de volta')).toBeInTheDocument();
    expect(screen.getByText('Insira suas credenciais para acessar a operação.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('placeholder', 'nome@alphacarnes.com.br');
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acessar Sistema' })).toBeInTheDocument();
  });

  it('botao Acessar Sistema usa a variante de acao do DS', () => {
    render(<LoginFormClient />);
    const botao = screen.getByRole('button', { name: 'Acessar Sistema' });
    expect(botao.className).toContain('bg-action-blue');
    expect(botao.className).toContain('hover:bg-action-blue-strong');
    expect(botao.className).not.toContain('bg-primary');
  });

  it('nao pre-preenche credenciais', () => {
    render(<LoginFormClient />);
    expect(screen.getByLabelText('E-mail')).toHaveValue('');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });

  it('nao oferece recurso inexistente no backend', () => {
    render(<LoginFormClient />);
    expect(screen.queryByText(/Esqueci a senha/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lembrar/i)).not.toBeInTheDocument();
  });

  it('envia credenciais para /api/auth/login e navega para a rota de entrada', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<LoginFormClient />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@alphacarnes.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo-123');
    await userEvent.click(screen.getByRole('button', { name: 'Acessar Sistema' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@alphacarnes.local', password: 'segredo-123' }),
    }));
    // decisão 26: o destino é resolvido no servidor, em `/`; o cliente não escolhe rota.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('exibe erro explicito quando o backend recusa', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Credenciais inválidas' }),
    });
    render(<LoginFormClient />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@alphacarnes.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada');
    await userEvent.click(screen.getByRole('button', { name: 'Acessar Sistema' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas');
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] Run: `cd app/frontend && npm run test -- login` → FAIL (placeholder, rótulo, cor do botão e destino da navegação divergem).

- [ ] Acrescentar a variante `acao` ao `cva` de `src/components/ui/button.tsx`, logo após `default` (adição pura — nenhuma variante existente muda; decisões 22 e 29):

```tsx
        acao: "bg-action-blue text-white hover:bg-action-blue-strong",
```

- [ ] Ajustar `src/app/(auth)/login/login-form-client.tsx`: manter todo o fluxo JWT atual (`/api/auth/login`, `extrairMensagemErro`) e trocar o placeholder, o rótulo/variante do botão e o destino da navegação:

```tsx
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@alphacarnes.com.br"
              className="h-12"
              {...register('email')}
            />
```

```tsx
      router.push('/');
```

```tsx
        <Button type="submit" variant="acao" className="h-12 w-full" loading={isSubmitting}>
          Acessar Sistema
        </Button>
```

- [ ] Reescrever `src/app/(auth)/login/page.tsx` — painel institucional fiel, tokens e chip de ambiente por variável real:

```tsx
import { AlphaLogo } from '@/components/ui/alpha-logo';
import { LoginFormShell } from './login-form-shell';

const ambiente = process.env.NEXT_PUBLIC_AMBIENTE;

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full bg-card font-sans">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-login-panel p-12 lg:flex">
        <div
          className="absolute inset-0 z-0 bg-gradient-to-t from-login-panel via-login-panel/80 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-3">
          <AlphaLogo className="h-10 w-10" priority />
          <div>
            <h1 className="text-xl font-bold leading-tight text-white">AlphaCarnes</h1>
            <p className="text-[10px] uppercase leading-none tracking-widest text-login-panel-caption">
              Sistema Integrado
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-sm">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
            Distribuição inteligente ponta a ponta.
          </h2>
          <p className="text-lg leading-relaxed text-login-panel-text">
            Gestão operacional de recebimento, transformação e expedição.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        <div className="absolute left-8 top-8 flex items-center gap-3 lg:hidden">
          <AlphaLogo className="h-8 w-8" priority />
          <h1 className="text-lg font-bold text-login-heading">AlphaCarnes</h1>
        </div>

        {ambiente && (
          <div className="absolute right-8 top-8">
            <span className="rounded-full border border-border-chip bg-surface-chip px-3 py-1 text-xs font-medium text-login-text">
              Ambiente: {ambiente}
            </span>
          </div>
        )}

        <LoginFormShell />
      </div>
    </main>
  );
}
```

- [ ] Atualizar o único spec Playwright que faz login pela UI e ainda clica no rótulo antigo — `e2e/jornada-operacional.spec.ts:441`:

```typescript
    await page.getByRole('button', { name: 'Acessar Sistema' }).click();
```

- [ ] Acrescentar a variável em `.env.example`, na seção do frontend (logo após `NEXT_PUBLIC_API_URL`):

```dotenv
# Rótulo exibido no chip de ambiente da tela de login (vazio = chip não é renderizado)
NEXT_PUBLIC_AMBIENTE=Desenvolvimento
```

- [ ] Run: `cd app/frontend && npm run test -- "login|tokens-ds"`.
Expected: todos PASS, incluindo agora `nenhum literal hexadecimal de cor em src fora de globals.css` (o último arquivo com hex foi eliminado).
- [ ] Run: `cd app/frontend && npm run lint && npm run type-check` → exit 0.
- [ ] Commit previsto: `feat(onda2): login fiel ao prototipo mantendo o fluxo JWT real`

## Task 8 — Smoke suite e evidência de shell contra o protótipo

**Files:** `app/frontend/e2e/shell-ds.spec.ts`, `docs/evidencias/onda2-shell/README.md` + PNGs, `app/frontend/package.json`.

- [ ] Adicionar o script de execução em `app/frontend/package.json`, na lista `scripts`, após `e2e:jornada`:

```json
    "e2e:shell": "playwright test e2e/shell-ds.spec.ts",
```

- [ ] Criar `app/frontend/e2e/shell-ds.spec.ts` (reusa o padrão de login por API de `e2e/telas-reais.spec.ts`):

```typescript
/**
 * Evidência do shell da Onda 2: asserções estruturais + screenshots comparáveis
 * ao protótipo (docs/evidencias/onda2-shell/referencia-prototipo/).
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? ROOT_ENV.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';
const EVIDENCIAS = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda2-shell');

const GRUPOS = [
  'COMERCIAL',
  'GESTÃO',
  'RECEBIMENTO & BALANÇA',
  'DESOSSA',
  'ESTOQUE',
  'CARGA',
  'FATURAMENTO',
  'CADASTROS & REGRAS',
  'ADMINISTRAÇÃO',
];

async function loginAdmin(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
) {
  const res = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), `login falhou: ${res.status()} ${await res.text()}`).toBeTruthy();
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nameValue] = h.value.split(';');
      const eq = nameValue.indexOf('=');
      return { name: nameValue.slice(0, eq), value: nameValue.slice(eq + 1), url: baseURL };
    });
  await page.context().addCookies(cookies);
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
});

test.describe('Shell + DS da Onda 2', () => {
  test('login exibe painel institucional e formulario fieis', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Distribuição inteligente ponta a ponta.' })).toBeVisible();
    await expect(page.getByText('Sistema Integrado')).toBeVisible();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acessar Sistema' })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCIAS, '01-login.png'), fullPage: true });
  });

  test('sidebar resolve o gradiente 1E3A5F→1B4E9B', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const aside = page.getByRole('complementary', { name: 'Navegação principal' });
    await expect(aside).toBeVisible();
    const gradiente = await aside.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(gradiente).toContain('rgb(30, 58, 95)');
    expect(gradiente).toContain('rgb(27, 78, 155)');
  });

  test('menu do administrador tem os 9 grupos na ordem do prototipo', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const aside = page.getByRole('complementary', { name: 'Navegação principal' });
    const titulos = await aside.locator('button[aria-expanded]').allInnerTexts();
    expect(titulos.map((t) => t.trim())).toEqual(GRUPOS);
  });

  test('pos-login o administrador entra por /gestao/dashboard', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/');
    await expect(page).toHaveURL(/\/gestao\/dashboard$/);
  });

  test('breadcrumb do dashboard e Gestão / Painel Geral da Operação', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const breadcrumb = page.getByLabel('Breadcrumb');
    await expect(breadcrumb).toContainText('Gestão');
    await expect(breadcrumb).toContainText('Painel Geral da Operação');
  });

  // O colapso é max-height + overflow-hidden com os itens montados: um link clipado ainda tem
  // bounding box e continuaria "visível" para o Playwright. A asserção é do mecanismo real.
  test('colapso por grupo funciona no shell renderizado', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const cabecalho = page.getByRole('button', { name: /COMERCIAL/ });
    const idPainel = await cabecalho.getAttribute('aria-controls');
    expect(idPainel).toBeTruthy();
    const painel = page.locator(`[id="${idPainel}"]`);

    if ((await painel.getAttribute('data-state')) === 'fechado') await cabecalho.click();
    await expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    await expect(painel).toHaveAttribute('data-state', 'aberto');
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();

    await cabecalho.click();
    await expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    await expect(painel).toHaveAttribute('data-state', 'fechado');
    await expect(painel).toHaveCSS('max-height', '0px');
  });

  test('captura evidencias do shell e do login', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    await expect(page.getByRole('heading', { name: /Painel Geral da Operação/i })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(EVIDENCIAS, '02-shell-dashboard.png'), fullPage: true });
    await page
      .getByRole('complementary', { name: 'Navegação principal' })
      .screenshot({ path: path.join(EVIDENCIAS, '03-shell-sidebar-9-grupos.png') });
  });
});
```

- [ ] Copiar a referência do protótipo (fixture versionada):

```bash
mkdir -p docs/evidencias/onda2-shell/referencia-prototipo
cp "F:/Projetos/alpha-carnes-prototipo/src/imports/01-login.png" \
   docs/evidencias/onda2-shell/referencia-prototipo/01-login-prototipo.png
cp "F:/Projetos/alpha-carnes-prototipo/src/imports/02-dashboard.png" \
   docs/evidencias/onda2-shell/referencia-prototipo/02-shell-prototipo.png
```

Se algum PNG não retratar a tela esperada (abrir e conferir), capturar do protótipo em execução, na branch `feature/completude-v1.1`:

```bash
cd F:/Projetos/alpha-carnes-prototipo
git checkout feature/completude-v1.1
npm install
npm run dev            # anotar a porta exibida
# em outro terminal, com a porta correta em <PORTA>:
npx playwright screenshot --viewport-size=1280,800 --full-page \
  "http://localhost:<PORTA>/login" \
  "F:/Projetos/AlphaCarnes/docs/evidencias/onda2-shell/referencia-prototipo/01-login-prototipo.png"
npx playwright screenshot --viewport-size=1280,800 --full-page \
  "http://localhost:<PORTA>/gestao/dashboard" \
  "F:/Projetos/AlphaCarnes/docs/evidencias/onda2-shell/referencia-prototipo/02-shell-prototipo.png"
```

- [ ] Criar `docs/evidencias/onda2-shell/README.md` com: origem de cada PNG (app × protótipo), comando que gerou cada um, viewport `1280×800`, e a lista das divergências autorizadas pelas decisões 11, 16, 20, 25, 26, 30 e 31 deste plano (ADMINISTRAÇÃO para `gestor` e GESTÃO restrita a `Relatórios & SIF` para `faturamento`; ausência do chip "Escopo"; login sem foto de CDN, sem credencial pré-preenchida, sem "Esqueci a senha"/"Lembrar minhas credenciais" e sem rodapé de protótipo; as 26 perdas de item declaradas na decisão 25 e os itens visíveis sem atribuição na matriz da decisão 31; rota de entrada resolvida pelo grupo de trabalho do perfil). Critério explícito: **comparação estrutural lado a lado, não pixel-perfect** (decisão 21).

- [ ] Run (com Postgres, backend e seed ativos). O workspace `app/backend` **não tem script de dev** (só `build`/`start:prod`/`lint`/`type-check`/`test`/`test:cov`/`db:*`); o backend real desta etapa sobe pelo serviço `backend` do `docker-compose.yml`, que expõe `http://localhost:4001`:

```bash
docker compose up -d postgres
cd app/backend && npm run db:migrate && npm run db:seed && cd ../..
docker compose up -d --build backend
curl -fsS http://localhost:4001/health           # {"status":"ok"}

cd app/frontend
JWT_ACCESS_SECRET="$(grep '^JWT_ACCESS_SECRET=' ../../.env | cut -d= -f2-)" \
BACKEND_INTERNAL_URL=http://localhost:4001 \
NEXT_PUBLIC_AMBIENTE=Desenvolvimento \
npm run e2e:shell
```

Notas de execução (nada aqui é opcional): `db:migrate`/`db:seed` rodam **do host** com o `DATABASE_URL` da raiz (`localhost:15433`); o `webServer` do `playwright.config.ts` sobe o Next em `:3100`, e é por isso que `JWT_ACCESS_SECRET` (middleware `jose`) e `BACKEND_INTERNAL_URL` vão no ambiente do comando — o Next **não** lê o `.env` da raiz. Se `curl` não devolver `{"status":"ok"}`, parar e reportar em vez de seguir para o Playwright.

Expected: 7 testes PASS; os três PNGs de `docs/evidencias/onda2-shell/` criados.

- [ ] Run: `cd app/frontend && npm run test` → toda a suíte Jest PASS (inclui os 14 arquivos novos + `login` reescrito + `terminologia`, `api`, `middleware` e as suítes de tela pré-existentes).
- [ ] Commit previsto: `test(onda2): smoke do DS e evidencia do shell contra o prototipo`

## Task 9 — Gate local e PR

- [ ] Em checkout limpo da branch, executar as mesmas categorias do CI (`.github/workflows/ci.yml`):

```bash
npm ci
npm run lint
npm run type-check
docker compose up -d postgres
cd app/backend
npm run db:migrate
npm run db:seed
npm run test:cov
cd ../frontend
npm run test
cd ../..
npm run build
npm audit --omit=dev --audit-level=high
gitleaks git . --no-banner --redact --verbose --exit-code 1 --config .gitleaks.toml
```

- [ ] Run: bloco do gate local acima.
Expected: todos os comandos com exit code 0; cobertura backend ≥80% em linhas e branches (inalterada — o backend só ganhou script + teste); `npm run test` do frontend sem falha; gitleaks sem achados.

- [ ] Run: verificação final do invariante de cor e do simulador:

```bash
cd app/frontend
npm run test -- tokens-ds
rg -n "#[0-9A-Fa-f]{6}" src --glob '!app/globals.css' || echo "sem hex fora de globals.css"
rg -n "SIMULAR PERFIL|PROFILE_ORDER|activeProfile" src || echo "sem simulador"
```

Expected: suíte PASS; ambos os `rg` sem match (mensagem de fallback impressa). O padrão de 6 dígitos não alcança os `#ccc`/`#fff` de `chart.tsx`, que são seletores de atributo (decisão 23) e já estão pinados pelo teste.

- [ ] Abrir PR `feature/onda2-shell-ds → develop` com o template:

```markdown
## Onda 2 — Shell + Design System fiel ao protótipo

Plano tático: `docs/superpowers/plans/2026-07-25-onda2-shell-ds.md` (sha256 registrado no commit do plano e em `EXECUCAO-STATUS.md`).

### Escopo entregue (task a task)
- Task 1 — tokens da paleta do protótipo em `globals.css`; hex avulso eliminado de `src`.
- Task 2 — menu de 9 grupos e 39 itens com rótulos/rotas do protótipo; colapso e breadcrumb; rotas `/gestao/operacoes` e `/gestao/overbooking`.
- Task 3 — visibilidade de grupo por RBAC real (snapshot do catálogo do backend); rota de entrada `/` pelo menu do perfil; simulador de perfil ausente; identidade sem dado inventado.
- Task 4 — `BadgeProvisorio` (title citando a pendência) e alinhamento de `StatusPill`/`KpiCard`/`AlertItem`.
- Task 5 — `PipelineBar` compartilhada.
- Task 6 — base visual do modal Troca de Peça (sem regra de negócio; atomicidade é Onda 6).
- Task 7 — login fiel ao protótipo mantendo o fluxo JWT real.
- Task 8 — smoke tests por componente + evidência de shell.

### Mapa DoD → teste
<colar a tabela do plano com o status de cada linha e o comando que a provou>

### Evidências
- `docs/evidencias/onda2-shell/` (app) × `docs/evidencias/onda2-shell/referencia-prototipo/` (protótipo).
- Saída do gate local (lint, type-check, testes, build, audit, gitleaks).

### Divergências autorizadas pelo plano
- Decisão 11 — `gestor`/`diretoria` veem `ADMINISTRAÇÃO` restrita a `Auditoria` (matriz linha 41); `conferente`/`logistica` sem grupo até a matriz AD-04 da Onda 3.
- Decisão 13 — grupo `ESTOQUE` exige `ESTOQUE_*` (AD-04).
- Decisão 16 — chip "Escopo" removido enquanto `/auth/me` não expõe representante.
- Decisão 20 — login sem foto de CDN externo, sem credencial pré-preenchida, sem "Esqueci a senha"/"Lembrar minhas credenciais" e sem rodapé de protótipo.
- Decisão 21 — comparação de shell é estrutural, não pixel-perfect.
- Decisão 23 — hex remanescente apenas em seletor de atributo CSS (`chart.tsx`), com inventário pinado por teste.
- Decisão 24 — `/cadastros/rotas` passa a exigir `ROTAS_*`; `/desossa/dashboard` deixa de aceitar `DISPONIBILIDADE_LER`.
- Decisão 25 — as **26** rotas que a matriz atribui e o gate de grupo tira do menu, declaradas item a item por perfil e aferidas em `menu-rbac.test.ts` (reconciliação na Onda 3).
- Decisão 26 — rota de entrada `/` e destino pós-login resolvidos pelo grupo de trabalho do perfil (matriz linha 2 refinada para não cair em rota fora do menu).
- Decisão 29 — `button.tsx` ganha a variante `acao` para o CTA do login usar `--color-action-blue`.
- Decisão 30 — `faturamento` recupera `Relatórios & SIF` (matriz linha 13) e passa a ver `GESTÃO` com esse único item; `compras` recupera `Pendências de Overbooking` (linha 11); `/gestao/dashboard` deixa de aceitar `DISPONIBILIDADE_LER`.
- Decisão 31 — itens visíveis que a matriz não atribui (11 em `compras`, 3 em `diretoria`), pinados por teste.
- Decisão 5 — `<h1>` de `/gestao/dashboard` alinhado a `Painel Geral da Operação`; specs Playwright existentes atualizados junto.

### Fora de escopo
Telas de domínio das Ondas 3–10; regra de Troca de Peça (Onda 6); matriz completa de permissões por perfil (Onda 3 — inclui as 26 perdas da decisão 25 e a conciliação catálogo × matriz da decisão 31); alinhamento de filtros/visual de `/admin/auditoria` (Onda 3 — decisão 27); as sete dívidas herdadas da Onda 1 (Onda 6 — decisão 28 e seção "Dívidas herdadas da Onda 1").
```

- [ ] Solicitar `/gate-pr onda2 <PR>`.

## Self-Review obrigatório do Worker

```bash
# sem -i: "todo/todos" em português são legítimos; o alvo são os marcadores em caixa alta
rg -n '\bT[B]D\b|\bT[O]DO\b|a[ ]definir|implementar[ ]depois|similar[ ]à[ ]Task' \
  docs/superpowers/plans/2026-07-25-onda2-shell-ds.md
cd app/frontend
# hex de cor aplicada: filtra os seletores de atributo de chart.tsx (decisão 23)
rg -n "#[0-9A-Fa-f]{3,8}\b" src --glob '!app/globals.css' | rg -v "\[[a-zA-Z-]+='#"
rg -n "rgba?\(" src --glob '!app/globals.css'
rg -n "SIMULAR PERFIL|PROFILE_ORDER|activeProfile|visibleGroups" src
rg -n "push\('/gestao/dashboard'\)" src
rg -n -i '\bmarcas?\b' src
npm run test -- "menu-v2|menu-rbac|tokens-ds|entrada"
cd ../backend
npm run rbac:snapshot && git diff --exit-code src/common/rbac/perfil-permissoes.snapshot.json
```

Expected:

```text
primeiro comando (marcadores de pendência textual no plano): zero ocorrências
hex de cor aplicada fora de globals.css: zero ocorrências (as 5 de chart.tsx são seletores de atributo e saem no filtro)
rgba fora de globals.css: zero ocorrências
simulador: zero ocorrências
destino pós-login fixo no cliente: zero ocorrências (a rota de entrada é resolvida em `/`)
terminologia: zero strings de UI com o rótulo banido
menu-v2 + menu-rbac + tokens-ds + entrada: PASS
snapshot RBAC: regeneração não produz diff (snapshot em dia com o catálogo)
```

O Worker encerra o relatório declarando:

```text
Desvios do plano: NENHUM
Decisões improvisadas: NENHUMA
Cor fora de globals.css: NÃO
Simulador de perfil portado: NÃO
Dado de identidade inventado (escopo/perfil): NÃO
Regra de negócio de Troca de Peça implementada nesta onda: NÃO
Tela de domínio das Ondas 3–10 implementada: NÃO
Badge Provisório em pendência fechada por AD: NÃO
Dívida herdada da Onda 1 executada nesta onda: NÃO (destino na seção "Dívidas herdadas da Onda 1")
Rota morta como destino pós-login: NÃO (destino resolvido pelo menu do perfil, decisão 26)
```
