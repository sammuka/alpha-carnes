# Onda 14 — aguardando Quality Owner (T13)

Validação presencial bloqueante (AD-16 item 7 / ALP-75). **Não** abrir PR nem fazer `git push` até T13 Done.

App local: frontend `localhost:4000`, backend `localhost:4001`, Postgres `localhost:15433`.
`HARDWARE_FAKE=1`, `NFSE_FAKE=1`. Branch: `feature/alissen`.

## Checklist (10 itens)

1. Novo cliente: aba Preferências, `Tabela de Preço` primeiro, sem pré-seleção; salvar sem faixa falha no campo e na aba.
2. Cliente existente: faixa `A` (backfill); editar para `C`.
3. Pedido do dia com tabela publicada: preço preenchido; unidade correta.
4. Sem tabela na data / rascunho / dia anterior: R$ 0,00; inclusão bloqueada até manual > 0.
5. Ajuste para mais e para menos: só borda + tooltip (tabela vs ausência).
6. Voltar ao original: borda some.
7. Finalizar com ajuste: 1 ocorrência na fila; sem ajuste: nada.
8. `Marcar como ciente` (gestor/admin); segunda vez 409; comercial sem o botão.
9. Relatórios: duas abas; SIF intacto + P8 só lá; gerencial lista só divergência.
10. Adendo não muda preço.

## Lacunas para o QO

- Screenshots das 4 telas (cliente campo; editor coluna+borda; fila ocorrência; relatório) **não** foram capturados nesta sessão. Evidência de UI: Jest frontend `onda14-*` **40/40**.
- `docker compose ps` e gate local completo (`npm run lint` / `type-check` / `test` / `build`) ficam para T14 depois desta validação.

## Após T13 Done

Task 14: gate local + push + PR. Portão 2 só depois do PR.
