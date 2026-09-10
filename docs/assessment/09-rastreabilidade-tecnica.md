# 09 — Rastreabilidade técnica

> Ligação entre cada jornada e a evidência de código que a sustenta. Serve a três públicos: ao
> **homologador**, para localizar a origem de um comportamento inesperado; ao **desenvolvedor**, para saber
> onde mexer quando um cenário reprovar; e ao **auditor**, para confirmar que o assessment se baseia em
> evidência, não em suposição.
>
> Todos os caminhos abaixo foram localizados no repositório. Onde a evidência **não existe**, isso está
> declarado explicitamente — é o que fundamenta os gaps.

---

## Estrutura do repositório relevante

| Caminho | Conteúdo |
|---|---|
| `app/frontend/src/app/(admin)/**/page.tsx` | 50 telas do sistema |
| `app/frontend/src/app/api/**/route.ts` | ~178 handlers do BFF |
| `app/frontend/src/lib/menu-v2.ts` | Menu canônico da interface |
| `app/frontend/src/lib/expedicao-ui.ts` | Rótulos de status da carga |
| `app/frontend/src/components/ui/*` | Modais e wizards (troca de peça, divergência, leitura manual) |
| `app/backend/src/modules/**/*.controller.ts` | Endpoints + permissões |
| `app/backend/src/modules/**/*.service.ts` | Regras de negócio e invariantes |
| `app/backend/src/modules/**/transicoes.ts` | Matrizes de transição de status |
| `app/backend/src/database/schema/*.ts` | Schemas Drizzle, enums e CHECK constraints |
| `app/backend/src/database/migrations/` | Evolução do schema |
| `app/backend/src/common/rbac/permissoes.ts` | Catálogo de permissões nomeadas |
| `app/backend/src/common/rbac/menus-canonicos.ts` | Menus por perfil |
| `app/backend/src/database/seed*.ts` | Perfis, permissões, parâmetros, catálogo MVP |
| `app/frontend/e2e/*.spec.ts` | Testes Playwright — fonte dos literais de UI |

---

# Rastreabilidade por módulo

## M01 — Autenticação & Sessão

| Jornada | Evidência técnica |
|---|---|
| JRN-AUTH-001 | `/login` · `POST /auth/login` · cookies `access_token`/`refresh_token` · `usuarios`, `perfis` |
| JRN-AUTH-002 | `POST /auth/logout`, `POST /auth/refresh` · `refresh_tokens` |
| JRN-AUTH-003 | `menus-canonicos.ts` (41 rotas) · resolução de `menusVisiveis` no login |
| JRN-AUTH-004 | Guards de permissão nos controllers · `@RequirePermissao` |

## M02 — Administração

| Jornada | Evidência técnica |
|---|---|
| JRN-ADM-001 | `/admin/usuarios` · `POST /admin/usuarios` · `USUARIOS_GERENCIAR` · `usuarios`, `usuarios_perfis` |
| JRN-ADM-002 | `PATCH /admin/usuarios/:id`, `DELETE /:id`, `POST /:id/restaurar` — **restaurar sem UI (GAP-002)** |
| JRN-ADM-003 | `POST /admin/usuarios/:id/aprovar` · `USUARIOS_APROVAR` · **sem menu para `gestor` (GAP-003)** |
| JRN-ADM-004 | Escopo de representantes em `usuarios` · filtro nos services comerciais |
| JRN-ADM-005 | `/admin/perfis` · `PUT /admin/perfis/:id/permissoes` · `permissoes.ts` |
| JRN-ADM-006 | `PUT /admin/perfis/:id/menus` · validação `max(39)` × catálogo de 41 (**GAP-001**) |
| JRN-ADM-007 | `/admin/parametros` · `parametros` · seed de parâmetros |
| JRN-ADM-008 | `/admin/auditoria` · `GET /auditoria`, `/auditoria/facetas` · `AUDITORIA_VISUALIZAR` · tabela `auditoria` |

## M03 — Cadastros estruturantes

