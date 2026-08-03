# NFS-e — Prefeitura de Osasco/SP

Documentação completa da integração com o sistema EISS de emissão de NFS-e do município de Osasco/SP.

> **Revisado em 2026-08-02** contra os manuais oficiais do portal: *Geração de NF-E via Web
> Service V10.6* (Set/2024, modelo padrão) e *Geração de NFS-e Via Web Service 2.0* (Jan/2026,
> modelo RTC). Correções aplicadas: namespaces reais do envelope, campo `Atividade` (não
> `CodigoServico`), request sem objeto `Prestador`, retorno com `NotaFiscalGerada`, campos RTC
> obrigatórios, e obtenção de credenciais por auto-atendimento (sem depender da prefeitura).

## Sistema
- **Fornecedor:** EISS (plataforma municipal)
- **Protocolo:** SOAP/HTTPS (WCF, document/literal)
- **Regra de corte RTC:** notas com referência fiscal ≥ 2026 de emissor não-Simples usam
  obrigatoriamente os métodos `RTC_*`; Simples Nacional e referências < 2026 usam os legados.

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

## Credenciais (auto-atendimento)
A `ChaveAutenticacao` é gerada **pelo próprio contribuinte** no portal (menu Notas Fiscais →
"Web Service – Gerar Chave Autenticação"), pelo usuário indicado na Autorização de Emissão de
NFS-e — não há solicitação à prefeitura. Homologação usa o mesmo usuário/senha da produção.
Ver `ambiente-homologacao.md`.

## Contato Técnico
- E-mail: nf-e@osasco.sp.gov.br (suporte; não é necessário para obter credenciais)

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
