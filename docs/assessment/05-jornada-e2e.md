# 05 — Jornada E2E: Operação completa do início ao fim

> **E2E-001** é o roteiro que prova que o AlphaCarnes funciona como **sistema**, e não como um conjunto de
> telas. Ele percorre um dia operacional inteiro: da compra ao frigorífico até o caminhão liberado para sair
> com a NFS-e autorizada.
>
> As jornadas individuais ([`03`](03-jornadas-operacionais.md) a [`03d`](03d-jornadas-expedicao-faturamento.md))
> testam cada tela em profundidade. **Este documento testa a costura entre elas.** Execute-o depois das
> jornadas individuais, quando você já conhecer as telas.

---

# E2E-001 — Operação completa do início ao fim

### Objetivo de negócio
Reproduzir um dia real da distribuidora: comprar 10 bois casados, vender as peças a dois clientes
(inclusive uma venda acima do saldo), receber a carga do frigorífico, pesar e destinar cada peça, desossar
um traseiro, montar a carga, faturar e liberar o caminhão — validando que a **rastreabilidade ponta a
ponta** e a **conta de disponibilidade** se mantêm íntegras em cada etapa.

### Duração estimada
**4 a 6 horas** com um homologador experiente, ou um dia útil com registro completo de evidências.
Recomenda-se executar em **duas sessões**: manhã (blocos 1–5, planejamento e venda) e tarde (blocos 6–11,
operação física e faturamento).

### Perfis envolvidos
Idealmente **cinco pessoas em paralelo** simulando a operação real. Se for um homologador só, troque de
usuário conforme a coluna "Quem executa".

| Papel na simulação | Usuário | Blocos |
|---|---|---|
| Administrador | `admin@alphacarnes.local` | 0, 1 |
| Comprador | usuário do perfil `compras` | 2, 6 |
| Vendedor | usuário do perfil `comercial` | 3, 4 |
| Gestor | usuário do perfil `gestor` | 5, 11 |
| Balança / Recebimento | usuário do perfil `recebimento_pesagem` | 6, 7 |
| Desossa | usuário do perfil `corte` | 8 |
| Expedição | usuário do perfil `expedicao` | 9 |
| Faturamento | usuário do perfil `faturamento` | 10, 11 |

### Ambiente obrigatório

```powershell
docker compose up --build -d   # postgres + backend + frontend saudáveis
```

| Item | Valor |
|---|---|
| Frontend | `http://localhost:4000` |
| Backend | `http://localhost:4001` |
| Banco | `localhost:15433` |
| Flags | `HARDWARE_FAKE=1`, `NFSE_FAKE=1` |

> ⚠️ **Nunca execute o E2E com `NFSE_FAKE=0`.** Isso emitiria nota real no EISS Osasco.

### Pré-condições de dados
Nenhuma além do seed inicial. **O E2E cria tudo do zero** — é justamente isso que se quer provar.
Se você já executou as jornadas individuais, pode reaproveitar os cadastros e começar no **Bloco 2**.

---

## Números que devem fechar (a conta do E2E)

Anote estes números no início e confira a cada bloco. Se um deles não bater, **pare e registre** — é um
achado de integridade, mais grave que qualquer erro de tela.

| Grandeza | Valor esperado | Origem |
|---|---|---|
| Bois comprados | **10** | Compra programada |
| TZ gerados | **20** | 10 × fator 2 (AD-01) |
| DT gerados | **20** | idem |
| PA gerados | **20** | idem |
| **Total disponível após confirmar a compra** | **60** | soma |
| Vendido a CLI-A | **5 TZ + 3 DT** | Pedido 1 |
| Vendido a CLI-B | **20 TZ** (15 com saldo + 5 overbooking) | Pedido 2 |
| Déficit de overbooking | **5 TZ** | Pendência |
| Peças a pesar | **10** (uma por boi, mínimo) | Recebimento |
| TZ enviado à desossa | **1** | Bloco 8 |

---

# Bloco 0 — Preparação (Administrador)

| # | Quem | Onde | Ação | Resultado esperado |
|---|---|---|---|---|
| 0.1 | Admin | `/login` | Entrar com `admin@alphacarnes.local` | Painel Geral; menu completo |
| 0.2 | Admin | `/admin/usuarios` | Criar os **10 usuários** dos demais perfis (`JRN-ADM-001`) | 11 usuários ativos |
| 0.3 | Admin | `/admin/parametros` | Conferir `operacao.cadencia_dias` e os parâmetros de faturamento (`faturamento.rtc_*`) | Valores preenchidos — RTC incompleto impede o Bloco 10 |
| 0.4 | Admin | `/admin/auditoria` | Anotar o horário de início | Marco temporal para filtrar a auditoria no Bloco 11 |

