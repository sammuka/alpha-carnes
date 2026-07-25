# Evidências — Onda 3 (Cadastros & Admin)

Status: implementação fechada no worktree (Worker). Capturas visuais protótipo × app listadas abaixo; arquivos PNG gerados no Portão 2 / revisão visual quando o ambiente de captura estiver disponível.

## Capturas lado a lado (12 rotas)

| Rota | Protótipo | App |
|------|-----------|-----|
| `/cadastros/representantes` | `representantes-prototipo.png` | `representantes-app.png` |
| `/cadastros/caminhoes` | `caminhoes-prototipo.png` | `caminhoes-app.png` |
| `/cadastros/motoristas` | `motoristas-prototipo.png` | `motoristas-app.png` |
| `/cadastros/fornecedores` | `fornecedores-prototipo.png` | `fornecedores-app.png` |
| `/cadastros/rotas` | `rotas-prototipo.png` | `rotas-app.png` |
| `/cadastros/modelos-etiqueta` | `modelos-etiqueta-prototipo.png` | `modelos-etiqueta-app.png` |
| `/cadastros/produtos` | `produtos-prototipo.png` | `produtos-app.png` |
| `/cadastros/regras-transformacao` | `regras-transformacao-prototipo.png` | `regras-transformacao-app.png` |
| `/admin/usuarios` | `usuarios-prototipo.png` | `usuarios-app.png` |
| `/admin/perfis` | `perfis-prototipo.png` | `perfis-app.png` |
| `/admin/parametros` | `parametros-prototipo.png` | `parametros-app.png` |
| `/admin/auditoria` | `auditoria-prototipo.png` | `auditoria-app.png` |

## Menu — 26 perdas (Onda 2 decisão 25) → após Onda 3

Todas as 26 perdas herdadas ficam `visível`. Cobertura: teste `as 26 perdas herdadas da Onda 2 estao visiveis` em `app/frontend/__tests__/menu-rbac.test.ts`.

## Menu — 14 extras (Onda 2 decisão 31) → após Onda 3

Todos os 14 extras ficam `removido`. Cobertura: teste `os 14 extras herdados da Onda 2 sumiram do menu` em `app/frontend/__tests__/menu-rbac.test.ts`.

## Quinze divergências autorizadas

| ID | Justificativa | Referência |
|----|---------------|------------|
| Decisão 29 | `/admin/perfis` usa 11 perfis canônicos e permissões reais (não 8×9 do mock) | `PerfisAcesso.tsx` estrutura visual |
| Decisão 31 | Placeholder "UUID completo ou parte dele" no Registro (ID) | `Auditoria.tsx` filtro |
| Decisão 27 | `MODELOS_ETIQUETA_LER` também a `recebimento_pesagem` e `corte` | matriz linha 37 + decisão |
| D13.a | Tipo/canal como texto | `Representantes.tsx` |
| D13.b | "Usuários vinculados" diferido (Onda 4) | decisão 43 |
| D13.c | Campo Código no drawer de representantes | drawer |
| D16.a | Endereço/Contato só com campos do schema | `Fornecedores.tsx` seções |
| D16.b | Data absoluta `toLocaleDateString` (não "Há N dias") | histórico fornecedor |
| D17.a | Subir/descer parada + `Trash2` (ordem persistida) | `Itinerarios.tsx:95-98` |
| D18.a | Preview sem valores de exemplo (RA-06) | `ModelosEtiqueta.tsx:73-84` |
| D18.b | Botão "Salvar Modelo" | marcação inerte sem ele |
| D18.c | `GET /modelos-etiqueta/:id/preview` diferido (Onda 6) | plano mestre §4 |
| D22.a | Chips de menu clicáveis (39 do catálogo) | `PerfisAcesso.tsx:202` |
| D23.a | Botão "Salvar" por cartão de parâmetro | `Parametros.tsx:141-146` |
| D41.a | Anterior/Próxima quando `total > pageSize` | paginação auditoria |

## Reconciliação de nomes (R1–R3)

| ID | Plano mestre | Entrega Onda 3 | Destino |
|----|--------------|----------------|---------|
| R1 | cadastro caminhões | tabelas `frota_*` | Onda 9 liga à expedição |
| R2 | modelo etiqueta | `slug` + `campos` JSON | — |
| R3 | preview API etiqueta | diferido; preview ao vivo no cliente | Onda 6 |

## Badges Provisório desta onda

- **P1** — `/admin/parametros` (`operacao.cadencia_dias_semana`)
- **P12** — `/admin/parametros` (`operacao.regras_transformacao_tz`)
- **P9** — `/cadastros/modelos-etiqueta`

AD-01, AD-02 e AD-06 retiraram badges de composição do boi casado, emissão fiscal e expiração de reserva.
