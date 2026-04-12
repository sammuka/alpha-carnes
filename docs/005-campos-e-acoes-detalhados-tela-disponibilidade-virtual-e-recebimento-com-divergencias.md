# 005-campos-e-acoes-detalhados-tela-disponibilidade-virtual-e-recebimento-com-divergencias

## Objetivo do documento
Detalhar campos, ações, validações e comportamentos esperados para:
1. Tela de Disponibilidade Virtual do Dia
2. Tela de Recebimento com Correção de Divergências

Este documento amplia o núcleo estrutural da operação e cobre o ponto crítico de controle entre o planejado, o vendido e o efetivamente recebido.

---

# 1. Tela de Disponibilidade Virtual do Dia

## 1.1 Objetivo da tela
Exibir e controlar, em tempo real, o saldo comercial virtual do dia, consolidando o que foi gerado pela compra programada e o que já foi consumido pelos pedidos comerciais.

## 1.2 Perfis de acesso
- Comercial
- Gestor
- Operação
- Planejamento
- Faturamento em consulta
- Compras em consulta

## 1.3 Estrutura da tela
A tela pode ser organizada em 4 blocos:

1. Filtros e contexto do lote do dia
2. Grid principal de disponibilidade por item
3. Painel de impacto operacional
4. Ações e navegação para telas correlatas

---

## 1.4 Filtros e contexto

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Data da operação | Data | Sim | Define a disponibilidade do dia |
| Lote do dia | Automático / seleção controlada | Sim | Deve refletir a compra principal |
| Fornecedor | Automático / filtro | Não | Informativo e filtrável |
| Status do lote | Automático | Sim | Ex.: confirmada, operacionalizada |
| Situação comercial | Filtro | Não | Todos, disponíveis, críticos, esgotados, com divergência |

---

## 1.5 Grid principal de disponibilidade

Cada linha representa um item comercial do dia.

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Item comercial | Texto | Sim | Ex.: dianteiro, central, traseiro |
| Quantidade total gerada | Número | Sim | Vem do desdobramento da compra |
| Quantidade reservada | Número | Sim | Soma dos pedidos de venda |
| Quantidade disponível | Número | Sim | Total gerada - reservada |
| Quantidade recebida | Número | Sim | Quantidade física apurada |
| Quantidade expedida | Número | Sim | Quantidade já vinculada à expedição |
| Quantidade divergente | Número | Sim | Quantidade afetada por ocorrência |
| Quantidade remanescente / sobra | Número | Sim | Resultado do fechamento físico |
| Situação do item | Indicador | Sim | Disponível, crítico, esgotado, divergente |
| Pedidos vinculados | Link / contador | Não | Acesso ao detalhamento |
| Observações | Texto curto | Não | Apoio operacional |

---

## 1.6 Bloco de impacto operacional

A tela deve exibir painéis com:
- itens esgotados
- itens com divergência de recebimento
- itens com risco de ruptura operacional
- pedidos potencialmente afetados
- itens com sobra prevista ou confirmada

---

## 1.7 Ações da tela

### Ações principais
- Consultar saldo do dia
- Filtrar por item
- Abrir pedidos vinculados
- Abrir compra programada
- Abrir recebimento do dia
- Abrir divergências do item
- Exportar visão resumida
- Atualizar visão em tempo real

### Ações por linha
- Ver pedidos vinculados
- Ver histórico do item
- Ver divergências
- Abrir espelho operacional do item

---

## 1.8 Regras de comportamento

### Comportamento de cálculo
O sistema deve calcular e apresentar:
- disponível = total gerada - reservada
- situação do item por semáforo operacional
- comparação entre reservado, recebido e expedido

### Comportamento visual
- Itens disponíveis devem aparecer em estado normal.
- Itens próximos do esgotamento devem aparecer como críticos.
- Itens esgotados devem ser destacados como bloqueados para novas vendas.
- Itens com divergência devem possuir alerta visual específico.

