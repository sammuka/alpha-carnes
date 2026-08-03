# Estrutura XML — Tipos EISS

> **Fonte:** manuais oficiais *V10.6* (Set/2024, modelo padrão) e *2.0* (Jan/2026, RTC).
> A tabela abaixo reflete o XML real dos manuais. Atenções que diferem de suposições comuns:
> o campo de código de serviço chama-se **`Atividade`** (não `CodigoServico`); **não existe um
> objeto `Prestador` no request** — o prestador é identificado pela `ChaveAutenticacao`; a
> descrição em texto livre vai em **`InformacoesAdicionais`**; a `Aliquota` é percentual
> (`2.00`–`5.00`), não fração.

## NotaFiscal (request do `Emitir` — modelo padrão)

Namespace dos campos: `eis1` (nota) e `eis2` (tomador/endereço) — ver `eiss-webservice.md`.

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `ChaveAutenticacao` | string | Sim | Token da Inscrição Municipal (identifica o prestador) |
| `Homologacao` | boolean | Sim | `true` = nota de teste, sem valor fiscal |
| `Identificador` | string | Não | Nº de controle interno do ERP (ecoado no response) — usar o id/número do pedido AlphaCarnes |
| `NumeroRecibo` / `DataRecibo` / `EqptoRecibo` | — | Não | Conversão de recibo — não usado |
| `NotaSubstituida` | int | Não | Nº da nota cancelada substituída por esta |
| `nrExercicioReferencia` | int | Sim | Ano de referência (= ano da emissão) |
| `nrMesReferencia` | int | Sim | Mês de referência (= mês da emissão) |
| `Atividade` | string | Sim | Código de serviço (Anexo I da LC 404/2022; ex. `1.01`, `14.01`, `17.19`) |
| `Aliquota` | decimal | Sim | `0.00` para não-Simples (sistema aplica a vigente); `2.00`–`5.00` para Simples (LC 155/2016) |
| `SubstituicaoTributaria` | boolean | Sim | `true` = tomador recolhe o ISS (CNPJ ou CPF do tomador vira obrigatório) |
| `SemIncidenciaISS` | boolean | Sim | Só `true` para tomador estrangeiro com resultado do serviço no exterior (LC 404/2022 Art. 65) |
| `SimplesNacional` | boolean | Sim | `true` só se o emissor é Simples na data de referência |
| `TomadorEstrangeiro` | boolean | Sim | `true` desliga validação de CNPJ/CPF do tomador |
| `Tomador` | objeto | Sim | Ver tabela Tomador abaixo |
| `NotificarTomadorPorEmail` | boolean | Sim | Envia o link da nota ao e-mail do tomador |
| `InformacoesAdicionais` | string | Sim | Corpo da nota — máx. 2300 chars; `\|` = novo parágrafo. Aqui vai a descrição do serviço/pedido/lote |
| `EnderecoPrestacaoServico` + `CEPPrestacaoServico` + `CidadePrestacaoServico` + `EstadoPrestacaoServico` | string | Cond. | Obrigatórios quando `Atividade` ∈ {7.02, 7.05} OU `SubstituicaoTributaria=true` |
| `CodObra` / `NumeroCDC` / `NumeroCEI` | — | Cond. | Só construção civil (7.02/7.05) — fora de escopo |
| `Valor` | decimal | Sim | Valor total do serviço (`0.00`) |
| `ValorDeducao` / `ValorRepasse` | decimal | Não | Só cartórios com regime especial — omitir/`0.00` |
| `ValorCSLL` / `ValorCofins` / `ValorINSS` / `ValorIR` / `ValorPisPasep` / `ValorOutrosImpostos` | decimal | Não | Destaque informativo (Lei 12.741/2012) calculado pelo contribuinte |
| `DeduzirRepasse` | boolean | Sim | **Sempre `false`** (repasse exige Regime Especial) |

## Campos adicionais RTC (`NotaFiscal_RTC` — obrigatórios p/ referência ≥ 2026, não-Simples)

| Campo | Formato | Como obter |
|-------|---------|-----------|
| `ClassTrib` | 6 díg. `000000` | `RTC_PesquisarNbsClassTrib(CodigoAtividade)` |
| `CodigoNBS` | 12 díg. `0.0000.00.00` | idem |
| `IndOperacao` | 6 díg. `000000` | idem |
| `IdLocalIncidencia` | int 1 díg. | `RTC_PesquisarLocalIncidencia()` |

O `NotaFiscal_RTC` também aceita campos de endereço de prestação estendidos
(`BairroPrestacaoServico`, `CodigoCidadeIBGEPrestacaoServico`, `ComplementoPrestacaoServico`,
`NumeroPrestacaoServico`, `PaisPrestacaoServico`) e `NumeroContrato`, `ValorCofinsProprio`,
`ValorPisProprio`.

