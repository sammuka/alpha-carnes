# 04 — Matriz mestre de testes

> Tabela consolidada de **todas** as jornadas e cenários do assessment. É o instrumento de controle da
> homologação: cada linha é um item de trabalho com status próprio.
>
> **Todos os cenários começam como `Não executado`.**

---

## Totais

| Métrica | Quantidade |
|---|---:|
| Jornadas (fichas com caminho feliz) | **93** |
| Cenários alternativos (`-Ax`) | **130** |
| Cenários negativos (`-Nx`) | **398** |
| Cenários de permissão (`-Px`) | **17** |
| Jornada E2E principal | **1** |
| Variantes E2E | **5** |
| **Total de cenários executáveis** | **644** |

### Distribuição por tipo

| Tipo | Quantidade | % |
|---|---:|---:|
| Happy Path | 93 | 14,4% |
| Negativo | 398 | 61,8% |
| Alternativo | 130 | 20,2% |
| Permissão | 17 | 2,6% |
| E2E | 6 | 0,9% |

> A predominância de cenários negativos é intencional: num sistema com reserva atômica, overbooking sem
> limite e integração fiscal, **o risco está nos caminhos de exceção**, não no caminho feliz.

### Distribuição por prioridade

| Prioridade | Jornadas | Critério |
|---|---:|---|
| **Crítica** | 21 | Quebra a operação do dia, compromete integridade de saldo ou tem efeito fiscal |
| **Alta** | 34 | Bloqueia um processo relevante ou é pré-requisito de muitas outras |
| **Média** | 29 | Funcionalidade de apoio ou variação de um fluxo já coberto |
| **Baixa** | 9 | Consulta, exportação, cosmético |

---

## Legenda

| Coluna | Valores |
|---|---|
| **Tipo** | Happy Path · Alternativo · Negativo · Permissão · Integração · E2E · Regressão |
| **Prioridade** | Crítica · Alta · Média · Baixa |
| **Status** | Não executado · Em execução · Aprovado · Reprovado · Bloqueado · N/A |

---

# Matriz por módulo

## M01 — Autenticação & Sessão

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-AUTH-001 | Entrar no sistema | Happy Path | Crítica | 1+3A+6N | Nenhuma | Não executado |
| JRN-AUTH-002 | Encerrar sessão e renovar token | Happy Path | Alta | 1+3N | AUTH-001 | Não executado |
| JRN-AUTH-003 | Roteamento de entrada e menu por perfil | Permissão | Crítica | 1+1N | ADM-001 (11 usuários) | Não executado |
| JRN-AUTH-004 | Acesso direto a URL sem permissão | Permissão | Crítica | 5P | ADM-001 | Não executado |

## M02 — Administração

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-ADM-001 | Criar usuário e atribuir perfis | Happy Path | Crítica | 1+4A+7N+1P | AUTH-001 | Não executado |
| JRN-ADM-002 | Editar, inativar, excluir e restaurar usuário | Happy Path | Alta | 1+2A+4N+1P | ADM-001 | Não executado |
| JRN-ADM-003 | Aprovar usuário | Permissão | Alta | 1+2N | ADM-001 | Não executado |
| JRN-ADM-004 | Definir escopo de representantes do usuário | Happy Path | Alta | 1+3A+3N | ADM-001, CAD-001 | Não executado |
| JRN-ADM-005 | Ajustar a matriz de permissões de um perfil | Happy Path | Alta | 1+2N | ADM-001 | Não executado |
| JRN-ADM-006 | Ajustar menus visíveis de um perfil | Happy Path | Média | 1+2N | ADM-001 | Não executado |
| JRN-ADM-007 | Editar parâmetro do sistema | Happy Path | Alta | 1+4A+3N+1P | AUTH-001 | Não executado |
| JRN-ADM-008 | Consultar e exportar auditoria | Happy Path | Alta | 1+3A+3N | Qualquer mutação anterior | Não executado |

