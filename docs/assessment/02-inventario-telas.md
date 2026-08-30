# 02 — Inventário de Telas, Rotas e Cobertura

> Fonte: `app/frontend/src/app/**/page.tsx` (44 arquivos de rota),
> `app/backend/src/common/rbac/menus-canonicos.ts` (41 rotas canônicas de menu — AD-11),
> `app/frontend/src/lib/cadastros-config.ts` (recursos do CRUD genérico),
> `app/frontend/src/lib/menu-v2.ts` e `app/frontend/src/components/ui/app-sidebar.tsx`.

---

## 1. Contagem

| Item | Quantidade |
|---|---|
| Arquivos de rota (`page.tsx`) | **44** |
| Rotas canônicas de menu (`MENUS_CANONICOS`) | **41** |
| URLs navegáveis distintas (menu + login + home + CRUD genérico) | **53** |
| Grupos de menu | **9** |
| Route handlers do BFF (`app/frontend/src/app/api/**/route.ts`) | **178** |
| Endpoints do backend | **~280** em 38 controllers |

Os 44 arquivos incluem 3 rotas dinâmicas (`/cadastros/[recurso]`, `.../novo`, `.../[id]/editar`) que se
expandem para 4 recursos (`clientes`, `fornecedores`, `itens-compra`, `itens-comerciais`) → 12 URLs concretas,
das quais 2 (`itens-compra`, `itens-comerciais`) estão no menu e 2 (`clientes`, `fornecedores` genéricos)
foram deliberadamente deixadas fora dele por AD-11, porque já existem telas dedicadas mais completas.

---

## 2. Menu por grupo

Ordem e rótulos conforme `menu-v2.ts`. A coluna "Perfis com o item visível" vem de
`MENUS_VISIVEIS_POR_PERFIL`.

### Grupo 1 — COMERCIAL

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Clientes | `/comercial/clientes` | administrador, gestor, comercial, faturamento |
| Pedidos de Venda | `/comercial/pedidos` | administrador, gestor, comercial, faturamento, expedicao |
| Tabela de Preços | `/comercial/tabela-precos` | administrador, gestor, comercial |
| Disponibilidade | `/comercial/disponibilidade` | administrador, gestor, comercial, diretoria |
| Espelho Comercial | `/comercial/espelho` | administrador, gestor, comercial, expedicao |

### Grupo 2 — GESTÃO

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Painel Geral da Operação | `/gestao/dashboard` | administrador, gestor, diretoria |
| Operações | `/gestao/operacoes` | administrador, gestor, compras |
| Compras | `/gestao/compras` | administrador, gestor, compras, comercial |
| Pendências de Overbooking | `/gestao/overbooking` | administrador, gestor, compras, comercial |
| Aprovações & Ocorrências | `/gestao/aprovacoes` | administrador, gestor, recebimento_pesagem, diretoria |
| Relatórios & SIF | `/gestao/relatorios` | administrador, gestor, faturamento, diretoria |

### Grupo 3 — RECEBIMENTO & BALANÇA

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Recebimento de Carga | `/recebimento/recebimento-carga` | administrador, gestor, compras, recebimento_pesagem, faturamento |
| Pesagem e Destinação | `/recebimento/pesagem-destinacao` | administrador, gestor, recebimento_pesagem |
| Etiquetas | `/recebimento/etiquetas` | administrador, gestor, recebimento_pesagem |

### Grupo 4 — DESOSSA

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Dashboard da Desossa | `/desossa/dashboard` | administrador, gestor, corte, comercial |
| Pesagem e Destinação | `/desossa/pesagem-destinacao` | administrador, gestor, corte |
| Etiquetas | `/desossa/etiquetas` | administrador, gestor, corte |

### Grupo 5 — ESTOQUE

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Consulta de Estoque | `/estoque/consulta` | administrador, gestor, expedicao, recebimento_pesagem |
| Entrada de Itens | `/estoque/entrada-itens` | administrador, gestor, expedicao, recebimento_pesagem |
| Ajustes | `/estoque/ajustes` | administrador, gestor, expedicao, recebimento_pesagem |

### Grupo 6 — CARGA

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Planejamento de Carga | `/carga/planejamento` | administrador, gestor, expedicao |
| Conferência | `/carga/conferencia` | administrador, gestor, expedicao, conferente |
| Enviar para Faturamento | `/carga/enviar-faturamento` | administrador, gestor, expedicao |

