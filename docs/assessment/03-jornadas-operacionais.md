# 03 — Jornadas Operacionais (Parte 1: Fundação)

> **Documento principal do assessment.** Contém as fichas detalhadas de cada jornada de homologação.
> Dividido em quatro arquivos por volume:
>
> | Arquivo | Módulos |
> |---|---|
> | **`03-jornadas-operacionais.md`** (este) | M01 Autenticação · M02 Administração · M03 Cadastros · M04 Operações |
> | [`03b-jornadas-comercial.md`](03b-jornadas-comercial.md) | M05 Compras · M06 Disponibilidade · M07 Pedidos · M08 Overbooking · M09 Preços · M10 Espelho |
> | [`03c-jornadas-recebimento-producao.md`](03c-jornadas-recebimento-producao.md) | M11 Pedido ao Fornecedor · M12 Recebimento · M13 Pesagem · M14 Etiquetas · M15 Desossa · M16 Estoque · M17 Aprovações |
> | [`03d-jornadas-expedicao-faturamento.md`](03d-jornadas-expedicao-faturamento.md) | M18 Expedição · M19 Faturamento/NFS-e · M20 Seguro · M21 Liberação · M22 Painel Geral · M23 Relatórios SIF |

---

## Como usar estas fichas

1. **Execute na ordem do [`07-roadmap-homologacao.md`](07-roadmap-homologacao.md).** Muitas jornadas
   dependem de dados criados por jornadas anteriores; a ficha declara isso em *Pré-condições*.
2. **Cada linha da tabela "Passo a passo" é uma ação verificável.** Os textos entre **negrito** são
   literais da interface — se o texto na tela for diferente, isso já é um achado (registre como gap de UX).
3. **Cenários alternativos (`A`), negativos (`N`) e de permissão (`P`)** têm ID próprio e entram na matriz
   mestre. Execute-os depois do caminho feliz da mesma jornada.
4. **Registre evidência** conforme a seção *Evidências recomendadas* de cada ficha.
5. Quando encontrar comportamento diferente do esperado, **não conclua que é bug**: verifique se a ficha
   marca o ponto como ⚠️ REGRA A CONFIRMAR COM NEGÓCIO.

### Convenções de ambiente para todas as jornadas

| Item | Valor |
|---|---|
| Frontend | `http://localhost:4000` |
| Backend | `http://localhost:4001` |
| Banco | `localhost:15433` (`alphacarnes`/`alphacarnes`) |
| Flags obrigatórias no backend | `HARDWARE_FAKE=1`, `NFSE_FAKE=1` |
| Usuário inicial | `admin@alphacarnes.local` / `Admin@AlphaCarnes2026!` |
| Peso devolvido pela balança falsa | **12,500 kg** por captura |
| Gatilhos do NFS-e falso | valor `999.99` → erro de negócio; valor `888.88` → timeout |

### Dados de teste padronizados

Use este conjunto em todas as jornadas para manter rastreabilidade entre elas.

| Apelido | Entidade | Valores sugeridos |
|---|---|---|
| **REP-A** | Representante | Código `REP-001`, Nome `Vendedor Homologação A`, Canal `Interno` |
| **REP-B** | Representante | Código `REP-002`, Nome `Vendedor Homologação B`, Canal `Externo` |
| **ROTA-A** | Rota | Código `RT-01`, Nome `Rota Zona Oeste`, Região `Oeste`, 2 paradas |
| **FORN-A** | Fornecedor | Código `FOR-001`, Razão `Frigorífico Homologação A LTDA`, CNPJ válido |
| **FORN-B** | Fornecedor | Código `FOR-002`, Razão `Frigorífico Homologação B LTDA`, CNPJ válido |
| **CLI-A** | Cliente | Razão `Açougue Homologação A LTDA`, Nome Fantasia/Marca `Açougue A`, CNPJ válido, REP-A, ROTA-A |
| **CLI-B** | Cliente | Razão `Açougue Homologação B LTDA`, Nome Fantasia/Marca `Açougue B`, CNPJ válido, REP-B |
| **ICOMP-BOI** | Item de compra | Código `BOI-CASADO`, Descrição `Boi casado`, Unidade `cabeca` |
| **ICOM-TZ** | Item comercial | `TZ` (já vem do seed MVP) |
| **ICOM-DT** | Item comercial | `DT` (seed) |
| **ICOM-PA** | Item comercial | `PA` (seed) |
| **CAM-A** | Caminhão | Placa `HOM1A23`, capacidade `8000` kg |
| **MOT-A** | Motorista | Nome `Motorista Homologação A`, documento válido |

---

# M01 — Autenticação & Sessão

## Jornada: Entrar no sistema

### ID
`JRN-AUTH-001`

### Objetivo
Garantir que um usuário válido consiga autenticar, receber os cookies de sessão e ser direcionado à sua
tela de entrada, com o menu correspondente ao seu perfil.

### Perfil do usuário
Todos os 11 perfis (executar ao menos com `administrador` na Fase 1 e repetir por perfil na Fase de permissões).

### Pré-condições
- Aplicação no ar (`docker compose up -d`), migrations e seed executados.
- Usuário existente e **ativo**.

### Dados necessários
- E-mail: `admin@alphacarnes.local`
- Senha: `Admin@AlphaCarnes2026!`

### Ponto inicial
Navegador em `http://localhost:4000/login`

### Passo a passo

| Passo | Tela | Ação do usuário | Dados utilizados | Resultado esperado |
|---|---|---|---|---|
| 1 | Login | Abrir `http://localhost:4000/login` | — | Tela com logo, campos **E-mail** e **Senha** e botão **Acessar Sistema** |
| 2 | Login | Preencher **E-mail** | `admin@alphacarnes.local` | Campo aceita; placeholder `nome@alphacarnes.com.br` desaparece |
| 3 | Login | Preencher **Senha** | `Admin@AlphaCarnes2026!` | Caracteres mascarados |
| 4 | Login | Clicar **Acessar Sistema** | — | Redirecionamento para a rota de entrada do perfil; para `administrador`, o **Painel Geral da Operação** |
| 5 | Shell | Conferir barra lateral | — | 9 grupos de menu visíveis para `administrador`, com 41 itens |
| 6 | Shell | Conferir identificação do usuário | — | Nome do usuário no rodapé/topo da sidebar, com opção **Sair** |

### Resultado final esperado
Sessão autenticada com cookies `access_token` (15 min) e `refresh_token` (8 h). O `GET /auth/me` responde com
o payload do JWT acrescido de `menusVisiveis` e `escopoRepresentantes`.

### Efeitos colaterais
- `usuarios.ultimo_acesso` atualizado.
- Registro em `refresh_tokens` (hash do token, `expires_at`).
- Nenhuma alteração de dado de negócio.

### Validações funcionais
- Cookies presentes e `HttpOnly`.
- Menu exibido = interseção com `perfis.menus_visiveis` do(s) perfil(is) do usuário.
- Reload da página (F5) mantém a sessão.

