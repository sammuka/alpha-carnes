# AlphaCarnes — Instruções para agentes

## Fontes de verdade

Leia somente o necessário e aplique esta precedência:

1. `docs/governance/constituicao.md`.
2. `docs/execucao/DECISOES.md`.
3. `docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md`.
4. Protótipo na branch `main`; caminho padrão `F:\Projetos\alpha-carnes-prototipo` (existe só
   na máquina do owner). Em qualquer outra máquina: `git clone
   https://github.com/sammuka/alpha-carnes-prototipo` (repo privado — exige convite de
   colaborador) e apontar `ALPHACARNES_PROTOTYPE_PATH` (ou `-PrototypePath`) para esse clone.
   Sem isso, o Portão 1 de qualquer onda com UI bloqueia em `requires-human` — é o
   comportamento correto, não um bug. Referências antigas a `feature/completude-v1.1` em
   documentos históricos (planos de onda já mergeados, evidências, testes) são registro do
   que era verdade quando escritas — leia-as como `main`, a branch atual não existe mais.
5. `docs/governance/roadmap-canonico.md`, plano mestre e matriz de rastreabilidade.
6. Demais documentos e ADRs.

Se uma fonte exigida não existir, estiver ambígua ou contradizer uma fonte superior, pare e
reporte o bloqueio. Nunca invente uma decisão de produto.

## Ambiente

- Use PowerShell 7 (`pwsh`) como shell canônico no Windows.
- Não invoque `bash`: neste ambiente ele pode resolver para um WSL indisponível.
- Aplicação: Node 22, npm workspaces, NestJS e Next.js.
- Ambiente local: frontend `localhost:4000`, backend `localhost:4001` e PostgreSQL
  `localhost:15433`; portas internas dos containers: `3000`, `3001` e `5432`.
- Use `rg` para busca. Preserve alterações preexistentes do usuário.
- Mantenha worktrees de fatia em `.worktrees/<fatia>`; nunca implemente no worktree coordenador.
- Estado efêmero fica em `.codex/runtime/` e nunca é commitado.

## Regra de branching

`develop` e `main` não aceitam commit nem push direto — a proteção de branch no GitHub exige
PR (`required_pull_request_reviews`, sem force-push, sem exclusão). A única exceção é o owner
do repositório (`sammuka`, `enforce_admins: false`); qualquer outra identidade, incluindo
agentes, é bloqueada. Todo trabalho de agente:

1. Cria uma branch filha de `develop` (ou worktree dedicado, ex. `.worktrees/<fatia>`) —
   convenção `feature/<contexto>`, `fix/<contexto>` ou `feature/onda<N>-*`.
2. Integra em `develop` **somente** via PR, com o CI (oito jobs canônicos) verde.
3. Nunca usa `git push origin <branch>:develop` nem edita/comita na cópia local de `develop`.

Violar isso é bloqueio a reportar, não um atalho a tomar — mesmo em correções triviais ou
urgentes.

## Papéis e separação obrigatória

O agente raiz é apenas o coordenador. Ele delega e consolida; não escreve plano, código,
estado ou veredito. Rito vigente: **rito v2 (AD-41)**, detalhado em
`docs/governance/pipeline-execucao.md`; vale para toda fatia a partir da E09-T03 (o PR #168
conclui no rito anterior).

| Papel | Escrita autorizada | Nunca faz |
|---|---|---|
| `planner` | Um plano tático em `docs/superpowers/plans/` (≤ 400 linhas, sem código literal) e o PR rascunho da fatia | implementar, auditar ou mudar estado |
| `monitor` | Comentário de veredito no PR da fatia (`gh pr comment`) | implementar, corrigir plano, mudar status ou auditar o próprio trabalho |
| `worker` | Código/testes em `.worktrees/<fatia>`; corpo e comentários de relatório do PR | decidir regra, auditar, mergear ou editar `docs/execucao/` |
| `executor` | Worktrees, operação de merge e `EXECUCAO-STATUS.md` (uma vez por merge) | escrever veredito, plano ou código de produto |

Regras:

- Revisor independente do implementador: use uma nova instância `monitor` para cada rodada de
  Portão 1 e de Gate único; nunca a sessão que planejou ou implementou a fatia.
- O Monitor forma sua conclusão antes de ler um veredito anterior da mesma fatia.
- Modelos (AD-41 item 9): Monitor: sempre `claude-opus-5.5`. Planner: opus em fatia de alto risco, sonnet em baixo risco e ajuste textual. Worker pontual e Executor: sonnet; Worker de fatia nova ou integração com conflito: opus.
- Correção de plano volta a uma nova instância `planner`; correção de código volta ao `worker`.
- Veredito é comentário no PR: sem lock, sem linha em `GATE-VEREDITOS.md` (congelado até a
  AD-40) e sem Executor só para commitar docs de veredito.
- `EXECUCAO-STATUS.md` é atualizado pelo agente que mergeia, em commit de coordenação neutra no PR (AD-22 item 5, vigente), antes do `gh pr merge --match-head-commit`; o merge usa o head desse commit, com CI 8/8 nele.
- Divergência técnica de implementação vai na seção "Divergências" do corpo do PR, nunca em AD.
  `DECISOES.md` só recebe regra de negócio fornecida explicitamente pelo Quality Owner.
- Falha de delegação ou indisponibilidade do agente exigido é bloqueio; o coordenador não
  assume o papel.
