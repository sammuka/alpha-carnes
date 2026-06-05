# ADR-004 — Comunicação em Tempo Real: WebSocket + Eventos de Domínio

**Data:** 2026-06-04
**Status:** Aceita

## Contexto
Múltiplas telas precisam de atualização em tempo real sem polling:
- Painel operacional: status de recebimento, pesagem, expedição
- Terminal de pesagem: novas peças chegando, alertas
- Dashboard de saldo virtual: atualização ao vender/reservar
- Tela de expedição: peças associadas, status do caminhão

## Decisão
Usaremos **WebSocket nativo** (`ws` no backend, `WebSocket API` no frontend) com um **barramento de eventos de domínio interno** para propagar mudanças de estado.

### Fluxo
1. Operação transacional ocorre no backend (ex: associar peça a pedido)
2. Após commit, um evento de domínio é publicado no barramento interno (EventEmitter ou BullMQ)
3. O serviço de WebSocket consome o evento e faz broadcast para os clientes conectados relevantes
4. O frontend atualiza o estado local sem refetch completo

### Canais por contexto (rooms)
- `operacao:{data}` — painel operacional do dia
- `caminhao:{id}` — terminais de expedição daquele caminhão
- `pesagem` — terminal de pesagem
- `dashboard` — dashboards gerenciais

## Consequências

### Positivas
- Latência mínima: operadores veem mudanças em < 500ms
- Desacoplamento: o backend emite eventos, não chama diretamente o frontend
- Escalável: canais por contexto evitam broadcast desnecessário

### Negativas / Trade-offs
- WebSocket requer conexão persistente; terminais com Wi-Fi instável precisam de reconexão automática
- Estado do cliente pode ficar desatualizado se mensagem for perdida; mitigação: reconexão faz refetch do estado atual

### Riscos
- **Muitas conexões simultâneas:** para o volume on-premises (< 20 terminais), WebSocket nativo é mais que suficiente. Se escalar para SaaS, revisar para Redis Pub/Sub.

## Alternativas Consideradas

### Server-Sent Events (SSE)
Unidirecional (servidor → cliente). Adequado para dashboards somente leitura, mas não para terminais que também enviam dados. Pode ser usado complementarmente para dashboards.

### Polling
Simples, mas gera carga desnecessária e latência inaceitável para operação de pesagem. Descartado para tempo real.

## Referências
- docs/014-eventos-de-dominio-workflows-assincronos-e-atualizacao-em-tempo-real.md
- docs/009-dashboards-operacionais-kpis-alertas-e-monitoramento-em-tempo-real.md
