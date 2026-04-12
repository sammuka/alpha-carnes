# 004-campos-e-acoes-detalhados-tela-compra-programada-e-pedido-venda

## Objetivo do documento
Detalhar campos, ações, validações e comportamentos esperados para:
1. Tela de Compra Programada do Dia
2. Tela de Pedido de Venda

Este documento complementa as regras funcionais já aprovadas e avança para um nível mais próximo de especificação funcional.

---

# 1. Tela de Compra Programada do Dia

## 1.1 Objetivo da tela
Registrar o lote principal do dia, que será a base única para a geração da disponibilidade virtual e para a operação comercial.

## 1.2 Perfis de acesso
- Operador de compras
- Gestor
- Administrativo com consulta
- Comercial apenas para consulta, se permitido

## 1.3 Estrutura da tela
A tela pode ser organizada em 4 blocos:

1. Cabeçalho da compra
2. Itens da compra
3. Resumo e consistência
4. Ações da compra

---

## 1.4 Campos do cabeçalho

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| ID da compra programada | Automático | Sim | Gerado pelo sistema |
| Data da operação | Data | Sim | Define o lote do dia |
| Fornecedor / frigorífico | Seleção | Sim | Deve existir no cadastro |
| Número interno da compra | Texto | Não | Identificador operacional |
| Referência externa | Texto | Não | Pedido/negociação externa |
| Previsão de entrega | Data/hora | Não | Apoio ao planejamento |
| Status da compra | Lista | Sim | Rascunho, em negociação, confirmada, operacionalizada, recebida, encerrada, cancelada |
| Observações gerais | Texto longo | Não | Campo livre |

---

## 1.5 Grid de itens da compra

Cada linha representa um item comprado dentro do lote do dia.

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Sequência | Automático | Sim | Ordenação da linha |
| Tipo de origem | Lista | Sim | Bovino, suíno, frango, outros |
| Item de compra | Seleção | Sim | Deve existir no cadastro |
| Descrição do item | Automático / texto | Sim | Pode vir do cadastro |
| Quantidade comprada | Número inteiro/decimal conforme regra | Sim | Deve ser > 0 |
| Unidade | Lista | Sim | Ex.: cabeça, caixa, peça, lote |
| Regra de desdobramento | Seleção | Sim | Obrigatória para gerar disponibilidade virtual |
| Previsão de chegada específica | Data/hora | Não | Opcional por item |
| Observações do item | Texto | Não | Detalhes operacionais |
| Status do item | Automático | Sim | Pendente, válido, com inconsistência |

---

## 1.6 Bloco de resumo e consistência

A tela deve exibir um resumo lateral ou no rodapé contendo:
- total de itens da compra
- total por categoria
- regras de desdobramento pendentes
- inconsistências encontradas
- indicação se a compra está apta para confirmação

---

## 1.7 Ações da tela

### Ações principais
- Criar nova compra programada
- Salvar como rascunho
- Editar compra
- Adicionar item
- Remover item
- Duplicar item
- Confirmar compra
- Cancelar compra
- Encerrar compra
- Consultar disponibilidade virtual gerada
- Exportar resumo
- Imprimir espelho operacional

### Ações por item
- Editar linha
- Remover linha
- Duplicar linha
- Trocar regra de desdobramento
- Validar consistência

---

## 1.8 Regras de comportamento

### Comportamento geral
- Enquanto a compra estiver em rascunho ou negociação, todos os campos editáveis devem permanecer habilitados conforme perfil.
- Após confirmação, a compra deixa de ser livremente editável.
- Se já existirem pedidos vinculados ao lote do dia, alterações estruturais devem ser restritas.

### Comportamento de confirmação
Ao confirmar a compra, o sistema deve:
1. Validar obrigatoriedades do cabeçalho.
2. Validar se existe ao menos um item.
3. Validar se todos os itens possuem regra de desdobramento ativa.
4. Verificar se já existe outra compra principal para o mesmo dia.
5. Se tudo estiver correto, alterar o status para **confirmada**.
6. Disponibilizar a geração da disponibilidade virtual.

### Comportamento de cancelamento
- O cancelamento deve ser bloqueado se já existirem pedidos de venda vinculados, salvo perfil de gestor e regra específica.
- Caso permitido, o sistema deve alertar todos os impactos da ação.

---

## 1.9 Validações detalhadas

- A data da operação é obrigatória.
- Só pode existir um lote principal por dia.
- O fornecedor é obrigatório.
- Deve haver ao menos um item.
- A quantidade comprada deve ser maior que zero.
- Cada item deve possuir regra de desdobramento comercial válida.
- Não pode haver confirmação com inconsistência pendente.
- Não deve ser possível confirmar sem status compatível.

---

## 1.10 Mensagens e alertas esperados

### Exemplos
- “Já existe uma compra principal confirmada para esta data.”
- “O item ‘Boi’ não possui regra de desdobramento válida.”
- “A compra foi confirmada com sucesso.”
- “Não é possível cancelar a compra pois já existem pedidos de venda vinculados.”

---

## 1.11 Dados derivados desta tela
A partir desta tela, o sistema deverá ser capaz de gerar:
- disponibilidade virtual do dia
- base do monitoramento comercial
- referência para recebimento físico
- referência para comparação com NF e divergências

---

# 2. Tela de Pedido de Venda

## 2.1 Objetivo da tela
Permitir o registro do pedido comercial do cliente com reserva imediata da disponibilidade virtual do lote principal do dia.

## 2.2 Perfis de acesso
- Comercial
- Sabrina / operador comercial
- Gestor comercial
- Consulta para planejamento, se necessário

## 2.3 Estrutura da tela
A tela pode ser organizada em 5 blocos:

