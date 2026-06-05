# Premissas e Restrições — AlphaCarnes

## Premissa Fundamental
**Este projeto é E2E, não MVP.**
Quando existe escolha entre a solução mínima e a solução completa, a solução completa é sempre a escolha correta. Esta premissa é imutável e deve ser lembrada em qualquer decisão de escopo, arquitetura, modelo de dados ou implementação.

## Premissas de Negócio
- A operação é de cross-docking: recebimento e expedição quase simultâneos, baixíssimo estoque.
- Disponibilidade virtual é gerada pela compra programada do dia. Sem compra, sem venda.
- Não existe overbooking comercial: a venda bloqueia disponibilidade imediatamente.
- O pedido é por parte (unidade), não por peso. O peso real só é conhecido na balança.
- Após o fechamento do caminhão, alterações em peças/pedidos são bloqueadas no sistema.
- A divergência entre compra programada, NF do fornecedor e recebimento físico deve ser tratada formalmente.
- Congelamento de sobras é exceção operacional indesejável (impacta peso e qualidade).

## Premissas Técnicas
- Operação on-premises: servidor local na AlphaCarnes, sem dependência de internet no core operacional.
- Terminais de pesagem e expedição são touch-friendly, alto contraste, baixo número de cliques.
- Integrações com hardware (balança, impressora, leitor QR) são serviços/gateways isolados.
- Regras de negócio residem exclusivamente no backend. O frontend não decide nada crítico.
- Toda operação crítica (associação, fechamento, faturamento) é transacional no banco.
- Atualizações em tempo real são orientadas a eventos (WebSocket ou SSE).
- Todas as ações críticas geram registro de auditoria imutável.
- **Arquitetura clean, sem over-engineering:** cada módulo, serviço e abstração só existe se resolver um problema real. Sem camadas desnecessárias, sem padrões por imitação.

## Restrições
- Banco de dados: PostgreSQL 18 com JSONB habilitado. Sem troca de banco.
- NFS-e: Sistema EISS da Prefeitura de Osasco-SP. Integração via SOAP Webservice.
- Faturamento fiscal: NFS-e (nota de serviço). A AlphaCarnes é prestadora de serviços de distribuição.
- Infraestrutura: on-premises. Sem dependência de cloud para operação crítica.
- Stack: Next.js 16 (frontend), NestJS 11 (backend), Drizzle ORM, TypeScript strict.

## Restrições de Qualidade
- TypeScript strict em todo o código (no `any` implícito).
- Cobertura de testes ≥ 80% no backend.
- Sem regras de negócio no frontend (apenas apresentação e validação de formulário).
- Toda integração externa com fallback e logging de falha.
- Sem falhas silenciosas em integrações físicas ou fiscais.