### Grupo 7 — FATURAMENTO

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Pré-Faturamento | `/faturamento/pre-faturamento` | administrador, gestor, faturamento |
| Notas / XML | `/faturamento/notas-xml` | administrador, gestor, faturamento, logistica, diretoria |
| Seguro Manual | `/faturamento/seguro-manual` | administrador, gestor, faturamento, logistica |
| Liberação do Caminhão | `/faturamento/liberacao` | administrador, gestor, faturamento, logistica |

### Grupo 8 — CADASTROS & REGRAS

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Representantes | `/cadastros/representantes` | administrador, gestor |
| Produtos | `/cadastros/produtos` | administrador, gestor |
| Fornecedores / Frigoríficos | `/cadastros/fornecedores` | administrador, gestor, compras |
| Caminhões | `/cadastros/caminhoes` | administrador, gestor, expedicao |
| Motoristas | `/cadastros/motoristas` | administrador, gestor, expedicao |
| Rotas / Itinerários | `/cadastros/rotas` | administrador, gestor |
| Regras de Transformação | `/cadastros/regras-transformacao` | administrador, gestor |
| Modelos de Etiqueta | `/cadastros/modelos-etiqueta` | administrador, gestor |
| Itens de Compra | `/cadastros/itens-compra` | **administrador** (AD-11) |
| Itens Comerciais | `/cadastros/itens-comerciais` | **administrador** (AD-11) |

### Grupo 9 — ADMINISTRAÇÃO

| Item | Rota | Perfis com o item visível |
|---|---|---|
| Usuários | `/admin/usuarios` | administrador |
| Perfis de Acesso | `/admin/perfis` | administrador |
| Parâmetros | `/admin/parametros` | administrador |
| Auditoria | `/admin/auditoria` | administrador, gestor, diretoria |

**Mensagem quando o perfil não tem nenhum menu:**
`Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.`

---

## 3. Inventário detalhado por tela

Legenda de "Ações": as **ações canônicas** avaliadas na matriz da seção 5
(Criar, Ver, Editar, Excluir, Ativar/Inativar, Aprovar, Reprovar, Cancelar, Duplicar, Buscar, Filtrar,
Ordenar, Paginar, Exportar, Importar, Imprimir, Download, Upload, Adicionar item, Remover item, Alterar status).

### 3.1 Autenticação

| Tela | Rota | Título exibido | Ações principais (texto literal) | Permissão |
|---|---|---|---|---|
| Login | `/login` | (logo + formulário) | **Acessar Sistema** | pública |
| Entrada | `/` | redirect por perfil | — | autenticado |

Campos do login: **E-mail** (placeholder `nome@alphacarnes.com.br`), **Senha** (`••••••••`).

### 3.2 Comercial

| Tela | Rota | Título | Ações (texto literal) | Permissões |
|---|---|---|---|---|
| Clientes | `/comercial/clientes` | Cadastro de Clientes | **Novo Cliente**, **Salvar Cliente**, busca `Buscar cliente...`, filtro Ativo/Inativo/Todos, abas Gerais/Fiscais/Contatos/Preferências | `CLIENTES_LER` / `CLIENTES_GERENCIAR` |
| Pedidos de Venda | `/comercial/pedidos` | Pedidos de Venda | **Novo pedido**, **Abrir**, **Liberar reserva**, busca `Buscar pedido ou cliente...`, filtro de status | `PEDIDOS_LER` / `PEDIDOS_GERENCIAR` / `PEDIDO_FINALIZAR` / `PEDIDO_RESERVA_LIBERAR` / `PEDIDO_OVERBOOKING_CONFIRMAR` |
| Editor de pedido | `/comercial/pedidos` (mesma rota) | Novo Pedido / Editar Pedido | **Adicionar produto**, **Aplicar quantidade**, **Salvar Rascunho**, **Finalizar Pedido**, **Cancelar**; modais **Confirmar overbooking**, **Registrar adendo**, **Liberar reserva** | idem |
| Tabela de Preços | `/comercial/tabela-precos` | Tabela de Preços | **Criar tabela do dia**, **Copiar tabela anterior**, **Salvar**, **Publicar**, **Histórico** | `TABELA_PRECO_LER` / `TABELA_PRECO_GERENCIAR` |
| Disponibilidade | `/comercial/disponibilidade` | Disponibilidade | abas **Mapa de Disponibilidade** / **Grade**, **Limpar filtros**, células F/V/R/C/D/O/E/! | `DISPONIBILIDADE_LER` (menu) |
| Espelho Comercial | `/comercial/espelho` | Espelho Comercial (badge **Provisório P15**) | **Imprimir**, **Exportar**, **Limpar filtros**, agrupar **Por cliente / Por rota / Por representante** | `ESPELHO_COMERCIAL_LER` |