### Validações visuais / UX
- Logo AlphaCarnes; labels **E-mail** e **Senha** corretos.
- Estado de loading no botão durante a requisição.
- Ordem de tabulação: E-mail → Senha → Acessar Sistema.
- Campo de senha mascarado; sem autocompletar credencial de outro usuário.
- Responsividade: formulário centralizado e utilizável em 1366×768.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-AUTH-001-A1` | Login com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` customizados no `.env` | Autentica com as credenciais do `.env` |
| `JRN-AUTH-001-A2` | Login com usuário de perfil operacional (ex.: `recebimento_pesagem`) | Entra e vê apenas 6 itens de menu |
| `JRN-AUTH-001-A3` | Login com usuário que tem **dois perfis** | Menu = união dos `menus_visiveis` dos dois perfis |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-AUTH-001-N1` | Senha errada | `401` e mensagem **Credenciais inválidas**; sem cookie |
| `JRN-AUTH-001-N2` | E-mail inexistente | Mesma mensagem **Credenciais inválidas** (não revelar existência do e-mail) |
| `JRN-AUTH-001-N3` | Usuário inativo (`ativo=false`) | `401` **Usuário inativo** |
| `JRN-AUTH-001-N4` | E-mail em branco / formato inválido | Validação impede o envio ou retorna erro de validação legível |
| `JRN-AUTH-001-N5` | Muitas tentativas seguidas | O controller tem `@SkipThrottle()` na classe, mas o login tem throttle próprio — ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: qual é o limite e o texto exibido ao usuário bloqueado |
| `JRN-AUTH-001-N6` | Duplo clique em **Acessar Sistema** | Uma única sessão criada; sem erro visível |

### Permissões
Ação pública. Nenhuma permissão nomeada.

### Critérios de aprovação
Login válido entra; os 6 cenários negativos produzem a mensagem esperada sem tela branca nem stack trace.

### Evidências recomendadas
Print da tela de login, print do painel após login, print da sidebar, e cópia da resposta de `GET /auth/me`.

---

## Jornada: Encerrar sessão e renovar token

### ID
`JRN-AUTH-002`

### Objetivo
Validar logout explícito e renovação automática de sessão.

### Perfil do usuário
Qualquer autenticado.

### Pré-condições
`JRN-AUTH-001` concluída.

### Ponto inicial
Qualquer tela autenticada.

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Sidebar | Abrir o menu do usuário | — | Opção **Sair** visível |
| 2 | Sidebar | Clicar **Sair** | — | Redireciona para `/login`; cookies limpos |
| 3 | Navegador | Tentar voltar (botão "voltar") para uma tela autenticada | — | Redireciona novamente para `/login` |
| 4 | — | Fazer login e aguardar > 15 min sem interagir; depois navegar | — | O refresh renova a sessão de forma transparente (sem novo login) até 8 h |

### Resultado final esperado
Logout invalida a sessão; refresh mantém o usuário logado dentro da janela de 8 h.

### Efeitos colaterais
`refresh_tokens.revoked_at` preenchido no logout.

### Validações funcionais / UX
- Após logout, nenhuma chamada `/api/*` autenticada tem sucesso.
- Nenhuma informação do usuário anterior permanece em cache visual.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-AUTH-002-N1` | Chamar refresh sem cookie | `401` **Refresh token ausente** |
| `JRN-AUTH-002-N2` | Passar de 8 h inativo e navegar | Volta para `/login` sem erro feio |
| `JRN-AUTH-002-N3` | Logout com sessão já expirada | Não quebra; leva para `/login` |

### Critérios de aprovação
Sessão encerra e renova sem tela de erro.

### Evidências recomendadas
Print pós-logout e print das requisições `401` no DevTools.

---

## Jornada: Roteamento de entrada e menu por perfil

### ID
`JRN-AUTH-003`

### Objetivo
Confirmar que cada perfil recebe apenas os itens de menu previstos por `MENUS_VISIVEIS_POR_PERFIL` e cai na
tela de entrada correta.

### Perfil do usuário
Todos os 11.

### Pré-condições
`JRN-ADM-001` executada — os 10 usuários não-administradores precisam existir.

### Dados necessários
Um usuário por perfil, com senha conhecida (sugestão: `Homolog@2026!`).

### Ponto inicial
`/login` para cada usuário, em janela anônima diferente.

### Passo a passo

| Passo | Tela | Ação | Resultado esperado |
|---|---|---|---|
| 1 | Login | Entrar com cada perfil | Redireciona para a primeira rota visível do perfil |
| 2 | Shell | Contar os itens de menu | Bater com a tabela abaixo |
| 3 | Shell | Conferir a ausência dos grupos não autorizados | Grupo não aparece se nenhum item dele estiver visível |

**Contagem esperada de itens de menu por perfil** (de `menus-canonicos.ts`):

| Perfil | Itens | Grupos visíveis |
|---|---|---|
| administrador | 41 | 9 |
| gestor | 33 | 9 |
| comercial | 8 | Comercial, Gestão, Desossa |
| compras | 5 | Gestão, Recebimento, Cadastros |
| recebimento_pesagem | 7 | Gestão, Recebimento, Estoque |
| corte | 3 | Desossa |
| expedicao | 11 | Comercial, Estoque, Carga, Cadastros |
| conferente | 1 | Carga |
| faturamento | 8 | Comercial, Gestão, Recebimento, Faturamento |
| logistica | 3 | Faturamento |
| diretoria | 6 | Comercial, Gestão, Faturamento, Administração |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-AUTH-003-N1` | Perfil sem nenhum menu (criar um perfil e esvaziar os menus) | Mensagem **Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.** |

### Critérios de aprovação
Contagem exata por perfil e mensagem correta no caso vazio.

### Evidências recomendadas
Print da sidebar de cada um dos 11 perfis.

---

## Jornada: Acesso direto a URL sem permissão

### ID
`JRN-AUTH-004`

### Objetivo
Verificar a fronteira real de autorização: menu escondido **não** é controle de acesso; a permissão nomeada é.

### Perfil do usuário
`conferente` (o mais restrito: 1 item de menu).

### Pré-condições
Usuário `conferente` criado e ativo.

### Ponto inicial
Logado como `conferente`.

### Passo a passo

| Passo | Ação | URL | Resultado esperado |
|---|---|---|---|
| 1 | Digitar a URL na barra de endereços | `/admin/usuarios` | Bloqueio: a página exige `USUARIOS_LER`; deve redirecionar ou exibir mensagem de sem permissão — **nunca** listar usuários |
| 2 | Idem | `/comercial/pedidos` | Sem `PEDIDOS_LER`: bloqueio equivalente |
| 3 | Idem | `/faturamento/pre-faturamento` | Bloqueio |
| 4 | Idem | `/carga/conferencia` | **Permite** (conferente tem `EXPEDICAO_LER`/`EXPEDICAO_GERENCIAR`/`LEITURA_MANUAL`) |
| 5 | DevTools | Chamar diretamente `POST /api/comercial/pedidos` | `403` do backend, sem persistir nada |

### Resultado final esperado
Nenhuma informação vaza por URL direta; o backend recusa mesmo que a UI deixasse passar.

### Validações funcionais
- A mensagem de bloqueio deve ser explícita (`Você não tem permissão para visualizar …`) ou redirecionamento
  limpo — nunca tela em branco nem erro 500.

### Cenários de permissão

| ID | Perfil | Rota | Esperado |
|---|---|---|---|
| `JRN-AUTH-004-P1` | conferente | `/admin/perfis` | Negado |
| `JRN-AUTH-004-P2` | comercial | `/faturamento/liberacao` | Negado |
| `JRN-AUTH-004-P3` | recebimento_pesagem | `/comercial/pedidos` (POST) | `403` |
| `JRN-AUTH-004-P4` | diretoria | qualquer POST de mutação operacional | `403` (perfil é somente leitura) |
| `JRN-AUTH-004-P5` | logistica | `/carga/planejamento` | Negado (não tem `EXPEDICAO_GERENCIAR`) |

### Critérios de aprovação
Zero acessos indevidos; todas as recusas com resposta legível.

### Evidências recomendadas
Print de cada bloqueio + captura do `403` no DevTools.

---

# M02 — Administração

## Jornada: Criar usuário e atribuir perfis

### ID
`JRN-ADM-001`

### Objetivo
Provisionar os usuários dos 10 perfis não-administradores, que são pré-requisito de todas as jornadas de
permissão e da jornada E2E multiperfil.

### Perfil do usuário
`administrador`.

### Pré-condições
- Logado como administrador (permissões `USUARIOS_GERENCIAR` e `PERFIS_GERENCIAR`).

### Dados necessários

| Campo | Valor sugerido |
|---|---|
| Nome | `Homolog Gestor` (repetir por perfil) |
| E-mail | `gestor@homolog.local` |
| Senha | `Homolog@2026!` (mín. 8 caracteres) |
| Ativo | ligado |
| Perfis | `gestor` |

Repetir para: `compras`, `comercial`, `recebimento_pesagem`, `corte`, `expedicao`, `conferente`,
`faturamento`, `logistica`, `diretoria`.

### Ponto inicial
Menu → **ADMINISTRAÇÃO** → **Usuários** (`/admin/usuarios`)

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Gestão de Usuários & Perfis | Clicar **Novo Usuário** | — | Painel lateral **Novo Usuário** abre |
| 2 | Painel | Preencher **Nome** | `Homolog Gestor` | — |
| 3 | Painel | Preencher **E-mail** | `gestor@homolog.local` | — |
| 4 | Painel | Preencher **Senha** | `Homolog@2026!` | Campo mascarado; mínimo de 8 caracteres |
| 5 | Painel | Manter o switch **Ativo** ligado | — | — |
| 6 | Painel | Marcar o perfil **gestor** na lista **Perfis** | — | Checkbox marcado |
| 7 | Painel | Clicar **Salvar** | — | Painel fecha; usuário aparece na tabela com o perfil e status **Ativo**, **Último Acesso** = `Nunca acessou` |
| 8 | — | Repetir passos 1–7 para os outros 9 perfis | — | 10 usuários criados |
| 9 | Sidebar direita | Conferir **Resumo de Perfis** | — | Contagem por perfil atualizada |

### Resultado final esperado
11 usuários no total (admin do seed + 10 criados), cada um com exatamente um perfil.

### Efeitos colaterais
- Linhas em `usuarios` e `usuarios_perfis`.
- Eventos `INSERT` em `auditoria` (módulo de usuários), verificáveis em `JRN-ADM-008`.

### Validações funcionais
- Senha é gravada com hash (nunca aparece em nenhuma tela ou resposta de API).
- O usuário criado consegue efetivamente logar (`JRN-AUTH-003`).
- O usuário recebe exatamente os menus do perfil escolhido.

### Validações visuais / UX
- Labels **Nome**, **E-mail**, **Senha**, **Ativo**, **Perfis**, **Representantes permitidos**.
- Campos obrigatórios sinalizados; erro de validação destaca o campo e a aba correspondente (AD-12).
- Botão **Salvar** com estado de loading; sem duplicar registro em duplo clique.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ADM-001-A1` | Criar usuário com **dois perfis** (ex.: `gestor` + `faturamento`) | Menu = união; permissões = união |
| `JRN-ADM-001-A2` | Criar usuário com o switch **Ativo** desligado | Usuário criado, mas login retorna **Usuário inativo** |
| `JRN-ADM-001-A3` | Criar usuário **sem nenhum perfil** | Criado; ao logar, vê a mensagem de "nenhum módulo liberado" |
| `JRN-ADM-001-A4` | Usar **Filtros** por perfil e por status | Tabela filtra; **Limpar filtros** restaura |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-001-N1` | E-mail já existente | `409` com mensagem de conflito; nenhum usuário duplicado |
| `JRN-ADM-001-N2` | Senha com menos de 8 caracteres | Validação bloqueia com mensagem em português |
| `JRN-ADM-001-N3` | Nome ou e-mail em branco | Validação bloqueia; campo destacado |
| `JRN-ADM-001-N4` | E-mail em formato inválido (`abc@`) | Validação bloqueia |
| `JRN-ADM-001-N5` | Nome com 300 caracteres | Validação de tamanho ou truncamento controlado — ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: limite oficial do campo |
| `JRN-ADM-001-N6` | Duplo clique em **Salvar** | Um único usuário criado |
| `JRN-ADM-001-N7` | Fechar o painel no meio do preenchimento e reabrir | Formulário limpo, sem resíduo do anterior |

### Permissões

| Perfil | Pode criar usuário? | Pode atribuir perfil? |
|---|---|---|
| administrador | Sim (`USUARIOS_GERENCIAR`) | Sim (`PERFIS_GERENCIAR`) |
| gestor | Não | Não |
| demais | Não | Não |

`JRN-ADM-001-P1`: logado como `gestor`, `/admin/usuarios` não deve estar no menu nem permitir criação.

### Critérios de aprovação
Os 10 usuários criados conseguem logar e enxergam exatamente o menu previsto; os 7 negativos falham com
mensagem clara.

### Evidências recomendadas
Print da lista com os 11 usuários, print de um painel de criação preenchido, print de dois erros negativos.

---

## Jornada: Editar, inativar, excluir e restaurar usuário

### ID
`JRN-ADM-002`

### Objetivo
Cobrir o restante do ciclo de vida do usuário.

### Perfil do usuário
`administrador`.

### Pré-condições
`JRN-ADM-001` concluída.

### Ponto inicial
`/admin/usuarios`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Clicar no ícone de editar de `Homolog Conferente` | — | Painel **Editar Usuário** abre com os dados carregados; campo **Senha** vazio (não é obrigatório na edição) |
| 2 | Alterar **Nome** | `Homolog Conferente 2` | — |
| 3 | Clicar **Salvar** | — | Tabela reflete o novo nome |
| 4 | Reabrir e desligar o switch **Ativo** | — | Status na tabela vira **Inativo** |
| 5 | Tentar logar com esse usuário em janela anônima | — | **Usuário inativo** |
| 6 | Voltar, religar **Ativo**, salvar | — | Login volta a funcionar |
| 7 | Clicar no ícone de remover | — | Confirmação **Remover este usuário?** |
| 8 | Confirmar | — | Usuário some da lista (soft delete: `deleted_at` preenchido) |

### Resultado final esperado
Usuário editável, inativável e removível logicamente; o registro permanece no banco.

### Efeitos colaterais
Eventos `UPDATE` e `DELETE` em `auditoria`.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ADM-002-A1` | Restaurar usuário removido via `POST /usuarios/:id/restaurar` | Volta à lista — 🔎 **não há botão de restaurar na UI** (GAP-002) |
| `JRN-ADM-002-A2` | Trocar o perfil de um usuário (de `comercial` para `expedicao`) | Menus mudam no próximo login/navegação |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-002-N1` | Alterar o e-mail para um já usado | `409` |
| `JRN-ADM-002-N2` | Remover o **próprio** usuário administrador logado | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: o código não impede explicitamente auto-exclusão. Se o sistema permitir e o administrador for o único, a instalação fica sem admin |
| `JRN-ADM-002-N3` | Editar usuário inexistente (ID inválido na URL) | `404` legível |
| `JRN-ADM-002-N4` | Remover um usuário que já criou registros (ex.: pesou peças) | Registros históricos preservados com o autor; sem erro de FK |

### Permissões
`USUARIOS_GERENCIAR`. `JRN-ADM-002-P1`: `gestor` tem `USUARIOS_APROVAR` mas **não** `USUARIOS_GERENCIAR` —
não pode editar nem remover.

### Critérios de aprovação
Ciclo completo sem perda de histórico e sem quebrar integridade.

### Evidências recomendadas
Prints antes/depois de cada transição + linha de auditoria correspondente.

---

## Jornada: Aprovar usuário

### ID
`JRN-ADM-003`

### Objetivo
Exercitar o controle SF-01 (segregação: quem cria não é necessariamente quem aprova).

### Perfil do usuário
`administrador` ou `gestor` (ambos têm `USUARIOS_APROVAR`).

### Pré-condições
Usuário criado em `JRN-ADM-001`.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir `/admin/usuarios` como `gestor` | ⚠️ `gestor` **não tem** `/admin/usuarios` no seu `menus_visiveis`; acessar pela URL direta |
| 2 | Abrir o usuário e clicar **Aprovar usuário** | Usuário marcado como aprovado |
| 3 | Conferir a auditoria | Evento `ACAO_MANUAL` com o autor da aprovação |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-003-N1` | Aprovar duas vezes | Idempotente ou mensagem clara — ⚠️ REGRA A CONFIRMAR COM NEGÓCIO |
| `JRN-ADM-003-N2` | Aprovar como `comercial` | `403` |

### 🔎 Observação
O menu de `gestor` não inclui `/admin/usuarios`, embora o perfil tenha `USUARIOS_APROVAR`. Na prática, o
gestor só chega à ação por URL direta. Registrado como **GAP-003**.

### Critérios de aprovação
Aprovação registrada e auditada; recusa correta para quem não tem a permissão.

---

## Jornada: Definir escopo de representantes do usuário

### ID
`JRN-ADM-004`

### Objetivo
Validar o recorte de visibilidade comercial: um usuário limitado a REP-A só enxerga clientes e pedidos de REP-A.

### Perfil do usuário
`administrador`.

### Pré-condições
- REP-A e REP-B cadastrados (`JRN-CAD-001`).
- CLI-A vinculado a REP-A; CLI-B a REP-B (`JRN-CAD-006`).
- Usuário `comercial` criado.

### Passo a passo

| Passo | Tela | Ação | Resultado esperado |
|---|---|---|---|
| 1 | `/admin/usuarios` | Abrir o usuário `comercial` | Painel com bloco **Representantes permitidos** |
| 2 | Painel | Buscar em `Buscar por nome` e marcar **REP-A** | Checkbox marcado |
| 3 | Painel | **Salvar** | Escopo persistido em `usuarios_representantes` |
| 4 | Janela anônima | Logar como `comercial` e abrir `/comercial/clientes` | Vê **apenas** CLI-A |
| 5 | — | Abrir `/comercial/pedidos` | Vê apenas pedidos de clientes de REP-A |

### Resultado final esperado
Filtro de escopo aplicado no backend (não apenas visual).

### Efeitos colaterais
Registros em `usuarios_representantes`.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ADM-004-A1` | Usuário **sem** escopo definido | Vê todos os clientes (escopo vazio = sem restrição) — confirmar com o negócio se essa é a política desejada ⚠️ |
| `JRN-ADM-004-A2` | Escopo com **dois** representantes | Vê clientes de ambos |
| `JRN-ADM-004-A3` | Remover o escopo depois de definido | Volta a ver tudo |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-004-N1` | Enviar ID de representante inexistente pela API | `400 REPRESENTANTES_INVALIDOS` |
| `JRN-ADM-004-N2` | Enviar o mesmo representante duplicado | Validação bloqueia (schema proíbe duplicata) |
| `JRN-ADM-004-N3` | `comercial` com escopo REP-A tenta abrir pela URL o pedido de um cliente de REP-B | Negado ou não encontrado — **teste crítico de vazamento de dados** |

### Permissões
`USUARIOS_GERENCIAR`.

### Critérios de aprovação
Nenhum vazamento entre escopos, inclusive por acesso direto ao ID.

### Evidências recomendadas
Print das duas listas (com e sem escopo) lado a lado.

---

## Jornada: Ajustar a matriz de permissões de um perfil

### ID
`JRN-ADM-005`

### Objetivo
Confirmar que a permissão nomeada é a fronteira efetiva e que sua alteração tem efeito no próximo login.

### Perfil do usuário
`administrador`.

### Pré-condições
Usuário `comercial` existente e logado em outra janela.

### Ponto inicial
`/admin/perfis`

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir **Perfis de Acesso** | **Matriz de permissões** com um switch por permissão e por perfil |
| 2 | Desligar `PEDIDOS_GERENCIAR` do perfil `comercial` | Toast **Perfil atualizado.** |
| 3 | Na janela do usuário `comercial`, tentar criar pedido **sem relogar** | Ainda funciona (permissão resolvida no token) |
| 4 | Deslogar e relogar como `comercial` | Agora a criação é negada com `403` |
| 5 | Religar a permissão e relogar | Volta a funcionar |

### Resultado final esperado
Alteração de permissão vale a partir do próximo login/refresh — comportamento documentado no rodapé da tela:
`Alterar permissões de API vale no próximo login ou renovação de sessão.`

### Efeitos colaterais
`perfis_permissoes` alterado; auditoria registra.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-005-N1` | Enviar código de permissão inexistente pela API | `400` permissões desconhecidas |
| `JRN-ADM-005-N2` | Remover **todas** as permissões do perfil `administrador` | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: não há trava explícita contra deixar a instalação sem administrador efetivo — **risco alto**, registrado como GAP-004 |

### Permissões
`PERFIS_GERENCIAR` (só `administrador`).

### Critérios de aprovação
Efeito correto após relogin; erro claro para código inválido.

---

## Jornada: Ajustar menus visíveis de um perfil

### ID
`JRN-ADM-006`

### Objetivo
Confirmar que a lista de menus é restrita ao catálogo canônico e que a mudança vale na próxima navegação.

### Perfil do usuário
`administrador`.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | `/admin/perfis` → selecionar o perfil `corte` | Card **Menus visíveis — Operador de Corte** |
| 2 | Adicionar o chip `Estoque · Consulta de Estoque` | Toast **Perfil atualizado.** |
| 3 | Na janela do usuário `corte`, navegar para outra tela | O novo item aparece na sidebar |
| 4 | Clicar no novo item | ⚠️ O usuário `corte` **não tem** `ESTOQUE_LER` — deve receber bloqueio no backend, provando que o menu não é autorização |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-006-N1` | Gravar um href fora de `MENUS_CANONICOS` pela API | `400` menus desconhecidos |
| `JRN-ADM-006-N2` | Enviar mais de 39 menus | Validação bloqueia (`max(39)`) — 🔎 o catálogo tem **41** rotas desde AD-11: o limite do schema pode impedir atribuir todos os menus a um perfil. **GAP-001** |

### Critérios de aprovação
Catálogo respeitado; GAP-001 confirmado ou refutado durante a execução.

### Evidências recomendadas
Print do erro ao tentar salvar 41 menus (comprova ou refuta GAP-001).

---

## Jornada: Editar parâmetro do sistema

### ID
`JRN-ADM-007`

### Objetivo
Validar que os parâmetros provisórios são editáveis e que a mudança afeta o comportamento operacional.

### Perfil do usuário
`administrador`.

### Pré-condições
Seed executado (21 parâmetros).

### Ponto inicial
`/admin/parametros`

### Passo a passo

| Passo | Grupo | Ação | Resultado esperado |
|---|---|---|---|
| 1 | — | Abrir **Parâmetros do Sistema** | Três grupos: **Comercial**, **Operação**, **Fiscal** |
| 2 | Comercial | Conferir **Permitir overbooking** = ligado | — |
| 3 | Operação | Alterar o texto de **Cadência de geração de Operações** | Botão **Salvar** → toast **Parâmetro salvo.** |
| 4 | — | Conferir badges **Provisório** | Devem aparecer nos parâmetros com `provisorio: true` (P1, P3, P6, P8, P12, D10.x) |
| 5 | Fiscal | Desligar **Seguro integrado** / conferir `faturamento.seguro_obrigatorio` | Impacta o checklist de liberação (`JRN-LIB-001-A1`) |

### Resultado final esperado
Parâmetro persistido em `parametros.valor_json` e refletido no comportamento correspondente.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ADM-007-A1` | Desligar `comercial.overbooking_permitido` e tentar vender acima do saldo | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: por AD-05 o overbooking é sempre permitido com confirmação. Verificar se o parâmetro ainda tem efeito ou se virou legado — GAP-013 |
| `JRN-ADM-007-A2` | Alterar `estoque.limiar_aprovacao_ajuste` de 5 para 2 | Ajustes com \|Δ\| > 2 passam a exigir aprovação (`JRN-EST-003`) |
| `JRN-ADM-007-A3` | Colocar `faturamento.seguro_obrigatorio = false` | Checklist mostra `dispensado por parâmetro` |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-007-N1` | Editar `estoque.limiar_aprovacao_ajuste` pela tela | 🔎 O parâmetro é do tipo `numero` e **não tem controle na UI** — só editável via API. **GAP-006** |
| `JRN-ADM-007-N2` | Chave inexistente via API | `404 Parâmetro não encontrado` |
| `JRN-ADM-007-N3` | Criar parâmetro com chave duplicada | `409` |

### Permissões
`PARAMETROS_LER` (todos os perfis, via `LEITURA_CADASTROS`) / `PARAMETROS_GERENCIAR` (só `administrador`).

`JRN-ADM-007-P1`: `gestor` pode ler mas não salvar.

### Critérios de aprovação
Parâmetros editáveis pela UI salvam e produzem efeito verificável; GAP-006 confirmado.

### Evidências recomendadas
Print dos três grupos, print de um parâmetro salvo, print do badge Provisório.

---

## Jornada: Consultar e exportar auditoria

### ID
`JRN-ADM-008`

### Objetivo
Provar rastreabilidade: toda mutação crítica das outras jornadas deve estar consultável aqui.

### Perfil do usuário
`administrador`, `gestor`, `diretoria`.

### Pré-condições
Ao menos as jornadas de cadastro e uma jornada operacional executadas (para haver eventos).

### Ponto inicial
`/admin/auditoria`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Abrir **Auditoria Filtrável** | — | Filtros e tabela de eventos |
| 2 | Definir **Período** de hoje | — | — |
| 3 | Selecionar **Módulo** = módulo de pedidos | — | — |
| 4 | Clicar **Aplicar Filtros** | — | Tabela filtrada |
| 5 | Clicar em uma linha | — | Painel **Detalhe da Alteração** com **Dados Anteriores** e **Dados Novos** em JSON |
| 6 | Filtrar por **Registro (ID)** colando o UUID de um pedido | UUID do pedido de `JRN-PVD-001` | Só os eventos daquele pedido |
| 7 | Clicar **Exportar CSV** | — | Download do CSV |
| 8 | Navegar com **Próxima** / **Anterior** | — | Paginação funcional |

### Resultado final esperado
Cada mutação crítica das jornadas anteriores aparece com módulo, operação, autor, antes e depois.

### Validações funcionais — checklist de eventos que **precisam** existir

| Origem | Evento esperado |
|---|---|
| Criação de usuário | `INSERT` |
| Confirmação de compra programada | `UPDATE` / `ACAO_MANUAL` |
| Criação de pedido com reserva | `INSERT` + reserva |
| Confirmação de overbooking | `ACAO_MANUAL` com autor |
| Liberação de reserva (AD-06) | `ACAO_MANUAL` com justificativa |
| Estorno de associação de peça | `ACAO_MANUAL` |
| Troca de Peça | `ACAO_MANUAL` atômico |
| Conclusão de conferência | `ACAO_MANUAL` |
| Aprovação/rejeição de ajuste | `ACAO_MANUAL` |
| Emissão e cancelamento de NFS-e | `ACAO_MANUAL` |
| Liberação de saída do caminhão | `ACAO_MANUAL` |

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-ADM-008-A1` | Filtrar por **Usuário** | Só os eventos daquele autor |
| `JRN-ADM-008-A2` | Paginar até a última página | Sem erro; contagem coerente |
| `JRN-ADM-008-A3` | Exportar com mais de 5000 registros | Toast **Exportação truncada em 5000 registros. Refine o período.** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-ADM-008-N1` | Período invertido (fim antes do início) | Validação ou lista vazia com mensagem clara |
| `JRN-ADM-008-N2` | Filtro que não retorna nada | Estado vazio explícito (não tabela quebrada) |
| `JRN-ADM-008-N3` | Acessar como `comercial` | Redirecionamento — sem `AUDITORIA_VISUALIZAR` |

### Permissões
`AUDITORIA_VISUALIZAR`: `administrador`, `gestor`, `diretoria`.

### Critérios de aprovação
Todos os 11 eventos do checklist encontráveis; export funciona; acesso negado corretamente.

### Evidências recomendadas
Print do detalhe antes/depois de pelo menos 3 eventos críticos (pedido, troca de peça, NFS-e) e o CSV exportado.

---

# M03 — Cadastros estruturantes

## Jornada: Padrão de CRUD de cadastro (ficha mestra)

### ID
`JRN-CAD-000`

### Objetivo
Descrever uma única vez o comportamento comum a todos os cadastros, para que as fichas por entidade
tratem apenas do que é específico. **Execute esta ficha uma vez** usando `/cadastros/itens-compra`,
e depois use as fichas por entidade.

### Perfil do usuário
`administrador` (todos os `_GERENCIAR`).

### Pré-condições
Logado como administrador.

### Ponto inicial
Menu → **CADASTROS & REGRAS** → qualquer entidade.

### Passo a passo (padrão)

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a lista | Tabela paginada (20 por página), busca e filtro de status |
| 2 | Clicar em **Novo …** (ou **Novo**) | Formulário/drawer de criação abre limpo |
| 3 | Preencher os campos obrigatórios | Campos com máscara aplicam formatação (CPF/CNPJ, telefone, CEP, placa) |
| 4 | Clicar em **Salvar** / **Criar** | Registro criado; volta à lista com o novo item visível |
| 5 | Abrir o registro criado | Dados exibidos corretamente |
| 6 | Alterar um campo e salvar | Alteração persistida |
| 7 | Alternar o status para **Inativo** | Badge muda; registro continua na lista com filtro **Todos** |
| 8 | Excluir (quando houver o botão) | Soft delete: `deleted_at` preenchido; some da listagem padrão |

### Resultado final esperado
Ciclo criar → consultar → editar → inativar → excluir logicamente completo, com auditoria.

### Efeitos colaterais
Eventos `INSERT`/`UPDATE`/`DELETE` em `auditoria`; nenhum DELETE físico.

### Validações funcionais comuns
- Código e documento fiscal são **únicos** — a duplicidade retorna `409`.
- Busca (`search`) atinge os campos principais (código, nome/razão, documento).
- Paginação: `page` e `pageSize` (máx. 100).
- Query `incluirRemovidos` traz os soft-deleted (só via API).

### Validações visuais / UX comuns
- Labels em português, sem a palavra **"Marca"** isolada (Princípio IX) — a única exceção autorizada é o
  rótulo **Nome Fantasia/Marca** no cadastro de clientes (AD-13b).
- Máscaras: CPF/CNPJ, telefone, CEP, placa.
- Erro de validação destaca campo **e** a aba que o contém (AD-12).
- Estado vazio com texto explícito; loading visível; botão **Salvar** desabilitado durante o envio.
- Paginação **Anterior** / **Próxima** desabilitadas nos extremos.

### Cenários alternativos (aplicáveis a todos os cadastros)

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-000-A1` | Buscar por termo parcial | Filtra corretamente; sem resultado mostra estado vazio |
| `JRN-CAD-000-A2` | Paginar com mais de 20 registros | Navegação correta |
| `JRN-CAD-000-A3` | Filtrar por status Ativo / Inativo / Todos | Contagem coerente |
| `JRN-CAD-000-A4` | Excluir (soft delete) | Some da lista; permanece no banco |
| `JRN-CAD-000-A5` | Restaurar via `POST /:recurso/:id/restaurar` | Volta à lista — 🔎 **sem botão na UI** (GAP-002) |

### Cenários negativos (aplicáveis a todos)

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-000-N1` | Campo obrigatório vazio | Validação em português destacando o campo |
| `JRN-CAD-000-N2` | Código duplicado | `409 Já existe … com este código` |
| `JRN-CAD-000-N3` | Documento fiscal duplicado | `409` |
| `JRN-CAD-000-N4` | Documento fiscal inválido (CNPJ com dígito errado) | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: verificar se há validação de dígito verificador ou apenas de formato — GAP-007 |
| `JRN-CAD-000-N5` | Texto acima do limite do campo | Bloqueio por `maxLength` ou erro do backend, nunca truncamento silencioso |
| `JRN-CAD-000-N6` | Caracteres especiais / emoji no nome | Aceito e exibido corretamente, ou recusado com mensagem |
| `JRN-CAD-000-N7` | Duplo clique em **Salvar** | Um único registro |
| `JRN-CAD-000-N8` | F5 no meio do preenchimento | Perde o rascunho sem erro (comportamento esperado) e sem registro parcial |
| `JRN-CAD-000-N9` | Voltar no navegador durante a edição | Sem estado corrompido |
| `JRN-CAD-000-N10` | Backend fora do ar (parar o container) | Mensagem **Erro de conexão**, sem tela branca |

### Permissões
`<ENTIDADE>_LER` para ver; `<ENTIDADE>_GERENCIAR` para mutar.
`JRN-CAD-000-P1`: perfil só com `_LER` vê a lista mas não vê/consegue usar os botões de mutação.

### Critérios de aprovação
Ciclo completo e os 10 negativos com comportamento previsível.

### Evidências recomendadas
Print da lista, do formulário, de dois erros de validação e da mensagem de duplicidade.

---

## Jornada: Cadastrar representante

### ID
`JRN-CAD-001`

### Objetivo
Criar os vendedores/representantes que serão vinculados a clientes, pedidos e ao escopo dos usuários.

### Perfil do usuário
`administrador`, `gestor`.

### Pré-condições
Nenhuma.

### Dados necessários
REP-A (`REP-001` / `Vendedor Homologação A` / canal `Interno`) e REP-B (`REP-002` / `Vendedor Homologação B` / `Externo`).

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Representantes**

### Passo a passo

| Passo | Tela | Ação | Dados | Resultado esperado |
|---|---|---|---|---|
| 1 | Representantes | Clicar **Novo Representante** | — | Drawer abre |
| 2 | Drawer | **Código** | `REP-001` | Obrigatório |
| 3 | Drawer | **Nome** | `Vendedor Homologação A` | Obrigatório |
| 4 | Drawer | **Tipo / canal** | `Interno` | Opcional; alimenta o filtro `GET /representantes/canais` |
| 5 | Drawer | **Contato** | `(11) 99999-0001` | Máscara de telefone aplicada |
| 6 | Drawer | **Observação** | `Representante de homologação` | Opcional |
| 7 | Drawer | Manter **Status** = Ativo | — | — |
| 8 | Drawer | **Salvar** | — | Registro na lista |
| 9 | — | Repetir para REP-B | — | 2 representantes ativos |
| 10 | Lista | Abrir REP-A | — | Blocos **Clientes vinculados** e **Usuários vinculados** (vazios agora) |

### Resultado final esperado
REP-A e REP-B ativos, prontos para uso em clientes, rotas, pedidos e escopo de usuário.

### Efeitos colaterais
Aparecem nos selects de Cliente, Rota (representante padrão), Espelho e escopo do usuário.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-001-A1` | Inativar REP-B | Deixa de aparecer nos selects de novos vínculos |
| `JRN-CAD-001-A2` | Após `JRN-CAD-006`, reabrir REP-A | Bloco **Clientes vinculados** lista CLI-A |
| `JRN-CAD-001-A3` | Após `JRN-ADM-004`, reabrir REP-A | Bloco **Usuários vinculados** lista o usuário `comercial` |

### Cenários negativos
Todos os de `JRN-CAD-000-N*`, com foco em: código duplicado (`REP-001` novamente) → `409`.

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-001-N1` | Inativar REP-A que já tem clientes vinculados | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: o sistema permite? Os clientes ficam órfãos ou herdam o representante inativo? — GAP-008 |

### Permissões
`REPRESENTANTES_LER` (todos) / `REPRESENTANTES_GERENCIAR` (`administrador`, `gestor`).

### Critérios de aprovação
Dois representantes criados e visíveis nos selects dependentes.

### Evidências recomendadas
Print da lista e do drawer com os blocos de vínculo.

---

## Jornada: Cadastrar produto

### ID
`JRN-CAD-002`

### Objetivo
Cadastrar produto com os atributos operacionais que governam balança, desossa, estoque e faturamento.

### Perfil do usuário
`administrador`, `gestor`.

### Pré-condições
Nenhuma (o seed já traz 11 produtos MVP provisórios — P11).

### Dados necessários

| Aba | Campo | Valor |
|---|---|---|
| Gerais | **Código interno** | `PROD-HOM-01` |
| Gerais | **Nome do produto** | `Produto Homologação Peça` |
| Gerais | **Nome operacional / etiqueta** | `PROD HOM` |
| Gerais | **Categoria** | `Bovino` |
| Gerais | **Status** | Ativo |
| Comercial | **Unidade de preço** | `kg` |
| Comercial | **Ativo para venda / tabela de preços** | ligado |
| Operacional | **Tipo operacional** | `peca_inteira_pesavel` |
| Operacional | **Unidade do pedido** | `peca` |
| Operacional | **Exige peso final para faturamento** | ligado |
| Operacional | **Passa pela balança principal** | ligado |
| Operacional | **Passa pela desossa** | desligado |
| Estoque | **Permite estoque** | ligado |
| Fiscal | **NCM** / **CFOP** / **Origem fiscal** | valores válidos |

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Produtos**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Clicar **Novo Produto** | Drawer com 5 abas: **Gerais**, **Comercial**, **Operacional**, **Estoque**, **Fiscal** |
| 2 | Preencher a aba **Gerais** | — |
| 3 | Ir para **Comercial** | Campo **Preço por kg (R$)** aparece **desabilitado** com a nota de lacuna — comportamento esperado hoje (GAP-009) |
| 4 | Preencher **Operacional** | Flags determinam se o produto entra na balança, na desossa e na etiqueta |
| 5 | Preencher **Estoque** e **Fiscal** | — |
| 6 | Clicar **Salvar** | Produto na lista |
| 7 | Conferir que o produto aparece na Tabela de Preços | `JRN-PRC-003` deve listá-lo |

### Resultado final esperado
Produto ativo, disponível na tabela de preços, na entrada de itens (se `entrada_unidade`) e nos fluxos
compatíveis com seus flags.

### Efeitos colaterais
Passa a aparecer em: tabela de preços, filtros de estoque, filtros da desossa, entrada de itens.

### Validações funcionais
- `tipo_operacional` aceita apenas: `peca_inteira_pesavel`, `derivado_desossa`, `entrada_unidade`, `compra_base`.
- `unidade_preco` aceita apenas `kg` ou `unidade`.
- Produto com `entrada_unidade` é o que a **Entrada de Itens** aceita (`JRN-EST-003-N1` prova o contrário).

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-002-A1` | Editar produto existente | Alteração persistida |
| `JRN-CAD-002-A2` | Inativar produto | Não aparece em novos pedidos/entradas |
| `JRN-CAD-002-A3` | Criar produto `entrada_unidade` (caixaria) | Fica disponível em `/estoque/entrada-itens` |
| `JRN-CAD-002-A4` | Criar produto `derivado_desossa` | Fica disponível como saída de regra de transformação |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-002-N1` | Código duplicado (usar `TZ`) | `409 Já existe produto com este código` |
| `JRN-CAD-002-N2` | Tentar preencher **Preço por kg (R$)** | Campo desabilitado — GAP-009 |
| `JRN-CAD-002-N3` | Tipo operacional inválido via API | `400` |
| `JRN-CAD-002-N4` | Usar produto inativo em um pedido | Deve ser recusado ou não aparecer no select — ⚠️ confirmar o comportamento exato |

### Permissões
`PRODUTOS_LER` (todos) / `PRODUTOS_GERENCIAR` (`administrador`, `gestor`).

### Critérios de aprovação
Produto criado com todos os flags e utilizável nos fluxos correspondentes.

### Evidências recomendadas
Print das 5 abas preenchidas e print do campo de preço desabilitado (evidência de GAP-009).

---

## Jornada: Cadastrar item de compra

### ID
`JRN-CAD-003`

### Objetivo
Criar o item que será comprado do frigorífico (unidade de compra, ex.: `cabeca`) e que se desdobra em itens
comerciais.

### Perfil do usuário
`administrador` (única permissão `ITENS_COMPRA_GERENCIAR`).

### Pré-condições
Nenhuma.

### Dados necessários
**Código** `BOI-CASADO`, **Descrição** `Boi casado`, **Categoria** `Bovino`, **Unidade de Compra** `cabeca`, **Status** Ativo.

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Itens de Compra** (`/cadastros/itens-compra`)

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a lista | Tabela do CRUD genérico com busca `Buscar...` |
| 2 | Clicar **Novo** | Formulário em `/cadastros/itens-compra/novo` |
| 3 | Preencher **Código**, **Descrição**, **Categoria**, **Unidade de Compra** | — |
| 4 | Clicar **Criar** | Volta à lista com o item |
| 5 | Clicar **Editar** no item | Formulário em `/cadastros/itens-compra/<id>/editar` |

### Resultado final esperado
Item de compra disponível na tela de Compra Programada e nas regras de desdobramento.

### Efeitos colaterais
Aparece no select de item da **Compra Programada** e no simulador de desdobramento.

### Cenários alternativos + negativos
Herdados de `JRN-CAD-000`. Específico:

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-003-N1` | Usar item de compra **sem regra de desdobramento** numa compra confirmada | A coluna **Regra de Desdobramento** fica `—` e **nenhuma disponibilidade é gerada** — ponto crítico, ver `JRN-CMP-002-N2` |

### Permissões
`ITENS_COMPRA_LER` (todos) / `ITENS_COMPRA_GERENCIAR` (**apenas `administrador`** — AD-11).

`JRN-CAD-003-P1`: `gestor` e `compras` não veem esse item no menu nem conseguem criar.

### Critérios de aprovação
Item criado e utilizável na compra.

---

## Jornada: Cadastrar item comercial

### ID
`JRN-CAD-004`

### Objetivo
Criar a unidade que é efetivamente vendida (o que o cliente pede) e que recebe a disponibilidade virtual.

### Perfil do usuário
`administrador`.

### Dados necessários
**Código** `DIANT-HOM`, **Descrição** `Dianteiro Homologação`, **Categoria** `Bovino`,
**Unidade Comercial** `parte`, **Permite Corte** marcado, **Status** Ativo.

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Itens Comerciais**

### Passo a passo
Idêntico a `JRN-CAD-003`, com o checkbox adicional **Permite Corte**.

### Resultado final esperado
Item comercial disponível para: regra de desdobramento (destino), pedido de venda (produto), disponibilidade.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-004-N1` | Vender item comercial sem disponibilidade gerada | Cai no fluxo de overbooking (`JRN-PVD-003`), não em erro |
| `JRN-CAD-004-N2` | Código duplicado | `409` |

### Permissões
`ITENS_COMERCIAIS_LER` (todos) / `ITENS_COMERCIAIS_GERENCIAR` (**apenas `administrador`**).

---

## Jornada: Cadastrar fornecedor (ciclo completo)

### ID
`JRN-CAD-005`

### Objetivo
Cadastrar o frigorífico com os parâmetros operacionais que influenciam o recebimento.

### Perfil do usuário
`administrador`, `gestor`, `compras`.

### Dados necessários

| Seção | Campo | Valor |
|---|---|---|
| Dados Principais | **Código** | `FOR-001` |
| Dados Principais | **Razão Social** | `Frigorífico Homologação A LTDA` |
| Dados Principais | **CNPJ/CPF** | CNPJ válido |
| Dados Principais | **Status** | Ativo |
| Dados Principais | **Observações** | `Fornecedor de homologação` |
| Endereço e Contato | **Nome do contato** / **Telefone** / **E-mail** / **Cargo** | valores livres |
| Parâmetros Operacionais | **Romaneio antecipado** | ligado |
| Parâmetros Operacionais | **Horário Limite Recebimento (HH:MM)** | `16:00` |
| Parâmetros Operacionais | **Capacidade Max. Caminhão (kg)** | `12000` |
| Parâmetros Operacionais | **Tolerância de Divergência (%)** | `2` |
| Parâmetros Operacionais | **Nota de Qualidade (A/B/C)** | `A` |

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Fornecedores / Frigoríficos**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Master-detail com chips de filtro e contagens por status |
| 2 | Criar FORN-A com os dados acima | Aparece na lista |
| 3 | Criar FORN-B | 2 fornecedores ativos |
| 4 | Selecionar FORN-A | Painel de detalhe com as 3 seções |
| 5 | Abrir o **histórico** do fornecedor | Timeline (vazia agora; populada após `JRN-REC-*`) |
| 6 | Conferir as **contagens** por status | Refletem a lista |

### Resultado final esperado
FORN-A e FORN-B disponíveis na Compra Programada e no Recebimento.

### Efeitos colaterais
Aparecem no combobox **Fornecedor** da Compra Programada e nas ocorrências de fornecedor.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-005-A1` | Filtrar por chip de status | Lista e contagem coerentes |
| `JRN-CAD-005-A2` | Após `JRN-REC-007`, reabrir o histórico | Ocorrências e divergências aparecem |
| `JRN-CAD-005-A3` | Inativar FORN-B | Some do combobox de nova compra |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-005-N1` | Código ou CNPJ duplicado | `409` |
| `JRN-CAD-005-N2` | **Tolerância de Divergência (%)** negativa ou > 100 | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: verificar se há faixa validada — GAP-014 |
| `JRN-CAD-005-N3` | **Horário Limite Recebimento** em formato inválido (`25:99`) | Validação bloqueia |
| `JRN-CAD-005-N4` | Inativar fornecedor com compra programada em aberto | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: comportamento não definido — GAP-008 |
| `JRN-CAD-005-N5` | Usar fornecedor inativo em nova compra | Não deve aparecer no combobox |

### Permissões
`FORNECEDORES_LER` (todos) / `FORNECEDORES_GERENCIAR` (`administrador`, `gestor`, `compras`).

### Critérios de aprovação
Dois fornecedores utilizáveis; parâmetros operacionais persistidos.

### Evidências recomendadas
Print do master-detail com as 3 seções e print do histórico.

---

## Jornada: Cadastrar cliente (ciclo completo)

### ID
`JRN-CAD-006`

### Objetivo
Cadastrar o cliente com dados fiscais completos (pré-requisito de faturamento), representante, rota e
preferências operacionais.

### Perfil do usuário
`administrador`, `gestor`, `comercial` (leitura), `faturamento` (leitura).

### Pré-condições
REP-A e ROTA-A cadastrados.

### Dados necessários

| Aba | Campo | Valor CLI-A |
|---|---|---|
| Gerais | **Razão Social** (obrigatório) | `Açougue Homologação A LTDA` |
| Gerais | **Nome Fantasia/Marca** | `Açougue A` |
| Gerais | **CNPJ/CPF** (obrigatório) | CNPJ válido |
| Gerais | **Representante** | REP-A |
| Gerais | **Itinerário / Rota** | ROTA-A |
| Gerais | **Prioridade Padrão** | Média |
| Fiscais | **Logradouro / Número / Bairro / Cidade / UF / CEP** | endereço completo em Osasco/SP |
| Fiscais | **Inscrição estadual** | valor válido |
| Contatos | **Nome / Telefone / E-mail / Cargo / Tipo** | contato comercial |
| Preferências | **Faixa de Peso Mínima/Máxima (kg)** | `18` / `25` |
| Preferências | **Perfil de Gordura Aceito** | valor da lista |
| Preferências | **Necessita Corte de Acerto?** | desligado |

### Ponto inicial
Menu → **COMERCIAL** → **Clientes** (`/comercial/clientes`)

### Passo a passo

| Passo | Tela | Ação | Resultado esperado |
|---|---|---|---|
| 1 | Cadastro de Clientes | Clicar **Novo Cliente** | Painel com 4 abas: Gerais, Fiscais, Contatos, Preferências |
| 2 | Aba Gerais | Preencher razão, nome fantasia e CNPJ | Máscara de CNPJ aplicada |
| 3 | Aba Gerais | Selecionar **Representante** = REP-A e **Itinerário / Rota** = ROTA-A | — |
| 4 | Aba Fiscais | Preencher o endereço completo e a inscrição estadual | Máscara de CEP |
| 5 | Aba Contatos | Adicionar um contato | Máscara de telefone |
| 6 | Aba Preferências | Preencher faixa de peso e perfil de gordura | Preferências são **observações**, não bloqueiam associação (v1.1 §6.5) |
| 7 | — | Clicar **Salvar Cliente** | Cliente na lista |
| 8 | Lista | Buscar por `Açougue` no campo `Buscar cliente...` | Encontra CLI-A |
| 9 | — | Repetir para CLI-B (com REP-B, sem rota) | 2 clientes ativos |

### Resultado final esperado
CLI-A e CLI-B ativos, com dados fiscais completos — condição para não cair no bloqueio
`DADOS_FISCAIS_INCOMPLETOS` no faturamento.

### Efeitos colaterais
- `clientes.codigo` é **gerado automaticamente** pelo backend em sequência (AD-13a) e **não aparece no
  formulário**; é imutável após a criação.
- Cliente passa a aparecer no combobox **Buscar cliente** do pedido, no espelho e na consulta de estoque.

### Validações funcionais
- Documento fiscal único.
- O rótulo **Nome Fantasia/Marca** é a única ocorrência autorizada da palavra "Marca" (AD-13b).
- Cliente sem CNPJ/CPF válido gera bloqueio `DADOS_FISCAIS_INCOMPLETOS` na consolidação — testado em
  `JRN-FAT-001-N1`.

### Validações visuais / UX
- Abas com indicador de erro quando a validação falha em uma aba não visível (AD-12).
- Filtro **Ativo / Inativo / Todos** funcional.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-006-A1` | Cliente **pessoa física** (CPF) | Máscara alterna para CPF; cadastro aceito |
| `JRN-CAD-006-A2` | Cliente **sem** representante | Aceito; pedido herda representante vazio |
| `JRN-CAD-006-A3` | Criar cliente pela rota genérica `/cadastros/clientes/novo` | Mesmo resultado, formulário genérico — cobre a tela órfã |
| `JRN-CAD-006-A4` | Inativar CLI-B | Não aparece em novo pedido |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-006-N1` | CNPJ duplicado | `409` |
| `JRN-CAD-006-N2` | Razão Social vazia | Validação bloqueia, aba **Gerais** destacada |
| `JRN-CAD-006-N3` | CNPJ inválido (dígito verificador errado) | ⚠️ GAP-007 — confirmar se há validação de DV |
| `JRN-CAD-006-N4` | Faixa de peso mínima **maior** que a máxima | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: não há validação cruzada aparente — GAP-015 |
| `JRN-CAD-006-N5` | Faixa de peso negativa | Validação esperada |
| `JRN-CAD-006-N6` | Inativar cliente com pedido em aberto | ⚠️ GAP-008 |
| `JRN-CAD-006-N7` | CEP com letras | Máscara impede |

### Permissões

| Perfil | Ler | Gerenciar |
|---|---|---|
| administrador, gestor | Sim | Sim |
| comercial, faturamento, demais | Sim | Não |

`JRN-CAD-006-P1`: `comercial` vê a tela mas **não** vê o botão **Novo Cliente** habilitado.
`JRN-CAD-006-P2`: `comercial` com escopo REP-A não enxerga CLI-B (ver `JRN-ADM-004`).

### Critérios de aprovação
Clientes criados, escopo respeitado e dados fiscais suficientes para faturar.

### Evidências recomendadas
Print das 4 abas, print do código gerado no detalhe e print da validação de aba com erro.

---

## Jornada: Cadastrar rota / itinerário com paradas

### ID
`JRN-CAD-007`

### Objetivo
Criar a rota usada por clientes, planejamento de carga e espelho comercial.

### Perfil do usuário
`administrador`, `gestor`.

### Pré-condições
REP-A, CAM-A e MOT-A cadastrados (para os padrões da rota).

### Dados necessários
**Nome da Rota** `Rota Zona Oeste`, **Código Rápido** `RT-01`, **Região** `Oeste`,
**Representante padrão** REP-A, **Caminhão padrão** CAM-A, **Motorista padrão** MOT-A,
2 paradas (`Osasco Centro`, `Osasco Km 18`).

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Rotas / Itinerários**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Clicar **Nova Rota** | Painel de edição |
| 2 | Preencher nome, código, região e os três padrões | Selects populados com os cadastros existentes |
| 3 | Adicionar a parada `Osasco Centro` | Linha na tabela de paradas |
| 4 | Adicionar `Osasco Km 18` | 2 paradas |
| 5 | Clicar **Subir** na segunda parada | Ordem invertida |
| 6 | Clicar **Salvar Rota** | Rota persistida com a ordem correta |
| 7 | Verificar em `JRN-CAD-006` | ROTA-A aparece no select **Itinerário / Rota** do cliente |

### Resultado final esperado
Rota com paradas ordenadas, utilizável no cliente, no espelho e no planejamento de carga.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-007-A1` | Reordenar com **Subir**/**Descer** | Ordem persistida após salvar |
| `JRN-CAD-007-A2` | Clicar **Excluir Rota** | Soft delete; rota some da lista |
| `JRN-CAD-007-A3` | **Remover** uma parada | Lista reordenada corretamente |
| `JRN-CAD-007-A4` | Definir dias de atendimento | Persistido |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-007-N1` | Código duplicado | `409 Já existe rota com este código` |
| `JRN-CAD-007-N2` | Rota sem nenhuma parada | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: é permitido? |
| `JRN-CAD-007-N3` | Excluir rota já vinculada a clientes | ⚠️ GAP-008 — comportamento com dependência |

### Permissões
Backend: `ROTAS_LER` / `ROTAS_GERENCIAR`.
🔎 A UI usa `EXPEDICAO_GERENCIAR`/`CLIENTES_LER` para decidir o que exibir, o que não coincide com a permissão
do endpoint — **GAP-021**. Teste com `expedicao` e com `gestor` e compare.

### Critérios de aprovação
Rota criada e ordenação persistida; GAP-021 confirmado ou refutado.

---

## Jornada: Cadastrar caminhão da frota

### ID
`JRN-CAD-008`

### Objetivo
Cadastrar o veículo que será selecionado no planejamento de carga.

### Perfil do usuário
`administrador`, `gestor`, `expedicao`.

### Dados necessários
**Placa** `HOM1A23` (máscara de placa), capacidade `8000` kg, certificado/validade, **Status** Ativo.

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Caminhões**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Clicar **Novo Caminhão** | Drawer |
| 2 | Preencher **Placa** | Máscara aplicada (Mercosul e/ou antiga) |
| 3 | Preencher capacidade e demais campos | — |
| 4 | **Salvar** | Caminhão na lista |
| 5 | Conferir em `/carga/planejamento` | Aparece no select **Caminhão da frota** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-008-N1` | Placa duplicada | `409` (unique em `frota_caminhoes.placa`) |
| `JRN-CAD-008-N2` | Placa em formato inválido | Máscara/validação bloqueia |
| `JRN-CAD-008-N3` | Capacidade negativa ou zero | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO |
| `JRN-CAD-008-N4` | Certificado com validade no passado | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: deve alertar/bloquear na liberação? — GAP-016 |

