# Códigos de Erro — EISS NFS-e Osasco

> **Reconciliação (ADR-011, 2026-06-08):** Os campos EISS listados neste documento
> (numero_nfse, codigo_verificacao, status_nfse, etc.) residem na tabela `notas_fiscais`,
> não em `faturamentos`. A tabela `faturamentos` é o cabeçalho de consolidação (1 por
> caminhão); `notas_fiscais` é o documento fiscal (N por faturamento, 1 por pedido).
> Ver ADR-011 para detalhes.

Referência de erros retornados pelo webservice EISS da Prefeitura de Osasco-SP, estratégia de
retry e mapeamento para os status internos do sistema AlphaCarnes.

---

## Estrutura de ResponseBase

Todo método do EISS retorna um objeto com `Erro` + `MensagemErro`; a emissão agrupa os dados da
nota em `NotaFiscalGerada` (estrutura real do manual V10.6):

```
Erro: boolean           — true se houve erro na operação
MensagemErro: string    — descrição legível do erro (preenchido quando Erro = true)
NotaFiscalGerada:       — presente apenas em sucesso de emissão
  Numero: int           — número sequencial da NFS-e emitida
  Autenticador: string  — código de autenticidade da nota (validação pública)
  Link: string          — link direto à nota (o mesmo enviado ao tomador)
  Identificador: string — eco do identificador interno (nº do pedido) enviado no request
```

O EISS **não usa códigos de erro numéricos** — a identificação é pela `MensagemErro` textual
(tabela abaixo). Regra: verificar **sempre** o campo `Erro` antes de ler `NotaFiscalGerada`.
Um HTTP 200 não garante sucesso — o EISS retorna HTTP 200 com `Erro: true` para erros de negócio.

---

## Erros conhecidos do EISS

| Mensagem de erro | Causa | Retriável | Ação corretiva |
|-----------------|-------|-----------|----------------|
| "Chave de autenticação inválida" | Token expirado ou incorreto | Não | Verificar `EISS_CHAVE_AUTENTICACAO` no `.env` |
| "Nota não encontrada" | `NumeroNota` inexistente no sistema EISS | Não | Verificar número antes de tentar cancelar ou consultar |
| "Nota já cancelada" | Tentativa de cancelar nota que já está cancelada | Não | Verificar status da nota antes de enviar cancelamento |
| "Prazo de cancelamento expirado" | Prazo municipal para cancelamento venceu | Não | Contatar Secretaria de Finanças de Osasco |
| "CNPJ do prestador não autorizado" | CNPJ não cadastrado ou não habilitado no sistema EISS | Não | Verificar cadastro no portal da prefeitura |
| "Alíquota inválida para o serviço" | Alíquota não corresponde ao código de serviço informado | Não | Verificar tabela de alíquotas do município para o código de serviço |
| "Campo obrigatório ausente: {campo}" | Campo required não enviado no payload | Não | Adicionar o campo indicado ao payload antes de reenviar |
| "Valor deve ser maior que zero" | Valor do serviço ou alíquota zerado ou negativo | Não | Validar payload com Zod antes de enviar |
| "Serviço temporariamente indisponível" | Instabilidade pontual do servidor EISS | Sim | Retry com backoff exponencial: 5s → 10s → 20s |
| "Internal Server Error" / HTTP 500 | Erro interno não tratado no EISS | Sim (máx. 3x) | Retry; se persistir após 3 tentativas, logar e alertar equipe |
| Timeout (sem resposta em 30s) | Sobrecarga ou instabilidade do servidor EISS | Sim (máx. 3x) | Consultar `ConsultarNotaCompleta` antes de retransmitir |
| Connection refused | EISS fora do ar ou inacessível na rede | Sim | Aguardar e retry; notificar operação se persistir |

---

## Estratégia de retry

### Erros retriáveis

- Timeout (sem resposta em 30 segundos)
- HTTP 500 / "Internal Server Error"
- Connection refused
- "Serviço temporariamente indisponível"

### Erros NÃO retriáveis (falha imediata)

- Autenticação inválida (`Chave de autenticação inválida`)
- Nota não encontrada, já cancelada, prazo expirado
- CNPJ não autorizado
- Campo obrigatório ausente
- Valor inválido
- Alíquota inválida

### Backoff exponencial

```
Tentativa 1  →  aguardar 5s  →  Tentativa 2
Tentativa 2  →  aguardar 10s →  Tentativa 3
Tentativa 3  →  aguardar 20s →  Falha definitiva
```

Máximo de **3 tentativas** por operação. Após esgotar as tentativas, marcar a nota como
`ERRO_EMISSAO` (ou `ERRO_CANCELAMENTO`) e alertar a equipe de faturamento.

### Regra especial para timeout

Antes de retransmitir após um timeout, **sempre consultar** se a nota foi emitida via
`ConsultarNotaCompleta`. O EISS pode ter processado a requisição mas não devolvido a resposta
a tempo. Retransmitir sem consultar pode gerar duplicidade.

