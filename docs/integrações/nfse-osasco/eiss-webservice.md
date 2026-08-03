# EISS WebService — Operações SOAP

> **Fontes oficiais** (baixadas do portal em 2026-08-02):
> - *Geração de NF-E via Web Service V10.6* (Set/2024, 34 págs) — modelo padrão.
> - *Geração de NFS-e Via Web Service 2.0* (Jan/2026, 50 págs) — modelo RTC + regra de corte 2026.
> - Portal de manuais: https://nfe.osasco.sp.gov.br/EissnfeWebApp/portal/Manuais.aspx

## Protocolo

- **Estilo:** WCF document/literal (não rpc/encoded)
- **Transporte:** HTTPS obrigatório (TLS 1.2+)
- **Content-Type:** `text/xml; charset=utf-8`
- **SOAPAction:** obrigatório no header HTTP; padrão `http://tempuri.org/INotaFiscalEletronica/<Metodo>`
- **Namespaces reais** (conferidos nos manuais oficiais — NÃO usar variações):
  - `tem` = `http://tempuri.org/`
  - `eis` = `http://schemas.datacontract.org/2004/07/Eissnfe.Negocio.WebServices.Mensagem`
  - `eis1` = `http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Prestador`
  - `eis2` = `http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Contribuinte`
- **Codificação:** UTF-8 em todo o payload XML
- **Estrutura de request:** todo método embrulha o corpo em `<tem:request>`; a emissão embrulha a
  nota em `<eis:NotaFiscal>` (padrão) ou `<eis:NotaFiscal_RTC>` (RTC). **Não existe `<tem:nota>`.**

## Regra de corte RTC (manual 2.0)

| Cenário | Família de métodos |
|---------|--------------------|
| Referência fiscal ≥ 2026 e emissor NÃO-Simples | **`RTC_*` obrigatórios** |
| Referência fiscal < 2026 OU emissor Simples Nacional | `Emitir`/`EmitirEmLote` legados |
| Consulta/cancelamento (qualquer referência) | `Consultar`, `Cancelar`, `ConsultarNotaCompleta`, lotes |

## Métodos disponíveis

### Emissão RTC (referência ≥ 2026, não-Simples)

| Método | Descrição |
|--------|-----------|
| `RTC_EmitirNFE` | Emissão unitária síncrona no modelo RTC |
| `RTC_EmitirNFELote` | Emissão assíncrona em lote RTC |
| `RTC_ConsultarNFE` | Consulta de notas emitidas |
| `RTC_ConsultarLote` | Consulta do processamento de lote |
| `RTC_PesquisarNbsClassTrib` | Correlação Código de Serviço → NBS + ClassTrib + IndOperacao (entrada: `CodigoAtividade`, ex. `"14.01"`) |
| `RTC_PesquisarLocalIncidencia` | Lista códigos de Local de Incidência IBS/CBS (sem parâmetros) |
| `RTC_PesquisarMunicipioIBGE` | Códigos de municípios (tabela IBGE) |

### Emissão padrão (referência < 2026 ou Simples Nacional)

| Método | Descrição |
|--------|-----------|
| `Emitir` | Emissão unitária **síncrona** — o manual exige aguardar o retorno antes de enviar a próxima requisição; requisições simultâneas podem falhar ambas |
| `EmitirEmLote` | Emissão assíncrona em lote (máx. 5000 notas) |

### Consulta e cancelamento (qualquer referência fiscal)

| Método | Descrição |
|--------|-----------|
| `Consultar` | Consulta resumida por período de emissão, intervalo de notas, intervalo/número de recibo; refinável por CNPJ/CPF do tomador |
| `ConsultarNotaCompleta` | Consulta completa (XML integral da nota), mesmos parâmetros |
| `Cancelar` | Cancelamento unitário (`NumeroNota` + `Motivo` opcional) |
| `ConsultarLote` | Status de processamento de lote de emissão |
| `CancelarNotaLote` | Cancelamento em lote (dentro do prazo legal) |
| `ConsultaCancelamentoNotasLote` | Acompanha lote de cancelamento |

### Tomadores de nota agrupada

`EnviarTomadoresLote` · `ConsultarTomadoresLote` · `ConsultarTomadoresNota` · `ExcluirTomadoresLote`

### Repasse (R1/R2) — fora de escopo

A emissão de Notas de Repasse (manuais R1/R2 V2.0) exige **Regime Especial concedido pela
Secretaria de Finanças**. A AlphaCarnes não possui esse regime → tags `DeduzirRepasse` e
`ValorRepasse` são sempre `false`/ausentes; métodos `EMITIRNOTAREPASSER2` etc. não são usados.

