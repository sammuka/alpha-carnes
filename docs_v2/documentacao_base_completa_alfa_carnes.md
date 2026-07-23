# Alfa Carnes — Documentação Base Completa

<!-- Arquivo: 00_LEIA_ME.md -->

# Alfa Carnes — Documentação Base do Sistema Operacional

**Versão:** 0.1
**Data:** 2026-06-19
**Finalidade:** documento base para prototipação das telas, estruturação da aplicação, desenho do banco de dados, regras de negócio e validação com os usuários da Alfa Carnes.

---

## 1. Objetivo deste pacote de documentação

Este pacote consolida o entendimento levantado até o momento sobre a operação da Alfa Carnes e transforma as decisões operacionais em insumos para construção do sistema.

A documentação cobre:

1. entendimento da operação atual;
2. fluxos de negócio ponta a ponta;
3. segmentação por grupos de usuários/personas;
4. hierarquia de menu;
5. telas previstas;
6. campos, ações, validações e regras por tela;
7. motor de disponibilidade virtual inteligente;
8. regras de transformação/desossa;
9. cancelamentos, estornos e travas operacionais;
10. lacunas ainda abertas para validação.

A prioridade desta versão é **completude funcional**, não acabamento visual.

---

## 2. Premissas centrais já consolidadas

### 2.1 A operação é cross-docking com possibilidade de estoque

A operação principal da Alfa Carnes funciona como cross-docking: a mercadoria chega, é conferida, pesada/destinada e, sempre que possível, segue diretamente para pedidos/cargas. Porém, a operação também precisa aceitar estoque:

- **estoque inicial:** produtos, peças, cortes ou caixas que sobraram de dias anteriores;
- **estoque final:** peças, partes, sobras ou itens não destinados no dia;
- **estoque intermediário:** peças enviadas para desossa ou aguardando destinação;
- **estoque de itens não pesáveis:** caixas e itens vendidos por unidade.

O sistema deve controlar os dois mundos sem duplicar dados: cross-docking e estoque são estados/visões de uma mesma operação.

### 2.2 Estoque físico e disponibilidade não são módulos separados

A base de dados de mercadorias é única. O que muda é a visão:

- **Estoque:** visão física do que existe, onde está, origem, peso/quantidade, status e localização.
- **Disponibilidade:** visão comercial calculada a partir de compras, estoque, pedidos, reservas e regras de transformação.

Não devem existir módulos independentes chamados “estoque físico” e “estoque virtual”. O correto é existir:

```text
Estoque = base física
Disponibilidade = visão comercial inteligente
```

### 2.3 Representante não é uma persona

Representante é uma dimensão comercial do cliente/pedido. Persona/perfil é o papel funcional do usuário.

Exemplo:

```text
Usuário: Sabrina
Perfil funcional: Comercial
Representante vinculado: Alpha Carnes / Sabrina
```

```text
Usuário: Funcionário Cemol
Perfil funcional: Comercial
Representante vinculado: Cemol / Duda
```

```text
Usuário: Fabrício
Perfil funcional: Gestão
Representantes permitidos: Todos
```

Todo cliente deve ter um representante/canal no cadastro. O pedido herda o representante do cliente.

### 2.4 Pedido é por unidade, cobrança frequentemente por peso

A maior parte dos itens é vendida por unidade/peça, mas o preço final é calculado pelo peso total quando o produto exige pesagem.

Exemplo:

```text
Cliente pede: 10 PAs
Operação pesa: 10 peças de PA
Faturamento cobra: peso total das 10 PAs x preço por kg
```

Produtos como caixas são vendidos e cobrados por unidade.

### 2.5 Balança não transforma

Na balança principal, o operador trabalha com a peça como ela chegou.

Peças principais recebidas:

```text
DT
PA
TZ
Banda de porco
```

A balança pode:

```text
pesar;
classificar características;
associar a pedido compatível;
enviar para estoque;
enviar TZ para desossa;
imprimir etiqueta;
cancelar/estornar ações permitidas.
```

A balança **não** associa pedido de corte transformado. Exemplo: pedido de alcatra, jacaré, filé ou coxão bola deve ser atendido na desossa, não na balança principal.

### 2.6 Desossa transforma somente TZ

A transformação acontece na desossa e somente o **TZ** será tratado como origem transformável.

Não haverá transformação em cadeia do tipo:

```text
TZ -> Coxão Bola -> Alcatra
```

O correto é cadastrar alternativas diretas a partir do TZ:

```text
TZ -> Jacaré + Coxão Bola
TZ -> Jacaré + 2 Alcatras
TZ -> Jacaré + Filé
TZ -> Pontas + Filés
TZ -> outras combinações cadastradas
```

Cada regra terá quantidade fixa de saídas. O peso das saídas é variável e será capturado na desossa.

### 2.7 O estoque virtual é inteligente

O estoque virtual deve mostrar todos os itens potencialmente vendáveis, mesmo que eles compartilhem a mesma origem física.

Exemplo com 1 TZ e regras hipotéticas:

```text
1 TZ = 1 Jacaré + 1 Coxão Bola
1 TZ = 1 Jacaré + 2 Alcatras
1 TZ = 1 Jacaré + 1 Filé
```

A disponibilidade pode mostrar:

```text
Jacaré: 1 disponível
Coxão Bola: 1 disponível
Alcatra: 2 disponíveis
Filé: 1 disponível
```

Ao reservar um item, a reserva inteligente recalcula tudo que continua possível e baixa automaticamente o que deixou de ser possível.

Frase-chave:

> A disponibilidade virtual mostra possibilidades de venda; a reserva inteligente elimina possibilidades incompatíveis.

### 2.8 Desossa não será travada pelo sistema

Não haverá trava operacional que impeça a equipe da desossa de produzir uma peça fisicamente. A desossa precisa de orientação, não de burocracia.

O sistema terá um **dashboard estilo aeroporto** para a sala de desossa, exibindo o que falta produzir para atender os pedidos.

Exemplo:

```text
Produto       Faltam     Pronto em estoque     Origem
Alcatra       15         2                      TZ
Jacaré        13         0                      TZ
Filé          6          1                      TZ
Coxão Bola    8          0                      TZ
```

A interação real com o sistema acontece na balança da desossa, onde as partes geradas são pesadas, classificadas, etiquetadas e destinadas a pedido ou estoque.

### 2.9 Caixaria não é módulo específico

“Caixaria” é apenas um apelido operacional para itens cadastrados como produtos, como caixas de miúdos, rabo, fígado etc.

Regra:

```text
Caixas são vendidas por unidade.
Preço por unidade.
Não passam por balança.
Não passam por desossa.
Podem ir direto para pedido ou estoque.
```

### 2.10 O sistema emitirá nota

O sistema deve emitir nota fiscal, com comunicação com a SEFAZ Osasco já considerada no escopo. O XML será gerado pelo sistema.

Seguro será manual, com registro de status no sistema.

---

## 3. Arquivos deste pacote

| Arquivo | Conteúdo |
|---|---|
| `00_LEIA_ME.md` | Visão geral do pacote, premissas e mapa da documentação. |
| `01_entendimento_operacional_fluxos.md` | Entendimento detalhado da operação e fluxos ponta a ponta. |
| `02_regras_de_negocio_core.md` | Regras centrais: disponibilidade virtual, transformação, estoque, cancelamento e faturamento. |
| `03_menu_personas_permissoes.md` | Grupos de usuários, perfis, escopos por representante e hierarquia de menu. |
| `04_especificacao_telas_campos.md` | Telas previstas, campos, ações, validações e comportamentos. |
| `05_glossario_lacunas_backlog.md` | Glossário, decisões fechadas, lacunas pendentes e backlog inicial sugerido. |

