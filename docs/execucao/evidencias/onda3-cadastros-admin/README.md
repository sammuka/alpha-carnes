# Evidências — Onda 3 (Cadastros & Admin)

Status: implementação em andamento (Worker). Capturas protótipo × app e tabelas completas de reconciliação ficam pendentes do fechamento das Tasks 17–24 restantes e do Portão 2.

## Divergências autorizadas (resumo)

| ID | Tema |
|----|------|
| D13.a | Tipo/canal como texto |
| D13.b | Usuários vinculados diferido (Onda 4) |
| D13.c | Campo Código no drawer de representantes |
| D16.a | Endereço e Contato só com campos do schema |
| D16.b | Data absoluta `toLocaleDateString` (não "Há N dias") |
| D17.a | Controles de ordem/remoção de paradas |
| D18.a–c | Preview sem exemplos; Salvar Modelo; preview API diferida |
| D22.a | Chips de menu clicáveis (39 do catálogo) |
| D23.a | Salvar por cartão de parâmetro |
| D41.a | Paginação Anterior/Próxima |

## Menu (Onda 2 dívidas)

- 26 perdas → cobertas pelo teste `as 26 perdas herdadas da Onda 2 estao visiveis` em `menu-rbac.test.ts`
- 14 extras → cobertas pelo teste `os 14 extras herdados da Onda 2 sumiram do menu`

## Badges Provisório desta onda

- P1 / P12 em `/admin/parametros`
- P9 em `/cadastros/modelos-etiqueta`
