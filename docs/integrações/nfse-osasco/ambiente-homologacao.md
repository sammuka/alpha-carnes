# Ambiente de Homologação NFS-e — EISS Osasco

## URL Base
https://homolog-nfe.osasco.sp.gov.br

## Identificação Visual
Faixa superior **roxa** no portal (verde = produção).

## Campo Homologacao nas Requisições
**OBRIGATÓRIO** definir `Homologacao: true` em todas as requisições de teste.
Requisições com `Homologacao: false` em homologação podem gerar notas reais ou erros.

## Acesso ao Portal de Homologação
1. Acessar https://homolog-nfe.osasco.sp.gov.br
2. Cadastrar usuário de teste (ou usar credenciais fornecidas pela prefeitura)
3. Obter `ChaveAutenticacao` do usuário de teste nas configurações do perfil

## Credenciais de Teste
- Solicitar junto à Secretaria de Finanças: nf-e@osasco.sp.gov.br
- A `ChaveAutenticacao` de homologação deve ser armazenada em `EISS_CHAVE_AUTENTICACAO_HML`

## Procedimento de Teste End-to-End
1. Configurar `EISS_HOMOLOGACAO=true` e `EISS_CHAVE_AUTENTICACAO_HML` no `.env`
2. Executar teste de emissão unitária (`Emitir`)
3. Verificar resposta: `Erro: false`, número da nota gerado
4. Consultar nota emitida (`ConsultarNotaCompleta`) pelo número retornado
5. Cancelar nota de teste (`Cancelar`) com motivo "Teste de cancelamento"
6. Verificar cancelamento (`Consultar`)

## Variáveis de Ambiente Necessárias
```env
EISS_HOMOLOGACAO=true
EISS_CHAVE_AUTENTICACAO_HML=<token-de-homologacao>
EISS_CHAVE_AUTENTICACAO_PRD=<token-de-producao>
EISS_ENDPOINT_HML=https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc
EISS_ENDPOINT_PRD=https://nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc
EISS_TIMEOUT_MS=30000
EISS_RETRY_MAX=3
EISS_RETRY_DELAY_MS=5000
```

## Manuais Disponíveis no Portal
| Manual | Caminho no Portal |
|--------|------------------|
| Geração de NFS-e via Web Service 2.1 | /EissnfeWebApp/Portal/Manual/Geracao de NFS-e Via Web Service 2.1.pdf |
| Passos Iniciais | /EissnfeWebApp/Portal/Manual/Passos_Iniciais_para_Utilizacao_Sistema.pdf |
| Modelo RPS-RTC V1.01 | /EissnfeWebApp/Portal/Manual/Modelo RPS-RTC V1.01.pdf |
| Emissão de NFS-e | /EissnfeWebApp/Portal/Manual/Emissao_de_NFe.pdf |

## Notas de Integração
- Sempre usar HTTPS (TLS 1.2+)
- Timeout recomendado: 30 segundos por chamada
- Em caso de timeout, verificar se a nota foi emitida antes de retransmitir (usar `ConsultarNota`)
- Retry com backoff exponencial: 5s, 10s, 20s (máximo 3 tentativas)
- Logar sempre o XML bruto de request e response para auditoria
