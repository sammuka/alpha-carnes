# Assessment de campos, comboboxes e valores controlados

**Data:** 2026-08-30  
**Ambiente:** Docker Desktop local (`localhost:4000`, admin `admin@alphacarnes.local`)  
**Método:** navegação real (Chrome DevTools) + confirmação em DTOs Zod / `cadastros-config.ts`  
**Código da aplicação:** nenhuma correção nesta atividade  
**Épico Linear:** [SAM-156](https://linear.app/sammuka/issue/SAM-156/ux-assessment-de-campos-de-dominio-controlado-texto-livre-vs-combobox)

Regra aplicada: campo de texto livre não deve persistir valor de domínio controlado (enum, FK, cadastro auxiliar, lista finita). Poucas opções → select; muitas → `ComboboxField` (já existe no DS e foi testado no pedido de venda).

Não duplicar [SAM-118](https://linear.app/sammuka/issue/SAM-118) (select “Operação” no pedido lista compras, não operações).

---

## 1. Resumo executivo

| Métrica | Quantidade |
| --- | ---: |
| Telas de menu percorridas (`MENU_V2`) | 39 |
| Formulários de criação/edição/modais inspecionados | 28 |
| Campos de entrada classificados (aprox.) | ~210 |
| Text inputs (incl. busca/máscara/readonly) | ~95 |
| Selects / comboboxes | ~55 |
| Text inputs que deveriam ser combo/select | 18 (em 8 issues) |
| Combos que deveriam ter pesquisa | 10 superfícies ([SAM-160](https://linear.app/sammuka/issue/SAM-160)) |
| Problemas de domínio / persistência | 3 ([SAM-167](https://linear.app/sammuka/issue/SAM-167), [SAM-168](https://linear.app/sammuka/issue/SAM-168), default `Peça` vs seed `unidade`) |
| Inconsistências entre telas | 5 |
| Regras a confirmar com negócio | 10 |
| Issues criadas no Linear | 13 (1 épico + 12 filhas) |

`ComboboxField` já funciona: no Novo Pedido, digitando `Onda` o combo de cliente filtrou os dois registros `Cliente Onda11 *`. O gap é adoção, não ausência de componente.

---

## 2. Top problemas (risco de dado incorreto)

1. **UUID digitado** — representante em `/cadastros/clientes` e caminhão no pré-faturamento. Operador cola ID; valor inexistente só quebra na API. [SAM-157](https://linear.app/sammuka/issue/SAM-157), [SAM-159](https://linear.app/sammuka/issue/SAM-159).
2. **Duas UIs de cliente** — menu comercial com selects corretos vs rota genérica com texto/UUID. [SAM-157](https://linear.app/sammuka/issue/SAM-157).
3. **Unidade `Peça` vs seed `unidade`** — produto novo já nasce com grafia diferente do catálogo. [SAM-158](https://linear.app/sammuka/issue/SAM-158).
4. **Parâmetros de fornecedor ignorados pelo backend** — select de nota A/B/C parece controlado e é descartado (RA-05). [SAM-168](https://linear.app/sammuka/issue/SAM-168).
5. **Regras de desdobramento em UUID** — grid ilegível; criação inerte. [SAM-167](https://linear.app/sammuka/issue/SAM-167).
6. **Rota/motorista/fornecedor como string** em pedido, carga, rotas e estoque, enquanto outras telas já usam FK. [SAM-161](https://linear.app/sammuka/issue/SAM-161)–[SAM-164](https://linear.app/sammuka/issue/SAM-164).

---

## 3. Issues criadas

| Linear | Tela | Campo | Problema | Severidade |
| --- | --- | --- | --- | --- |
| [SAM-156](https://linear.app/sammuka/issue/SAM-156) | — | — | Épico do assessment | Alta |
| [SAM-157](https://linear.app/sammuka/issue/SAM-157) | Clientes genérico | Representante, Prioridade, Rota | UUID/texto vs selects da tela comercial | Alta |
| [SAM-158](https://linear.app/sammuka/issue/SAM-158) | Produto / Itens compra / Itens comerciais | Unidade | Texto livre; default `Peça` ≠ seed | Média |
| [SAM-159](https://linear.app/sammuka/issue/SAM-159) | Pré-Faturamento | ID do Caminhão | UUID digitado | Alta |
| [SAM-160](https://linear.app/sammuka/issue/SAM-160) | Pedido, Compras, Clientes, Espelho, … | Produto, item, representante, rota | Select nativo sem pesquisa | Média |
| [SAM-161](https://linear.app/sammuka/issue/SAM-161) | Pedido de Venda | Rota | Texto livre; cliente já usa `rotaId` | Média |
| [SAM-162](https://linear.app/sammuka/issue/SAM-162) | Rotas | Representante/Caminhão/Motorista padrão | Texto livre com cadastros existentes | Alta |
| [SAM-163](https://linear.app/sammuka/issue/SAM-163) | Planejamento de Carga | Motorista, Rota | Texto livre; frota já é select | Média |
| [SAM-164](https://linear.app/sammuka/issue/SAM-164) | Entrada de Itens | Fornecedor/origem | Texto livre; compras já é combobox | Média |
| [SAM-165](https://linear.app/sammuka/issue/SAM-165) | Clientes, Caminhões | UF | Texto livre (27 valores) | Média |
| [SAM-166](https://linear.app/sammuka/issue/SAM-166) | Clientes | Nome Fantasia | Label “Marca” viola v1.1 §6.8 | Alta |
| [SAM-167](https://linear.app/sammuka/issue/SAM-167) | Regras de Transformação | Item comercial / compra | Grid em UUID; criação inerte | Alta |
| [SAM-168](https://linear.app/sammuka/issue/SAM-168) | Fornecedor | Parâmetros operacionais | UI envia campos que o DTO descarta | Alta |

Time: **Sammuka**. Projeto: **AlphaCarnes**. Labels existentes: `Bug` / `Improvement`. Sem labels novas.

---

## 4. Pendências de negócio (não viraram bug confirmado)

Registrar aqui, sem issue de correção até o Quality Owner decidir.

1. **Categoria** (produto, item de compra, item comercial) — DTO `string` máx. 100. Sem tabela. Combo só se houver catálogo oficial.
2. **Tipo/canal do representante** — form é texto (`Ex: Interno`); filtro já lista canais existentes via `/api/cadastros/representantes/canais`. Criação livre pode ser intencional.
3. **Cidade** — sem domínio IBGE no produto. UF fechamos em [SAM-165](https://linear.app/sammuka/issue/SAM-165); cidade permanece texto até existir cadastro.
4. **NCM / CFOP / origem fiscal / CEST** — texto na aba Fiscal do produto. Não há catálogo NCM neste sistema (diferente do SiriusComex). Origem fiscal NF-e (0–8) é candidata a enum se o fiscal confirmar.
5. **Recebimento: placa e motorista** — DTO string. Pode ser terceiro sem cadastro. Carga já tem “avulso”. Confirmar se o default deve ser cadastro + escape “Outro”.
6. **Perfil de gordura** — UI comercial força 3 valores; DTO `preferenciasJson.perfilGordura` é string livre.
7. **Prioridade do pedido (0–100)** vs prioridade do cliente (`normal`/`alta`) — dois conceitos. Manter?
8. **Local/câmara** na entrada de estoque — select hardcoded Câmara 1/2/Túnel. Vira parâmetro/cadastro?
9. **Nacionalidade do motorista** — texto. Lista de países?
10. **Itens inativos em combos** — não exercitado com massa de inativos. Regra a confirmar: omitir na criação, manter na edição.

---

## 5. Matriz de cobertura

| Tela | Rota | Campos analisados | Problemas | Issues | Status |
| --- | --- | ---: | ---: | --- | --- |
| Login | `/login` | 2 | 0 | — | Avaliada |
| Painel Geral | `/gestao/dashboard` | 1 (operação) | 0* | — | Avaliada |
| Clientes (comercial) | `/comercial/clientes` | 18 | 2 | SAM-160, SAM-165, SAM-166 | Avaliada |
| Clientes (genérico) | `/cadastros/clientes/novo` | 21 | 4 | SAM-157, SAM-165, SAM-166 | Avaliada |
| Pedidos de Venda | `/comercial/pedidos` | 8 | 2 | SAM-160, SAM-161 | Avaliada |
| Tabela de Preços | `/comercial/tabela-precos` | 44 (preços numéricos) | 0 | — | Avaliada |
| Disponibilidade | `/comercial/disponibilidade` | 0 | 0 | — | Avaliada |
| Espelho Comercial | `/comercial/espelho` | 3 | 1 | SAM-160 | Avaliada |
| Operações | `/gestao/operacoes` | 3 | 0 | — | Avaliada |
| Compras | `/gestao/compras` | 6 | 1 | SAM-160 | Avaliada |
| Overbooking | `/gestao/overbooking` | 3 | 0 | — | Avaliada |
| Aprovações | `/gestao/aprovacoes` | 1 | 0 | — | Avaliada |
| Relatórios SIF | `/gestao/relatorios` | 1 | 0 | — | Avaliada |
| Recebimento de Carga | `/recebimento/recebimento-carga` | 14 | 0† | — | Avaliada |
| Pesagem e Destinação | `/recebimento/pesagem-destinacao` | 2 | 0 | — | Avaliada |
| Etiquetas (recebimento) | `/recebimento/etiquetas` | 3 | 1 | SAM-160 | Avaliada |
| Dashboard Desossa | `/desossa/dashboard` | 0 | 0 | — | Avaliada |
| Pesagem Desossa | `/desossa/pesagem-destinacao` | 1 | 0 | — | Avaliada |
| Etiquetas Desossa | `/desossa/etiquetas` | 6 | 0‡ | SAM-160 (produto) | Avaliada |
| Consulta de Estoque | `/estoque/consulta` | 4 | 0‡ | — | Avaliada |
| Entrada de Itens | `/estoque/entrada-itens` | 7 | 1 | SAM-164 | Avaliada |
| Ajustes | `/estoque/ajustes` | 6 | 0 | — | Avaliada |
| Planejamento de Carga | `/carga/planejamento` | 5 | 2 | SAM-163 | Avaliada |
| Conferência | `/carga/conferencia` | 1 (+ modal motivo select) | 0 | — | Avaliada |
| Enviar p/ Faturamento | `/carga/enviar-faturamento` | 1 | 0 | — | Avaliada |
| Pré-Faturamento | `/faturamento/pre-faturamento` | 1 | 1 | SAM-159 | Avaliada |
| Notas / XML | `/faturamento/notas-xml` | 2 | 0 | — | Avaliada |
| Seguro Manual | `/faturamento/seguro-manual` | 2 | 0 | — | Avaliada |
| Liberação | `/faturamento/liberacao` | 1 | 0 | — | Avaliada |
| Representantes | `/cadastros/representantes` | 6 | 0† | — | Avaliada |
| Produtos | `/cadastros/produtos` | 20 | 2 | SAM-158 | Avaliada |
| Fornecedores | `/cadastros/fornecedores/novo` | 14 | 1 | SAM-168 | Avaliada |
| Caminhões | `/cadastros/caminhoes` | 21 | 1 | SAM-165 | Avaliada |
| Motoristas | `/cadastros/motoristas` | 16 | 0† | — | Avaliada |
| Rotas | `/cadastros/rotas` | 8 | 3 | SAM-162 | Avaliada |
| Regras de Transformação | `/cadastros/regras-transformacao` | 1 | 1 | SAM-167 | Avaliada |
| Modelos de Etiqueta | `/cadastros/modelos-etiqueta` | 12 toggles | 0 | — | Avaliada |
| Itens de Compra | `/cadastros/itens-compra/novo` | 5 | 2 | SAM-158 | Avaliada |
| Itens Comerciais | `/cadastros/itens-comerciais/novo` | 6 | 2 | SAM-158 | Avaliada |
| Usuários | `/admin/usuarios` | 15 | 0 | — | Avaliada |
| Perfis | `/admin/perfis` | 0 (matriz) | 0 | — | Avaliada |
| Parâmetros | `/admin/parametros` | 3 | 0 | — | Avaliada |
| Auditoria | `/admin/auditoria` | 6 | 1 | SAM-160 | Avaliada |

\* Select de operação no dashboard lista rótulos duplicados (mesmo nome em dias diferentes) — UX de identificação, fora do escopo de domínio de input.  
† Placa/motorista no recebimento, tipo/canal do representante e nacionalidade do motorista: ver §4.  
‡ Select de produto sem busca com poucas opções hoje; coberto por SAM-160 se o catálogo crescer.

---

## 6. Matriz de campos problemáticos

| Tela | Campo | Componente atual | Domínio | Recomendação | Severidade | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Clientes genérico | Representante | Text (UUID) | FK representantes | Searchable Combobox | Alta | SAM-157 |
| Clientes genérico | Prioridade | Text | enum `normal\|alta` | Select | Alta | SAM-157 |
| Clientes genérico | Rota | Ausente | FK rotas | Combobox (ou desativar rota) | Alta | SAM-157 |
| Produto | Unidade do pedido | Text (`Peça`) | string; seed `unidade` | Select alinhado a `unidadePreco` | Média | SAM-158 |
| Itens de Compra | Unidade de compra | Text | string; seed `unidade` | Select | Média | SAM-158 |
| Itens Comerciais | Unidade comercial | Text | string; seed `unidade` | Select | Média | SAM-158 |
| Pré-Faturamento | ID do Caminhão | Text (UUID) | carga/frota do dia | Searchable Combobox | Alta | SAM-159 |
| Pedido de Venda | Produto | SelectNative (14) | FK itens comerciais | ComboboxField | Média | SAM-160 |
| Compras | Item de compra | SelectNative | FK itens compra | ComboboxField | Média | SAM-160 |
| Clientes comercial | Representante / Rota | Select sem busca | FKs | ComboboxField | Baixa/Média | SAM-160 |
| Pedido de Venda | Rota | Text | cadastro rotas / `rotaId` | Combobox (confirmar FK) | Média | SAM-161 |
| Rotas | Representante/Caminhão/Motorista padrão | Text | cadastros | Combobox + FK | Alta | SAM-162 |
| Carga | Motorista, Rota | Text | cadastros | Combobox | Média | SAM-163 |
| Entrada de Itens | Fornecedor/origem | Text | cadastro fornecedores | Combobox + `fornecedorId` | Média | SAM-164 |
| Clientes / Caminhões | UF | Text | 27 UFs | Select | Média | SAM-165 |
| Clientes | Nome Fantasia/Marca | Text (label) | — | Renomear | Alta | SAM-166 |
| Regras de Transformação | Item comercial / compra | UUID na grid | FKs | Label + Combobox | Alta | SAM-167 |
| Fornecedor | Nota/tolerância/horário | Select/number | **não está no DTO** | Persistir ou remover | Alta | SAM-168 |

Campos confirmados como texto livre legítimo (não issue): razão social, documento, endereço (exceto UF), observações, pesos, quantidades, senha, rótulo de operação extraordinária, busca de listagens.

Combos já adequados: status ativo/inativo, tipo operacional, unidade de preço, tipo de vínculo do motorista, motivo de ajuste, motivo de divergência de carga, filtros de status de pedido/overbooking/NF, perfis de usuário (checkbox), cliente no pedido (`ComboboxField` testado).

---

## 7. Telas visitadas (menu canônico)

Ordem de `app/frontend/src/lib/menu-v2.ts`, todas abertas autenticado como Administrador:

**Comercial:** Clientes, Pedidos de Venda, Tabela de Preços, Disponibilidade, Espelho Comercial.  
**Gestão:** Painel, Operações, Compras, Overbooking, Aprovações, Relatórios SIF.  
**Recebimento:** Recebimento de Carga (incl. Novo Recebimento), Pesagem, Etiquetas.  
**Desossa:** Dashboard, Pesagem, Etiquetas.  
**Estoque:** Consulta, Entrada de Itens, Ajustes.  
**Carga:** Planejamento, Conferência, Enviar para Faturamento.  
**Faturamento:** Pré-Faturamento, Notas/XML, Seguro Manual, Liberação.  
**Cadastros:** Representantes, Produtos (Novo + abas), Fornecedores (novo), Caminhões (novo), Motoristas (novo), Rotas (novo), Regras de Transformação, Modelos de Etiqueta, Itens de Compra (novo), Itens Comerciais (novo).  
**Admin:** Usuários (Novo), Perfis, Parâmetros, Auditoria.

Extra (não está no menu): `/cadastros/clientes/novo`.

---

## 8. Recomendações gerais

1. **Adotar `ComboboxField` como padrão de FK.** Já está no DS. Não criar um terceiro padrão de select.
2. **Uma UI por cadastro.** Redirecionar `/cadastros/clientes*` para `/comercial/clientes` ou aposentar `cadastros-config` para clientes.
3. **Fechar unidades de medida** no backend (`z.enum`) no mesmo PR que a UI, senão o texto volta pela API.
4. **Nunca mostrar UUID como título.** Label de negócio + ID só em detalhe técnico.
5. **Todo campo visível precisa persistir** (fornecedor parâmetros). Select fantasma é pior que texto livre.
6. **UF é enum estático** — não espera cadastro.
7. **Confirmar com negócio** a lista do §4 antes de transformar categoria, NCM, placa de recebimento e tipo/canal.

---

## 9. Respostas objetivas do critério final

1. **Textos que deveriam ser combo:** representante/prioridade (clientes genérico), unidades (3 cadastros), caminhão no pré-faturamento, rota do pedido, padrões da rota, motorista/rota na carga, fornecedor na entrada de estoque, UF.  
2. **Combos que deveriam ter pesquisa:** produto no pedido, item na compra, representante/rota no cliente e no espelho, usuário na auditoria, recebimento nas etiquetas — [SAM-160](https://linear.app/sammuka/issue/SAM-160).  
3. **Valores fora do domínio:** prioridade e UUID no form genérico (UI aceita, backend rejeita); unidades e nomes de fornecedor/rota (backend aceita qualquer string); parâmetros de fornecedor (UI “salva”, backend descarta).  
4. **Enums mal representados:** `prioridade` do cliente; unidades vs `unidadePreco`; UF.  
5. **FKs como texto:** representanteId, caminhaoId (pré-fat), rota/motorista/fornecedor em várias telas, itens na grid de regras.  
6. **Inconsistências:** cliente comercial vs genérico; fornecedor compras vs estoque; rota cliente vs pedido vs carga vs cadastro de rotas.  
7. **Risco real de dado errado:** UUID, unidade `Peça`, parâmetros de fornecedor silenciados, strings paralelas de rota/fornecedor/motorista.  
8. **Issues:** SAM-156 … SAM-168.  
9. **Regras a confirmar:** §4.  
10. **Cobertura:** 39/39 rotas de menu + formulários de criação associados + `/cadastros/clientes/novo`.