| Jornada | Evidência técnica |
|---|---|
| JRN-CAD-000 | `/cadastros/[recurso]` (lista, `/novo`, `/[id]/editar`) · CRUD genérico · soft delete `deleted_at` |
| JRN-CAD-001 | `representantes` · `REPRESENTANTES_LER`/`_GERENCIAR` |
| JRN-CAD-002 | `/cadastros/produtos` · `produtos` · campo de preço desabilitado (**GAP-009**) |
| JRN-CAD-003 | `/cadastros/itens-compra` · `itens_compra` |
| JRN-CAD-004 | `/cadastros/itens-comerciais` · `itens_comerciais` |
| JRN-CAD-005 | `/cadastros/fornecedores` · `fornecedores` · conflito de rota com o genérico (**GAP-022**) |
| JRN-CAD-006 | `/comercial/clientes` · `clientes` · duplicata legada em `/cadastros/clientes` (**GAP-024**) |
| JRN-CAD-007 | `/cadastros/rotas` · `rotas`, `rotas_paradas` · UI checa permissão diferente do endpoint (**GAP-021**) |
| JRN-CAD-008 | `/cadastros/caminhoes` · `frota_caminhoes` · `FROTA_NAO_ENCONTRADA` na expedição |
| JRN-CAD-009 | `/cadastros/motoristas` · `frota_motoristas` |
| JRN-CAD-010 | `/cadastros/regras-transformacao` · `regras_desdobramento_comercial` · consumido em `compras.service` |
| JRN-CAD-011 | `regras_transformacao` · `seed-regras-transformacao-tz.ts` · badge **P12** |
| JRN-CAD-012 | `/cadastros/modelos-etiqueta` · `modelos_etiqueta` · badge **P9** |

## M04 — Operações

| Jornada | Evidência técnica |
|---|---|
| JRN-OPE-001 | `/gestao/operacoes` · `POST /operacoes/cadencia` · parâmetro `operacao.cadencia_dias` |
| JRN-OPE-002 | `POST /operacoes` · `operacoes` |
| JRN-OPE-003 | Status `aberta`/`em_andamento`/`fechada` no schema · **sem bloqueio de mutação (GAP-012)** |
| JRN-OPE-004 | `GET /operacoes` — **sem `@RequirePermissao` (GAP-018)** |

## M05 — Compra Programada

| Jornada | Evidência técnica |
|---|---|
| JRN-CMP-001 | `/gestao/compras` · `POST /comercial/compras-programadas` · `COMPRAS_PROGRAMADAS_GERENCIAR` · índice `uq_compras_prog_operacao` |
| JRN-CMP-002 | `POST /:id/confirmar` · gera `disponibilidades_virtuais` a partir de `regras_desdobramento_comercial` · **sem aviso quando não há regra (GAP-029)** |
| JRN-CMP-003 | `PATCH /:id` + `GET /:id/impacto` · `IMPACTO_CONFIRMACAO_NECESSARIA` |
| JRN-CMP-004 | `DELETE /comercial/compras-programadas/:id` — **sem botão na UI (GAP-032)** |
| JRN-CMP-005 | Histórico de alterações da compra · `auditoria` |

## M06 — Disponibilidade

| Jornada | Evidência técnica |
|---|---|
| JRN-DIS-001 | `/comercial/disponibilidade` · `GET /comercial/disponibilidade` · `disponibilidades_virtuais`, `reservas_disponibilidade` |
| JRN-DIS-002 | Bloco **Alertas & impactos** · agregação no service |
| JRN-DIS-003 | WebSocket sala `operacao:{data}` · eventos de domínio pós-commit |

## M07 — Pedidos de Venda