## Envelope SOAP — método `Emitir` (modelo padrão, estrutura real do manual V10.6)

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/"
                  xmlns:eis="http://schemas.datacontract.org/2004/07/Eissnfe.Negocio.WebServices.Mensagem"
                  xmlns:eis1="http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Prestador"
                  xmlns:eis2="http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Contribuinte">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Emitir>
      <tem:request>
        <eis:NotaFiscal>
          <eis1:ChaveAutenticacao>TOKEN</eis1:ChaveAutenticacao>
          <eis1:Homologacao>true</eis1:Homologacao>
          <eis1:Identificador>PED-000984</eis1:Identificador>
          <eis1:nrExercicioReferencia>2026</eis1:nrExercicioReferencia>
          <eis1:nrMesReferencia>8</eis1:nrMesReferencia>
          <eis1:Atividade>14.01</eis1:Atividade>
          <eis1:Aliquota>0.00</eis1:Aliquota>
          <eis1:SubstituicaoTributaria>false</eis1:SubstituicaoTributaria>
          <eis1:SemIncidenciaISS>false</eis1:SemIncidenciaISS>
          <eis1:SimplesNacional>false</eis1:SimplesNacional>
          <eis1:TomadorEstrangeiro>false</eis1:TomadorEstrangeiro>
          <eis1:Tomador>
            <eis2:CNPJ>98765432000111</eis2:CNPJ>
            <eis2:Nome>Cliente Exemplo Ltda</eis2:Nome>
            <eis2:Endereco>
              <eis2:TipoLogradouro>Avenida</eis2:TipoLogradouro>
              <eis2:Logradouro>Exemplo</eis2:Logradouro>
              <eis2:Numero>500</eis2:Numero>
              <eis2:Bairro>Centro</eis2:Bairro>
              <eis2:CEP>01310100</eis2:CEP>
              <eis2:Cidade>São Paulo</eis2:Cidade>
              <eis2:Estado>SP</eis2:Estado>
            </eis2:Endereco>
          </eis1:Tomador>
          <eis1:NotificarTomadorPorEmail>true</eis1:NotificarTomadorPorEmail>
          <eis1:InformacoesAdicionais>Pedido PED-000984|Lote 20260802-001</eis1:InformacoesAdicionais>
          <eis1:Valor>15000.00</eis1:Valor>
          <eis1:DeduzirRepasse>false</eis1:DeduzirRepasse>
        </eis:NotaFiscal>
      </tem:request>
    </tem:Emitir>
  </soapenv:Body>
</soapenv:Envelope>
```

Header HTTP obrigatório:
```
SOAPAction: "http://tempuri.org/INotaFiscalEletronica/Emitir"
Content-Type: text/xml; charset=utf-8
```

## Campos do `Emitir` (obrigatoriedade conforme manual V10.6)

| Campo | Tipo | Obrigatório | Observações |
|-------|------|:-----------:|-------------|
| `ChaveAutenticacao` | String | SIM | Token por Inscrição Municipal; nunca logar/persistir |
| `Homologacao` | Boolean | SIM | `true` = nota de teste (sem valor fiscal, sem numeração) |
| `Identificador` | String | Não | Nº de controle interno do ERP (ex. id do pedido); ecoado no response |
| `NumeroRecibo`/`DataRecibo`/`EqptoRecibo` | — | Não | Conversão de recibo (não usado pela AlphaCarnes) |
| `NotaSubstituida` | Int | Não | Nº de nota cancelada substituída por esta |
| `nrExercicioReferencia` | Int | SIM | Ano de referência (= ano da emissão) |
| `nrMesReferencia` | Int | SIM | Mês de referência (= mês da emissão) |
| `Atividade` | String | SIM | **Código de serviço** (formato LC 404/2022 Anexo I, ex. `1.01`, `14.01`, `17.19`) — o campo NÃO se chama `CodigoServico` |
| `Aliquota` | Decimal | SIM | `0.00` para não-Simples (o sistema aplica a alíquota vigente); 2,00–5,00 apenas para Simples |
| `SubstituicaoTributaria` | Boolean | SIM | `true` → tomador recolhe o ISS; CNPJ/CPF do tomador vira obrigatório |
| `SemIncidenciaISS` | Boolean | SIM | Só `true` para tomador estrangeiro com resultado no exterior |
| `SimplesNacional` | Boolean | SIM | `true` só se o emissor é Simples na data de referência |
| `TomadorEstrangeiro` | Boolean | SIM | `true` desliga validação de CNPJ/CPF |
| `Tomador.*` | Objeto | campos Não | CNPJ (14 díg. sem máscara), CPF (11), IM (só Osasco), Nome, Email, DDD, Telefone, Endereco |
| `NotificarTomadorPorEmail` | Boolean | SIM | `true` envia o link da nota ao e-mail do tomador |
| `InformacoesAdicionais` | String | SIM | Máx. 2300 chars; `\|` (pipe) = quebra de parágrafo |
| `EnderecoPrestacaoServico` + CEP/Cidade/Estado | String | Condicional | Obrigatórios se `Atividade` ∈ {7.02, 7.05} OU `SubstituicaoTributaria=true` |
| `CodObra`/`NumeroCDC`/`NumeroCEI` | — | Condicional | Só construção civil (7.02/7.05) |
| `Valor` | Decimal | SIM | Valor total do serviço, formato `0.00` |
| `ValorDeducao`/`ValorRepasse` | Decimal | Não | Só cartórios com regime especial — deixar `0.00`/ausente |
| `ValorCSLL`/`ValorCofins`/`ValorINSS`/`ValorIR`/`ValorPisPasep`/`ValorOutrosImpostos` | Decimal | Não | Destaque informativo (Lei 12.741/2012), calculados pelo contribuinte |
| `DeduzirRepasse` | Boolean | SIM | **Sempre `false`** (exige regime especial) |

## Campos adicionais do `RTC_EmitirNFE` (manual 2.0 — todos obrigatórios)

| Campo | Tipo/Formato | Como obter |
|-------|--------------|-----------|
| `ClassTrib` | Alfanumérico 6 díg. (`000000`) | `RTC_PesquisarNbsClassTrib` com o código de serviço |
| `CodigoNBS` | 12 díg. com pontos (`0.0000.00.00`) | idem |
| `IndOperacao` | Alfanumérico 6 díg. (`000000`) | idem |
| `IdLocalIncidencia` | Inteiro 1 díg. | `RTC_PesquisarLocalIncidencia` (sem parâmetros) |

O envelope RTC usa `<eis:NotaFiscal_RTC>` no lugar de `<eis:NotaFiscal>` e o método
`<tem:RTC_EmitirNFE>`; os demais campos coincidem com o `Emitir` padrão (acrescidos dos 4 acima
e dos campos de endereço de prestação com `CodigoCidadeIBGEPrestacaoServico`).

## Estrutura do retorno (`Emitir`/`RTC_EmitirNFE`)

```xml
<EmitirResponse>
  <EmitirResult>
    <a:Erro>false</a:Erro>
    <a:MensagemErro/>
    <a:NotaFiscalGerada>
      <b:Autenticador>ABCD1234</b:Autenticador>
      <b:Identificador>PED-000984</b:Identificador>
      <b:Link>https://nfe.osasco.sp.gov.br/...</b:Link>
      <b:Numero>000012345</b:Numero>
    </a:NotaFiscalGerada>
  </EmitirResult>