---

## 4. Próximo passo sugerido

A próxima etapa deve refinar em detalhe, um bloco por vez:

1. **Cadastro de Produtos e Regras de Transformação** — base do motor de disponibilidade virtual.
2. **Comercial / Pedido de Venda / Disponibilidade** — como a venda reserva corretamente os itens.
3. **Recebimento & Balança** — tela crítica do Richard.
4. **Desossa** — dashboard estilo aeroporto e balança da desossa.
5. **Faturamento** — emissão de nota, XML, seguro manual e liberação.


---

<!-- Arquivo: 01_entendimento_operacional_fluxos.md -->

# Alfa Carnes — Entendimento Operacional e Fluxos de Trabalho

**Versão:** 0.1
**Objetivo:** documentar a operação ponta a ponta da Alfa Carnes, com foco nos fluxos de negócio que devem orientar a construção do sistema.

---

# 1. Visão geral da operação

A Alfa Carnes opera com uma lógica de cross-docking, mas com suporte a estoque. A mercadoria pode sair diretamente do recebimento para o pedido/carga, pode ser enviada para desossa, ou pode ir para estoque.

O sistema deve permitir que a operação física acompanhe a velocidade real da empresa, sem criar burocracia excessiva. A regra é: **a interface deve ser simples, mas o motor de negócio precisa ser inteligente**.

Fluxo macro:

```text
Compra / disponibilidade prevista
-> Pedido de venda
-> Recebimento da carga
-> Balança: pesagem e destinação da peça original
-> Desossa, quando houver transformação de TZ
-> Estoque, quando houver sobra ou item não destinado
-> Carga
-> Faturamento / NF-e / XML
-> Seguro manual
-> Liberação do caminhão
```

---

# 2. Fluxo comercial

## 2.1 Responsáveis

Perfis envolvidos:

```text
Comercial
Gestão
Representantes / canais comerciais
```

Usuários possíveis:

```text
Sabrina - representante Alpha Carnes
Funcionário Cemol - representante Cemol/Duda
Usuário Zona Sul - representante Carlos/Zona Sul
Fabrício - visão geral / gestão
```

## 2.2 Representante no cadastro do cliente

Todo cliente deve ter um representante obrigatório.

Exemplos:

```text
Cliente A -> Representante: Sabrina / Alpha Carnes
Cliente B -> Representante: Duda / Cemol
Cliente C -> Representante: Carlos / Zona Sul
```

O pedido herda automaticamente o representante do cliente.

## 2.3 Tabela de preços

A Alfa trabalha com tabelas comerciais A/B/C/D. O cliente tem uma tabela padrão, mas pode haver negociação por produto.

O sistema deve registrar:

```text
Tabela do dia
Produto
Preço A
Preço B
Preço C
Preço D
Preço negociado no pedido
Responsável pela alteração
Histórico
```

A negociação acontece por item/produto, não apenas como desconto global.

## 2.4 Pedido de venda

O pedido comercial é lançado por unidade, na maioria dos casos. Entretanto, quando o produto exige peso, o valor final será calculado pelo peso real atendido.

Exemplo:

```text
Pedido: 10 PAs
Unidade do pedido: peça
Preço: por kg
Valor final: peso total das 10 peças x preço/kg
```

O pedido deve sempre controlar:

```text
quantidade pedida;
quantidade atendida;
peso atendido;
preço por kg ou por unidade;
valor estimado;
valor final;
status do item.
```

## 2.5 Trava por disponibilidade

O pedido de venda deve ser bloqueado quando não houver disponibilidade.

A disponibilidade deve considerar:

```text
estoque físico anterior;
compras do dia;
TZ disponível para transformação;
reservas virtuais inteligentes;
itens já reservados em pedidos;
itens fisicamente destinados;
itens em estoque;
itens carregados/faturados.
```

Para produtos transformados, a disponibilidade não é simples soma de estoque. Ela depende do motor de transformação virtual.

---

# 3. Fluxo de gestão e compras

## 3.1 Responsável principal

```text
Fabrício / Gestão
```

## 3.2 Tipos de compra

A compra pode ser feita de diferentes formas:

```text
Compra de boi
Compra de TZ
Compra de PA
Compra de DT
Compra de porco
Compra de itens de caixa / produtos por unidade
Outros produtos comercializáveis
```

## 3.3 Compra de boi

Regra conhecida:

```text
1 boi = 2 DT + 2 PA + 2 TZ
```

Exemplo:

```text
10 bois comprados
= 20 DT
= 20 PA
= 20 TZ
```

Essa disponibilidade entra como base virtual/comercial até o recebimento confirmar o que chegou.

## 3.4 Compra direta de partes

Fabrício também pode comprar diretamente:

```text
TZ
PA
DT
```

Nesse caso, a disponibilidade é gerada diretamente para o produto comprado.

## 3.5 Porco

Regra definida:

```text
Porco é entregue em 2 bandas.
Não passa por transformação.
É pesado e destinado para pedido ou estoque.
```

## 3.6 Itens de caixa

Itens chamados operacionalmente de caixaria são produtos cadastrados e vendidos por unidade.

```text
Não passam por balança.
Não passam por desossa.
Vão direto para pedido ou estoque.
```

---

# 4. Fluxo de recebimento e balança principal

## 4.1 Objetivo da balança principal

A balança principal é onde o cross-docking físico começa.

A tela precisa ser extremamente simples e rápida.

Funções:

```text
abrir/acompanhar lote de recebimento;
selecionar peça recebida;
capturar ou digitar peso;
acumular pesos para conferência;
classificar características opcionais;
associar a pedido compatível;
enviar para estoque;
enviar TZ para desossa;
imprimir etiqueta;
listar ações realizadas;
cancelar/estornar ação permitida;
finalizar recebimento;
registrar divergências.
```

## 4.2 Peças trabalhadas na balança

A balança principal trabalha com a peça como chegou:

```text
DT
PA
TZ
Banda de porco
Outros produtos pesáveis recebidos como peça inteira, se cadastrados
```

## 4.3 Associação direta a pedido

A balança só pode associar diretamente a pedido quando o produto do pedido é compatível com a peça original.

Exemplos permitidos:

```text
DT recebido -> pedido de DT inteiro
PA recebida -> pedido de PA inteira
TZ recebido -> pedido de TZ inteiro
Banda de porco recebida -> pedido de banda de porco
```

Exemplos não permitidos na balança principal:

```text
TZ recebido -> pedido de coxão bola
TZ recebido -> pedido de jacaré
TZ recebido -> pedido de alcatra
TZ recebido -> pedido de filé
```

Nesses casos:

```text
TZ recebido
-> pesar
-> classificar, se aplicável
-> destino: Desossa
-> etiqueta de peça mãe / destino interno
```

## 4.4 Busca na tela de balança

O textsearch da tela de pesagem/destinação deve buscar apenas por:

```text
Cliente / Marca
```

A filtragem por produto compatível é feita automaticamente pelo sistema.

## 4.5 Características da peça

Na pesagem inicial, o operador pode marcar características opcionais:

```text
Mais pesada
Mais gorda
Melhor acabamento
```

Essas características serão usadas para ordenar sugestões de pedidos/clientes compatíveis, considerando as preferências cadastradas no cliente.

## 4.6 Acúmulo de pesos para conferência

A tela deve mostrar acúmulo de pesos e quantidades por item/lote.

Exemplo:

```text
Produto em conferência: TZ
Previsto: 20 peças / 980 kg
Pesado: 12 peças / 585 kg
Restante: 8 peças / 395 kg
Divergência atual: 0 kg
```

Ao finalizar o recebimento, se houver divergência, o sistema deve abrir modal para registro.

## 4.7 Divergências no recebimento

Tipos de divergência possíveis:

```text
quantidade menor;
quantidade maior;
peso menor;
peso maior;
produto divergente;
avaria;
qualidade inadequada;
NF/romaneio divergente.
```

---

# 5. Fluxo de desossa

## 5.1 Papel da desossa

A desossa é a etapa de transformação de TZ em partes/cortes comercializáveis.

A desossa não terá uma etapa prévia de interação antes da balança da desossa. Portanto, o sistema não deve mostrar “em produção”.

O sistema deve orientar a equipe por meio de um dashboard estilo aeroporto.

## 5.2 Dashboard da desossa

Objetivo:

```text
Mostrar para a sala de desossa o que falta produzir para completar os pedidos.
```

O dashboard deve mostrar:

```text
produto;
quantidade faltante para pedidos;
quantidade pronta em estoque;
origem necessária;
prioridade, se aplicável;
rota/representante, se aplicável.
```

Não deve mostrar:

```text
em produção;
pendente em produção;
status que dependa de apontamento anterior inexistente.
```

Exemplo:

```text
DESOSSA - PAINEL DE NECESSIDADE

Produto       Faltam     Pronto em estoque     Origem
Jacaré        13         0                      TZ
Alcatra       15         2                      TZ
Filé          6          1                      TZ
Coxão Bola    8          0                      TZ
```

## 5.3 Balança da desossa

A interação real acontece na tela de pesagem/destinação da desossa.

Fluxo:

```text
selecionar/ler TZ origem;
selecionar ou confirmar regra de transformação;
registrar cada saída esperada;
capturar peso de cada parte;
marcar características opcionais;
buscar cliente/marca;
associar a pedido compatível;
ou deixar ir automaticamente para estoque;
imprimir etiqueta;
registrar divergência se faltarem saídas esperadas.
```

## 5.4 Transformação sem cadeia

Somente o TZ pode ser transformado.

Não haverá:

```text
TZ -> CB -> Alcatra
```

Haverá regras diretas:

```text
TZ -> Jacaré + Coxão Bola
TZ -> Jacaré + 2 Alcatras
TZ -> Jacaré + Filé
TZ -> outras saídas diretas cadastradas
```

## 5.5 Quantidade fixa e peso variável

Cada regra possui quantidade fixa de produtos gerados.

Exemplo:

```text
Regra: TZ -> 1 Jacaré + 2 Alcatras
Entrada: 1 TZ
Saída esperada:
- 1 Jacaré
- 2 Alcatras
```

O peso de cada saída é variável e capturado na desossa.

Se o operador finalizar a transformação sem registrar todas as saídas esperadas, o sistema gera divergência para conferência da gestão.

## 5.6 Sobra automática para estoque

Após a transformação, toda parte gerada precisa ter destino.

Regra operacional:

```text
Se a parte não for associada a pedido, ela é automaticamente etiquetada para estoque.
```

---

# 6. Fluxo de estoque

## 6.1 Estoque único

O estoque é único e representa a visão física dos itens.

Pode conter:

```text
peças inteiras;
partes transformadas;
bandas de porco;
caixas/produtos por unidade;
itens que sobraram de dias anteriores;
itens gerados na desossa não destinados a pedido.
```

## 6.2 FIFO

Regra definida:

```text
Estoque anterior sai primeiro automaticamente.
```

O sistema deve priorizar estoque físico anterior antes de usar compra do dia ou disponibilidade virtual.

## 6.3 Sugestão por perfil de cliente

O sistema deve sugerir itens compatíveis com base em:

```text
preferências do cliente;
características marcadas na peça/parte;
faixa de peso, se cadastrada;
produto pendente;
representante/rota, se aplicável.
```

Características usadas:

```text
Mais pesada
Mais gorda
Melhor acabamento
```

---

# 7. Fluxo de carga

## 7.1 Objetivo

A carga organiza a saída física dos pedidos atendidos.

Funções:

```text
planejar carga por caminhão/rota;
visualizar pedidos e itens destinados;
conferir peças, partes e produtos;
marcar carga como conferida;
enviar para faturamento.
```

Carga não deve cuidar de nota, XML ou seguro.

## 7.2 Marco de fechamento operacional

A partir do momento em que a carga/pedido é fechado ou enviado para faturamento, cancelamentos simples não devem mais ocorrer.

Sugestão de marco:

```text
Pedido fechado = carga conferida ou enviada para faturamento.
```

Esse ponto ainda pode ser validado, mas o objetivo é evitar buraco na operação.

---

# 8. Fluxo de faturamento

## 8.1 Objetivo

O faturamento consolida o que foi atendido fisicamente e emite nota fiscal.

O sistema deve emitir NF-e e gerar XML.

## 8.2 Seguro

Seguro será manual.

O sistema deve registrar:

```text
seguro pendente;
seguro enviado;
seguro confirmado;
responsável;
data/hora;
observação/anexo, se necessário.
```

## 8.3 Liberação do caminhão

Caminhão só deve ser liberado quando:

```text
carga conferida;
nota emitida;
XML gerado;
seguro manual confirmado ou marcado conforme processo definido;
dados de caminhão/motorista presentes.
```

Após liberação, não deve haver alteração operacional simples.

---

# 9. Fluxo de cancelamento e estorno

## 9.1 Princípio

O sistema deve permitir desfazer erros operacionais, mas sem apagar histórico e sem permitir estorno quando a peça já foi consumida por etapa posterior.

## 9.2 Ações realizadas

As telas de balança principal e balança da desossa devem listar ações realizadas.

Campos da lista:

```text
horário;
produto;
peso ou quantidade;
destino;
pedido/cliente, se houver;
etiqueta gerada;
operador;
status;
ação de cancelar/estornar, quando permitido.
```

## 9.3 Exemplos

Permitido:

```text
cancelar associação a pedido antes da carga;
cancelar destino para estoque se item não foi movimentado;
cancelar envio para desossa se TZ ainda não foi transformado;
cancelar etiqueta e reimprimir.
```

Não permitido diretamente:

```text
cancelar envio para desossa depois que o TZ foi transformado;
cancelar item já carregado/conferido sem reabertura;
cancelar item já faturado sem fluxo fiscal;
alterar item de caminhão liberado.
```

---

# 10. Estados simplificados

## 10.1 Item físico

```text
Disponível
Destinado a Pedido
Destinado a Estoque
Destinado à Desossa
Consumido por Transformação
Carregado
Faturado
Cancelado
```

## 10.2 Item do pedido

```text
Aberto
Parcial
Atendido
Fechado
Faturado
Cancelado
```

## 10.3 Transformação

A transformação deve ser tratada principalmente como evento.

Estados simples:

```text
Aguardando Desossa
Transformado
Com Divergência
```

## 10.4 Carga

```text
Planejada
Em Conferência
Conferida
Enviada para Faturamento
Liberada
```


---

<!-- Arquivo: 02_regras_de_negocio_core.md -->

# Alfa Carnes — Regras de Negócio Core

**Versão:** 0.1
**Objetivo:** documentar as regras centrais que sustentam disponibilidade, pedidos, transformação, estoque, cancelamento e faturamento.

---

# 1. Produtos e comportamento operacional

Cada produto cadastrado deve definir como ele se comporta na operação.

## 1.1 Campos essenciais do produto

