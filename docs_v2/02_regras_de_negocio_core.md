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
