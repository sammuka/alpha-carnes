# ADR-006 — Integração NFS-e: EISS Osasco-SP via SOAP

**Data:** 2026-06-04
**Status:** Aceita

## Contexto
A AlphaCarnes emite NFS-e (Nota Fiscal de Serviços Eletrônica) pela Prefeitura de Osasco-SP.
O sistema municipal usa a plataforma **EISS versão 6.0.15.0** com WebService SOAP.
A integração é obrigatória e não tem alternativa de fornecedor (prefeitura define o sistema).

## Decisão
Implementaremos um **serviço isolado de NFS-e** no backend que encapsula toda a comunicação SOAP com o EISS, expondo uma API REST interna para o módulo de faturamento.

### Endpoints EISS utilizados (produção e homologação)
| Ambiente | URL Base |
|----------|----------|
| Produção | `https://nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc` |
| Homologação | `https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc` |
| WSDL Homologação | `https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc?wsdl` |

### Operações implementadas (fase inicial)
| Método SOAP | Uso |
|------------|-----|
| `Emitir` | Emissão unitária de NFS-e |
| `EmitirEmLote` | Emissão em lote (async) |
| `ConsultarLote` | Polling de resultado do lote |
| `Cancelar` | Cancelamento de NFS-e |
| `ConsultarNotaCompleta` | Consulta completa pós-emissão |

### Estrutura do serviço
```
backend/src/services/nfse/
├── eiss-client.ts          ← cliente SOAP (node-soap)
├── nfse-service.ts         ← orquestração (emitir, cancelar, consultar)
├── payload-builder.ts      ← monta NotaFiscalDTO a partir dos dados do pedido
├── nfse-queue.ts           ← fila BullMQ para reprocessamento
└── types/
    ├── emissao.types.ts    ← tipos TypeScript mapeando o WSDL
    └── cancelamento.types.ts
```

### Autenticação EISS
- Campo `ChaveAutenticacao` em todas as requisições (token de usuário/sistema)
- Campo `Homologacao: boolean` para distinguir ambientes
- Armazenado em variável de ambiente: `EISS_CHAVE_AUTENTICACAO`, `EISS_HOMOLOGACAO=true/false`

### Campos obrigatórios identificados no WSDL (NotaFiscalDTO)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `Aliquota` | decimal | Alíquota ISS |
| `Homologacao` | boolean | true = homologação |
| `Valor` | decimal | Valor bruto do serviço |
| `ValorDeducao` | decimal | Deduções (pode ser 0) |
| `NotificarTomadorPorEmail` | boolean | Notificar tomador |
| `SubstituicaoTributaria` | boolean | Substituição tributária |
| `Tomador.Nome` | string | Razão social do cliente |
| `Tomador.CNPJ` ou `CPF` | string | Documento do cliente |

### Payload persistido para auditoria
Toda requisição e resposta EISS é armazenada em `notas_fiscais.payload_eiss` (JSONB) com timestamp e status.

## Consequências

### Positivas
- Serviço isolado: falha na NFS-e não impacta o restante da operação
- Fila de reprocessamento: falhas transitórias são retentadas automaticamente
- Auditoria completa: payload completo armazenado em JSONB

### Negativas / Trade-offs
- SOAP é verboso e menos ergonômico que REST; mitigação: node-soap abstrai o XML
- WSDL pode mudar sem aviso; mitigação: versionamento do WSDL local + testes de contrato

### Riscos
- **Instabilidade do EISS:** histórico de prefeituras com sistemas lentos; mitigação: timeout configurável + fila de retry com backoff exponencial
- **Mudança para RTC (Reforma Tributária):** o WSDL já expõe métodos `RTC_EmitirNFE`; a integração deve ser preparada para suportar ambos os modelos de emissão

## Alternativas Consideradas
Não há alternativas: a integração EISS é obrigatória por determinação municipal.

## Referências
- docs/integrações/nfse-osasco/ (documentação completa)
- docs/008-faturamento-emissao-nf-seguro-bloqueios-fiscais-e-liberacao-do-caminhao.md
- WSDL: https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc?wsdl
- Portal de manuais: https://nfe.osasco.sp.gov.br/EissnfeWebApp/Portal/Manuais.aspx
- Contato técnico: nf-e@osasco.sp.gov.br
