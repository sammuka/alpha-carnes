# AlphaCarnes — Contexto funcional consolidado e recomendações para prototipação

**Versão:** 1.1
**Data de consolidação:** 22/07/2026
**Última atualização:** nomenclatura de Nome Fantasia e conferência final da pesagem contra a NF
**Finalidade:** fornecer a uma agente de produto, UX/UI, análise de negócios ou desenvolvimento todo o contexto funcional já discutido sobre o MVP do projeto AlphaCarnes, incluindo decisões confirmadas, regras provisórias, fluxos, telas recomendadas, critérios de aceite e lacunas ainda abertas.

---

## 1. Como interpretar este documento

Este documento combina:

1. os entendimentos extraídos da reunião entre Jefferson, Samuel e Alisson;
2. as definições posteriores fornecidas por Samuel;
3. recomendações de modelagem e prototipação derivadas dessas definições.

### 1.1 Hierarquia de autoridade

Ao implementar ou prototipar, considerar a seguinte ordem:

1. **Definições confirmadas posteriormente por Samuel** — prevalecem sobre hipóteses ou ambiguidades da reunião;
2. **Entendimentos praticamente fechados pelo time durante a reunião**;
3. **Recomendações deste documento** — devem ser tratadas como propostas de UX ou arquitetura, não como regras de negócio confirmadas;
4. **Pontos pendentes** — não devem ser inventados nem transformados em regra definitiva.

### 1.2 Convenções usadas

- **Regra confirmada:** decisão que já deve orientar o protótipo.
- **Regra provisória:** pode ser usada para avançar, mas deve permanecer parametrizável e sujeita a validação.
- **Recomendação:** proposta de experiência, arquitetura ou operação.
- **Pendente:** informação ainda não definida.

### 1.3 Alterações incorporadas na versão 1.1

- A expressão operacional anteriormente tratada como “Marca” passa a ser denominada **Nome Fantasia**.
- O Nome Fantasia pertence ao cadastro do cliente e é o identificador operacional usado nas buscas e associações de pedidos.
- A conclusão da pesagem de um lote ou pedido de compra passa a gerar obrigatoriamente uma etapa de **conferência final contra a nota fiscal recebida**.
- O sistema deve acumular, por produto, a quantidade de peças e a soma dos pesos registrados na pesagem.
- Esses totais devem ser confrontados com os itens da NF e com a base do pedido ao fornecedor.
- Divergências são registradas sistemicamente; a negociação e solução com o fornecedor permanecem manuais e sob responsabilidade da equipe administrativa.

---

## 2. Visão geral do projeto

O projeto AlphaCarnes pretende digitalizar uma operação hoje muito dependente de planilhas, comunicação informal, conhecimento pessoal e ajustes manuais.

O fluxo principal compreende:

```text
Programação da compra
→ formação do estoque virtual
→ elaboração dos pedidos de venda
→ reserva imediata das quantidades
→ finalização dos pedidos
→ recebimento do caminhão
→ conferência contra o pedido ao fornecedor
→ pesagem das peças
→ associação das peças aos pedidos, estoque ou desossa
→ etiquetagem
→ expedição
→ faturamento e emissão fiscal por integração
→ relatórios do SIF
```

O núcleo de maior complexidade é o controle conjunto de:

- estoque físico;
- estoque virtual;
- itens reservados em pedidos ainda em elaboração;
- itens já comprometidos em pedidos finalizados;
- transformações de peças, especialmente do TZ;
- overbooking sem bloqueio comercial;
- rastreabilidade entre compra, fornecedor, peça, pedido, cliente, etiqueta e nota fiscal.

---

## 3. Objetivos do MVP

O MVP deve permitir que a AlphaCarnes:

1. programe compras e gere disponibilidade antes da chegada física da carga;
2. disponibilize essa quantidade aos vendedores em tempo praticamente real;
3. reserve produtos enquanto o pedido ainda está sendo montado;
4. permita vender acima da disponibilidade mediante confirmação explícita;
5. dê ao Fabrício uma visão clara dos déficits que precisará resolver;
6. confira a chegada do caminhão com base no pedido feito ao fornecedor;
7. registre pesagem e destinação de cada peça;
8. preserve rastreabilidade do frigorífico, mesmo quando o produto comercial é unificado;
9. execute trocas de peças sem perder o peso originalmente registrado;
10. registre entrada e saída da desossa de forma simples;
11. gere etiquetas com código de barras, QR Code e conteúdo legível;
12. integre a emissão das notas fiscais por meio de outro sistema;
13. produza os relatórios do SIF incluídos na entrega inicial.

---

## 4. Escopo confirmado do MVP

### 4.1 Incluído

- programação de compras;
- estoque físico;
- estoque virtual;
- reserva em pedidos em elaboração;
- pedidos de venda e adendos;
- overbooking;
- cadastro de Cliente / Nome Fantasia;
- associação de vendedor ou representante ao Cliente / Nome Fantasia;
- cadastro de fornecedores e frigoríficos;
- catálogo comercial do MVP;
- caixarias;
- banda de porco;
- partes do boi já definidas;
- transformação inicial do TZ;
- recebimento e conferência de carga;
- ocorrência de divergência;
- pesagem;
- associação a pedido, estoque ou desossa;
- troca de peças;
- entrada e saída da desossa;
- etiquetas operacionais;
- rastreabilidade;
- relatórios do SIF;
- integração fiscal para emissão de nota pela AlphaCarnes.

### 4.2 Fora do MVP

- produção detalhada de bandejas;
- custos de embalagem;
- etiquetas de varejo;
- controle granular de cortes de açougue não definidos;
- cálculo de rendimento por peso;
- gestão industrial completa da desossa;
- cadastro da AlphaCarnes como cliente interno;
- bloqueio absoluto de overbooking;
- diferenciação comercial de produtos iguais apenas pelo frigorífico.

---

## 5. Glossário do domínio

### 5.1 Estoque físico

Quantidade já recebida e fisicamente disponível na AlphaCarnes.

### 5.2 Estoque virtual

Quantidade gerada na **programação da compra**, antes da chegada física da mercadoria.

### 5.3 Estoque disponível comercialmente

Quantidade que pode ser oferecida aos vendedores após considerar estoque físico, estoque virtual, reservas e vendas confirmadas.

### 5.4 Reserva ou “carrinho”

Quantidade adicionada a um pedido ainda não finalizado. Mesmo sem a conclusão do pedido, essa quantidade deve reduzir imediatamente a disponibilidade percebida pelos demais vendedores.

### 5.5 Overbooking

Venda acima da disponibilidade física e virtual conhecida. É permitida, não possui limite previamente definido e precisa de confirmação explícita.

### 5.6 Cliente e Nome Fantasia

O **Nome Fantasia** é o identificador operacional do cliente usado na rotina comercial e nas buscas do sistema. Exemplos citados na reunião: `D1`, `L11` e `300`.

Regras confirmadas:

- o Nome Fantasia pertence ao cadastro do cliente;
- deve ser único em todo o sistema;
- cada cliente, identificado operacionalmente pelo Nome Fantasia, possui um vendedor ou representante associado;
- a expressão “Marca” não deve ser usada nas telas, especificações ou regras do projeto;
- quando necessário, o sistema também pode exibir razão social, CNPJ e demais dados fiscais, mas o operador deve localizar o cliente principalmente pelo Nome Fantasia.

### 5.7 Adendo

