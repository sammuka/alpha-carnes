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
