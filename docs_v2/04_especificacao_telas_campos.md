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