Acréscimo a um pedido aberto já existente para o mesmo Nome Fantasia e o mesmo tipo de peça, evitando a abertura de um segundo pedido concorrente para a mesma combinação.

### 5.8 TZ

Traseiro bovino. Pode ser vendido inteiro ou destinado à transformação conforme regras comerciais provisórias.

### 5.9 DT

Dianteiro bovino.

### 5.10 PA

Ponta de agulha.

### 5.11 Desossa

No MVP, é uma etapa simplificada que registra somente entrada e saída. Não é um módulo industrial completo.

### 5.12 Ocorrência de divergência

Registro sistêmico e auditável criado quando as quantidades ou os pesos apurados na conclusão da pesagem divergem do pedido ao fornecedor ou dos itens da nota fiscal recebida. A ocorrência subsidia a tratativa manual da equipe administrativa com o fornecedor.

---

## 6. Regras de negócio confirmadas

## 6.1 Programação da compra e criação do estoque virtual

1. O estoque virtual é criado na **programação da compra**.
2. A AlphaCarnes normalmente compra o **boi casado completo**.
3. A compra costuma ser programada:
   - um dia antes da operação; ou
   - na finalização dos pedidos.
4. Alterações no pedido ou programação de compra devem recalcular imediatamente toda a disponibilidade virtual impactada.
5. A equipe pode começar com regras provisórias, desde que permaneçam parametrizáveis.

### Regra conceitual

```text
Programação de compra confirmada
→ gera quantidades virtuais dos itens comercializáveis
→ essas quantidades ficam disponíveis para reserva e venda
```

### Pendente

A composição quantitativa exata de um boi casado ainda precisa ser formalmente validada. O protótipo não deve assumir definitivamente, sem confirmação, uma composição como `2 TZ + 2 DT + 2 PA`, embora essa possa ser usada em dados fictícios claramente identificados como demonstração.

---

## 6.2 Formação da disponibilidade comercial

A disponibilidade deve considerar:

```text
Estoque físico disponível
+ estoque virtual programado
- reservas de pedidos em elaboração
- quantidades comprometidas em pedidos finalizados
= saldo comercial antes do overbooking
```

### Prioridade de consumo

O estoque físico já existente deve ser somado ao virtual e disponibilizado aos vendedores, mas o consumo deve seguir esta prioridade:

```text
1. Estoque físico
2. Estoque virtual
3. Overbooking
```

### Recomendação de implementação

A prioridade deve ser automática. O usuário comercial não deve precisar escolher manualmente entre físico e virtual em cada item. Exceções futuras podem ser parametrizadas, mas não devem aumentar a complexidade do MVP.

---

## 6.3 Reserva durante a elaboração do pedido

1. O estoque deve refletir o “carrinho de compras” dos pedidos em realização.
2. Quando um vendedor adiciona uma quantidade a um pedido em elaboração, a disponibilidade deve ser reduzida imediatamente.
3. Os demais vendedores devem enxergar a mudança sem aguardar a finalização do pedido.
4. Ao remover o item do pedido, a quantidade deve retornar imediatamente à disponibilidade.
5. Ao finalizar o pedido, a reserva muda de estado para compromisso confirmado, sem nova redução duplicada.

### Recomendação técnica

Usar reserva transacional e atualização em tempo real ou quase real. A operação precisa impedir que duas ações simultâneas consumam silenciosamente a mesma última unidade disponível.

### Recomendação de UX

Exibir uma mensagem discreta após a inclusão:

```text
5 unidades reservadas neste pedido.
A disponibilidade foi atualizada para os demais vendedores.
```

### Pendente

Ainda deve ser definido como liberar reservas de pedidos abandonados ou esquecidos. Até a definição, o protótipo pode apresentar um status “Rascunho com reserva ativa” e uma ação administrativa “Liberar reserva”.

---

## 6.4 Overbooking

1. Qualquer vendedor pode realizar overbooking.
2. Não existe limite máximo previamente definido.
3. Quando a disponibilidade chegar a zero ou a venda superar o saldo, o sistema deve solicitar confirmação explícita.
4. O sistema não deve bloquear a venda depois da confirmação.
5. Fabrício é o responsável por decidir como resolver a falta.
6. A quantidade postergada para uma próxima operação deve gerar **novo pedido**.
7. Não é necessário informar no pedido ou na nota que parte da quantidade será entregue posteriormente.

### Exemplo de confirmação recomendada

```text
Disponibilidade insuficiente

Produto: TZ
Disponível antes desta inclusão: 2
Quantidade solicitada: 5
Overbooking gerado: 3

A venda poderá ser concluída, mas Fabrício deverá tratar a falta.

[Voltar e ajustar] [Confirmar overbooking]
```

### Recomendação funcional

Toda confirmação deve gerar um item no painel de pendências do Fabrício contendo:

- produto;
- quantidade deficitária;
- Cliente / Nome Fantasia;
- vendedor;
- pedido;
- operação ou data prevista;
- data e hora da confirmação;
- status da resolução;
- histórico das ações.

### Estados recomendados da pendência

- aberto;
- em análise;
- compra complementar programada;
- redistribuição decidida;
- novo pedido criado;
- resolvido;
- cancelado.

---

## 6.5 Produtos do MVP

A lista comercial inicial deve incluir:

- caixarias;
- banda de porco;
- partes do boi já definidas;
- TZ inteiro;
- DT;
- PA;
- derivados comerciais do TZ definidos abaixo.

Produtos iguais de frigoríficos diferentes devem ser um único produto comercial. A origem deve permanecer na rastreabilidade da compra e da peça física.

### Regra

```text
Produto comercial: único
Origem/frigorífico: atributo rastreável da compra, lote e peça
```

### Preferências do cliente

Preferências como:

- mais gordo ou mais magro;
- faixa de peso;
- preferência de frigorífico;
- observações de qualidade;

são apenas observações. Não devem bloquear automaticamente uma associação no MVP.

---

## 6.6 Transformação provisória do TZ

A reunião convergiu para duas alternativas comerciais de divisão do TZ.

```text
TZ — Traseiro
├── Alternativa A
│   ├── Coxão-bola
│   └── Jacaré
│
└── Alternativa B
    ├── Coxão-bola com alcatra
    └── Filé curto
```

### Regras

1. As transformações são unitárias.
2. O controle inicial é por quantidade de peças, não por peso.
3. O peso será utilizado posteriormente para cobrança.
4. Não deve haver cálculo de rendimento esperado por peso.
5. A regra deve ser parametrizável, não gravada de forma rígida no código.
6. A equipe pode utilizar essa regra provisória para avançar no protótipo.

### Interpretação comercial

O próprio TZ também pode permanecer como item comercializável inteiro. Assim, o cadastro pode apresentar:

- TZ inteiro;
- Coxão-bola;
- Jacaré;
- Coxão-bola com alcatra;
- Filé curto.

### Regra de exclusividade

Ao escolher uma alternativa de transformação, os produtos incompatíveis da outra alternativa não devem permanecer disponíveis para aquela unidade de TZ.

Exemplo:

```text
1 TZ transformado em Coxão-bola + Jacaré
→ não pode simultaneamente gerar Coxão-bola com alcatra + Filé curto
```

---

## 6.7 Controle por quantidade e uso do peso