### 3.3 Gestão

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Painel Geral | `/gestao/dashboard` | Painel Geral da Operação | **Atualizar**, **Ir para Operações**, seletor de operação | `COMPRAS_PROGRAMADAS_LER` ou `DISPONIBILIDADE_LER` |
| Operações | `/gestao/operacoes` | Operações (badge **Provisório P1**) | **Gerar cadência**, **Nova Operação Extraordinária**, **Criar Operação**, **Iniciar operação**, **Encerrar**, **Registrar compra** | `OPERACOES_GERENCIAR` (mutação); leitura só com JWT |
| Compras | `/gestao/compras` | Compra Programada (Pedido de Compra) | **Salvar rascunho**, **Confirmar compra**, **Editar compra confirmada**, **Adicionar item**, **Salvar alteração** / **Salvar mesmo assim** | `COMPRAS_PROGRAMADAS_LER` / `_GERENCIAR` |
| Overbooking | `/gestao/overbooking` | Pendências de Overbooking | **Iniciar análise**, **Programar**, **Redistribuir**, **Postergar**, **Gerar novo pedido**, **Marcar como resolvido**, **Cancelar pendência**, **Confirmar Cancelamento** | `PEDIDOS_LER` / `OVERBOOKING_RESOLVER` |
| Aprovações | `/gestao/aprovacoes` | Aprovações | abas **Fila Administrativa de Ocorrências** / **Aprovações Operacionais**; **Registrar andamento**, **Concluir tratativa**, **Aprovar solicitação**, **Rejeitar solicitação**, **Confirmar** | `APROVACOES_LER` / `_DECIDIR` / `_SOLICITAR`, `OCORRENCIA_FORNECEDOR_GERENCIAR` |
| Relatórios SIF | `/gestao/relatorios` | Relatórios SIF (badge **Provisório P8**) | **Gerar**, **Pré-visualizar**, **Retificar**, **Histórico**, **Fechar** | `SIF_LER` / `SIF_GERAR` |

### 3.4 Recebimento & Balança

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Recebimento de Carga | `/recebimento/recebimento-carga` | Recebimento de carga | **Novo recebimento**, **Criar Lote**, **Criar Lote e Ir para Balança**, **Abrir**, **Ir para Balança**, **Editar dados da NF**, **Capturar itens da NF**, **Salvar metadados**, **Registrar divergência**, **Concluir conferência**, **Confirmar conclusão**, **Suspender**, **Cancelar lote**, **Atualizar** | `RECEBIMENTO_LER` / `_GERENCIAR`, `CONFERENCIA_CONCLUIR`, `DIVERGENCIA_RECEBIMENTO_GERENCIAR` |
| Pesagem e Destinação | `/recebimento/pesagem-destinacao` | Pesagem & Destinação | **Capturar Peso**, **Digitar**, **Confirmar peso manual**, **Vincular**, **→ Estoque**, **→ Desossa**, **Confirmar e imprimir etiqueta**, **Cancelar ação realizada**, **Confirmar estorno**, **Trocar lote**, **Trocar Peça** | `PESAGEM_LER` / `_GERENCIAR`, `PESO_MANUAL`, `ASSOCIACAO_GERENCIAR`, `ASSOCIACAO_ESTORNAR`, `ETIQUETA_GERENCIAR` |
| Etiquetas | `/recebimento/etiquetas` | Etiquetas — recebimento | **Ver etiqueta**, **Reimprimir**, **Confirmar**, **Cancelar etiqueta e estornar ação**, **Confirmar cancelamento** | `PESAGEM_LER` / `ETIQUETA_GERENCIAR` |