> **Checkpoint 0:** 11 usuários ativos, cada um conseguindo logar e vendo apenas o seu menu.

---

# Bloco 1 — Cadastros estruturantes (Administrador)

Execute na ordem — há dependências entre eles.

| # | Onde | Criar | Referência |
|---|---|---|---|
| 1.1 | `/cadastros/representantes` | **REP-A** (`REP-001`, `Vendedor Homologação A`, Interno) e **REP-B** | `JRN-CAD-001` |
| 1.2 | `/cadastros/rotas` | **ROTA-A** (`RT-01`, `Rota Zona Oeste`) com **2 paradas ordenadas** | `JRN-CAD-007` |
| 1.3 | `/cadastros/produtos` | Conferir se `TZ`, `DT`, `PA` já vêm do seed MVP; criar o que faltar | `JRN-CAD-002` |
| 1.4 | `/cadastros/itens-compra` | **ICOMP-BOI** (`BOI-CASADO`, unidade `cabeca`) | `JRN-CAD-003` |
| 1.5 | `/cadastros/itens-comerciais` | Conferir `TZ`, `DT`, `PA` | `JRN-CAD-004` |
| 1.6 | `/cadastros/regras-transformacao` | **3 regras de desdobramento**: `BOI-CASADO` → `TZ` ×2, → `DT` ×2, → `PA` ×2 | `JRN-CAD-010` |
| 1.7 | `/cadastros/fornecedores` | **FORN-A** (`FOR-001`, `Frigorífico Homologação A LTDA`, CNPJ válido) | `JRN-CAD-005` |
| 1.8 | `/comercial/clientes` | **CLI-A** (`Açougue Homologação A LTDA`, CNPJ válido, REP-A, ROTA-A) e **CLI-B** (REP-B) | `JRN-CAD-006` |
| 1.9 | `/cadastros/caminhoes` | **CAM-A** (placa `HOM1A23`, `8000` kg) | `JRN-CAD-008` |
| 1.10 | `/cadastros/motoristas` | **MOT-A** (`Motorista Homologação A`) | `JRN-CAD-009` |
| 1.11 | `/comercial/tabela-precos` | Criar e **publicar** a tabela do dia com preços A/B/C/D | `JRN-PRC-001`, `JRN-PRC-004` |

> **Checkpoint 1 — crítico:** o passo **1.6 é o mais fácil de esquecer e o que mais causa falso negativo**.
> Sem as regras de desdobramento, o Bloco 2 confirma a compra e **nenhuma disponibilidade aparece**, sem
> nenhum aviso na tela (GAP-029). Se no Bloco 2 a grade vier vazia, volte aqui antes de abrir defeito.

---

# Bloco 2 — Operação e compra programada (Comprador)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 2.1 | `/gestao/operacoes` | Gerar a cadência ou criar a operação extraordinária **de hoje** | Operação **Aberta** |
| 2.2 | `/gestao/operacoes` | Conferir o selo | **Sem compra programada** |
| 2.3 | `/gestao/compras` | Selecionar a data, fornecedor **FORN-A**, referência `PC-HOM-001` | — |
| 2.4 | `/gestao/compras` | Item `BOI-CASADO`, quantidade **10** | Coluna **Regra de Desdobramento** mostra as 3 regras (**não** `—`) |
| 2.5 | `/gestao/compras` | **Salvar rascunho** | Status **Rascunho** |
| 2.6 | `/gestao/compras` | **Confirmar compra** | Status **Confirmada** |
| 2.7 | `/comercial/disponibilidade` → **Grade** | Conferir os KPIs | **Total gerado 60** · **Reservado 0** · **Disponível 60** · **Recebido 0** |

> **Checkpoint 2:** `TZ = 20`, `DT = 20`, `PA = 20`. Se der 30 no total em vez de 60, alguma regra de
> desdobramento está com fator 1 em vez de 2.

---