1. O estoque comercial inicial é controlado por quantidade de peças.
2. O peso é capturado no recebimento ou na operação física.
3. O peso é usado posteriormente para cobrança e faturamento.
4. O motor de disponibilidade não deve calcular equivalência com base em quilos.
5. O sistema não deve prever rendimento percentual ou perda produtiva no MVP.

---

## 6.8 Cliente, Nome Fantasia e vendedor

1. O Nome Fantasia é único em todo o sistema.
2. O Nome Fantasia é um atributo do cadastro do cliente, e não uma entidade denominada “Marca”.
3. Cada cliente, identificado pelo Nome Fantasia, possui um vendedor ou representante associado.
4. O cadastro do cliente deve ocorrer no processo comercial, não na tela da balança.
5. O operador da pesagem deve localizar pedidos pelo Nome Fantasia e selecionar um pedido compatível.
6. Preferências ficam como observações.

### Recomendação de busca

A busca deve aceitar digitação progressiva e retornar:

- Nome Fantasia;
- razão social ou nome cadastral, quando aplicável;
- CNPJ ou outro identificador fiscal, quando aplicável;
- vendedor responsável;
- pedidos abertos;
- operação/data prevista;
- quantidades ainda pendentes por item.

### Recomendação de nomenclatura de interface

Usar sempre:

- `Nome Fantasia`;
- `Cliente`;
- `Buscar cliente por Nome Fantasia`;
- `Vendedor/representante responsável`.

Não usar `Marca` como rótulo, título de campo ou nome de entidade.

---

## 6.9 Pedido aberto e adendo

1. Não pode haver mais de um pedido aberto para o mesmo Nome Fantasia e o mesmo tipo de peça.
2. Uma nova solicitação deve ser adicionada como adendo ao pedido existente.
3. O adendo deve preservar histórico, autoria, data, quantidade anterior e quantidade adicionada.

### Recomendação de interface

Quando o vendedor tentar criar uma nova linha que já existe em pedido aberto:

```text
Já existe um pedido aberto para este Nome Fantasia e este produto.

Pedido: PV-000123
Quantidade atual: 8

[Ver pedido] [Adicionar como adendo]
```

### Pendente

Ainda deve ser confirmado se a data/operação de entrega participa da regra de unicidade. O protótipo deve exibir a operação no aviso para evitar que pedidos de datas distintas sejam confundidos.

---

## 6.10 Recebimento, pesagem e conferência final contra a NF

O pedido realizado ao fornecedor é a base operacional da chegada do caminhão. A nota fiscal recebida complementa essa base e deve ser confrontada com o resultado efetivamente apurado durante a pesagem.

### 6.10.1 Princípio de conferência em três referências

A conclusão do lote deve permitir comparar três fontes:

1. **Pedido ao fornecedor** — o que a AlphaCarnes programou ou comprou;
2. **Nota fiscal recebida** — o que o fornecedor declarou ter enviado e faturado;
3. **Pesagem realizada** — o que a AlphaCarnes efetivamente recebeu, contou e pesou.

A fonte física apurada pela pesagem não deve ser substituída pelos dados da NF. O sistema preserva cada referência separadamente e apresenta as diferenças.

### 6.10.2 Fluxo confirmado

1. selecionar ou carregar o pedido ao fornecedor;
2. visualizar os produtos e quantidades esperados no pedido;
3. informar o número da nota fiscal recebida;
4. carregar ou informar os itens da NF necessários à conferência;
5. iniciar a conferência física e a pesagem das peças;
6. acumular, por produto, a quantidade de peças pesadas e a soma dos respectivos pesos;
7. atualizar em tempo real o comparativo entre pedido, NF e pesagem;
8. concluir a pesagem do lote/pedido;
9. abrir obrigatoriamente uma etapa de revisão e conclusão da conferência;
10. classificar o resultado como sem divergência ou com divergência;
11. registrar sistemicamente uma ocorrência para cada divergência relevante;
12. encaminhar a ocorrência à equipe administrativa para tratamento manual com o fornecedor;
13. concluir o recebimento sem apagar ou alterar silenciosamente os valores originais.

### 6.10.3 Acumuladores obrigatórios por produto

Durante toda a pesagem, o sistema deve manter, por produto do pedido:

- quantidade prevista no pedido ao fornecedor;
- quantidade declarada na NF;
- quantidade efetivamente pesada/recebida;
- soma dos pesos declarados na NF, quando disponível;
- soma dos pesos efetivamente registrados na balança ou por digitação;
- diferença de quantidade entre pedido e NF;
- diferença de quantidade entre NF e pesagem;
- diferença de peso entre NF e pesagem;
- situação da conferência do item.

O acumulado deve ser calculado a partir das pesagens individuais vinculadas ao lote/pedido, evitando totais digitados manualmente como fonte principal.

### 6.10.4 Tela de conclusão da pesagem

Ao selecionar `Concluir pesagem`, o operador deve ser levado a uma tela ou etapa de resumo. Essa conclusão não deve ocorrer silenciosamente.

Exemplo recomendado:

| Produto | Pedido: qtd. | NF: qtd. | Pesado: qtd. | NF: peso | Peso apurado | Dif. qtd. NF × apurado | Dif. peso | Situação |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| TZ | 100 | 100 | 98 | 8.450 kg | 8.281 kg | -2 | -169 kg | Divergente |
| DT | 100 | 100 | 101 | 5.920 kg | 5.978 kg | +1 | +58 kg | Divergente |
| PA | 100 | 100 | 100 | 2.810 kg | 2.810 kg | 0 | 0 kg | Conferido |

Os valores são meramente ilustrativos. O protótipo deve sinalizar claramente que são dados fictícios.

### 6.10.5 Estados recomendados da conclusão

- `Pesagem em andamento`;
- `Aguardando conclusão da pesagem`;
- `Aguardando conferência final`;
- `Conferido sem divergência`;
- `Conferido com divergência`;
- `Ocorrência administrativa aberta`;
- `Tratativa administrativa concluída`.

### 6.10.6 Ocorrência de divergência

A divergência deve gerar registro próprio e auditável, sem modificar silenciosamente o pedido, a NF ou as pesagens. O registro deve conter:

- pedido ao fornecedor;
- lote/recebimento;
- número e identificação da nota fiscal;
- fornecedor/frigorífico;
- produto;
- quantidade prevista no pedido;
- quantidade declarada na NF;
- quantidade efetivamente recebida;
- peso declarado na NF, quando disponível;
- peso efetivamente apurado;
- diferenças calculadas;
- tipo da divergência: falta, excesso, peso divergente, produto não previsto ou outro;
- observação do operador;
- evidências ou anexos, quando necessários;
- usuário e data da constatação;
- responsável administrativo;
- status da tratativa;
- observações e histórico da solução manual.

### 6.10.7 Responsabilidade pela tratativa

A resolução da divergência com o fornecedor é **manual e administrativa**. A equipe administrativa deve usar o registro do sistema como base para contato, negociação, cobrança, ajuste documental ou outra providência.

O sistema deve:

- identificar e registrar a divergência;
- consolidar as quantidades e os pesos;
- disponibilizar o histórico;
- permitir atribuição e acompanhamento da ocorrência.

O sistema não deve, no MVP:

- negociar automaticamente com o fornecedor;
- alterar a NF;
- gerar ajuste financeiro automático sem integração e regra futura específica;
- apagar a diferença após a tratativa.

### 6.10.8 Objetivo de simplificação

