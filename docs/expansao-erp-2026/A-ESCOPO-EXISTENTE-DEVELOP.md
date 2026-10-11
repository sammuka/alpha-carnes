# CADERNO A — AlphaCarnes: escopo operacional definido e existente no desenvolvimento
**Versão:** 1.0 • **Data-base:** 10/10/2026 • **Branch analisada:** `develop` @ `db9d8ac1760a01c262c57a9f824d2c8fcf18291b` • **Uso:** negociação, inventário do escopo pré-expansão e auditoria de status.

## 0. Objetivo e precisão contratual
Este documento cataloga **39 telas canônicas** do AlphaCarnes original. **Implementado em código não equivale a homologado na operação**. O escopo documentado deve ser validado com os usuários para aceite final. Telas em código não garantem funcionamento de hardware externo ou autorizações SEFAZ. Não confundir detalhamento de norma/reunião (requisito) com entrega. O plano da Onda 14 e migrations 0037–0043 estão na branch, mas tasks ALP podem estar desatualizadas. NFS-e EISS Osasco não é NF-e estadual de mercadorias.

## 1. Referências e convenções de estado
- Código: `app/frontend/src/lib/menu-v2.ts`, `app/backend/src/common/rbac/menus-canonicos.ts`, módulos NestJS, schema e testes em `develop`.
- Especificação histórica: `docs_v2/04_especificacao_telas_campos.md` e `docs/001..018` (junho/julho 2026); planos operacionais `docs/superpowers/plans/`; reuniões 25/09 e 01/10/2026.
- Estados: **[I]** tela implementada no repositório, **[P]** parcial/legado, **[H]** homologação externa/usuário ainda não demonstrada, **[R]** requisito descritivo.
- A anotação 'implementado' é baseada em presença de código e arquitetura; não certifica qualidade, produção, resultado de execução de testes nessa análise ou equivalência visual ao protótipo.

## 2. Jornadas ponta a ponta dentro do escopo original
**JO-01 — Planejar compra:** Fabrício abre operação → planeja uma ou várias compras por fornecedor → aplica regra de desdobramento BOI e quantidades → confirma → gera disponibilidade virtual → vendedor consulta saldo. Aceite: nenhum desdobramento duplica físico; compras diferentes preservam lotes diferentes.
**JO-02 — Negociar e registrar pedidos:** cliente e representante → consulta disponibilidade/tabela por dia e faixa → reserva item e trata overbooking explícito → registra preço aplicado/ajustes → finaliza. Aceite: estoques e reservas atômicos, preço congelado, histórico de negociação.
**JO-03 — Receber frigorífico:** pedido ao fornecedor → recebimento, NF estruturada manual e romaneio → conferência de unidades/peso/peças → pesagem → divergência → destino a pedido, estoque ou desossa → etiqueta. Aceite: peça permanece única e rastreável; ausência da balança serial não impede caminho manual aprovado.
**JO-04 — Transformar carne:** TZ mãe → regra de desossa → cortes filhos pesados → destino a pedido/estoque → etiquetas → atualizar disponibilidade/saldos. Aceite: rastro mãe-filho e quantidade física conservados.
**JO-05 — Separar e carregar:** pedido atendido → planejar caminhão/rota/motorista → carga de peças elegíveis → conferência QR/manual → registrar divergências → fechar → enviar a faturamento. Aceite: itens não carregados não aparecem na consolidação.
**JO-06 — Legado fiscal e saída:** consolidar pedidos/carga → operar fluxo NFS-e EISS incipiente → seguro manual pendente/enviado/confirmado → checklist e liberação. **Limite:** autorização NF-e 55/SEFAZ-SP, apuração e títulos bancários são novos investimentos.
**JO-07 — Administração e auditoria:** definir perfis, usuários e parâmetros → registrar operação crítica e seus antes/depois → investigar histórico e reabertura com autorização.
**JO-08 — Estoque entre dias:** consultar remanescente físico → destinar ao pedido de operação posterior quando elegível → atualizar prioridade FIFO e disponibilidade, sem contar o mesmo produto como origem virtual adicional.

## 3. Especificação completa tela a tela — 39 rotas
### A-01 — Clientes (`/comercial/clientes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** comercial. **Objetivo de negócio:** Cliente, representantes e destino da venda.
**Dados/campos e controles:** código/nome fantasia/razão social/CPF-CNPJ/IE/endereços/contatos/representante/faixa de preço/rota. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar, editar, filtrar, inativar e navegar aos pedidos. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** representante e enquadramento de acesso exigidos; atualização de faixa de preço registrada. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** cadastro duplicado, documento inválido e dados fiscais faltantes. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** dados fiscais avançados, crédito e inadimplência pertencem ao Caderno B.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/comercial/clientes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.1 Comercial → Clientes

### Objetivo

Cadastrar e consultar clientes/marcas, associando representante, tabela comercial, rota e preferências operacionais.

### Usuários

```text
Comercial
Gestão
Administração
Faturamento, em modo consulta
```

### Campos principais

```text
Código interno
Nome fantasia / marca operacional
Razão social
CNPJ/CPF
Inscrição estadual
Representante obrigatório
Tabela padrão A/B/C/D
Rota padrão
Prioridade padrão
Status ativo/inativo
Responsável comercial
Observações comerciais
```

### Dados fiscais e endereço

```text
Endereço
Número
Complemento
Bairro
Cidade
UF
CEP
E-mail fiscal
Telefone fiscal
Condição fiscal relevante, se houver
```

### Contatos

```text
Nome do contato
Cargo/função
Telefone
WhatsApp
E-mail
Tipo de contato: compra, financeiro, recebimento, fiscal
Principal? sim/não
```

### Preferências operacionais

```text
Prefere peça mais pesada
Prefere peça mais gorda
Prefere melhor acabamento
Faixa de peso mínima, se aplicável
Faixa de peso máxima, se aplicável
Aceita substituição?
Produtos preferidos
Produtos recusados
Observação para balança
Observação para desossa
Observação para carga
```

### Ações

```text
Criar cliente
Editar cliente
Inativar cliente
Consultar histórico de pedidos
Alterar representante, com permissão
Alterar tabela padrão, com permissão
```

### Validações

```text
Representante obrigatório.
Tabela padrão obrigatória para clientes Alpha, se aplicável.
CNPJ/CPF conforme regras fiscais.
Alteração de representante deve registrar histórico.
Alteração de tabela deve registrar histórico.
```

---

</details>

---

### A-02 — Pedidos de Venda (`/comercial/pedidos`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** comercial. **Objetivo de negócio:** Pedido comercial do dia.
**Dados/campos e controles:** operação, cliente, representante, produtos, quantidade, unidade, faixa de preço, valor aplicado, rota, prioridade, overbooking. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** abrir pedido, reservar, adicionar/excluir item, corrigir preço, finalizar, cancelar e consultar. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** reserva atômica, preço congelado na inclusão, alteração auditada; ajuste de preço tem ocorrência Onda 14. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** produto inativo, falta de estoque virtual, edição de pedido fechado, concorrência de reserva. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** recebível, boleto, emissão da NF-e 55, crédito comercial não fazem parte deste fluxo.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/comercial/pedidos/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.2 Comercial → Pedidos de Venda

