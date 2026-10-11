// Gerado a partir do Caderno B v1.1 e contratos E11/E12. Conteúdo de protótipo; nenhum dado real.
window.ALPHA_PROTO_DATA = {
  "build": "2026-10-11",
  "designSystem": "DS v3 — Direção A (AD-10)",
  "menuGroups": [
    "COMERCIAL",
    "GESTÃO",
    "RECEBIMENTO & BALANÇA",
    "DESOSSA",
    "ESTOQUE",
    "CARGA",
    "FATURAMENTO",
    "FISCAL",
    "FINANCEIRO",
    "BANCOS & TESOURARIA",
    "CONTABILIDADE",
    "CADASTROS & REGRAS",
    "ADMINISTRAÇÃO"
  ],
  "existing": [
    {
      "route": "/comercial/clientes",
      "title": "Clientes"
    },
    {
      "route": "/comercial/pedidos",
      "title": "Pedidos de Venda"
    },
    {
      "route": "/comercial/tabela-precos",
      "title": "Tabela de Preços"
    },
    {
      "route": "/comercial/disponibilidade",
      "title": "Disponibilidade"
    },
    {
      "route": "/comercial/espelho",
      "title": "Espelho Comercial"
    },
    {
      "route": "/gestao/dashboard",
      "title": "Painel Geral da Operação"
    },
    {
      "route": "/gestao/operacoes",
      "title": "Operações"
    },
    {
      "route": "/gestao/compras",
      "title": "Compras"
    },
    {
      "route": "/gestao/overbooking",
      "title": "Pendências de Overbooking"
    },
    {
      "route": "/gestao/aprovacoes",
      "title": "Aprovações & Ocorrências"
    },
    {
      "route": "/gestao/relatorios",
      "title": "Relatórios & SIF"
    },
    {
      "route": "/recebimento/recebimento-carga",
      "title": "Recebimento de Carga"
    },
    {
      "route": "/recebimento/pesagem-destinacao",
      "title": "Pesagem e Destinação"
    },
    {
      "route": "/recebimento/etiquetas",
      "title": "Etiquetas"
    },
    {
      "route": "/desossa/dashboard",
      "title": "Dashboard da Desossa"
    },
    {
      "route": "/desossa/pesagem-destinacao",
      "title": "Pesagem e Destinação"
    },
    {
      "route": "/desossa/etiquetas",
      "title": "Etiquetas"
    },
    {
      "route": "/estoque/consulta",
      "title": "Consulta de Estoque"
    },
    {
      "route": "/estoque/entrada-itens",
      "title": "Entrada de Itens"
    },
    {
      "route": "/estoque/ajustes",
      "title": "Ajustes"
    },
    {
      "route": "/carga/planejamento",
      "title": "Planejamento de Carga"
    },
    {
      "route": "/carga/conferencia",
      "title": "Conferência"
    },
    {
      "route": "/carga/enviar-faturamento",
      "title": "Enviar para Faturamento"
    },
    {
      "route": "/faturamento/pre-faturamento",
      "title": "Pré-Faturamento"
    },
    {
      "route": "/faturamento/notas-xml",
      "title": "Notas / XML"
    },
    {
      "route": "/faturamento/seguro-manual",
      "title": "Seguro Manual"
    },
    {
      "route": "/faturamento/liberacao",
      "title": "Liberação do Caminhão"
    },
    {
      "route": "/cadastros/representantes",
      "title": "Representantes"
    },
    {
      "route": "/cadastros/produtos",
      "title": "Produtos"
    },
    {
      "route": "/cadastros/fornecedores",
      "title": "Fornecedores / Frigoríficos"
    },
    {
      "route": "/cadastros/caminhoes",
      "title": "Caminhões"
    },
    {
      "route": "/cadastros/motoristas",
      "title": "Motoristas"
    },
    {
      "route": "/cadastros/rotas",
      "title": "Rotas / Itinerários"
    },
    {
      "route": "/cadastros/regras-transformacao",
      "title": "Regras de Transformação"
    },
    {
      "route": "/cadastros/modelos-etiqueta",
      "title": "Modelos de Etiqueta"
    },
    {
      "route": "/admin/usuarios",
      "title": "Usuários"
    },
    {
      "route": "/admin/perfis",
      "title": "Perfis de Acesso"
    },
    {
      "route": "/admin/parametros",
      "title": "Parâmetros"
    },
    {
      "route": "/admin/auditoria",
      "title": "Auditoria"
    }
  ],
  "screens": [
    {
      "id": "E01-T01",
      "title": "Empresas, estabelecimentos e regime",
      "epic": "E01",
      "group": "FISCAL",
      "kind": "regras",
      "area": "Motor tributário",
      "route": "/erp/fiscal/e01-t01",
      "role": "gestor fiscal, contador e administrador",
      "fields": "CNPJ, IE, IM, CNAE, CRT, UF, município, certificado referenciado, vigência",
      "actions": "cadastrar empresa e filial, ativar regime por vigência, aprovar alteração",
      "rules": "não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência",
      "exceptions": "CNPJ rejeitado; troca de regime; competência bloqueada",
      "source": "Caderno B §E01-T01"
    },
    {
      "id": "E01-T02",
      "title": "Operações fiscais e enquadramentos",
      "epic": "E01",
      "group": "FISCAL",
      "kind": "regras",
      "area": "Motor tributário",
      "route": "/erp/fiscal/e01-t02",
      "role": "fiscal",
      "fields": "natureza operação, tpNF, finNFe, CFOP, origem/ destino, tipo própria ou revenda, NCM, CEST, contribuinte",
      "actions": "cadastrar operação, duplicar perfil, relacionar produto e cliente, controlar prioridade",
      "rules": "perfil nunca usa CFOP global como único determinante; critério temporal obrigatório",
      "exceptions": "empate de enquadramento e operação sem regra aprovada",
      "source": "Caderno B §E01-T02"
    },
    {
      "id": "E01-T03",
      "title": "Editor de regras tributárias",
      "epic": "E01",
      "group": "FISCAL",
      "kind": "regras",
      "area": "Motor tributário",
      "route": "/erp/fiscal/e01-t03",
      "role": "fiscal/contador",
      "fields": "CST/CSOSN ICMS, pRedBC, pICMS, cBenef, CST IPI/PIS/COFINS, IBS/CBS/IS e cClassTrib",
      "actions": "criar rascunho, adicionar versão, comparar, submeter, aprovar, aposentar",
      "rules": "motor de regras não permite edição retroativa em nota emitida; aprovação segregada",
      "exceptions": "benefício não elegível; vigência ambígua; versão NT inválida",
      "source": "Caderno B §E01-T03"
    },
    {
      "id": "E01-T04",
      "title": "Simulador fiscal e memória de cálculo",
      "epic": "E01",
      "group": "FISCAL",
      "kind": "regras",
      "area": "Motor tributário",
      "route": "/erp/fiscal/e01-t04",
      "role": "fiscal/contador",
      "fields": "NCM, operação, cliente, data, pesos, vProd, descontos, bases, tributos por item, regras selecionadas",
      "actions": "simular, explicar tributos, exportar memória, comparar versões",
      "rules": "nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato",
      "exceptions": "base tributável difere de valor bruto; falta referência legal",
      "source": "Caderno B §E01-T04"
    },
    {
      "id": "E01-T05",
      "title": "Painel de alterações e homologação de regras",
      "epic": "E01",
      "group": "FISCAL",
      "kind": "regras",
      "area": "Motor tributário",
      "route": "/erp/fiscal/e01-t05",
      "role": "contador e auditor",
      "fields": "identificador regra, autor, motivo, legislação, cenários aprovados, vigência",
      "actions": "revisar diff, aprovar/rejeitar, publicar e auditar",
      "rules": "aprovador diferente do autor; cenários de regressão obrigatórios",
      "exceptions": "atualização normativa em meio à operação",
      "source": "Caderno B §E01-T05"
    },
    {
      "id": "E02-T01",
      "title": "Pré-emissão NF-e",
      "epic": "E02",
      "group": "FISCAL",
      "kind": "nfe",
      "area": "NF-e SEFAZ/SP",
      "route": "/erp/fiscal/e02-t01",
      "role": "faturamento/fiscal",
      "fields": "carga, pedido, cliente, estabelecimento, itens físicos, quantidades, valores e bloqueios",
      "actions": "consolidar, pré-visualizar, validar cadastro, simular tributação, solicitar emissão",
      "rules": "NF-e só dos itens efetivamente carregados e após fechamento; valores comerciais corretos",
      "exceptions": "divergência aberta, item sem NCM, série indisponível",
      "source": "Caderno B §E02-T01"
    },
    {
      "id": "E02-T02",
      "title": "Central de emissão/autorização",
      "epic": "E02",
      "group": "FISCAL",
      "kind": "nfe",
      "area": "NF-e SEFAZ/SP",
      "route": "/erp/fiscal/e02-t02",
      "role": "faturamento com permissão NF-e",
      "fields": "série, nNF, chave 44 dígitos, tpAmb, status, protocolo, recibo, XML hash",
      "actions": "assinar XML, enviar, consultar SEFAZ, reconciliar timeout, reprocessar rejeição",
      "rules": "alocação serializável; não emitir duas notas para mesmo fato/identificador; certificado A1",
      "exceptions": "SEFAZ indisponível, falha TLS, timeout, rejeição  duplicidade",
      "source": "Caderno B §E02-T02"
    },
    {
      "id": "E02-T03",
      "title": "Documentos autorizados e DANFE",
      "epic": "E02",
      "group": "FISCAL",
      "kind": "nfe",
      "area": "NF-e SEFAZ/SP",
      "route": "/erp/fiscal/e02-t03",
      "role": "faturamento, cliente interno",
      "fields": "XML nfeProc, protocolo, recibo, status, destinatário, valor e itens",
      "actions": "listar, filtrar, baixar XML, gerar DANFE, reenviar ao destinatário, inspecionar auditoria",
      "rules": "impressão DANFE nunca substitui autorização; XML íntegro arquivado",
      "exceptions": "arquivo indisponível, reenvio e acesso de terceiro",
      "source": "Caderno B §E02-T03"
    },
    {
      "id": "E02-T04",
      "title": "Eventos e pós-autorização",
      "epic": "E02",
      "group": "FISCAL",
      "kind": "nfe",
      "area": "NF-e SEFAZ/SP",
      "route": "/erp/fiscal/e02-t04",
      "role": "fiscal",
      "fields": "eventos CC-e, cancelamento, inutilização de numeração, contingência, origem",
      "actions": "solicitar, validar elegibilidade, transmitir evento, consultar status, registrar motivo",
      "rules": "CC-e não corrige valor/tributação; cancelamento exige regra legal temporal, aprovação e trilha",
      "exceptions": "cancelamento fora prazo, evento rejeitado, contingência com reconciliação",
      "source": "Caderno B §E02-T04"
    },
    {
      "id": "E02-T05",
      "title": "Console homologação SEFAZ",
      "epic": "E02",
      "group": "FISCAL",
      "kind": "nfe",
      "area": "NF-e SEFAZ/SP",
      "route": "/erp/fiscal/e02-t05",
      "role": "administrador fiscal",
      "fields": "ambiente, endpoint, certificado, expiração, séries, XSD/NT, status serviço",
      "actions": "testar certificado sem expor segredo, validar schemas, executar cenários e liberar produção",
      "rules": "produção desabilitada até credenciamento, checklist e autorização humana",
      "exceptions": "certificado vencido, indisponibilidade e schema novo",
      "source": "Caderno B §E02-T05"
    },
    {
      "id": "E03-T01",
      "title": "Inbox de XML/DF-e de fornecedor",
      "epic": "E03",
      "group": "FISCAL",
      "kind": "entrada",
      "area": "Documentos de entrada",
      "route": "/erp/fiscal/e03-t01",
      "role": "recebimento/fiscal",
      "fields": "NSU, chave, CNPJ, número/série, CFOP, itens, pesos/quantidades, total, status",
      "actions": "sincronizar distribuição autorizada, importar XML, validar XML/assinatura, deduplicar, manifestar quando legal",
      "rules": "importação não confirma recebimento físico; sem AP duplicado",
      "exceptions": "NSU repetido, XML malformado, destinatário divergente",
      "source": "Caderno B §E03-T01"
    },
    {
      "id": "E03-T02",
      "title": "Conferência tripla de entrada",
      "epic": "E03",
      "group": "FISCAL",
      "kind": "entrada",
      "area": "Documentos de entrada",
      "route": "/erp/fiscal/e03-t02",
      "role": "Fabrício, Richard, Karina",
      "fields": "pedido ao fornecedor, preço negociado, peso NF, peso Richard, peças e diferença",
      "actions": "vincular NF a pedido/lote, conciliar, classificar divergências, aprovar ressalva",
      "rules": "divergência de peso não cria devolução autorizada nem desconto tácito",
      "exceptions": "faltas, excesso, preço divergente, mercadoria não prevista",
      "source": "Caderno B §E03-T02"
    },
    {
      "id": "E03-T03",
      "title": "Solicitações de devolução",
      "epic": "E03",
      "group": "FISCAL",
      "kind": "entrada",
      "area": "Documentos de entrada",
      "route": "/erp/fiscal/e03-t03",
      "role": "Carla/fiscal",
      "fields": "origem NF, itens, quantidade/peso, motivo, acordo, autorização e referência",
      "actions": "criar pré-solicitação, negociar, aprovar, emitir NF referenciada, acompanhar aceite",
      "rules": "finNFe 4 + refNFe; sem aprovação nenhuma emissão automática",
      "exceptions": "devolução parcial, crédito não confirmado",
      "source": "Caderno B §E03-T03"
    },
    {
      "id": "E03-T04",
      "title": "Custo de aquisição/CMV e valorização",
      "epic": "E03",
      "group": "FISCAL",
      "kind": "entrada",
      "area": "Documentos de entrada",
      "route": "/erp/fiscal/e03-t04",
      "role": "controladoria/contador",
      "fields": "lote, produto, entradas, custos acessórios, movimento, método aprovado, saldo",
      "actions": "consultar ficha custo, aprovar rateios, reconciliar estoque físico versus contábil",
      "rules": "método de custo aprovado por contador; sem alteração de custo histórico silenciosa",
      "exceptions": "reclassificação tardia, período encerrado, perda de desossa",
      "source": "Caderno B §E03-T04"
    },
    {
      "id": "E04-T01",
      "title": "Painel contas a pagar",
      "epic": "E04",
      "group": "FINANCEIRO",
      "kind": "pagar",
      "area": "Contas a pagar",
      "route": "/erp/financeiro/e04-t01",
      "role": "Karina, Micaela",
      "fields": "fornecedor, título origem, total, saldo, parcelas, vencimento, status, natureza, centro custo",
      "actions": "filtrar, abrir título, aprovar lançamento e consultar aging",
      "rules": "NF conferida cria obrigação somente pela política aprovada; sem dupla obrigação por XML",
      "exceptions": "cancelamento documento, cobrança duplicada",
      "source": "Caderno B §E04-T01"
    },
    {
      "id": "E04-T02",
      "title": "Cadastro de título/parcelamento",
      "epic": "E04",
      "group": "FINANCEIRO",
      "kind": "pagar",
      "area": "Contas a pagar",
      "route": "/erp/financeiro/e04-t02",
      "role": "financeiro",
      "fields": "documento suporte, credor, parcelas, vencimento, forma, retenções, juros, desconto",
      "actions": "criar manualmente, parcelar, anexar evidência, reagendar e aprovar",
      "rules": "soma parcelas igual valor líquido do título; alterações com motivo",
      "exceptions": "valor negativo, competência fechada, boleto divergente",
      "source": "Caderno B §E04-T02"
    },
    {
      "id": "E04-T03",
      "title": "Despesas recorrentes e variáveis",
      "epic": "E04",
      "group": "FINANCEIRO",
      "kind": "pagar",
      "area": "Contas a pagar",
      "route": "/erp/financeiro/e04-t03",
      "role": "financeiro",
      "fields": "categoria água/luz/serviço/folha referenciada, fornecedor, periodicidade, competência",
      "actions": "programar recorrência, gerar provisão, aprovar documento e pagamento",
      "rules": "não gerar passivo contábil duplicado por recorrência e nota",
      "exceptions": "contrato vencido, calendário e duplicidade",
      "source": "Caderno B §E04-T03"
    },
    {
      "id": "E04-T04",
      "title": "Agenda de pagamentos",
      "epic": "E04",
      "group": "FINANCEIRO",
      "kind": "pagar",
      "area": "Contas a pagar",
      "route": "/erp/financeiro/e04-t04",
      "role": "tesouraria",
      "fields": "conta pagadora, títulos aptos, banco, destinatário, limites, saldo projetado",
      "actions": "agendar, submeter dupla aprovação, transmitir API quando habilitada, consultar retorno",
      "rules": "nunca considerar pago antes da confirmação bancária; autorização em duas etapas",
      "exceptions": "saldo insuficiente, API indisponível, pagamento rejeitado",
      "source": "Caderno B §E04-T04"
    },
    {
      "id": "E04-T05",
      "title": "Devoluções, abatimentos e créditos",
      "epic": "E04",
      "group": "FINANCEIRO",
      "kind": "pagar",
      "area": "Contas a pagar",
      "route": "/erp/financeiro/e04-t05",
      "role": "Karina",
      "fields": "NF original, reclamação, acordo, documento emitido, abatimento aprovado",
      "actions": "relacionar crédito, abater parcial, estornar, reconciliar DDA",
      "rules": "não baixar valor de fornecedor apenas por peso divergente",
      "exceptions": "DDA não reflete abatimento, autorização não recebida",
      "source": "Caderno B §E04-T05"
    },
    {
      "id": "E05-T01",
      "title": "Painel contas a receber",
      "epic": "E05",
      "group": "FINANCEIRO",
      "kind": "receber",
      "area": "Contas a receber",
      "route": "/erp/financeiro/e05-t01",
      "role": "financeiro/comercial consulta",
      "fields": "cliente, documento fiscal autorizado, parcela, valor, vencimento, saldo, cobrança",
      "actions": "listar, buscar, notificar, abrir aging, classificar atraso",
      "rules": "reconhecer AR por documento/evidência de faturamento sem duplicidade",
      "exceptions": "NF-e cancelada, crédito devolvido, cliente inadimplente",
      "source": "Caderno B §E05-T01"
    },
    {
      "id": "E05-T02",
      "title": "Faturamento financeiro e parcelamento",
      "epic": "E05",
      "group": "FINANCEIRO",
      "kind": "receber",
      "area": "Contas a receber",
      "route": "/erp/financeiro/e05-t02",
      "role": "faturamento/financeiro",
      "fields": "NF-e, pedidos, condições negociadas, vencimentos, juros, descontos autorizados",
      "actions": "gerar títulos, parcelar, revisar, emitir cobrança por banco",
      "rules": "total de parcelas reconcilia ao valor devido; preço após expedição imutável sem evento",
      "exceptions": "parcelas inconsistentes, prazos divergentes",
      "source": "Caderno B §E05-T02"
    },
    {
      "id": "E05-T03",
      "title": "Central de cobrança",
      "epic": "E05",
      "group": "FINANCEIRO",
      "kind": "receber",
      "area": "Contas a receber",
      "route": "/erp/financeiro/e05-t03",
      "role": "financeiro",
      "fields": "banco/conta, nosso número, documento, linha digitável, código barras, status registro",
      "actions": "registrar boleto, consultar, cancelar/alterar conforme capability, reenviar link",
      "rules": "somente boleto registrado realmente é cobrança ativa; evitar cobrança duplicada",
      "exceptions": "registro pendente, convênio não habilitado, webhook atrasado",
      "source": "Caderno B §E05-T03"
    },
    {
      "id": "E05-T04",
      "title": "Inadimplência e renegociação",
      "epic": "E05",
      "group": "FINANCEIRO",
      "kind": "receber",
      "area": "Contas a receber",
      "route": "/erp/financeiro/e05-t04",
      "role": "cobrança/gestão",
      "fields": "cliente, títulos, históricos, acordos, desconto, encargos, status",
      "actions": "negociar com autorização, formalizar acordo, reprogramar vencimentos",
      "rules": "não apagar original; crédito e saldo continuam rastreáveis",
      "exceptions": "baixa parcial, contestação, desconto fora alçada",
      "source": "Caderno B §E05-T04"
    },
    {
      "id": "E06-T01",
      "title": "Contas bancárias, convênios e capacidades",
      "epic": "E06",
      "group": "BANCOS & TESOURARIA",
      "kind": "banco",
      "area": "APIs bancárias",
      "route": "/erp/bancos/e06-t01",
      "role": "admin bancário",
      "fields": "banco, agência/conta mascaradas, carteira, convênio, scopes, mTLS, OAuth, secrets refs",
      "actions": "cadastrar banco, solicitar homologação, habilitar capability por conta, testar conectividade",
      "rules": "capability não é presumida; credencial armazenada no cofre, jamais no UI",
      "exceptions": "convênio ausente, cert vencido, API só disponível em ambiente diferente",
      "source": "Caderno B §E06-T01"
    },
    {
      "id": "E06-T02",
      "title": "Monitor cobrança multi-banco",
      "epic": "E06",
      "group": "BANCOS & TESOURARIA",
      "kind": "banco",
      "area": "APIs bancárias",
      "route": "/erp/bancos/e06-t02",
      "role": "tesouraria",
      "fields": "operação, externalId, nosso número, status, webhook, reconsulta",
      "actions": "registrar, consultar, cancelar/alterar, sincronizar evento, recuperar erro",
      "rules": "idempotência por banco/conta/operação/payload; reconciliação ativa de timeout",
      "exceptions": "409 idempotência, 429, webhook duplicado, retorno fora de ordem",
      "source": "Caderno B §E06-T02"
    },
    {
      "id": "E06-T03",
      "title": "Hub extratos, saldos e DDA",
      "epic": "E06",
      "group": "BANCOS & TESOURARIA",
      "kind": "banco",
      "area": "APIs bancárias",
      "route": "/erp/bancos/e06-t03",
      "role": "tesouraria",
      "fields": "data e período, transactionId, valor, descrição, vencimento, beneficiário, banco",
      "actions": "consultar extratos/saldos, puxar títulos DDA quando disponível, agendar sincronismo",
      "rules": "acesso autorizado, sem inventar endpoint DDA/baixa automática",
      "exceptions": "capability indisponível, lacuna de movimentos, rate limit",
      "source": "Caderno B §E06-T03"
    },
    {
      "id": "E06-T04",
      "title": "Fila de pagamentos bancários",
      "epic": "E06",
      "group": "BANCOS & TESOURARIA",
      "kind": "banco",
      "area": "APIs bancárias",
      "route": "/erp/bancos/e06-t04",
      "role": "tesouraria",
      "fields": "instrução, assinatura, aprovadores, comprovante, status banco",
      "actions": "enviar ordem, acompanhar, cancelar se permitido, anexar comprovante",
      "rules": "não transmitir sem permissão e dupla aprovação; estado final depende do banco",
      "exceptions": "retorno desconhecido, falha de autenticação, saldo insuficiente",
      "source": "Caderno B §E06-T04"
    },
    {
      "id": "E06-T05",
      "title": "Console operacional APIs",
      "epic": "E06",
      "group": "BANCOS & TESOURARIA",
      "kind": "banco",
      "area": "APIs bancárias",
      "route": "/erp/bancos/e06-t05",
      "role": "admin técnico",
      "fields": "monitoramento por banco, health, retry, audit trail, DLQ, credencial vencendo",
      "actions": "consultar incidentes, reprocessar com idempotência, suspender conta",
      "rules": "segredos redigidos, mTLS, rate limit e backoff por contrato homologado",
      "exceptions": "indisponibilidade, divergência de payload por versão",
      "source": "Caderno B §E06-T05"
    },
    {
      "id": "E07-T01",
      "title": "Painel conciliação por conta/período",
      "epic": "E07",
      "group": "BANCOS & TESOURARIA",
      "kind": "conciliacao",
      "area": "Conciliação bancária",
      "route": "/erp/bancos/e07-t01",
      "role": "Karina/tesouraria",
      "fields": "extrato consolidado, títulos AP/AR, pagamentos, recebimentos, tarifas, pendências",
      "actions": "sincronizar, comparar, filtrar conciliados/não conciliados, fechar sessão",
      "rules": "um lançamento de extrato não pode liquidar duas obrigações salvo rateio explícito",
      "exceptions": "mesmo valor várias vezes, informações incompletas",
      "source": "Caderno B §E07-T01"
    },
    {
      "id": "E07-T02",
      "title": "Motor de sugestões e matching",
      "epic": "E07",
      "group": "BANCOS & TESOURARIA",
      "kind": "conciliacao",
      "area": "Conciliação bancária",
      "route": "/erp/bancos/e07-t02",
      "role": "tesouraria",
      "fields": "banco, txId, nosso número, cliente, valor, data, documento e confiança",
      "actions": "gerar matches determinísticos, exibir explicação, conciliar manualmente, desfazer",
      "rules": "auto-conciliação somente para chave forte + valor/competência compatíveis; resto revisão",
      "exceptions": "pagamento parcial, tarifa, chargeback, duplicidade",
      "source": "Caderno B §E07-T02"
    },
    {
      "id": "E07-T03",
      "title": "Baixas e estornos financeiros",
      "epic": "E07",
      "group": "BANCOS & TESOURARIA",
      "kind": "conciliacao",
      "area": "Conciliação bancária",
      "route": "/erp/bancos/e07-t03",
      "role": "financeiro com alçada",
      "fields": "títulos, alocações, diferença, encargos, conta, momento e autorização",
      "actions": "confirmar baixa total/parcial, contabilizar tarifa e desconto, estornar com motivo",
      "rules": "saldo não pode ficar negativo; estorno não exclui baixa histórica",
      "exceptions": "arquivo de banco retroativo, pagamento devolvido",
      "source": "Caderno B §E07-T03"
    },
    {
      "id": "E07-T04",
      "title": "Fechamento da conciliação",
      "epic": "E07",
      "group": "BANCOS & TESOURARIA",
      "kind": "conciliacao",
      "area": "Conciliação bancária",
      "route": "/erp/bancos/e07-t04",
      "role": "controladoria",
      "fields": "período, saldo abertura, créditos/débitos, saldo final, reconciliações e discrepâncias",
      "actions": "submeter conferência, aprovar fechamento, reabrir mediante trilha",
      "rules": "saldo conciliado deve bater com extrato disponível e razão tesouraria",
      "exceptions": "movimento tardio, ajuste contábil posterior",
      "source": "Caderno B §E07-T04"
    },
    {
      "id": "E08-T01",
      "title": "Posição bancária e de caixa",
      "epic": "E08",
      "group": "BANCOS & TESOURARIA",
      "kind": "tesouraria",
      "area": "Tesouraria",
      "route": "/erp/bancos/e08-t01",
      "role": "Karina",
      "fields": "contas, saldos bancários, pendências, saldos conciliados, reservas e exposição",
      "actions": "atualizar, consultar origem, comparar saldos e extratos",
      "rules": "saldo bancário informado pela API versus saldo contábil exibidos separadamente",
      "exceptions": "API sem extrato ou saldo em tempo real",
      "source": "Caderno B §E08-T01"
    },
    {
      "id": "E08-T02",
      "title": "Fluxo de caixa previsto/realizado",
      "epic": "E08",
      "group": "BANCOS & TESOURARIA",
      "kind": "tesouraria",
      "area": "Tesouraria",
      "route": "/erp/bancos/e08-t02",
      "role": "gestão/financeiro",
      "fields": "entradas AR, saídas AP, despesas, parcelas, contas, datas, cenário",
      "actions": "simular período, filtrar conta, visualizar projeção, exportar",
      "rules": "projetado nunca misturar com realizado; data efetiva de liquidação",
      "exceptions": "atrasos, pagamentos parciais e novos compromissos",
      "source": "Caderno B §E08-T02"
    },
    {
      "id": "E08-T03",
      "title": "Aplicações, tarifas e transferências",
      "epic": "E08",
      "group": "BANCOS & TESOURARIA",
      "kind": "tesouraria",
      "area": "Tesouraria",
      "route": "/erp/bancos/e08-t03",
      "role": "tesouraria/contador",
      "fields": "conta origem/destino, operação bancária, rendimento, taxa, categoria, tributos",
      "actions": "registrar aplicação/resgate, conciliar, reconhecer encargo e transferência",
      "rules": "transferências não duplicam receita/despesa; cada perna conciliada",
      "exceptions": "tarifa automática, estorno e data de liquidação",
      "source": "Caderno B §E08-T03"
    },
    {
      "id": "E08-T04",
      "title": "Painel de risco de liquidez",
      "epic": "E08",
      "group": "BANCOS & TESOURARIA",
      "kind": "tesouraria",
      "area": "Tesouraria",
      "route": "/erp/bancos/e08-t04",
      "role": "diretoria",
      "fields": "saldo mínimo, contas a vencer, caixa disponível, alertas, concentração",
      "actions": "configurar alertas, visualizar janelas e compromissos",
      "rules": "alerta não é aprovação de crédito nem execução automática",
      "exceptions": "falta de saldo, previsão incerta",
      "source": "Caderno B §E08-T04"
    },
    {
      "id": "E09-T01",
      "title": "Plano de contas e centros de custo",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t01",
      "role": "contador/controladoria",
      "fields": "conta sintética/analítica, código, natureza, grupo, validade, centro custo",
      "actions": "criar, versionar, aprovar, bloquear conta e mapear lançamentos",
      "rules": "partida dobrada, níveis hierárquicos válidos, competência obrigatória",
      "exceptions": "conta desativada, mudança de classificação após fechamento",
      "source": "Caderno B §E09-T01"
    },
    {
      "id": "E09-T02",
      "title": "Políticas de contabilização",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t02",
      "role": "contador",
      "fields": "evento fonte, regra débito/crédito, centro custo, imposto, versão e data",
      "actions": "configurar mappings, simular evento, aprovar regra",
      "rules": "origem imutável, não lançar sem mapeamento correto, balanceamento exato",
      "exceptions": "mapeamento ausente, evento duplicado",
      "source": "Caderno B §E09-T02"
    },
    {
      "id": "E09-T03",
      "title": "Diário, razão e lançamentos",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t03",
      "role": "contador",
      "fields": "data, competência, origem, linhas débitos/créditos, valor, histórico, usuário",
      "actions": "consultar, lançar ajuste, estornar, anexar suporte, exportar",
      "rules": "deve haver soma débitos=soma créditos; não editar lançamento postado",
      "exceptions": "período encerrado, documento cancelado",
      "source": "Caderno B §E09-T03"
    },
    {
      "id": "E09-T04",
      "title": "Balancete, DRE e balanço",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t04",
      "role": "contador/diretoria",
      "fields": "período, plano contas, saldos, agrupamento, comparativo, centro custo",
      "actions": "gerar, detalhar contas, comparar, exportar",
      "rules": "reconciliar saldos com razão e critérios de competência",
      "exceptions": "saldo patrimonial incompatível, mapeamento incorreto",
      "source": "Caderno B §E09-T04"
    },
    {
      "id": "E09-T05",
      "title": "Apuração fiscal por competência",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t05",
      "role": "contador/fiscal",
      "fields": "ICMS débitos/créditos, benefícios, IPI/PIS/COFINS, IBS/CBS/IS, IRPJ/CSLL e ajustes",
      "actions": "apurar, simular, revisar, aprovar, emitir memória, contabilizar impostos",
      "rules": "apuração depende regime, norma vigente e validação do responsável habilitado",
      "exceptions": "base divergente, tributo sem documentação, mudança legal",
      "source": "Caderno B §E09-T05"
    },
    {
      "id": "E09-T06",
      "title": "Inventário contábil/CMV",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t06",
      "role": "controladoria",
      "fields": "entradas, saídas, desossa, perdas, produtos, custo por lote, critério método",
      "actions": "fechar período, reconciliar físico, fiscal e razão, aprovar ajuste",
      "rules": "método custo e avaliação fixados por política contábil, com histórico",
      "exceptions": "diferenças físicas e devoluções tardias",
      "source": "Caderno B §E09-T06"
    },
    {
      "id": "E09-T07",
      "title": "Obrigações acessórias SPED",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t07",
      "role": "contador",
      "fields": "empresa, período, layout, arquivo ECD/ECF/EFD, regras, erros, recibo",
      "actions": "gerar conforme obrigatoriedade, validar, revisar, assinar/transmitir apenas com credenciais e processo aprovado",
      "rules": "não alegar conformidade por gerar arquivo; homologação PVA/validador é gate externo",
      "exceptions": "registro obrigatório ausente, versão de layout nova",
      "source": "Caderno B §E09-T07"
    },
    {
      "id": "E09-T08",
      "title": "Fechamento e reabertura de períodos",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t08",
      "role": "contador/controller",
      "fields": "período, módulos reconciliados, pendências, aprovação, hash",
      "actions": "pré-fechar, validar balanço, fechar, emitir relatório, reabrir com alçada",
      "rules": "período fechado só altera por lançamento de ajuste/estorno e reabertura auditada",
      "exceptions": "movimento bancário tardio, NF-e retroativa",
      "source": "Caderno B §E09-T08"
    },
    {
      "id": "E09-T09",
      "title": "Relatórios e exportação contábil",
      "epic": "E09",
      "group": "CONTABILIDADE",
      "kind": "contabilidade",
      "area": "Contabilidade e SPED",
      "route": "/erp/contabilidade/e09-t09",
      "role": "contador/auditoria",
      "fields": "filtros, lançamentos, contas, tributos, comprovantes e trilhas",
      "actions": "exportar CSV/XLSX/layout contábil homologado, agendar relatórios",
      "rules": "auditoria e máscara de dados; totais conciliados",
      "exceptions": "layout exportação do escritório desconhecido",
      "source": "Caderno B §E09-T09"
    },
    {
      "id": "E10-T01",
      "title": "Adaptação de pré-faturamento para SEFAZ",
      "epic": "E10",
      "group": "FATURAMENTO",
      "kind": "operacao",
      "area": "Integração operacional",
      "route": "/erp/operacao/e10-t01",
      "role": "faturamento",
      "fields": "dados reais de expedição, preço Onda14, peso, tributos, NFe chave e bloqueios",
      "actions": "substituir ação de emissão NFS-e para mercadorias, abrir prévia NF-e",
      "rules": "não alterar fluxo operacional/estoque já aprovado; EISS não é autorização mercadoria",
      "exceptions": "carga parcial, estado pendente do SEFAZ",
      "source": "Caderno B §E10-T01"
    },
    {
      "id": "E10-T02",
      "title": "Conferência e ocorrência fiscal no recebimento",
      "epic": "E10",
      "group": "FATURAMENTO",
      "kind": "operacao",
      "area": "Integração operacional",
      "route": "/erp/operacao/e10-t02",
      "role": "recebimento/fiscal",
      "fields": "item comprado, XML fornecedor, peso Richard, preço Fabrício, qualidade",
      "actions": "abrir divergência, criar reclamação e pré-devolução",
      "rules": "ocorrência não vira NF-e nem baixa bancária sem tratamento",
      "exceptions": "item não mapeado, desconto pendente",
      "source": "Caderno B §E10-T02"
    },
    {
      "id": "E10-T03",
      "title": "Checklist de liberação fiscal",
      "epic": "E10",
      "group": "FATURAMENTO",
      "kind": "operacao",
      "area": "Integração operacional",
      "route": "/erp/operacao/e10-t03",
      "role": "expedição/logística",
      "fields": "placa, motorista, pedido, carga, NF-e autorizada, seguro e documento",
      "actions": "mostrar bloqueios, emitir alerta, liberar após gates",
      "rules": "sem NF-e autorizada e outros requisitos não libera carga normal",
      "exceptions": "contingência quando legalmente admitida",
      "source": "Caderno B §E10-T03"
    },
    {
      "id": "E10-T04",
      "title": "Menus, perfis e auditoria ERP",
      "epic": "E10",
      "group": "FATURAMENTO",
      "kind": "operacao",
      "area": "Integração operacional",
      "route": "/erp/operacao/e10-t04",
      "role": "admin",
      "fields": "telas financeiras/fiscais por perfil, permissões por ação e segregação",
      "actions": "criar grupos UI aprovados e trilha end-to-end",
      "rules": "não quebrar menu canônico sem aditamento/protótipo e Quality Owner",
      "exceptions": "telas sem referência visual; aprovações conflitantes",
      "source": "Caderno B §E10-T04"
    },
    {
      "id": "E11-V01",
      "title": "Caixa de Entrada de Arquivos",
      "epic": "E11",
      "group": "BANCOS & TESOURARIA",
      "kind": "bank_file",
      "area": "Arquivos • entrada",
      "route": "/erp/bancos/e11-v01",
      "role": "tesouraria e auditoria",
      "fields": "Banco, conta mascarada, convênio, serviço, formato CNAB 240/400, OFX ou CSV, versão layout, nome, tamanho, SHA256, situação, responsável, recebimento",
      "actions": "importar arquivo, identificar formato pelo cabeçalho, pré-validar, classificar e acompanhar lote",
      "rules": "nunca baixar títulos apenas por importar um arquivo; lote idempotente, com status de quarentena",
      "exceptions": "arquivo de outro convênio, extensão inválida, arquivo duplicado, hash conflitante",
      "source": "E11 especificação §4"
    },
    {
      "id": "E11-V02",
      "title": "Prévia, Validação e Aprovação do Lote",
      "epic": "E11",
      "group": "BANCOS & TESOURARIA",
      "kind": "bank_file",
      "area": "Arquivos • validação",
      "route": "/erp/bancos/e11-v02",
      "role": "tesouraria e auditoria",
      "fields": "Instituição, conta, formato, serviço, versão, header, trailer, total de linhas, total créditos, total débitos, saldos, erros por linha, lote",
      "actions": "comparar header e trailer, validar somatórios, aprovar lote, rejeitar com motivo, baixar relatório de inconsistências",
      "rules": "somente lote validado e revisado alimenta observações canônicas; remessa gerada não significa enviada",
      "exceptions": "conta divergente, soma inconsistente, linha truncada, layout desatualizado",
      "source": "E11 especificação §4"
    },
    {
      "id": "E11-V03",
      "title": "Conflitos entre API e Arquivos",
      "epic": "E11",
      "group": "BANCOS & TESOURARIA",
      "kind": "bank_file",
      "area": "Arquivos • conflitos",
      "route": "/erp/bancos/e11-v03",
      "role": "tesouraria e auditoria",
      "fields": "transação canônica, origem API/webhook/CNAB/OFX/CSV, chave bancária, valor, data efetiva, banco, nosso número, evidências",
      "actions": "comparar observações, sugerir correspondência, solicitar revisão, confirmar ou rejeitar conciliação",
      "rules": "mesma transação pode ter várias observações; valor/data isolados nunca justificam baixa",
      "exceptions": "identificador ausente, mesmo valor em transações distintas, retorno e extrato de datas diferentes",
      "source": "E11 especificação §4"
    },
    {
      "id": "E11-V04",
      "title": "Proveniência e Linha do Tempo Bancária",
      "epic": "E11",
      "group": "BANCOS & TESOURARIA",
      "kind": "bank_file",
      "area": "Arquivos • proveniência",
      "route": "/erp/bancos/e11-v04",
      "role": "tesouraria e auditoria",
      "fields": "identificador transação, banco/conta, ID externo, hash arquivo, lotes, eventos API, webhook, origens, usuários, data/hora",
      "actions": "navegar evidências originais, consultar decisões, reverter alocação com justificativa",
      "rules": "proveniência append-only, não eliminar registros ao ocorrer falha ou correção",
      "exceptions": "duas fontes discordam, arquivo substituído, correção de retorno D+1",
      "source": "E11 especificação §4"
    },
    {
      "id": "E11-V05",
      "title": "Saúde dos Canais e Fallback",
      "epic": "E11",
      "group": "BANCOS & TESOURARIA",
      "kind": "bank_file",
      "area": "Arquivos • continuidade",
      "route": "/erp/bancos/e11-v05",
      "role": "tesouraria e auditoria",
      "fields": "banco/conta/serviço, API disponível, formato de contingência homologado, último sucesso, falhas, modo, aprovador, próximo sync",
      "actions": "habilitar fallback controlado, suspender, executar sincronização, reativar API, consultar checkpoint",
      "rules": "API preferencial, arquivo contingência; não reenviar pagamento após timeout sem consulta",
      "exceptions": "API fora, layout não homologado, falha temporária, período sobreposto",
      "source": "E11 especificação §4"
    },
    {
      "id": "E12-V01",
      "title": "Catálogo de Integrações",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "admin_integration",
      "area": "Integrações • catálogo",
      "route": "/admin/integracoes/e12-v01",
      "role": "administrador e responsável de integração",
      "fields": "provedor, serviço, empresa/CNPJ, estabelecimento, ambiente, endpoint, versão, certificados, capacidade, status, responsável",
      "actions": "criar perfil, associar serviço, testar conexão sem efeitos externos, solicitar ativação, aprovar e suspender",
      "rules": "configuração versionada em PostgreSQL; segregação HML/PROD e aprovação de produção",
      "exceptions": "endpoint não autorizado, credencial ausente, usuário sem permissão, dois perfis PROD ativos",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V02",
      "title": "Certificados Digitais e Rotação",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "certificate",
      "area": "Integrações • certificados",
      "route": "/admin/integracoes/e12-v02",
      "role": "administrador e responsável de integração",
      "fields": "empresa, estabelecimento, finalidade, ambiente, PFX/P12 ou CRT+KEY, senha transitória, emissor, titular/CNPJ, SHA256, cadeia, validade",
      "actions": "fazer upload, validar certificado, testar assinatura ou mTLS, associar a perfil, substituir, revogar e programar alertas",
      "rules": "chave privada criptografada no PostgreSQL sob envelope AES-256-GCM e KMS externo; senha PFX jamais persistida",
      "exceptions": "senha incorreta, chave/cert incompatíveis, certificado expirado, CNPJ divergente, revogação, A3 não compatível",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V03",
      "title": "Aplicações Bancárias e Credenciais",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "admin_integration",
      "area": "Integrações • bancos",
      "route": "/admin/integracoes/e12-v03",
      "role": "administrador e responsável de integração",
      "fields": "Bradesco/Itaú/Santander, CNPJ titular, conta, carteira, convênio, app ID, client ID, secrets write-only, escopos, certificados mTLS, webhook",
      "actions": "cadastrar aplicações por ambiente/serviço, importar credencial, gerar CSR se permitido, testar token, homologar e suspender",
      "rules": "OAuth/mTLS conforme banco habilitado; secrets criptografados; nunca preencher secret existente no GET",
      "exceptions": "contrato não disponível, certificado vencido, CA trocada, scope insuficiente, API limitada por convênio",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V04",
      "title": "Configuração Fiscal e SEFAZ",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "admin_integration",
      "area": "Integrações • fiscal",
      "route": "/admin/integracoes/e12-v04",
      "role": "administrador e responsável de integração",
      "fields": "empresa e estabelecimento, IE, CRT, série, número, ambiente, status credenciamento, endpoints NF-e e DF-e, certificado e teste",
      "actions": "configurar emitente, homologar status, consultar, simular XSD, habilitar credenciamento comprovado",
      "rules": "URL aprovada por serviço e ambiente, não habilitar PROD sem certificado e parecer",
      "exceptions": "sem credenciamento, IE incorreta, certificado de outro CNPJ, XSD incompatível",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V05",
      "title": "Catálogos Oficiais e Versões",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "dataset",
      "area": "Integrações • referências",
      "route": "/admin/integracoes/e12-v05",
      "role": "administrador e responsável de integração",
      "fields": "fonte oficial, norma, NT, XSD, layout bancário, versão, data de publicação, vigência, hash, diff, situação",
      "actions": "baixar fonte em staging, comparar, validar, aprovar ativação por vigência, consultar histórico",
      "rules": "sem mudança automática de tributação, regra fiscal ou retorno bancário pela simples atualização",
      "exceptions": "XSD NT incompatível, hash divergente, nova regra não aprovada, fonte offline",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V06",
      "title": "Jobs Batch e Histórico de Execução",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "job",
      "area": "Integrações • processamento",
      "route": "/admin/integracoes/e12-v06",
      "role": "administrador e responsável de integração",
      "fields": "provedor, serviço, agendamento, fuso, job, checkpoint, versão cert, status, tentativas, worker, run ID, resultado, erro",
      "actions": "criar/pausar/agendar job, executar agora, inspecionar log, reprocessar sob aprovação, alterar checkpoint com trilha",
      "rules": "sem sessão de usuário e sem .env de integração; lease/fencing, idempotência, retry e auditoria",
      "exceptions": "falha SEFAZ, NSU duplicado, rate limit, credencial expirada, lote pendente de revisão",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    },
    {
      "id": "E12-V07",
      "title": "Monitoramento e Alertas de Integrações",
      "epic": "E12",
      "group": "ADMINISTRAÇÃO",
      "kind": "monitor",
      "area": "Integrações • saúde",
      "route": "/admin/integracoes/e12-v07",
      "role": "administrador e responsável de integração",
      "fields": "certificados a 60/30/15/7 dias, API status, última execução, falhas WS, incidentes, filas, webhook, versão, provedor",
      "actions": "inspecionar evento, reconhecer alerta, pausar integração, consultar reprocessamento, emitir relatório",
      "rules": "segredo nunca aparece em log; alarme rastreável e sem sucesso falso",
      "exceptions": "cert vencido, API indisponível, falha webhook, layout fora vigência, job parado",
      "source": "E12 arquitetura §3 e Caderno B §4-B"
    }
  ],
  "homeRoutes": {
    "FISCAL": "E02-T02",
    "FINANCEIRO": "E04-T01",
    "BANCOS & TESOURARIA": "E07-T01",
    "CONTABILIDADE": "E09-T03",
    "ADMINISTRAÇÃO": "E12-V01"
  },
  "epics": {
    "E01": [
      "FISCAL",
      "regras",
      "Motor tributário",
      "fiscal"
    ],
    "E02": [
      "FISCAL",
      "nfe",
      "NF-e SEFAZ/SP",
      "fiscal"
    ],
    "E03": [
      "FISCAL",
      "entrada",
      "Documentos de entrada",
      "fiscal"
    ],
    "E04": [
      "FINANCEIRO",
      "pagar",
      "Contas a pagar",
      "financeiro"
    ],
    "E05": [
      "FINANCEIRO",
      "receber",
      "Contas a receber",
      "financeiro"
    ],
    "E06": [
      "BANCOS & TESOURARIA",
      "banco",
      "APIs bancárias",
      "bancos"
    ],
    "E07": [
      "BANCOS & TESOURARIA",
      "conciliacao",
      "Conciliação bancária",
      "bancos"
    ],
    "E08": [
      "BANCOS & TESOURARIA",
      "tesouraria",
      "Tesouraria",
      "bancos"
    ],
    "E09": [
      "CONTABILIDADE",
      "contabilidade",
      "Contabilidade e SPED",
      "contabilidade"
    ],
    "E10": [
      "FATURAMENTO",
      "operacao",
      "Integração operacional",
      "operacao"
    ],
    "E11": [
      "BANCOS & TESOURARIA",
      "arquivo",
      "Arquivo e contingência",
      "bancos"
    ],
    "E12": [
      "ADMINISTRAÇÃO",
      "integracao",
      "Central de integrações",
      "admin"
    ]
  },
  "roles": [
    "administrador",
    "gestor",
    "diretoria",
    "fiscal",
    "contador",
    "faturamento",
    "financeiro",
    "tesouraria",
    "comercial",
    "compras",
    "recebimento_pesagem",
    "corte",
    "expedicao",
    "conferente",
    "logistica",
    "auditoria"
  ],
  "statuses": [
    "Pendente de validação",
    "Em revisão",
    "Aprovado",
    "Concluído",
    "Bloqueado",
    "Rejeitado"
  ]
};