### Permissões
`FROTA_CAMINHOES_LER` / `_GERENCIAR` (`administrador`, `gestor`, `expedicao`).

### Critérios de aprovação
Caminhão criado e selecionável no planejamento.

---

## Jornada: Cadastrar motorista

### ID
`JRN-CAD-009`

### Objetivo
Cadastrar o motorista usado no planejamento e no checklist de liberação.

### Perfil do usuário
`administrador`, `gestor`, `expedicao`.

### Dados necessários
Nome `Motorista Homologação A`, documento (CPF **ou CNH** — sem máscara de CPF por decisão D7 do AD-12),
tipo de vínculo (`motorista` / `agregado` / `chapa`), caminhão padrão CAM-A.

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Motoristas**

### Passo a passo
Padrão de `JRN-CAD-000` no drawer.

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-009-N1` | Documento duplicado em motorista ativo | `409 Já existe motorista ativo com este documento` |
| `JRN-CAD-009-N2` | Documento vazio | Validação bloqueia |
| `JRN-CAD-009-N3` | Tipo de vínculo inválido via API | `400` |

### Permissões
`FROTA_MOTORISTAS_LER` / `_GERENCIAR`.

### Critérios de aprovação
Motorista criado e selecionável.

---

## Jornada: Criar regra de desdobramento comercial

### ID
`JRN-CAD-010`

### Objetivo
Definir quantos itens comerciais cada item de compra gera — **é essa regra que faz a compra confirmada virar
disponibilidade virtual**. Sem ela, a compra não gera saldo.

### Perfil do usuário
`administrador`, `gestor`.

### Pré-condições
ICOMP-BOI (item de compra) e os itens comerciais TZ, DT, PA existentes.

### Dados necessários (AD-01: 1 boi = 2 TZ + 2 DT + 2 PA)

| Item de compra | Item comercial | Fator | Vigência início |
|---|---|---|---|
| `BOI-CASADO` | `TZ` | `2` | ontem |
| `BOI-CASADO` | `DT` | `2` | ontem |
| `BOI-CASADO` | `PA` | `2` | ontem |

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Regras de Transformação** (aba/simulador de desdobramento) ou via
`POST /regras-desdobramento`.

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Tabela de regras + simuladores; badge **Provisório P12** |
| 2 | Criar a regra `BOI-CASADO → TZ` fator 2, vigência a partir de ontem | Regra ativa |
| 3 | Repetir para DT e PA | 3 regras ativas |
| 4 | Usar o **simulador de desdobramento**: item `BOI-CASADO`, quantidade `10` | Deve projetar **20 TZ + 20 DT + 20 PA** |
| 5 | Conferir em `/gestao/compras` | A coluna **Regra de Desdobramento** deixa de mostrar `—` |

### Resultado final esperado
Compra de N bois passa a gerar 2N de cada item comercial ao ser confirmada.

### Efeitos colaterais
Muda diretamente o resultado de `JRN-CMP-002` (geração de disponibilidade).

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-CAD-010-A1` | Simular com quantidade `1` | 2 de cada |
| `JRN-CAD-010-A2` | Criar regra com vigência futura | Não aplica em compras de hoje |
| `JRN-CAD-010-A3` | Inativar uma regra | Deixa de gerar aquele item comercial |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-010-N1` | Item de compra inexistente ou inativo | `400` |
| `JRN-CAD-010-N2` | Duas regras com vigências sobrepostas para o mesmo par | `409` conflito de vigência |
| `JRN-CAD-010-N3` | Fator `0` ou negativo | Validação bloqueia |
| `JRN-CAD-010-N4` | Quantidade acima de 100000 no simulador | `400` (limite do schema) |

### Permissões
`REGRAS_DESDOBRAMENTO_LER` (todos) / `_GERENCIAR` (`administrador`, `gestor`).

### Critérios de aprovação
Simulador coerente com AD-01 e a compra gerando disponibilidade correta.

### Evidências recomendadas
Print do simulador com o resultado 20/20/20 e print da coluna de regra preenchida na compra.

---

## Jornada: Consultar/gerenciar regras de transformação da desossa

### ID
`JRN-CAD-011`

### Objetivo
Validar as regras exclusivas TZ_A e TZ_B (v1.1 §6.6): escolher uma **invalida** a outra para aquela unidade de TZ.

### Perfil do usuário
`administrador`, `gestor` (gerenciar); `corte`, `comercial`, `diretoria` (ler).

### Pré-condições
Seed executado (`TZ_A` = CB + JAC; `TZ_B` = CBA + FC, ambas `provisorio: true`).

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Regras de Transformação**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Badge **Provisório P12** visível |
| 2 | Conferir as duas regras seedadas | `TZ_A` com saídas CB e JAC; `TZ_B` com CBA e FC |
| 3 | Usar o **simulador de desossa** com `tzLivre` = 10 | Projeção por regra |
| 4 | Criar uma terceira regra | Aceita (estrutura é genérica) |
| 5 | Inativar a regra criada | Some das opções da desossa |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-011-N1` | Origem diferente de TZ | `409 REGRA_ORIGEM_NAO_SUPORTADA_MVP` |
| `JRN-CAD-011-N2` | Trocar a regra depois da primeira saída registrada | `409 REGRA_BLOQUEADA_APOS_SAIDA` (ver `JRN-DES-002-N1`) |