```text
Nome do produto
Código interno
Categoria / família
Unidade de pedido
Unidade de preço
Exige peso operacional?
Passa pela balança principal?
Passa pela desossa?
Pode ser origem de transformação?
Pode ser saída de transformação?
Pode ir para estoque?
Ativo na tabela de venda?
Ativo para compra?
Preço por kg ou unidade?
```

## 1.2 Exemplos de configuração

### TZ

```text
Unidade de pedido: peça
Unidade de preço: kg
Exige peso: sim
Passa pela balança principal: sim
Passa pela desossa: sim, quando destinado
Pode ser origem de transformação: sim
Pode ser saída de transformação: não
Pode ir para estoque: sim
```

### PA

```text
Unidade de pedido: peça
Unidade de preço: kg
Exige peso: sim
Passa pela balança principal: sim
Passa pela desossa: não
Pode ser origem de transformação: não
Pode ir para estoque: sim
```

### DT

```text
Unidade de pedido: peça
Unidade de preço: kg
Exige peso: sim
Passa pela balança principal: sim
Passa pela desossa: não
Pode ser origem de transformação: não
Pode ir para estoque: sim
```

### Coxão Bola / Jacaré / Alcatra / Filé

```text
Unidade de pedido: unidade/peça
Unidade de preço: kg
Exige peso: sim
Passa pela balança principal: não
Passa pela desossa: sim
Pode ser origem de transformação: não
Pode ser saída de transformação: sim
Pode ir para estoque: sim
```

### Banda de porco

```text
Unidade de pedido: banda
Unidade de preço: kg
Exige peso: sim
Passa pela balança principal: sim
Passa pela desossa: não
Pode ser origem de transformação: não
Pode ir para estoque: sim
```

### Caixa de rabo / caixa de miúdos / caixa de fígado

```text
Unidade de pedido: unidade
Unidade de preço: unidade
Exige peso: não
Passa pela balança principal: não
Passa pela desossa: não
Pode ser origem de transformação: não
Pode ir para estoque: sim
```

---

# 2. Pedido de venda

## 2.1 Pedido sempre tem representante

O pedido herda o representante do cliente.

```text
Cliente -> Representante -> Pedido
```

O usuário comercial só deve ver/lançar pedidos dentro do seu escopo de representante, exceto usuários com permissão ampliada.

## 2.2 Item do pedido

Campos obrigatórios/conceituais:

```text
Produto
Quantidade pedida
Unidade de pedido
Peso previsto, opcional
Quantidade atendida
Peso atendido
Preço de tabela
Preço negociado
Unidade de preço
Valor estimado
Valor final
Status do item
Origem de atendimento
```

## 2.3 Peso é essencial

Mesmo quando o pedido é por unidade, o peso do item atendido é essencial se o produto tiver preço por kg.

Exemplo:

```text
Pedido: 10 alcatras
Preço: por kg
Desossa pesa cada alcatra
Faturamento cobra peso total das 10 alcatras x preço/kg
```

## 2.4 Pedido bloqueado sem disponibilidade

Regra definida:

```text
Se não houver disponibilidade, pedido não confirma.
```

Para itens derivados de TZ, a disponibilidade é calculada pelo motor de estoque virtual inteligente.

---

# 3. Disponibilidade virtual inteligente

## 3.1 Conceito

Disponibilidade virtual é a visão comercial do que pode ser vendido, considerando:

```text
estoque físico;
compras previstas;
peças disponíveis;
TZ transformável;
regras de transformação;
reservas já feitas;
produtos que compartilham origem.
```

A disponibilidade virtual deve mostrar todos os itens potencialmente vendáveis, mesmo que compartilhem a mesma origem física.

Frase-chave:

> O estoque virtual mostra possibilidades de venda; a reserva inteligente elimina possibilidades incompatíveis.

## 3.2 Exemplo base

Regras hipotéticas:

```text
Regra A: 1 TZ = 1 Jacaré + 1 Coxão Bola
Regra B: 1 TZ = 1 Jacaré + 2 Alcatras
Regra C: 1 TZ = 1 Jacaré + 1 Filé
```

Estoque físico:

```text
1 TZ
```

Disponibilidade exibida:

```text
Jacaré: 1 disponível
Coxão Bola: 1 disponível
Alcatra: 2 disponíveis
Filé: 1 disponível
```

Esses saldos são possibilidades comerciais concorrentes, não soma física.

## 3.3 Reserva de um item

Ao reservar 1 Jacaré:

```text
1 TZ fica comprometido para transformação.
Regras possíveis restantes:
- Jacaré + Coxão Bola
- Jacaré + 2 Alcatras
- Jacaré + Filé
```

Nova disponibilidade:

```text
Jacaré: 0
Coxão Bola: 1
Alcatra: 2
Filé: 1
TZ inteiro: 0
```

## 3.4 Reserva posterior de Coxão Bola

Estado anterior:

```text
Jacaré reservado.
Regras possíveis: A, B, C.
```

Pedido novo:

```text
1 Coxão Bola
```

Somente a regra A atende:

```text
TZ = Jacaré + Coxão Bola
```

Nova disponibilidade:

```text
Jacaré: 0
Coxão Bola: 0
Alcatra: 0
Filé: 0
TZ inteiro: 0
```

## 3.5 Reserva posterior de Alcatra

Estado anterior:

```text
Jacaré reservado.
Regras possíveis: A, B, C.
```

Pedido novo:

```text
1 Alcatra
```

Somente a regra B atende:

```text
TZ = Jacaré + 2 Alcatras
```

Nova disponibilidade:

```text
Jacaré: 0
Coxão Bola: 0
Alcatra: 1
Filé: 0
```

A segunda alcatra ainda pode ser vendida.

## 3.6 Reserva posterior de Filé

Estado anterior:

```text
Jacaré reservado.
Regras possíveis: A, B, C.
```

Pedido novo:

```text
1 Filé
```

Somente a regra C atende:

```text
TZ = Jacaré + Filé
```

Nova disponibilidade:

```text
Jacaré: 0
Coxão Bola: 0
Alcatra: 0
Filé: 0
```

## 3.7 Ordem de consumo da disponibilidade

Quando um pedido é lançado, o sistema deve tentar atender nesta ordem:

```text
1. Estoque físico anterior do próprio produto, respeitando FIFO.
2. Saída virtual já prevista/compatível de TZ parcialmente reservado.
3. Origem virtual parcialmente reservada que continue compatível.
4. TZ livre que permita alguma regra de transformação do item pedido.
5. Bloqueio por falta de disponibilidade.
```

## 3.8 Vários TZs

Com 10 TZs e regras:

```text
A: Jacaré + Coxão Bola
B: Jacaré + 2 Alcatras
C: Jacaré + Filé
```

Disponibilidade inicial:

```text
Jacaré: 10
Coxão Bola: 10
Alcatra: 20
Filé: 10
TZ inteiro: 10
```

Se vender 5 Jacarés:

```text
5 TZs ficam parcialmente reservados.
5 TZs continuam livres.
```

A disponibilidade deve ser recalculada considerando as duas origens.

Se depois vender 5 Coxões Bola, o sistema deve encaixar preferencialmente nos mesmos 5 TZs que já têm Jacaré reservado, para não consumir mais TZs à toa.

## 3.9 Regra de compatibilidade

Um TZ reservado parcialmente mantém uma lista de regras ainda possíveis.

Exemplo:

```text
TZ virtual 001
Reservado: 1 Jacaré
Regras possíveis:
- Jacaré + Coxão Bola
- Jacaré + 2 Alcatras
- Jacaré + Filé
```

Depois de reservar Coxão Bola:

```text
TZ virtual 001
Reservado:
- 1 Jacaré
- 1 Coxão Bola
Regra travada:
- Jacaré + Coxão Bola
```

## 3.10 Desossa não é travada pelo motor

O motor orienta, calcula e sugere. Ele não deve criar uma trava física para a desossa.

A sala de desossa deve ter um painel que mostra o que falta produzir. Se a execução física gerar algo diferente, a divergência deve aparecer para gestão/conferência.

---

# 4. Regras de transformação

## 4.1 Transformação é cadastrada

Todas as regras possíveis de abertura de TZ devem ser cadastradas.

Cada regra define:

```text
Produto origem: TZ
Nome da regra
Produtos gerados
Quantidade fixa de cada produto gerado
Ativa/inativa
Prioridade/preferência, se necessário
Observação operacional
```

## 4.2 Quantidade fixa

O “N” das regras é quantidade fixa cadastrada.

Exemplo:

```text
TZ -> 2 Alcatras + 1 Filé
```

Sempre que a regra for aplicada a 1 TZ, o sistema espera:

```text
2 Alcatras
1 Filé
```

## 4.3 Peso variável

O peso de cada subpeça é variável e registrado na desossa.

```text
Quantidade esperada = fixa
Peso = capturado na operação
```

## 4.4 Divergência de transformação

Se a desossa registrar menos ou mais itens do que o esperado pela regra, o sistema deve gerar divergência.

Exemplos:

```text
subpeça faltante;
subpeça excedente;
produto diferente do esperado;
perda/quebra informada.
```

## 4.5 Sem transformação em cadeia

Não haverá subtransformações.

Não usar:

```text
TZ -> CB -> Alcatra
```

Usar regras diretas:

```text
TZ -> Alcatra + Filé + outros
```

## 4.6 Sobra automática

Toda saída gerada na desossa que não for associada a pedido deve ir automaticamente para estoque.

---

# 5. Dashboard da desossa

## 5.1 Objetivo

O dashboard da desossa deve orientar a equipe sobre o que falta produzir.

Ele deve ser visual, simples e legível em telão, estilo aeroporto.

## 5.2 Informações exibidas

```text
Produto
Quantidade faltante para pedidos
Quantidade pronta em estoque
Origem necessária
Rota/representante, opcional
Prioridade, opcional
```

## 5.3 Não exibir

```text
Em produção
Pendentes em produção
Travas operacionais da desossa
```

## 5.4 Visão recomendada

### Por produto

```text
Produto       Faltam     Pronto em estoque     Origem
Jacaré        13         0                      TZ
Alcatra       15         2                      TZ
Filé          6          1                      TZ
Coxão Bola    8          0                      TZ
```

### Por regra sugerida

Opcional, mas útil:

```text
Regra sugerida: TZ -> Jacaré + Coxão Bola
TZs sugeridos: 8
Gera:
- 8 Jacarés
- 8 Coxões Bola
```

A visão por regra ajuda a equipe a entender qual abertura do TZ melhor atende os pedidos.

---

# 6. Características de qualidade/perfil

## 6.1 Características marcáveis

Na balança principal e na balança da desossa, o operador pode marcar:

```text
Mais pesada
Mais gorda
Melhor acabamento
```

## 6.2 Preferências no cliente

No cadastro do cliente, deve existir campo correspondente:

```text
Prefere peça mais pesada
Prefere peça mais gorda
Prefere melhor acabamento
Observações operacionais
```

## 6.3 Uso nas sugestões

O sistema deve ordenar as sugestões de cliente/pedido considerando:

```text
produto compatível;
quantidade pendente;
preferência do cliente;
característica marcada no item;
estoque anterior primeiro;
rota/prioridade, se aplicável.
```

Não é regra de bloqueio; é regra de sugestão.

---

# 7. Cancelamento e estorno

## 7.1 Princípio

O operador deve conseguir corrigir erro operacional com facilidade, mas sem apagar histórico e sem gerar buraco na operação.

## 7.2 Lista de ações realizadas

As telas críticas devem exibir ações realizadas, não apenas botão de cancelar última ação.

Campos:

```text
horário;
produto;
peso/quantidade;
destino;
cliente/pedido;
etiqueta;
operador;
status;
possibilidade de estorno.
```

## 7.3 Permissões de estorno

Pode estornar diretamente:

```text
pesagem ainda não consumida;
associação a pedido antes de carga/fechamento;
destino a estoque sem movimentação posterior;
destino à desossa antes da transformação;
etiqueta impressa incorretamente.
```

Não pode estornar diretamente:

```text
TZ já consumido por transformação;
item já carregado/conferido sem reabertura;
item faturado;
caminhão liberado.
```

## 7.4 Efeito do estorno

Ao estornar:

```text
pedido volta a ficar aberto/parcial;
disponibilidade é recalculada;
etiqueta anterior fica cancelada;
histórico registra usuário, data/hora e motivo;
item volta ao estado anterior compatível.
```

---

# 8. Faturamento e seguro

## 8.1 NF-e

O sistema deve emitir nota fiscal e se comunicar com a SEFAZ Osasco.

Deve gerar XML.

## 8.2 Seguro manual

Seguro não será integrado neste momento.

Campos de controle:

```text
status do seguro;
responsável;
data/hora;
observação;
anexo, se necessário.
```

## 8.3 Liberação

Caminhão deve ser liberado somente após:

```text
carga conferida;
notas emitidas;
XML gerado;
seguro manual tratado;
dados de caminhão e motorista preenchidos.
```


---

<!-- Arquivo: 03_menu_personas_permissoes.md -->

# Alfa Carnes — Menu, Personas, Usuários e Permissões

**Versão:** 0.1
**Objetivo:** documentar a segmentação de usuários, escopo por representante e hierarquia de menu da aplicação.

---

# 1. Conceito de segmentação

A aplicação deve evitar duplicação de módulos por representante. A mesma tela comercial deve atender Sabrina, Cemol/Duda, Zona Sul/Carlos ou qualquer outro representante futuro.

A segmentação deve ser feita por três dimensões:

```text
1. Perfil funcional
2. Representantes permitidos
3. Permissões específicas
```

## 1.1 Perfil funcional

Define quais menus e ações aparecem.

Exemplos:

```text
Comercial
Gestão
Recebimento & Balança
Desossa
Estoque
Carga
Faturamento
Administração
Consulta
```

## 1.2 Representantes permitidos

Define o escopo de dados que o usuário enxerga.

Exemplos:

```text
Sabrina / Alpha Carnes
Duda / Cemol
Carlos / Zona Sul
Todos
```

## 1.3 Permissões específicas

Define ações pontuais.

Exemplos:

```text
criar pedido;
alterar preço negociado;
publicar tabela;
aprovar estorno;
consultar todos os representantes;
faturar;
liberar caminhão;
administrar usuários.
```

---

# 2. Grupos de usuários / personas

## 2.1 Comercial

Usuários típicos:

```text
Sabrina
Funcionário Cemol
Usuário Zona Sul
Outros vendedores/representantes futuros
```

Responsabilidades:

```text
consultar clientes;
lançar pedidos;
consultar disponibilidade;
consultar tabela de preços, conforme permissão;
negociar preço, conforme permissão;
gerar/consultar espelho comercial;
acompanhar pedidos do seu representante.
```

Escopo:

```text
filtrado por representantes permitidos.
```

## 2.2 Gestão / Fabrício

Responsabilidades:

```text
compras;
visão consolidada da disponibilidade;
aprovações;
preços;
acompanhamento operacional;
exceções;
relatórios.
```