### 3.5 Desossa

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Painel de Necessidade | `/desossa/dashboard` | Painel de Necessidade | **Atualizar**, **Modo TV**, **Sair**, **Ver detalhes**, **Fechar** | `DESOSSA_PAINEL_LER` \| `DESOSSA_LER` \| `CORTE_GERENCIAR` |
| Pesagem e Destinação (desossa) | `/desossa/pesagem-destinacao` | Pesagem e Destinação | **Selecionar TZ**, chips de regra, slots de saída, **Cancelar ação**, **Cancelar registro de parte**, **Finalizar**, **Finalizar transformação**, **Concluir**, **Registrar divergência e concluir** | `CORTE_GERENCIAR` |
| Etiquetas da desossa | `/desossa/etiquetas` | Etiquetas — Desossa | **Imprimir**, **Reimprimir**, **Cancelar etiqueta**, filtros Produto/Destino/Status/Período | `DESOSSA_LER`, `ETIQUETA_GERENCIAR` |

### 3.6 Estoque

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Consulta de Estoque | `/estoque/consulta` | Consulta de Estoque | abas **Consulta de Estoque** / **Sobras & Congelamento**; **Destinar**, **Confirmar destinação**, **Decidir Destino**, **Reimprimir etiqueta**, **Histórico**, **Limpar**, **Congelar** (desabilitado), **Autorizar Congelamento** (desabilitado), **Apontar Quebra / Descarte** | `ESTOQUE_LER` / `ESTOQUE_GERENCIAR` |
| Entrada de Itens | `/estoque/entrada-itens` | Entrada de Itens | **Confirmar entrada**, **Limpar**, chips **Estoque** / **Pedido** | `ESTOQUE_LER` / `ESTOQUE_ENTRADA` |
| Ajustes | `/estoque/ajustes` | Ajustes de Estoque | **Criar ajuste**, **Aprovar**, **Confirmar aprovação**, **Rejeitar**, **Confirmar rejeição** | `ESTOQUE_AJUSTAR` / `ESTOQUE_AJUSTE_APROVAR` |

### 3.7 Carga

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Planejamento | `/carga/planejamento` | Planejamento de Expedição | **Novo Caminhão**, **Alocar**, **Abrir carga**, **Enviar para conferência**, **Itinerários** | `EXPEDICAO_LER` / `EXPEDICAO_GERENCIAR` |
| Conferência | `/carga/conferencia` | Conferência de Carga | **Bipar**, **Confirmar** (leitura manual), **Marcar divergência**, **Confirmar Divergência**, **Finalizar Conferência**, **Enviar para Faturamento** | `EXPEDICAO_GERENCIAR`, `LEITURA_MANUAL` |
| Enviar para Faturamento | `/carga/enviar-faturamento` | Enviar para Faturamento | **Enviar para Faturamento**, chips **Todas / Em Conferência / Conferida / Enviada para Faturamento / Faturada** | `EXPEDICAO_GERENCIAR` ou `FATURAMENTO_GERENCIAR` |

### 3.8 Faturamento

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Pré-Faturamento | `/faturamento/pre-faturamento` | Pré-Faturamento (badge **Homologação EISS**) | **Consolidar**, **Liberar para Faturamento**, **Emitir NFS-e**, **Cancelar**, **Reprocessar**, **Ver NFS-e** | `FATURAMENTO_LER` / `_GERENCIAR`, `NFSE_EMITIR`, `NFSE_CANCELAR` |
| Notas / XML | `/faturamento/notas-xml` | Notas / XML | **Baixar XML**, **Ver DANFE**, **Ver detalhe**, **Reprocessar**, **Confirmar Cancelamento**, **Entendi**, **Fechar** | `FATURAMENTO_LER`, `NFSE_EMITIR`, `NFSE_CANCELAR` |
| Seguro Manual | `/faturamento/seguro-manual` | Seguro Manual | **Anexar comprovante**, **Anexar**, **Marcar como enviado**, **Marcar como confirmado** | `FATURAMENTO_LER` / `SEGURO_GERENCIAR` |
| Liberação | `/faturamento/liberacao` | Liberação do Caminhão | **Liberar Caminhão**, links **Resolver em …** | `LIBERACAO_GERENCIAR` \| `FATURAMENTO_GERENCIAR` \| `EXPEDICAO_GERENCIAR` |

### 3.9 Cadastros & Regras