1. Cabeçalho do pedido
2. Informações do cliente
3. Itens do pedido
4. Resumo de saldos
5. Ações do pedido

---

## 2.4 Campos do cabeçalho

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| ID do pedido | Automático | Sim | Gerado pelo sistema |
| Data da operação | Data | Sim | Deve apontar para o lote do dia |
| Lote do dia vinculado | Automático / seleção controlada | Sim | Não pode haver múltiplas origens |
| Cliente | Seleção | Sim | Deve existir no cadastro |
| Rota prevista | Seleção | Não | Apoio ao planejamento |
| Prioridade | Lista | Não | Normal, alta, urgente |
| Observações gerais | Texto longo | Não | Observações do pedido |
| Status do pedido | Lista | Sim | Rascunho, reservado, confirmado, em operação, em expedição, faturado, concluído, cancelado |

---

## 2.5 Bloco de informações do cliente

Ao selecionar o cliente, a tela deve exibir:
- nome / razão social
- rota padrão
- observações críticas
- preferências padrão
- histórico resumido, se desejado futuramente

### Preferências do cliente exibidas
| Campo | Tipo |
|---|---|
| Faixa de peso preferida | Texto / faixa |
| Perfil de gordura | Lista / texto |
| Necessidade frequente de corte | Sim/Não / observação |
| Observações operacionais | Texto |
| Restrições comerciais | Texto |
| Prioridade do cliente | Lista / indicador |

---

## 2.6 Grid de itens do pedido

Cada linha representa um item comercial pedido pelo cliente.

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Sequência | Automático | Sim | Ordenação da linha |
| Item comercial | Seleção | Sim | Ex.: dianteiro, central, traseiro |
| Quantidade solicitada | Número inteiro | Sim | Pedido por parte/unidade |
| Quantidade reservada | Automático | Sim | Calculada pelo sistema |
| Saldo disponível atual | Automático | Sim | Exibido em tempo real |
| Preferência específica de peso | Texto / faixa | Não | Pode sobrescrever padrão do cliente |
| Preferência específica de gordura | Texto / lista | Não | Pode sobrescrever padrão |
| Corte requerido | Sim/Não / observação | Não | Informação operacional |
| Observações do item | Texto | Não | Campo livre |
| Status do item | Automático | Sim | Válido, sem saldo, bloqueado, alterado |

---

## 2.7 Bloco de resumo de saldos

A tela deve exibir, preferencialmente em painel lateral:
- total reservado por item
- saldo remanescente por item
- itens esgotados
- alertas de ruptura
- impacto da edição atual antes da gravação

---

## 2.8 Ações da tela

### Ações principais
- Criar novo pedido
- Salvar rascunho
- Reservar saldo
- Confirmar pedido
- Editar pedido
- Cancelar item
- Cancelar pedido
- Duplicar pedido
- Consultar saldo do dia
- Exportar espelho do pedido

### Ações por item
- Adicionar item
- Editar item
- Remover item
- Duplicar item
- Revalidar saldo

---

## 2.9 Regras de comportamento

### Comportamento ao selecionar o cliente
Ao selecionar um cliente, o sistema deve:
1. Carregar automaticamente as preferências padrão.
2. Exibir observações críticas de forma destacada.
3. Permitir sobrescrever preferências no nível do pedido/item.

### Comportamento ao selecionar o item
Ao selecionar um item comercial, o sistema deve:
1. Exibir o saldo disponível do dia em tempo real.
2. Bloquear quantidade acima do saldo.
3. Indicar visualmente se o item está esgotado ou em saldo crítico.

### Comportamento ao salvar o pedido
Ao salvar ou confirmar o pedido, o sistema deve:
1. Verificar a existência do lote do dia.
2. Verificar se o item possui saldo suficiente.
3. Reservar a quantidade correspondente.
4. Atualizar o saldo disponível em tempo real.
5. Alterar o status do pedido conforme a ação executada.

### Comportamento ao editar o pedido
- O sistema deve recalcular as reservas.
- A edição não pode gerar saldo negativo.
- Se um item ficar sem saldo durante a edição, o sistema deve bloquear a confirmação da alteração.
- A devolução da reserva anterior deve ocorrer de forma transacional e consistente.

### Comportamento ao cancelar o pedido
- A reserva deve ser devolvida integralmente ao saldo disponível.
- O sistema deve registrar o histórico da ação e do responsável.

---

## 2.10 Validações detalhadas

- Deve existir lote principal do dia para a data escolhida.
- O pedido só pode consumir disponibilidade de uma única compra programada.
- Cada item deve validar saldo em tempo real.
- Não pode haver overbooking.
- O pedido deve ser registrado por parte/unidade, não por peso.
- O cliente é obrigatório.
- Deve haver ao menos um item válido.
- Quantidades devem ser maiores que zero.

---

## 2.11 Mensagens e alertas esperados

### Exemplos
- “Não há lote principal confirmado para esta data.”
- “O item ‘Traseiro’ não possui saldo suficiente. Disponível: 8.”
- “O pedido foi reservado com sucesso.”
- “A alteração não pode ser confirmada porque o saldo do item ficou insuficiente.”
- “O pedido foi cancelado e a reserva foi devolvida ao saldo do dia.”

---

## 2.12 Dados derivados desta tela
A partir desta tela, o sistema deverá alimentar:
- reserva da disponibilidade virtual
- monitoramento comercial do dia
- planejamento logístico
- expedição
- sugestão de associação na balança

---

## 2.13 Observação funcional importante
As preferências do cliente e do pedido não alteram o saldo virtual, mas devem impactar a futura sugestão de associação da peça ao pedido durante a operação na balança.