Escopo:

```text
todos os representantes;
toda a operação.
```

## 2.3 Recebimento & Balança / Richard

Responsabilidades:

```text
receber carga;
conferir lote;
pesar peças;
classificar características;
destinar para pedido, estoque ou desossa;
imprimir etiquetas;
registrar divergências;
estornar ações permitidas.
```

Escopo:

```text
operação física da balança.
```

## 2.4 Desossa

Responsabilidades:

```text
acompanhar dashboard de faltas;
receber TZ destinado à desossa;
aplicar regra de transformação;
pesar partes;
classificar características;
destinar partes a pedido ou estoque;
imprimir etiquetas;
registrar divergências.
```

Escopo:

```text
peças destinadas à desossa;
pedidos que dependem de partes transformadas.
```

## 2.5 Estoque

Responsabilidades:

```text
consultar estoque físico;
registrar entrada de itens não pesáveis;
ajustar estoque;
consultar local/câmara;
acompanhar itens disponíveis/reservados.
```

## 2.6 Carga / Ludmila

Responsabilidades:

```text
planejar carga;
conferir itens destinados;
organizar caminhão/rota;
confirmar carga;
enviar para faturamento.
```

## 2.7 Faturamento / Carla

Responsabilidades:

```text
pré-faturamento;
conferir peso e preço final;
emitir nota fiscal;
gerar XML;
registrar seguro manual;
liberar caminhão;
tratar cancelamentos fiscais/reaberturas autorizadas.
```

## 2.8 Administração

Responsabilidades:

```text
cadastros estruturais;
usuários;
perfis;
permissões;
parâmetros;
auditoria.
```

---

# 3. Menu principal canônico

Este é o menu completo da aplicação antes de aplicar permissões.

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
├─ Disponibilidade
└─ Espelho Comercial

GESTÃO
├─ Dashboard Operacional
├─ Compras
├─ Aprovações
└─ Relatórios de Gestão

RECEBIMENTO & BALANÇA
├─ Recebimento de Carga
├─ Pesagem e Destinação
└─ Etiquetas

DESOSSA
├─ Dashboard da Desossa
├─ Pesagem e Destinação
└─ Etiquetas

ESTOQUE
├─ Consulta de Estoque
├─ Entrada de Itens
└─ Ajustes

CARGA
├─ Planejamento de Carga
├─ Conferência
└─ Enviar para Faturamento

FATURAMENTO
├─ Pré-Faturamento
├─ Notas / XML
├─ Seguro Manual
└─ Liberação do Caminhão

CADASTROS & REGRAS
├─ Representantes
├─ Produtos
├─ Fornecedores / Frigoríficos
├─ Caminhões
├─ Motoristas
├─ Rotas / Itinerários
├─ Regras de Transformação
└─ Modelos de Etiqueta

ADMINISTRAÇÃO
├─ Usuários
├─ Perfis de Acesso
├─ Parâmetros
└─ Auditoria
```

---

# 4. Menus por perfil

## 4.1 Sabrina / Comercial Alpha Carnes

Escopo:

```text
Representante: Sabrina / Alpha Carnes
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
├─ Disponibilidade
└─ Espelho Comercial
```

Permissões prováveis:

```text
consultar/criar cliente conforme política;
lançar pedido;
consultar disponibilidade;
negociar preço dentro de limite;
consultar pedidos do representante;
gerar espelho comercial.
```

## 4.2 Usuário Cemol / Duda

Escopo:

```text
Representante: Duda / Cemol
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Disponibilidade
└─ Espelho Comercial
```

Permissões prováveis:

```text
consultar clientes do seu representante;
lançar pedidos do seu representante;
consultar disponibilidade permitida;
consultar próprios pedidos.
```

Restrições:

```text
não ver todos os clientes;
não ver todos os representantes;
não ver compras;
não ver faturamento global;
não ver configurações.
```

## 4.3 Usuário Zona Sul / Carlos

Mesmo conceito do usuário Cemol.

Escopo:

```text
Representante: Carlos / Zona Sul
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Disponibilidade
└─ Espelho Comercial
```

## 4.4 Fabrício / Gestão

Escopo:

```text
Todos os representantes
```

Menu:

```text
GESTÃO
├─ Dashboard Operacional
├─ Compras
├─ Aprovações
└─ Relatórios de Gestão

COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
└─ Disponibilidade

ESTOQUE
└─ Consulta de Estoque

CARGA
└─ Consulta / Acompanhamento

FATURAMENTO
└─ Consulta
```

Permissões prováveis:

```text
publicar ou validar preços;
comprar;
consultar tudo;
aprovar estornos/reaberturas;
acompanhar exceções;
ver disponibilidade consolidada.
```

## 4.5 Richard / Balança

Menu:

```text
RECEBIMENTO & BALANÇA
├─ Recebimento de Carga
├─ Pesagem e Destinação
└─ Etiquetas
```

Permissões:

```text
abrir/operar recebimento;
pesar;
destinar;
imprimir/reimprimir etiquetas;
estornar ações permitidas;
registrar divergência.
```

Não deve ver:

```text
Tabela de preços;
Compras gerenciais;
Faturamento;
Administração;
Todos os relatórios.
```

## 4.6 Desossa

Menu:

```text
DESOSSA
├─ Dashboard da Desossa
├─ Pesagem e Destinação
└─ Etiquetas
```

Permissões:

```text
consultar faltas do dashboard;
pesar partes;
destinar partes;
imprimir etiquetas;
registrar divergência;
estornar ações permitidas da desossa.
```

## 4.7 Estoque

Menu:

```text
ESTOQUE
├─ Consulta de Estoque
├─ Entrada de Itens
└─ Ajustes
```

Permissões:

```text
consultar estoque;
registrar entrada de itens não pesáveis;
ajustar estoque conforme permissão;
consultar histórico.
```

## 4.8 Ludmila / Carga

Menu:

```text
CARGA
├─ Planejamento de Carga
├─ Conferência
└─ Enviar para Faturamento
```

Permissões:

```text
visualizar pedidos destinados;
conferir carga;
confirmar carga;
enviar para faturamento;
registrar divergência de carga.
```

## 4.9 Carla / Faturamento

Menu:

```text
FATURAMENTO
├─ Pré-Faturamento
├─ Notas / XML
├─ Seguro Manual
└─ Liberação do Caminhão
```

Permissões:

```text
conferir pesos/preços finais;
emitir NF-e;
gerar XML;
registrar seguro manual;
liberar caminhão;
tratar cancelamentos fiscais;
consultar pedidos/cargas.
```

## 4.10 Administrador

Menu:

```text
CADASTROS & REGRAS
├─ Representantes
├─ Produtos
├─ Fornecedores / Frigoríficos
├─ Caminhões
├─ Motoristas
├─ Rotas / Itinerários
├─ Regras de Transformação
└─ Modelos de Etiqueta