### Permissões
`DESOSSA_LER` / `DESOSSA_GERENCIAR`.

### ⚠️ Pendência aberta
**P12** — outras transformações além do TZ não estão definidas pelo negócio. O badge **Provisório** só pode
sair com uma AD-xx nova.

### Critérios de aprovação
Regras visíveis, simulador coerente, exclusividade respeitada na desossa.

---

## Jornada: Configurar modelo de etiqueta

### ID
`JRN-CAD-012`

### Objetivo
Selecionar os campos que a etiqueta imprime.

### Perfil do usuário
`administrador`, `gestor`.

### Pré-condições
Seed com 6 modelos (`peca-pedido`, `peca-estoque`, …).

### Ponto inicial
Menu → **CADASTROS & REGRAS** → **Modelos de Etiqueta**

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a tela | Badge **Provisório P9**; cards por modelo com 12 checkboxes: **Código**, **Produto**, **Peso**, **Cliente/Pedido**, **Destino**, **Origem/Frigorífico**, **NF/Lote**, **Data/hora**, **Operador**, **Características**, **QR Code**, **Código de barras** |
| 2 | Alterar os campos do modelo `peca-pedido` | — |
| 3 | Clicar **Salvar Modelo** | Persistido |
| 4 | Emitir uma etiqueta em `JRN-PES-001` | O preview deve refletir os campos escolhidos |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-CAD-012-N1` | Desmarcar todos os campos | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: etiqueta em branco deveria ser bloqueada? — GAP-017 |
| `JRN-CAD-012-N2` | Slug duplicado via API | `409` |

### Permissões
`MODELOS_ETIQUETA_LER` (`administrador`, `gestor`, `recebimento_pesagem`, `corte`) /
`MODELOS_ETIQUETA_GERENCIAR` (`administrador`, `gestor`).

### ⚠️ Pendência aberta
**P9** — campos finais da etiqueta pendentes de definição do cliente.

### Critérios de aprovação
Configuração salva e refletida no preview da etiqueta.

---

# M04 — Operações

## Jornada: Gerar cadência de operações

### ID
`JRN-OPE-001`

### Objetivo
Criar em lote os dias operacionais segundo a cadência parametrizada (default: segunda, quarta e sexta — P1).

### Perfil do usuário
`administrador`, `gestor`, `compras`.

### Pré-condições
Logado com `OPERACOES_GERENCIAR`.

### Dados necessários
Intervalo de datas (ex.: hoje até hoje + 30 dias).

### Ponto inicial
Menu → **GESTÃO** → **Operações**

### Passo a passo

| Passo | Tela | Ação | Resultado esperado |
|---|---|---|---|
| 1 | Operações | Abrir a tela | Título **Operações**, subtítulo explicando o vínculo com Compra e Pedido; badge **Provisório P1** |
| 2 | Operações | Clicar **Gerar cadência** | Diálogo nativo `Gerar cadência de operações de DD/MM/AAAA a DD/MM/AAAA?` |
| 3 | Diálogo | Confirmar | Lista recarrega com as operações criadas nos dias da cadência |
| 4 | Lista | Conferir os dias | Apenas segundas, quartas e sextas (parâmetro `operacao.cadencia_dias_semana = [1,3,5]`) |
| 5 | Lista | Conferir os badges | **Cadência automática** e **Aberta**; selo **Sem compra programada** com link **Registrar compra** |

### Resultado final esperado
N operações com status `aberta`, marcadas como não extraordinárias.

### Efeitos colaterais
- Passam a aparecer no **SeletorOperacao** do Painel, Overbooking, Aprovações e Relatórios SIF.
- Habilitam a criação de Compra Programada e Pedido de Venda para aquelas datas.

### Validações funcionais
- Uma única operação ativa por data (índice único parcial `uq_operacoes_data`).
- Reexecutar a cadência no mesmo intervalo não duplica.

### Validações visuais / UX
- Badge **Provisório** com referência à pendência P1.
- Aviso: **Ativar a operação não basta para vender** e o selo **Sem compra programada**.
- Ações **Iniciar operação** / **Encerrar** só aparecem no hover da linha.

### Cenários alternativos

| ID | Cenário | Resultado esperado |
|---|---|---|
| `JRN-OPE-001-A1` | Alterar `operacao.cadencia_dias_semana` em `/admin/parametros` e gerar de novo | Novos dias respeitam o parâmetro |
| `JRN-OPE-001-A2` | Gerar cadência sobre um intervalo que já tem operações | Idempotente, sem duplicar |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OPE-001-N1` | Intervalo com fim antes do início | **Erro ao gerar cadência** com mensagem legível |
| `JRN-OPE-001-N2` | Executar como `comercial` | `403` — sem `OPERACOES_GERENCIAR` |
| `JRN-OPE-001-N3` | Duplo clique em **Gerar cadência** | Sem duplicação |