O operador não deve redigitar toda a carga. O pedido ao fornecedor já fornece a estrutura esperada, e a pesagem individual alimenta automaticamente os totais efetivamente recebidos. A NF entra como referência documental adicional para a conferência final.

---

## 6.11 Pesagem

A tela de pesagem deve ser simples, rápida e adequada ao uso operacional.

### Ações principais

- identificar a peça;
- selecionar o tipo de produto;
- capturar automaticamente ou digitar o peso;
- localizar Nome Fantasia/pedido;
- associar ao pedido;
- enviar para estoque;
- enviar para desossa;
- imprimir etiqueta.

### Auditoria recomendada

Registrar:

- peso;
- origem do peso: balança ou digitação manual;
- usuário;
- data e hora;
- alterações posteriores;
- motivo de alteração;
- pedido ao fornecedor;
- nota fiscal;
- frigorífico/lote;
- destino atual.

---

## 6.12 Associação e destinação da peça

Uma peça recebida pode ser destinada a:

1. pedido de cliente;
2. estoque;
3. desossa.

A AlphaCarnes não deve ser cadastrada como cliente interno. Para uma peça ainda não destinada a cliente, o termo correto é **estoque**.

### Recomendação de UX

Como a maioria das peças tende a seguir para pedidos/expedição, destacar `Associar ao pedido` como ação principal e manter `Enviar ao estoque` e `Enviar à desossa` como alternativas visíveis.

---

## 6.13 Função específica de troca

Deve existir uma única função de troca que execute, de forma atômica:

1. seleção da peça atualmente associada;
2. seleção da nova peça;
3. desassociação da peça antiga;
4. nova destinação da peça antiga;
5. associação da nova peça ao pedido;
6. preservação do peso original das duas peças;
7. invalidação da etiqueta anterior;
8. impressão da nova etiqueta;
9. registro completo do histórico.

### Regra confirmada

O peso originalmente registrado permanece válido. A troca altera a destinação, não a pesagem.

### Campos recomendados

- pedido;
- Nome Fantasia;
- peça retirada;
- peso da peça retirada;
- nova destinação;
- peça inserida;
- peso da peça inserida;
- motivo;
- usuário;
- data e hora;
- etiqueta invalidada;
- etiqueta emitida.

---

## 6.14 Desossa no MVP

1. A desossa registra somente entrada e saída.
2. A AlphaCarnes não é cliente interno.
3. A peça destinada à desossa sai da disponibilidade normal e entra no estado `Em desossa`.
4. Na saída, os produtos resultantes entram em estoque ou são associados aos pedidos correspondentes.
5. Produção de bandejas, embalagem, custos e etiquetas de varejo ficam fora do MVP.

### Fluxo recomendado

```text
Selecionar peça de entrada
→ escolher regra de transformação
→ confirmar entrada na desossa
→ registrar saída
→ gerar produtos resultantes unitários
→ enviar resultados ao estoque ou aos pedidos
```

### Recomendação

Permitir que a regra de transformação seja escolhida na entrada ou confirmada na saída, mas tornar obrigatória sua definição antes de gerar os produtos resultantes.

---

## 6.15 Etiquetas

A etiqueta operacional deve conter:

- código de barras;
- QR Code;
- informações legíveis.

### Informações legíveis recomendadas

- identificador único da peça;
- produto;
- peso;
- frigorífico/origem;
- lote ou recebimento;
- número da nota fiscal;
- Cliente / Nome Fantasia, quando associada;
- pedido;
- destino;
- data de pesagem.

### Conteúdo técnico recomendado

O código de barras e o QR Code devem carregar um identificador único e estável, não necessariamente todos os dados da peça. Ao consultar o identificador, o sistema recupera os dados atuais e o histórico.

Isso permite:

- rastreabilidade completa;
- atualização de destinação sem codificar grandes volumes de texto;
- consulta rápida por celular ou terminal;
- controle de etiquetas invalidadas.

---

## 6.16 Relatórios do SIF

1. Os relatórios mencionados são ligados ao SIF.
2. Fazem parte da entrega inicial.
3. Devem ser tratados como módulo ou conjunto de saídas formais do MVP.

### Dados ainda necessários

Para cada relatório, obter:

- nome oficial;
- modelo atual;
- campos obrigatórios;
- origem de cada informação;
- periodicidade;
- numeração;
- formato de exportação;
- necessidade de assinatura;
- usuário responsável;
- existência de transmissão eletrônica;
- regras de retificação.

### Recomendação para a agente

Não inventar layouts definitivos dos relatórios sem os modelos oficiais. Criar no protótipo uma área `Relatórios SIF` com listagem, filtros, status e espaço para pré-visualização, usando nomes provisórios claramente sinalizados.

---

## 6.17 Faturamento e nota fiscal

1. A AlphaCarnes é a emitente das notas para cada cliente.
2. A nota será emitida pelo próprio sistema por integração com outro sistema fiscal.
3. O peso registrado será relevante para cobrança.

### Fluxo recomendado

```text
Pedido atendido
→ peças e pesos conferidos
→ consolidação do faturamento
→ envio ao sistema fiscal integrado
→ retorno da autorização
→ armazenamento do número, chave, XML e DANFE, quando disponíveis
```

### Pendente

Ainda é necessário identificar:

- sistema fiscal externo;
- API disponível;
- credenciais de homologação;
- eventos suportados;
- cancelamento e correção;
- forma de associação entre pedido, peças, peso e item fiscal.

---

## 7. Modelo visual obrigatório: mapa de disponibilidade

## 7.1 Conceito

Deve ser prototipada uma tela ou dashboard semelhante a uma seleção de assentos de teatro, permitindo visualizar unidades ou grupos de unidades por item comercializável.

O objetivo não é imitar literalmente um teatro, mas aproveitar os benefícios do modelo:

- leitura espacial rápida;
- identificação visual de disponibilidade;
- percepção imediata de reservas;
- visão de físico, virtual e overbooking;
- interação com unidades ou agrupamentos;
- atualização simultânea entre vendedores.

## 7.2 Informações mínimas por produto

Cada produto deve exibir:

- quantidade física disponível;
- quantidade virtual disponível;
- quantidade reservada em pedidos em elaboração;
- quantidade comprometida em pedidos finalizados;
- quantidade em desossa;
- quantidade em overbooking;
- saldo comercial;
- operação ou data relacionada;
- alertas e pendências.

### Exemplo

```text
TZ — Operação de quarta-feira

Físico disponível:       12
Virtual disponível:      38
Reservado em elaboração:  8
Confirmado:               35
Saldo comercial:           7
Overbooking:                0
```

## 7.3 Estados visuais recomendados

Cada bloco deve representar uma unidade ou conjunto de unidades e possuir estado inequívoco:

| Estado | Significado |
|---|---|
| Físico disponível | Já recebido e disponível |
| Virtual disponível | Programado, ainda não recebido |
| Reservado | Em pedido ainda não finalizado |
| Confirmado | Comprometido em pedido finalizado |
| Em desossa | Temporariamente indisponível |
| Em ocorrência | Recebido com divergência ou bloqueio operacional |
| Overbooking | Vendido sem cobertura disponível |
| Expedido | Operação concluída |

### Recomendação de acessibilidade

Não depender apenas de cores. Usar também:

- ícones;
- letras ou siglas;
- padrões de preenchimento;
- texto auxiliar;
- contraste adequado;
- legenda fixa.

Exemplo conceitual:

```text
[F] físico
[V] virtual
[R] reservado
[C] confirmado
[D] desossa
[O] overbooking
```

