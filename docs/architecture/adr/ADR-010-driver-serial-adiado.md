# ADR-010 — Driver serial físico adiado: gateways de hardware por interface + fake (F4b)

**Data:** 2026-06-07
**Status:** Aceita
**Decisores:** Quality Owner + Arquitetura
**Relaciona-se com:** ADR-009 (modo de captura e fallback manual), RA-03 (gateways isolados), RA-05 (sem falha silenciosa), doc 012 §6.1/§6.3/§11, doc 018 (topologia on-premises)
**Aplica-se a:** F4b (pesagem + leitura QR + etiqueta) e antecipa F5 (conferência QR)

## Contexto

A F4b introduz a captura física (balança, leitor QR, impressora de etiquetas). O ADR-009 exige que
toda captura seja mediada por um **gateway isolado** (RA-03) e que o backend dependa **da interface**,
nunca do driver. Os drivers físicos reais (balança via `node-serialport` RS-232, leitor, impressora)
vivem num **gateway local on-premises** (doc 018) que ainda não foi provisionado, e `node-serialport`
é uma dependência **nativa** (node-gyp) que adicionaria risco de build no CI Linux e superfície de
`npm audit` sem entregar valor de teste — quem cobre o fallback é o **fake** (ADR-009).

## Decisão

O backend da F4b expõe e consome os gateways **somente por interface + DI token**
(`BalancaGateway`/`LeitorGateway`/`ImpressoraGateway`, tokens `BALANCA_GATEWAY`/`LEITOR_GATEWAY`/
`IMPRESSORA_GATEWAY`). Há duas famílias de implementação, escolhidas por env (`HARDWARE_FAKE`):

1. **Fakes controláveis** (CI/testes): simulam `disponivel`/`instavel`/`indisponivel` e leituras
   determinísticas. É o que torna o fallback de indisponibilidade **testável sem hardware** (ADR-009).
2. **Adapters reais mínimos** (produção, hoje): **stub** que reporta sempre `indisponivel`. A balança
   e o leitor **lançam** na leitura automática (forçando o caminho manual assistido autorizado); a
   impressora é **best-effort** — não lança, devolve `impresso=false` + erro, para a etiqueta lógica
   avançar e a impressão física ficar pendente até o driver entrar.

O driver serial físico (`node-serialport`) e a integração real da impressora ficam **adiados** para a
fase de infraestrutura on-premises, quando o gateway local for provisionado. Trocar o stub pelo driver
real é trocar a `useClass` do `HardwareModule` — **nenhuma** mudança nos services de domínio.

### Regras vinculantes

- O backend nunca importa um driver concreto; depende só do token/interface (RA-03).
- Indisponibilidade do dispositivo é **estado visível + evento observável** (`dispositivo_status_alterado`),
  nunca silenciosa (RA-05). O stub real `indisponivel` é coerente com isso.
- A operação **não trava** com hardware ausente: pesagem segue por captura manual assistida (ADR-009);
  a etiqueta lógica avança mesmo com impressora `indisponivel` (impressão física vira pendente/reimpressão).
- O sistema **não inventa valor**: leitura automática indisponível → erro explícito, sem default.

## Consequências

### Positivas
- CI estável (sem build nativo / sem findings de `npm audit` por `node-serialport`).
- Fallback 100% coberto por teste via fake (ADR-009 §"testável com fake").
- Caminho de entrada do driver real é uma troca de provider — custo de integração isolado.

### Negativas / Trade-offs
- Em produção, nesta fase, **toda** captura de peso passa pelo manual assistido (a balança real está
  `indisponivel`) e toda etiqueta fica com impressão física pendente — esperado até o gateway local.

### Riscos
- Esquecer de trocar o provider ao provisionar o hardware: mitigado porque o status `indisponivel`
  é visível/observável (RA-05) — a ausência do driver aparece na UI e na KPI de captura manual.

## Alternativas Consideradas

- **`node-serialport` como dependência direta agora:** maior fidelidade, mas risco de build nativo no
  CI e superfície de audit sem cobertura de teste adicional (o fake já cobre). Descartada para F4b.
- **Adapter real plugável com carga lazy:** viável, mas ainda exige a dependência no `package.json`.
  Adiada junto com o provisionamento do gateway on-premises.

## Referências
- ADR-009 (modo de captura e fallback manual assistido)
- doc 012 §6.1 (balança), §6.3 (QR), §11 (equipamentos), RA-03, RA-05
- doc 018 (topologia on-premises dos gateways)
- docs/governance/quality-gates.md → F4b