</EmitirResponse>
```

| Campo | Descrição |
|-------|-----------|
| `Erro` | `true`/`false` — **HTTP 200 com `Erro=true` é falha de negócio** |
| `MensagemErro` | Descrição textual do erro (não há tabela de códigos numéricos — o EISS retorna mensagens) |
| `NotaFiscalGerada.Autenticador` | Código de autenticação para validação pública |
| `NotaFiscalGerada.Identificador` | Eco do identificador interno enviado |
| `NotaFiscalGerada.Link` | Link direto à nota (o mesmo enviado ao tomador por e-mail) |
| `NotaFiscalGerada.Numero` | Número sequencial da NFS-e |

O `Cancelar` retorna apenas `Erro` + `MensagemErro`. O `Consultar` retorna a lista de notas com
`CodAtividade`, `ValorNFE`, `ValorISS`, `DataCancelamento`, `MotivoCancelamento`, `NossoNumero`
(guia de pagamento) e `QtdeNotas`.

## Autenticação

A autenticação é feita por **`ChaveAutenticacao` por requisição** — não há sessão ou cookie.

- Uma chave por **Inscrição Municipal**; identifica credenciais, permissões e códigos de serviço
  autorizados do contribuinte.
- **Auto-atendimento**: gerada pelo próprio contribuinte no portal (`nfe.osasco.sp.gov.br` →
  menu *Notas Fiscais* → *"Web Service – Gerar Chave Autenticação"*), pelo usuário indicado na
  Autorização de Emissão de NFS-e. Gerar uma nova chave **revoga a anterior**.
- Formato GUID (ex. `495fb04a-a9b4-4y3f-bdef-bj461k84bf5y`).
- Não expira automaticamente; pode ser regenerada/revogada a qualquer momento no portal.
- Armazenar somente em variável de ambiente:
  - `EISS_CHAVE_AUTENTICACAO_HML` — chave gerada no portal de homologação
  - `EISS_CHAVE_AUTENTICACAO_PRD` — chave gerada no portal de produção

## Considerações de implementação

- **`Emitir` é estritamente síncrono e não-idempotente**: o manual exige aguardar o retorno de
  cada requisição antes de enviar a próxima (a sequência numérica municipal fica bloqueada
  durante a geração). Em caso de timeout, **consultar antes de retransmitir** (`Consultar` por
  `Identificador`/período) para evitar nota duplicada.
- **Serialização no cliente**: emitir uma nota por vez por prestador (fila/mutex no
  FaturamentoService) — nunca `Promise.all` de emissões.
- **node-soap:** `forceSoap12Headers: false`; SOAPAction manual quando necessário; declarar os 4
  namespaces (`tem`, `eis`, `eis1`, `eis2`).
- **Homologação**: ver `ambiente-homologacao.md` — ambiente dedicado
  (`homolog-nfe.osasco.sp.gov.br`) + tag `Homologacao=true`.