### Comportamento operacional
- A tela não é apenas comercial; ela deve permitir leitura operacional do impacto do dia.
- Divergências no recebimento não podem ser ocultadas nem corrigidas sem rastreabilidade.

---

## 1.9 Validações e consistências

- Não pode existir saldo disponível negativo.
- Não pode haver divergência silenciosa entre reservado e recebido.
- Itens esgotados não podem permitir novas reservas.
- A tela deve sempre refletir a compra principal do dia, sem mistura entre múltiplas compras.

---

## 1.10 Mensagens e alertas esperados

### Exemplos
- “Item esgotado: novas vendas bloqueadas.”
- “Divergência de recebimento identificada para o item ‘Dianteiro’.”
- “Pedidos em risco de atendimento devido à redução do recebido.”
- “Sobra operacional identificada para o item ‘Central’.”

---

# 2. Tela de Recebimento com Correção de Divergências

## 2.1 Objetivo da tela
Registrar o recebimento físico do lote do dia e tratar, de forma sistêmica, divergências entre:
- compra programada
- nota fiscal do fornecedor
- quantidades e pesos apurados no recebimento/pesagem

## 2.2 Perfis de acesso
- Operador/receptor
- Gestor operacional
- Compras
- Administrativo
- Faturamento em consulta
- Comercial em consulta, quando necessário

## 2.3 Estrutura da tela
A tela pode ser organizada em 5 blocos:

1. Cabeçalho do recebimento
2. Itens esperados
3. Itens recebidos/apurados
4. Tratamento de divergências
5. Histórico e tratativa com fornecedor

---

## 2.4 Cabeçalho do recebimento

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| ID do recebimento | Automático | Sim | Gerado pelo sistema |
| Data/hora do recebimento | Data/hora | Sim | Momento operacional |
| Lote do dia | Automático / seleção controlada | Sim | Vinculado à compra principal |
| Fornecedor | Automático | Sim | Vem da compra programada |
| NF do fornecedor | Texto / vínculo documental | Não | Pode ser uma ou mais referências |
| Doca / posição | Texto / seleção | Não | Apoio operacional |
| Responsável pelo recebimento | Usuário | Sim | Registro de auditoria |
| Status do recebimento | Lista | Sim | Em andamento, com divergência, concluído |

---

## 2.5 Grid de itens esperados

Cada linha representa a expectativa derivada da compra do dia.

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Item esperado | Texto | Sim | Ex.: dianteiro |
| Quantidade esperada | Número | Sim | Vem da compra/desdobramento |
| Referência da NF | Texto | Não | Apoio à conferência |
| Observações da compra | Texto | Não | Informações originais |
| Situação do item | Indicador | Sim | Aguardando, parcial, conforme, divergente |

---

## 2.6 Grid de itens recebidos/apurados

Cada linha representa o efetivamente recebido e registrado.

| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Item recebido | Texto / seleção | Sim | Pode coincidir ou divergir do esperado |
| Quantidade recebida | Número | Sim | Deve ser apurada e registrada |
| Peso total apurado | Número | Não | Informação operacional relevante |
| Quantidade já associada a pedidos | Número | Automático | Apoio à operação |
| Quantidade com corte | Número | Automático / manual conforme etapa | Apoio à rastreabilidade |
| Observações do receptor | Texto | Não | Campo livre |
| Situação do item | Indicador | Sim | Conforme, divergente, bloqueado |

---

## 2.7 Bloco de tratamento de divergências

Quando houver diferença, o sistema deve abrir o painel de tratamento.

### Campos do tratamento
| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Tipo de divergência | Lista | Sim | Quantidade menor, quantidade maior, item divergente, qualidade divergente, peso incompatível, item ausente, item excedente, inconsistência NF x físico |
| Descrição da divergência | Texto longo | Sim | Detalhamento humano |
| Impacto operacional | Lista / texto | Sim | Pedidos afetados, item crítico, sobra, ruptura |
| Ação imediata tomada | Lista / texto | Sim | Ex.: aceitar diferença, replanejar, redirecionar, bloquear, enviar para estoque |
| Responsável pela ação | Usuário | Sim | Auditoria |
| Aprovador / gestor | Usuário | Não / condicional | Quando exigido |
| Status da ocorrência | Lista | Sim | Aberta, em análise, aguardando fornecedor, resolvida |
| Pedidos impactados | Lista / link | Não | Deve ser preenchido quando houver impacto |
| Evidências / anexos | Arquivo | Não | Fotos, NF, registros etc. |