## M03 — Cadastros estruturantes

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-CAD-000 | Padrão de CRUD de cadastro (ficha mestra) | Happy Path | Alta | 1+5A+10N+1P | AUTH-001 | Não executado |
| JRN-CAD-001 | Cadastrar representante | Happy Path | Alta | 1+3A+1N | CAD-000 | Não executado |
| JRN-CAD-002 | Cadastrar produto | Happy Path | Alta | 1+4A+5N | CAD-000 | Não executado |
| JRN-CAD-003 | Cadastrar item de compra | Happy Path | Crítica | 1+2N+1P | CAD-000 | Não executado |
| JRN-CAD-004 | Cadastrar item comercial | Happy Path | Crítica | 1+2N | CAD-000 | Não executado |
| JRN-CAD-005 | Cadastrar fornecedor (ciclo completo) | Happy Path | Crítica | 1+3A+5N | CAD-000 | Não executado |
| JRN-CAD-006 | Cadastrar cliente (ciclo completo) | Happy Path | Crítica | 1+4A+8N+2P | CAD-001, CAD-007 | Não executado |
| JRN-CAD-007 | Cadastrar rota / itinerário com paradas | Happy Path | Alta | 1+4A+3N | CAD-000 | Não executado |
| JRN-CAD-008 | Cadastrar caminhão da frota | Happy Path | Alta | 1+4N | CAD-000 | Não executado |
| JRN-CAD-009 | Cadastrar motorista | Happy Path | Média | 1+3N | CAD-000 | Não executado |
| JRN-CAD-010 | Criar regra de desdobramento comercial | Happy Path | **Crítica** | 1+3A+4N | CAD-003, CAD-004 | Não executado |
| JRN-CAD-011 | Consultar/gerenciar regras de transformação da desossa | Happy Path | Alta | 1+3N | CAD-004 | Não executado |
| JRN-CAD-012 | Configurar modelo de etiqueta | Happy Path | Média | 1+2N | CAD-000 | Não executado |

## M04 — Operações

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-OPE-001 | Gerar cadência de operações | Happy Path | Crítica | 1+2A+3N | ADM-007 | Não executado |
| JRN-OPE-002 | Criar operação extraordinária | Alternativo | Alta | 1+5N | AUTH-001 | Não executado |
| JRN-OPE-003 | Ciclo de status da operação | Happy Path | Crítica | 1+4N | OPE-001 | Não executado |
| JRN-OPE-004 | Consultar e filtrar operações | Happy Path | Baixa | 1+3N | OPE-001 | Não executado |

## M05 — Compra Programada

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-CMP-001 | Criar compra programada em rascunho | Happy Path | Crítica | 1+5A+12N+2P | OPE-001, CAD-005, CAD-003 | Não executado |
| JRN-CMP-002 | Confirmar compra e gerar disponibilidade virtual | Happy Path | **Crítica** | 1+3A+5N | CMP-001, CAD-010 | Não executado |
| JRN-CMP-003 | Editar compra confirmada com painel de impacto | Happy Path | Crítica | 1+3A+5N | CMP-002, PVD-001 | Não executado |
| JRN-CMP-004 | Cancelar compra programada | Negativo | Média | 1+3N | CMP-001 | Não executado |
| JRN-CMP-005 | Consultar histórico e impacto da compra | Happy Path | Média | 1+1N | CMP-003 | Não executado |

## M06 — Disponibilidade

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-DIS-001 | Consultar o mapa de disponibilidade e fazer drill-down | Happy Path | **Crítica** | 1+4A+3N | CMP-002 | Não executado |
| JRN-DIS-002 | Alertas e impactos na grade | Happy Path | Média | 1 | PVD-001, REC-004 | Não executado |
| JRN-DIS-003 | Atualização em tempo real da disponibilidade | Integração | **Crítica** | 1+2N | CMP-002, PVD-001 | Não executado |

## M07 — Pedidos de Venda

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-PVD-001 | Criar pedido de venda com saldo suficiente | Happy Path | **Crítica** | 1+5A+13N+2P | CMP-002, CAD-006 | Não executado |
| JRN-PVD-002 | Finalizar pedido de venda | Happy Path | Crítica | 1+2A+6N | PVD-001 | Não executado |
| JRN-PVD-003 | Criar pedido com overbooking (challenge + confirmação) | Happy Path | **Crítica** | 1+5A+5N | PVD-001 | Não executado |
| JRN-PVD-004 | Incluir item em pedido existente | Alternativo | Alta | 1+4N | PVD-001 | Não executado |
| JRN-PVD-005 | Reduzir ou remover item do pedido | Happy Path | Crítica | 1+3A+5N | PVD-001 | Não executado |
| JRN-PVD-006 | Registrar adendo em pedido aberto | Happy Path | Alta | 1+3A+4N | PVD-001 | Não executado |
| JRN-PVD-007 | Cancelar pedido | Happy Path | Alta | 1+4N | PVD-001 | Não executado |
| JRN-PVD-008 | Liberar reserva administrativamente (AD-06) | Permissão | Alta | 1+4N | PVD-001 | Não executado |
| JRN-PVD-009 | Consultar, buscar e filtrar pedidos | Happy Path | Média | 1+3N | PVD-001 | Não executado |

