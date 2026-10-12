/* Modelo completo de componentes e fontes de dados. Nunca exibir valores internos na interface. */
window.ALPHA_PROTO_COMPONENTS = {
  "version": "1.0",
  "rules": {
    "hideInternalIds": true,
    "neverFreeTextRelations": true,
    "neverFreeTextEnums": true,
    "approvalsByRBAC": true,
    "designSystem": "DS v3 Direção A",
    "businessCodes": "CFOP, NCM, chave NF-e e número de documento exibidos apenas com contexto e necessidade operacional",
    "relationUX": "Lookup com pesquisa por nome; dependência e opção inativa desabilitada; seleção só de registros existentes e habilitados, IDs internos jamais visíveis.",
    "internalReferences": "IDs presentes apenas na troca API/BD e nos valores de controles; nenhum identificador técnico exibido, copiado ou exportado na UI. Números de notas, CFOP e NSU apenas com contexto de negócio."
  },
  "fields": {
    "empresa": {
      "key": "empresa",
      "label": "Empresa",
      "type": "relation",
      "required": true,
      "source": "empresas",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "razaoSocial": {
      "key": "razaoSocial",
      "label": "Razão social",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "cnpj": {
      "key": "cnpj",
      "label": "CNPJ",
      "type": "document",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "CNPJ alfanumérico",
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "estabelecimento": {
      "key": "estabelecimento",
      "label": "Estabelecimento",
      "type": "relation",
      "required": true,
      "source": "estabelecimentos",
      "dependsOn": [
        "empresa"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "ie": {
      "key": "ie",
      "label": "Inscrição estadual",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "im": {
      "key": "im",
      "label": "Inscrição municipal",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "uf": {
      "key": "uf",
      "label": "Estado",
      "type": "enum",
      "required": true,
      "source": "uf",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "municipio": {
      "key": "municipio",
      "label": "Município",
      "type": "relation",
      "required": true,
      "source": "municipios",
      "dependsOn": [
        "uf"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "cnae": {
      "key": "cnae",
      "label": "Atividade econômica (CNAE)",
      "type": "relation",
      "required": true,
      "source": "cnae",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "crt": {
      "key": "crt",
      "label": "Regime tributário",
      "type": "enum",
      "required": true,
      "source": "crt",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "certificado": {
      "key": "certificado",
      "label": "Certificado vinculado",
      "type": "relation",
      "required": true,
      "source": "certificados",
      "dependsOn": [
        "empresa",
        "ambiente"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "vigenciaInicio": {
      "key": "vigenciaInicio",
      "label": "Início de vigência",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "vigenciaFim": {
      "key": "vigenciaFim",
      "label": "Fim de vigência",
      "type": "date",
      "required": false,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "status": {
      "key": "status",
      "label": "Situação",
      "type": "enum",
      "required": true,
      "source": "status",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "operacao": {
      "key": "operacao",
      "label": "Operação",
      "type": "relation",
      "required": true,
      "source": "operacoes",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "tpNF": {
      "key": "tpNF",
      "label": "Tipo da nota",
      "type": "enum",
      "required": true,
      "source": "tpNF",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "finNFe": {
      "key": "finNFe",
      "label": "Finalidade",
      "type": "enum",
      "required": true,
      "source": "finNFe",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "cfop": {
      "key": "cfop",
      "label": "Operação fiscal (CFOP)",
      "type": "relation",
      "required": true,
      "source": "cfops",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "origemDestino": {
      "key": "origemDestino",
      "label": "Abrangência da operação",
      "type": "enum",
      "required": true,
      "source": "origemDestino",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "tipoProduto": {
      "key": "tipoProduto",
      "label": "Origem do produto",
      "type": "enum",
      "required": true,
      "source": "tipoProduto",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "produto": {
      "key": "produto",
      "label": "Produto",
      "type": "relation",
      "required": true,
      "source": "produtos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "ncm": {
      "key": "ncm",
      "label": "Classificação fiscal (NCM)",
      "type": "relation",
      "required": true,
      "source": "ncm",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "cest": {
      "key": "cest",
      "label": "Substituição tributária (CEST)",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "cliente": {
      "key": "cliente",
      "label": "Cliente",
      "type": "relation",
      "required": true,
      "source": "clientes",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "regraFiscal": {
      "key": "regraFiscal",
      "label": "Enquadramento fiscal",
      "type": "relation",
      "required": true,
      "source": "regrasFiscais",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "icmsCst": {
      "key": "icmsCst",
      "label": "Tratamento ICMS",
      "type": "enum",
      "required": true,
      "source": "icmsCst",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "reducaoBc": {
      "key": "reducaoBc",
      "label": "Redução de base do ICMS (%)",
      "type": "percent",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "0,00%",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "aliquota": {
      "key": "aliquota",
      "label": "Alíquota (%)",
      "type": "percent",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "0,00%",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "cBenef": {
      "key": "cBenef",
      "label": "Benefício fiscal",
      "type": "relation",
      "required": true,
      "source": "cBenef",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "ipiCst": {
      "key": "ipiCst",
      "label": "Tratamento IPI",
      "type": "enum",
      "required": true,
      "source": "ipiCst",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "pisCst": {
      "key": "pisCst",
      "label": "Tratamento PIS/COFINS",
      "type": "enum",
      "required": true,
      "source": "pisCst",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "ibsCst": {
      "key": "ibsCst",
      "label": "Tratamento IBS/CBS",
      "type": "enum",
      "required": true,
      "source": "ibsCst",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "cClassTrib": {
      "key": "cClassTrib",
      "label": "Classificação IBS/CBS",
      "type": "relation",
      "required": true,
      "source": "cClassTrib",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "justificativa": {
      "key": "justificativa",
      "label": "Justificativa auditável",
      "type": "textarea",
      "required": false,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "quantidade": {
      "key": "quantidade",
      "label": "Quantidade",
      "type": "decimal",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "pesoNF": {
      "key": "pesoNF",
      "label": "Peso informado na nota (kg)",
      "type": "decimal",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "valor": {
      "key": "valor",
      "label": "Valor",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "desconto": {
      "key": "desconto",
      "label": "Desconto",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "competencia": {
      "key": "competencia",
      "label": "Competência",
      "type": "month",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "baseCalculo": {
      "key": "baseCalculo",
      "label": "Base tributável (calculada)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "valorLiquido": {
      "key": "valorLiquido",
      "label": "Valor líquido (calculado)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "usuario": {
      "key": "usuario",
      "label": "Usuário",
      "type": "relation",
      "required": true,
      "source": "usuarios",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "aprovador": {
      "key": "aprovador",
      "label": "Responsável pela aprovação",
      "type": "relation",
      "required": true,
      "source": "usuarios",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "descricao": {
      "key": "descricao",
      "label": "Descrição",
      "type": "textarea",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "carga": {
      "key": "carga",
      "label": "Carga",
      "type": "relation",
      "required": true,
      "source": "cargas",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "pedidoVenda": {
      "key": "pedidoVenda",
      "label": "Pedido de venda",
      "type": "relation",
      "required": true,
      "source": "pedidosVenda",
      "dependsOn": [
        "cliente"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "pesoRecebido": {
      "key": "pesoRecebido",
      "label": "Peso conferido (kg)",
      "type": "decimal",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "serie": {
      "key": "serie",
      "label": "Série da NF-e",
      "type": "integer",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "nNF": {
      "key": "nNF",
      "label": "Número da NF-e",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "chaveAcesso": {
      "key": "chaveAcesso",
      "label": "Chave de acesso (documento)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "ambiente": {
      "key": "ambiente",
      "label": "Ambiente",
      "type": "enum",
      "required": true,
      "source": "ambiente",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "protocolo": {
      "key": "protocolo",
      "label": "Protocolo SEFAZ",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "recibo": {
      "key": "recibo",
      "label": "Recibo oficial",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "xmlHash": {
      "key": "xmlHash",
      "label": "Verificação de integridade XML",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "dataEmissao": {
      "key": "dataEmissao",
      "label": "Emissão",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "notaFiscal": {
      "key": "notaFiscal",
      "label": "Nota fiscal",
      "type": "relation",
      "required": true,
      "source": "notas",
      "dependsOn": [
        "estabelecimento"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "notaOrigem": {
      "key": "notaOrigem",
      "label": "Nota fiscal de origem",
      "type": "relation",
      "required": true,
      "source": "notas",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "eventoNFe": {
      "key": "eventoNFe",
      "label": "Evento fiscal",
      "type": "enum",
      "required": true,
      "source": "eventoNFe",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "documentoOrigem": {
      "key": "documentoOrigem",
      "label": "Documento de origem",
      "type": "relation",
      "required": true,
      "source": "documentos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "dataEvento": {
      "key": "dataEvento",
      "label": "Data e hora do evento",
      "type": "datetime",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "integracao": {
      "key": "integracao",
      "label": "Integração vinculada",
      "type": "relation",
      "required": true,
      "source": "integracoes",
      "dependsOn": [
        "provedor",
        "ambiente"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "urlEndpoint": {
      "key": "urlEndpoint",
      "label": "Serviço oficial",
      "type": "approvedEndpoint",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Endpoint deve ser selecionado do cadastro de endpoints oficiais aprovados, nunca URL arbitrária."
    },
    "expiraEm": {
      "key": "expiraEm",
      "label": "Validade do certificado",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "dataset": {
      "key": "dataset",
      "label": "Tabela ou versão oficial",
      "type": "relation",
      "required": true,
      "source": "datasets",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "fornecedor": {
      "key": "fornecedor",
      "label": "Fornecedor",
      "type": "relation",
      "required": true,
      "source": "fornecedores",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "nsu": {
      "key": "nsu",
      "label": "Controle da distribuição (NSU)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "pedidoCompra": {
      "key": "pedidoCompra",
      "label": "Pedido de compra",
      "type": "relation",
      "required": true,
      "source": "pedidosCompra",
      "dependsOn": [
        "fornecedor"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "diferencaPeso": {
      "key": "diferencaPeso",
      "label": "Diferença de peso (calculada)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "ocorrencia": {
      "key": "ocorrencia",
      "label": "Ocorrência relacionada",
      "type": "relation",
      "required": true,
      "source": "ocorrencias",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "motivoDevolucao": {
      "key": "motivoDevolucao",
      "label": "Motivo da devolução",
      "type": "enum",
      "required": true,
      "source": "motivoDevolucao",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "lote": {
      "key": "lote",
      "label": "Lote de produção",
      "type": "relation",
      "required": true,
      "source": "lotes",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "centroCusto": {
      "key": "centroCusto",
      "label": "Centro de custo",
      "type": "relation",
      "required": true,
      "source": "centrosCusto",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "criterioCusto": {
      "key": "criterioCusto",
      "label": "Método de custo",
      "type": "enum",
      "required": true,
      "source": "criterioCusto",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "saldo": {
      "key": "saldo",
      "label": "Saldo",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "tituloPagar": {
      "key": "tituloPagar",
      "label": "Conta a pagar",
      "type": "relation",
      "required": true,
      "source": "titulosPagar",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "valorTitulo": {
      "key": "valorTitulo",
      "label": "Valor da obrigação",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "dataVencimento": {
      "key": "dataVencimento",
      "label": "Vencimento",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "classificacaoDespesa": {
      "key": "classificacaoDespesa",
      "label": "Categoria da despesa",
      "type": "enum",
      "required": true,
      "source": "classificacaoDespesa",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "formaPagamento": {
      "key": "formaPagamento",
      "label": "Meio de pagamento",
      "type": "enum",
      "required": true,
      "source": "formaPagamento",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "juros": {
      "key": "juros",
      "label": "Juros",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "frequencia": {
      "key": "frequencia",
      "label": "Periodicidade",
      "type": "enum",
      "required": true,
      "source": "frequencia",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "contaBancaria": {
      "key": "contaBancaria",
      "label": "Conta bancária",
      "type": "relation",
      "required": true,
      "source": "contasBancarias",
      "dependsOn": [
        "banco",
        "empresa"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "banco": {
      "key": "banco",
      "label": "Banco",
      "type": "relation",
      "required": true,
      "source": "bancos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "dataPagamento": {
      "key": "dataPagamento",
      "label": "Data de confirmação bancária",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "documento": {
      "key": "documento",
      "label": "Documento relacionado",
      "type": "relation",
      "required": false,
      "source": "documentos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "tituloReceber": {
      "key": "tituloReceber",
      "label": "Conta a receber",
      "type": "relation",
      "required": true,
      "source": "titulosReceber",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "taxaJuros": {
      "key": "taxaJuros",
      "label": "Taxa de juros (%)",
      "type": "percent",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "0,00%",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "convenio": {
      "key": "convenio",
      "label": "Convênio bancário",
      "type": "relation",
      "required": true,
      "source": "convenios",
      "dependsOn": [
        "banco",
        "contaBancaria"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "carteira": {
      "key": "carteira",
      "label": "Carteira de cobrança",
      "type": "relation",
      "required": true,
      "source": "carteiras",
      "dependsOn": [
        "convenio"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "nossoNumero": {
      "key": "nossoNumero",
      "label": "Referência de cobrança",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "numeroDocumento": {
      "key": "numeroDocumento",
      "label": "Número do documento",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "externalId": {
      "key": "externalId",
      "label": "Referência fornecida pelo banco",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "servico": {
      "key": "servico",
      "label": "Serviço contratado",
      "type": "relation",
      "required": true,
      "source": "servicos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "fonteEvento": {
      "key": "fonteEvento",
      "label": "Origem do dado",
      "type": "enum",
      "required": true,
      "source": "fonteEvento",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "periodoInicio": {
      "key": "periodoInicio",
      "label": "De",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "periodoFim": {
      "key": "periodoFim",
      "label": "Até",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "transacao": {
      "key": "transacao",
      "label": "Movimentação bancária",
      "type": "relation",
      "required": true,
      "source": "transacoes",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "dataTransacao": {
      "key": "dataTransacao",
      "label": "Data da movimentação",
      "type": "date",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Seletor de data/competência; período e vigência fiscal validados."
    },
    "provedor": {
      "key": "provedor",
      "label": "Instituição ou órgão",
      "type": "relation",
      "required": true,
      "source": "provedores",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "contaContabil": {
      "key": "contaContabil",
      "label": "Conta contábil",
      "type": "relation",
      "required": true,
      "source": "planosConta",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "naturezaConta": {
      "key": "naturezaConta",
      "label": "Natureza da conta",
      "type": "enum",
      "required": true,
      "source": "naturezaConta",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "tipoEvento": {
      "key": "tipoEvento",
      "label": "Tipo de ocorrência",
      "type": "enum",
      "required": true,
      "source": "tipoEvento",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "limiteCredito": {
      "key": "limiteCredito",
      "label": "Reserva mínima desejada",
      "type": "money",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": "R$ #.##0,00",
      "validation": "Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor."
    },
    "contaDebito": {
      "key": "contaDebito",
      "label": "Conta de débito",
      "type": "relation",
      "required": true,
      "source": "planosConta",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "contaCredito": {
      "key": "contaCredito",
      "label": "Conta de crédito",
      "type": "relation",
      "required": true,
      "source": "planosConta",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "tipoTributo": {
      "key": "tipoTributo",
      "label": "Tributo",
      "type": "enum",
      "required": true,
      "source": "tipoTributo",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "tipoLayoutSped": {
      "key": "tipoLayoutSped",
      "label": "Obrigação digital",
      "type": "enum",
      "required": true,
      "source": "tipoLayoutSped",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "arquivo": {
      "key": "arquivo",
      "label": "Arquivo processado",
      "type": "relation",
      "required": true,
      "source": "arquivos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "veiculo": {
      "key": "veiculo",
      "label": "Caminhão",
      "type": "relation",
      "required": true,
      "source": "veiculos",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "motorista": {
      "key": "motorista",
      "label": "Motorista",
      "type": "relation",
      "required": true,
      "source": "motoristas",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "grupoMenu": {
      "key": "grupoMenu",
      "label": "Área do menu",
      "type": "enum",
      "required": true,
      "source": "grupoMenu",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "perfilSistema": {
      "key": "perfilSistema",
      "label": "Perfil",
      "type": "enum",
      "required": true,
      "source": "perfilSistema",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "acaoAprovacao": {
      "key": "acaoAprovacao",
      "label": "Decisão",
      "type": "enum",
      "required": true,
      "source": "acaoAprovacao",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "tipoArquivo": {
      "key": "tipoArquivo",
      "label": "Tipo do arquivo",
      "type": "enum",
      "required": true,
      "source": "tipoArquivo",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "layout": {
      "key": "layout",
      "label": "Modelo de arquivo homologado",
      "type": "relation",
      "required": true,
      "source": "layouts",
      "dependsOn": [
        "banco",
        "servico"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "arquivoUpload": {
      "key": "arquivoUpload",
      "label": "Selecionar arquivo",
      "type": "file",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real."
    },
    "sha256": {
      "key": "sha256",
      "label": "Integridade do arquivo",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "modoFallback": {
      "key": "modoFallback",
      "label": "Modo de operação",
      "type": "enum",
      "required": true,
      "source": "modoFallback",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "tipoServico": {
      "key": "tipoServico",
      "label": "Tipo Servico",
      "type": "enum",
      "required": true,
      "source": "tipoServico",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "finalidadeCert": {
      "key": "finalidadeCert",
      "label": "Finalidade do certificado",
      "type": "enum",
      "required": true,
      "source": "finalidadeCert",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "formatoCert": {
      "key": "formatoCert",
      "label": "Formato do certificado",
      "type": "enum",
      "required": true,
      "source": "formatoCert",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    },
    "certificadoPfx": {
      "key": "certificadoPfx",
      "label": "Enviar certificado digital",
      "type": "file",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real."
    },
    "certificadoPublico": {
      "key": "certificadoPublico",
      "label": "Certificado público",
      "type": "file",
      "required": false,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real."
    },
    "senhaPfx": {
      "key": "senhaPfx",
      "label": "Senha para leitura (temporária)",
      "type": "password",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": true,
      "inputMask": null,
      "validation": "Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício."
    },
    "titularCert": {
      "key": "titularCert",
      "label": "Titular do certificado",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "emisCert": {
      "key": "emisCert",
      "label": "Autoridade certificadora",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "serial": {
      "key": "serial",
      "label": "Série do certificado",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "fingerprint": {
      "key": "fingerprint",
      "label": "Impressão digital do certificado",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "clientId": {
      "key": "clientId",
      "label": "Identificação da aplicação bancária",
      "type": "text",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "clientSecret": {
      "key": "clientSecret",
      "label": "Segredo de autenticação",
      "type": "password",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": true,
      "inputMask": null,
      "validation": "Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício."
    },
    "apiKey": {
      "key": "apiKey",
      "label": "Chave de API",
      "type": "password",
      "required": false,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": true,
      "inputMask": null,
      "validation": "Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício."
    },
    "webhookSecret": {
      "key": "webhookSecret",
      "label": "Segredo das notificações",
      "type": "password",
      "required": false,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": true,
      "inputMask": null,
      "validation": "Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício."
    },
    "callbackUrl": {
      "key": "callbackUrl",
      "label": "Endereço de retorno (gerado)",
      "type": "readOnly",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": true,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual."
    },
    "job": {
      "key": "job",
      "label": "Agendamento",
      "type": "relation",
      "required": true,
      "source": "jobs",
      "dependsOn": [
        "integracao"
      ],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado."
    },
    "cron": {
      "key": "cron",
      "label": "Frequência de execução",
      "type": "cron",
      "required": true,
      "source": null,
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável."
    },
    "timezone": {
      "key": "timezone",
      "label": "Fuso horário",
      "type": "enum",
      "required": true,
      "source": "timezone",
      "dependsOn": [],
      "readOnly": false,
      "writeOnly": false,
      "inputMask": null,
      "validation": "Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre."
    }
  },
  "enums": {
    "ambiente": [
      [
        "HML",
        "Homologação"
      ],
      [
        "PROD",
        "Produção"
      ]
    ],
    "status": [
      [
        "DRAFT",
        "Rascunho"
      ],
      [
        "REVIEW",
        "Aguardando revisão"
      ],
      [
        "APPROVED",
        "Aprovado"
      ],
      [
        "REJECTED",
        "Rejeitado"
      ],
      [
        "SUSPENDED",
        "Suspenso"
      ]
    ],
    "crt": [
      [
        "1",
        "Simples Nacional"
      ],
      [
        "2",
        "Simples Nacional — sublimite"
      ],
      [
        "3",
        "Regime normal"
      ],
      [
        "4",
        "MEI (se aplicável)"
      ]
    ],
    "uf": [
      [
        "SP",
        "São Paulo"
      ],
      [
        "RJ",
        "Rio de Janeiro"
      ],
      [
        "MG",
        "Minas Gerais"
      ],
      [
        "PR",
        "Paraná"
      ]
    ],
    "tpNF": [
      [
        "0",
        "Entrada"
      ],
      [
        "1",
        "Saída"
      ]
    ],
    "finNFe": [
      [
        "1",
        "Operação normal"
      ],
      [
        "2",
        "NF-e complementar"
      ],
      [
        "3",
        "NF-e de ajuste"
      ],
      [
        "4",
        "Devolução"
      ]
    ],
    "tipoProduto": [
      [
        "PROPRIA",
        "Produção própria"
      ],
      [
        "REVENDA",
        "Revenda"
      ],
      [
        "SUB",
        "Subproduto"
      ]
    ],
    "origemDestino": [
      [
        "INTERNA",
        "Dentro do estado"
      ],
      [
        "INTER",
        "Outro estado"
      ],
      [
        "EXT",
        "Exterior"
      ]
    ],
    "icmsCst": [
      [
        "00",
        "Tributação integral"
      ],
      [
        "20",
        "Redução de base"
      ],
      [
        "40",
        "Isenção"
      ],
      [
        "41",
        "Não tributada"
      ],
      [
        "51",
        "Diferimento"
      ]
    ],
    "ipiCst": [
      [
        "51",
        "Saída tributada à alíquota zero"
      ],
      [
        "53",
        "Saída não tributada"
      ],
      [
        "99",
        "Outras saídas"
      ]
    ],
    "pisCst": [
      [
        "01",
        "Tributação normal"
      ],
      [
        "06",
        "Alíquota zero"
      ],
      [
        "08",
        "Sem incidência"
      ],
      [
        "99",
        "Outras operações"
      ]
    ],
    "ibsCst": [
      [
        "000",
        "Tributação integral"
      ],
      [
        "200",
        "Alíquota reduzida"
      ]
    ],
    "naturezaConta": [
      [
        "ATIVO",
        "Ativo"
      ],
      [
        "PASSIVO",
        "Passivo"
      ],
      [
        "RECEITA",
        "Receita"
      ],
      [
        "DESPESA",
        "Despesa"
      ],
      [
        "CUSTO",
        "Custos"
      ]
    ],
    "formaPagamento": [
      [
        "BOLETO",
        "Boleto"
      ],
      [
        "PIX",
        "Pix"
      ],
      [
        "TED",
        "Transferência"
      ],
      [
        "ARQUIVO",
        "Arquivo de remessa contratado"
      ]
    ],
    "classificacaoDespesa": [
      [
        "AGUA",
        "Água e esgoto"
      ],
      [
        "ENERGIA",
        "Energia elétrica"
      ],
      [
        "SERVICO",
        "Serviços"
      ],
      [
        "FOLHA",
        "Folha referenciada"
      ],
      [
        "OUTROS",
        "Outras despesas"
      ]
    ],
    "frequencia": [
      [
        "UNICA",
        "Única"
      ],
      [
        "SEMANAL",
        "Semanal"
      ],
      [
        "MENSAL",
        "Mensal"
      ],
      [
        "ANUAL",
        "Anual"
      ]
    ],
    "fonteEvento": [
      [
        "API",
        "API bancária"
      ],
      [
        "WEBHOOK",
        "Notificação do banco"
      ],
      [
        "CNAB240",
        "Retorno CNAB 240"
      ],
      [
        "CNAB400",
        "Retorno CNAB 400"
      ],
      [
        "OFX",
        "Extrato OFX"
      ],
      [
        "CSV",
        "Arquivo CSV"
      ]
    ],
    "criterioCusto": [
      [
        "MEDIO",
        "Custo médio ponderado"
      ],
      [
        "FIFO",
        "PEPS, se aprovado"
      ],
      [
        "ESPECIFICO",
        "Custo específico por lote"
      ]
    ],
    "tipoTributo": [
      [
        "ICMS",
        "ICMS"
      ],
      [
        "IPI",
        "IPI"
      ],
      [
        "PIS",
        "PIS"
      ],
      [
        "COFINS",
        "COFINS"
      ],
      [
        "IBS",
        "IBS"
      ],
      [
        "CBS",
        "CBS"
      ],
      [
        "IS",
        "Imposto seletivo"
      ]
    ],
    "tipoLayoutSped": [
      [
        "EFD_ICMS_IPI",
        "EFD ICMS/IPI"
      ],
      [
        "EFD_CONTRIB",
        "EFD-Contribuições"
      ],
      [
        "ECD",
        "ECD"
      ],
      [
        "ECF",
        "ECF"
      ]
    ],
    "modoFallback": [
      [
        "API_PREFERRED",
        "API prioritária"
      ],
      [
        "FILE_ALLOWED",
        "Arquivo de contingência"
      ],
      [
        "API_DISABLED",
        "API indisponível"
      ],
      [
        "REVIEW",
        "Revisão manual"
      ]
    ],
    "tipoArquivo": [
      [
        "CNAB240",
        "CNAB 240"
      ],
      [
        "CNAB400",
        "CNAB 400"
      ],
      [
        "OFX",
        "Extrato OFX"
      ],
      [
        "CSV",
        "Extrato CSV"
      ]
    ],
    "tipoServico": [
      [
        "NFE55",
        "NF-e modelo 55"
      ],
      [
        "DFE",
        "Distribuição DF-e"
      ],
      [
        "COBRANCA",
        "Cobrança"
      ],
      [
        "EXTRATO",
        "Extrato"
      ],
      [
        "PAGAMENTOS",
        "Pagamentos"
      ],
      [
        "SPED",
        "SPED"
      ]
    ],
    "finalidadeCert": [
      [
        "NFE_SIGN",
        "Assinatura NF-e"
      ],
      [
        "NFE_MTLS",
        "Autenticação SEFAZ"
      ],
      [
        "BANK_MTLS",
        "Autenticação bancária"
      ],
      [
        "BANK_SIGN",
        "Assinatura bancária"
      ],
      [
        "SPED_SIGN",
        "Assinatura SPED"
      ]
    ],
    "formatoCert": [
      [
        "PFX",
        "PFX / P12"
      ],
      [
        "PEM",
        "PEM com chave privada"
      ],
      [
        "CER",
        "Somente certificado público"
      ]
    ],
    "eventoNFe": [
      [
        "CCE",
        "Carta de correção"
      ],
      [
        "CANCELAMENTO",
        "Cancelamento"
      ],
      [
        "INUTILIZACAO",
        "Inutilização"
      ],
      [
        "CONSULTA",
        "Consulta"
      ]
    ],
    "motivoDevolucao": [
      [
        "AVARIA",
        "Avaria"
      ],
      [
        "DIVERGENCIA",
        "Diferença física"
      ],
      [
        "PRECO",
        "Divergência de preço"
      ],
      [
        "OUTROS",
        "Outro motivo com justificativa"
      ]
    ],
    "tipoEvento": [
      [
        "LIQUIDACAO",
        "Liquidação"
      ],
      [
        "REGISTRO",
        "Registro de cobrança"
      ],
      [
        "CANCELAMENTO",
        "Cancelamento"
      ],
      [
        "ESTORNO",
        "Estorno"
      ],
      [
        "TARIFA",
        "Tarifa"
      ]
    ],
    "grupoMenu": [
      [
        "COMERCIAL",
        "Comercial"
      ],
      [
        "GESTAO",
        "Gestão"
      ],
      [
        "RECEBIMENTO",
        "Recebimento & Balança"
      ],
      [
        "DESOSSA",
        "Desossa"
      ],
      [
        "ESTOQUE",
        "Estoque"
      ],
      [
        "CARGA",
        "Carga"
      ],
      [
        "FATURAMENTO",
        "Faturamento"
      ],
      [
        "FISCAL",
        "Fiscal"
      ],
      [
        "FINANCEIRO",
        "Financeiro"
      ],
      [
        "BANCOS",
        "Bancos & Tesouraria"
      ],
      [
        "CONTABILIDADE",
        "Contabilidade"
      ],
      [
        "CADASTROS",
        "Cadastros & Regras"
      ],
      [
        "ADMIN",
        "Administração"
      ]
    ],
    "perfilSistema": [
      [
        "ADMIN",
        "Administrador"
      ],
      [
        "GESTOR",
        "Gestor"
      ],
      [
        "CONSULTA",
        "Consulta (papel canônico ilustrativo)"
      ]
    ],
    "acaoAprovacao": [
      [
        "APROVAR",
        "Aprovar"
      ],
      [
        "REJEITAR",
        "Rejeitar"
      ],
      [
        "DEVOLVER",
        "Solicitar ajuste"
      ]
    ],
    "timezone": [
      [
        "America/Sao_Paulo",
        "Horário de São Paulo"
      ],
      [
        "UTC",
        "UTC"
      ]
    ]
  },
  "catalogs": {
    "cest": [
      [
        "CEST-A",
        "CEST aplicável ao NCM selecionado (exemplo)",
        "Versão da tabela oficial precisa de aprovação"
      ]
    ],
    "empresas": [
      [
        "A",
        "AlphaCarnes Matriz",
        "Empresa do cenário"
      ],
      [
        "B",
        "AlphaCarnes Filial",
        "Empresa do cenário"
      ]
    ],
    "estabelecimentos": [
      [
        "MAT",
        "Matriz · São Paulo",
        "Estabelecimento demonstração"
      ],
      [
        "FIL",
        "Filial · São Paulo",
        "Estabelecimento demonstração"
      ]
    ],
    "clientes": [
      [
        "C1",
        "Mercado Central",
        "Cliente cadastrado"
      ],
      [
        "C2",
        "Açougue Exemplo",
        "Cliente cadastrado"
      ]
    ],
    "fornecedores": [
      [
        "F1",
        "Frigorífico Modelo",
        "Fornecedor cadastrado"
      ],
      [
        "F2",
        "Distribuidora Exemplo",
        "Fornecedor cadastrado"
      ]
    ],
    "produtos": [
      [
        "P1",
        "Dianteiro bovino",
        "Produto cadastrado"
      ],
      [
        "P2",
        "Paleta bovina",
        "Produto cadastrado"
      ],
      [
        "P3",
        "Sebo bovino",
        "Subproduto cadastrado"
      ]
    ],
    "operacoes": [
      [
        "O1",
        "Compra e venda outubro",
        "Operação"
      ],
      [
        "O2",
        "Devolução vinculada",
        "Operação"
      ]
    ],
    "pedidosVenda": [
      [
        "PV1",
        "Venda para Mercado Central",
        "Pedido de venda"
      ],
      [
        "PV2",
        "Venda para Açougue Exemplo",
        "Pedido de venda"
      ]
    ],
    "pedidosCompra": [
      [
        "PC1",
        "Compra Frigorífico Modelo",
        "Pedido de compra"
      ],
      [
        "PC2",
        "Reposição Distribuidora Exemplo",
        "Pedido de compra"
      ]
    ],
    "cargas": [
      [
        "CG1",
        "Carga para Mercado Central",
        "Aguardando liberação"
      ],
      [
        "CG2",
        "Carga para Açougue Exemplo",
        "Conferida"
      ]
    ],
    "notas": [
      [
        "N1",
        "Venda normal — nota 191948",
        "NF-e histórica de referência"
      ],
      [
        "N2",
        "Devolução de venda — nota 188305",
        "NF-e histórica de referência"
      ],
      [
        "N3",
        "Subprodutos — nota 189504",
        "NF-e histórica de referência"
      ],
      [
        "N4",
        "Devolução de compra — nota 191923",
        "NF-e histórica de referência"
      ]
    ],
    "lotes": [
      [
        "L1",
        "Lote recebido de Frigorífico Modelo",
        "Lote de demonstração"
      ],
      [
        "L2",
        "Lote da desossa de outubro",
        "Lote de demonstração"
      ]
    ],
    "documentos": [
      [
        "D1",
        "XML do fornecedor",
        "Documento de entrada"
      ],
      [
        "D2",
        "Comprovante de conferência",
        "Documento vinculado"
      ]
    ],
    "titulosPagar": [
      [
        "AP1",
        "Parcela a pagar — Frigorífico Modelo",
        "Vencimento 20/10"
      ],
      [
        "AP2",
        "Energia elétrica — outubro",
        "Vencimento 25/10"
      ]
    ],
    "titulosReceber": [
      [
        "AR1",
        "Parcela a receber — Mercado Central",
        "Vencimento 18/10"
      ],
      [
        "AR2",
        "Parcela a receber — Açougue Exemplo",
        "Vencimento 21/10"
      ]
    ],
    "bancos": [
      [
        "237",
        "Bradesco",
        "Instituição"
      ],
      [
        "341",
        "Itaú",
        "Instituição"
      ],
      [
        "033",
        "Santander",
        "Instituição"
      ]
    ],
    "contasBancarias": [
      [
        "B1",
        "Bradesco · Matriz · conta final 5678",
        "Conta empresarial"
      ],
      [
        "B2",
        "Itaú · Matriz · conta final 1200",
        "Conta empresarial"
      ],
      [
        "B3",
        "Santander · Filial · conta final 0099",
        "Conta empresarial"
      ]
    ],
    "convenios": [
      [
        "V1",
        "Cobrança Bradesco — Matriz",
        "Convênio cadastrado"
      ],
      [
        "V2",
        "Cobrança Itaú — Matriz",
        "Convênio cadastrado"
      ],
      [
        "V3",
        "Cobrança Santander — Filial",
        "Convênio cadastrado"
      ]
    ],
    "carteiras": [
      [
        "K1",
        "Cobrança registrada — carteira modelo",
        "Requer validação do convênio"
      ],
      [
        "K2",
        "Cobrança bancária — carteira secundária",
        "Requer homologação"
      ]
    ],
    "certificados": [
      [
        "X1",
        "Certificado A1 da Matriz — validade em dezembro",
        "Certificado fictício"
      ],
      [
        "X2",
        "Certificado mTLS do Itaú — homologação",
        "Certificado fictício"
      ]
    ],
    "integracoes": [
      [
        "I1",
        "NF-e — SEFAZ São Paulo",
        "Homologação"
      ],
      [
        "I2",
        "Distribuição de documentos fiscais",
        "Homologação"
      ],
      [
        "I3",
        "Itaú — Serviços empresariais",
        "Em configuração"
      ]
    ],
    "provedores": [
      [
        "SEF",
        "SEFAZ São Paulo",
        "Órgão fiscal"
      ],
      [
        "DFE",
        "Ambiente Nacional NF-e",
        "Órgão fiscal"
      ],
      [
        "BRA",
        "Bradesco",
        "Banco"
      ],
      [
        "ITA",
        "Itaú",
        "Banco"
      ],
      [
        "SAN",
        "Santander",
        "Banco"
      ],
      [
        "SPE",
        "SPED",
        "Obrigações"
      ]
    ],
    "usuarios": [
      [
        "U1",
        "Analista fiscal",
        "Usuário ativo"
      ],
      [
        "U2",
        "Responsável pela tesouraria",
        "Usuário ativo"
      ],
      [
        "U3",
        "Contador responsável",
        "Usuário ativo"
      ]
    ],
    "centrosCusto": [
      [
        "CT1",
        "Operação industrial",
        "Centro de custo"
      ],
      [
        "CT2",
        "Administrativo",
        "Centro de custo"
      ]
    ],
    "planosConta": [
      [
        "PCA",
        "Caixa e bancos",
        "Ativo"
      ],
      [
        "PCP",
        "Fornecedores a pagar",
        "Passivo"
      ],
      [
        "PCR",
        "Receita operacional",
        "Receita"
      ],
      [
        "PCC",
        "Custo de mercadorias vendidas",
        "Custo"
      ]
    ],
    "regrasFiscais": [
      [
        "RF1",
        "Venda de produção própria — São Paulo",
        "Revisão fiscal pendente"
      ],
      [
        "RF2",
        "Revenda — São Paulo",
        "Revisão fiscal pendente"
      ],
      [
        "RF3",
        "Devolução referenciada",
        "Revisão fiscal pendente"
      ]
    ],
    "cfops": [
      [
        "5101",
        "Venda de produção própria (CFOP 5101)",
        "Tabela fiscal"
      ],
      [
        "5102",
        "Venda de mercadoria de terceiros (CFOP 5102)",
        "Tabela fiscal"
      ],
      [
        "1202",
        "Devolução de venda (CFOP 1202)",
        "Tabela fiscal"
      ],
      [
        "5202",
        "Devolução de compra (CFOP 5202)",
        "Tabela fiscal"
      ]
    ],
    "ncm": [
      [
        "N1",
        "Carnes bovinas — validar NCM específico",
        "Tabela oficial"
      ],
      [
        "N2",
        "Ossos e subprodutos — validar NCM",
        "Tabela oficial"
      ]
    ],
    "cBenef": [
      [
        "SP020450",
        "Redução de base — São Paulo (SP020450)",
        "Elegibilidade a aprovar"
      ],
      [
        "SP020740",
        "Devolução — São Paulo (SP020740)",
        "Elegibilidade a aprovar"
      ],
      [
        "SP020100",
        "Diferimento — São Paulo (SP020100)",
        "Elegibilidade a aprovar"
      ]
    ],
    "cClassTrib": [
      [
        "000001",
        "Tributação integral (000001)",
        "Tabela IBS/CBS"
      ],
      [
        "200003",
        "Redução aplicada (200003)",
        "Tabela IBS/CBS"
      ],
      [
        "200036",
        "Tratamento diferenciado (200036)",
        "Tabela IBS/CBS"
      ]
    ],
    "municipios": [
      [
        "3550308",
        "São Paulo (SP)",
        "Código IBGE"
      ],
      [
        "3534401",
        "Osasco (SP)",
        "Código IBGE"
      ],
      [
        "3504107",
        "Atibaia (SP)",
        "Código IBGE"
      ]
    ],
    "cnae": [
      [
        "C1",
        "Frigoríficos — atividade econômica",
        "Confirmar CNAE"
      ],
      [
        "C2",
        "Comércio de carnes — atividade econômica",
        "Confirmar CNAE"
      ]
    ],
    "servicos": [
      [
        "S1",
        "Autorização NF-e",
        "Fiscal"
      ],
      [
        "S2",
        "Distribuição DF-e",
        "Fiscal"
      ],
      [
        "S3",
        "Cobrança",
        "Banco"
      ],
      [
        "S4",
        "Extrato bancário",
        "Banco"
      ],
      [
        "S5",
        "Pagamentos",
        "Banco"
      ]
    ],
    "layouts": [
      [
        "F1",
        "CNAB 240 — retorno de cobrança",
        "Homologação necessária"
      ],
      [
        "F2",
        "CNAB 400 — cobrança",
        "Homologação necessária"
      ],
      [
        "F3",
        "OFX — extrato",
        "Perfil contratado"
      ],
      [
        "F4",
        "CSV — extrato",
        "Mapeamento aprovado"
      ]
    ],
    "datasets": [
      [
        "DS1",
        "Reforma tributária — NF-e",
        "Versão oficial pendente"
      ],
      [
        "DS2",
        "Benefícios fiscais de São Paulo",
        "Versão oficial pendente"
      ],
      [
        "DS3",
        "Layouts bancários homologados",
        "Versão por banco"
      ]
    ],
    "jobs": [
      [
        "J1",
        "Consulta de documentos fiscais",
        "Agendado"
      ],
      [
        "J2",
        "Consulta de extrato bancário",
        "Agendado"
      ],
      [
        "J3",
        "Alerta de validade de certificado",
        "Agendado"
      ]
    ],
    "arquivos": [
      [
        "AF1",
        "Extrato OFX — demonstração",
        "Sem processamento real"
      ],
      [
        "AF2",
        "Retorno CNAB — demonstração",
        "Sem baixa real"
      ]
    ],
    "transacoes": [
      [
        "TX1",
        "Crédito recebido — Mercado Central",
        "Movimento de demonstração"
      ],
      [
        "TX2",
        "Débito para fornecedor",
        "Movimento de demonstração"
      ]
    ],
    "ocorrencias": [
      [
        "OC1",
        "Divergência de pesagem",
        "Conferência"
      ],
      [
        "OC2",
        "Conflito entre API e arquivo",
        "Tesouraria"
      ]
    ],
    "motoristas": [
      [
        "M1",
        "Motorista de demonstração",
        "Cadastro operacional"
      ]
    ],
    "veiculos": [
      [
        "VE1",
        "Caminhão de demonstração",
        "Cadastro operacional"
      ]
    ]
  },
  "screens": {
    "E01-T01": {
      "id": "E01-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "razaoSocial",
            "cnpj",
            "estabelecimento",
            "ie",
            "im",
            "uf",
            "municipio",
            "cnae",
            "crt",
            "certificado",
            "vigenciaInicio",
            "vigenciaFim",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "estabelecimento",
          "cnpj",
          "crt",
          "uf",
          "status",
          "empresa"
        ],
        "sortable": [
          "estabelecimento",
          "cnpj",
          "crt",
          "uf",
          "empresa"
        ],
        "defaultSort": "estabelecimento",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "estabelecimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E01-T02": {
      "id": "E01-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "operacao",
            "tpNF",
            "finNFe",
            "cfop",
            "origemDestino",
            "tipoProduto",
            "produto",
            "ncm",
            "cest",
            "cliente",
            "vigenciaInicio",
            "vigenciaFim"
          ]
        }
      ],
      "grid": {
        "columns": [
          "operacao",
          "cfop",
          "vigenciaInicio",
          "estabelecimento",
          "tpNF",
          "finNFe"
        ],
        "sortable": [
          "operacao",
          "cfop",
          "vigenciaInicio",
          "estabelecimento",
          "tpNF",
          "finNFe"
        ],
        "defaultSort": "operacao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "cfop",
        "produto",
        "cliente"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E01-T03": {
      "id": "E01-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "regraFiscal",
            "operacao",
            "cfop",
            "icmsCst",
            "reducaoBc",
            "aliquota",
            "cBenef",
            "ipiCst",
            "pisCst",
            "ibsCst",
            "cClassTrib",
            "vigenciaInicio",
            "vigenciaFim"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "regraFiscal",
          "cfop",
          "cBenef",
          "cClassTrib",
          "operacao",
          "icmsCst"
        ],
        "sortable": [
          "regraFiscal",
          "cfop",
          "cBenef",
          "cClassTrib",
          "operacao",
          "icmsCst"
        ],
        "defaultSort": "regraFiscal",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cfop"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E01-T04": {
      "id": "E01-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "operacao",
            "cliente",
            "produto",
            "ncm",
            "quantidade",
            "pesoNF",
            "valor",
            "desconto",
            "competencia",
            "regraFiscal",
            "baseCalculo",
            "valorLiquido"
          ]
        }
      ],
      "grid": {
        "columns": [
          "cliente",
          "produto",
          "valor",
          "valorLiquido",
          "estabelecimento",
          "operacao"
        ],
        "sortable": [
          "cliente",
          "produto",
          "valor",
          "valorLiquido",
          "estabelecimento",
          "operacao"
        ],
        "defaultSort": "cliente",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "cliente",
        "produto",
        "competencia"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E01-T05": {
      "id": "E01-T05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "regraFiscal",
            "usuario",
            "aprovador",
            "descricao",
            "vigenciaInicio",
            "vigenciaFim",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "regraFiscal",
          "vigenciaInicio",
          "status",
          "usuario",
          "aprovador",
          "descricao"
        ],
        "sortable": [
          "regraFiscal",
          "vigenciaInicio",
          "usuario",
          "aprovador",
          "descricao"
        ],
        "defaultSort": "regraFiscal",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E02-T01": {
      "id": "E02-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "carga",
            "pedidoVenda",
            "cliente",
            "estabelecimento",
            "produto",
            "quantidade",
            "pesoRecebido",
            "valor",
            "desconto",
            "regraFiscal",
            "certificado",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "cliente",
          "valor",
          "status",
          "carga",
          "pedidoVenda",
          "estabelecimento"
        ],
        "sortable": [
          "cliente",
          "valor",
          "carga",
          "pedidoVenda",
          "estabelecimento"
        ],
        "defaultSort": "cliente",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "estabelecimento",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Validar pré-condições de emissão",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E02-T02": {
      "id": "E02-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "serie",
            "nNF",
            "chaveAcesso",
            "ambiente",
            "certificado",
            "protocolo",
            "recibo",
            "xmlHash",
            "dataEmissao",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "serie",
          "nNF",
          "dataEmissao",
          "protocolo",
          "status",
          "estabelecimento"
        ],
        "sortable": [
          "serie",
          "nNF",
          "dataEmissao",
          "protocolo",
          "estabelecimento"
        ],
        "defaultSort": "dataEmissao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Validar pré-condições de emissão",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E02-T03": {
      "id": "E02-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "notaFiscal",
            "chaveAcesso",
            "protocolo",
            "recibo",
            "cliente",
            "valor",
            "produto",
            "quantidade",
            "xmlHash",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "notaFiscal",
          "cliente",
          "valor",
          "status",
          "chaveAcesso",
          "protocolo"
        ],
        "sortable": [
          "notaFiscal",
          "cliente",
          "valor",
          "chaveAcesso",
          "protocolo"
        ],
        "defaultSort": "notaFiscal",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Validar pré-condições de emissão",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E02-T04": {
      "id": "E02-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "notaOrigem",
            "eventoNFe",
            "documentoOrigem",
            "certificado",
            "dataEvento",
            "protocolo",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "status",
          "notaOrigem",
          "eventoNFe",
          "documentoOrigem",
          "certificado",
          "dataEvento"
        ],
        "sortable": [
          "notaOrigem",
          "eventoNFe",
          "documentoOrigem",
          "certificado",
          "dataEvento"
        ],
        "defaultSort": "dataEvento",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Validar pré-condições de emissão",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E02-T05": {
      "id": "E02-T05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "ambiente",
            "integracao",
            "urlEndpoint",
            "certificado",
            "expiraEm",
            "serie",
            "dataset",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "integracao",
          "certificado",
          "expiraEm",
          "status",
          "estabelecimento",
          "ambiente"
        ],
        "sortable": [
          "integracao",
          "certificado",
          "expiraEm",
          "estabelecimento",
          "ambiente"
        ],
        "defaultSort": "integracao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Validar pré-condições de emissão",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E03-T01": {
      "id": "E03-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "fornecedor",
            "notaFiscal",
            "nsu",
            "chaveAcesso",
            "serie",
            "cfop",
            "produto",
            "quantidade",
            "pesoNF",
            "valor",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "notaFiscal",
          "fornecedor",
          "produto",
          "pesoNF",
          "status",
          "estabelecimento"
        ],
        "sortable": [
          "notaFiscal",
          "fornecedor",
          "produto",
          "pesoNF",
          "estabelecimento"
        ],
        "defaultSort": "notaFiscal",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "fornecedor",
        "cfop",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E03-T02": {
      "id": "E03-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "pedidoCompra",
            "fornecedor",
            "notaFiscal",
            "produto",
            "quantidade",
            "valor",
            "pesoNF",
            "pesoRecebido",
            "diferencaPeso",
            "ocorrencia",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "pedidoCompra",
          "notaFiscal",
          "pesoNF",
          "pesoRecebido",
          "diferencaPeso",
          "fornecedor"
        ],
        "sortable": [
          "pedidoCompra",
          "notaFiscal",
          "pesoNF",
          "pesoRecebido",
          "diferencaPeso",
          "fornecedor"
        ],
        "defaultSort": "pedidoCompra",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E03-T03": {
      "id": "E03-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "notaOrigem",
            "fornecedor",
            "produto",
            "quantidade",
            "pesoNF",
            "motivoDevolucao",
            "ocorrencia",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "fornecedor",
          "produto",
          "pesoNF",
          "status",
          "notaOrigem",
          "quantidade"
        ],
        "sortable": [
          "fornecedor",
          "produto",
          "pesoNF",
          "notaOrigem",
          "quantidade"
        ],
        "defaultSort": "fornecedor",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E03-T04": {
      "id": "E03-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "lote",
            "produto",
            "pedidoCompra",
            "fornecedor",
            "quantidade",
            "valor",
            "centroCusto",
            "criterioCusto",
            "saldo",
            "competencia"
          ]
        }
      ],
      "grid": {
        "columns": [
          "fornecedor",
          "produto",
          "lote",
          "pedidoCompra",
          "quantidade",
          "valor"
        ],
        "sortable": [
          "fornecedor",
          "produto",
          "lote",
          "pedidoCompra",
          "quantidade",
          "valor"
        ],
        "defaultSort": "fornecedor",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "produto",
        "fornecedor",
        "competencia"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E04-T01": {
      "id": "E04-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "fornecedor",
            "tituloPagar",
            "documentoOrigem",
            "valorTitulo",
            "saldo",
            "dataVencimento",
            "status",
            "classificacaoDespesa",
            "centroCusto"
          ]
        }
      ],
      "grid": {
        "columns": [
          "tituloPagar",
          "fornecedor",
          "valorTitulo",
          "dataVencimento",
          "status",
          "documentoOrigem"
        ],
        "sortable": [
          "tituloPagar",
          "fornecedor",
          "valorTitulo",
          "dataVencimento",
          "documentoOrigem"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "dataVencimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E04-T02": {
      "id": "E04-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "fornecedor",
            "documentoOrigem",
            "valorTitulo",
            "quantidade",
            "dataEmissao",
            "dataVencimento",
            "formaPagamento",
            "juros",
            "desconto",
            "centroCusto"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "fornecedor",
          "valorTitulo",
          "dataVencimento",
          "documentoOrigem",
          "quantidade",
          "dataEmissao"
        ],
        "sortable": [
          "fornecedor",
          "valorTitulo",
          "dataVencimento",
          "documentoOrigem",
          "quantidade",
          "dataEmissao"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "dataVencimento"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E04-T03": {
      "id": "E04-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "fornecedor",
            "classificacaoDespesa",
            "centroCusto",
            "frequencia",
            "competencia",
            "dataVencimento",
            "valor",
            "formaPagamento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "fornecedor",
          "dataVencimento",
          "status",
          "classificacaoDespesa",
          "centroCusto",
          "frequencia"
        ],
        "sortable": [
          "fornecedor",
          "dataVencimento",
          "classificacaoDespesa",
          "centroCusto",
          "frequencia"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "competencia",
        "dataVencimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E04-T04": {
      "id": "E04-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "banco",
            "tituloPagar",
            "valor",
            "dataPagamento",
            "aprovador",
            "formaPagamento",
            "documento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "tituloPagar",
          "contaBancaria",
          "valor",
          "aprovador",
          "status",
          "banco"
        ],
        "sortable": [
          "tituloPagar",
          "contaBancaria",
          "valor",
          "aprovador",
          "banco"
        ],
        "defaultSort": "tituloPagar",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "banco",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E04-T05": {
      "id": "E04-T05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "notaOrigem",
            "fornecedor",
            "ocorrencia",
            "motivoDevolucao",
            "documento",
            "valor",
            "desconto",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "fornecedor",
          "status",
          "notaOrigem",
          "ocorrencia",
          "motivoDevolucao",
          "documento"
        ],
        "sortable": [
          "fornecedor",
          "notaOrigem",
          "ocorrencia",
          "motivoDevolucao",
          "documento"
        ],
        "defaultSort": "fornecedor",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E05-T01": {
      "id": "E05-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "cliente",
            "notaFiscal",
            "tituloReceber",
            "valorTitulo",
            "saldo",
            "dataVencimento",
            "formaPagamento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "tituloReceber",
          "cliente",
          "valorTitulo",
          "dataVencimento",
          "status",
          "notaFiscal"
        ],
        "sortable": [
          "tituloReceber",
          "cliente",
          "valorTitulo",
          "dataVencimento",
          "notaFiscal"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "dataVencimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E05-T02": {
      "id": "E05-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "cliente",
            "notaFiscal",
            "pedidoVenda",
            "valorTitulo",
            "quantidade",
            "dataVencimento",
            "taxaJuros",
            "desconto",
            "formaPagamento",
            "aprovador",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "cliente",
          "valorTitulo",
          "dataVencimento",
          "status",
          "notaFiscal",
          "pedidoVenda"
        ],
        "sortable": [
          "cliente",
          "valorTitulo",
          "dataVencimento",
          "notaFiscal",
          "pedidoVenda"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "dataVencimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E05-T03": {
      "id": "E05-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "convenio",
            "carteira",
            "tituloReceber",
            "notaFiscal",
            "nossoNumero",
            "numeroDocumento",
            "externalId",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "tituloReceber",
          "banco",
          "carteira",
          "nossoNumero",
          "status",
          "contaBancaria"
        ],
        "sortable": [
          "tituloReceber",
          "banco",
          "carteira",
          "nossoNumero",
          "contaBancaria"
        ],
        "defaultSort": "tituloReceber",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E05-T04": {
      "id": "E05-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "cliente",
            "tituloReceber",
            "valor",
            "saldo",
            "dataVencimento",
            "taxaJuros",
            "desconto",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "tituloReceber",
          "cliente",
          "dataVencimento",
          "status",
          "valor",
          "saldo"
        ],
        "sortable": [
          "tituloReceber",
          "cliente",
          "dataVencimento",
          "valor",
          "saldo"
        ],
        "defaultSort": "dataVencimento",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "dataVencimento",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E06-T01": {
      "id": "E06-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "banco",
            "contaBancaria",
            "convenio",
            "carteira",
            "servico",
            "integracao",
            "certificado",
            "ambiente",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "contaBancaria",
          "convenio",
          "servico",
          "status",
          "empresa"
        ],
        "sortable": [
          "banco",
          "contaBancaria",
          "convenio",
          "servico",
          "empresa"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "banco",
        "contaBancaria",
        "servico",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E06-T02": {
      "id": "E06-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "convenio",
            "tituloReceber",
            "nossoNumero",
            "externalId",
            "fonteEvento",
            "dataEvento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "contaBancaria",
          "status",
          "convenio",
          "tituloReceber",
          "nossoNumero"
        ],
        "sortable": [
          "banco",
          "contaBancaria",
          "convenio",
          "tituloReceber",
          "nossoNumero"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E06-T03": {
      "id": "E06-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "periodoInicio",
            "periodoFim",
            "transacao",
            "valor",
            "dataTransacao",
            "fonteEvento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "contaBancaria",
          "status",
          "periodoInicio",
          "periodoFim",
          "transacao"
        ],
        "sortable": [
          "banco",
          "contaBancaria",
          "periodoInicio",
          "periodoFim",
          "transacao"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E06-T04": {
      "id": "E06-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "tituloPagar",
            "valor",
            "dataPagamento",
            "formaPagamento",
            "aprovador",
            "externalId",
            "documento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "status",
          "tituloPagar",
          "valor",
          "dataPagamento",
          "formaPagamento"
        ],
        "sortable": [
          "contaBancaria",
          "tituloPagar",
          "valor",
          "dataPagamento",
          "formaPagamento"
        ],
        "defaultSort": "dataPagamento",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E06-T05": {
      "id": "E06-T05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "provedor",
            "integracao",
            "ambiente",
            "certificado",
            "expiraEm",
            "servico",
            "fonteEvento",
            "dataEvento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "servico",
          "status",
          "provedor",
          "integracao",
          "ambiente",
          "certificado"
        ],
        "sortable": [
          "servico",
          "provedor",
          "integracao",
          "ambiente",
          "certificado"
        ],
        "defaultSort": "servico",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "provedor",
        "servico",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E07-T01": {
      "id": "E07-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "periodoInicio",
            "periodoFim",
            "transacao",
            "tituloPagar",
            "tituloReceber",
            "valor",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "transacao",
          "contaBancaria",
          "valor",
          "status",
          "periodoInicio",
          "periodoFim"
        ],
        "sortable": [
          "transacao",
          "contaBancaria",
          "valor",
          "periodoInicio",
          "periodoFim"
        ],
        "defaultSort": "transacao",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar correspondência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E07-T02": {
      "id": "E07-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "transacao",
            "contaBancaria",
            "tituloPagar",
            "tituloReceber",
            "nossoNumero",
            "valor",
            "dataTransacao",
            "fonteEvento",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "transacao",
          "contaBancaria",
          "valor",
          "status",
          "tituloPagar",
          "tituloReceber"
        ],
        "sortable": [
          "transacao",
          "contaBancaria",
          "valor",
          "tituloPagar",
          "tituloReceber"
        ],
        "defaultSort": "transacao",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar correspondência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E07-T03": {
      "id": "E07-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "transacao",
            "tituloPagar",
            "tituloReceber",
            "contaBancaria",
            "valor",
            "juros",
            "desconto",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "transacao",
          "contaBancaria",
          "valor",
          "status",
          "tituloPagar",
          "tituloReceber"
        ],
        "sortable": [
          "transacao",
          "contaBancaria",
          "valor",
          "tituloPagar",
          "tituloReceber"
        ],
        "defaultSort": "transacao",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar correspondência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E07-T04": {
      "id": "E07-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "periodoInicio",
            "periodoFim",
            "saldo",
            "valor",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "periodoInicio",
          "periodoFim",
          "saldo",
          "status",
          "valor"
        ],
        "sortable": [
          "contaBancaria",
          "periodoInicio",
          "periodoFim",
          "saldo",
          "valor"
        ],
        "defaultSort": "contaBancaria",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar correspondência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E08-T01": {
      "id": "E08-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "periodoInicio",
            "periodoFim",
            "saldo",
            "valor",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "periodoInicio",
          "saldo",
          "valor",
          "status",
          "banco"
        ],
        "sortable": [
          "contaBancaria",
          "periodoInicio",
          "saldo",
          "valor",
          "banco"
        ],
        "defaultSort": "contaBancaria",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E08-T02": {
      "id": "E08-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "periodoInicio",
            "periodoFim",
            "contaBancaria",
            "tituloReceber",
            "tituloPagar",
            "valor",
            "frequencia",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "periodoInicio",
          "valor",
          "status",
          "periodoFim",
          "tituloReceber"
        ],
        "sortable": [
          "contaBancaria",
          "periodoInicio",
          "valor",
          "periodoFim",
          "tituloReceber"
        ],
        "defaultSort": "contaBancaria",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "periodoInicio",
        "periodoFim",
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E08-T03": {
      "id": "E08-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "contaContabil",
            "naturezaConta",
            "valor",
            "juros",
            "tipoEvento",
            "dataTransacao",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "valor",
          "status",
          "contaContabil",
          "naturezaConta",
          "juros"
        ],
        "sortable": [
          "contaBancaria",
          "valor",
          "contaContabil",
          "naturezaConta",
          "juros"
        ],
        "defaultSort": "contaBancaria",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E08-T04": {
      "id": "E08-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaBancaria",
            "periodoInicio",
            "periodoFim",
            "saldo",
            "limiteCredito",
            "tituloPagar",
            "valor",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaBancaria",
          "periodoInicio",
          "saldo",
          "valor",
          "status",
          "periodoFim"
        ],
        "sortable": [
          "contaBancaria",
          "periodoInicio",
          "saldo",
          "valor",
          "periodoFim"
        ],
        "defaultSort": "contaBancaria",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T01": {
      "id": "E09-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaContabil",
            "naturezaConta",
            "centroCusto",
            "vigenciaInicio",
            "vigenciaFim",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaContabil",
          "status",
          "naturezaConta",
          "centroCusto",
          "vigenciaInicio",
          "vigenciaFim"
        ],
        "sortable": [
          "contaContabil",
          "naturezaConta",
          "centroCusto",
          "vigenciaInicio",
          "vigenciaFim"
        ],
        "defaultSort": "contaContabil",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T02": {
      "id": "E09-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaDebito",
            "contaCredito",
            "centroCusto",
            "tipoEvento",
            "competencia",
            "regraFiscal",
            "vigenciaInicio",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "status",
          "contaDebito",
          "contaCredito",
          "centroCusto",
          "tipoEvento"
        ],
        "sortable": [
          "competencia",
          "contaDebito",
          "contaCredito",
          "centroCusto",
          "tipoEvento"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "competencia",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T03": {
      "id": "E09-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "contaDebito",
            "contaCredito",
            "centroCusto",
            "competencia",
            "dataEvento",
            "valor",
            "documentoOrigem",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "valor",
          "status",
          "contaDebito",
          "contaCredito",
          "centroCusto"
        ],
        "sortable": [
          "competencia",
          "valor",
          "contaDebito",
          "contaCredito",
          "centroCusto"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "competencia",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T04": {
      "id": "E09-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "competencia",
            "periodoInicio",
            "periodoFim",
            "centroCusto",
            "contaContabil",
            "valor",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaContabil",
          "competencia",
          "valor",
          "status",
          "periodoInicio",
          "periodoFim"
        ],
        "sortable": [
          "contaContabil",
          "competencia",
          "valor",
          "periodoInicio",
          "periodoFim"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "competencia",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T05": {
      "id": "E09-T05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "competencia",
            "tipoTributo",
            "baseCalculo",
            "aliquota",
            "reducaoBc",
            "cBenef",
            "valor",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "valor",
          "status",
          "estabelecimento",
          "tipoTributo",
          "baseCalculo"
        ],
        "sortable": [
          "competencia",
          "valor",
          "estabelecimento",
          "tipoTributo",
          "baseCalculo"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "competencia",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T06": {
      "id": "E09-T06",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "lote",
            "produto",
            "criterioCusto",
            "quantidade",
            "pesoRecebido",
            "valor",
            "competencia",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "valor",
          "status",
          "estabelecimento",
          "lote",
          "produto"
        ],
        "sortable": [
          "competencia",
          "valor",
          "estabelecimento",
          "lote",
          "produto"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "produto",
        "competencia",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T07": {
      "id": "E09-T07",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "estabelecimento",
            "competencia",
            "tipoLayoutSped",
            "dataset",
            "certificado",
            "arquivo",
            "recibo",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "tipoLayoutSped",
          "arquivo",
          "recibo",
          "status",
          "estabelecimento"
        ],
        "sortable": [
          "competencia",
          "tipoLayoutSped",
          "arquivo",
          "recibo",
          "estabelecimento"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "estabelecimento",
        "competencia",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T08": {
      "id": "E09-T08",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "competencia",
            "periodoInicio",
            "periodoFim",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "competencia",
          "status",
          "periodoInicio",
          "periodoFim",
          "aprovador"
        ],
        "sortable": [
          "competencia",
          "periodoInicio",
          "periodoFim",
          "aprovador"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "competencia",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E09-T09": {
      "id": "E09-T09",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "competencia",
            "periodoInicio",
            "periodoFim",
            "contaContabil",
            "centroCusto",
            "tipoTributo",
            "arquivo",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "contaContabil",
          "competencia",
          "status",
          "periodoInicio",
          "periodoFim",
          "centroCusto"
        ],
        "sortable": [
          "contaContabil",
          "competencia",
          "periodoInicio",
          "periodoFim",
          "centroCusto"
        ],
        "defaultSort": "competencia",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "competencia",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Revisar competência",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E10-T01": {
      "id": "E10-T01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "carga",
            "pedidoVenda",
            "cliente",
            "estabelecimento",
            "produto",
            "quantidade",
            "pesoRecebido",
            "valor",
            "regraFiscal",
            "notaFiscal",
            "chaveAcesso",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "carga",
          "pedidoVenda",
          "notaFiscal",
          "status",
          "cliente",
          "estabelecimento"
        ],
        "sortable": [
          "carga",
          "pedidoVenda",
          "notaFiscal",
          "cliente",
          "estabelecimento"
        ],
        "defaultSort": "carga",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "cliente",
        "estabelecimento",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E10-T02": {
      "id": "E10-T02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "pedidoCompra",
            "fornecedor",
            "notaFiscal",
            "produto",
            "pesoNF",
            "pesoRecebido",
            "diferencaPeso",
            "valor",
            "ocorrencia",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "notaFiscal",
          "status",
          "pedidoCompra",
          "fornecedor",
          "produto",
          "pesoNF"
        ],
        "sortable": [
          "notaFiscal",
          "pedidoCompra",
          "fornecedor",
          "produto",
          "pesoNF"
        ],
        "defaultSort": "notaFiscal",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "fornecedor",
        "produto",
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E10-T03": {
      "id": "E10-T03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "carga",
            "veiculo",
            "motorista",
            "pedidoVenda",
            "notaFiscal",
            "chaveAcesso",
            "protocolo",
            "documento",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "carga",
          "veiculo",
          "motorista",
          "notaFiscal",
          "status",
          "pedidoVenda"
        ],
        "sortable": [
          "carga",
          "veiculo",
          "motorista",
          "notaFiscal",
          "pedidoVenda"
        ],
        "defaultSort": "carga",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E10-T04": {
      "id": "E10-T04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "usuario",
            "grupoMenu",
            "perfilSistema",
            "acaoAprovacao",
            "ambiente",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "status",
          "usuario",
          "grupoMenu",
          "perfilSistema",
          "acaoAprovacao",
          "ambiente"
        ],
        "sortable": [
          "usuario",
          "grupoMenu",
          "perfilSistema",
          "acaoAprovacao",
          "ambiente"
        ],
        "defaultSort": "status",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "status"
      ],
      "navigation": {
        "source": "Menu da área de negócio",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Cadastrar / revisar",
        "requiresReason": false,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E11-V01": {
      "id": "E11-V01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "convenio",
            "servico",
            "tipoArquivo",
            "layout",
            "arquivoUpload",
            "sha256",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "contaBancaria",
          "layout",
          "status",
          "convenio",
          "servico"
        ],
        "sortable": [
          "banco",
          "contaBancaria",
          "layout",
          "convenio",
          "servico"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "servico",
        "layout",
        "status"
      ],
      "navigation": {
        "source": "Bancos & Tesouraria → Importações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E07-T01"
      },
      "actions": {
        "primary": "Pré-validar arquivo",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E11-V02": {
      "id": "E11-V02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "arquivo",
            "banco",
            "contaBancaria",
            "layout",
            "periodoInicio",
            "periodoFim",
            "valor",
            "saldo",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "arquivo",
          "banco",
          "layout",
          "status",
          "contaBancaria",
          "periodoInicio"
        ],
        "sortable": [
          "arquivo",
          "banco",
          "layout",
          "contaBancaria",
          "periodoInicio"
        ],
        "defaultSort": "arquivo",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "layout",
        "periodoInicio",
        "periodoFim"
      ],
      "navigation": {
        "source": "Bancos & Tesouraria → Importações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E07-T01"
      },
      "actions": {
        "primary": "Pré-validar arquivo",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E11-V03": {
      "id": "E11-V03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "transacao",
            "banco",
            "contaBancaria",
            "fonteEvento",
            "externalId",
            "nossoNumero",
            "valor",
            "dataTransacao",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "transacao",
          "fonteEvento",
          "valor",
          "dataTransacao",
          "status",
          "banco"
        ],
        "sortable": [
          "transacao",
          "fonteEvento",
          "valor",
          "dataTransacao",
          "banco"
        ],
        "defaultSort": "dataTransacao",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Bancos & Tesouraria → Importações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E07-T01"
      },
      "actions": {
        "primary": "Pré-validar arquivo",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E11-V04": {
      "id": "E11-V04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "transacao",
            "contaBancaria",
            "arquivo",
            "fonteEvento",
            "externalId",
            "sha256",
            "dataEvento",
            "usuario",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "arquivo",
          "status",
          "transacao",
          "contaBancaria",
          "fonteEvento",
          "externalId"
        ],
        "sortable": [
          "arquivo",
          "transacao",
          "contaBancaria",
          "fonteEvento",
          "externalId"
        ],
        "defaultSort": "arquivo",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "contaBancaria",
        "status"
      ],
      "navigation": {
        "source": "Bancos & Tesouraria → Importações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E07-T01"
      },
      "actions": {
        "primary": "Pré-validar arquivo",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E11-V05": {
      "id": "E11-V05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "banco",
            "contaBancaria",
            "convenio",
            "servico",
            "modoFallback",
            "layout",
            "integracao",
            "dataEvento",
            "aprovador",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "layout",
          "status",
          "contaBancaria",
          "convenio",
          "servico"
        ],
        "sortable": [
          "banco",
          "layout",
          "contaBancaria",
          "convenio",
          "servico"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": true,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "banco",
        "contaBancaria",
        "servico",
        "layout",
        "status"
      ],
      "navigation": {
        "source": "Bancos & Tesouraria → Importações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E07-T01"
      },
      "actions": {
        "primary": "Pré-validar arquivo",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V01": {
      "id": "E12-V01",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "estabelecimento",
            "provedor",
            "servico",
            "tipoServico",
            "integracao",
            "ambiente",
            "urlEndpoint",
            "certificado",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "integracao",
          "provedor",
          "servico",
          "ambiente",
          "status",
          "empresa"
        ],
        "sortable": [
          "integracao",
          "provedor",
          "servico",
          "ambiente",
          "empresa"
        ],
        "defaultSort": "integracao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "estabelecimento",
        "provedor",
        "servico",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V02": {
      "id": "E12-V02",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "estabelecimento",
            "finalidadeCert",
            "ambiente",
            "formatoCert",
            "certificadoPfx",
            "certificadoPublico",
            "titularCert",
            "emisCert",
            "serial",
            "fingerprint",
            "expiraEm",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "senhaPfx"
          ]
        }
      ],
      "grid": {
        "columns": [
          "estabelecimento",
          "finalidadeCert",
          "titularCert",
          "expiraEm",
          "status",
          "empresa"
        ],
        "sortable": [
          "estabelecimento",
          "finalidadeCert",
          "titularCert",
          "expiraEm",
          "empresa"
        ],
        "defaultSort": "estabelecimento",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "estabelecimento",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V03": {
      "id": "E12-V03",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "banco",
            "contaBancaria",
            "convenio",
            "carteira",
            "servico",
            "integracao",
            "ambiente",
            "clientId",
            "certificado",
            "callbackUrl",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "clientSecret",
            "apiKey",
            "webhookSecret"
          ]
        }
      ],
      "grid": {
        "columns": [
          "banco",
          "integracao",
          "ambiente",
          "certificado",
          "status",
          "empresa"
        ],
        "sortable": [
          "banco",
          "integracao",
          "ambiente",
          "certificado",
          "empresa"
        ],
        "defaultSort": "banco",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "banco",
        "contaBancaria",
        "servico",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V04": {
      "id": "E12-V04",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "empresa",
            "estabelecimento",
            "ie",
            "crt",
            "serie",
            "nNF",
            "integracao",
            "ambiente",
            "certificado",
            "urlEndpoint",
            "dataset",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "integracao",
          "ambiente",
          "status",
          "empresa",
          "estabelecimento",
          "ie"
        ],
        "sortable": [
          "integracao",
          "ambiente",
          "empresa",
          "estabelecimento",
          "ie"
        ],
        "defaultSort": "integracao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "empresa",
        "estabelecimento",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V05": {
      "id": "E12-V05",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "provedor",
            "dataset",
            "layout",
            "tipoServico",
            "vigenciaInicio",
            "vigenciaFim",
            "sha256",
            "arquivoUpload",
            "aprovador",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "provedor",
          "status",
          "dataset",
          "layout",
          "tipoServico",
          "vigenciaInicio"
        ],
        "sortable": [
          "provedor",
          "dataset",
          "layout",
          "tipoServico",
          "vigenciaInicio"
        ],
        "defaultSort": "dataset",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "provedor",
        "layout",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V06": {
      "id": "E12-V06",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "integracao",
            "servico",
            "job",
            "cron",
            "timezone",
            "periodoInicio",
            "periodoFim",
            "certificado",
            "usuario",
            "status"
          ]
        }
      ],
      "grid": {
        "columns": [
          "job",
          "servico",
          "cron",
          "timezone",
          "status",
          "integracao"
        ],
        "sortable": [
          "job",
          "servico",
          "cron",
          "timezone",
          "integracao"
        ],
        "defaultSort": "job",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "servico",
        "periodoInicio",
        "periodoFim",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    },
    "E12-V07": {
      "id": "E12-V07",
      "sections": [
        {
          "title": "Dados principais",
          "fields": [
            "provedor",
            "integracao",
            "servico",
            "certificado",
            "expiraEm",
            "job",
            "usuario",
            "status"
          ]
        },
        {
          "title": "Segurança, auditoria e aprovação",
          "fields": [
            "justificativa"
          ]
        }
      ],
      "grid": {
        "columns": [
          "integracao",
          "provedor",
          "servico",
          "status",
          "certificado",
          "expiraEm"
        ],
        "sortable": [
          "integracao",
          "provedor",
          "servico",
          "certificado",
          "expiraEm"
        ],
        "defaultSort": "integracao",
        "pagination": 20,
        "multiSelect": false,
        "stickyHeader": true,
        "serverSide": true,
        "neverShow": [
          "id",
          "uuid",
          "rowId",
          "tenantId",
          "foreignKey",
          "internalCode",
          "eventId"
        ],
        "rowClick": "abre painel contextual pelo nome de negócio; nunca exibe ID técnico",
        "empty": "estado específico com filtro e próximo passo, sem tabela vazia genérica"
      },
      "filters": [
        "provedor",
        "servico",
        "status"
      ],
      "navigation": {
        "source": "Administração → Integrações",
        "back": "retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação",
        "relatedScreen": "E12-V01"
      },
      "actions": {
        "primary": "Configurar serviço",
        "requiresReason": true,
        "dangerousAlwaysConfirm": true
      },
      "states": [
        "inicial",
        "carregando",
        "sem registros",
        "validação inválida",
        "sem acesso",
        "conflito concorrente",
        "serviço externo indisponível",
        "revisão pendente",
        "concluído com evidência"
      ],
      "mobile": "datagrid vira cartões de negócio; formulário em coluna, ações críticas fixadas e nunca exige visualizar identificador de persistência"
    }
  },
  "catalogRelationships": {
    "estabelecimentos": {
      "empresa": {
        "A": [
          "MAT"
        ],
        "B": [
          "FIL"
        ]
      }
    },
    "contasBancarias": {
      "banco": {
        "237": [
          "B1"
        ],
        "341": [
          "B2"
        ],
        "033": [
          "B3"
        ]
      },
      "empresa": {
        "A": [
          "B1",
          "B2"
        ],
        "B": [
          "B3"
        ]
      }
    },
    "convenios": {
      "contaBancaria": {
        "B1": [
          "V1"
        ],
        "B2": [
          "V2"
        ],
        "B3": [
          "V3"
        ]
      },
      "banco": {
        "237": [
          "V1"
        ],
        "341": [
          "V2"
        ],
        "033": [
          "V3"
        ]
      }
    },
    "carteiras": {
      "convenio": {
        "V1": [
          "K1"
        ],
        "V2": [
          "K2"
        ],
        "V3": [
          "K2"
        ]
      }
    },
    "certificados": {
      "empresa": {
        "A": [
          "X1",
          "X2"
        ],
        "B": [
          "X1"
        ]
      }
    },
    "layouts": {
      "banco": {
        "237": [
          "F1",
          "F2",
          "F3",
          "F4"
        ],
        "341": [
          "F2",
          "F3",
          "F4"
        ],
        "033": [
          "F1",
          "F3",
          "F4"
        ]
      }
    },
    "integracoes": {
      "provedor": {
        "SEF": [
          "I1"
        ],
        "DFE": [
          "I2"
        ],
        "ITA": [
          "I3"
        ]
      }
    },
    "jobs": {
      "integracao": {
        "I1": [
          "J1",
          "J3"
        ],
        "I2": [
          "J1",
          "J3"
        ],
        "I3": [
          "J2",
          "J3"
        ]
      }
    }
  }
};
