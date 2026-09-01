# 011-modelo-logico-inicial-banco-de-dados-tabelas-e-relacionamentos

## Objetivo do documento
Traduzir o modelo conceitual aprovado para uma proposta inicial de modelo lógico relacional, identificando:
- tabelas principais,
- chaves primárias e estrangeiras,
- campos principais,
- relacionamentos,
- índices e restrições de integridade,
- e decisões iniciais para suportar a operação AlphaCarnes.

Este documento é uma base inicial e pode ser refinado posteriormente na modelagem física.

---

# 1. Premissas de modelagem lógica

## 1.1 Premissas gerais
- O banco deve separar claramente camadas de planejamento, operação, expedição, faturamento e auditoria.
- O modelo deve ser orientado à rastreabilidade e não apenas ao estado atual.
- Toda alteração crítica deve deixar histórico.
- O modelo deve suportar transações consistentes em etapas críticas:
  - reserva de saldo virtual,
  - associação da peça ao pedido,
  - transferência entre pedidos,
  - fechamento do caminhão,
  - emissão de NF.

## 1.2 Convenções sugeridas
- PKs numéricas ou UUIDs, conforme decisão técnica final.
- Campos de auditoria base:
  - createdAt
  - createdBy
  - updatedAt
  - updatedBy
  - deletedAt, quando aplicável
- Campos de status explícitos em entidades transacionais.
- Uso de tabelas de histórico para mudanças relevantes.

---

# 2. Tabelas de cadastro

## 2.1 clientes
### Campos principais
- id
- codigo
- razaoSocial
- nomeFantasia
- documentoFiscal
- status
- rotaPadrao
- prioridade
- preferenciasJson
- observacoesOperacionais
- dadosFiscaisJson
- dadosContatoJson
- createdAt
- updatedAt

### Índices sugeridos
- unique(documentoFiscal)
- index(codigo)
- index(status)

---

## 2.2 fornecedores
### Campos principais
- id
- codigo
- razaoSocial
- documentoFiscal
- status
- contatosJson
- observacoes
- parametrosOperacionaisJson
- createdAt
- updatedAt

### Índices sugeridos
- unique(documentoFiscal)
- index(codigo)

---

## 2.3 itens_compra
### Campos principais
- id
- codigo
- descricao
- categoria
- unidadeCompra
- status
- createdAt
- updatedAt

---

## 2.4 itens_comerciais
### Campos principais
- id
- codigo
- descricao
- categoria
- unidadeComercial
- permiteCorte
- status
- observacoesOperacionais
- createdAt
- updatedAt

---

## 2.5 regras_desdobramento_comercial
### Campos principais
- id
- itemCompraId
- itemComercialId
- fatorQuantidade
- status
- vigenciaInicio
- vigenciaFim
- observacoes
- createdAt
- updatedAt

### Restrições
- FK itemCompraId -> itens_compra.id
- FK itemComercialId -> itens_comerciais.id

### Índices sugeridos
- index(itemCompraId, status)
- index(itemComercialId, status)

---

# 3. Tabelas de compra programada

## 3.1 compras_programadas
### Campos principais
- id
- dataOperacao
- fornecedorId
- numeroInterno
- referenciaExterna
- previsaoEntrega
- statusCompra
- observacoes
- dataConfirmacao
- createdBy
- confirmedBy
- createdAt
- updatedAt

### Restrições
- FK fornecedorId -> fornecedores.id
- ~~unique(dataOperacao) na V1, considerando um lote principal por dia~~ **Superado por [AD-14](execucao/DECISOES.md) (2026-08-27).** A unicidade passou a ser `numero_sequencial` único dentro da operação; N compras ativas coexistem no mesmo dia.

### Índices sugeridos
- ~~unique(dataOperacao)~~ unique(`operacao_id`, `numero_sequencial`) — AD-14
- index(statusCompra)
- index(fornecedorId)

---

## 3.2 compras_programadas_itens
### Campos principais
- id
- compraProgramadaId
- itemCompraId
- quantidadeComprada
- unidade
- observacoes
- regraDesdobramentoId
- createdAt
- updatedAt

### Restrições
- FK compraProgramadaId -> compras_programadas.id
- FK itemCompraId -> itens_compra.id
- FK regraDesdobramentoId -> regras_desdobramento_comercial.id