### Permissões
`OPERACOES_GERENCIAR`: `administrador`, `gestor`, `compras`.
**Leitura de `/operacoes` exige apenas JWT** (sem permissão nomeada) — 🔎 **GAP-018**: qualquer usuário
autenticado lista as operações, inclusive perfis que não têm o menu.

### Critérios de aprovação
Operações criadas nos dias corretos, sem duplicidade, com o badge de pendência visível.

### Evidências recomendadas
Print da lista gerada e print do parâmetro de cadência.

---

## Jornada: Criar operação extraordinária

### ID
`JRN-OPE-002`

### Objetivo
Criar um dia operacional fora da cadência.

### Perfil do usuário
`administrador`, `gestor`, `compras`.

### Dados necessários
**Data da operação** = data de teste livre; **Rótulo** = `Operação extraordinária — homologação`.

### Ponto inicial
`/gestao/operacoes`

### Passo a passo

| Passo | Ação | Dados | Resultado esperado |
|---|---|---|---|
| 1 | Clicar **Nova Operação Extraordinária** | — | Modal abre |
| 2 | Preencher **Data da operação** (`#data-extra`) | data livre | Datepicker |
| 3 | Preencher **Rótulo** (`#rotulo-extra`) | texto | Obrigatório |
| 4 | Clicar **Criar Operação** | — | Modal fecha; linha na tabela com badge **Extraordinária** e status **Aberta** |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OPE-002-N1` | Data em branco ou inválida | **Informe uma data válida (YYYY-MM-DD).** |
| `JRN-OPE-002-N2` | Rótulo vazio | **Informe o rótulo da operação.** |
| `JRN-OPE-002-N3` | Data que já tem operação ativa | `409` — uma operação ativa por data |
| `JRN-OPE-002-N4` | Data no passado | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: é permitido criar operação retroativa? — GAP-019 |
| `JRN-OPE-002-N5` | Duplo clique em **Criar Operação** | Uma única operação |

### Permissões
`OPERACOES_GERENCIAR`.

### Critérios de aprovação
Operação extraordinária criada e distinguível pelo badge.

---

## Jornada: Ciclo de status da operação

### ID
`JRN-OPE-003`

### Objetivo
Percorrer `aberta → em_andamento → fechada` e provar as travas.

### Perfil do usuário
`administrador`, `gestor`, `compras`.

### Pré-condições
Uma operação `aberta` (de `JRN-OPE-001` ou `002`).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Passar o mouse na linha da operação `Aberta` | Botão **Iniciar operação** aparece |
| 2 | Clicar **Iniciar operação** | Status vira **Em andamento** |
| 3 | Passar o mouse novamente | Botão **Encerrar** |
| 4 | Clicar **Encerrar** | Status vira **Fechada**; sem mais ações no hover |

### Matriz de transições

| Estado atual | Ação | Próximo | Permitido? | Observação |
|---|---|---|---|---|
| `aberta` | Iniciar operação | `em_andamento` | Sim | — |
| `aberta` | Encerrar | `fechada` | Não | Só via `em_andamento` |
| `em_andamento` | Encerrar | `fechada` | Sim | — |
| `em_andamento` | Voltar para `aberta` | — | Não | `ConflictException` |
| `fechada` | qualquer | — | Não | Terminal |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OPE-003-N1` | `PATCH` direto de `aberta` para `fechada` | `409` transição inválida |
| `JRN-OPE-003-N2` | Alterar status de operação inexistente | `404 OPERACAO_INEXISTENTE` |
| `JRN-OPE-003-N3` | Criar pedido em operação **fechada** | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: o código não bloqueia explicitamente pedido em operação fechada — **GAP-012**, severidade alta |
| `JRN-OPE-003-N4` | Fechar operação com recebimento em andamento | ⚠️ REGRA A CONFIRMAR COM NEGÓCIO: não há checagem de pendências antes de fechar — GAP-020 |