# Bloco 3 — Venda com saldo (Vendedor)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 3.1 | `/comercial/disponibilidade` | Deixar esta aba **aberta em outra janela** | Indicador **live** ativo — usaremos para provar tempo real |
| 3.2 | `/comercial/pedidos` | **Novo pedido**, cliente **CLI-A** | **Representante** preenche com REP-A; **Rota** com ROTA-A |
| 3.3 | Editor | Operação = a de hoje, prioridade `50` | — |
| 3.4 | Editor | Produto `TZ`, quantidade **5** → **Adicionar produto** | Linha com origem **Virtual** |
| 3.5 | Editor | Produto `DT`, quantidade **3** → **Adicionar produto** | Segunda linha |
| 3.6 | Editor | **Salvar Rascunho** | Badge **Rascunho com reserva ativa** |
| 3.7 | Janela da disponibilidade | **Sem apertar F5** | TZ cai de 20 → **15**; DT de 20 → **17** |
| 3.8 | `/comercial/pedidos` | Abrir o pedido → **Finalizar Pedido** | Status **Finalizado** |
| 3.9 | `/comercial/disponibilidade` | Conferir | O **total continua 60**; o valor migrou de **Reservado** para **Confirmado** |

> **Checkpoint 3 — a prova do tempo real (3.7) é obrigatória.** Se precisar de F5, é falha do Princípio VI.
> **Checkpoint 3b — a prova de não-dupla-redução (3.9).** Finalizar não pode consumir saldo de novo.

---

# Bloco 4 — Venda com overbooking (Vendedor)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 4.1 | `/comercial/pedidos` | **Novo pedido**, cliente **CLI-B**, operação de hoje | — |
| 4.2 | Editor | Produto `TZ`, quantidade **20** (saldo é 15) → **Adicionar produto** → **Salvar Rascunho** | Modal **Confirmar overbooking** com **Déficit = 5** |
| 4.3 | Modal | Clicar **Cancelar** | — |
| 4.4 | `/comercial/pedidos` e `/comercial/disponibilidade` | Conferir | **Nada foi criado**; saldo de TZ ainda 15 — *prova do challenge read-only (AD-05)* |
| 4.5 | Repetir 4.1–4.2 | Modal reaparece | — |
| 4.6 | Modal | **Confirmar overbooking** | Pedido criado; item com origem **Overbooking** |
| 4.7 | `/gestao/overbooking` | Selecionar a operação | Pendência **Aberta**, déficit **5**, cliente CLI-B |
| 4.8 | `/comercial/disponibilidade` → **Mapa** | Conferir | Unidades no estado **O** (Overbooking); TZ marcado **ESGOTADO** |
| 4.9 | `/comercial/pedidos` | **Finalizar Pedido** do CLI-B | Permitido — overbooking já confirmado não bloqueia |

> **Checkpoint 4:** as três provas de AD-05 (challenge não persiste · confirmação é atômica · finalização
> não é bloqueada) devem estar registradas com print.

---

# Bloco 5 — Resolver o overbooking (Gestor)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 5.1 | `/gestao/overbooking` | Abrir a pendência → **Iniciar análise** | Status **Em análise** |
| 5.2 | Painel direito | Escolher **3. Postergar para próxima operação** | Lista de operações destino |
| 5.3 | Modal | Quantidade a postergar = **5** → **Gerar novo pedido** | Status **Novo pedido criado** |
| 5.4 | `/comercial/pedidos` na operação destino | Conferir | Pedido novo com 5 TZ para CLI-B |
| 5.5 | `/gestao/dashboard` | Conferir | **Overbookings abertos** decresceu |

> **Checkpoint 5:** o déficit de hoje virou demanda de amanhã, com rastreabilidade.
> Alternativa: se quiser exercitar os outros caminhos, use `JRN-OVB-002` (compra complementar) ou
> `JRN-OVB-003` (redistribuição) em pendências separadas.

---

# Bloco 6 — Pedido ao fornecedor e abertura do recebimento (Comprador → Recebimento)

| # | Quem | Onde | Ação | Resultado esperado |
|---|---|---|---|---|
| 6.1 | Comprador | API | `POST /operacao/pedidos-fornecedor` com a compra confirmada | Pedido `rascunho` — 🔎 **registre o GAP-042**: não há tela |
| 6.2 | Comprador | API | `POST /operacao/pedidos-fornecedor/:id/enviar` | Status `enviado` |
| 6.3 | Recebimento | `/recebimento/recebimento-carga` | **Novo recebimento** | Sheet com as seções A–D |
| 6.4 | Recebimento | Seção A | Selecionar o pedido | Badge **Itens carregados automaticamente** + tabela de previsão |
| 6.5 | Recebimento | Seção B | NF `129110`, série `1`, chave (44 díg.), romaneio `ROM-001`, pesos e volumes | — |
| 6.6 | Recebimento | Seção C | Placa `HOM1A23`, motorista `Motorista Homologação A` | — |
| 6.7 | Recebimento | — | **Criar Lote e Ir para Balança** | Navega para a pesagem; status **Pesagem em andamento** |

