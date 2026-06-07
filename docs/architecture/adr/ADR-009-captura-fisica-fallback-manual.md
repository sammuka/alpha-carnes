# ADR-009 — Modo de Captura Física e Fallback Manual Assistido (balança e leitores)

**Data:** 2026-06-07
**Status:** Aceita
**Decisores:** Quality Owner + Arquitetura
**Relaciona-se com:** RA-03 (gateways isolados), RA-05 (sem falha silenciosa), doc 006 §Bloco C (RF-PS-04..07), doc 012 §6.1/§6.3/§11
**Aplica-se a:** F4b (pesagem + leitura QR na associação/etiqueta) e F5 (conferência QR na expedição)

## Contexto

A operação depende de dispositivos físicos: **balança** (RS-232/USB) para o peso real da peça
e **leitores/scanners QR** para resolver peça/subitem na associação, etiquetagem e conferência de
carga. Esses dispositivos **falham e ficam indisponíveis** (cabo, energia, driver, manutenção).

A operação **não pode parar** quando o dispositivo cai: o negócio já trabalha hoje com **balança
manual** e **conferência manual** como contingência. Mas o sistema é a fonte de rastreabilidade —
um valor capturado fora do dispositivo automático **não pode entrar disfarçado** de leitura
automática, nem o sistema pode **inventar** um valor para "não quebrar o fluxo" (proibido pelas
regras do projeto e por RA-05). Os documentos já exigem isto: priorizar leitura automática
(RF-PS-04), exigir **leitura estável ou justificativa** para peso manual (RF-PS-05), **marcar** o
manual para auditoria (RF-PS-06) e registrar operador/horário (RF-PS-07).

Precisamos de um contrato único de captura que sirva para balança e leitores, com fallback manual
**explícito, autorizado, atribuído e auditável**.

## Decisão

Toda captura física é mediada por um **gateway isolado** (RA-03) e gravada com **modo de captura
explícito**. Adotamos dois modos, nunca um terceiro implícito:

1. **`automatico`** — valor lido do dispositivo via gateway, com leitura **estável**.
2. **`manual_assistido`** — valor digitado por um operador **autorizado**, com **motivo
   obrigatório**, quando o dispositivo está indisponível, instável, ou a leitura não estabiliza.

### Regras vinculantes

- **Prioridade do automático (RF-PS-04):** quando o gateway reporta o dispositivo `disponivel` e a
  leitura `estavel`, o modo é `automatico`. O modo `manual_assistido` só é oferecido/forçado quando
  o dispositivo está `indisponivel`/`instavel` **ou** o operador autorizado decide sobrepor com
  justificativa.
- **Status do dispositivo sempre visível e nunca silencioso (RA-05):** o gateway publica saúde do
  dispositivo (`disponivel | instavel | indisponivel`) com heartbeat. A indisponibilidade vira
  **estado visível na UI + evento de domínio/alerta observável** — jamais uma degradação silenciosa.
- **O sistema nunca inventa valor:** em indisponibilidade, **não** há autopreenchimento, valor
  default, nem leitura "presumida". Ou há leitura automática estável, ou há entrada manual humana
  deliberada. Falha de captura sem ação humana → **erro explícito**, não sucesso falso.
- **Autorização (segregação de funções):** entrada manual exige permissão nomeada
  (`PESO_MANUAL` para balança, `LEITURA_MANUAL` para QR/scanner). Default: perfis
  `recebimento_pesagem` e `gestor`/`administrador`. Sem a permissão → 403; o operador comum
  depende do dispositivo ou de um autorizador.
- **Procedência registrada (RF-PS-06/07):** todo registro de captura grava, de forma imutável:
  `modo_captura`, `valor`, `operador_id`, `capturado_em` (timestamptz), e — quando
  `manual_assistido` — `motivo` (CHECK: `dispositivo_indisponivel`, `leitura_instavel`,
  `divergencia_balanca`, `outro`+texto) e um **snapshot do estado do gateway** no momento
  (`gateway_status`, `dispositivo_id`) em JSONB. Quando `automatico`: `leitura_estavel = true` e as
  últimas leituras de apoio podem ser anexadas.