- **Playwright só via `npm run e2e:ci`.** O merge de `fix/harness-e2e-ci` é pré-condição do primeiro gate único com tela (E09-T03 em diante); até lá, Playwright roda com banco descartável recriado e `next build && next start`, nunca `next dev`.
- Pendência do rito v2: `.codex/scripts/invoke-onda.ps1`, `.codex/scripts/invoke-multionda.ps1` e `docs/governance/pipeline-reproduzivel.md` seguem o rito anterior; até adaptação, valem AGENTS.md e skills; fatias rodam em modo assistido. Os perfis `.codex/agents/*.toml` já seguem o rito v2.

## Rito por fatia

1. Planner produz o plano enxuto e abre o PR rascunho da fatia com ele.
2. `$gate-plano` delega o Portão 1 a um Monitor independente: checklist fixo de 10 itens,
   veredito como comentário no PR da fatia. Escala própria do Portão 1: `aprovado` (os 10 itens ok) ou `ajustar` (qualquer item falhando). Não há `bloqueado` nem as seis classes, que são do Gate único. Teto de 2 rodadas; na 3ª tentativa escala ao QO. Decisão de produto ausente reprova o item 6 e a saída estruturada é `requires-human`.
3. `$disparar-onda` usa Executor + Worker para implementar em `.worktrees/<fatia>`; o relatório
   é o corpo do PR.
4. `$gate-pr` delega o **Gate único** a novo Monitor: conformidade (CI 8/8 no head exato, diff
   vs. plano, DoD→teste, RA-01..06, migrations) e ataque de domínio. PR só de documentação/skills: dispensa as pré-condições de plano (Portão 1 aprovado e seções do corpo do PR); gate = CI 8/8 + diff = escopo + sem segredo + leitura de coerência quando tocar governança.
5. O agente que mergeia faz o commit de coordenação neutra em `EXECUCAO-STATUS.md`, espera CI
   8/8 e usa `gh pr merge --match-head-commit <head>`.

Nenhuma etapa pula a anterior.

Ataque de domínio do Gate único (lista mínima):

1. **Invariantes do plano:** cada invariante atacado por caminho alternativo (outro endpoint, outra ordem, payload limite).
2. **Vigência:** sobreposição, lacuna, retroatividade, pai com vigência que exclui filhas.
3. **Segregação de funções:** autoaprovação; mesmo usuário em etapas que exigem pessoas distintas.
4. **Concorrência:** requisições simultâneas, ordem de locks (deadlock), `FOR UPDATE`/`FOR SHARE` do pai na criação de filho, guarda de envio em voo.
5. **Auditoria:** toda mutação crítica grava quem, quando, valor anterior e novo.
6. **RBAC dos 11 perfis:** teste de 403 por endpoint novo; nenhuma rota sem guarda.
7. **Caminho UI → API → DB → evento → UI:** a tela mostra o que foi gravado; lookup não grava código oculto; evento atualiza a outra tela.
8. **Cálculo fiscal/financeiro:** o campo que deveria controlar o cálculo o controla; escala e arredondamento `NUMERIC`.
9. **UI no DS v3:** tela usa o DS v3 e os componentes do protótipo citados no plano.

Classificação do Gate único:

**BLOQUEANTE** — somente estas seis classes:

1. perda ou corrupção de dado;
2. cálculo fiscal ou financeiro errado;
3. bypass de RBAC ou de segregação de funções;
4. segredo exposto;
5. violação de invariante escrito no plano;
6. erro 500 em caminho de usuário.

Tudo o mais é **MENOR**. Em dúvida de severidade, MENOR com justificativa; dúvida de decisão de produto bloqueia (fail-closed).

Fidelidade visual: tela sem o DS v3 ou componente do protótipo ausente = BLOQUEANTE pela classe 5 (invariante do plano/Princípio I); variante, texto literal, espaçamento = MENOR.

Rodadas do Gate único: r1 completa; r2 só por delta e só se houve BLOQUEANTE; r3 por delta: se não restar BLOQUEANTE, aprova e os MENORES vão ao backlog; se restar BLOQUEANTE, escala ao QO. Exceção ao teto só por decisão explícita do QO.

## Comandos de validação

```powershell
npm ci
npm run lint
npm run type-check
npm run test
npm run build
Set-Location app/backend; npm run test:cov
Set-Location ../frontend; npm run test
```

O plano tático e o CI podem exigir comandos adicionais. O relato de outro agente é hipótese;
o Monitor executa as verificações relevantes.

Os oito jobs do GitHub Actions são sempre obrigatórios. Vercel só é gate quando o diff do PR
toca `landing/**`; PR restrito à aplicação não é reprovado por status Vercel.
Quando CI exigir visibilidade pública temporária, use exclusivamente
`.codex/scripts/visibility-ci.ps1 -EnableVisibilityLease`: preflight privado, watchdog de
25 minutos e restauração privada verificada são obrigatórios. Se a restauração síncrona falhar,
o watchdog persiste sem teto fixo de tentativas e mantém o lease/lock até confirmar `PRIVATE`.

## Conclusão

Antes de declarar trabalho concluído:

- confirme o diff e que nenhum arquivo fora do escopo foi alterado;
- rode as verificações proporcionais ao risco (Playwright só via `npm run e2e:ci`; o merge de `fix/harness-e2e-ci` é pré-condição do primeiro gate único com tela (E09-T03 em diante); até lá, Playwright roda com banco descartável recriado e `next build && next start`, nunca `next dev`);
- registre o relatório no corpo do PR, com "Divergências" (ou "Nenhuma") e DoD→teste;
- cite comandos, resultados, branch, PR e SHAs reais;
- merge só com Gate único `aprovado`: commit de coordenação neutra em `EXECUCAO-STATUS.md`
  (AD-22 item 5), CI 8/8 no novo head e `--match-head-commit`;
- deixe bloqueios e decisões humanas explícitos, sem contorno silencioso.