### Permissões
`OPERACOES_GERENCIAR`.

### Critérios de aprovação
Transições válidas funcionam; as inválidas retornam `409`; GAP-012 e GAP-020 confirmados ou refutados.

### Evidências recomendadas
Print de cada status e print do erro de transição inválida.

---

## Jornada: Consultar e filtrar operações

### ID
`JRN-OPE-004`

### Objetivo
Validar a consulta, os contadores e a navegação para a compra.

### Perfil do usuário
Qualquer autenticado (ver GAP-018).

### Passo a passo

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Usar o filtro **Status: Todas** → **Aberta** | Tabela filtra |
| 2 | Selecionar **Em andamento** e **Fechada** | Idem |
| 3 | Conferir os contadores por operação | Refletem compras/pedidos vinculados |
| 4 | Clicar em **Registrar compra** numa operação sem compra | Navega para `/gestao/compras?data=<data>` com a data pré-carregada |

### Cenários negativos

| ID | Provocação | Resultado esperado |
|---|---|---|
| `JRN-OPE-004-N1` | Filtro que não retorna nada | **Nenhuma operação encontrada para o filtro aplicado.** |
| `JRN-OPE-004-N2` | Nenhuma operação cadastrada | Estado vazio explícito |
| `JRN-OPE-004-N3` | Backend indisponível | **Erro ao carregar operações** |

### Critérios de aprovação
Filtros corretos, contadores coerentes e deep-link para a compra funcionando.
