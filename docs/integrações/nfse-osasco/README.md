# NFS-e — Prefeitura de Osasco/SP

Documentação completa da integração com o sistema EISS de emissão de NFS-e do município de Osasco/SP.

## Sistema
- **Fornecedor:** EISS (plataforma municipal)
- **Versão:** 6.0.15.0
- **Protocolo:** SOAP/HTTPS (WCF, document/literal)

## URLs
| Ambiente | Portal | WebService |
|----------|--------|------------|
| Produção | https://nfe.osasco.sp.gov.br | https://nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc |
| Homologação | https://homolog-nfe.osasco.sp.gov.br | https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc |
| WSDL (homolog) | — | https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc?wsdl |
| Manuais | https://nfe.osasco.sp.gov.br/EissnfeWebApp/Portal/Manuais.aspx | — |

## Diferenciação de Ambientes
- Faixa superior **verde** = produção
- Faixa superior **roxa** = homologação
- Campo `Homologacao: boolean` em todas as requisições

## Contato Técnico
- E-mail: nf-e@osasco.sp.gov.br

## Arquivos desta pasta
| Arquivo | Conteúdo |
|---------|---------|
| eiss-webservice.md | Operações SOAP disponíveis, estrutura de request/response |
| estrutura-xml.md | Campos do NotaFiscalDTO, PessoaDTO, EnderecoDTO |
| ambiente-homologacao.md | Setup do ambiente de testes, credenciais, procedimentos |
| exemplos/emitir-request.xml | Exemplo de requisição de emissão |
| exemplos/emitir-response.xml | Exemplo de resposta de emissão |
| exemplos/cancelar-request.xml | Exemplo de requisição de cancelamento |
| exemplos/consultar-request.xml | Exemplo de requisição de consulta |
| codigos-erro.md | Códigos de retorno e tratamento de erros |

## Reforma Tributária (RTC)
O WSDL já expõe métodos `RTC_*` para o novo modelo da Reforma Tributária do Consumo.
A integração deve suportar ambos os modelos (padrão e RTC) com feature flag.