## 7.4 Unidade versus agrupamento

### Recomendação

Usar dois níveis:

1. **visão agregada**, para grande volume;
2. **drill-down por unidade**, quando existirem peças físicas individualizadas.

No estoque virtual ainda não existe uma peça física real. Portanto, a visualização pode representar cotas ou unidades lógicas, sem criar falsa rastreabilidade física.

Após o recebimento, cada peça física deve possuir identificador próprio, peso e origem.

## 7.5 Interações recomendadas

- filtrar por operação/data;
- filtrar por produto;
- filtrar por origem/frigorífico;
- alternar visão física, virtual e consolidada;
- clicar em um bloco para abrir detalhes;
- visualizar pedidos que estão reservando o item;
- visualizar vendedor e Nome Fantasia;
- identificar reservas antigas;
- abrir pendências de overbooking;
- visualizar transformações possíveis do TZ;
- acessar histórico da unidade física.

## 7.6 Atualização e concorrência

A tela deve deixar claro quando outra pessoa altera o estoque.

Mensagem recomendada:

```text
A disponibilidade foi atualizada por outra operação.
Revise o saldo antes de concluir.
```

Evitar que o vendedor trabalhe com uma fotografia desatualizada por longos períodos.

---

## 8. Telas recomendadas para o protótipo

## 8.1 Painel geral da operação

### Objetivo

Oferecer visão executiva do dia ou da próxima operação.

### Componentes

- operação selecionada;
- compras programadas;
- disponibilidade física e virtual;
- reservas em elaboração;
- pedidos finalizados;
- overbookings;
- recebimentos aguardados;
- divergências abertas;
- peças em desossa;
- relatórios SIF pendentes;
- faturamentos pendentes.

---

## 8.2 Mapa de estoque e disponibilidade

### Objetivo

Permitir leitura visual semelhante à escolha de assentos.

### Componentes

- filtros por produto e operação;
- cartões resumidos;
- grade de unidades ou agrupamentos;
- legenda de estados;
- painel lateral de detalhes;
- lista de reservas;
- déficit e overbooking;
- ação para abrir pedido relacionado.

---

## 8.3 Programação de compra

### Objetivo

Criar ou alterar a compra que origina o estoque virtual.

### Componentes

- fornecedor/frigorífico;
- operação/data esperada;
- modalidade da compra;
- boi casado;
- itens complementares;
- quantidades;
- composição derivada;
- impacto previsto na disponibilidade;
- histórico de alterações.

### Comportamento obrigatório

Ao salvar uma alteração, recalcular imediatamente os produtos derivados e refletir o impacto no mapa.

---

## 8.4 Pedido de venda

### Objetivo

Montar o pedido e reservar itens em tempo real.

### Componentes

- Cliente / Nome Fantasia;
- vendedor/representante preenchido automaticamente;
- operação/data;
- itens;
- quantidade;
- saldo antes da inclusão;
- origem esperada: físico, virtual ou overbooking;
- observações do cliente;
- adendos;
- total estimado;
- status de reserva.

### Comportamentos

- reservar ao incluir quantidade;
- liberar ao remover;
- sugerir adendo quando já houver pedido aberto;
- solicitar confirmação no overbooking;
- atualizar mapa imediatamente;
- avisar sobre alteração concorrente.

---

## 8.5 Painel de overbooking do Fabrício

### Objetivo

Centralizar tudo o que precisa de decisão.

### Componentes

- produto;
- déficit;
- pedido;
- Nome Fantasia;
- vendedor;
- operação;
- data limite;
- possíveis fontes de cobertura;
- ação escolhida;
- novo pedido gerado, quando aplicável;
- histórico.

---

## 8.6 Recebimento, pesagem do lote e conclusão da conferência

### Objetivo

Conferir a chegada usando o pedido ao fornecedor como base, acumular automaticamente quantidades e pesos por produto e concluir o lote com confronto contra a nota fiscal recebida.

### Componentes da etapa de recebimento

- seleção do pedido ao fornecedor;
- fornecedor/frigorífico;
- operação e lote;
- número da nota fiscal;
- itens esperados do pedido;
- itens e totais declarados na NF;
- quantidade recebida por produto;
- peso acumulado por produto;
- diferença em tempo real;
- progresso da pesagem;
- ação `Concluir pesagem`.

### Componentes da etapa de conclusão

- quadro comparativo `Pedido × NF × Pesagem`;
- total de peças por produto;
- soma dos pesos por produto;
- diferenças de quantidade;
- diferenças de peso;
- itens sem divergência;
- itens divergentes;
- campo de observação;
- ação `Registrar ocorrência`;
- ação `Concluir sem divergência`;
- ação `Concluir com divergência e encaminhar ao administrativo`.

### Recomendação de protótipo

A tela deve apresentar duas fases claras:

1. **Pesagem em andamento** — feedback em tempo real por produto;
2. **Revisão final** — conferência consolidada antes do fechamento do lote.

Usar barras de progresso e indicadores numéricos, mas não depender apenas de cor. A revisão final deve destacar somente as diferenças e permitir abrir o detalhamento das pesagens que formaram cada total.

### Tratativa administrativa

Após a conclusão com divergência, exibir o responsável administrativo, o status e o histórico da ocorrência. O protótipo não deve simular negociação automática com o fornecedor.

Recomenda-se que o protótipo inclua uma fila administrativa simples com:

- fornecedor e NF;
- pedido/lote;
- produtos divergentes;
- diferença total de quantidade e peso;
- responsável;
- status;
- data de abertura;
- ação `Registrar andamento`;
- ação `Concluir tratativa`.

A conclusão administrativa não deve alterar os totais históricos da pesagem. Deve apenas registrar o resultado da tratativa.

---

## 8.7 Pesagem e destinação

### Objetivo

Registrar rapidamente cada peça.

### Componentes

- produto;
- leitura de peso;
- indicação automática/manual;
- origem/lote;
- busca de Nome Fantasia;
- pedidos compatíveis;
- ações:
  - associar ao pedido;
  - enviar ao estoque;
  - enviar à desossa;
- impressão de etiqueta.

### Recomendação

Projetar para uso por teclado, leitor e balança, com poucos cliques e botões grandes.

---

## 8.8 Troca de peça

### Objetivo

Trocar uma peça associada sem quebrar rastreabilidade.

### Etapas em uma única experiência

1. selecionar pedido;
2. selecionar peça atual;
3. selecionar nova peça;
4. definir destino da peça retirada;
5. informar motivo;
6. revisar impactos;
7. confirmar;
8. invalidar e reimprimir etiquetas.

---

## 8.9 Entrada e saída da desossa

### Objetivo

Controlar o mínimo necessário no MVP.

### Entrada

- peça;
- peso existente;
- origem;
- regra de transformação pretendida;
- data/hora;
- responsável.

### Saída

- transformação confirmada;
- produtos gerados;
- destino de cada produto;
- data/hora;
- responsável.

---

## 8.10 Relatórios SIF

### Objetivo

Acessar e gerar os relatórios obrigatórios.

### Componentes provisórios

- lista de relatórios;
- operação/período;
- status;
- responsável;
- pendências de dados;
- gerar;
- pré-visualizar;
- exportar;
- histórico de versões.

---

## 8.11 Faturamento e emissão fiscal

### Objetivo

Consolidar itens entregues e pesos para integração fiscal.

### Componentes

