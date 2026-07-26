# Evidências — Onda 3 (Cadastros & Admin)

**Viewport de captura:** `1280×800`, `fullPage: true`  
**Origem `-app.png`:** implementação em `http://localhost:3100` (branch `feature/onda3-cadastros-admin`), login administrador (`SEED_ADMIN_*`).  
**Origem `-prototipo.png`:** protótipo validado `alpha-carnes-prototipo` branch `feature/completude-v1.1`, mesmo viewport.  
**Comando pinado (plano Task 27.1):**

```bash
cd app/frontend
npx playwright screenshot --viewport-size=1280,800 --full-page \
  --load-storage=e2e/.auth/admin.json \
  "http://localhost:3100<caminho-da-rota>" \
  "../../docs/execucao/evidencias/onda3-cadastros-admin/<rota-com-hifens>-app.png"
```

(Para `-prototipo.png`, o mesmo comando aponta para a porta do protótipo, sem storage da app.)

## Capturas lado a lado (12 rotas × 2 = 24 PNGs)

| Rota | Protótipo | App |
|------|-----------|-----|
| `/cadastros/representantes` | `cadastros-representantes-prototipo.png` | `cadastros-representantes-app.png` |
| `/cadastros/produtos` | `cadastros-produtos-prototipo.png` | `cadastros-produtos-app.png` |
| `/cadastros/fornecedores` | `cadastros-fornecedores-prototipo.png` | `cadastros-fornecedores-app.png` |
| `/cadastros/caminhoes` | `cadastros-caminhoes-prototipo.png` | `cadastros-caminhoes-app.png` |
| `/cadastros/motoristas` | `cadastros-motoristas-prototipo.png` | `cadastros-motoristas-app.png` |
| `/cadastros/rotas` | `cadastros-rotas-prototipo.png` | `cadastros-rotas-app.png` |
| `/cadastros/regras-transformacao` | `cadastros-regras-transformacao-prototipo.png` | `cadastros-regras-transformacao-app.png` |
| `/cadastros/modelos-etiqueta` | `cadastros-modelos-etiqueta-prototipo.png` | `cadastros-modelos-etiqueta-app.png` |
| `/admin/usuarios` | `admin-usuarios-prototipo.png` | `admin-usuarios-app.png` |
| `/admin/perfis` | `admin-perfis-prototipo.png` | `admin-perfis-app.png` |
| `/admin/parametros` | `admin-parametros-prototipo.png` | `admin-parametros-app.png` |
| `/admin/auditoria` | `admin-auditoria-prototipo.png` | `admin-auditoria-app.png` |

## Menu — 26 perdas (Onda 2 decisão 25) → após Onda 3

Fonte: `PERDAS_HERDADAS` em `app/frontend/__tests__/menu-rbac.test.ts`.  
Teste: `as 26 perdas herdadas da Onda 2 estao visiveis` — **passed**.

| Perfil | Rota | Situação após a Onda 3 |
|--------|------|------------------------|
| compras | `/recebimento/recebimento-carga` | visível |
| comercial | `/gestao/compras` | visível |
| comercial | `/gestao/overbooking` | visível |
| comercial | `/desossa/dashboard` | visível |
| recebimento_pesagem | `/gestao/aprovacoes` | visível |
| recebimento_pesagem | `/estoque/consulta` | visível |
| recebimento_pesagem | `/estoque/entrada-itens` | visível |
| recebimento_pesagem | `/estoque/ajustes` | visível |
| expedicao | `/comercial/pedidos` | visível |
| expedicao | `/comercial/espelho` | visível |
| expedicao | `/estoque/consulta` | visível |
| expedicao | `/estoque/entrada-itens` | visível |
| expedicao | `/estoque/ajustes` | visível |
| expedicao | `/cadastros/caminhoes` | visível |
| expedicao | `/cadastros/motoristas` | visível |
| conferente | `/carga/conferencia` | visível |
| faturamento | `/comercial/clientes` | visível |
| faturamento | `/comercial/pedidos` | visível |
| faturamento | `/recebimento/recebimento-carga` | visível |
| logistica | `/faturamento/notas-xml` | visível |
| logistica | `/faturamento/seguro-manual` | visível |
| logistica | `/faturamento/liberacao` | visível |
| diretoria | `/gestao/dashboard` | visível |
| diretoria | `/gestao/aprovacoes` | visível |
| diretoria | `/gestao/relatorios` | visível |
| diretoria | `/faturamento/notas-xml` | visível |

## Menu — 14 extras (Onda 2 decisão 31) → após Onda 3

Fonte: `EXTRAS_HERDADOS` em `app/frontend/__tests__/menu-rbac.test.ts`.  
Teste: `os 14 extras herdados da Onda 2 sumiram do menu` — **passed**.

| Perfil | Rota | Situação |
|--------|------|----------|
| compras | `/comercial/clientes` | removido |
| compras | `/comercial/pedidos` | removido |
| compras | `/comercial/disponibilidade` | removido |
| compras | `/comercial/espelho` | removido |
| compras | `/gestao/dashboard` | removido |
| compras | `/gestao/aprovacoes` | removido |
| compras | `/gestao/relatorios` | removido |
| compras | `/cadastros/representantes` | removido |
| compras | `/cadastros/produtos` | removido |
| compras | `/cadastros/rotas` | removido |
| compras | `/cadastros/regras-transformacao` | removido |
| diretoria | `/comercial/clientes` | removido |
| diretoria | `/comercial/pedidos` | removido |
| diretoria | `/comercial/espelho` | removido |

## Quinze divergências autorizadas

| ID | Justificativa | Referência |
|----|---------------|------------|
| Decisão 29 | `/admin/perfis` usa 11 perfis canônicos e permissões reais (não 8×9 do mock) | `PerfisAcesso.tsx` estrutura visual |
| Decisão 31 | Placeholder "UUID completo ou parte dele" no Registro (ID) | `Auditoria.tsx` filtro |
| Decisão 27 | `MODELOS_ETIQUETA_LER` também a `recebimento_pesagem` e `corte` | matriz linha 37 + decisões |
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
