# Ambiente de Homologação NFS-e — EISS Osasco

> **Fonte oficial:** manual *Geração de NFS-e Via Web Service 2.0* (Jan/2026), seções "Ambiente
> de Testes (Homologação)" e "Chave de Autenticação". Nota: o manual V10.6 (2024) dizia que não
> existia ambiente separado (apenas a tag `Homologacao`); o manual 2.0 supersede — o ambiente
> dedicado existe e os testes devem ocorrer **exclusivamente** nele.

## URLs

| Ambiente | Portal (web) | End-point Web Service |
|----------|-------------|----------------------|
| Homologação | https://homolog-nfe.osasco.sp.gov.br | https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc (`?wsdl`) |
| Produção | https://nfe.osasco.sp.gov.br | https://nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc (`?wsdl`, `?singleWsdl`) |

Identificação visual: faixa superior **roxa** = homologação; **verde** = produção.

## Como obter as credenciais (auto-atendimento — NÃO depende da prefeitura)

O acesso ao portal de homologação usa **o mesmo usuário e senha da produção**. A
`ChaveAutenticacao` é gerada pelo próprio contribuinte, sem solicitação à Secretaria:

1. O contribuinte precisa ter **Inscrição Municipal em Osasco** e **Autorização de Emissão de
   NFS-e** ativa (pré-requisitos de negócio — providência do cliente, não da prefeitura).
2. O usuário indicado na Autorização de Emissão acessa o portal de **homologação**
   (https://homolog-nfe.osasco.sp.gov.br) com as credenciais de produção.
3. Menu **Notas Fiscais → "Web Service – Gerar Chave Autenticação"** → botão **Gerar Chave**.
4. O manual recomenda: no ambiente de homologação, **alterar a senha do usuário** e **gerar uma
   chave exclusiva de testes**, para impedir que testes acabem emitindo notas oficiais.
5. Repetir o passo 3 no portal de **produção** quando for ativar a emissão real
   (`EISS_CHAVE_AUTENTICACAO_PRD`).

Atenção: cada clique em "Gerar Chave" **revoga a chave anterior** daquela Inscrição Municipal.

Suporte (só se necessário): nf-e@osasco.sp.gov.br.

## Comportamento das notas de homologação

- `Homologacao=true` executa **todas as validações e regras de negócio**, mas não grava a nota
  em definitivo nem incrementa a sequência numérica do contribuinte.
- Notas de teste: marca d'água de homologação, **sem numeração oficial e sem valor fiscal**.
- Visualização: menu *"Pesquisar NF-E de Teste (Homologação)"*; excluídas ~30 dias após geração
  (ou quando o ambiente é atualizado).
- **Cancelamento de notas de teste não é possível** (não há registro definitivo) — o teste E2E
  de `Cancelar` valida apenas o contrato de transporte/erro, não um cancelamento efetivo.
- Em produção, notas são oficiais e **integradas ao ADN (Administrador de Dados Nacional) da
  Receita Federal** — geram imposto e podem constituir débito tributário.

## Procedimento de teste End-to-End

1. Configurar `EISS_HOMOLOGACAO=true` e `EISS_CHAVE_AUTENTICACAO_HML` no `.env`.
2. Emissão unitária (`Emitir` ou `RTC_EmitirNFE` conforme referência fiscal): verificar
   `Erro=false` e `NotaFiscalGerada` com `Numero`, `Autenticador` e `Link`.
3. Consultar a nota (`Consultar`/`ConsultarNotaCompleta`) pelo `Identificador` ou período.
4. Testar caminho de erro de negócio (ex. `Atividade` não autorizada) → `Erro=true` +
   `MensagemErro` legível.
5. Testar timeout/retry: confirmar que o serviço consulta antes de retransmitir.
6. `Cancelar`: validar apenas o contrato (ver limitação acima).

## Variáveis de ambiente

```env
EISS_HOMOLOGACAO=true
EISS_CHAVE_AUTENTICACAO_HML=<chave gerada no portal de homologação>
EISS_CHAVE_AUTENTICACAO_PRD=<chave gerada no portal de produção>
EISS_ENDPOINT_HML=https://homolog-nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc
EISS_ENDPOINT_PRD=https://nfe.osasco.sp.gov.br/EissnfeWebServices/NotaFiscalEletronica.svc
EISS_TIMEOUT_MS=30000
EISS_RETRY_MAX=3
EISS_RETRY_DELAY_MS=5000
```

## Manuais oficiais (portal Manuais.aspx, conferido em 2026-08-02)

| Manual | Versão | Relevância |
|--------|--------|-----------|
| Geração de NFS-e Via Web Service | 2.0 (Jan/2026) | **Principal** — métodos RTC + regra de corte 2026 |
| Geração de NF-E via Web Service | 10.6 (Set/2024) | Modelo padrão detalhado (campos/regras do `Emitir`) |
| Emissão de NFS-e (portal) | — | Emissão manual via site |
| Modelo RPS-RTC | 1.01 | Conversão de RPS (não usado) |
| Nota de Repasse R1 / R2 | 2.0 | Exige Regime Especial — fora de escopo |
| Exportação CSV / Construção Civil / COSIF | — | Fora de escopo |

## Notas de integração

- Sempre HTTPS (TLS 1.2+); timeout 30s por chamada.
- Em timeout, **verificar se a nota foi emitida antes de retransmitir** (`Consultar` por
  `Identificador`) — `Emitir` não é idempotente.
- Retry com backoff exponencial: 5s, 10s, 20s (máx. 3 tentativas) — somente para
  `NfseTransporteError`; erro de negócio (`Erro=true`) NÃO é retriável.
- Emissões serializadas por prestador (a sequência numérica municipal trava durante a geração).
- Logar o XML bruto de request/response para auditoria — com `ChaveAutenticacao` redigida.