### Índices sugeridos
- index(compraProgramadaId)
- index(itemCompraId)

---

# 4. Disponibilidade virtual e pedidos

## 4.1 disponibilidades_virtuais
### Campos principais
- id
- compraProgramadaId
- dataOperacao
- itemComercialId
- quantidadeTotalGerada
- quantidadeReservada
- quantidadeDisponivel
- quantidadeRecebida
- quantidadeExpedida
- quantidadeSobra
- quantidadeComDivergencia
- statusDisponibilidade
- createdAt
- updatedAt

### Restrições
- FK compraProgramadaId -> compras_programadas.id
- FK itemComercialId -> itens_comerciais.id
- unique(compraProgramadaId, itemComercialId)

### Índices sugeridos
- unique(compraProgramadaId, itemComercialId)
- index(dataOperacao)
- index(statusDisponibilidade)

---

## 4.2 pedidos_venda
### Campos principais
- id
- compraProgramadaId
- clienteId
- dataOperacao
- dataEntrega
- rotaPrevista
- prioridade
- statusPedido
- observacoesGerais
- createdBy
- approvedBy
- createdAt
- updatedAt

### Restrições
- FK compraProgramadaId -> compras_programadas.id
- FK clienteId -> clientes.id

### Índices sugeridos
- index(compraProgramadaId)
- index(clienteId)
- index(statusPedido)
- index(dataOperacao)

---

## 4.3 pedidos_venda_itens
### Campos principais
- id
- pedidoVendaId
- itemComercialId
- quantidadePedida
- quantidadeReservada
- quantidadeAtendida
- quantidadePendente
- preferenciasAplicadasJson
- observacoes
- statusItemPedido
- createdAt
- updatedAt

### Restrições
- FK pedidoVendaId -> pedidos_venda.id
- FK itemComercialId -> itens_comerciais.id

### Índices sugeridos
- index(pedidoVendaId)
- index(itemComercialId)
- index(statusItemPedido)

---

## 4.4 reservas_disponibilidade
### Objetivo
Tabela transacional para rastrear a reserva de saldo virtual por item de pedido.

### Campos principais
- id
- disponibilidadeVirtualId
- pedidoVendaItemId
- quantidadeReservada
- statusReserva
- createdAt
- updatedAt

### Restrições
- FK disponibilidadeVirtualId -> disponibilidades_virtuais.id
- FK pedidoVendaItemId -> pedidos_venda_itens.id

### Índices sugeridos
- index(disponibilidadeVirtualId)
- index(pedidoVendaItemId)
- unique(disponibilidadeVirtualId, pedidoVendaItemId)

---

# 5. Recebimento e divergências

## 5.1 recebimentos
### Campos principais
- id
- compraProgramadaId
- fornecedorId
- dataHoraChegada
- notaFiscalFornecedor
- placaVeiculoFornecedor
- motoristaFornecedor
- statusRecebimento
- observacoes
- createdAt
- updatedAt

### Restrições
- FK compraProgramadaId -> compras_programadas.id
- FK fornecedorId -> fornecedores.id

---

## 5.2 recebimentos_itens
### Campos principais
- id
- recebimentoId
- itemComercialOuClasse
- quantidadeRecebida
- pesoTotalApurado
- statusApuracao
- observacoes
- createdAt
- updatedAt

### Restrições
- FK recebimentoId -> recebimentos.id

### Observação
Na fase física, pode ser necessário manter a classificação operacional em texto/código até a estabilização do cadastro definitivo.

---

## 5.3 divergencias_recebimento
### Campos principais
- id
- recebimentoId
- tipoDivergencia
- descricao
- impactoOperacional
- impactoComercial
- statusDivergencia
- acaoImediata
- responsavelRegistro
- dataHoraRegistro
- createdAt
- updatedAt

### Restrições
- FK recebimentoId -> recebimentos.id

### Índices sugeridos
- index(recebimentoId)
- index(statusDivergencia)
- index(tipoDivergencia)

---

## 5.4 divergencias_recebimento_pedidos_afetados
### Objetivo
Relacionar divergência a pedidos impactados.

### Campos principais
- id
- divergenciaRecebimentoId
- pedidoVendaId
- impacto
- observacoes

