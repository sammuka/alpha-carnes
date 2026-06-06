# Estrutura XML — Tipos EISS

## NotaFiscalDTO

Tipo principal enviado nos métodos `Emitir`, `EmitirR1`, `EmitirR2` e equivalentes RTC.

| Campo | Tipo XSD | Obrig. | Descrição |
|-------|---------|--------|-----------|
| `ChaveAutenticacao` | string | Sim | Token do usuário/sistema (ver autenticação) |
| `Homologacao` | boolean | Sim | `true` = ambiente de teste; `false` = produção |
| `Aliquota` | decimal | Sim | Alíquota ISS em decimal (ex: `0.05` = 5%) |
| `Valor` | decimal | Sim | Valor bruto do serviço prestado |
| `ValorDeducao` | decimal | Sim | Valor das deduções (`0` se não houver) |
| `ValorPis` | decimal | Não | PIS retido na fonte |
| `ValorCofins` | decimal | Não | COFINS retido na fonte |
| `ValorInss` | decimal | Não | INSS retido na fonte |
| `ValorIr` | decimal | Não | IR retido na fonte |
| `ValorCsll` | decimal | Não | CSLL retido na fonte |
| `ValorOutrasRetencoes` | decimal | Não | Outras retenções federais |
| `DescricaoServico` | string | Sim | Descrição do serviço prestado (texto livre, até 2000 chars) |
| `CodigoServico` | string | Sim | Código do serviço municipal de Osasco (ex: `"04014"`) |
| `CodigoCnae` | string | Não | CNAE da atividade principal (ex: `"4712100"`) |
| `NotificarTomadorPorEmail` | boolean | Sim | Envia e-mail com DANFE ao tomador |
| `SubstituicaoTributaria` | boolean | Sim | Indica substituição tributária do ISS |
| `Tomador` | PessoaDTO | Sim | Dados do tomador (cliente que recebe o serviço) |
| `Prestador` | PessoaDTO | Sim | Dados do prestador (AlphaCarnes) |
| `NumeroRps` | string | Não | Número do RPS (Recibo Provisório de Serviços) |
| `SerieRps` | string | Não | Série do RPS (geralmente `"A"` ou `"1"`) |
| `DataRps` | dateTime | Não | Data de emissão do RPS (ISO 8601) |

### Cálculo do Valor do ISS

```
ValorISS = (Valor - ValorDeducao) * Aliquota
ValorLiquido = Valor - ValorISS - ValorPis - ValorCofins - ValorInss - ValorIr - ValorCsll - ValorOutrasRetencoes
```

## PessoaDTO

Usado tanto para `Tomador` quanto para `Prestador` dentro de `NotaFiscalDTO`.

| Campo | Tipo | Obrig. | Descrição |
|-------|------|--------|-----------|
| `Nome` | string | Sim | Razão social (PJ) ou nome completo (PF) |
| `CNPJ` | string | Cond. | CNPJ com 14 dígitos numéricos, sem máscara (PJ obrigatório) |
| `CPF` | string | Cond. | CPF com 11 dígitos numéricos, sem máscara (PF obrigatório) |
| `InscricaoMunicipal` | string | Não | Inscrição Municipal do prestador (obrigatório para o `Prestador`) |
| `Email` | string | Não | E-mail para envio de notificações e DANFE |
| `DDD` | string | Não | Código de área (2 dígitos numéricos) |
| `Telefone` | string | Não | Número de telefone sem DDD e sem formatação |
| `Endereco` | EnderecoDTO | Não | Endereço completo (recomendado para o tomador) |

**Regra:** informar `CNPJ` **ou** `CPF`, nunca ambos. Pessoa jurídica sempre usa `CNPJ`.

## EnderecoDTO

Embedded em `PessoaDTO` como campo `Endereco`.

| Campo | Tipo | Obrig. | Descrição |
|-------|------|--------|-----------|
| `Logradouro` | string | Não | Nome da rua/avenida/etc. (sem número) |
| `Numero` | string | Não | Número do imóvel (`"S/N"` quando sem número) |
| `Complemento` | string | Não | Complemento (sala, andar, bloco, etc.) |
| `Bairro` | string | Não | Nome do bairro |
| `Cidade` | string | Não | Nome do município |
| `CodigoCidadeIBGE` | string | Não | Código IBGE do município (7 dígitos; Osasco = `"3534401"`) |
| `Estado` | string | Não | Sigla da UF com 2 caracteres (ex: `"SP"`) |
| `CEP` | string | Não | CEP com 8 dígitos numéricos, sem máscara |
| `Pais` | string | Não | Nome do país (default `"BRASIL"` para endereços nacionais) |

## CancelamentoNotaFiscalRequest

Tipo enviado no método `Cancelar`.

| Campo | Tipo | Obrig. | Descrição |
|-------|------|--------|-----------|
| `ChaveAutenticacao` | string | Sim | Token do usuário/sistema |
| `Homologacao` | boolean | Sim | `true` = ambiente de teste |
| `NumeroNota` | string | Sim | Número da NFS-e a cancelar |
| `MotivoCancelamento` | string | Sim | Descrição do motivo do cancelamento |
| `Prestador` | PessoaDTO | Sim | Dados do prestador (deve corresponder ao emitente) |

## ConsultaNotaFiscalRequest

Tipo enviado nos métodos `ConsultarNota` e `ConsultarNotaCompleta`.

| Campo | Tipo | Obrig. | Descrição |
|-------|------|--------|-----------|
| `ChaveAutenticacao` | string | Sim | Token do usuário/sistema |
| `Homologacao` | boolean | Sim | `true` = ambiente de teste |
| `NumeroNota` | string | Sim | Número da NFS-e a consultar |
| `Prestador` | PessoaDTO | Sim | Dados do prestador emitente |

## Notas de Implementação

### Formatação de Campos

- **CNPJ/CPF:** apenas dígitos numéricos, sem pontos, traços ou barras
  - CNPJ: `"12345678000195"` (14 dígitos)
  - CPF: `"12345678901"` (11 dígitos)
- **CEP:** apenas dígitos, sem traço — `"06220170"` (8 dígitos)
- **Decimais:** separador de ponto `.` conforme XSD — `1500.00`, não `1500,00`
- **Datas:** ISO 8601 com timezone — `"2026-06-05T14:30:00-03:00"`
- **Alíquota:** decimal entre 0 e 1 — ISS de 5% = `0.05`

### Validações do Servidor EISS

O servidor EISS realiza as seguintes validações e retorna `Erro: true` com mensagem descritiva:

1. CNPJ/CPF inválido (dígitos verificadores)
2. Código de serviço inexistente no município
3. Alíquota fora da faixa permitida
4. `ChaveAutenticacao` inválida ou revogada
5. `Valor` menor ou igual a zero
6. `DescricaoServico` vazia
7. Prestador sem Inscrição Municipal ativa

### Mapeamento para o Domínio AlphaCarnes

| Campo AlphaCarnes | Campo EISS | Observação |
|-------------------|-----------|-----------|
| `pedido.valor_total` | `Valor` | Valor bruto da nota |
| `pedido.codigo_servico` | `CodigoServico` | Configurável por tipo de operação |
| `cliente.cnpj` | `Tomador.CNPJ` | Remover formatação antes de enviar |
| `empresa.cnpj` | `Prestador.CNPJ` | CNPJ da AlphaCarnes |
| `empresa.inscricao_municipal` | `Prestador.InscricaoMunicipal` | Obrigatório |
| `cliente.email` | `Tomador.Email` | Quando `NotificarTomadorPorEmail: true` |