| Jornada | Evidência técnica |
|---|---|
| JRN-PVD-001 | `/comercial/pedidos` · `POST /comercial/pedidos` · `pedidos_venda`, `pedidos_venda_itens`, `reservas_disponibilidade` · reserva transacional |
| JRN-PVD-002 | `POST /:id/finalizar` · `PEDIDO_FINALIZAR` · `OVERBOOKING_CONFIRMACAO_NECESSARIA` |
| JRN-PVD-003 | `POST /comercial/pedidos/confirmar-overbooking`, `/:id/itens/confirmar-overbooking`, `/:id/adendos/confirmar-overbooking` · `PEDIDO_OVERBOOKING_CONFIRMAR` |
| JRN-PVD-004 | `POST /:id/itens` · `Item comercial já existe neste pedido` |
| JRN-PVD-005 | `PATCH /:id/itens/:itemId` (exige `motivo`) · `ITEM_NAO_ESTA_NO_PEDIDO` |
| JRN-PVD-006 | `adendos_pedido` (append-only) · `PEDIDO_ABERTO_EXISTENTE` · badge **P5** |
| JRN-PVD-007 | `DELETE /comercial/pedidos/:id` — **sem botão na UI (GAP-037)** |
| JRN-PVD-008 | `POST /:id/liberar-reserva` · `PEDIDO_RESERVA_LIBERAR` · `PEDIDO_NAO_ESTA_EM_RASCUNHO`, `PEDIDO_SEM_RESERVA_ATIVA` |
| JRN-PVD-009 | Enum de status em `pedidos_venda` — **4 inalcançáveis (GAP-038)** |

## M08 — Overbooking

| Jornada | Evidência técnica |
|---|---|
| JRN-OVB-001 | `/gestao/overbooking` · `pendencias_overbooking`, `pendencias_overbooking_historico` · `OVERBOOKING_RESOLVER` |
| JRN-OVB-002..005 | Matriz `TRANSICOES_PENDENCIA` · endpoints de decisão por caminho |

## M09 — Tabela de Preços

| Jornada | Evidência técnica |
|---|---|
| JRN-PRC-001..005 | `/comercial/tabela-precos` · `/precos/*` · `tabelas_preco`, `tabelas_preco_itens`, `tabelas_preco_publicacoes` · `TABELA_PRECO_DUPLICADA`, `SEM_TABELA_PRECO_ANTERIOR`, `PRECOS_INCOMPLETOS` · **nenhum consumidor do preço publicado (GAP-041)** |

## M10 — Espelho Comercial

| Jornada | Evidência técnica |
|---|---|
| JRN-ESP-001, 002 | `/comercial/espelho` · `ESPELHO_COMERCIAL_LER` · badge **P15** |

## M11 — Pedido ao Fornecedor

| Jornada | Evidência técnica |
|---|---|
| JRN-PFN-001 | `GET/POST /operacao/pedidos-fornecedor`, `POST /:id/enviar`, `POST /:id/nf` · `PEDIDO_FORNECEDOR_GERENCIAR` · `pedidos_fornecedor` · **nenhuma `page.tsx` e nenhum item de menu (GAP-042)** |

## M12 — Recebimento

| Jornada | Evidência técnica |
|---|---|
| JRN-REC-001 | `/recebimento/recebimento-carga` · `POST /operacao/recebimentos` · `GET /recebimentos/previsao/:pedidoFornecedorId` · `RECEBIMENTO_GERENCIAR` |
| JRN-REC-002 | `POST /operacao/pedidos-fornecedor/:id/nf` · `NF_ITENS_OBRIGATORIOS` |
| JRN-REC-003 | `POST /recebimentos/:id/conferencia/concluir` · `CONFERENCIA_CONCLUIR` · `conclusoes_conferencia` · `GET /:id/conferencia` (quadro comparativo) |
| JRN-REC-004 | `POST /recebimentos/:id/itens` · `divergencias_recebimento` · 8 tipos no enum |
| JRN-REC-005 | `/operacao/ocorrencias-fornecedor/*` · `OCORRENCIA_FORNECEDOR_GERENCIAR` · `CONCLUSAO_INEXISTENTE` |
| JRN-REC-006 | `POST /recebimentos/:id/cancelar` · trava por pesagem registrada |
| JRN-REC-007 | `GET /operacao/recebimentos` · `RECEBIMENTO_LER` |

## M13 — Pesagem & Destinação