### Restrições
- FK divergenciaRecebimentoId -> divergencias_recebimento.id
- FK pedidoVendaId -> pedidos_venda.id

---

## 5.5 ocorrencias_fornecedor
### Campos principais
- id
- fornecedorId
- compraProgramadaId
- divergenciaRecebimentoId
- statusOcorrencia
- descricao
- impacto
- desfecho
- dataHoraAbertura
- dataHoraEncerramento
- createdAt
- updatedAt

### Restrições
- FK fornecedorId -> fornecedores.id
- FK compraProgramadaId -> compras_programadas.id
- FK divergenciaRecebimentoId -> divergencias_recebimento.id

---

## 5.6 ocorrencias_fornecedor_historico
### Campos principais
- id
- ocorrenciaFornecedorId
- statusAnterior
- statusNovo
- descricaoAndamento
- responsavel
- createdAt

### Restrições
- FK ocorrenciaFornecedorId -> ocorrencias_fornecedor.id

---

# 6. Peças, associação e pesagem

## 6.1 pecas
### Campos principais
- id
- compraProgramadaId
- recebimentoId
- classificacaoOperacional
- itemComercialBaseId
- pesoOriginal
- dataHoraPesagem
- modoCapturaPeso
- statusPeca
- etiquetaAtualId
- pedidoVendaAtualId
- pedidoVendaItemAtualId
- caminhaoAtualId
- observacoes
- createdAt
- updatedAt

### Restrições
- FK compraProgramadaId -> compras_programadas.id
- FK recebimentoId -> recebimentos.id
- FK itemComercialBaseId -> itens_comerciais.id nullable
- FK pedidoVendaAtualId -> pedidos_venda.id nullable
- FK pedidoVendaItemAtualId -> pedidos_venda_itens.id nullable
- FK caminhaoAtualId -> caminhoes.id nullable (definir após criação)
- FK etiquetaAtualId -> etiquetas.id nullable (cíclico, tratar depois)

### Índices sugeridos
- index(recebimentoId)
- index(statusPeca)
- index(pedidoVendaAtualId)
- index(caminhaoAtualId)

---

## 6.2 sugestoes_associacao
### Campos principais
- id
- pecaId
- pedidoVendaId
- pedidoVendaItemId
- scoreCompatibilidade
- justificativa
- statusSugestao
- dataHoraGeracao

### Restrições
- FK pecaId -> pecas.id
- FK pedidoVendaId -> pedidos_venda.id
- FK pedidoVendaItemId -> pedidos_venda_itens.id

---

## 6.3 historico_associacoes_peca
### Campos principais
- id
- pecaId
- pedidoOrigemId
- pedidoDestinoId
- caminhaoOrigemId
- caminhaoDestinoId
- motivo
- operadorResponsavel
- statusExpedicaoNoMomento
- createdAt

### Restrições
- FK pecaId -> pecas.id
- FK pedidoOrigemId -> pedidos_venda.id nullable
- FK pedidoDestinoId -> pedidos_venda.id nullable

---

## 6.4 pesagens_log
### Objetivo
Guardar leituras relevantes, inclusive manuais.

### Campos principais
- id
- pecaId
- pesoLido
- modoCaptura
- balancaOrigem
- estavel
- confirmado
- operador
- createdAt

### Restrições
- FK pecaId -> pecas.id

---

# 7. Corte, transformação e etiquetas

## 7.1 transformacoes
### Campos principais
- id
- pecaOrigemId
- tipoTransformacao
- motivo
- operadorResponsavel
- statusTransformacao
- dataHoraAbertura
- dataHoraEncerramento
- observacoes
- createdAt
- updatedAt

### Restrições
- FK pecaOrigemId -> pecas.id

---

## 7.2 subitens
### Campos principais
- id
- transformacaoId
- pecaOrigemId
- classificacao
- itemComercialId
- peso
- quantidade
- statusSubitem
- pedidoVendaAtualId
- pedidoVendaItemAtualId
- caminhaoAtualId
- etiquetaAtualId
- observacoes
- createdAt
- updatedAt

### Restrições
- FK transformacaoId -> transformacoes.id
- FK pecaOrigemId -> pecas.id
- FK itemComercialId -> itens_comerciais.id nullable

### Índices sugeridos
- index(transformacaoId)
- index(statusSubitem)
- index(caminhaoAtualId)