> **Checkpoint 6:** os itens previstos **não foram digitados** — vieram do pedido. Se você teve que
> digitar, é desvio da regra v1.1 §8.

---

# Bloco 7 — Pesagem, destinação e etiquetas (Balança)

Repita o ciclo abaixo para **cada peça**. Distribua os destinos assim para exercitar todos os caminhos:

| Peça | Destino | Motivo do roteiro |
|---|---|---|
| 1 a 5 | **Pedido CLI-A** (TZ e DT) | caminho principal |
| 6 | **Estoque** | destino alternativo |
| 7 | **Desossa** | alimenta o Bloco 8 |
| 8 | **Pedido CLI-B**, depois **Trocar Peça** | fluxo atômico de troca |
| 9 a 10 | **Pedido CLI-B** | completar a carga |

### Ciclo por peça

| # | Ação | Resultado esperado |
|---|---|---|
| 7.1 | **Capturar Peso** | **Peso atual** exibido (fake: 12,500 kg) |
| 7.2 | Conferir **Pedidos compatíveis** | Badge **Sugestão principal** |
| 7.3 | **Vincular** ao pedido | Peça fica **Pedido** |
| 7.4 | **Confirmar e imprimir etiqueta** | Botão vira **Etiqueta: {código}** — **anote o código** |
| 7.5 | Conferir **Acumulado do lote** | **Restante** decresce |

### Variações obrigatórias dentro do bloco

| # | Ação | Referência |
|---|---|---|
| 7.6 | Uma peça por **peso manual assistido** com motivo | `JRN-PES-002` |
| 7.7 | A peça 6 para **→ Estoque** com motivo | `JRN-PES-001-A1` |
| 7.8 | A peça 7 para **→ Desossa** | `JRN-PES-001-A2` |
| 7.9 | Na peça 8, executar a **Troca de Peça** completa (6 passos) | `JRN-PES-004` |
| 7.10 | Em `/recebimento/etiquetas`, conferir a etiqueta trocada | Estado `invalidada_por_troca` + nova ativa |

### Fechamento do recebimento

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 7.11 | API/UI | Concluir a pesagem | Status **Aguardando conferência final** |
| 7.12 | `/recebimento/recebimento-carga` | **Capturar itens da NF** | NF estruturada persistida |
| 7.13 | — | **Concluir conferência** | Dialog **Conclusão da Conferência — Pedido × NF × Pesagem** |
| 7.14 | Dialog | Revisar o quadro e **Confirmar conclusão** | **Conferido sem divergência** |
| 7.15 | `/comercial/disponibilidade` | Conferir | Unidades migraram de **V** (virtual) para **F** (físico) |

> **Checkpoint 7:** o quadro comparativo do 7.13 é a **prova de AD-04**. Fotografe-o.
> Se quiser exercitar a divergência, faça-o em um **segundo lote**, não neste — divergência aqui
> complicaria os blocos seguintes.

---

# Bloco 8 — Desossa (Corte)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 8.1 | `/desossa/dashboard` | Conferir o **Painel de Necessidade** | **TZs na desossa** = 1 (a peça 7) |
| 8.2 | `/desossa/dashboard` | Abrir o **Modo TV** e sair | Layout de chão de fábrica legível |
| 8.3 | `/desossa/pesagem-destinacao` | **Selecionar TZ** | Modal com a peça encaminhada |
| 8.4 | — | Escolher a **regra A** | Checklist de saídas esperadas + badge **Provisório P12** |
| 8.5 | — | Para cada saída: capturar peso, destinar e etiquetar | Subitens `gerado → pesado → associado` |
| 8.6 | — | **Finalizar** → **Concluir** | Transformação `concluida` |
| 8.7 | `/desossa/etiquetas` | Conferir | Partes com vínculo à **peça mãe (TZ)** |

> **Checkpoint 8:** a rastreabilidade **parte → TZ → recebimento** deve estar visível no drawer.

---