- pedido;
- cliente fiscal;
- Nome Fantasia;
- peças;
- pesos;
- valores;
- status da integração;
- número da nota;
- chave;
- XML/DANFE;
- erros e reprocessamento.

---

## 9. Fluxos detalhados

## 9.1 Fluxo de compra até disponibilidade

```text
Fabrício programa uma compra
→ sistema aplica composição parametrizada
→ estoque virtual é criado
→ mapa de disponibilidade é atualizado
→ vendedores passam a reservar os itens
→ alteração na compra recalcula o saldo
→ reservas e pedidos existentes são reavaliados
→ eventual déficit aparece como overbooking ou risco
```

## 9.2 Fluxo do pedido em elaboração

```text
Vendedor seleciona Cliente / Nome Fantasia
→ sistema identifica o vendedor associado
→ vendedor adiciona produto e quantidade
→ sistema prioriza estoque físico
→ completa com estoque virtual
→ se necessário, calcula overbooking
→ quantidade é reservada imediatamente
→ demais vendedores veem o saldo atualizado
→ pedido é finalizado
→ reserva muda para compromisso confirmado
```

## 9.3 Fluxo de recebimento e conclusão da conferência

```text
Operador seleciona o pedido ao fornecedor
→ informa o número da NF
→ sistema carrega os itens esperados do pedido
→ itens da NF são carregados ou informados
→ peças são conferidas e pesadas individualmente
→ sistema soma quantidade e peso por produto
→ comparativo Pedido × NF × Pesagem é atualizado
→ cada peça recebe identificador físico
→ operador aciona “Concluir pesagem”
→ sistema abre a revisão final do lote
→ divergências de quantidade e peso são calculadas
→ resultado é classificado como conferido ou divergente
→ ocorrência sistêmica é criada quando necessário
→ ocorrência é encaminhada à equipe administrativa
→ recebimento é concluído
→ estoque virtual correspondente é materializado
```

A tratativa com o fornecedor ocorre manualmente fora do fluxo operacional da balança, mas seu andamento deve permanecer registrado no sistema.

## 9.4 Fluxo de associação

```text
Peça é pesada
→ operador busco Nome Fantasia
→ sistema mostra pedidos compatíveis e pendentes
→ operador associa a peça
→ etiqueta é impressa
→ pedido e mapa são atualizados
```

## 9.5 Fluxo de troca

```text
Operador abre função Trocar peça
→ informa pedido
→ seleciona peça antiga
→ seleciona peça nova
→ define destino da antiga
→ confirma motivo
→ sistema executa troca atomicamente
→ peso é preservado
→ etiqueta antiga é invalidada
→ nova etiqueta é emitida
→ histórico fica disponível
```

## 9.6 Fluxo de desossa

```text
Peça é enviada à desossa
→ fica indisponível comercialmente como peça inteira
→ regra de transformação é escolhida
→ entrada é registrada
→ saída é registrada
→ produtos resultantes são criados
→ resultados vão ao estoque ou aos pedidos
```

---

## 10. Estados recomendados

## 10.1 Estado do pedido

- rascunho;
- em elaboração com reserva ativa;
- aguardando confirmação de overbooking;
- finalizado;
- parcialmente atendido;
- atendido;
- faturado;
- cancelado.

## 10.2 Estado da peça física

- recebida;
- pesada;
- em estoque;
- associada a pedido;
- em desossa;
- transformada;
- em troca;
- expedida;
- bloqueada por ocorrência;
- cancelada/inativada.

## 10.3 Estado da unidade virtual

- programada;
- disponível;
- reservada;
- comprometida;
- materializada no recebimento;
- cancelada por alteração da compra.

## 10.4 Estado da etiqueta

- emitida;
- ativa;
- invalidada por troca;
- reimpressa;
- cancelada.

---

## 11. Modelo de dados conceitual recomendado

A modelagem final pode variar, mas a agente deve preservar as seguintes entidades e relações.

### Entidades principais

- `OperacaoEntrega`
- `ProgramacaoCompra`
- `PedidoFornecedor`
- `Fornecedor`
- `Frigorifico`
- `ProdutoComercial`
- `RegraTransformacao`
- `ComponenteTransformacao`
- `SaldoEstoque`
- `ReservaEstoque`
- `Cliente` — incluindo o atributo único `nomeFantasia`
- `VendedorRepresentante`
- `PedidoVenda`
- `ItemPedidoVenda`
- `AdendoPedido`
- `Recebimento`
- `ConclusaoConferenciaRecebimento`
- `NotaFiscalFornecedor`
- `PecaFisica`
- `Pesagem`
- `DestinacaoPeca`
- `TrocaPeca`
- `MovimentoDesossa`
- `Etiqueta`
- `OcorrenciaDivergencia`
- `PendenciaOverbooking`
- `NotaFiscalSaida`
- `RelatorioSIF`
- `EventoAuditoria`

### Relações essenciais

```text
Programação de compra
→ gera estoque virtual por produto e operação

Pedido de venda
→ possui itens
→ itens geram reservas
→ reservas consomem físico, virtual ou overbooking

Recebimento
→ referencia pedido ao fornecedor
→ recebe a NF como referência documental
→ acumula quantidade e peso por produto a partir das pesagens
→ gera conclusão de conferência Pedido × NF × Pesagem
→ cria ocorrência quando houver divergência
→ gera peças físicas
→ materializa parte do estoque virtual

Peça física
→ possui peso e origem
→ pode estar em estoque, pedido ou desossa
→ possui etiqueta e histórico

TZ
→ pode permanecer inteiro
→ ou gerar uma das alternativas de transformação
```

---

## 12. Requisitos de auditoria e rastreabilidade

Toda operação relevante deve registrar:

- usuário;
- data e hora;
- valor anterior;
- valor posterior;
- origem da ação;
- justificativa, quando aplicável;
- entidade afetada;
- pedido, peça, compra ou operação relacionada.

Eventos obrigatórios:

- criação e alteração da programação de compra;
- recálculo do estoque virtual;
- inclusão e remoção de reserva;
- confirmação de overbooking;
- adendo;
- pesagem manual ou automática;
- alteração de peso;
- associação e desassociação;
- troca;
- entrada e saída da desossa;
- emissão, invalidação e reimpressão de etiqueta;
- ocorrência de divergência;
- emissão fiscal;
- geração ou retificação de relatório SIF.

---

## 13. Requisitos não funcionais recomendados

### 13.1 Concorrência

O sistema deve tratar múltiplos vendedores editando pedidos simultaneamente.

### 13.2 Atualização rápida

Mudanças em compra, reserva, pedido e recebimento devem aparecer rapidamente no mapa de disponibilidade.

### 13.3 Operação resiliente

A tela de pesagem deve reduzir o risco de perda de dados em falhas de conexão ou integração com balança.

### 13.4 Usabilidade operacional

- poucos cliques;
- foco em teclado e leitura automática;
- botões grandes;
- textos objetivos;
- confirmação apenas em ações críticas;
- prevenção de duplicidade;
- feedback imediato.

### 13.5 Segurança e perfis

Recomendação de perfis iniciais:

- vendedor;
- Fabrício/gestor comercial;
- recebimento/pesagem;
- estoque/expedição;
- desossa;
- fiscal;
- SIF/qualidade;
- administrador.

### 13.6 Parametrização

Regras de transformação, produtos, estados e relatórios não devem ficar excessivamente hardcoded.

---