---

## 2.8 Bloco de histórico e tratativa com fornecedor

A tela deve permitir registrar a linha do tempo da resolução.

### Campos
| Campo | Tipo | Obrigatório | Regra / Observação |
|---|---|---:|---|
| Data/hora do registro | Automático | Sim | Histórico |
| Usuário responsável | Automático | Sim | Auditoria |
| Ação registrada | Texto | Sim | Ex.: contato com fornecedor, aceite, compensação |
| Retorno do fornecedor | Texto | Não | Registro formal |
| Próximo passo | Texto | Não | Acompanhamento |
| Situação final | Texto | Não | Desfecho |

---

## 2.9 Ações da tela

### Ações principais
- Iniciar recebimento
- Registrar item recebido
- Comparar esperado x recebido
- Apontar divergência
- Classificar divergência
- Registrar ação imediata
- Vincular pedidos impactados
- Notificar compras/gestor
- Abrir ocorrência com fornecedor
- Atualizar tratativa
- Encerrar recebimento
- Encerrar ocorrência

### Ações por item
- Confirmar item
- Marcar item como divergente
- Editar apontamento
- Ver histórico do item
- Ver pedidos impactados

---

## 2.10 Regras de comportamento

### Comportamento geral
- O recebimento deve sempre partir do lote principal do dia.
- O sistema deve apresentar claramente o que era esperado antes do registro do recebido.
- Diferenças não podem ser ajustadas apenas pelo operador sem registro formal.

### Comportamento em caso de divergência
Ao detectar divergência, o sistema deve:
1. Exigir classificação da divergência.
2. Exigir registro da ação humana tomada.
3. Exigir responsável pela ação.
4. Atualizar a visão da disponibilidade virtual e do risco operacional.
5. Permitir abertura ou continuidade da ocorrência com fornecedor.

### Comportamento de impacto
Se a divergência reduzir a capacidade de atendimento:
- o sistema deve listar pedidos afetados
- gerar alerta operacional
- expor o impacto ao comercial, planejamento, expedição e faturamento

### Comportamento de encerramento
O recebimento só pode ser concluído com:
- todos os itens tratados como conformes ou divergentes formalmente registradas
- sem pendência silenciosa

---

## 2.11 Validações detalhadas

- O lote do dia é obrigatório.
- O recebimento deve estar vinculado à compra programada do dia.
- Toda divergência deve gerar ocorrência formal.
- Não pode haver alteração invisível do esperado ou do recebido.
- O responsável pela ação deve ser registrado.
- Deve existir rastreabilidade de data/hora e usuário.

---

## 2.12 Mensagens e alertas esperados

### Exemplos
- “Divergência identificada: quantidade recebida inferior ao previsto.”
- “É obrigatório classificar a divergência antes de continuar.”
- “Pedidos em risco de atendimento foram identificados.”
- “Ocorrência com fornecedor aberta com sucesso.”
- “Não é permitido concluir o recebimento com divergência sem tratativa registrada.”

---

## 2.13 Dados derivados desta tela
A partir desta tela, o sistema deverá alimentar:
- disponibilidade efetiva do dia
- painel comercial/operacional
- ocorrência com fornecedor
- expedição
- faturamento
- rastreabilidade do lote

---

## 2.14 Observação funcional importante
O processo de correção no recebimento é hoje tratado manualmente, mas no sistema ele deve ser:
- formal
- rastreável
- auditável
- integrado ao impacto operacional do dia

Ou seja, a divergência não é apenas uma anotação de recebimento; ela afeta todo o ecossistema da operação.