| Jornada | Evidência técnica |
|---|---|
| JRN-PES-001 | `/recebimento/pesagem-destinacao` · `POST /operacao/pesagem/pecas`, `/pecas/:id/confirmar`, `/pecas/:id/etiqueta` · `PESAGEM_GERENCIAR`, `ASSOCIACAO_GERENCIAR`, `ETIQUETA_GERENCIAR` · `pecas`, `associacoes_peca_historico` |
| JRN-PES-002 | `PESO_MANUAL` · `Captura manual exige pesoManual e motivo` · gateway de balança (ADR-009) |
| JRN-PES-003 | `POST /pecas/:id/estornar` · `ASSOCIACAO_ESTORNAR` · trava de carga fechada |
| JRN-PES-004 | `POST /operacao/pesagem/trocas` · `trocas_peca` · componente `troca-peca-modal.tsx` (6 passos) |
| JRN-PES-005 | `POST /pecas/:id/sem-cobertura` · destinos `sobra`/`analise`/`corte`/`divergencia` |

## M14 — Etiquetas

| Jornada | Evidência técnica |
|---|---|
| JRN-ETQ-001 | `/recebimento/etiquetas` · `GET /operacao/etiquetas`, `POST /etiquetas/:id/cancelar`, `POST /pesagem/pecas/:id/etiqueta/reimprimir` · estados `emitida`/`ativa`/`invalidada_por_troca`/`reimpressa`/`cancelada` · badge **P1** |

## M15 — Desossa / Transformação

| Jornada | Evidência técnica |
|---|---|
| JRN-DES-001 | `/desossa/dashboard` · `GET /desossa/painel` · `DESOSSA_PAINEL_LER` |
| JRN-DES-002 | `/desossa/pesagem-destinacao` · `POST /operacao/corte/pecas/:pecaId/iniciar`, `/:id/regra`, `/:id/concluir` · `CORTE_GERENCIAR` · `transformacoes`, `subitens` · badge **P12** |
| JRN-DES-003 | `POST /operacao/corte/:id/divergencia` · `divergencias_transformacao` |
| JRN-DES-004 | `/desossa/etiquetas` · `GET /desossa/etiquetas` · filtro de produto hardcoded (**GAP-046**) |

## M16 — Estoque

| Jornada | Evidência técnica |
|---|---|
| JRN-EST-001 | `/estoque/consulta` · `GET /estoque/consulta`, `POST /estoque/destinar` · `ESTOQUE_LER`/`_GERENCIAR` · `ITEM_NAO_DISPONIVEL`, `SALDO_INSUFICIENTE`, `ITEM_INCOMPATIVEL` · badges **P1**, **P3** |
| JRN-EST-002 | `/estoque/entrada-itens` · `POST /estoque/entradas` · `ESTOQUE_ENTRADA` · `PRODUTO_NAO_E_CAIXARIA` |
| JRN-EST-003 | `/estoque/ajustes` · `POST /estoque/ajustes/:id/aprovar`/`rejeitar` · `ESTOQUE_AJUSTE_APROVAR` · **`SEGREGACAO_CRIADOR_APROVADOR`** |

## M17 — Aprovações & Ocorrências

| Jornada | Evidência técnica |
|---|---|
| JRN-APR-001 | `/gestao/aprovacoes` · `POST /gestao/aprovacoes/operacionais/:id/decidir` · `APROVACOES_DECIDIR` · `aprovacoes_operacionais` · **sem segregação criador × aprovador (GAP-049)** |

## M18 — Expedição / Carga

| Jornada | Evidência técnica |
|---|---|
| JRN-EXP-001 | `/carga/planejamento` · `POST /operacao/expedicao/caminhoes`, `/:id/pedidos`, `/:id/abrir-carga` · `EXPEDICAO_GERENCIAR` · `caminhoes`, `caminhoes_pedidos`, `carga_itens` |
| JRN-EXP-002 | `/carga/conferencia` · `POST /:id/conferencia/registrar-item`, `/concluir` · `LEITURA_MANUAL` · `ITEM_NAO_PENDENTE` · `conferencias_carga` |
| JRN-EXP-003 | `POST /:id/conferencia/divergencia` · `modal-divergencia.tsx` (6 motivos) |
| JRN-EXP-004 | `POST /caminhoes/:id/reabrir` · `EXPEDICAO_REABRIR` — **sem botão na UI (GAP-052)** |
| JRN-EXP-005 | `/carga/enviar-faturamento` · `POST /:id/liberar-faturamento` · matriz `TRANSICOES` em `expedicao/transicoes.ts` |