## 14. Cenários obrigatórios para o protótipo

A agente deve prototipar, demonstrar ou prever pelo menos os seguintes cenários.

### Cenário 1 — compra cria estoque virtual

- Fabrício programa boi casado;
- sistema apresenta produtos derivados provisórios;
- mapa é atualizado.

### Cenário 2 — pedido reserva antes de finalizar

- vendedor adiciona TZ;
- quantidade passa a `Reservado`;
- outro vendedor enxerga saldo menor.

### Cenário 3 — remoção do carrinho

- vendedor remove uma quantidade;
- reserva é liberada imediatamente.

### Cenário 4 — disputa pela última unidade

- dois vendedores tentam usar o último item;
- um consome o saldo;
- o outro recebe atualização e confirmação de overbooking.

### Cenário 5 — overbooking sem limite

- vendedor ultrapassa o saldo;
- confirma explicitamente;
- pedido continua;
- pendência aparece para Fabrício.

### Cenário 6 — alteração da compra

- Fabrício reduz a compra programada;
- disponibilidade é recalculada;
- reservas existentes permanecem visíveis;
- déficit resultante é destacado.

### Cenário 7 — conclusão da pesagem contra a NF

- operador seleciona o pedido ao fornecedor;
- informa a NF recebida;
- sistema carrega os itens esperados;
- operador pesa individualmente as peças;
- sistema acumula quantidade e peso por produto;
- operador aciona `Concluir pesagem`;
- sistema exibe o quadro `Pedido × NF × Pesagem`;
- a conclusão identifica diferenças de quantidade e peso.

### Cenário 8 — divergência e tratativa administrativa

- a NF declara 100 TZ e determinado peso total;
- a pesagem apura 98 TZ e peso total inferior;
- recebimento é concluído como `Conferido com divergência`;
- ocorrência sistêmica preserva pedido, NF e pesagens originais;
- a equipe administrativa assume a tratativa manual com o fornecedor;
- o andamento e a solução são registrados na ocorrência.

### Cenário 9 — associação por Nome Fantasia

- operador digita `D1`;
- sistema mostra o pedido pendente correto;
- peça é associada e etiquetada.

### Cenário 10 — adendo

- vendedor tenta criar novo pedido para o mesmo Nome Fantasia e produto;
- sistema encontra o pedido aberto;
- quantidade é adicionada como adendo.

### Cenário 11 — troca de peça

- peça menor é retirada do pedido;
- peça maior é associada;
- pesos permanecem;
- etiqueta antiga é invalidada;
- nova etiqueta é emitida.

### Cenário 12 — transformação do TZ

- TZ entra na desossa;
- usuário escolhe uma das duas regras;
- produtos incompatíveis não são gerados;
- resultados entram no estoque.

### Cenário 13 — faturamento

- pedido atendido possui pesos finais;
- sistema prepara dados;
- integração fiscal retorna nota autorizada.

### Cenário 14 — relatório SIF

- usuário seleciona operação/período;
- sistema aponta dados faltantes;
- relatório é gerado e versionado.

---

## 15. Critérios de aceite recomendados

## 15.1 Estoque e reserva

- [ ] Programação da compra gera saldo virtual.
- [ ] Alteração da compra recalcula imediatamente o saldo.
- [ ] Item adicionado a pedido em elaboração reduz a disponibilidade.
- [ ] Remoção do item libera a reserva.
- [ ] Finalização não reduz o estoque duas vezes.
- [ ] Estoque físico é consumido antes do virtual.
- [ ] Saldo negativo exige confirmação explícita.
- [ ] Overbooking confirmado gera pendência para Fabrício.

## 15.2 Mapa visual

- [ ] Exibe físico, virtual, reservado, confirmado e overbooking.
- [ ] Permite filtro por produto e operação.
- [ ] Atualiza após compra, reserva, finalização e recebimento.
- [ ] Não depende apenas de cor.
- [ ] Permite abrir detalhes e pedidos relacionados.

## 15.3 Pedidos

- [ ] Nome Fantasia é único.
- [ ] Vendedor é preenchido pelo cadastro do Nome Fantasia.
- [ ] Pedido existente é localizado antes de criar duplicidade.
- [ ] Acréscimo é registrado como adendo.
- [ ] Preferências aparecem como observações.

## 15.4 Recebimento e conferência da NF

- [ ] Pedido ao fornecedor é carregado como base.
- [ ] Número da NF é informado sem redigitação da carga esperada.
- [ ] Os itens e totais relevantes da NF ficam disponíveis para comparação.
- [ ] Cada pesagem individual atualiza a quantidade e o peso acumulado do produto.
- [ ] O sistema consolida quantidade e soma dos pesos por produto do pedido.
- [ ] A ação `Concluir pesagem` abre uma revisão final obrigatória.
- [ ] A revisão apresenta `Pedido × NF × Pesagem`.
- [ ] Quantidades recebidas são comparadas às quantidades do pedido e da NF.
- [ ] Pesos acumulados são comparados aos pesos informados na NF, quando disponíveis.
- [ ] Divergência gera ocorrência separada e auditável.
- [ ] A ocorrência pode ser atribuída à equipe administrativa.
- [ ] A tratativa com o fornecedor é registrada manualmente.
- [ ] Pedido, NF e pesagens originais permanecem preservados.
- [ ] Peças recebem origem e identificador físico.

## 15.5 Pesagem e troca

- [ ] Peso registra origem automática ou manual.
- [ ] Associação permite pedido, estoque ou desossa.
- [ ] Troca ocorre em operação única.
- [ ] Peso original permanece.
- [ ] Histórico e motivo são registrados.
- [ ] Etiqueta antiga é invalidada.

## 15.6 Desossa

- [ ] Registra entrada e saída.
- [ ] Suporta as duas regras provisórias do TZ.
- [ ] Não calcula rendimento por peso.
- [ ] Gera quantidades unitárias.
- [ ] Não inclui bandejas ou custo de embalagem.

## 15.7 Fiscal e SIF

- [ ] Existe ponto de integração fiscal.
- [ ] Nota emitida fica vinculada ao pedido.
- [ ] Área de relatórios SIF está prevista.
- [ ] Modelos oficiais podem ser configurados sem redesenho completo.

---

## 16. Pontos ainda pendentes

A agente não deve assumir resposta definitiva para os itens abaixo.

1. composição exata do boi casado;
2. separação obrigatória do estoque por operação de segunda, quarta e sexta;
3. prazo ou regra de expiração de reservas em pedidos abandonados;
4. ordem detalhada de consumo entre peças físicas, como FIFO;
5. participação da operação/data na regra de unicidade do pedido aberto;
6. política de preço em adendos;
7. momento exato de escolha da transformação na desossa;
8. possibilidade de recebimento de um pedido em vários caminhões ou NFs;
9. possibilidade de um caminhão reunir vários pedidos ao fornecedor;
10. lista e modelos oficiais dos relatórios SIF;
11. sistema fiscal externo e sua API;
12. campos finais da etiqueta;
13. procedimento físico de localização e substituição de etiqueta quando a peça já estiver no caminhão;
14. catálogo oficial completo e saneado;
15. outras transformações além do TZ.

---

## 17. Recomendações de decisão para reduzir riscos

### 17.1 Não criar peças físicas fictícias no estoque virtual

Representar o virtual como quantidade ou unidade lógica. A peça física só nasce no recebimento e recebe peso, origem e etiqueta.