| Tela | Rota | Padrão de UI | Ações | Permissões |
|---|---|---|---|---|
| Representantes | `/cadastros/representantes` | tabela + drawer | **Novo Representante**, **Salvar**, Ativar/Inativar, busca, paginação | `REPRESENTANTES_LER` / `_GERENCIAR` |
| Produtos | `/cadastros/produtos` | tabela + drawer com 5 abas (Gerais, Comercial, Operacional, Estoque, Fiscal) | **Novo Produto**, **Salvar**, **Cancelar**, Visualizar, Editar, Ativar/Inativar | `PRODUTOS_LER` / `_GERENCIAR` |
| Fornecedores | `/cadastros/fornecedores` | master-detail + histórico + contagens | **Novo**, **Salvar**, Ativar/Inativar, filtros por chip | `FORNECEDORES_LER` / `_GERENCIAR` |
| Caminhões | `/cadastros/caminhoes` | tabela + drawer | **Novo Caminhão**, **Salvar** | `FROTA_CAMINHOES_LER` / `_GERENCIAR` |
| Motoristas | `/cadastros/motoristas` | tabela + drawer | **Novo Motorista**, **Salvar** | `FROTA_MOTORISTAS_LER` / `_GERENCIAR` |
| Rotas / Itinerários | `/cadastros/rotas` | master-detail + paradas ordenáveis | **Nova Rota**, **Salvar Rota**, **Excluir Rota**, **Subir**, **Descer**, **Remover** | `ROTAS_LER` / `ROTAS_GERENCIAR` (a UI checa `EXPEDICAO_GERENCIAR`/`CLIENTES_LER` — ver GAP-021) |
| Regras de Transformação | `/cadastros/regras-transformacao` | tabela + 2 simuladores (badge **Provisório P12**) | consulta + simular desdobramento + simular desossa | `REGRAS_DESDOBRAMENTO_LER` / `_GERENCIAR`, `DESOSSA_LER` |
| Modelos de Etiqueta | `/cadastros/modelos-etiqueta` | cards com 12 checkboxes (badge **Provisório P9**) | **Salvar Modelo** | `MODELOS_ETIQUETA_LER` / `_GERENCIAR` |
| Itens de Compra | `/cadastros/itens-compra` | CRUD genérico (lista/novo/editar) | **Novo**, **Criar**, **Salvar**, **Editar**, **Cancelar** | `ITENS_COMPRA_LER` / `_GERENCIAR` |
| Itens Comerciais | `/cadastros/itens-comerciais` | CRUD genérico | idem + checkbox **Permite Corte** | `ITENS_COMERCIAIS_LER` / `_GERENCIAR` |
| (fora do menu) Clientes genérico | `/cadastros/clientes` | CRUD genérico com abas | idem | `CLIENTES_LER` / `_GERENCIAR` |
| (fora do menu) Fornecedores genérico | `/cadastros/fornecedores` via `[recurso]` | — | ver GAP-022 | — |

### 3.10 Administração

| Tela | Rota | Título | Ações | Permissões |
|---|---|---|---|---|
| Usuários | `/admin/usuarios` | Gestão de Usuários & Perfis | **Novo Usuário**, **Salvar**, **Aprovar usuário**, **Excluir**, **Filtros**, **Limpar filtros**, **Gerenciar Permissões (RBAC)** | `USUARIOS_LER` / `_GERENCIAR` / `_APROVAR`, `PERFIS_GERENCIAR` |
| Perfis de Acesso | `/admin/perfis` | Perfis de Acesso | toggles da **Matriz de permissões**, chips de **Menus visíveis** | `PERFIS_GERENCIAR` |
| Parâmetros | `/admin/parametros` | Parâmetros do Sistema | **Salvar** por parâmetro (toggle ou texto) | `PARAMETROS_LER` / `_GERENCIAR` |
| Auditoria | `/admin/auditoria` | Auditoria Filtrável | **Aplicar Filtros**, **Exportar CSV**, **Anterior** / **Próxima** | `AUDITORIA_VISUALIZAR` |

---

## 4. Matriz de cobertura de telas (ETAPA 13)

**Regra de aceitação: toda tela acessível deve estar associada a pelo menos uma jornada.**

