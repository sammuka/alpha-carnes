# 015-roadmap-de-implantacao-fases-riscos-premissas-e-dependencias

## Objetivo do documento
Definir um roadmap sugerido de implantação da solução AlphaCarnes, considerando:
- fases de entrega,
- dependências,
- riscos,
- premissas,
- e priorização do valor de negócio.

---

# 1. Objetivo da implantação

Implantar a solução de forma progressiva, reduzindo risco operacional e permitindo aprendizado real da equipe sem paralisar a operação.

---

# 2. Estratégia recomendada

## 2.1 Estratégia incremental
A implantação deve ocorrer em ondas, começando pelo núcleo de maior valor e risco controlado:
1. compra programada
2. disponibilidade virtual
3. pedidos
4. recebimento/pesagem
5. expedição
6. faturamento
7. dashboards

## 2.2 Motivo
Esse encadeamento respeita o fluxo real do negócio e reduz retrabalho arquitetural.

---

# 3. Fases sugeridas

## Fase 1 — Fundação comercial e planejamento
### Escopo
- cadastros
- compra programada
- regras de desdobramento
- disponibilidade virtual
- pedidos de venda
- bloqueio de overbooking
- painel comercial básico

### Resultado esperado
Controle da venda sobre saldo virtual, fim da lógica manual dispersa nessa etapa.

---

## Fase 2 — Recebimento e pesagem
### Escopo
- recebimento
- divergências
- integração com balança
- tela de pesagem
- sugestão de associação
- etiquetagem inicial

### Resultado esperado
Entrada da operação física no sistema e rastreabilidade inicial da peça.

---

## Fase 3 — Expedição e conferência
### Escopo
- caminhões
- composição de carga
- conferência
- transferência entre pedidos enquanto aberto
- fechamento da expedição

### Resultado esperado
Montagem de carga controlada, bloqueio adequado após fechamento.

---

## Fase 4 — Corte, transformação e rastreabilidade ampliada
### Escopo
- módulo de corte
- subitens
- reetiquetagem
- histórico ponta a ponta

### Resultado esperado
Tratamento robusto das exceções de transformação.

---

## Fase 5 — Faturamento e liberação
### Escopo
- faturamento
- emissão de NF
- seguro
- envio ao motorista
- liberação do caminhão

### Resultado esperado
Fechamento fiscal e documental integrado à operação real.

---

## Fase 6 — Dashboards, alertas e observabilidade
### Escopo
- dashboards executivos e operacionais
- alertas
- painel de ocorrências
- histórico comparativo

### Resultado esperado
Cockpit operacional completo.

---

# 4. Dependências principais

## DP-01
Cadastros mínimos precisam existir antes da compra/pedido.

## DP-02
Compra programada confirmada é pré-requisito para disponibilidade virtual.

## DP-03
Disponibilidade virtual é pré-requisito para pedidos.

## DP-04
Pedidos e planejamento são pré-requisitos para associação sugestiva.

## DP-05
Fechamento de expedição é pré-requisito para faturamento.

## DP-06
Faturamento/NF é pré-requisito para liberação do caminhão.

---

# 5. Riscos principais

## Risco 1 — Resistência operacional
Mitigação:
- telas simples
- treinamento
- implantação assistida

## Risco 2 — Instabilidade de integração com balança/impressora
Mitigação:
- gateway local
- fallback controlado
- testes em bancada

## Risco 3 — Divergências de processo real versus documentação
Mitigação:
- validação contínua em campo
- piloto com operadores-chave

## Risco 4 — Dependência de infraestrutura local
Mitigação:
- checklist de rede/dispositivos
- plano on-prem/cloud claro

## Risco 5 — Complexidade fiscal
Mitigação:
- fasear emissão
- validar regras com faturamento cedo

---

# 6. Premissas de implantação

## PM-01
Haverá operadores-chave disponíveis para validação funcional.

## PM-02
A empresa disponibilizará os dispositivos e infraestrutura mínima necessários.

## PM-03
As regras de negócio críticas serão validadas iterativamente.

## PM-04
A implantação pode conviver por um período com processos paralelos controlados.

---

# 7. Critérios de sucesso por fase

## Fase 1
- saldo virtual confiável
- déficit exige confirmação explícita de overbooking e segue como pendência rastreável, sem tornar saldos negativos nem bloquear o pedido confirmado
- pedidos rastreáveis

## Fase 2
- peso capturado
- peça registrada
- divergência formalizada

## Fase 3
- carga acompanhada em tempo real
- fechamento bloqueando alterações

## Fase 4
- transformação rastreável
- reetiquetagem consistente

## Fase 5
- NF emitida a partir da carga real
- caminhão liberado com rastreabilidade

## Fase 6
- KPIs e alertas confiáveis para gestão

---

# 8. Sequência recomendada de documentação e engenharia
- 001–010: visão funcional e modelo conceitual
- 011: modelo lógico
- 012: arquitetura
- 013: perfis e permissões
- 014: eventos e tempo real
- 015: roadmap
- próximos: APIs, DDL, backlog priorizado, wireframes, matriz de testes

---

# 9. Resultado esperado deste documento
Com este documento, a solução passa a ter uma trilha recomendada de implantação, reduzindo risco e facilitando planejamento técnico, operacional e comercial.
