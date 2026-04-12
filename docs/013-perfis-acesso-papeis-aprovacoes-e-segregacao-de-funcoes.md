# 013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes

## Objetivo do documento
Definir os perfis de acesso, papéis operacionais, regras de aprovação e segregação de funções da solução AlphaCarnes.

---

# 1. Princípios de acesso

## 1.1 Princípios centrais
- Cada usuário deve ver apenas o necessário para sua função.
- Ações críticas devem depender de perfil compatível.
- Etapas com risco operacional, fiscal ou comercial devem exigir trilha auditável.
- A segregação de funções deve evitar conflito entre criação, aprovação e exceção.

---

# 2. Perfis principais

## 2.1 Administrador do Sistema
### Responsabilidades
- gerenciar parâmetros globais
- gerenciar perfis
- configurar itens, regras e integrações
- visualizar auditoria completa

### Acessos
- total, com restrição operacional definida por política interna

---

## 2.2 Comprador / Operador de Compras
### Responsabilidades
- criar compra programada
- editar lote do dia
- acompanhar fornecedor
- acompanhar divergências com fornecedor

### Pode
- criar e editar compra antes da confirmação
- registrar informações do fornecedor
- acompanhar ocorrências

### Não deve
- emitir NF
- liberar caminhão
- alterar carga fechada

---

## 2.3 Gestor Comercial / Gestor Operacional
### Responsabilidades
- aprovar compra programada, quando aplicável
- aprovar ajustes relevantes
- supervisionar operação
- tratar exceções
- reabrir fluxos restritos, se política permitir

### Pode
- aprovar compra
- aprovar pedidos especiais
- autorizar exceções
- aprovar reabertura de expedição, se habilitado

---

## 2.4 Operador Comercial / Sabrina
### Responsabilidades
- registrar pedidos de venda
- consultar saldo virtual
- aplicar preferências do cliente

### Pode
- criar pedido
- editar pedido enquanto permitido
- cancelar pedido enquanto permitido

### Não deve
- aprovar overbooking (não permitido)
- alterar carga fechada
- emitir NF

---

## 2.5 Operador de Recebimento / Pesagem
### Responsabilidades
- registrar recebimento
- pesar peça
- analisar sugestão de associação
- confirmar ou redirecionar peça
- registrar divergência

### Pode
- classificar item
- capturar peso
- associar peça ao pedido
- abrir divergência

### Não deve
- liberar caminhão
- emitir NF

---

## 2.6 Operador de Corte
### Responsabilidades
- executar transformação
- registrar subitens
- reetiquetar

### Pode
- abrir transformação
- definir subitens
- enviar subitens à expedição ou sobra, conforme regra

### Não deve
- fechar caminhão
- emitir NF

---

## 2.7 Operador de Expedição / Ludmila
### Responsabilidades
- montar carga
- conferir itens
- transferir peças entre pedidos enquanto permitido
- fechar expedição

### Pode
- incluir peça na carga
- transferir peça entre pedidos compatíveis
- conferir carga
- fechar expedição

### Não deve
- emitir NF
- alterar carga fechada sem exceção aprovada

---

## 2.8 Conferente
### Responsabilidades
- validar itens carregados
- registrar pendências de carga

### Pode
- confirmar item
- registrar falta/sobra
- concluir conferência

### Não deve
- redirecionar peça sem permissão
- emitir NF

---

## 2.9 Faturamento / Fiscal
### Responsabilidades
- validar bloqueios fiscais
- emitir NF
- gerar documentos
- acompanhar seguro

### Pode
- preparar faturamento
- emitir NF
- reenviar emissão
- registrar pendências fiscais

### Não deve
- alterar carga fechada
- transferir peça em expedição

---

## 2.10 Logística / Liberação
### Responsabilidades
- validar checklist final
- confirmar envio documental
- liberar caminhão

### Pode
- verificar pré-requisitos
- liberar caminhão se perfil permitir

### Não deve
- alterar composição da carga fechada
- reabrir NF sem autorização

---

## 2.11 Diretoria / Gestão Executiva
### Responsabilidades
- acompanhar indicadores
- acompanhar exceções críticas
- auditar operação

### Pode
- visualizar dashboards executivos
- consultar históricos
- visualizar ocorrências e bloqueios

---

# 3. Matriz resumida de permissões

## 3.1 Compra Programada
- criar: Compras
- editar rascunho: Compras
- confirmar: Compras/Gestor
- alterar após pedidos: Gestor/Admin

## 3.2 Pedidos de Venda
- criar: Comercial
- editar: Comercial
- cancelar: Comercial/Gestor
- aprovar exceções: Gestor

## 3.3 Pesagem e Associação
- pesar: Operador de Pesagem
- confirmar associação: Operador de Pesagem
- redirecionar peça: Operador de Pesagem / Expedição, conforme etapa

## 3.4 Corte
- transformar: Operador de Corte
- aprovar ajustes extraordinários: Gestor

## 3.5 Expedição
- carregar: Expedição
- transferir peça enquanto aberto: Expedição
- fechar caminhão: Expedição / Gestor, conforme política
- reabrir: Gestor/Admin, se permitido

## 3.6 Faturamento
- preparar: Fiscal
- emitir NF: Fiscal
- reprocessar: Fiscal/Gestor
- liberar caminhão: Logística/Fiscal/Gestor, conforme política

---

# 4. Aprovações críticas

## 4.1 Aprovação da compra programada
Pode ser exigida antes de liberar vendas.

## 4.2 Aprovação de alteração estrutural após vendas iniciadas
Mudanças no lote do dia após pedidos criados devem exigir perfil superior.

## 4.3 Aprovação de exceção operacional
Exemplos:
- reabertura de expedição
- correção manual excepcional
- liberação com pendência justificada

## 4.4 Aprovação de exceção fiscal
Exemplos:
- contingência
- reprocessamento crítico
- liberação sob ressalva

---

# 5. Segregação de funções recomendada

## SF-01
Quem cria a compra programada não deveria ser o único aprovador final, quando houver governança mais rígida.

## SF-02
Quem altera a carga não deve ser o mesmo responsável por autorizar a exceção fiscal sem trilha adicional.

## SF-03
Quem emite a NF não deve mudar silenciosamente a composição física da carga.

## SF-04
Quem libera o caminhão deve enxergar os status fiscal, documental e operacional consolidados.

---

# 6. Regras de autorização por estado

## 6.1 Carga aberta
Perfis operacionais podem transferir peças dentro das regras.

## 6.2 Carga fechada
Perfis operacionais comuns não podem alterar a carga.

## 6.3 NF emitida
Mudanças na carga ficam bloqueadas, salvo exceção formal.

## 6.4 Caminhão liberado
A operação é considerada encerrada para edição comum.

---

# 7. Auditoria obrigatória

Ações que devem gerar log obrigatório:
- confirmação da compra programada
- cancelamento/alteração relevante de pedido
- peso manual
- transferência de peça
- abertura de divergência
- corte e reetiquetagem
- fechamento da expedição
- emissão de NF
- reprocessamento de emissão
- liberação do caminhão
- reabertura excepcional

---

# 8. Resultado esperado deste documento
Com este documento, a solução passa a ter base para:
- controle de acesso por função,
- segregação mínima de responsabilidades,
- desenho de autorização no backend,
- e prevenção de ações indevidas em etapas críticas.
