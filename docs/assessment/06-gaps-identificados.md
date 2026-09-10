# 06 — Gaps identificados, inconsistências e regras a confirmar

> Consolidação de tudo que a análise estática do código, do schema e da documentação apontou como
> **possível** desvio. Este documento é uma **hipótese de trabalho**, não um relatório de defeitos:
> cada item precisa ser confirmado ou refutado durante a homologação assistida.
>
> **Regra de leitura:** nada aqui foi observado em execução. A coluna *Comportamento atual* descreve o que
> o **código** faz; a coluna *Comportamento esperado* descreve o que a **especificação** ou o bom senso
> operacional sugerem. Quando não há base para afirmar o esperado, o tipo é **REGRA A CONFIRMAR**.

---

## Como este documento foi construído

| Fonte de evidência | O que foi analisado |
|---|---|
| Frontend | 50 telas (`page.tsx`), componentes de modal/wizard, `menu-v2.ts`, gates de permissão |
| Backend | Controllers (endpoints + `@RequirePermissao`), services (invariantes e exceções), matrizes `TRANSICOES_*` |
| Banco | Schemas Drizzle, CHECK constraints, índices únicos, migrations |
| Especificação | v1.1 (§6 a §16), constituição, `DECISOES.md` (AD-01..AD-06), plano mestre, matriz de rastreabilidade |
| Testes | Specs Playwright (`jornada-operacional.spec.ts`, `onda*.spec.ts`) e testes de unidade do backend |

---

## Resumo por tipo

| Tipo | Quantidade | Severidade predominante |
|---|---:|---|
| GAP FUNCIONAL | 14 | Média |
| GAP DE PROCESSO | 9 | Alta |
| GAP DE VALIDAÇÃO | 9 | Média |
| REGRA A CONFIRMAR | 8 | Média |
| GAP DE UX | 6 | Baixa |
| GAP DE PERMISSÃO | 5 | Alta |
| GAP DE DADOS | 5 | Média |
| GAP DE DOCUMENTAÇÃO | 2 | Baixa |
| GAP DE INTEGRAÇÃO | 1 | Média |
| **Total** | **59** | |

## Resumo por severidade

| Severidade | Quantidade | Significado para a homologação |
|---|---:|---|
| **Crítica** | 5 | Impede concluir uma jornada de negócio ou compromete integridade/fiscal |
| **Alta** | 19 | Bloqueia um caminho relevante ou cria risco operacional real |
| **Média** | 25 | Prejudica a experiência ou deixa brecha, mas há contorno |
| **Baixa** | 10 | Ajuste cosmético ou de documentação |

---

# Matriz consolidada de gaps