## M08 — Overbooking

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-OVB-001 | Analisar pendência de overbooking | Happy Path | Crítica | 1+3A+4N | PVD-003 | Não executado |
| JRN-OVB-002 | Resolver por compra complementar | Alternativo | Alta | 1+3N | OVB-001 | Não executado |
| JRN-OVB-003 | Resolver por redistribuição | Alternativo | Alta | 1+2N | OVB-001 | Não executado |
| JRN-OVB-004 | Postergar déficit para a próxima operação | Alternativo | Alta | 1+1A+3N | OVB-001, OPE-001 | Não executado |
| JRN-OVB-005 | Cancelar pendência de overbooking | Alternativo | Média | 1+3N | OVB-001 | Não executado |

## M09 — Tabela de Preços

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-PRC-001 | Criar a tabela de preços do dia | Happy Path | Alta | 1+1N | CAD-002 | Não executado |
| JRN-PRC-002 | Copiar a tabela anterior | Alternativo | Média | 1+2N | PRC-001 (2 dias) | Não executado |
| JRN-PRC-003 | Editar preços e salvar | Happy Path | Alta | 1+5N | PRC-001 | Não executado |
| JRN-PRC-004 | Publicar a tabela | Happy Path | Alta | 1+2N | PRC-003 | Não executado |
| JRN-PRC-005 | Consultar histórico de publicações | Happy Path | Baixa | 1+1N | PRC-004 | Não executado |

## M10 — Espelho Comercial

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-ESP-001 | Consultar o espelho e agrupar | Happy Path | Média | 1+3N | PVD-002 | Não executado |
| JRN-ESP-002 | Exportar e imprimir o espelho | Happy Path | Baixa | 1+2A+1N | ESP-001 | Não executado |

## M11 — Pedido ao Fornecedor

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-PFN-001 | Emitir e enviar o Pedido ao Fornecedor | Happy Path | **Crítica** | 1+6N | CMP-002 | Não executado |

## M12 — Recebimento

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-REC-001 | Abrir lote de recebimento a partir do Pedido ao Fornecedor | Happy Path | **Crítica** | 1+5A+9N | PFN-001 | Não executado |
| JRN-REC-002 | Capturar itens estruturados da NF | Happy Path | Alta | 1+4N | REC-001 | Não executado |
| JRN-REC-003 | Concluir a conferência tripla sem divergência | Happy Path | **Crítica** | 1+3A+8N | REC-002, PES-001 | Não executado |
| JRN-REC-004 | Registrar divergência e abrir ocorrência administrativa | Alternativo | Crítica | 1+2A+3N | REC-001 | Não executado |
| JRN-REC-005 | Tratar a divergência até a resolução | Happy Path | Alta | 1+4N | REC-004 | Não executado |
| JRN-REC-006 | Cancelar lote de recebimento | Negativo | Média | 1+3N | REC-001 | Não executado |
| JRN-REC-007 | Consultar e navegar a lista de recebimentos | Happy Path | Baixa | 1+2N | REC-001 | Não executado |

## M13 — Pesagem & Destinação

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-PES-001 | Capturar peso e associar peça a pedido | Happy Path | **Crítica** | 1+5A+11N+1P | REC-001, PVD-001 | Não executado |
| JRN-PES-002 | Peso manual assistido (contingência de balança) | Alternativo | Alta | 1+4N | PES-001 | Não executado |
| JRN-PES-003 | Estornar ação de pesagem | Alternativo | Alta | 1+4N | PES-001 | Não executado |
| JRN-PES-004 | Troca de peça (fluxo atômico de 6 passos) | Happy Path | **Crítica** | 1+3A+5N | PES-001 | Não executado |
| JRN-PES-005 | Peça sem cobertura (sobra, análise, corte, divergência) | Alternativo | Alta | 1+2N | PES-001 | Não executado |