# Bloco 9 — Carga e conferência (Expedição)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 9.1 | `/carga/planejamento` | Criar o caminhão a partir da frota (**CAM-A**), motorista **MOT-A**, rota `Rota Zona Oeste` | Status **Montando** |
| 9.2 | — | **Alocar** os pedidos de CLI-A e CLI-B | Pedidos vinculados; `{ocupacao}% ocupado` |
| 9.3 | — | **Abrir carga** | Caminhão pronto para receber peças |
| 9.4 | — | Adicionar as peças etiquetadas à carga | Peças na carga |
| 9.5 | — | **Enviar para conferência** | Status **Em Conferência** |
| 9.6 | `/carga/conferencia` | Selecionar a carga | KPIs zerados: `0 / {total}` |
| 9.7 | — | Bipar **cada etiqueta anotada no 7.4** | **Peça conferida.** a cada bipagem |
| 9.8 | — | Fazer **uma** bipagem por **leitura manual** com motivo | `{codigo} conferida.` |
| 9.9 | — | Conferir os KPIs | **Peças Conferidas** = `{total} / {total}` |
| 9.10 | — | **Finalizar Conferência** | Status **Conferida** + aviso de bloqueio de estornos |
| 9.11 | — | Tentar estornar uma peça em `/recebimento/pesagem-destinacao` | `Peça já está em carga fechada — estorno bloqueado` |
| 9.12 | `/carga/enviar-faturamento` | **Enviar para Faturamento** | Status **Enviada para Faturamento**; entra no **Histórico de Envios** |

> **Checkpoint 9 — o passo 9.11 é obrigatório.** É a prova de que o marco de fechamento realmente trava
> a operação a montante.

---

# Bloco 10 — Faturamento (Faturamento)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 10.1 | `/faturamento/pre-faturamento` | Conferir o badge de ambiente | **Homologação EISS** |
| 10.2 | — | Selecionar o caminhão → **Consolidar** | **Pedidos consolidados** com KPIs |
| 10.3 | — | Conferir **Bloqueios ativos** | Deve estar **vazio** — se houver, resolva antes |
| 10.4 | — | Preencher **Valor (R$)** do pedido de CLI-A e **Emitir NFS-e** | `NFS-e nº FAKE-001`, `Cód. verificação: FAKECODE123` |
| 10.5 | — | Emitir a nota do pedido de CLI-B com valor **`999.99`** | Erro de negócio `Atividade não autorizada`; nota em **Erro** |
| 10.6 | — | **Reprocessar** com valor válido | Nota **Autorizada**; contador `{n} tentativa(s)` |
| 10.7 | `/faturamento/notas-xml` | Conferir os KPIs | **Autorizadas hoje** = 2 |
| 10.8 | — | Abrir **Ver detalhe** de uma nota | Drawer com `Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal`; **Peso total** bate com a soma |
| 10.9 | `/faturamento/seguro-manual` | **Anexar comprovante** → **Marcar como enviado** → **Marcar como confirmado** | Badge **Seguro tratado** |

> **Checkpoint 10 — o passo 10.8 é a prova final de rastreabilidade.** Pegue um código de etiqueta do
> drawer, volte a `/recebimento/etiquetas` e confirme que é a mesma peça pesada no Bloco 7.
> **Checkpoint 10b:** o passo 10.5 é a prova de que o erro do EISS não corrompe o estado da carga.

---

# Bloco 11 — Liberação e fechamento (Gestor / Faturamento)

| # | Onde | Ação | Resultado esperado |
|---|---|---|---|
| 11.1 | `/faturamento/liberacao` | Selecionar a carga | Checklist com os 4 requisitos **todos OK** |
| 11.2 | — | **Liberar Caminhão** | `Caminhão liberado por {nome} em {data}` |
| 11.3 | `/faturamento/notas-xml` | Tentar **cancelar** uma nota | Modal **Cancelamento bloqueado** |
| 11.4 | `/gestao/operacoes` | Fechar a operação | Status **Fechada** |
| 11.5 | `/gestao/dashboard` | Conferir os 10 KPIs | Coerentes com tudo que foi feito |
| 11.6 | `/comercial/espelho` | Conferir | Pedidos como **Fechado**; exportar o CSV |
| 11.7 | `/gestao/relatorios` | **Gerar** os relatórios SIF elegíveis | Status **Gerado** (conteúdo provisório — P8) |
| 11.8 | `/admin/auditoria` | Filtrar pelo período do E2E | **Toda** mutação registrada com autor e justificativa |

