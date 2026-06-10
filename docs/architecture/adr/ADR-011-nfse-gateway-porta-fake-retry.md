# ADR-011 — Gateway NFS-e: Porta + Fake Determinístico + Estratégia de Retry

- **Data:** 2026-06-08
- **Status:** Aceita
- **Autores:** sammuka
- **ADRs relacionados:** ADR-006 (NFS-e EISS), ADR-009 (captura física / porta+fake), ADR-010 (driver serial adiado)

---

## Contexto

A emissão de NFS-e via EISS (Prefeitura de Osasco-SP) é um ponto de integração externa crítico
para o faturamento (F6a). O EISS é um webservice SOAP com comportamento assíncrono não confiável:
retorna HTTP 200 com `Erro: true` para erros de negócio, pode silenciar timeouts sem resposta,
e pode emitir a nota sem confirmar na resposta (bug raro documentado).

Premissas vinculantes do projeto (RA-03 / RA-05):
- Integrações externas devem ser **isoladas em gateways**: o restante do sistema depende
  somente de interfaces (DI tokens), nunca de drivers concretos.
- O caminho de falha (timeout, HTTP 500, EISS fora do ar) deve ser **testável sem rede**.
- A chave de autenticação EISS (`ChaveAutenticacao`) é um segredo que **jamais deve ser
  persistido em banco de dados ou aparecer em logs**.

O padrão porta+fake já foi estabelecido para hardware (ADR-009/ADR-010) e é reutilizado aqui.

---

## Decisão

### 1. Porta `NfseGateway` com DI token `NFSE_GATEWAY`

Definida em `src/integracoes/nfse/nfse.types.ts`. Três métodos:

```typescript
interface NfseGateway {
  emitir(req: EmitirNfseRequest): Promise<NfseResultado>;
  cancelar(req: CancelarNfseRequest): Promise<NfseResultado>;
  consultarNotaCompleta(req: ConsultarNfseRequest): Promise<NfseResultado>;
}
```

O `NfseResultado` carrega sempre o campo `erro: boolean`. HTTP 200 com `erro: true` é
**falha de negócio** — nunca gravar sucesso sem confirmar `erro === false`.

### 2. Adapter real: `EissClientAdapter`

Stub em `src/integracoes/nfse/eiss-client.adapter.ts`. Lança `NfseTransporteError` com
mensagem informativa até que o driver `node-soap` seja configurado para o ambiente de
homologação EISS. Ativo quando `NFSE_FAKE` não é `'1'`.

Planejamento da implementação completa:
- SOAP document/literal, `forceSoap12Headers: false`
- Timeout 30s via `axios`/`node-soap` options
- `ChaveAutenticacao` injetada apenas no momento do envio — nunca armazenada no adapter
- `redigirSegredos()` aplicado antes de qualquer log

### 3. Fake determinístico: `FakeNfseGateway`

Definido em `src/integracoes/nfse/fake-nfse.gateway.ts`. Quatro cenários controláveis:

| Cenário | emitir/cancelar | consultarNotaCompleta |
|---------|----------------|----------------------|
| `sucesso` | `{ erro: false, numeroNota: 'FAKE-001', ... }` | depende de `consultarAchaNota` |
| `erro_negocio` | `{ erro: true, mensagemErro: 'CNPJ do tomador inválido.' }` | depende de `consultarAchaNota` |
| `timeout` | lança `NfseTransporteError` (retriável) | sempre retorna (nunca lança) |
| `http500` | lança `NfseTransporteError` (retriável) | sempre retorna (nunca lança) |

A consulta nunca lança exceção porque é usada para diagnóstico — mesmo que o EISS esteja
instável, precisamos de uma resposta determinística para decidir se retransmitir.

### 4. Módulo: `NfseModule`

`@Global()` em `src/integracoes/nfse/nfse.module.ts`. Seleção do provider via:

```typescript
const usarFake = process.env.NFSE_FAKE === '1';
```

Setado em `jest.config.cjs` antes de qualquer import de módulo, garantindo que todos os
testes resolvem o fake.

### 5. Payload builder + redação de segredos

`src/integracoes/nfse/payload-builder.ts` contém duas funções puras:

- `montarPayloadEiss()`: monta `EmitirNfseRequest` **sem** `chaveAutenticacao` a partir
  dos dados do pedido. O campo é omitido intencionalmente — injete-o só no adapter.
- `redigirSegredos()`: percorre recursivamente objetos/arrays e substitui campos sensíveis
  (`chaveAutenticacao`, `ChaveAutenticacao`, `chave_autenticacao`) por `'***REDACTED***'`.

---

## Reconciliação de Nomenclatura: `faturamentos` vs `notas_fiscais`

Durante a implementação da F6a foi identificada uma divergência entre documentos:

- `docs/integrações/nfse-osasco/codigos-erro.md` refere campos EISS (`numero_nfse`,
  `codigo_verificacao`, `status_nfse`) na tabela `faturamentos`.
- ADR-006 e o schema T1 definem uma tabela `notas_fiscais` separada.

**Resolução (esta ADR):**

| Tabela | Cardinalidade | Responsabilidade |
|--------|--------------|-----------------|
| `faturamentos` | 1 por caminhão/expedição | Cabeçalho de consolidação; referencia a expedição e agrega os documentos |
| `notas_fiscais` | N por faturamento (1 por pedido) | Documento fiscal individual; armazena `numero_nfse`, `codigo_verificacao`, `status_nfse`, `tentativas_emissao`, `ultimo_erro_nfse`, `emitida_em`, `cancelada_em` |

A coluna `status_nfse` em `notas_fiscais` usa `TEXT CHECK` com os valores:
`pendente | emitida | erro_emissao | cancelada | erro_cancelamento`.

O arquivo `codigos-erro.md` foi atualizado com nota de reconciliação apontando para esta ADR.

---

## Estratégia de Retry (responsabilidade do `FaturamentoService`)

O retry é controlado pelo serviço de domínio, **não** pelo adapter. O gateway apenas
classifica a falha: `NfseTransporteError` (retriável) vs. `NfseResultado.erro = true` (não retriável).

```
Tentativa 1 → falha NfseTransporteError → aguardar 5s  → Tentativa 2
Tentativa 2 → falha NfseTransporteError → aguardar 10s → Tentativa 3
Tentativa 3 → falha NfseTransporteError → aguardar 20s → ERRO_EMISSAO
```

### Regra especial para timeout

Antes de retransmitir após `NfseTransporteError` com semântica de timeout, o serviço
**deve** chamar `consultarNotaCompleta` para verificar se o EISS processou a requisição:

```
NfseTransporteError (timeout)
  └─> consultarNotaCompleta(numeroRps, serieRps)
        ├─> nota encontrada  → capturar numeroNota, marcar EMITIDA (não retransmitir)
        └─> nota não encontrada → retransmitir com backoff
```

Isso evita a anti-nota-fantasma: emitir a mesma nota duas vezes por retransmissão cega.

---

## Invariantes de Segurança (vinculantes)

1. **Anti-nota-fantasma:** HTTP 200 com `erro: true` é FALHA. Nunca gravar `status = 'emitida'`
   sem confirmar `NfseResultado.erro === false` e `numeroNota` preenchido.

2. **Anti-dupla-emissão:** A criação do registro em `notas_fiscais` usa `INSERT ... ON CONFLICT DO NOTHING`
   com índice único parcial `(faturamento_id, pedido_id) WHERE status_nfse != 'cancelada'`.
   Nenhuma conexão de banco é retida durante I/O SOAP ou backoff (transações curtas).

3. **Redação de segredos:** `ChaveAutenticacao` nunca aparece em banco, logs ou traces.
   O payload persistido usa sempre `redigirSegredos()`. O campo é lido de variável de
   ambiente `EISS_CHAVE_AUTENTICACAO` e injetado no adapter imediatamente antes do envio.

---

## Consequências

### Positivas

- Testes unitários e e2e do faturamento não dependem de rede nem de homologação EISS.
- Os quatro cenários do fake cobrem 100% dos caminhos de decisão do `FaturamentoService`.
- `payload-builder.ts` é uma função pura: testável sem NestJS, sem banco, sem SOAP.
- A chave de autenticação EISS não vaza em logs ou banco — redação garantida por arquitetura.
- Padrão consistente com ADR-009/ADR-010 (hardware): a equipe já conhece o idioma.

### Negativas / Trade-offs

- `EissClientAdapter` é um stub — a integração SOAP real deve ser implementada antes da
  entrada em homologação. O erro informativo (`use NFSE_FAKE=1`) evita surpresas em produção.
- O retry por backoff está no `FaturamentoService` (não no adapter), o que é correto para
  transações curtas, mas exige cuidado para não reter conexões de banco durante o backoff.
- Timeouts recorrentes em produção exigem fila assíncrona (`BullMQ`) para não bloquear o
  operador. Esse enfileiramento é adiado para F6b/hardening (follow-up abaixo).

---

## Follow-up (fora do escopo desta ADR)

- **F6b / hardening:** Integrar `BullMQ` para enfileirar emissões com timeout recorrente,
  com delay configurável (padrão: 5 minutos) e alerta por e-mail/WebSocket ao faturista.
- **Implementação real do `EissClientAdapter`:** driver `node-soap` com SOAPAction manual,
  certificate pinning opcional, e consulta de alíquota via EISS (se disponível).
- **Monitoramento:** métrica `nfse_tentativas_total` (Prometheus/Pino) para detectar
  degradação do EISS antes que o timeout esgote as 3 tentativas.