## M14 — Etiquetas

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-ETQ-001 | Consultar, reimprimir e cancelar etiqueta de recebimento | Happy Path | Alta | 1+5N | PES-001 | Não executado |

## M15 — Desossa / Transformação

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-DES-001 | Ler o Painel de Necessidade da desossa | Happy Path | Média | 1+1A+3N | PES-001-A2 | Não executado |
| JRN-DES-002 | Executar a transformação de um TZ | Happy Path | **Crítica** | 1+4A+6N | DES-001, CAD-011 | Não executado |
| JRN-DES-003 | Registrar divergência de transformação | Alternativo | Alta | 1+2N | DES-002 | Não executado |
| JRN-DES-004 | Gerir etiquetas da desossa | Happy Path | Média | 1+3N | DES-002 | Não executado |

## M16 — Estoque

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-EST-001 | Consultar a posição de estoque e destinar item a pedido | Happy Path | Alta | 1+4A+7N | PES-001-A1 | Não executado |
| JRN-EST-002 | Registrar entrada de caixaria | Happy Path | Alta | 1+4A+4N | CAD-002 (caixaria) | Não executado |
| JRN-EST-003 | Ajuste de estoque com aprovação (segregação de funções) | Permissão | Crítica | 1+5N | EST-001, ADM-001 | Não executado |

## M17 — Aprovações & Ocorrências

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-APR-001 | Decidir uma solicitação de aprovação operacional | Happy Path | Alta | 1+2A+4N | DES-003 ou EST-003 | Não executado |

## M18 — Expedição / Carga

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-EXP-001 | Montar carga e alocar pedidos ao caminhão | Happy Path | **Crítica** | 1+5A+12N | PVD-002, CAD-008, CAD-009 | Não executado |
| JRN-EXP-002 | Conferir a carga por bipagem | Happy Path | **Crítica** | 1+3A+9N | EXP-001, PES-001 | Não executado |
| JRN-EXP-003 | Marcar divergência na conferência | Alternativo | Alta | 1+3N | EXP-002 | Não executado |
| JRN-EXP-004 | Reabrir carga fechada | Permissão | Alta | 1+3N | EXP-002 | Não executado |
| JRN-EXP-005 | Enviar carga para o faturamento | Happy Path | Crítica | 1+5N | EXP-002 | Não executado |

## M19 — Faturamento & NFS-e

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-FAT-001 | Consolidar o faturamento da carga | Happy Path | **Crítica** | 1+7N | EXP-005 | Não executado |
| JRN-FAT-002 | Emitir NFS-e | Integração | **Crítica** | 1+11N | FAT-001, ADM-007 (RTC) | Não executado |
| JRN-FAT-003 | Reprocessar e cancelar NFS-e | Integração | Crítica | 1+6N | FAT-002 | Não executado |
| JRN-FAT-004 | Consultar a rastreabilidade da nota | Happy Path | **Crítica** | 1+2N | FAT-002 | Não executado |

## M20 — Seguro

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-SEG-001 | Registrar e confirmar o seguro da carga | Happy Path | Alta | 1+3A+5N | EXP-001 | Não executado |

## M21 — Liberação do Caminhão

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-LIB-001 | Liberar o caminhão pelo checklist calculado | Happy Path | **Crítica** | 1+7N | EXP-002, FAT-002, SEG-001 | Não executado |

## M22 — Painel Geral

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-DSH-001 | Ler o Painel Geral e navegar pelos alertas | Happy Path | Alta | 1+7N | Operação com dados | Não executado |

## M23 — Relatórios SIF

| ID | Jornada | Tipo | Prioridade | Cenários | Dependências | Status |
|---|---|---|---|---:|---|---|
| JRN-SIF-001 | Gerar e retificar relatório SIF | Happy Path | Média | 1+5N | REC-003, DES-002, EXP-002 | Não executado |

## E2E