| # | Tela | Rota | Módulo | Jornada(s) que cobre | Cenários | Coberta? |
|---|---|---|---|---|---|---|
| 1 | Login | `/login` | M01 | JRN-AUTH-001, 002 | 9 | Sim |
| 2 | Entrada / redirect | `/` | M01 | JRN-AUTH-003 | 4 | Sim |
| 3 | Clientes | `/comercial/clientes` | M03 | JRN-CAD-006 | 12 | Sim |
| 4 | Pedidos de Venda (lista) | `/comercial/pedidos` | M07 | JRN-PVD-009 | 6 | Sim |
| 5 | Editor de Pedido | `/comercial/pedidos` (editor) | M07 | JRN-PVD-001..008 | 34 | Sim |
| 6 | Tabela de Preços | `/comercial/tabela-precos` | M09 | JRN-PRC-001..005 | 16 | Sim |
| 7 | Disponibilidade | `/comercial/disponibilidade` | M06 | JRN-DIS-001..003 | 11 | Sim |
| 8 | Espelho Comercial | `/comercial/espelho` | M10 | JRN-ESP-001, 002 | 8 | Sim |
| 9 | Painel Geral | `/gestao/dashboard` | M22 | JRN-DSH-001 | 8 | Sim |
| 10 | Operações | `/gestao/operacoes` | M04 | JRN-OPE-001..004 | 16 | Sim |
| 11 | Compras | `/gestao/compras` | M05 | JRN-CMP-001..005 | 25 | Sim |
| 12 | Overbooking | `/gestao/overbooking` | M08 | JRN-OVB-001..005 | 18 | Sim |
| 13 | Aprovações & Ocorrências | `/gestao/aprovacoes` | M17 | JRN-APR-001, JRN-REC-005 | 12 | Sim |
| 14 | Relatórios SIF | `/gestao/relatorios` | M23 | JRN-SIF-001 | 6 | Sim |
| 15 | Recebimento de Carga | `/recebimento/recebimento-carga` | M12 | JRN-REC-001..007 | 41 | Sim |
| 16 | Pesagem e Destinação | `/recebimento/pesagem-destinacao` | M13 | JRN-PES-001..005 | 39 | Sim |
| 17 | Etiquetas (recebimento) | `/recebimento/etiquetas` | M14 | JRN-ETQ-001 | 6 | Sim |
| 18 | Painel de Necessidade | `/desossa/dashboard` | M15 | JRN-DES-001 | 4 | Sim |
| 19 | Pesagem/Destinação (desossa) | `/desossa/pesagem-destinacao` | M15 | JRN-DES-002, 003 | 14 | Sim |
| 20 | Etiquetas (desossa) | `/desossa/etiquetas` | M15 | JRN-DES-004 | 4 | Sim |
| 21 | Consulta de Estoque | `/estoque/consulta` | M16 | JRN-EST-001 | 12 | Sim |
| 22 | Entrada de Itens | `/estoque/entrada-itens` | M16 | JRN-EST-002 | 9 | Sim |
| 23 | Ajustes de Estoque | `/estoque/ajustes` | M16 | JRN-EST-003 | 6 | Sim |
| 24 | Planejamento de Carga | `/carga/planejamento` | M18 | JRN-EXP-001 | 18 | Sim |
| 25 | Conferência de Carga | `/carga/conferencia` | M18 | JRN-EXP-002..004 | 20 | Sim |
| 26 | Enviar para Faturamento | `/carga/enviar-faturamento` | M18 | JRN-EXP-005 | 6 | Sim |
| 27 | Pré-Faturamento | `/faturamento/pre-faturamento` | M19 | JRN-FAT-001, 002 | 18 | Sim |
| 28 | Notas / XML | `/faturamento/notas-xml` | M19 | JRN-FAT-003, 004 | 11 | Sim |
| 29 | Seguro Manual | `/faturamento/seguro-manual` | M20 | JRN-SEG-001 | 9 | Sim |
| 30 | Liberação do Caminhão | `/faturamento/liberacao` | M21 | JRN-LIB-001 | 8 | Sim |
| 31 | Representantes | `/cadastros/representantes` | M03 | JRN-CAD-001 | 8 | Sim |
| 32 | Produtos | `/cadastros/produtos` | M03 | JRN-CAD-002 | 11 | Sim |
| 33 | Fornecedores | `/cadastros/fornecedores` | M03 | JRN-CAD-005 | 11 | Sim |
| 34 | Caminhões | `/cadastros/caminhoes` | M03 | JRN-CAD-008 | 8 | Sim |
| 35 | Motoristas | `/cadastros/motoristas` | M03 | JRN-CAD-009 | 8 | Sim |
| 36 | Rotas / Itinerários | `/cadastros/rotas` | M03 | JRN-CAD-007 | 9 | Sim |
| 37 | Regras de Transformação | `/cadastros/regras-transformacao` | M03 | JRN-CAD-010, 011 | 10 | Sim |
| 38 | Modelos de Etiqueta | `/cadastros/modelos-etiqueta` | M03 | JRN-CAD-012 | 5 | Sim |
| 39 | Itens de Compra | `/cadastros/itens-compra` | M03 | JRN-CAD-003 | 7 | Sim |
| 40 | Itens Comerciais | `/cadastros/itens-comerciais` | M03 | JRN-CAD-004 | 7 | Sim |
| 41 | Usuários | `/admin/usuarios` | M02 | JRN-ADM-001..004 | 18 | Sim |
| 42 | Perfis de Acesso | `/admin/perfis` | M02 | JRN-ADM-005, 006 | 7 | Sim |
| 43 | Parâmetros | `/admin/parametros` | M02 | JRN-ADM-007 | 6 | Sim |
| 44 | Auditoria | `/admin/auditoria` | M02 | JRN-ADM-008 | 8 | Sim |
| 45 | CRUD genérico — lista | `/cadastros/[recurso]` | M03 | JRN-CAD-000 | 6 | Sim |
| 46 | CRUD genérico — novo | `/cadastros/[recurso]/novo` | M03 | JRN-CAD-000 | 5 | Sim |
| 47 | CRUD genérico — editar | `/cadastros/[recurso]/[id]/editar` | M03 | JRN-CAD-000 | 5 | Sim |
| 48 | Clientes (rota genérica) | `/cadastros/clientes` | M03 | JRN-CAD-006-A3 | 1 | Sim (via alternativo) |
| 49 | Modo TV da Desossa | `/desossa/dashboard` (modo) | M15 | JRN-DES-001 (passos 6–8) | 1 | Sim |
| 50 | Troca de Peça (wizard) | modal em `/recebimento/pesagem-destinacao` | M13 | JRN-PES-004 | 9 | Sim |