- **Leitura estável ou justificativa (RF-PS-05):** confirmar peso em `automatico` exige
  `leitura_estavel = true`. Se a leitura não estabiliza, só se prossegue em `manual_assistido` com
  `motivo`.
- **Leitores/QR seguem o mesmo contrato:** indisponível o leitor, o operador autorizado **digita o
  identificador** (`modo_captura = manual_assistido`, `motivo`). A resolução do código ainda precisa
  **bater numa peça/subitem real** — entrada manual não dispensa a validação; código que não
  resolve → erro explícito (sem inventar vínculo).
- **Observabilidade para auditoria:** capturas manuais são **consultáveis e contabilizadas** (KPI
  `taxa de captura manual` por dia/operador/dispositivo, alimenta F7). Volume anômalo de manual é
  sinal operacional, não exceção escondida.

### Contrato técnico do gateway (RA-03)

Os gateways de balança e leitor expõem uma **interface única** ao backend, com implementações
intercambiáveis:

- `BalancaGateway` / `LeitorGateway` com `status()` (saúde + heartbeat), `lerEstavel()` (leitura
  com estabilização; rejeita se instável) e eventos de mudança de status.
- O backend depende **da interface**, nunca do driver. Isso isola o hardware **e** torna o caminho
  de indisponibilidade/fallback **testável de forma determinística**: em CI e testes usa-se um
  **gateway fake** que simula `disponivel`/`indisponivel`/`instavel` sem dispositivo físico.
- Gateway roda como serviço local isolado on-premises (ver doc 018); a captura manual independe do
  gateway estar de pé, justamente por ser o caminho de contingência.

## Consequências

### Positivas
- A operação **não para** com a balança/leitor fora do ar, sem abrir mão de rastreabilidade.
- Conformidade direta com RA-03 e RA-05 e com RF-PS-04..07.
- O caminho de indisponibilidade vira **testável** (gateway fake) — o fallback é coberto por teste,
  não só documentado.
- Auditoria e KPI de captura manual dão visibilidade de saúde de hardware e de risco de fraude.

### Negativas / Trade-offs
- Todo registro de peso/leitura carrega metadados de procedência (mais colunas/JSONB e validação).
- Exige permissões e UI de status/fallback — mais superfície que um "input simples".

### Riscos
- **Abuso do manual** (operador sempre no manual para fugir da balança): mitigado por permissão
  dedicada, motivo obrigatório, atribuição e KPI/alerta de taxa de manual.
- **Manual mascarando dispositivo quebrado:** mitigado porque a indisponibilidade é evento/alerta
  observável independente da captura manual — o conserto continua sendo cobrado.

## Alternativas Consideradas

### Alternativa A — Sem fallback (bloquear quando o dispositivo cai)
Parar a pesagem/conferência até o dispositivo voltar. Descartada: para a operação física de uma
distribuidora de carnes, inviável; o negócio já usa balança/conferência manual como contingência.

### Alternativa B — Fallback silencioso (campo editável sem marca)
Deixar o operador digitar o valor num campo comum quando quiser. Descartada: viola RA-05 e a regra
do projeto (nunca inventar/disfarçar dado), destrói a rastreabilidade e abre fraude — não dá para
distinguir leitura real de digitação.

## Referências
- doc 006 §Bloco C (RF-PS-04 a RF-PS-07), §2.6 fluxo de pesagem
- doc 012 §6.1 (Serviço de Balança — fallback manual assistido), §6.3 (QR), §11 (equipamentos), RA-03, RA-05
- doc 017/018 (infraestrutura e topologia on-premises dos gateways)
- docs/governance/quality-gates.md → F4b (invariantes de captura/fallback) e F5 (conferência QR)