## Tomador (namespace `eis2`)

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `CNPJ` | string | Cond. | 14 dígitos sem máscara; obrigatório se `SubstituicaoTributaria=true` e sem CPF |
| `CPF` | string | Cond. | 11 dígitos sem máscara; obrigatório se ST e sem CNPJ |
| `InscricaoMunicipal` | string | Não | Somente IM de Osasco |
| `Nome` | string | Não | Nome/razão social |
| `Email` | string | Não | Destino do link quando `NotificarTomadorPorEmail=true` |
| `DDD` | string | Não | 2 dígitos |
| `Telefone` | string | Não | Sem DDD |
| `Endereco` | objeto | Não | Ver abaixo |

**Regra:** informar `CNPJ` **ou** `CPF`, nunca ambos.

## Endereco (namespace `eis2`)

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `TipoLogradouro` | string | Não | Av., Rua, Rod., Al., etc. |
| `Logradouro` | string | Não | Nome sem número |
| `Numero` | string | Não | `"S/N"` quando sem número |
| `Complemento` | string | Não | Sala, andar, bloco |
| `Bairro` | string | Não | |
| `CEP` | string | Não | 8 dígitos sem traço |
| `Cidade` | string | Não | |
| `CodigoCidadeIBGE` | string | Não (RTC: usado) | 7 dígitos; Osasco = `3534401` |
| `Estado` | string | Não | UF 2 caracteres |
| `Pais` | string | Não | Só tomador estrangeiro |

## Cancelar (request)

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `ChaveAutenticacao` | string | Sim | |
| `Homologacao` | boolean | Sim | `true` cancela nota de teste (na prática, notas de teste não são canceláveis — ver `ambiente-homologacao.md`) |
| `NumeroNota` | int | Sim | Número da nota a cancelar |
| `Motivo` | string | Não | Motivo do cancelamento |

## Consultar / ConsultarNotaCompleta (request)

Sem objeto `Prestador` — o escopo é o da `ChaveAutenticacao`. Parâmetros combináveis:

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `ChaveAutenticacao` | string | Sim | |
| `DataInicial` / `DataFinal` | date | Par | Período de emissão (ambos ou nenhum) |
| `NumeroNotaInicial` / `NumeroNotaFinal` | int | Par | Intervalo numérico de notas |
| `NumeroReciboInicial` / `NumeroReciboFinal` | int | Par | Intervalo de recibos |
| `NumeroReciboUnico` | int | Não | Recibo individual |
| `CNPJTomador` / `CPFTomador` | string | Não | Refinamento por tomador |

## Retorno (`EmitirResult` / `RTC_EmitirNFEResult`)

| Campo | Descrição |
|-------|-----------|
| `Erro` | `true`/`false` — HTTP 200 com `Erro=true` é falha de negócio |
| `MensagemErro` | Texto do erro (o EISS não usa códigos numéricos — ver `codigos-erro.md` para o catálogo de mensagens conhecidas) |
| `NotaFiscalGerada.Numero` | Número sequencial da NFS-e |
| `NotaFiscalGerada.Autenticador` | Código de autenticação (validação pública) |
| `NotaFiscalGerada.Link` | Link direto à nota (o mesmo do e-mail ao tomador) |
| `NotaFiscalGerada.Identificador` | Eco do identificador interno enviado |

## Notas de Implementação

### Formatação de campos

- **CNPJ/CPF:** apenas dígitos (`12345678000195` / `12345678901`)
- **CEP:** apenas dígitos (`06220170`)
- **Decimais:** ponto como separador — `1500.00`
- **Alíquota:** percentual — ISS de 5% = `5.00` (Simples); não-Simples envia `0.00`
- **Datas:** `Date`/`DateTime` XSD

### Validações do servidor EISS (retornam `Erro=true` + mensagem)

1. CNPJ/CPF inválido (dígitos verificadores)
2. `Atividade` não autorizada para o emissor
3. `Aliquota` fora da faixa (Simples) ou ≠ `0.00` (não-Simples)
4. `ChaveAutenticacao` inválida ou revogada
5. `Valor` ausente/inválido
6. Campos condicionais ausentes (endereço de prestação com ST, campos RTC etc.)
7. Prestador sem Autorização de Emissão ativa

### Mapeamento para o domínio AlphaCarnes

| Campo AlphaCarnes | Campo EISS | Observação |
|-------------------|-----------|-----------|
| `notas_fiscais.id`/nº do pedido | `Identificador` | Rastreio ERP↔EISS; ecoado no response |
| valor consolidado da carga/pedido | `Valor` | |
| código de serviço (parâmetro) | `Atividade` | Configurável; formato `00.00` da LC 404/2022 |
| descrição consolidada (pedido/lote/peças) | `InformacoesAdicionais` | Máx. 2300 chars, `\|` p/ parágrafos |
| `clientes.cnpj` | `Tomador.CNPJ` | Sem máscara |
| `clientes.email` | `Tomador.Email` | Com `NotificarTomadorPorEmail=true` |
| `notas_fiscais.numero` | ← `NotaFiscalGerada.Numero` | Persistido do retorno |
| `notas_fiscais.payload_eiss` | ← response bruto | Com `ChaveAutenticacao` redigida |
| `modelo_fiscal` (`padrao`/`rtc`) | família de método | `rtc` → `RTC_EmitirNFE` + 4 campos RTC |
