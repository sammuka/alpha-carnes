# EISS WebService — Operações SOAP

## Protocolo

- **Estilo:** WCF document/literal (não rpc/encoded)
- **Transporte:** HTTPS obrigatório (TLS 1.2+); requisições HTTP simples são rejeitadas
- **Content-Type:** `text/xml; charset=utf-8`
- **SOAPAction:** obrigatório no header HTTP; varia por operação (ver tabela abaixo)
- **Namespace base:** `http://tempuri.org/`
- **Codificação:** UTF-8 em todo o payload XML

## Métodos disponíveis

### Emissão padrão

| Método | SOAPAction | Descrição |
|--------|-----------|-----------|
| `Emitir` | `http://tempuri.org/INotaFiscalEletronica/Emitir` | Emissão unitária síncrona |
| `EmitirEmLote` | `http://tempuri.org/INotaFiscalEletronica/EmitirEmLote` | Emissão assíncrona em lote |
| `ConsultarLote` | `http://tempuri.org/INotaFiscalEletronica/ConsultarLote` | Consulta resultado do lote |

### Cancelamento

| Método | SOAPAction | Descrição |
|--------|-----------|-----------|
| `Cancelar` | `http://tempuri.org/INotaFiscalEletronica/Cancelar` | Cancelamento de NFS-e emitida |
| `CancelarEmLote` | `http://tempuri.org/INotaFiscalEletronica/CancelarEmLote` | Cancelamento em lote |

### Consultas

| Método | Descrição |
|--------|-----------|
| `ConsultarNota` | Consulta resumida por número |
| `ConsultarNotaCompleta` | Consulta completa com todos os campos |
| `ConsultarNotasPorPeriodo` | Consulta por período de emissão |
| `ConsultarNotasPorTomador` | Consulta por CNPJ/CPF do tomador |
| `ConsultarNotasPorPrestador` | Consulta por CNPJ do prestador |

### Repasse (R1/R2)

| Método | Descrição |
|--------|-----------|
| `EmitirR1` | Emissão com repasse de ISS |
| `EmitirR2` | Emissão R2 |
| `CancelarR1` | Cancelamento R1 |
| `ConsultarR1` | Consulta R1 |

### RTC (Reforma Tributária do Consumo)

| Método | Descrição |
|--------|-----------|
| `RTC_EmitirNFE` | Emissão no novo modelo RTC |
| `RTC_CancelarNFE` | Cancelamento RTC |
| `RTC_ConsultarNFE` | Consulta RTC |

### Tomadores/Executores

| Método | Descrição |
|--------|-----------|
| `ConsultarTomadores` | Lista tomadores cadastrados |
| `IncluirTomador` | Cadastra tomador |
| `ConsultarExecutores` | Lista executores |

## Estrutura do Envelope SOAP

Exemplo de envelope para o método `Emitir`:

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Emitir>
      <tem:nota>
        <!-- NotaFiscalDTO -->
        <tem:ChaveAutenticacao>TOKEN_AQUI</tem:ChaveAutenticacao>
        <tem:Homologacao>true</tem:Homologacao>
        <tem:Aliquota>0.05</tem:Aliquota>
        <tem:Valor>1000.00</tem:Valor>
        <tem:ValorDeducao>0</tem:ValorDeducao>
        <tem:DescricaoServico>Distribuição de carnes — pedido 12345</tem:DescricaoServico>
        <tem:CodigoServico>04014</tem:CodigoServico>
        <tem:NotificarTomadorPorEmail>true</tem:NotificarTomadorPorEmail>
        <tem:SubstituicaoTributaria>false</tem:SubstituicaoTributaria>
        <tem:Tomador>
          <!-- PessoaDTO do tomador -->
        </tem:Tomador>
        <tem:Prestador>
          <!-- PessoaDTO do prestador -->
        </tem:Prestador>
      </tem:nota>
    </tem:Emitir>
  </soapenv:Body>
</soapenv:Envelope>
```

Header HTTP obrigatório:
```
SOAPAction: "http://tempuri.org/INotaFiscalEletronica/Emitir"
Content-Type: text/xml; charset=utf-8
```

## ResponseBase

Todos os métodos retornam uma estrutura de resposta comum com os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `Erro` | boolean | `true` se houve erro na operação |
| `MensagemErro` | string | Descrição textual do erro (vazia quando `Erro: false`) |
| `NumeroNota` | string | Número da NFS-e emitida (preenchido apenas em sucesso de emissão) |
| `CodigoVerificacao` | string | Código de verificação da NFS-e (usado para consulta pública) |

Exemplo de resposta de sucesso:

```xml
<EmitirResponse xmlns="http://tempuri.org/">
  <EmitirResult>
    <Erro>false</Erro>
    <MensagemErro/>
    <NumeroNota>000012345</NumeroNota>
    <CodigoVerificacao>ABCD1234</CodigoVerificacao>
  </EmitirResult>
</EmitirResponse>
```

Exemplo de resposta de erro:

```xml
<EmitirResponse xmlns="http://tempuri.org/">
  <EmitirResult>
    <Erro>true</Erro>
    <MensagemErro>CNPJ do tomador inválido.</MensagemErro>
    <NumeroNota/>
    <CodigoVerificacao/>
  </EmitirResult>
</EmitirResponse>
```

## Autenticação

A autenticação é feita por **token por requisição** — não há sessão ou cookie.

- Campo: `ChaveAutenticacao` (string), presente em todo `NotaFiscalDTO` e em todas as requisições
- O token é obtido no portal EISS, nas configurações do perfil do usuário/sistema
- Tokens distintos para homologação e produção (ver `ambiente-homologacao.md`)
- O token não expira automaticamente, mas pode ser revogado pelo administrador municipal
- Armazenar em variável de ambiente — nunca em código ou repositório:
  - `EISS_CHAVE_AUTENTICACAO_HML` — token de homologação
  - `EISS_CHAVE_AUTENTICACAO_PRD` — token de produção

## Considerações de Implementação

- **Idempotência:** a operação `Emitir` **não é idempotente**. Em caso de timeout, consultar
  `ConsultarNota` antes de retransmitir para evitar emissão duplicada.
- **Lote vs. unitário:** usar `Emitir` para emissão individual síncrona; `EmitirEmLote` para
  processamento assíncrono com polling via `ConsultarLote`.
- **node-soap:** ao usar com Node.js, configurar `forceSoap12Headers: false` e passar o
  SOAPAction manualmente quando necessário.