> **Checkpoint 11 — o passo 11.8 é o fecho do assessment.** Percorra a auditoria de trás para frente e
> confirme que dá para reconstruir o dia inteiro sem consultar o banco.

---

## Validação final de integridade

Ao terminar, responda **sim** a todas as perguntas abaixo. Um "não" é um achado de severidade Crítica.

| # | Pergunta | Onde verificar |
|---|---|---|
| V1 | A disponibilidade total gerada foi exatamente **60** (10 bois × 3 produtos × fator 2)? | Bloco 2.7 |
| V2 | A reserva aconteceu **no rascunho**, não na finalização? | Bloco 3.7 |
| V3 | O saldo caiu em outra aba **sem F5**? | Bloco 3.7 |
| V4 | Finalizar o pedido **não** reduziu o saldo pela segunda vez? | Bloco 3.9 |
| V5 | Cancelar o challenge de overbooking **não deixou resíduo**? | Bloco 4.4 |
| V6 | A pendência de overbooking foi criada **junto** com o pedido, na mesma transação? | Bloco 4.7 |
| V7 | Os itens do recebimento vieram do pedido ao fornecedor **sem redigitação**? | Bloco 6.4 |
| V8 | O quadro Pedido × NF × Pesagem fechou com acumuladores corretos? | Bloco 7.13 |
| V9 | A troca de peça foi **atômica** (etiqueta antiga invalidada + nova emitida + peso preservado)? | Bloco 7.9/7.10 |
| V10 | A unidade migrou de **virtual** para **físico** no mapa após o recebimento? | Bloco 7.15 |
| V11 | A parte da desossa aponta para a **peça mãe** correta? | Bloco 8.7 |
| V12 | O estorno ficou **bloqueado** depois da carga fechada? | Bloco 9.11 |
| V13 | O erro do EISS **não** corrompeu o estado da carga nem da nota? | Bloco 10.5/10.6 |
| V14 | O **Peso total** do drawer da nota bate com a soma das peças? | Bloco 10.8 |
| V15 | Foi possível voltar da NF até a peça pesada usando só a UI? | Bloco 10.8 → `/recebimento/etiquetas` |
| V16 | O cancelamento de nota ficou **bloqueado** após a liberação? | Bloco 11.3 |
| V17 | A auditoria permite reconstruir o dia inteiro? | Bloco 11.8 |

---

## Variantes do E2E (executar depois do E2E-001)

| ID | Variante | O que prova | Blocos afetados |
|---|---|---|---|
| **E2E-002** | Dia com **divergência de recebimento** | Divergência não trava a operação; ocorrência administrativa é criada e tratada até a resolução | 6, 7, + `JRN-REC-004`/`JRN-REC-005` |
| **E2E-003** | Dia com **compra alterada após venda** | Recálculo de disponibilidade com confirmação de déficit e impacto em pedidos existentes | 2, 3, + `JRN-CMP-003` |
| **E2E-004** | Dia com **duas cargas e dois caminhões** | Transferência de item entre cargas e liberação independente | 9, 10, 11 |
| **E2E-005** | Dia **sem regra de desdobramento** (negativo) | Confirma o GAP-029: compra confirma mas nada é gerado, silenciosamente | 1.6 omitido, 2 |
| **E2E-006** | Dia com **reabertura de carga** | Reabertura autorizada e bloqueio quando há NFS-e emitida | 9, + `JRN-EXP-004` |

---

## Evidências mínimas do E2E-001

Organize em `evidencias/E2E-001/` com um arquivo por bloco:

| Bloco | Evidência obrigatória |
|---|---|
| 1 | Print das 3 regras de desdobramento ativas |
| 2 | Print da grade com **Total gerado 60** |
| 3 | Dois prints da disponibilidade (antes/depois) na **mesma sessão sem F5** |
| 4 | Print do modal de overbooking com déficit 5 + print do saldo intacto após cancelar |
| 5 | Print do novo pedido gerado na operação destino |
| 6 | Print do sheet com **Itens carregados automaticamente** |
| 7 | Print do quadro Pedido × NF × Pesagem + print da etiqueta invalidada por troca |
| 8 | Print da transformação concluída com rastreabilidade à peça mãe |
| 9 | Print de `{total} / {total}` conferido + print do bloqueio de estorno |
| 10 | Print da nota `FAKE-001` + print do erro `Atividade não autorizada` + print do drawer de rastreabilidade |
| 11 | Print do checklist 100% OK + print do **Cancelamento bloqueado** + export CSV da auditoria do período |