## M19 — Faturamento & NFS-e

| Jornada | Evidência técnica |
|---|---|
| JRN-FAT-001 | `/faturamento/pre-faturamento` · `GET /operacao/faturamento/caminhoes/:id/consolidacao` · `bloqueios.ts` (4 códigos) · **`page.tsx` sem gate RBAC (GAP-055)** |
| JRN-FAT-002 | `POST /faturamento/caminhoes/:id/emitir` · `NFSE_EMITIR` · `NfseModule` + `EissClientAdapter` / `FakeNfseGateway` (ADR-011) · `RTC_PARAMETROS_INCOMPLETOS` · **valor digitado à mão (GAP-056)** |
| JRN-FAT-003 | `POST /notas/:id/cancelar`, `/reprocessar` · `NFSE_CANCELAR` · `TRANSICOES_NFSE` · `NOTA_TRAVADA_CAMINHAO_LIBERADO` |
| JRN-FAT-004 | `/faturamento/notas-xml` · `GET /notas/:id/rastreabilidade` · vínculo pedido ↔ peças ↔ pesos ↔ item fiscal |

## M20 — Seguro

| Jornada | Evidência técnica |
|---|---|
| JRN-SEG-001 | `/faturamento/seguro-manual` · `PATCH /seguros/:id/status`, `POST /seguros/:id/anexos` · `SEGURO_GERENCIAR` · `TRANSICOES_SEGURO` · **anexo sem arquivo (GAP-010/057)** |

## M21 — Liberação do Caminhão

| Jornada | Evidência técnica |
|---|---|
| JRN-LIB-001 | `/faturamento/liberacao` · `GET /faturamento/liberacao/:caminhaoId/checklist`, `POST /expedicao/caminhoes/:id/liberar-saida` · `LIBERACAO_GERENCIAR` · `CHECKLIST_INCOMPLETO` |

## M22 — Painel Geral

| Jornada | Evidência técnica |
|---|---|
| JRN-DSH-001 | `/gestao/dashboard` · `GET /gestao/dashboard` · `COMPRAS_PROGRAMADAS_LER` ou `DISPONIBILIDADE_LER` · WebSocket salas `dashboard` e `operacao:{id}` |

## M23 — Relatórios SIF

| Jornada | Evidência técnica |
|---|---|
| JRN-SIF-001 | `/gestao/relatorios` · `/sif/relatorios/*` · `SIF_LER`/`SIF_GERAR` · `catalogo-sif.ts` (SIF-01 a 04) · `relatorios_sif` · badge **P8** |

---

# Rastreabilidade das decisões arquiteturais (AD-xx)

| Decisão | Onde está implementada | Jornada que a prova |
|---|---|---|
| **AD-01** — Composição do boi (casado = 2 TZ + 2 DT + 2 PA) | `regras_desdobramento_comercial` · geração de disponibilidade | JRN-CMP-002 (60 unidades de 10 bois) |
| **AD-02** — EISS Osasco como provedor de NFS-e | `NfseModule`, `EissClientAdapter` (ADR-011) | JRN-FAT-002 |
| **AD-03** — Unicidade por operação | `uq_compras_prog_operacao` · `PEDIDO_ABERTO_EXISTENTE` | JRN-CMP-001-N7, JRN-PVD-006 |
| **AD-04** — 11 perfis de RBAC | CHECK em `perfis.slug` · `menus-canonicos.ts` | JRN-AUTH-003 |
| **AD-05** — Overbooking sem limite, com confirmação explícita | Challenge `409` + endpoint de confirmação transacional | JRN-PVD-003 |
| **AD-06** — Reserva sem expiração | Ausência de TTL/job + `POST /:id/liberar-reserva` | JRN-PVD-008 |

---

# Rastreabilidade dos princípios da constituição