ADMINISTRAÇÃO
├─ Usuários
├─ Perfis de Acesso
├─ Parâmetros
└─ Auditoria
```

Permissões:

```text
manutenção do sistema;
cadastro estrutural;
perfis e permissões;
auditoria.
```

---

# 5. Modelo de permissões recomendado

## 5.1 Usuário

Campos:

```text
Nome
Login
Perfil funcional
Representantes permitidos
Permissões especiais
Status
```

## 5.2 Perfil funcional

Campos:

```text
Nome do perfil
Menus permitidos
Ações permitidas
Pode consultar todos representantes?
Pode alterar preço?
Pode aprovar estorno?
Pode faturar?
Pode liberar caminhão?
```

## 5.3 Representante

Campos:

```text
Nome
Tipo / canal
Status
Clientes vinculados
Usuários vinculados
```

## 5.4 Cliente

Todo cliente deve ter representante obrigatório.

```text
Cliente
├─ Representante
├─ Tabela comercial
├─ Rota padrão
└─ Preferências operacionais
```

## 5.5 Pedido

Pedido herda o representante do cliente.

```text
Pedido
├─ Cliente
├─ Representante herdado
├─ Usuário que lançou
├─ Itens
└─ Status
```

---

# 6. Observações de prototipação

1. O menu do protótipo pode mostrar todos os grupos para o perfil Admin, mas cada persona operacional deve ver apenas seu recorte.
2. Não criar menus separados por representante.
3. Não criar “Comercial Alpha” e “Comercial Cemol”. Usar uma tela Comercial única com escopo por representante.
4. Não criar menu de Caixaria.
5. Não criar menu de Pendências ou Minha Fila neste momento.
6. A desossa precisa de um dashboard visual e uma tela operacional de pesagem/destinação.
7. A disponibilidade deve ser visível para Comercial e Gestão, mas com colunas/escopo diferentes.


---

<!-- Arquivo: 04_especificacao_telas_campos.md -->

# Alfa Carnes — Especificação Base de Telas e Campos

**Versão:** 0.1
**Objetivo:** documentar as telas previstas, seus objetivos, usuários, campos, ações e validações iniciais.

---

# 1. COMERCIAL

---

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

## 2.1 Gestão → Dashboard Operacional

### Objetivo

Dar visão consolidada para Fabrício/gestão sobre compra, venda, disponibilidade, faltas e operação.

### Campos/indicadores

```text
Compra do dia
Pedidos do dia
Disponibilidade total
Disponibilidade por produto
Pedidos bloqueados por falta de disponibilidade
Itens críticos
Estoque anterior
Itens em desossa
Cargas em andamento
Notas/faturamentos pendentes
Divergências abertas
```

### Ações

```text
Abrir detalhe de disponibilidade
Abrir compras
Abrir pedidos
Abrir divergências
Aprovar ajustes/reaberturas, conforme permissão
```

---

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

## 2.3 Gestão → Aprovações

### Objetivo

Centralizar aprovações e conferências que exigem gestão.

### Tipos

```text
Divergência de recebimento
Divergência de transformação
Estorno fora da regra simples
Reabertura de carga/pedido
Cancelamento fiscal, se necessário
Ajuste de estoque relevante
```

### Campos

```text
Tipo
Origem
Descrição
Usuário solicitante
Data/hora
Impacto
Status
Decisão
Responsável pela decisão
```

---

# 3. RECEBIMENTO & BALANÇA

---

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

## 4.2 Desossa → Pesagem e Destinação

### Objetivo

Tela operacional da desossa para registrar as partes geradas a partir de TZ.

### Campos principais

```text
TZ origem
Código da peça mãe
Peso original do TZ
Fornecedor/frigorífico
NF/lote
Regra de transformação aplicada
Saídas esperadas da regra
Produto gerado atual
Quantidade esperada do produto gerado
Quantidade já registrada
Peso atual da parte
Características opcionais:
  - Mais pesada
  - Mais gorda
  - Melhor acabamento