| ID | Jornada | Tela | Tipo | Descrição | Comportamento atual | Comportamento esperado | Severidade | Evidência |
|---|---|---|---|---|---|---|---|---|
| **GAP-001** | JRN-ADM-006 | `/admin/perfis` | VALIDAÇÃO | Limite de menus menor que o catálogo | O schema valida `max(39)` menus por perfil | O catálogo canônico tem **41** rotas desde AD-11; deve caber o catálogo inteiro | Média | `menus-canonicos.ts` vs. validação do DTO |
| **GAP-002** | JRN-ADM-002, JRN-CAD-000 | Todos os cadastros e `/admin/usuarios` | FUNCIONAL | Restauração sem caminho na UI | `POST /:id/restaurar` existe no backend, mas **nenhum botão** o chama | Registro excluído (soft delete) deve poder ser restaurado pela tela | Média | Controllers de cadastros × ausência de `restaurar` nas páginas |
| **GAP-003** | JRN-ADM-003 | `/admin/usuarios` | PERMISSÃO | Permissão sem menu correspondente | `gestor` tem `USUARIOS_APROVAR` mas **não** tem `/admin/usuarios` no menu | Quem pode aprovar deve alcançar a tela pela navegação | Alta | `menus-canonicos.ts` × matriz de permissões do seed |
| **GAP-004** | JRN-ADM-005 | `/admin/perfis` | PROCESSO | Sem trava de "último administrador" | É possível remover todas as permissões do perfil `administrador` | Deve haver salvaguarda contra deixar a instalação sem administrador efetivo | Alta | Service de perfis sem verificação de invariante |
| **GAP-005** | JRN-EXP-001-A3 | `/carga/planejamento` | FUNCIONAL | Transferência de item sem botão | `POST /operacao/expedicao/itens/:itemId/transferir` existe; a UI não expõe | Expedição deve conseguir mover peça entre caminhões pela tela | Média | Controller de expedição × página de planejamento |
| **GAP-006** | JRN-ADM-007 | `/admin/parametros` | FUNCIONAL | Parâmetro não editável pela UI | `estoque.limiar_aprovacao_ajuste` (tipo `numero`) não tem controle na tela | Todo parâmetro operacional deve ser editável por quem administra | Média | Seed de parâmetros × componentes da tela |
| **GAP-007** | JRN-CAD-000-N4, JRN-CAD-006-N3 | Cadastros com documento | VALIDAÇÃO | Dígito verificador de CNPJ/CPF | Não foi localizada validação de DV — aparentemente só formato | Documento fiscal inválido deve ser rejeitado no cadastro, não no faturamento | Alta | Ausência de validador de DV nos DTOs |
| **GAP-008** | JRN-CAD-001-N1, 005-N4, 006-N6, 007-N3 | Todos os cadastros | REGRA A CONFIRMAR | Efeito de inativar/excluir registro com vínculos | Não há bloqueio nem aviso ao inativar entidade já referenciada | Definir: bloquear, avisar, ou permitir com herança do estado | Alta | Services de cadastros sem verificação de dependência |
| **GAP-009** | JRN-CAD-002 | `/cadastros/produtos` | FUNCIONAL | Preço do produto desabilitado | Campo **Preço por kg (R$)** desabilitado com nota de lacuna de API | O preço vive na tabela diária (M09) — o campo confunde; remover ou explicar | Média | Aba **Comercial** da tela de produtos |
| **GAP-010** | JRN-SEG-001 | `/faturamento/seguro-manual` | FUNCIONAL | Anexo sem arquivo | **Anexar comprovante** grava apenas nome e descrição | Comprovante de averbação deve ser armazenado e recuperável | Alta | `POST /seguros/:id/anexos` com DTO `{ nome, descricao }` |
| **GAP-011** | JRN-FAT-004-N2 | `/faturamento/notas-xml` | INTEGRAÇÃO | XML/DANFE indisponíveis com o fake | `linkNfse` não é preenchido pelo `FakeNfseGateway` | Homologação deveria conseguir validar o download; hoje só em ambiente EISS real | Média | `FakeNfseGateway` × tooltips da tela |
| **GAP-012** | JRN-OPE-003-N3 | `/gestao/operacoes`, `/comercial/pedidos` | PROCESSO | Operação fechada não bloqueia mutações | Não há verificação explícita de operação fechada ao criar pedido/compra | Operação fechada deveria congelar o dia | **Crítica** | Services de pedidos/compras sem checagem de status da operação |
| **GAP-013** | JRN-ADM-007-A1, JRN-PVD-003-N5 | `/admin/parametros` | DOCUMENTAÇÃO | Parâmetro de overbooking possivelmente legado | `comercial.overbooking_permitido` existe, mas AD-05 tornou o overbooking sempre permitido com confirmação | Esclarecer se o parâmetro ainda tem efeito ou deve ser removido | Média | Seed de parâmetros × AD-05 em `DECISOES.md` |
| **GAP-014** | JRN-CAD-005-N2 | `/cadastros/fornecedores` | VALIDAÇÃO | Faixa da tolerância de divergência | Não foi localizada validação de faixa (0–100%) | Percentual fora da faixa deve ser rejeitado | Média | DTO de fornecedor |
| **GAP-015** | JRN-CAD-006-N4 | `/comercial/clientes` | VALIDAÇÃO | Faixa de peso sem validação cruzada | Mínimo pode ser maior que o máximo | Deve haver validação cruzada mín ≤ máx | Média | DTO de preferências do cliente |
| **GAP-016** | JRN-CAD-008-N4 | `/cadastros/caminhoes` | REGRA A CONFIRMAR | Certificado vencido | Aceita validade no passado sem alerta | Definir se bloqueia o cadastro ou apenas a liberação do caminhão | Média | DTO de frota × checklist de liberação |
| **GAP-017** | JRN-CAD-012-N1 | `/cadastros/modelos-etiqueta` | VALIDAÇÃO | Etiqueta sem campos | Permite desmarcar todos os campos | Etiqueta em branco não deve ser salvável | Baixa | DTO de modelo de etiqueta |
| **GAP-018** | JRN-OPE-001, JRN-DIS-001 | `/gestao/operacoes`, `/comercial/disponibilidade` | PERMISSÃO | Leitura sem permissão nomeada | `GET /operacoes` exige apenas JWT; a página de disponibilidade também | Leitura deveria exigir permissão nomeada, como nos demais módulos | Alta | Controllers sem `@RequirePermissao` na leitura |
| **GAP-019** | JRN-OPE-002-N4 | `/gestao/operacoes` | REGRA A CONFIRMAR | Operação retroativa | Aceita criar operação com data passada | Definir se é caso de uso legítimo (regularização) ou erro | Média | DTO de operação sem validação de data |
| **GAP-020** | JRN-OPE-003-N4 | `/gestao/operacoes` | PROCESSO | Fechar operação com pendências | Não verifica recebimento em andamento, carga aberta ou nota pendente | Fechamento deveria listar as pendências e exigir confirmação | Alta | Service de operações |
| **GAP-021** | JRN-CAD-007 | `/cadastros/rotas` | PERMISSÃO | Permissão da UI diverge do endpoint | A tela checa `EXPEDICAO_GERENCIAR`/`CLIENTES_LER`; o endpoint exige `ROTAS_GERENCIAR` | UI e backend devem checar a mesma permissão | Alta | Página de rotas × controller de rotas |
| **GAP-022** | — | `/cadastros/fornecedores` | DADOS | Rota genérica inalcançável | A rota estática dedicada vence; a config genérica de `fornecedores` nunca é usada | Remover a configuração morta ou a rota duplicada | Baixa | `[recurso]/page.tsx` × rota estática |
| **GAP-023** | — | — | DADOS | Componente órfão | `components/placeholder-page.tsx` (`"Em desenvolvimento"`) não é importado por nenhuma rota | Resíduo de andaime; remover | Baixa | Busca por importações |
| **GAP-024** | JRN-CAD-006-A3 | `/cadastros/clientes` | DOCUMENTAÇÃO | Duplicata legada | Rota genérica de clientes alcançável, fora do menu por AD-11 | Documentar ou remover a duplicata de `/comercial/clientes` | Baixa | Config do CRUD genérico |
| **GAP-025** | — | Todas as listas | UX | Sem ordenação de coluna | Só as paradas de rota têm ordenação (**Subir**/**Descer**) | Listas longas deveriam permitir ordenar por coluna | Baixa | Componentes de tabela |
| **GAP-026** | — | — | FUNCIONAL | Sem importação em massa | Nenhuma tela de importação (CSV/planilha) em todo o sistema | Carga inicial de clientes/produtos exigiria digitação manual | Média | Ausência de rota/endpoint de importação |
| **GAP-027** | JRN-CMP-001-N5 | `/gestao/compras` | REGRA A CONFIRMAR | Quantidade sem teto | Aceita quantidade arbitrariamente alta | Definir se há teto operacional ou alerta | Baixa | CHECK só valida `> 0` |
| **GAP-028** | JRN-CMP-001-N6 | `/gestao/compras` | VALIDAÇÃO | Item de compra duplicado na mesma compra | Comportamento não determinado | Deve somar ou bloquear, explicitamente | Média | DTO de itens da compra |
| **GAP-029** | JRN-CMP-002-N2 | `/gestao/compras` | **PROCESSO** | **Confirmação silenciosa sem disponibilidade** | Item sem regra de desdobramento: a compra confirma e **nenhuma disponibilidade é gerada**, sem aviso | Deve bloquear a confirmação ou avisar explicitamente | **Crítica** | Service de compras × `regras_desdobramento_comercial` |
| **GAP-030** | JRN-CMP-003-N2 | `/gestao/compras` | PROCESSO | Redução abaixo do recebido | Não há trava para reduzir a compra abaixo do que já foi fisicamente recebido | Deve bloquear ou exigir tratativa | Alta | Service de edição de compra confirmada |
| **GAP-031** | JRN-CMP-003-N5 | `/gestao/compras` | DADOS | Edição concorrente | Não foi localizado controle de versão/otimista | Segundo editor deveria receber conflito explícito | Média | Service de compras |
| **GAP-032** | JRN-CMP-004 | `/gestao/compras` | FUNCIONAL | Cancelamento sem botão | `DELETE /comercial/compras-programadas/:id` existe; a UI não expõe | Comprador deve conseguir cancelar rascunho pela tela | Média | Controller × página de compras |
| **GAP-033** | JRN-CMP-004-N3 | `/gestao/compras` | REGRA A CONFIRMAR | Cancelar compra com PF emitido | Comportamento não definido | Definir o efeito em cascata sobre o pedido ao fornecedor | Média | Service de compras |
| **GAP-034** | JRN-DIS-001 | `/comercial/disponibilidade` | UX | Status técnico exposto | Coluna **Status** mostra `gerada`, `parcialmente_reservada`, `esgotada` | Rótulos em português, como nas demais telas | Baixa | Grade de disponibilidade |
| **GAP-035** | JRN-PVD-005-A3 | `/comercial/pedidos` | REGRA A CONFIRMAR | Pedido sem itens | Remover o último item deixa o pedido vazio em rascunho | Definir se cancela automaticamente ou permanece | Média | Service de itens do pedido |
| **GAP-036** | JRN-PVD-007-N3/N4 | `/comercial/pedidos` | PROCESSO | Cancelar pedido já faturado ou em carga fechada | Comportamento não determinado | Deve bloquear com mensagem clara | Alta | Service de cancelamento de pedido |
| **GAP-037** | JRN-PVD-007 | `/comercial/pedidos` | FUNCIONAL | Cancelamento de pedido sem botão | `DELETE /comercial/pedidos/:id` existe; a lista não expõe | Vendedor/gestor deve cancelar pela tela | Alta | Controller × lista de pedidos |
| **GAP-038** | JRN-PVD-009 | `/comercial/pedidos` | DADOS | Status inalcançáveis no filtro | `parcialmente_atendido`, `atendido`, `faturado` e `aguardando_confirmacao_overbooking` existem no schema mas **nenhum endpoint os produz** | Ou implementar o marco (pendência **P15**), ou remover do filtro | Alta | Schema × services de pedidos |
| **GAP-039** | JRN-OVB-003 | `/gestao/overbooking` | REGRA A CONFIRMAR | Comunicação ao cliente doador | Redistribuição reduz a reserva de outro cliente sem política de aviso | Definir a política de comunicação | Alta | Service de redistribuição |
| **GAP-040** | JRN-OVB-005 | `/gestao/overbooking` | PROCESSO | Cancelar pendência não resolve o déficit | A própria tela avisa: o pedido segue em overbooking sem pendência aberta | Confirmar se o estado "déficit órfão" é aceitável | Alta | Texto do modal × service de pendências |
| **GAP-041** | JRN-PRC-004, JRN-FAT-002 | `/comercial/tabela-precos` | **PROCESSO** | **Preço publicado não é consumido** | Nenhum ponto do sistema usa o preço publicado; a NFS-e usa valor digitado à mão | O preço da tabela deveria alimentar pedido e faturamento | **Crítica** | Ausência de referência a `tabelas_preco_itens` nos services de pedido/faturamento |
| **GAP-042** | JRN-PFN-001 | — | **FUNCIONAL** | **Pedido ao Fornecedor sem tela** | Só existe por API e como opção de combobox no recebimento | O v1.1 diz que "o recebimento nasce do Pedido ao Fornecedor" — precisa de tela | **Crítica** | Ausência de rota em `app/(admin)` e de item no menu |
| **GAP-043** | JRN-REC-001-N5 | `/recebimento/recebimento-carga` | VALIDAÇÃO | Chave NF-e sem validação de tamanho | Placeholder diz `44 dígitos`, mas não há validação | Chave inválida deve ser rejeitada | Média | DTO de NF-e |
| **GAP-044** | JRN-REC-001-N6 | `/recebimento/recebimento-carga` | VALIDAÇÃO | Peso bruto × líquido | Aceita bruto menor que líquido | Validação cruzada esperada | Baixa | DTO de NF-e |
| **GAP-045** | JRN-PES-002-N4 | `/recebimento/pesagem-destinacao` | VALIDAÇÃO | Peso manual zero ou negativo | Comportamento não determinado | Peso deve ser positivo | Média | DTO de peso manual |
| **GAP-046** | JRN-DES-004 | `/desossa/etiquetas` | DADOS | Filtro de produto hardcoded | Quatro cortes fixos no código (`Coxão-bola`, `Jacaré`, `Coxão-bola com alcatra`, `Filé curto`) | Filtro deve vir do catálogo | Média | Página de etiquetas da desossa |
| **GAP-047** | JRN-EST-001 | `/estoque/consulta` | UX | Filtro **Reservado** sempre vazio | Herança do protótipo; não há status correspondente no backend | Remover o filtro ou implementar o status | Média | Enum de status × filtros da tela |
| **GAP-048** | JRN-EST-001-A1 | `/estoque/consulta` | FUNCIONAL | Congelamento desabilitado | **Autorizar Congelamento** permanentemente desabilitado (pendência **P3**) | Depende de decisão do negócio sobre política de congelamento | Média | Aba **Sobras & Congelamento** |
| **GAP-049** | JRN-APR-001-N4 | `/gestao/aprovacoes` | PERMISSÃO | Sem segregação criador × aprovador | Diferente do ajuste de estoque (que tem `SEGREGACAO_CRIADOR_APROVADOR`), a aprovação operacional não trava o próprio solicitante | Segregação de funções deveria ser consistente | Alta | Service de aprovações × service de ajustes |
| **GAP-050** | JRN-EXP-001 | `/carga/planejamento` | UX | Três status com o mesmo rótulo | `planejado`, `aguardando_carga` e `em_carga` exibem **Montando** | O usuário não distingue "criado" de "carga aberta" | Média | `expedicao-ui.ts` |
| **GAP-051** | JRN-EXP-001-N10 | `/carga/planejamento` | REGRA A CONFIRMAR | Capacidade excedida | Ocupação passa de 100% sem bloqueio nem alerta | Definir se bloqueia, alerta ou é informativo | Média | Service de expedição |
| **GAP-052** | JRN-EXP-004 | `/carga/conferencia` | FUNCIONAL | Reabertura sem botão | `POST /caminhoes/:id/reabrir` existe e a tela **menciona** "reabertura autorizada pela gestão", mas não há botão | Gestor deve reabrir pela interface | Alta | Controller × páginas de carga |
| **GAP-053** | JRN-EXP-005 | `/carga/enviar-faturamento` | UX | Coluna Observação sempre vazia | Histórico de envios mostra `—` fixo | Ou permitir justificar o envio, ou remover a coluna | Baixa | Página de envio |
| **GAP-054** | JRN-FAT-001 | `/faturamento/pre-faturamento` | UX | Status técnico exposto | `em_consolidacao`, `pronto_para_emitir`… exibidos com `_` trocado por espaço | Rótulos em português | Baixa | Página de pré-faturamento |
| **GAP-055** | JRN-FAT-001 | `/faturamento/pre-faturamento` | PERMISSÃO | Tela sem gate RBAC | A `page.tsx` só exige login; as demais telas redirecionam ou avisam | Consistência de gate por permissão | Alta | Página de pré-faturamento × demais páginas |
| **GAP-056** | JRN-FAT-002 | `/faturamento/pre-faturamento` | **PROCESSO** | **Valor da NF digitado manualmente** | Não há cálculo peso × preço; o operador digita o valor de cada nota | Valor deveria ser calculado a partir das peças conferidas e do preço vigente | **Crítica** | Campo **Valor (R$)** livre no formulário |
| **GAP-057** | JRN-SEG-001 | `/faturamento/seguro-manual` | FUNCIONAL | Anexo sem upload real | Mesma raiz do GAP-010, observada pelo fluxo | Upload e download do comprovante | Alta | `POST /seguros/:id/anexos` |
| **GAP-058** | — | — | FUNCIONAL | Sem módulo de notificações | Único canal são os alertas do Painel Geral e os eventos WebSocket nas telas abertas | Operador fora da tela não é avisado de overbooking, divergência ou seguro pendente | Alta | Ausência de rota/tabela de notificações |
| **GAP-059** | — | `/gestao/relatorios` | FUNCIONAL | Sem relatórios gerenciais | Só os 4 relatórios SIF, todos provisórios (P8) | Vendas por cliente, margem, produtividade da desossa, ranking de representantes | Média | Catálogo SIF como única fonte de relatórios |

---

# Gaps críticos — leitura dirigida

Cinco gaps (contando GAP-041 e GAP-056 como um par indissociável) merecem decisão antes de qualquer
go-live, porque **quebram uma jornada de negócio ou criam risco fiscal**.

## GAP-012 — Operação fechada não congela o dia
O ciclo `aberta → em_andamento → fechada` existe e a transição é validada, mas **nada impede** criar
pedido, compra ou movimento numa operação já fechada. O fechamento vira um rótulo, não um controle.
**Como testar:** feche a operação de hoje e tente criar um pedido nela (`JRN-OPE-003-N3`).
**Decisão necessária:** o fechamento deve bloquear mutações? Quais exceções (correção autorizada)?

## GAP-029 — Compra confirma sem gerar disponibilidade, em silêncio
Se o item de compra não tem regra de desdobramento vigente, a confirmação **passa** e a disponibilidade
fica zerada. O comprador acredita ter comprado; o comercial não tem o que vender; ninguém é avisado.
Isso viola diretamente o princípio "nenhuma falha silenciosa" (RA-05).
**Como testar:** `E2E-005` — omita o passo 1.6 do E2E e siga até o Bloco 2.
**Decisão necessária:** bloquear a confirmação ou exibir aviso bloqueante com a lista de itens sem regra.

## GAP-041 + GAP-056 — O preço não circula pelo sistema
Existe uma tela completa de **Tabela de Preços** com faixas A/B/C/D, publicação e histórico — e o preço
publicado **não é lido por ninguém**. No faturamento, o operador **digita o valor** de cada NFS-e à mão.
Consequências: risco de erro de digitação em documento fiscal, ausência de conferência de margem e o
trabalho de manter a tabela sem retorno.
**Como testar:** publique a tabela (`JRN-PRC-004`), crie um pedido e observe que nenhum preço aparece;
depois emita a nota (`JRN-FAT-002`) e observe o campo **Valor (R$)** livre.
**Decisão necessária:** o valor da NFS-e deve ser calculado como `peso conferido × preço da faixa do
cliente`? Se sim, isso é uma feature de porte, não um ajuste.

## GAP-042 — Pedido ao Fornecedor não tem tela
A especificação v1.1 é explícita: "o recebimento nasce do Pedido ao Fornecedor". O objeto existe, tem
status próprio (`rascunho → enviado → aguardando_recebimento → recebido → encerrado`), tem endpoints e
permissão dedicada (`PEDIDO_FORNECEDOR_GERENCIAR`) — mas **não tem interface**. Na prática, o comprador
não consegue emitir o pedido sem apoio técnico, e o elo mais importante entre planejamento e operação
física fica invisível.
**Como testar:** `JRN-PFN-001` — procure o item no menu; não existe.
**Decisão necessária:** é escopo de onda futura ou lacuna? Se for futuro, o E2E depende de API até lá.

---

# Regras que precisam de confirmação do negócio

Estas **não são defeitos**. São pontos em que o código não decide e a especificação não fecha. Cada uma
deveria virar um AD-xx em `docs/execucao/DECISOES.md` antes de ser homologada.

| # | Pergunta ao negócio | Gap relacionado | Impacto se não decidir |
|---|---|---|---|
| R1 | Inativar cliente/fornecedor/representante com vínculos ativos: bloqueia, avisa ou permite? | GAP-008 | Cadastro inconsistente em produção |
| R2 | CNPJ/CPF deve ter validação de dígito verificador no cadastro? | GAP-007 | Bloqueio só no faturamento, tarde demais |
| R3 | Operação com data retroativa é caso legítimo (regularização)? | GAP-019 | Risco de lançamento em dia errado |
| R4 | Fechar operação com recebimento/carga pendente deve ser bloqueado? | GAP-020 | Dia fecha com trabalho em aberto |
| R5 | Pedido em operação fechada: bloqueado ou permitido com autorização? | GAP-012 | Integridade do dia operacional |
| R6 | Item de compra duplicado na mesma compra: soma ou bloqueia? | GAP-028 | Compra dobrada por engano |
| R7 | Reduzir compra abaixo do já recebido: bloqueia? | GAP-030 | Disponibilidade negativa lógica |
| R8 | Pedido que fica sem itens deve ser cancelado automaticamente? | GAP-035 | Pedidos fantasmas na lista |
| R9 | Cancelar pedido faturado ou em carga fechada: permitido? | GAP-036 | Divergência entre físico e fiscal |
| R10 | Redistribuição de overbooking: como o cliente doador é comunicado? | GAP-039 | Cliente perde reserva sem saber |
| R11 | Cancelar pendência sem resolver o déficit é aceitável? | GAP-040 | Overbooking órfão sem dono |
| R12 | O valor da NFS-e deve ser calculado (peso × preço) ou digitado? | GAP-041, GAP-056 | Risco fiscal direto |
| R13 | Capacidade do caminhão excedida: bloqueia, alerta ou informa? | GAP-051 | Carga acima do permitido |
| R14 | Certificado de caminhão vencido: bloqueia cadastro ou só liberação? | GAP-016 | Caminhão irregular na rua |
| R15 | Preço `0` na tabela é válido (brinde/bonificação)? | JRN-PRC-003-N2 | Faturamento com valor zero |
| R16 | Faixa de peso do cliente: mín > máx deve ser bloqueado? | GAP-015 | Sugestão de peça nunca casa |
| R17 | Tolerância de divergência do fornecedor: qual a faixa válida? | GAP-014 | Divergência nunca ou sempre disparada |
| R18 | Quantidade máxima por compra: existe teto operacional? | GAP-027 | Erro de digitação vira compra gigante |
| R19 | Peso manual `0` deve ser aceito? | GAP-045 | Peça sem peso na rastreabilidade |
| R20 | Etiqueta sem nenhum campo pode ser salva? | GAP-017 | Etiqueta em branco na operação |
| R21 | Cancelar compra com pedido ao fornecedor emitido: qual o efeito em cascata? | GAP-033 | Pedido órfão no fornecedor |
| R22 | Aprovação operacional deve ter segregação criador × aprovador? | GAP-049 | Controle interno inconsistente |
| R23 | Sistema precisa de notificações fora da tela (e-mail, push, central)? | GAP-058 | Pendência não vista até o dia seguinte |
| R24 | Quais relatórios gerenciais o negócio precisa além do SIF? | GAP-059 | Gestão sem indicador |
| R25 | `comercial.overbooking_permitido` ainda tem função após AD-05? | GAP-013 | Parâmetro enganoso |

---

# Pendências já reconhecidas (badges "Provisório")

Não são gaps — são **decisões conscientemente adiadas**, sinalizadas na própria interface conforme o
Princípio VIII. Estão listadas aqui para que o homologador **não as reporte como defeito**.

| Código | Onde aparece | O que está pendente | Efeito na homologação |
|---|---|---|---|
| **P1** | Etiquetas (recebimento), Consulta de Estoque | Definição do local/câmara de estoque | Local exibido como provisório |
| **P3** | Estoque → **Sobras & Congelamento** | Política de congelamento | **Autorizar Congelamento** desabilitado |
| **P5** | Modal **Registrar adendo** | Política de preço em adendos | Adendo herda o preço vigente |
| **P8** | Relatórios SIF | Modelos oficiais do SIF | Nomes e campos provisórios; **não homologar conteúdo, só fluxo** |
| **P9** | Modelos de Etiqueta | Layout oficial da etiqueta | Configuração de campos é provisória |
| **P12** | Desossa (painel e pesagem) | Validação das 2 regras de transformação | Regras A/B provisórias |
| **P15** | Espelho Comercial | Marco exato de fechamento do pedido | "Fechado" = "finalizado" por ora; ligado ao GAP-038 |

---

# Como registrar o resultado da homologação

Para cada gap, ao final da execução, preencha:

| Campo | Valores possíveis |
|---|---|
| **Situação** | `Confirmado` · `Refutado` · `Parcialmente confirmado` · `Não testado` |
| **Evidência** | caminho do print/vídeo em `evidencias/` |
| **Severidade real** | reavaliada após observar em execução |
| **Encaminhamento** | `Defeito` · `Melhoria` · `Decisão de negócio (AD-xx)` · `Sem ação` |

> Um gap **refutado** é um resultado tão valioso quanto um confirmado: significa que o código faz mais do
> que a leitura estática conseguiu enxergar. Registre com a mesma disciplina.