| Princípio | Como é verificável na homologação | Jornada |
|---|---|---|
| **I — Fidelidade ao protótipo** | Comparar cada tela com o `.tsx` do protótipo | Todas (validações visuais/UX) |
| **II — Completude E2E** | A jornada precisa terminar, não apenas abrir a tela | E2E-001 |
| **RA-01 — Regra só no backend** | Contornar a UI por API e observar o mesmo bloqueio | JRN-AUTH-004 |
| **RA-02 — Transação + auditoria em etapa crítica** | Troca de peça, confirmação de overbooking, ajuste de estoque | JRN-PES-004, JRN-PVD-003, JRN-EST-003 |
| **RA-03/V — Hardware e integração isolados** | `HARDWARE_FAKE=1`, `NFSE_FAKE=1` funcionam sem dispositivo | JRN-PES-001, JRN-FAT-002 |
| **RA-04 — Tempo real por evento** | Saldo muda em outra aba sem F5 | JRN-DIS-003 |
| **RA-05 — Nenhuma falha silenciosa** | 🔎 **violado por GAP-029** | JRN-CMP-002-N2 |
| **RA-06 — Nenhum dado inventado** | Campos provisórios levam badge | Badges P1, P3, P5, P8, P9, P12, P15 |
| **VIII — Não inventar o pendente** | 7 pendências sinalizadas na UI | [`06`](06-gaps-identificados.md) §Pendências |

---

# Testes automatizados existentes como fonte de verdade

Os specs Playwright foram usados para extrair literais de UI e sequências de interação **confirmadas**.
Se um texto do roteiro divergir da tela, compare primeiro com o spec.

| Spec | O que cobre | Usado para |
|---|---|---|
| `app/frontend/e2e/jornada-operacional.spec.ts` | Login → cadastros → disponibilidade → pedido → recebimento → pesagem → handoff para desossa | Literais de UI, seletores, sequência do E2E |
| `app/frontend/e2e/onda*.spec.ts` | Fluxos por onda de implementação | Confirmação de rótulos e estados |
| Testes de unidade do backend (`*.spec.ts`) | Invariantes de service e matrizes de transição | Confirmação de mensagens de exceção |

> Observação: o spec `jornada-operacional.spec.ts` **assume explicitamente** que não navega para desossa,
> carga ou faturamento — ele para no handoff. Isso confirma que **não existe cobertura automatizada E2E
> das Fases 5 (desossa), 6 e 7** do roadmap. Um argumento a mais para executar o E2E-001 manualmente com
> rigor.

---

# Onde a evidência não existe (fundamento dos gaps de ausência)

| Gap | Busca realizada | Resultado |
|---|---|---|
| GAP-042 | Rota `page.tsx` para pedido ao fornecedor; item em `menu-v2.ts` | Nenhuma ocorrência |
| GAP-058 | Módulo, tabela ou rota de notificações | Nenhuma ocorrência |
| GAP-026 | Rota ou endpoint de importação (CSV/planilha) | Nenhuma ocorrência |
| GAP-059 | Relatórios gerenciais além do catálogo SIF | Nenhuma ocorrência |
| GAP-041 | Referência a `tabelas_preco_itens` nos services de pedido e faturamento | Nenhuma ocorrência |
| GAP-002 | Botão que chame `POST /:id/restaurar` na UI | Nenhuma ocorrência |
| GAP-032 | Botão que chame `DELETE /compras-programadas/:id` | Nenhuma ocorrência |
| GAP-037 | Botão de cancelar pedido na lista | Nenhuma ocorrência |
| GAP-052 | Botão que chame `POST /caminhoes/:id/reabrir` | Nenhuma ocorrência |
| GAP-005 | Botão que chame `POST /itens/:id/transferir` | Nenhuma ocorrência |
| GAP-007 | Validador de dígito verificador de CNPJ/CPF nos DTOs | Nenhuma ocorrência |
| GAP-023 | Importação de `placeholder-page.tsx` | Nenhuma ocorrência |

> **Ausência de evidência não é prova de ausência.** Cada linha acima descreve exatamente a busca feita,
> para que o time possa refutá-la apontando o código que a análise não alcançou. Uma refutação é um
> resultado tão útil quanto uma confirmação.