### Objetivo

Lançar pedidos de venda, validando disponibilidade e registrando preço, quantidade e peso final quando atendido.

### Usuários

```text
Comercial
Gestão
Representantes/canais
Faturamento, em consulta
Carga, em consulta
```

### Cabeçalho do pedido

```text
Número do pedido
Data/hora de criação
Cliente/marca
Representante herdado do cliente
Usuário que lançou
Data prevista de entrega
Rota prevista
Prioridade
Observações comerciais
Status do pedido
```

### Item do pedido

```text
Produto
Tipo operacional do produto
Quantidade pedida
Unidade de pedido
Peso previsto, opcional
Quantidade atendida
Peso atendido
Unidade de preço: kg ou unidade
Preço de tabela
Preço negociado
Valor estimado
Valor final
Status do item
Origem de atendimento: estoque, balança, desossa, caixa, etc.
```

### Ações

```text
Adicionar item
Remover item antes de confirmação
Confirmar pedido
Alterar quantidade antes de atendimento
Definir preço negociado
Consultar disponibilidade do item
Cancelar pedido/item conforme permissão e status
```

### Validações

```text
Não confirmar pedido sem disponibilidade.
Pedido herda representante do cliente.
Produto precisa estar ativo na tabela de venda.
Produto com preço por kg terá valor final apenas após peso real.
Pedido de item transformado consome disponibilidade virtual inteligente.
Pedido de item inteiro consome disponibilidade do próprio item.
```

### Status do item

```text
Aberto
Parcial
Atendido
Fechado
Faturado
Cancelado
```

---

</details>

---

### A-03 — Tabela de Preços (`/comercial/tabela-precos`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** comercial. **Objetivo de negócio:** Tabela comercial vigente.
**Dados/campos e controles:** data da operação, versão da tabela, faixa A-D, preço por kg/unidade, status e autor. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar, copiar, revisar, publicar, consultar histórico e resolver faixa. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** resolução pelo dia de operação; alteração posterior não reprecifica venda concluída. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** tabela não publicada ou produto sem preço obriga definição manual autorizada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não é tabela de tributação, custo contábil, margem líquida ou cálculo de impostos.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/comercial/tabela-precos/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.3 Comercial → Tabela de Preços

### Objetivo

Registrar e consultar tabela diária de preços por produto.

### Usuários

```text
Comercial, conforme permissão
Gestão
Administração
```

### Campos

```text
Data da tabela
Produto
Preço A
Preço B
Preço C
Preço D
Preço representante/canal, se aplicável
Status: rascunho/publicada
Responsável
Data/hora de publicação
Observação
```

### Ações

```text
Criar tabela do dia
Copiar tabela anterior
Editar preços
Publicar tabela
Consultar histórico
```

### Validações

```text
Produto precisa estar ativo para venda.
Publicação deve registrar usuário/data/hora.
Alteração após publicação deve registrar histórico.
```

---

</details>

---

### A-04 — Disponibilidade (`/comercial/disponibilidade`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** comercial. **Objetivo de negócio:** Disponibilidade virtual inteligente.
**Dados/campos e controles:** origem física, disponibilidade por compra, estoque anterior, reservas, produto, transformação e déficit. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** listar, filtrar, consultar composição e impactos de reservas. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** pool por compra/operacão; boi gera partes; origem virtual compartilhada não soma fisicamente várias vezes. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** pedido concorrente, compra complementar, déficit e overbooking autorizado. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não constitui inventário fiscal ou contábil nem determina CMV.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/comercial/disponibilidade/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.4 Comercial/Gestão → Disponibilidade

### Objetivo

Exibir saldo vendável, físico e virtual, considerando estoque, compras, pedidos e regras de transformação.

### Usuários

```text
Comercial
Gestão
Representantes, com escopo limitado
```

### Campos da grade

```text
Produto
Tipo: inteiro, transformado, caixa/unidade, porco, etc.
Disponível para venda
Pronto físico
Estoque anterior
Compra do dia / previsto
Virtual por transformação
Reservado em pedidos
Destinado fisicamente
Em estoque
Em carga
Saldo vendável
Origem compartilhada, quando aplicável
```

### Para itens derivados de TZ

Mostrar saldos potenciais conforme motor virtual.

Exemplo:

```text
Jacaré: 1 disponível
Coxão Bola: 1 disponível
Alcatra: 2 disponíveis
Filé: 1 disponível
Origem compartilhada: 1 TZ
```

### Ações

```text
Filtrar por produto
Filtrar por representante
Filtrar por tipo de origem
Consultar composição da disponibilidade
Consultar reservas que impactam o item
Simular pedido, opcional
```

### Validações

```text
Não somar saldos virtuais concorrentes como estoque físico.
Ao reservar item, recalcular dependentes/compartilhados.
Estoque anterior deve ser priorizado.
```

---

</details>

---

### A-05 — Espelho Comercial (`/comercial/espelho`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** comercial. **Objetivo de negócio:** Espelho de pedidos.
**Dados/campos e controles:** cliente, representante, pedido, produto, data, quantidade, peso atendido e situação. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** agrupar por rota/cliente, consultar, filtrar e imprimir. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** composição espelha pedidos efetivos, sem gerar transações novas. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** cancelamento e atendimento parcial atualizam visão. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não é documento fiscal nem escrituração.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/comercial/espelho/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.5 Comercial → Espelho Comercial

### Objetivo

Gerar visão de pedidos por cliente/rota/carga para apoio operacional e conferência.

### Campos

```text
Data
Representante
Rota
Cliente/marca
Produto
Quantidade pedida
Quantidade atendida
Peso atendido
Status
Observações
```

### Ações

```text
Filtrar
Imprimir
Exportar
Agrupar por cliente
Agrupar por rota
Agrupar por representante
```

---

# 2. GESTÃO

---

</details>

---