---

## 7.3 etiquetas
### Campos principais
- id
- codigoEtiqueta
- tipoEtiqueta
- pecaId
- subitemId
- referenciaOrigem
- statusEtiqueta
- versao
- operadorResponsavel
- dataHoraImpressao
- createdAt

### Restrições
- FK pecaId -> pecas.id nullable
- FK subitemId -> subitens.id nullable
- check (apenas um dos dois preenchido, conforme regra)
- unique(codigoEtiqueta)

### Índices sugeridos
- unique(codigoEtiqueta)
- index(pecaId)
- index(subitemId)
- index(statusEtiqueta)

---

# 8. Expedição e caminhões

## 8.1 caminhoes
### Campos principais
- id
- placa
- motorista
- rota
- itinerarioJson
- statusCaminhao
- dataOperacao
- horaAberturaCarga
- horaFechamentoCarga
- horaLiberacao
- observacoes
- createdAt
- updatedAt

### Índices sugeridos
- index(dataOperacao)
- index(statusCaminhao)
- index(placa)

---

## 8.2 caminhoes_pedidos
### Campos principais
- id
- caminhaoId
- pedidoVendaId
- ordemNaCarga
- statusNaCarga
- observacoes
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id
- FK pedidoVendaId -> pedidos_venda.id
- unique(caminhaoId, pedidoVendaId)

---

## 8.3 carga_itens
### Campos principais
- id
- caminhaoId
- tipoOrigem
- pecaId
- subitemId
- pedidoVendaId
- pedidoVendaItemId
- dataHoraEntradaCarga
- statusCargaItem
- conferido
- observacoes
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id
- FK pecaId -> pecas.id nullable
- FK subitemId -> subitens.id nullable
- FK pedidoVendaId -> pedidos_venda.id
- FK pedidoVendaItemId -> pedidos_venda_itens.id

### Índices sugeridos
- index(caminhaoId)
- index(pedidoVendaId)
- index(statusCargaItem)

---

## 8.4 conferencias_carga
### Campos principais
- id
- caminhaoId
- operadorResponsavel
- dataHoraInicio
- dataHoraFim
- statusConferencia
- pendenciasJson
- observacoes
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id

---

# 9. Faturamento, NF e documentos

## 9.1 faturamentos
### Campos principais
- id
- caminhaoId
- statusFaturamento
- responsavel
- dataHoraInicio
- dataHoraFim
- observacoes
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id
- unique(caminhaoId) por operação

---

## 9.2 notas_fiscais
### Campos principais
- id
- faturamentoId
- numeroNota
- chaveAcesso
- statusNota
- dataHoraEmissao
- dataHoraAutorizacao
- retornoSefaz
- tipoDocumento
- observacoes
- createdAt
- updatedAt

### Restrições
- FK faturamentoId -> faturamentos.id
- unique(chaveAcesso) nullable
- index(statusNota)

---

## 9.3 notas_fiscais_pedidos
### Objetivo
Vincular pedidos contemplados na NF.

### Campos principais
- id
- notaFiscalId
- pedidoVendaId

### Restrições
- FK notaFiscalId -> notas_fiscais.id
- FK pedidoVendaId -> pedidos_venda.id
- unique(notaFiscalId, pedidoVendaId)

---

## 9.4 seguros_carga
### Campos principais
- id
- caminhaoId
- statusSeguro
- protocolo
- dataHoraGeracao
- observacoes
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id
- unique(caminhaoId)

---

## 9.5 envios_documento_motorista
### Campos principais
- id
- caminhaoId
- tipoDocumento
- canalEnvio
- destinatario
- statusEnvio
- evidenciasJson
- dataHoraEnvio
- createdAt
- updatedAt

### Restrições
- FK caminhaoId -> caminhoes.id

---

# 10. Estoque, alertas e auditoria

## 10.1 estoque_movimentos
### Campos principais
- id
- tipoOrigem
- pecaId
- subitemId
- motivoEntradaEstoque
- statusEstoque
- dataHoraMovimento
- observacoes
- createdAt

### Restrições
- FK pecaId -> pecas.id nullable
- FK subitemId -> subitens.id nullable

---