### 17.2 Preservar reservas separadas de vendas

Não tratar pedido em elaboração como pedido finalizado. A disponibilidade pode ser reduzida, mas o estado deve continuar diferente para auditoria e liberação.

### 17.3 Tornar a transformação parametrizável

Modelar produto de origem, alternativas e produtos resultantes. Não criar condicionais rígidas espalhadas pela aplicação.

### 17.4 Recalcular sem apagar histórico

Ao alterar compra ou pedido, recalcular saldos, mas preservar eventos anteriores e indicar qual alteração criou o déficit.

### 17.5 Exibir o motivo do saldo

O mapa não deve mostrar somente um número. O usuário deve conseguir entender:

- quanto é físico;
- quanto é virtual;
- quem reservou;
- quanto já está confirmado;
- por que existe overbooking.

### 17.6 Prototipar desktop primeiro

As telas operacionais de mapa, recebimento e pesagem têm alta densidade de dados. Recomenda-se protótipo desktop como referência principal, com responsividade posterior para consulta.

### 17.7 Separar ação comercial de decisão gerencial

Vendedores podem gerar overbooking. Fabrício gerencia a resolução em painel próprio. Não misturar a solução do déficit com a criação do pedido.

---

## 18. Instruções diretas para uma agente de prototipação

Ao gerar telas, fluxos ou especificações para AlphaCarnes:

1. use este documento como fonte principal de contexto;
2. não bloqueie overbooking;
3. sempre mostre confirmação explícita quando o saldo ficar negativo;
4. trate reservas de pedidos em elaboração como impacto real na disponibilidade;
5. priorize estoque físico antes do virtual;
6. não crie a AlphaCarnes como cliente interno;
7. use `Estoque` como destino interno;
8. não calcule rendimento por peso;
9. preserve origem do frigorífico como rastreabilidade, não como SKU separado;
10. trate preferências do cliente como observações;
11. evite segundo pedido aberto para o mesmo Nome Fantasia e produto; ofereça adendo;
12. carregue o pedido ao fornecedor no recebimento e complemente com a NF;
13. acumule automaticamente quantidade e peso por produto durante a pesagem;
14. ao concluir a pesagem, abra uma revisão obrigatória `Pedido × NF × Pesagem`;
15. gere ocorrência separada para divergências e encaminhe-a à equipe administrativa;
16. mantenha a troca como ação única e auditável;
17. preserve os pesos na troca;
18. preveja código de barras, QR Code e texto na etiqueta;
19. mantenha relatórios SIF no escopo inicial;
20. mantenha produção de bandejas e custos de embalagem fora do MVP;
21. sinalize visualmente toda regra ainda provisória;
22. nunca invente a composição do boi casado ou os campos oficiais do SIF sem validação.

---

## 19. Prompt-base sugerido para outra agente

```text
Você está trabalhando no projeto AlphaCarnes, um sistema para programação de compras, estoque físico e virtual, reservas em pedidos, recebimento, pesagem, destinação de peças, desossa simplificada, expedição, faturamento integrado e relatórios do SIF.

Leia integralmente o documento “AlphaCarnes — Contexto funcional consolidado e recomendações para prototipação” antes de propor qualquer tela ou regra.

Princípios obrigatórios:
- o estoque virtual nasce na programação da compra;
- pedidos em elaboração já reservam quantidades;
- estoque físico tem prioridade sobre o virtual;
- overbooking é permitido para qualquer vendedor e não possui limite;
- saldo negativo exige confirmação explícita;
- Fabrício resolve as pendências de overbooking;
- nova quantidade para o mesmo Nome Fantasia e produto deve virar adendo ao pedido aberto;
- recebimento começa pela seleção do pedido ao fornecedor e inclusão da NF;
- a pesagem acumula quantidade e peso por produto;
- concluir a pesagem abre uma revisão obrigatória Pedido × NF × Pesagem;
- divergências geram ocorrências separadas e são tratadas manualmente pela equipe administrativa;
- o controle comercial inicial é por quantidade de peças;
- peso é registrado depois e usado para cobrança;
- a desossa do MVP registra apenas entrada e saída;
- as regras do TZ são provisoriamente: Coxão-bola + Jacaré OU Coxão-bola com alcatra + Filé curto;
- não há cálculo de rendimento por peso;
- produtos iguais de frigoríficos diferentes são o mesmo produto comercial, mantendo a origem para rastreabilidade;
- etiquetas possuem código de barras, QR Code e informações legíveis;
- relatórios SIF estão no escopo inicial;
- bandejas, custos de embalagem e etiquetas de varejo estão fora do MVP.

Ao prototipar, crie obrigatoriamente um mapa visual de estoque semelhante à seleção de assentos de um teatro, com estados para físico, virtual, reservado, confirmado, desossa e overbooking. Não dependa apenas de cores. Inclua filtros por produto e operação, visão agregada e detalhamento.

Não invente respostas para os pontos marcados como pendentes. Use dados fictícios claramente sinalizados quando precisar demonstrar um fluxo.
```

---

## 20. Resultado esperado do primeiro ciclo de prototipação

O primeiro ciclo deve produzir, no mínimo:

1. mapa visual de disponibilidade;
2. programação de compra com impacto no estoque virtual;
3. pedido em elaboração com reserva imediata;
4. confirmação de overbooking;
5. painel de pendências do Fabrício;
6. adendo a pedido existente;
7. recebimento baseado no pedido ao fornecedor;
8. pesagem com acumuladores de quantidade e peso por produto;
9. conclusão da conferência Pedido × NF × Pesagem;
10. ocorrência de divergência e fila administrativa;
11. pesagem e destinação;
12. troca de peça;
13. entrada e saída da desossa;
14. etiqueta operacional;
15. área de relatórios SIF;
16. estado de integração fiscal.

O protótipo deve demonstrar o encadeamento entre as telas, e não apenas telas isoladas.

---

## 21. Resumo executivo para orientação rápida

- A compra programada cria estoque virtual.
- A AlphaCarnes normalmente compra boi casado.
- A compra ocorre um dia antes ou ao fim dos pedidos.
- Alterações de compra recalculam tudo imediatamente.
- O carrinho do vendedor já reserva estoque.
- O estoque físico é consumido primeiro.
- Qualquer vendedor pode fazer overbooking, sem limite.
- O sistema confirma explicitamente o déficit.
- Fabrício decide como resolver.
- Quantidade postergada gera novo pedido.
- O MVP controla peças por quantidade; peso serve para cobrança.
- Produtos do MVP incluem caixarias, banda de porco e partes definidas do boi.
- TZ pode ser inteiro ou transformado em uma das duas combinações provisórias.
- O Nome Fantasia é único e possui vendedor associado.
- Preferências são observações.
- Produtos iguais de frigoríficos diferentes são unificados, preservando origem.
- Recebimento parte do pedido ao fornecedor e é complementado pela NF.
- A pesagem soma quantidade e peso por produto.
- A conclusão do lote confronta Pedido × NF × Pesagem.
- Divergência gera ocorrência sistêmica e tratativa administrativa manual.
- Troca é uma operação única; pesos são preservados.
- Desossa registra apenas entrada e saída.
- Etiquetas têm código de barras, QR Code e texto.
- SIF está no escopo inicial.
- Nota fiscal é emitida pela AlphaCarnes por integração externa.
- O mapa de disponibilidade semelhante a assentos de teatro é obrigatório no protótipo.