| ID | Jornada | Tipo | Prioridade | Dependências | Status |
|---|---|---|---|---|---|
| **E2E-001** | Operação completa do início ao fim | E2E | **Crítica** | Todas as jornadas individuais críticas | Não executado |
| E2E-002 | Dia com divergência de recebimento | E2E | Alta | E2E-001 | Não executado |
| E2E-003 | Dia com compra alterada após venda | E2E | Alta | E2E-001 | Não executado |
| E2E-004 | Dia com duas cargas e dois caminhões | E2E | Média | E2E-001 | Não executado |
| E2E-005 | Dia sem regra de desdobramento (negativo) | E2E | Alta | — | Não executado |
| E2E-006 | Dia com reabertura de carga | E2E | Média | E2E-001 | Não executado |

---

# Jornadas críticas — as 21 que não podem falhar

Se o tempo de homologação for curto, execute pelo menos estas.

| # | ID | Por que é crítica |
|---:|---|---|
| 1 | JRN-AUTH-001 | Sem login não há nada |
| 2 | JRN-AUTH-003 / 004 | RBAC é o controle de acesso de 11 perfis com segregação de funções |
| 3 | JRN-ADM-001 | Todos os testes de perfil dependem dos 10 usuários |
| 4 | JRN-CAD-003 / 004 / 005 / 006 | Sem esses cadastros nenhum processo roda |
| 5 | JRN-CAD-010 | Sem regra de desdobramento, a disponibilidade nunca nasce (GAP-029) |
| 6 | JRN-OPE-001 / 003 | A operação é a entidade pivô do dia |
| 7 | JRN-CMP-001 / 002 | Onde a disponibilidade virtual é criada |
| 8 | JRN-CMP-003 | Recálculo com confirmação de déficit |
| 9 | JRN-DIS-001 / 003 | A conta de saldo e o tempo real |
| 10 | JRN-PVD-001 | Reserva imediata no rascunho — o coração da regra comercial |
| 11 | JRN-PVD-002 | Não pode haver dupla redução |
| 12 | JRN-PVD-003 | AD-05: challenge sem persistência + confirmação atômica |
| 13 | JRN-PVD-005 | Devolução imediata do saldo |
| 14 | JRN-OVB-001 | Fila do gestor |
| 15 | JRN-PFN-001 / REC-001 | Elo entre planejamento e operação física |
| 16 | JRN-REC-003 | AD-04: conferência tripla |
| 17 | JRN-PES-001 / 004 | Peça física, etiqueta e troca atômica |
| 18 | JRN-DES-002 | Transformação com regra exclusiva |
| 19 | JRN-EST-003 | Segregação criador × aprovador |
| 20 | JRN-EXP-001 / 002 / 005 | Carga, conferência e marco de fechamento |
| 21 | JRN-FAT-001..004 + JRN-LIB-001 | Fiscal e o portão final do dia |

---

# Cobertura declarada

| Dimensão | Cobertura | Observação |
|---|---|---|
| **Telas** | 50 / 50 = **100%** | Ver matriz em [`02-inventario-telas.md`](02-inventario-telas.md) §4 |
| **Ações canônicas** | 18 completas · 5 parciais · 1 N/A | Parciais por ausência de UI (restaurar, transferir, ordenar, download, upload) |
| **Status de entidade** | 100% dos status alcançáveis | 4 status de pedido são inalcançáveis por design atual — GAP-038 |
| **Perfis RBAC** | 11 / 11 | JRN-AUTH-003 exercita todos |
| **Módulos** | 23 / 23 | — |

---

# Controle de execução

Sugestão de planilha de acompanhamento (uma linha por cenário):

| Campo | Preenchimento |
|---|---|
| ID do cenário | `JRN-PVD-003-N2` |
| Data/hora | início e fim |
| Executor | nome e perfil usado |
| Status | Aprovado · Reprovado · Bloqueado · N/A |
| Resultado observado | descrição objetiva do que aconteceu |
| Evidência | caminho do print/vídeo |
| Gap relacionado | `GAP-0xx` quando aplicável |
| Defeito aberto | número do issue, se houver |

**Critério de conclusão da homologação:** 100% dos cenários de prioridade Crítica e Alta executados,
com no máximo zero reprovações críticas em aberto, e todos os 59 gaps com situação registrada
(`Confirmado`, `Refutado` ou `Não testado` justificado).