## 10.2 alertas_operacionais
### Campos principais
- id
- tipoAlerta
- nivel
- moduloOrigem
- entidadeOrigem
- entidadeOrigemId
- descricao
- impacto
- statusAlerta
- dataHoraGeracao
- dataHoraResolucao
- createdAt
- updatedAt

### Índices sugeridos
- index(nivel)
- index(statusAlerta)
- index(moduloOrigem)

---

## 10.3 auditoria_acoes
### Campos principais
- id
- usuario
- acao
- modulo
- entidadeAfetada
- entidadeAfetadaId
- valorAnteriorJson
- valorNovoJson
- justificativa
- createdAt

### Índices sugeridos
- index(modulo)
- index(entidadeAfetada, entidadeAfetadaId)
- index(usuario)
- index(createdAt)

---

# 11. Tabelas candidatas a catálogos/domínios

- status_compra
- status_disponibilidade
- status_pedido
- status_item_pedido
- status_recebimento
- tipos_divergencia_recebimento
- status_divergencia
- status_ocorrencia_fornecedor
- status_peca
- status_transformacao
- status_subitem
- status_etiqueta
- status_caminhao
- status_carga_item
- status_conferencia
- status_faturamento
- status_nota_fiscal
- status_seguro
- status_envio_documento
- niveis_alerta
- tipos_alerta

Na V1, parte disso pode ser enum em código; na evolução, convém migrar para catálogos.

---

# 12. Restrições e checks recomendados

## CHECK-01
quantidadeDisponivel >= 0 em disponibilidades_virtuais

## CHECK-02
quantidadePedida > 0 em pedidos_venda_itens

## CHECK-03
quantidadeReservada >= 0 e quantidadePendente >= 0

## CHECK-04
peso > 0 para subitens válidos

## CHECK-05
etiquetas deve referenciar peça ou subitem, não ambos simultaneamente

## CHECK-06
carga_itens deve referenciar peça ou subitem, não ambos simultaneamente

## CHECK-07
compra_programada única por dataOperacao na V1

---

# 13. Transações críticas sugeridas

## 13.1 Reserva de saldo virtual
Deve atualizar:
- pedidos_venda_itens
- reservas_disponibilidade
- disponibilidades_virtuais

## 13.2 Associação da peça
Deve atualizar:
- pecas
- historico_associacoes_peca
- pedidos_venda_itens
- carga_itens, se já houver entrada de carga

## 13.3 Transferência entre pedidos
Deve atualizar de forma atômica:
- peça/subitem atual
- histórico
- saldos do item do pedido origem/destino
- composição da carga, se aplicável

## 13.4 Fechamento do caminhão
Deve atualizar:
- caminhoes
- carga_itens
- bloqueios operacionais associados

## 13.5 Emissão de NF
Deve registrar:
- faturamentos
- notas_fiscais
- notas_fiscais_pedidos
- auditoria
- status do caminhão

---

# 14. Estratégias de indexação e performance

## 14.1 Consultas críticas
- saldo virtual por item/data
- pedidos por cliente e status
- peças por status/caminhão
- subitens por transformação
- carga por caminhão
- caminhões por status
- divergências abertas
- alertas críticos
- auditoria por entidade

## 14.2 Índices compostos recomendados
- disponibilidades_virtuais(compraProgramadaId, itemComercialId)
- pedidos_venda(clienteId, dataOperacao, statusPedido)
- pedidos_venda_itens(pedidoVendaId, itemComercialId)
- pecas(statusPeca, caminhaoAtualId)
- subitens(statusSubitem, caminhaoAtualId)
- carga_itens(caminhaoId, statusCargaItem)
- notas_fiscais(statusNota, dataHoraEmissao)
- alertas_operacionais(statusAlerta, nivel, moduloOrigem)

---

# 15. Próximos refinamentos esperados
Este documento prepara a sequência de:
1. DDL inicial / script SQL base;
2. mapeamento ORM;
3. definição de agregados por domínio;
4. desenho de APIs;
5. definição de filas/eventos;
6. revisão de constraints com base em cenários reais.

---

# 16. Resultado esperado deste documento
Com este documento, a solução passa a ter uma base lógica suficientemente estruturada para:
- iniciar desenho físico do banco,
- mapear entidades em backend,
- definir contratos entre módulos,
- sustentar rastreabilidade e integridade operacional,
- e reduzir ambiguidades na futura implementação.