### A-06 — Painel Geral da Operação (`/gestao/dashboard`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Painel gerencial.
**Dados/campos e controles:** operação, volumes, compras, vendas, pesagem, desossa, estoque, cargas, pendências. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** filtrar data, navegar ao processo, interpretar alertas. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** indicadores derivam dos movimentos de origem, respeitando perfis. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** sem operação, dados tardios e inconsistências de saldo. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não inclui DRE contábil, fluxo de caixa, saldo bancário.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/dashboard/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-07 — Operações (`/gestao/operacoes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Operação diária.
**Dados/campos e controles:** data operacional, estado, eventos e vínculos com compras/pedidos/recebimentos/cargas. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** abrir/consultar operação, acompanhar estados e fechamento. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** operações agrupam múltiplas compras do mesmo dia após Onda 11. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** tentativa de alterar data de operação já vinculada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** competência contábil não é sinônimo de data da operação.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/operacoes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-08 — Compras (`/gestao/compras`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Compras programadas.
**Dados/campos e controles:** fornecedor, pedido, operação, itens, quantidade, unidade, previsão, disponibilidade. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** abrir compra, adicionar fornecedor, confirmar, gerar disponibilidade, criar pedido ao fornecedor. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** uma operação pode ter múltiplas compras, mantendo pool comercial e lote físico individual; catálogo unificado. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** compra complementar, divergência de preço e cancelamento após reserva. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não constitui contas a pagar definitivo nem escrituração de NF de entrada.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/compras/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 2.2 Gestão → Compras

### Objetivo

Registrar compras previstas ou realizadas que alimentam disponibilidade.

### Campos

```text
Número da compra
Data da compra
Fornecedor/frigorífico
Produto comprado
Quantidade
Unidade
Peso previsto, se aplicável
Data prevista de chegada
Observação
Status
```

### Compra de boi

Campos específicos:

```text
Quantidade de bois
Regra base: 1 boi = 2 DT + 2 PA + 2 TZ
Disponibilidade gerada: DT, PA, TZ
```

### Compra de partes

```text
Produto: TZ, PA, DT
Quantidade
Peso previsto, se houver
```

### Compra de porco

```text
Quantidade de porcos
Geração: 2 bandas por porco
```

### Compra de itens por unidade

```text
Produto
Quantidade
Unidade
Preço/custo, se aplicável
```

### Ações

```text
Criar compra
Editar compra antes de recebimento
Cancelar compra antes de recebimento
Gerar disponibilidade prevista
Consultar recebimento vinculado
```

---

</details>

---

### A-09 — Pendências de Overbooking (`/gestao/overbooking`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Pendências de overbooking.
**Dados/campos e controles:** produto, déficit, pedidos atingidos, compras, status e decisão. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** listar, resolver/postergar, comprovar compra complementar. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** overbooking precisa de confirmação explícita e recalcular reservas sem duplicidade. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** déficit persistente, compra não recebida e parcialidade. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não autoriza faturamento de itens não entregues.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/overbooking/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-10 — Aprovações & Ocorrências (`/gestao/aprovacoes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Aprovações e ocorrências.
**Dados/campos e controles:** tipo, origem, ator, data, impacto, justificativa, decisão e ciência. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consultar fila, aprovar/rejeitar, registrar ciência e histórico. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** ações de gestão segregadas da solicitação; ajuste de preço gera ocorrência informativa. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** reabertura e conflito de concorrência auditados. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não inclui aprovação de pagamentos bancários ou fechamento contábil.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/aprovacoes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-11 — Relatórios & SIF (`/gestao/relatorios`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** gestao. **Objetivo de negócio:** Relatórios operacionais/SIF.
**Dados/campos e controles:** operação, período, entradas/saídas, parâmetros SIF e alterações de preço. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** filtrar, consultar, exportar quando implementado. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** somente movimentos operacionais reais; Onda14 incorpora relatório de ajuste. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** desalinhamento entre compras e saídas. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não substitui SPED/EFD/ECF/ECD nem livros fiscais.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/gestao/relatorios/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-12 — Recebimento de Carga (`/recebimento/recebimento-carga`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** recebimento. **Objetivo de negócio:** Recebimento de carga.
**Dados/campos e controles:** fornecedor, NF número/série/chave, pesos declarados, peças esperadas, produtos e divergências. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar, alterar cabeçalho, registrar itens, suspender, conferir e concluir. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** vinculação com pedido fornecedor e operação; nota estruturada pode ser lançada manualmente. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** chave duplicada, peça a menor, item não previsto e documento incompleto. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** importação automatizada de DF-e/manifestação não é existente.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/recebimento/recebimento-carga/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 3.1 Recebimento & Balança → Recebimento de Carga

### Objetivo

Abrir e acompanhar recebimento físico de carga/lote.

### Campos

```text
Lote
Fornecedor/frigorífico
NF-e
Romaneio
Placa
Motorista
Doca
Data/hora de chegada
Status do recebimento
Observações
```

### Itens previstos/apurados

```text
Produto
Quantidade prevista
Peso previsto
Quantidade apurada
Peso apurado acumulado
Diferença quantidade
Diferença peso
Status do item
```

### Ações

```text
Abrir recebimento
Selecionar item
Ir para pesagem
Registrar divergência
Finalizar recebimento
Suspender recebimento
```

### Modal de divergência ao finalizar

Campos:

```text
Resumo do lote
Item divergente
Tipo de divergência
Quantidade esperada
Quantidade apurada
Peso esperado
Peso apurado
Descrição/motivo
Ação tomada
Responsável
Anexo/foto, se necessário
Confirmar finalização com divergência
```

---

</details>

---

### A-13 — Pesagem e Destinação (`/recebimento/pesagem-destinacao`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** recebimento. **Objetivo de negócio:** Pesagem e destinação.
**Dados/campos e controles:** operação, lote, peça, produto, peso, destino, pedidos compatíveis, cliente/etiqueta. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** capturar manualmente, associar peça ao pedido, direcionar a estoque/desossa, cancelar ações permitidas. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** associar só produto compatível e pedido elegível; peça conserva rastro de origem. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** balança RS-232 real permanece stub indisponível, deve haver fallback manual. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** integração física RS-232 homologada não deve ser faturada como entrega pronta.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 3.2 Recebimento & Balança → Pesagem e Destinação

### Objetivo

Tela operacional principal do Richard para pesar e destinar peças recebidas.

### Campos principais

```text
Lote ativo
Fornecedor/frigorífico
NF/romaneio
Produto atual: DT, PA, TZ, banda de porco
Peso atual
Peso acumulado do produto
Quantidade pesada
Quantidade esperada
Divergência acumulada
Características opcionais:
  - Mais pesada
  - Mais gorda
  - Melhor acabamento
Cliente/marca
Pedidos compatíveis pendentes
Destino: Pedido / Estoque / Desossa
Etiqueta gerada
Operador
Data/hora
```

### Busca

```text
Textsearch apenas por cliente/marca.
```

### Regras de sugestão

```text
Mostrar apenas pedidos compatíveis com o produto atual.
Se produto atual for TZ, mostrar pedidos de TZ inteiro como associáveis.
Pedidos de cortes derivados não são associáveis na balança.
Para TZ reservado virtualmente para transformação, sugerir destino Desossa.
```

### Ações

```text
Capturar peso
Digitar peso manual
Marcar características
Buscar cliente/marca
Associar a pedido
Enviar para estoque
Enviar TZ para desossa
Confirmar e imprimir etiqueta
Reimprimir etiqueta
Listar ações realizadas
Cancelar/estornar ação permitida
Finalizar recebimento
Registrar divergência
```

### Lista de ações realizadas

Campos:

```text
Horário
Produto
Peso
Destino
Cliente/pedido
Etiqueta
Operador
Status
Ação: cancelar/estornar, quando permitido
```

### Cancelamento permitido

```text
Associação a pedido antes de fechamento/carga;
Destino a estoque sem movimentação posterior;
Destino à desossa antes da transformação;
Etiqueta incorreta.
```

### Cancelamento bloqueado

```text
TZ já transformado;
Item já fechado/carregado;
Item faturado;
Caminhão liberado.
```

---

</details>

---

### A-14 — Etiquetas (`/recebimento/etiquetas`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** recebimento. **Objetivo de negócio:** Etiquetas de recebimento.
**Dados/campos e controles:** código da peça, origem, data, peso, produto, destino, cliente/pedido e QR. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consultar, imprimir, reimprimir e cancelar quando permitido. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** etiqueta depende de destino confirmado, invalidar sem apagar trilha. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** driver/impressora real, etiqueta após associação e leitura física em bancada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** entrega de hardware e consumíveis não está incluída.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/recebimento/etiquetas/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 3.3 Recebimento & Balança → Etiquetas

### Objetivo

Gerenciar impressão/reimpressão/cancelamento de etiquetas da balança.

### Tipos de etiqueta

```text
Etiqueta de pedido
Etiqueta de estoque
Etiqueta de destino desossa
Etiqueta de reimpressão
Etiqueta cancelada
```

### Campos da etiqueta

```text
Código único
Produto
Peso
Cliente/pedido, se houver
Destino: pedido, estoque ou desossa
Fornecedor/frigorífico
NF/lote
Data/hora
Operador
Características, se houver
QR Code/código de barras
```

### Ações

```text
Imprimir
Reimprimir
Cancelar etiqueta
Consultar histórico
```

---

# 4. DESOSSA

---

</details>

---

### A-15 — Dashboard da Desossa (`/desossa/dashboard`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** desossa. **Objetivo de negócio:** Dashboard desossa.
**Dados/campos e controles:** necessidade de corte, TZ mãe, cortes faltantes, estoque de partes, prioridade. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** filtrar, abrir faltas, observar atualizações. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** previsão de transformação não cria item físico. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** falta de origem, multiplicidade de regras, pedido cancelado. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não gerencia equipe/folha de pagamento.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/desossa/dashboard/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 4.1 Desossa → Dashboard da Desossa

### Objetivo

Painel estilo aeroporto para orientar a equipe sobre o que falta produzir.

### Usuários

```text
Equipe de desossa
Gestão
Comercial/Gestão em consulta
```

### Campos do painel

```text
Produto
Quantidade faltante para pedidos
Quantidade pronta em estoque
Origem necessária: TZ
Representante, se útil
Rota, se útil
Prioridade, se útil
Última atualização
```

### Visão opcional por regra sugerida

```text
Regra sugerida
Quantidade de TZ sugerida
Produtos gerados
Quantidade para pedidos
Quantidade prevista para estoque
```

### Não exibir

```text
Em produção
Pendente em produção
Trava operacional
```

### Ações

```text
Filtrar por produto
Filtrar por rota
Filtrar por representante
Atualizar painel
Abrir detalhe, se necessário
```

---

</details>

---

### A-16 — Pesagem e Destinação (`/desossa/pesagem-destinacao`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** desossa. **Objetivo de negócio:** Pesagem da desossa.
**Dados/campos e controles:** TZ mãe, regra, partes esperadas, pesos finais, perda, etiquetas e destinos. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** iniciar corte, registrar parte, pesar, destinar, finalizar transformação. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** filhos são rastreáveis à peça mãe; conservação e diferenças de peso geram ocorrência. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** origem já transformada, produto não permitido, perda não justificada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** custos industrialização, perdas contábeis e apuração fiscal pertencem à expansão.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 3.2 Recebimento & Balança → Pesagem e Destinação

### Objetivo

Tela operacional principal do Richard para pesar e destinar peças recebidas.

### Campos principais

```text
Lote ativo
Fornecedor/frigorífico
NF/romaneio
Produto atual: DT, PA, TZ, banda de porco
Peso atual
Peso acumulado do produto
Quantidade pesada
Quantidade esperada
Divergência acumulada
Características opcionais:
  - Mais pesada
  - Mais gorda
  - Melhor acabamento
Cliente/marca
Pedidos compatíveis pendentes
Destino: Pedido / Estoque / Desossa
Etiqueta gerada
Operador
Data/hora
```

### Busca

```text
Textsearch apenas por cliente/marca.
```

### Regras de sugestão

```text
Mostrar apenas pedidos compatíveis com o produto atual.
Se produto atual for TZ, mostrar pedidos de TZ inteiro como associáveis.
Pedidos de cortes derivados não são associáveis na balança.
Para TZ reservado virtualmente para transformação, sugerir destino Desossa.
```

### Ações

```text
Capturar peso
Digitar peso manual
Marcar características
Buscar cliente/marca
Associar a pedido
Enviar para estoque
Enviar TZ para desossa
Confirmar e imprimir etiqueta
Reimprimir etiqueta
Listar ações realizadas
Cancelar/estornar ação permitida
Finalizar recebimento
Registrar divergência
```

### Lista de ações realizadas

Campos:

```text
Horário
Produto
Peso
Destino
Cliente/pedido
Etiqueta
Operador
Status
Ação: cancelar/estornar, quando permitido
```

### Cancelamento permitido

```text
Associação a pedido antes de fechamento/carga;
Destino a estoque sem movimentação posterior;
Destino à desossa antes da transformação;
Etiqueta incorreta.
```

### Cancelamento bloqueado

```text
TZ já transformado;
Item já fechado/carregado;
Item faturado;
Caminhão liberado.
```

---

</details>

---

### A-17 — Etiquetas (`/desossa/etiquetas`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** desossa. **Objetivo de negócio:** Etiquetas desossa.
**Dados/campos e controles:** parte filha, origem, peso, lote, destino e modelo de etiqueta. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** imprimir, reimprimir, consultar, invalidar. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** label da parte conserva genealogia; saída depende de transformação. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** preview do peso pode exibir ausência de informação (ALP-17). Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** integração com impressão física deve ser homologada.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/desossa/etiquetas/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 4.3 Desossa → Etiquetas

### Tipos de etiqueta

```text
Etiqueta de parte para pedido
Etiqueta de parte para estoque
Reimpressão
Etiqueta cancelada
```

### Campos da etiqueta

```text
Código da parte
Produto
Peso
Cliente/pedido, se houver
Destino: pedido ou estoque
Peça mãe / TZ origem
Fornecedor/frigorífico
NF/lote
Data/hora
Operador
Características marcadas
QR Code/código de barras
```

---

# 5. ESTOQUE

---

</details>

---

### A-18 — Consulta de Estoque (`/estoque/consulta`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** estoque. **Objetivo de negócio:** Consulta estoque.
**Dados/campos e controles:** produto, peça, lote, origem, localização, peso, FIFO, status e disponibilidade. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** filtrar, detalhar, consultar saldo e histórico, destinar o que é elegível. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** estoque físico e virtual diferentes, conciliação de cada peça e movimentação auditada. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** reserva concorrente, saldo zerado e localização indisponível. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** inventário fiscal e custo contábil não estão consolidados.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/estoque/consulta/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 5.1 Estoque → Consulta de Estoque

### Objetivo

Consultar a posição física de itens disponíveis, reservados ou destinados.

### Campos

```text
Produto
Tipo operacional
Código/identificador
Quantidade
Peso, se aplicável
Unidade
Origem/fornecedor
NF/lote
Data de entrada
Local/câmara
Status
Características, se aplicável
Pedido reservado, se houver
Representante, se reservado
```

### Filtros

```text
Produto
Tipo
Data
Local/câmara
Status
Origem
Disponível/reservado
Representante
```

### Ações

```text
Consultar histórico
Destinar para pedido, se permitido
Ajustar estoque, conforme permissão
Reimprimir etiqueta, se aplicável
```

---

</details>

---

### A-19 — Entrada de Itens (`/estoque/entrada-itens`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** estoque. **Objetivo de negócio:** Entrada manual estoque.
**Dados/campos e controles:** produto, quantidade, unidade, lote, origem, motivo e operador. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** registrar item manualmente e conferir saldo. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** entrada não apaga nem substitui aquisição ou recebimento de nota. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** duplicidade, falta de rastreio ou produto não permitido. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não reconhece AP ou crédito fiscal automaticamente.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/estoque/entrada-itens/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 5.2 Estoque → Entrada de Itens

### Objetivo

Registrar entrada de itens que não passam por balança ou que entram direto como quantidade.

### Campos

```text
Produto
Quantidade
Unidade
Fornecedor/origem
Lote/NF, se houver
Local/câmara
Destino: estoque ou pedido
Cliente/pedido, se destino pedido
Observação
```

### Regra

Usada principalmente para itens vendidos por unidade, como caixas.

---

</details>

---

### A-20 — Ajustes (`/estoque/ajustes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** estoque. **Objetivo de negócio:** Ajustes de estoque.
**Dados/campos e controles:** item, peso/quantidade antes e depois, motivo, operador, aprovação e rastro. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** solicitar, justificar, aprovar e efetivar ajuste. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** controle por permissão, integridade de origem e histórico. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** ajuste concorrente, baixa maior que saldo e reabertura. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não gera automaticamente lançamento contábil ou SPED.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/estoque/ajustes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 5.3 Estoque → Ajustes

### Objetivo

Permitir ajuste controlado de estoque.

### Campos

```text
Produto
Quantidade/peso atual
Ajuste positivo/negativo
Quantidade/peso ajustado
Motivo
Responsável
Data/hora
Aprovação, se necessário
```

### Ações

```text
Criar ajuste
Aprovar ajuste
Cancelar ajuste
Consultar histórico
```

---

# 6. CARGA

---

</details>

---

### A-21 — Planejamento de Carga (`/carga/planejamento`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** carga. **Objetivo de negócio:** Planejamento carga.
**Dados/campos e controles:** caminhão/placa, motorista, rota, pedidos, itens físicos, volumes e peso. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar carga, adicionar/remover peça, organizar pedido, selecionar veículo. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** cada peça pertence a uma carga ativa; seleção respeita pedido e rota. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** peça já carregada, excesso e cliente fora da rota. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não realiza CT-e/MDF-e, rastreamento GPS ou otimização de rotas por IA.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/carga/planejamento/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 3.1 Recebimento & Balança → Recebimento de Carga

### Objetivo

Abrir e acompanhar recebimento físico de carga/lote.

### Campos

```text
Lote
Fornecedor/frigorífico
NF-e
Romaneio
Placa
Motorista
Doca
Data/hora de chegada
Status do recebimento
Observações
```

### Itens previstos/apurados

```text
Produto
Quantidade prevista
Peso previsto
Quantidade apurada
Peso apurado acumulado
Diferença quantidade
Diferença peso
Status do item
```

### Ações

```text
Abrir recebimento
Selecionar item
Ir para pesagem
Registrar divergência
Finalizar recebimento
Suspender recebimento
```

### Modal de divergência ao finalizar

Campos:

```text
Resumo do lote
Item divergente
Tipo de divergência
Quantidade esperada
Quantidade apurada
Peso esperado
Peso apurado
Descrição/motivo
Ação tomada
Responsável
Anexo/foto, se necessário
Confirmar finalização com divergência
```

---

</details>

---

### A-22 — Conferência (`/carga/conferencia`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** carga. **Objetivo de negócio:** Conferência carga.
**Dados/campos e controles:** caminhão, pedidos, QR/peças, previstos e conferidos, divergências. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** iniciar conferência, ler ou registrar item, apontar falta e concluir. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** fechamento depende de reconciliação física e autorização. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** leitura repetida, produto diferente, peça trocada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não assegura autorização fiscal estadual.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/carga/conferencia/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 6.2 Carga → Conferência

### Objetivo

Conferir fisicamente a carga antes de enviar para faturamento.

### Campos

```text
Carga
Caminhão
Motorista
Rota
Cliente
Pedido
Produto
Código/etiqueta, se aplicável
Quantidade
Peso
Status de conferência
Observação
```

### Ações

```text
Conferir item
Marcar divergência
Reabrir item, se permitido
Finalizar conferência
Enviar para faturamento
```

### Marco de fechamento

Após carga conferida/enviada para faturamento, estornos simples não devem ocorrer sem reabertura autorizada.

---

# 7. FATURAMENTO

---

</details>

---

### A-23 — Enviar para Faturamento (`/carga/enviar-faturamento`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** carga. **Objetivo de negócio:** Enviar para faturamento.
**Dados/campos e controles:** carga, status, itens efetivos, peso, pedido, pendências e checklist. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consolidar, bloquear, encaminhar ao pré-faturamento. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** somente carga fechada deve fornecer itens faturáveis. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** falta de peso, divergência, item não rastreado. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** não constitui emissão SEFAZ/SP.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/carga/enviar-faturamento/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

Não existe recorte 1:1 inequívoco na especificação v0.1; aplicar a definição da rota e conferência no código.

</details>

---

### A-24 — Pré-Faturamento (`/faturamento/pre-faturamento`)
**Status e escopo contratual:** [P] Implementação parcial/legada. **Grupo:** faturamento. **Objetivo de negócio:** Pré-faturamento municipal legado.
**Dados/campos e controles:** caminhão, pedido, cliente, peso e valor informado, status EISS. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consolidar, emitir NFS-e municipal fake/adapter, consultar status. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** gateway EISS Osasco implementado como estrutura inicial NFS-e e não nota de mercadorias. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** parâmetros fiscais provisórios, homologação real EISS pendente. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** NF-e 55 / SEFAZ SP expressamente excluída da linha-base.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/faturamento/pre-faturamento/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 1.3 Comercial → Tabela de Preços

### Objetivo

Registrar e consultar tabela diária de preços por produto.

### Usuários

```text
Comercial, conforme permissão
Gestão
Administração
```

### Campos

```text
Data da tabela
Produto
Preço A
Preço B
Preço C
Preço D
Preço representante/canal, se aplicável
Status: rascunho/publicada
Responsável
Data/hora de publicação
Observação
```

### Ações

```text
Criar tabela do dia
Copiar tabela anterior
Editar preços
Publicar tabela
Consultar histórico
```

### Validações

```text
Produto precisa estar ativo para venda.
Publicação deve registrar usuário/data/hora.
Alteração após publicação deve registrar histórico.
```

---

</details>

---

### A-25 — Notas / XML (`/faturamento/notas-xml`)
**Status e escopo contratual:** [P] Implementação parcial/legada. **Grupo:** faturamento. **Objetivo de negócio:** Notas/XML municipal legado.
**Dados/campos e controles:** documento EISS, número de serviço, pedido, caminhão, valor, status e resposta. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consultar, cancelar/reprocessar se permitido, rastrear e obter histórico. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** NFS-e com EISS é serviço municipal, não protocolo de autorização NF-e 55. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** falhas, timeouts, duplicidade, ausência de payload mercadorias. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** XML NF-e 55 autorizado, DANFE, CC-e, inutilização excluídos.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/faturamento/notas-xml/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 7.2 Faturamento → Notas / XML

### Objetivo

Emitir NF-e e gerar XML.

### Campos

```text
Pedido/carga
Cliente
Produtos
Quantidade
Peso
Preço
Valor
Dados fiscais
Número da nota
Chave de acesso
Status SEFAZ
XML
Data/hora emissão
```

### Ações

```text
Emitir NF-e
Consultar status SEFAZ
Gerar/baixar XML
Cancelar nota, conforme regra fiscal
Reemitir, se aplicável
```

---

</details>

---

### A-26 — Seguro Manual (`/faturamento/seguro-manual`)
**Status e escopo contratual:** [P] Implementação parcial/legada. **Grupo:** faturamento. **Objetivo de negócio:** Seguro manual.
**Dados/campos e controles:** caminhão, valor carga, operador, estado e anexos metadados. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar registro, marcar envio/confirmado, observar, registrar metadados de anexo. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** estado pendente→enviado→confirmado com auditoria. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** upload binário ausente (ALP-15) e decisão humana. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** integração automática com seguradora, apólice e prêmio calculado excluídos.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/faturamento/seguro-manual/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 7.3 Faturamento → Seguro Manual

### Objetivo

Controlar manualmente o envio/confirmação do seguro.

### Campos

```text
Carga
Caminhão
Motorista
Placa
Valor da carga
Notas vinculadas
Status do seguro
Responsável
Data/hora envio
Data/hora confirmação
Observação
Anexo, se houver
```

### Ações

```text
Marcar como pendente
Marcar como enviado
Marcar como confirmado
Anexar comprovante/documento
```

---

</details>

---

### A-27 — Liberação do Caminhão (`/faturamento/liberacao`)
**Status e escopo contratual:** [P] Implementação parcial/legada. **Grupo:** faturamento. **Objetivo de negócio:** Liberação caminhão.
**Dados/campos e controles:** carga, notas legadas, seguro, motorista, checklist e impeditivos. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** verificar, bloquear ou liberar saída. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** caminhão liberado trava cancelamentos e edições indevidas. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** integração fiscal atual municipal inadequada para mercadorias. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** bloqueio por autorização NF-e 55 fará parte da nova integração.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/faturamento/liberacao/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 7.4 Faturamento → Liberação do Caminhão

### Objetivo

Liberar caminhão somente quando carga, nota e seguro estiverem OK.

### Campos

```text
Carga
Caminhão
Motorista
Rota
Status carga
Status NF-e/XML
Status seguro
Pendências impeditivas
Responsável pela liberação
Data/hora liberação
```

### Ações

```text
Validar requisitos
Liberar caminhão
Bloquear alterações operacionais
Consultar histórico
```

### Requisitos

```text
Carga conferida
NF-e emitida
XML gerado
Seguro manual tratado
Caminhão/motorista preenchidos
```

---

# 8. CADASTROS & REGRAS

---

</details>

---

### A-28 — Representantes (`/cadastros/representantes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Representantes.
**Dados/campos e controles:** código, nome, canal, contato e status. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** cadastrar/editar/inativar e associar ao cliente. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** cliente possui representante para escopo comercial. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** usuário sem escopo não pode consultar cliente indevido. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** comissionamento financeiro de vendedores não integra a linha-base.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/representantes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.1 Cadastros & Regras → Representantes

### Campos

```text
Nome
Tipo/canal
Contato
Status
Observação
```

### Uso

```text
Vincular clientes
Filtrar pedidos
Controlar escopo de usuários
Relatórios comerciais
```

---

</details>

---

### A-29 — Produtos (`/cadastros/produtos`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Produtos.
**Dados/campos e controles:** produtoId, código, nome, categoria, unidade, flags compra/venda, transformação, NCM, CFOP, CEST. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar/editar/inativar; selecionar em compra/venda; parametrizar atributos. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** catálogo unificado da Onda 13; fiscal de produto em JSON ainda incipiente. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** regra fiscal varia conforme operação e não pode ser único CFOP fixo. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** motor fiscal, enquadramentos IBS/CBS e cBenef são expansões.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/produtos/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.2 Cadastros & Regras → Produtos

### Campos

```text
Nome
Código
Categoria/família
Unidade de pedido
Unidade de preço
Preço por kg ou unidade
Exige peso?
Passa pela balança principal?
Passa pela desossa?
Pode ser origem de transformação?
Pode ser saída de transformação?
Pode ir para estoque?
Ativo para venda?
Ativo para compra?
Status
```

---

</details>

---

### A-30 — Fornecedores / Frigoríficos (`/cadastros/fornecedores`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Fornecedores.
**Dados/campos e controles:** documento, razão social, contatos, frigorífico, status e condições. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** CRUD, buscar e vincular a pedido compra/recebimento. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** não apagar fornecedor com histórico. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** dados fiscais incompletos e duplicidade. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** contas a pagar, retenções e compliance cadastral completo são expansões.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/fornecedores/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.3 Cadastros & Regras → Fornecedores / Frigoríficos

### Campos

```text
Nome
CNPJ
Contato
Produtos fornecidos
Romaneio antecipado? sim/não
Status
Observações
```

---

</details>

---

### A-31 — Caminhões (`/cadastros/caminhoes`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Caminhões.
**Dados/campos e controles:** placa, veículo, capacidade, situação e vínculos. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** CRUD e seleção logística. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** placa válida, histórico preservado. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** veículo inativo e capacidade incompatível. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** rastreador de frota e TMS externo excluídos.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/caminhoes/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.4 Cadastros & Regras → Caminhões

### Campos

```text
Placa
Descrição
Capacidade, se aplicável
Representante/rota padrão, se houver
Status
```

---

</details>

---

### A-32 — Motoristas (`/cadastros/motoristas`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Motoristas.
**Dados/campos e controles:** nome, documento, contato, veículo padrão e status. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** CRUD e vínculo com carga. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** contato/documento antes de liberação. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** troca após fechamento exige autorização. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** app motorista móvel nativo excluído.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/motoristas/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.5 Cadastros & Regras → Motoristas

### Campos

```text
Nome
Documento
Telefone
Caminhão padrão
Status
```

---

</details>

---

### A-33 — Rotas / Itinerários (`/cadastros/rotas`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Rotas/itinerários.
**Dados/campos e controles:** nome, região, sequência e paradas, veículos/motorista padrão. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar/editar, atribuir, listar e consultar. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** rota integra planejamento mas não define imposto de destino automaticamente. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** rota divergente e múltiplas paradas. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** roteirizador geográfico integrado excluído.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/rotas/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.6 Cadastros & Regras → Rotas / Itinerários

### Campos

```text
Nome da rota
Região
Sequência de clientes, se aplicável
Representante padrão
Caminhão padrão
Motorista padrão
Observações
Status
```

---

</details>

---

### A-34 — Regras de Transformação (`/cadastros/regras-transformacao`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Regras transformação.
**Dados/campos e controles:** produto origem/destino, fator, prioridade, situação e saídas. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar/editar/ativar, simular desdobramento e rendimento. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** BOI→TZ/DT/PA e TZ→cortes, com catálogo produtoId. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** regras cíclicas/ambíguas bloqueadas. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** custos de processo industrial não reconhecidos na contabilidade.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/regras-transformacao/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.7 Cadastros & Regras → Regras de Transformação

### Objetivo

Cadastrar cenários alternativos de abertura do TZ.

### Campos da regra

```text
Nome da regra
Produto origem: TZ
Status ativa/inativa
Prioridade/preferência, opcional
Observação operacional
```

### Saídas da regra

```text
Produto gerado
Quantidade fixa
Exige peso? herdado do produto
Pode ir para pedido?
Pode ir para estoque?
```

### Exemplo

```text
Regra A
Origem: TZ
Saídas:
- 1 Jacaré
- 1 Coxão Bola
```

```text
Regra B
Origem: TZ
Saídas:
- 1 Jacaré
- 2 Alcatras
```

### Ações

```text
Criar regra
Editar regra
Ativar/inativar regra
Simular disponibilidade
Consultar impacto
```

### Simulador recomendado

Entrada:

```text
Quantidade de TZ
Produto vendido/reservado
```

Saída:

```text
O que continua disponível para venda
O que fica bloqueado
Quais regras continuam possíveis
```

---

</details>

---

### A-35 — Modelos de Etiqueta (`/cadastros/modelos-etiqueta`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** cadastros. **Objetivo de negócio:** Modelos etiqueta.
**Dados/campos e controles:** modelo, campos, dimensões, tipo e estado. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar/editar, pré-visualizar e usar nas impressões. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** modelo ativo controla label, QR/lote/destino. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** margens, impressão real e falha de dispositivo. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** licenças de impressora/hardware fora de escopo.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/cadastros/modelos-etiqueta/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 8.8 Cadastros & Regras → Modelos de Etiqueta

### Modelos

```text
Peça para pedido
Peça para estoque
Peça para desossa
Parte transformada para pedido
Parte transformada para estoque
Produto por unidade, se precisar
```

### Campos configuráveis

```text
Código
Produto
Peso/quantidade
Cliente/pedido
Destino
Origem/frigorífico
NF/lote
Data/hora
Operador
Características
QR Code/código de barras
```

---

# 9. ADMINISTRAÇÃO

---

</details>

---

### A-36 — Usuários (`/admin/usuarios`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** admin. **Objetivo de negócio:** Usuários.
**Dados/campos e controles:** usuário, e-mail, nome, situação, papéis e escopos. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** CRUD, ativar/inativar, associar perfis. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** RBAC e JWT, inativação e controle de escopo. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** elevação indevida e identidade duplicada. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** SSO bancário e tokens financeiros excluídos.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/admin/usuarios/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 9.1 Administração → Usuários

### Campos

```text
Nome
Login
E-mail
Telefone
Perfil funcional
Representantes permitidos
Permissões especiais
Status
Último acesso
```

---

</details>

---

### A-37 — Perfis de Acesso (`/admin/perfis`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** admin. **Objetivo de negócio:** Perfis de acesso.
**Dados/campos e controles:** papel, menus, ações/permissões e escopos. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** criar/alterar perfil, atribuir permissões, revisar acesso. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** visibilidade de menu não substitui RBAC backend. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** risco de autoaprovação ou acesso fora de escopo. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** segregação contábil/fiscal completa é expansão.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/admin/perfis/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 9.2 Administração → Perfis de Acesso

### Campos

```text
Nome do perfil
Menus permitidos
Ações permitidas
Pode consultar todos representantes?
Pode criar pedido?
Pode alterar preço?
Pode operar balança?
Pode operar desossa?
Pode faturar?
Pode liberar caminhão?
Pode aprovar estornos?
Pode administrar usuários?
```

---

</details>

---

### A-38 — Parâmetros (`/admin/parametros`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** admin. **Objetivo de negócio:** Parâmetros.
**Dados/campos e controles:** chave, domínio, valor, descrição, mudanças e histórico. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** consultar/alterar com permissão. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** parâmetros globais de negócio e flags existentes; EISS provisório. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** valor incompleto, segredo exibido e configuração conflitante. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** cadastro tributário versionado por competência é novo motor fiscal.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/admin/parametros/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 9.3 Administração → Parâmetros

### Parâmetros iniciais

```text
Bloquear pedido sem disponibilidade: sim
Estoque anterior sai primeiro: sim
Seguro integrado: não
NF-e integrada: sim
Permitir estorno após carga conferida: não, salvo reabertura
Permitir desossa sem regra compatível: registrar divergência
```

---

</details>

---

### A-39 — Auditoria (`/admin/auditoria`)
**Status e escopo contratual:** [I] Implementação em código; [H] homologação de campo pendente. **Grupo:** admin. **Objetivo de negócio:** Auditoria.
**Dados/campos e controles:** evento, ator, entidade, data, dif antes/depois e correlator. Valores relevantes incluem identificação de negócio legível, autor, status, data/hora e vínculo à operação.
**Ações e jornada do usuário:** listar, filtrar e detalhar. Fluxo padrão: selecionar operação/objeto → conferir pré-condições → executar ação → persistência auditável → atualizar o painel e vínculos → oferecer revisão/histórico.
**Regras de negócio:** operação crítica deve persistir rastro, sem exclusão retroativa. Regras críticas só no backend, respeitando RBAC, transação e idempotência conforme Constituição.
**Erros, alternativas e exceções:** dado pessoal sensível e permissão insuficiente. Mensagens claras por campo/objeto; salvar parcial quando permitido; negar ação vedada sem alteração parcial persistida.
**Aceite operacional e técnico da linha-base:** a função deve executar ponta a ponta com usuário correto; leitura após escrita coerente; repetir requisição não deve criar registro duplicado; permissão negada produz 403; alterações proibidas pós-fechamento retornam conflito; testes unitários/integrados e Playwright sobre jornada relevante.
**Requisitos não funcionais pertinentes:** resposta interativa adequada ao posto de trabalho; navegação teclado; visibilidade de estado; disponibilidade e consistência com dados persistidos; acesso restrito; logs sem segredos e rastreabilidade por objeto de negócio; desempenho medido com dados realistas antes de prometer SLA.
**Requisito inverso / fora do escopo original desta tela:** livros fiscais/contábeis e eventos bancários novos serão adicionados.
**Evidência técnica para auditoria de entrega:** `app/frontend/src/app/(admin)/admin/auditoria/page.tsx` (encontrado); conferir services/controllers/schema correspondentes pela busca do domínio. **Referência histórica (não prova implementação):**
<details><summary>Requisito levantado anteriormente — documento v0.1</summary>

## 9.4 Administração → Auditoria

### Campos

```text
Usuário
Data/hora
Entidade alterada
Ação
Valor anterior
Valor novo
Motivo
IP/dispositivo, se disponível
```

### Eventos auditáveis

```text
alteração de pedido;
alteração de preço;
associação de peça;
estorno;
cancelamento de etiqueta;
transformação;
divergência;
emissão/cancelamento de nota;
liberação de caminhão;
ajuste de estoque;
alteração de regra de transformação.
```

</details>

## 4. NFR — requisitos não funcionais do produto existente (linha-base técnica)
| ID | Categoria | Exigência e evidência | Não compreende |
|---|---|---|---|
| NFA-01 | Integridade | backend como autoridade, Zod/Drizzle/PostgreSQL; transações e auditoria em cada reserva, destinação, fechamento | escrituração fiscal oficial |
| NFA-02 | Acesso | JWT+RBAC, menus por perfil e testes de acesso proibido; alcance por representante | RBAC bancário de dupla aprovação |
| NFA-03 | Persistência | migrações versionadas, histórico de eventos, soft deletion onde aplicável e índices de unicidade | retenção legal de XML fiscal real não homologada |
| NFA-04 | Qualidade | oito jobs CI (lint, type-check, backend, cobertura, frontend, build, audit, secret-scan), Playwright e fakes | SLA de produção sem medição |
| NFA-05 | UX | DS v3, teclado, contraste, leitura rápida, unidades kg/un, alertas e feedback de erro | interface mobile nativa |
| NFA-06 | Integração | gateways isolados para balança/impressora/leitor/EISS; estados de indisponibilidade explícitos | aquisição, instalação ou manutenção dos equipamentos |
| NFA-07 | Telemetria | logs estruturados, IDs de correlação, auditoria e sanitização de segredos | SOC gerenciado 24×7 |
| NFA-08 | Evolução | mudanças via branch/worktree/PR `develop`, gates e matriz de regressão | garantia de terceiro ou customização irrestrita |
| NFA-09 | Desempenho | testes com volumes realistas e metas a definir com cliente no aceite, sem números artificiais | SLA 99.99% não contratado |
| NFA-10 | Continuidade | respaldado pela infraestrutura operada pelo cliente e planos de backup implantados | responsabilidade por operação de data center não negociada |
**Os critérios são requisitos de engenharia/aceite; não constituem certificação de SLA histórico sem evidência.**

## 5. Matriz de escopo inverso global — NÃO INCLUÍDO no projeto original
| ID | Exclusão explícita | Onde será especificada |
|---|---|---|
| INA-01 | NF-e 55 autorizada pela SEFAZ-SP, assinatura, DANFE, CC-e, inutilização, contingência | Caderno B E02 |
| INA-02 | Motor fiscal por NCM, CFOP, ICMS, IPI, PIS, COFINS, IBS/CBS, benefícios e vigência | Caderno B E01 |
| INA-03 | Importação de DF-e por NSU, manifestação e apuração de créditos | Caderno B E03 |
| INA-04 | Contas a pagar/receber com títulos, parcelas e baixas de caixa | Caderno B E04/E05 |
| INA-05 | APIs Bradesco, Itaú, Santander, DDA, cobrança, extrato, Pix e ordens de pagamento | Caderno B E06 |
| INA-06 | Conciliação bancária, automatching, fluxo de caixa consolidado | Caderno B E07/E08 |
| INA-07 | Plano de contas, partidas dobradas, DRE, BP, diário, razão, fechamento, SPED | Caderno B E09 |
| INA-08 | Equipamentos físicos, drivers de balança completos, impressoras, infraestrutura de rede, suporte presencial e treinamento ilimitado | projeto complementar/terceiros |
| INA-09 | Roteirização dinâmica GPS, aplicativo nativo Android/iOS, marketplace e e-commerce | fora desta contratação |
| INA-10 | Serviços de contador, advogado tributarista, homologações feitas por bancos/SEFAZ, certificados e taxas | terceiros sob responsabilidade do cliente |
| INA-11 | Qualquer conta paralela, faturamento fictício, supressão de receita ou fraude tributária | expressamente proibido |
| INA-12 | Integração com folha/eSocial, folha própria, folha de pagamento completa | depende de extensão contratual específica |
## 6. Critérios de faturabilidade e aceite comercial do Caderno A
O preço originalmente pactuado, se existente, não é reestimado aqui. Separar: código concluído, testado mas não homologado, dívida técnica, homologação externa e funcionalidade nova. Toda renegociação de escopo será itemizada por delta contra este inventário, com evidência de código/PR, roteiro de UAT e aceite assinado.
### Anexos referenciais
- `docs_v2/04_especificacao_telas_campos.md`, `docs/016-wireframes-fluxos-por-tela.md`, `docs/008-faturamento-emissao-nf-seguro-bloqueios-fiscais-e-liberacao-do-caminhao.md`.
- Caderno B: `B-ESCOPO-NOVOS-MODULOS-ERP.md`; Proposta comercial: `C-PROPOSTA-COMERCIAL-ERP.md`.