Cliente/marca
Pedidos compatíveis pendentes
Destino: Pedido ou Estoque
Etiqueta
Operador
Data/hora
```

### Busca

```text
Textsearch por cliente/marca.
```

### Ações

```text
Selecionar/ler TZ origem
Selecionar regra de transformação
Capturar peso
Digitar peso manual
Marcar características
Buscar cliente/marca
Associar parte a pedido
Enviar parte para estoque
Confirmar e imprimir etiqueta
Listar ações realizadas
Cancelar/estornar ação permitida
Finalizar transformação do TZ
Registrar divergência de transformação
```

### Regras

```text
Somente TZ é origem de transformação.
Regra tem quantidade fixa de saídas.
Peso das saídas é variável.
Parte não associada a pedido vai automaticamente para estoque.
Se saídas registradas não baterem com saídas esperadas, gerar divergência.
```

---

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

## 6.1 Carga → Planejamento de Carga

### Objetivo

Organizar pedidos atendidos em cargas/caminhões/rotas.

### Campos

```text
Carga
Data
Caminhão
Motorista
Rota
Representante/canal
Clientes
Pedidos
Status
Observações
```

### Itens

```text
Produto
Quantidade pedida
Quantidade atendida
Peso atendido
Origem: balança, desossa, estoque, entrada direta
Cliente
Pedido
Status de conferência
```

### Ações

```text
Criar carga
Adicionar pedidos
Agrupar por rota
Agrupar por representante
Gerar espelho de carga
Enviar para conferência
```

---

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

## 7.1 Faturamento → Pré-Faturamento

### Objetivo

Conferir pedidos/cargas atendidas antes da emissão fiscal.

### Campos

```text
Carga
Pedido
Cliente
Representante
Produto
Quantidade atendida
Peso atendido
Preço final
Valor final
Status da conferência
Divergências
```

### Ações

```text
Conferir peso/preço
Solicitar ajuste
Liberar para NF-e
Bloquear alteração operacional
```

---

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


---

<!-- Arquivo: 05_glossario_lacunas_backlog.md -->

# Alfa Carnes — Glossário, Decisões, Lacunas e Backlog Inicial

**Versão:** 0.1
**Objetivo:** registrar termos, decisões já fechadas, lacunas remanescentes e backlog inicial de construção.

---

# 1. Glossário operacional

## Balança principal

Tela/local onde as peças recebidas são pesadas e destinadas. Trabalha com produto como chegou: DT, PA, TZ, banda de porco e outros pesáveis inteiros.

## Balança da desossa

Tela/local onde as partes geradas a partir do TZ são pesadas, classificadas, etiquetadas e destinadas para pedido ou estoque.

## Cross-docking

Fluxo em que a mercadoria recebida é rapidamente destinada a pedidos/cargas, sem permanecer como estoque por longo período.

## Estoque

Visão física dos itens existentes: peças, partes, caixas, bandas, produtos por unidade e sobras.

## Disponibilidade

Visão comercial calculada a partir de estoque físico, compras, pedidos, reservas e regras de transformação.

## Estoque virtual inteligente

Motor que exibe todos os itens potencialmente vendáveis com base nas regras de transformação e recalcula dependentes/compartilhados a cada reserva.

## Representante

Dimensão comercial vinculada ao cliente e ao pedido. Exemplos: Sabrina/Alpha, Duda/Cemol, Carlos/Zona Sul.

## Perfil funcional

Papel operacional do usuário no sistema: Comercial, Gestão, Balança, Desossa, Estoque, Carga, Faturamento, Administração.

## TZ

Traseiro. É a origem transformável da operação.

## PA

Ponta de Agulha. Pode ser vendida como peça inteira e associada na balança.

## DT

Dianteiro. Pode ser vendido como peça inteira e associado na balança.

## Transformação

Abertura/desmembramento de um TZ em partes/cortes cadastrados por regra.

## Regra de transformação

Cenário cadastrado que define quais produtos e quantidades fixas são gerados a partir de 1 TZ.

## Saída virtual

Possibilidade comercial de item derivado de TZ antes da desossa física.

## Saída física

Parte real gerada após desossa, com peso e etiqueta.

## Reserva inteligente

Reserva que compromete uma origem física ou virtual e recalcula automaticamente tudo que continua ou deixa de ser possível vender.

## Peça mãe

TZ original enviado à desossa.

## Parte gerada

Produto resultante da transformação do TZ.

## Etiqueta de destino interno

Etiqueta usada quando a peça/parte vai para estoque ou desossa, sem cliente final ainda.

## Etiqueta de pedido

Etiqueta usada quando a peça/parte está associada a um pedido/cliente.

---

# 2. Decisões já fechadas

## Operação

```text
A operação é cross-docking com possibilidade de estoque inicial e final.
A base de estoque é única.
Disponibilidade é uma visão calculada.
```

## Representante / usuário

```text
Representante não é persona.
Todo cliente tem representante obrigatório.
Pedido herda representante do cliente.
Usuário tem perfil funcional e representantes permitidos.
```

## Pedido

```text
Maioria dos pedidos é por unidade.
Preço pode ser por peso.
Item do pedido deve registrar peso atendido.
Pedido trava sem disponibilidade.
```

## Balança principal

```text
Balança não transforma.
Pode associar direto a pedido apenas DT, PA, TZ inteiro, banda de porco ou produto pesável compatível.
Pedidos de partes derivadas de TZ são atendidos na desossa.
Busca na balança é por cliente/marca.
```

## Desossa

```text
Somente TZ é transformado.
Não haverá transformação em cadeia.
Toda regra parte diretamente do TZ.
Quantidade de saídas é fixa.
Peso das saídas é variável.
Partes não associadas a pedido vão automaticamente para estoque.
Desossa não será travada; será orientada por dashboard estilo aeroporto.
```

## Estoque virtual

```text
Deve mostrar todos os itens potencialmente vendáveis.
Ao reservar um item, recalcula os dependentes/compartilhados.
A reserva inteligente baixa o que deixou de ser possível.
```

## Características de qualidade/perfil

```text
Mais pesada
Mais gorda
Melhor acabamento
```

## Estoque

```text
Estoque anterior sai primeiro automaticamente.
```

## Caixas / caixaria

```text
Caixaria não é módulo separado.
Caixas são produtos cadastrados.
Caixas são vendidas por unidade.
Caixas não passam por balança nem desossa.
```

## Faturamento

```text
Sistema emitirá NF-e.
Comunicação SEFAZ Osasco considerada.
Seguro é manual.
```

## Cancelamento / estorno

```text
Deve listar ações realizadas.
Não apenas cancelar última ação.
Pode estornar enquanto não houver consumo posterior.
Não pode estornar na balança um TZ já transformado na desossa.
```

---

# 3. Lacunas ainda abertas

## 3.1 Regras completas de transformação do TZ

Ainda falta levantar a lista real de todas as regras possíveis.

Para cada regra, precisamos saber:

```text
Nome da regra
Produtos gerados
Quantidade fixa de cada produto
Se a regra é comum ou excepcional
Observações operacionais
```

Exemplos hipotéticos a validar:

```text
TZ -> 1 Jacaré + 1 Coxão Bola
TZ -> 1 Jacaré + 2 Alcatras
TZ -> 1 Jacaré + 1 Filé
TZ -> Pontas + Filés
TZ -> outras combinações
```

## 3.2 Produtos comercializáveis completos

Ainda é necessário receber/listar todos os produtos vendidos:

```text
DT
PA
TZ
Jacaré
Coxão Bola
Alcatra
Filé
Miolo
Pontas
Banda de porco
Caixas de miúdos
Caixas de rabo
Caixas de fígado
Mocotó
Outros
```

Para cada produto, definir:

```text
unidade de pedido;
unidade de preço;
exige peso;
passa pela balança;
passa pela desossa;
pode ir para estoque;
ativo na tabela de venda.
```

## 3.3 Marco exato de fechamento do pedido

Sugestão atual:

```text
Pedido fechado = carga conferida ou enviada para faturamento.
```

Precisa ser validado se a trava deve ocorrer em:

```text
carga conferida;
envio para faturamento;
nota emitida;
liberação do caminhão.
```

## 3.4 Regras fiscais detalhadas

Ainda será necessário detalhar:

```text
ambiente SEFAZ;
emissão NF-e;
cancelamento fiscal;
contingência;
tratamento de erro de autorização;
integração com certificado digital;
guarda de XML.
```

## 3.5 Seguro manual

Confirmar fluxo operacional:

```text
quem envia;
quando envia;
quais dados obrigatórios;
se anexa comprovante;
quando considera seguro OK.
```

## 3.6 Impressoras e etiquetas

Ainda precisa definir:

```text
modelo físico da etiqueta;
tamanho;
campos obrigatórios;
QR Code ou código de barras;
impressora na balança principal;
impressora na desossa;
processo de reimpressão.
```

## 3.7 Hardware e integração de balança

Confirmar:

```text
integração automática com balança;
digitação manual no MVP;
dispositivos usados na balança;
dispositivos usados na desossa;
uso em câmara fria/ambiente úmido.
```

---

# 4. Backlog inicial sugerido

## P0 — Base obrigatória

```text
Cadastro de usuários/perfis/representantes
Cadastro de clientes
Cadastro de produtos
Cadastro de regras de transformação
Cadastro de fornecedores/frigoríficos
Tabela de preços
Pedido de venda com validação de disponibilidade
Motor de disponibilidade virtual inteligente
Gestão de compras
Recebimento de carga
Pesagem e destinação na balança principal
Etiquetas da balança
Dashboard da desossa
Pesagem/destinação da desossa
Consulta de estoque
Pré-faturamento
Emissão NF-e / XML
```

## P1 — Operação integrada

```text
Planejamento/conferência de carga
Seguro manual
Liberação do caminhão
Estornos/cancelamentos operacionais com histórico
Divergências de recebimento
Divergências de transformação
Ajustes de estoque
Relatórios básicos
```

## P2 — Refinamentos

```text
Simulador de regras de transformação
Sugestão avançada por perfil de cliente
Painel de gestão mais completo
Dashboards executivos
Integrações adicionais
Relatórios analíticos
```

---

# 5. Sequência recomendada de refinamento de telas

## 1. Cadastros estruturais

```text
Produtos
Regras de transformação
Representantes
Clientes
Tabela de preços
```

Motivo: sem estes cadastros o motor de disponibilidade não funciona.

## 2. Comercial e disponibilidade

```text
Pedidos de venda
Disponibilidade
Reserva inteligente
```

Motivo: aqui está o core comercial da operação.

## 3. Recebimento e balança

```text
Recebimento de carga
Pesagem e destinação
Etiquetas
Estornos
```

Motivo: principal ponto operacional e de velocidade.

## 4. Desossa

```text
Dashboard estilo aeroporto
Pesagem e destinação
Divergências de transformação
Etiquetas
```

Motivo: transformação impacta estoque e atendimento de pedidos.

## 5. Estoque e carga

```text
Consulta de estoque
Entrada de itens
Planejamento de carga
Conferência
```

## 6. Faturamento

```text
Pré-faturamento
NF-e / XML
Seguro manual
Liberação
```

---

# 6. Regras de ouro do projeto

1. **Não duplicar módulos por representante.**
2. **Não duplicar estoque físico e estoque virtual.**
3. **Disponibilidade é cálculo inteligente sobre uma base única.**
4. **A balança precisa ser mais rápida que o papel.**
5. **A desossa precisa de orientação visual, não trava operacional.**
6. **O sistema deve sugerir, mas a operação ainda decide.**
7. **Transformação é direta do TZ; não há cadeia de transformação.**
8. **Peso real é essencial para faturamento.**
9. **Cancelamento deve ser fácil, mas auditado e bloqueado quando houver etapa posterior.**
10. **Toda peça/parte deve preservar origem e rastreabilidade.**