```
timeout detectado
  └─> ConsultarNotaCompleta(NumeroRps, SerieRps)
        ├─> nota encontrada  → capturar NumeroNota, marcar como EMITIDA (não retransmitir)
        └─> nota não encontrada → retransmitir com backoff
```

---

## Mapping para erros internos do sistema

```typescript
// Enum de status de NFS-e no sistema AlphaCarnes
// Armazenado como TEXT CHECK na coluna status_nfse (tabela faturamentos)
enum StatusNfse {
  PENDENTE           = 'pendente',           // aguardando emissão
  EMITIDA            = 'emitida',            // emitida com sucesso
  ERRO_EMISSAO       = 'erro_emissao',       // falha após 3 tentativas
  CANCELADA          = 'cancelada',          // cancelada com sucesso
  ERRO_CANCELAMENTO  = 'erro_cancelamento',  // falha ao cancelar
}
```

Transições válidas:

```
PENDENTE → EMITIDA             (emissão bem-sucedida)
PENDENTE → ERRO_EMISSAO        (3 tentativas esgotadas)
EMITIDA  → CANCELADA           (cancelamento bem-sucedido)
EMITIDA  → ERRO_CANCELAMENTO   (3 tentativas de cancelamento esgotadas)
ERRO_EMISSAO → PENDENTE        (reprocessamento manual autorizado pelo faturista)
```

Campos adicionais na tabela `faturamentos` para rastreabilidade:

```
numero_nfse          TEXT        — número retornado pelo EISS
codigo_verificacao   TEXT        — código de autenticidade
link_nfse            TEXT        — URL de visualização no portal
tentativas_emissao   INTEGER     — contador de tentativas (default 0)
ultimo_erro_nfse     TEXT        — última mensagem de erro retornada
emitida_em           TIMESTAMPTZ — data/hora de emissão confirmada
cancelada_em         TIMESTAMPTZ — data/hora de cancelamento confirmado
```

---

## Diagnóstico de problemas comuns

### Nota emitida mas sem número retornado

**Sintoma:** `Erro: false`, mas `NumeroNota` está vazio ou nulo na resposta.

**Causa provável:** Bug raro no EISS onde a nota é gravada mas a resposta é truncada.

**Ação:**
1. Aguardar 30 segundos.
2. Chamar `ConsultarNotaCompleta` com o `NumeroRps` e `SerieRps` enviados.
3. Se a consulta retornar a nota, capturar `NumeroNota` e `CodigoVerificacao` dela.
4. Se não retornar após 2 minutos, acionar suporte EISS com o timestamp da requisição.

---

### Timeout recorrente

**Sintoma:** Requests para o EISS demoram mais de 30s consistentemente durante um período.

**Causa provável:** Sobrecarga do servidor EISS em horários de pico (geralmente entre 8h–10h e
17h–19h) ou manutenção não comunicada.

**Ação:**
1. Verificar o portal de status da prefeitura (se disponível).
2. Não retransmitir sem consultar antes (risco de duplicidade).
3. Enfileirar as notas pendentes em `BullMQ` com delay de 5 minutos.
4. Se o timeout persistir por mais de 2 horas, alertar a equipe de faturamento para contato
   com a Secretaria de Finanças de Osasco.

---

### CNPJ rejeitado

**Sintoma:** Erro "CNPJ do prestador não autorizado" mesmo com o CNPJ correto no payload.

**Causas possíveis:**
- CNPJ digitado com pontuação (enviar apenas dígitos: `12345678000190`).
- Inscrição municipal não cadastrada ou suspensa no EISS.
- Ambiente de homologação com CNPJ diferente do de produção.

**Ação:**
1. Confirmar que `EISS_CNPJ_PRESTADOR` no `.env` contém apenas os 14 dígitos (sem `.`, `/`, `-`).
2. Verificar se `Homologacao: true/false` corresponde ao ambiente correto.
3. Acessar o portal EISS da prefeitura e confirmar o cadastro da empresa.
4. Se o ambiente for de produção, contatar a Secretaria de Finanças para verificar habilitação.

---

### Diferença de alíquota

**Sintoma:** Erro "Alíquota inválida para o serviço" para o código `14.05`.

**Causa:** A alíquota de ISS para o código de serviço `14.05` (distribuição) pode ser revisada
pela prefeitura via Lei municipal. A alíquota padrão em Osasco para serviços de distribuição
é **5% (0.0500)**, mas pode ser alterada.

**Ação:**
1. Verificar a tabela de alíquotas vigente no portal da Prefeitura de Osasco
   (`https://osasco.sp.gov.br/iss`).
2. Atualizar a constante `EISS_ALIQUOTA_ISS` no `.env` se houver mudança.
3. Não hardcodar a alíquota no código — sempre ler de configuração.
4. Considerar implementar endpoint de consulta de alíquota no EISS (se disponível) para
   validação automática antes da emissão.