**Cobertura de telas: 50/50 = 100%.**

### Telas / componentes órfãos identificados

| Item | Situação | Registro |
|---|---|---|
| `components/placeholder-page.tsx` (`"Em desenvolvimento"`) | Componente existe mas **nenhuma rota o importa** — resíduo de andaime | GAP-023 |
| `/cadastros/fornecedores` servido pelo CRUD genérico | Conflito de rota: a rota estática dedicada vence; a config genérica de `fornecedores` fica inalcançável | GAP-022 |
| `/cadastros/clientes` (genérico) | Alcançável, mas fora do menu por decisão (AD-11); é duplicata legada de `/comercial/clientes` | GAP-024 (informativo) |

---

## 5. Matriz de cobertura de ações (ETAPA 14)

| Ação canônica | Onde existe (exemplos) | Jornada que valida | Coberta? |
|---|---|---|---|
| **Criar** | Todos os cadastros, operação, compra, pedido, PF, recebimento, ajuste, entrada, caminhão, seguro | JRN-CAD-000/001..012, JRN-OPE-002, JRN-CMP-001, JRN-PVD-001, JRN-PFN-001, JRN-REC-001, JRN-EST-002/003, JRN-EXP-001 | Sim |
| **Visualizar / detalhar** | Todas as listas com drawer, master-detail ou `/:id` | JRN-CAD-005, JRN-PVD-009, JRN-REC-007, JRN-FAT-004 | Sim |
| **Editar** | Cadastros, compra em rascunho, compra confirmada (modal), pedido, metadados de recebimento, NF, preços | JRN-CAD-002-A1, JRN-CMP-001-A2, JRN-CMP-003, JRN-PVD-004/005, JRN-REC-001-A3/A4, JRN-PRC-003 | Sim |
| **Excluir (soft delete)** | Todos os cadastros (`DELETE /:id`), usuários, rota (**Excluir Rota**) | JRN-CAD-000-A4, JRN-CAD-007-A2, JRN-ADM-002 | Sim |
| **Restaurar** | `POST /:id/restaurar` em todos os cadastros | JRN-CAD-000-A5 (**🔎 sem botão na UI — GAP-002**) | Parcial (via API) |
| **Ativar / Inativar** | Switch Status nos cadastros | JRN-CAD-001-A1, JRN-CAD-002-A2 | Sim |
| **Aprovar** | Usuário, ajuste de estoque, aprovação operacional | JRN-ADM-003, JRN-EST-003, JRN-APR-001 | Sim |
| **Reprovar / Rejeitar** | Ajuste de estoque, aprovação operacional | JRN-EST-003 (passos 7–9), JRN-APR-001-A1 | Sim |
| **Cancelar** | Compra, pedido, lote, etiqueta, NFS-e, pendência, transformação, ação de pesagem | JRN-CMP-004, JRN-PVD-007, JRN-REC-006, JRN-ETQ-001, JRN-FAT-003, JRN-OVB-005, JRN-PES-003 | Sim |
| **Duplicar / Copiar** | **Copiar tabela anterior** (preços) | JRN-PRC-002 | Sim |
| **Buscar** | Todas as listas (`search`) | JRN-CAD-000-A1, JRN-PVD-009-A1, JRN-EXP-002 | Sim |
| **Filtrar** | Status, período, produto, destino, perfil, módulo, operação | JRN-OPE-004, JRN-DES-004, JRN-ADM-008, JRN-EST-001 | Sim |
| **Ordenar** | Paradas de rota (**Subir**/**Descer**); ordenação de coluna **não** encontrada nas tabelas | JRN-CAD-007-A1 | Parcial — 🔎 GAP-025 |
| **Paginar** | `page`/`pageSize` (20/pág.) com **Anterior**/**Próxima** | JRN-CAD-000-A2, JRN-ADM-008-A2 | Sim |
| **Exportar** | Espelho (CSV), Auditoria (CSV) | JRN-ESP-002, JRN-ADM-008-A3 | Sim |
| **Importar** | **Não existe** nenhuma tela de importação | — | Não aplicável — GAP-026 |
| **Imprimir** | Espelho (`window.print()`), etiquetas (impressora), romaneio (endpoint) | JRN-ESP-002, JRN-ETQ-001, JRN-EXP-002 | Sim |
| **Download** | **Baixar XML**, **Ver DANFE** (dependem de `linkNfse` real) | JRN-FAT-004-N2 (🔎 indisponível com `NFSE_FAKE` — GAP-011) | Parcial |
| **Upload** | **Anexar comprovante** do seguro — registra **apenas nome e descrição**, sem arquivo físico | JRN-SEG-001 (passos 5–6) — 🔎 GAP-010 / GAP-057 | Parcial |
| **Adicionar item** | Item de compra, produto no pedido, parada de rota, peça na carga, saída de transformação | JRN-CMP-001, JRN-PVD-004, JRN-CAD-007, JRN-EXP-001, JRN-DES-002 | Sim |
| **Remover item** | Item de pedido, linha de compra, parada, item de carga, subitem | JRN-PVD-005, JRN-CMP-001-A3, JRN-CAD-007-A3, JRN-EXP-001-A4 | Sim |
| **Transferir item** | `POST /operacao/expedicao/itens/:itemId/transferir` | JRN-EXP-001-A3 — 🔎 **sem botão na UI** — GAP-005 | Não (só API) |
| **Alterar status** | Operação, compra, pedido, pendência, caminhão, NFS-e, seguro, ajuste, etiqueta | JRN-OPE-003, JRN-CMP-002, JRN-PVD-002, JRN-OVB-001..005, JRN-EXP-001..005, JRN-FAT-002/003, JRN-SEG-001 | Sim |

**Cobertura de ações: 18 completas, 5 parciais, 1 não aplicável.**

---

## 6. Rotas do BFF por prefixo

| Prefixo `/api/*` | Handlers | Domínio |
|---|---|---|
| `auth` | 3 | login, logout, refresh |
| `admin` | 15 | usuários, perfis, parâmetros, auditoria |
| `cadastros` | 18 | CRUD genérico, frota, rotas, produtos, modelos, regras |
| `comercial` | 22 | pedidos, compras, disponibilidade, espelho, overbooking |
| `desossa` | 6 | painel, faltas, etiquetas, regras |
| `gestao` | 5 | dashboard, aprovações |
| `operacao` | ~90 | recebimento, pesagem, corte, estoque, expedição, faturamento, etiquetas |
| `operacoes` | 5 | operações do dia |
| `precos` | 6 | tabelas de preço |
| `sif` | 5 | relatórios SIF |

> Ao homologar, lembre-se de que o navegador nunca fala com `localhost:4001` diretamente: o BFF em
> `localhost:4000/api/...` repassa a chamada com o cookie JWT. Isso importa para diagnosticar erros —
> um `Erro de conexão` costuma ser BFF↔backend, e um erro com mensagem em português é regra de negócio.
