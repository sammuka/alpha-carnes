## Fase / Sub-gate
- Fase: <F1..F9 / F4a..F4c>
- Dependências (DP) satisfeitas: <sim/quais>

## O que entrega
- <resumo objetivo do incremento>

## Gates transversais
- [ ] lint sem erros
- [ ] type-check (TS strict) sem erros
- [ ] testes unit + integração passando
- [ ] cobertura backend >= 80% (linha + branch nos services de domínio)
- [ ] build ok (backend e frontend)
- [ ] npm audit sem vuln high/critical
- [ ] sem segredos commitados
- [ ] migrations via drizzle-kit, reversíveis, sem destrutivo não justificado

## Regras arquiteturais
- [ ] RA-01 sem regra de negócio no frontend
- [ ] RA-02 etapas críticas transacionais + auditadas
- [ ] RA-03 hardware como gateway isolado
- [ ] RA-04 tempo real por eventos
- [ ] RA-05 nenhuma falha de integração silenciosa
- [ ] RA-06 exceções observáveis

## DoD da fase
- [ ] <invariante 1 da fase, com link para o teste que prova>
- [ ] <invariante 2 ...>

## Evidências
- <prints, logs de teste, saída de cobertura, vídeo do fluxo quando aplicável>
