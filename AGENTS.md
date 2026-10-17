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
- Mantenha worktrees de onda em `.worktrees/o<N>`; nunca implemente no worktree coordenador.
- Estado efêmero fica em `.codex/runtime/` e nunca é commitado.

## Regra de branching

`develop` e `main` não aceitam commit nem push direto — a proteção de branch no GitHub exige
PR (`required_pull_request_reviews`, sem force-push, sem exclusão). A única exceção é o owner
do repositório (`sammuka`, `enforce_admins: false`); qualquer outra identidade, incluindo
agentes, é bloqueada. Todo trabalho de agente:

1. Cria uma branch filha de `develop` (ou worktree dedicado, ex. `.worktrees/o<N>`) —
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
| `worker` | Código/testes no worktree da fatia; corpo e comentários de relatório do PR | decidir regra, auditar, mergear ou editar `docs/execucao/` |
| `executor` | Worktrees, operação de merge e `EXECUCAO-STATUS.md` (uma vez por merge) | escrever veredito, plano ou código de produto |

Regras:

- Revisor independente do implementador: use uma nova instância `monitor` para cada rodada de
  Portão 1 e de Gate único; nunca a sessão que planejou ou implementou a fatia.
- O Monitor forma sua conclusão antes de ler um veredito anterior da mesma fatia.
- Modelo por tarefa (AD-41 item 9): Monitor e Planner de alto risco em `claude-opus-5.5`;
  Worker pontual e Executor em `claude-sonnet-5.5`.
- Correção de plano volta a uma nova instância `planner`; correção de código volta ao `worker`.
- Veredito é comentário no PR: sem lock, sem linha em `GATE-VEREDITOS.md` (congelado até a
  AD-40) e sem Executor só para commitar docs de veredito.
- Divergência técnica de implementação vai na seção "Divergências" do corpo do PR, nunca em AD.
  `DECISOES.md` só recebe regra de negócio fornecida explicitamente pelo Quality Owner.
- Falha de delegação ou indisponibilidade do agente exigido é bloqueio; o coordenador não
  assume o papel.
- **Playwright só via `npm run e2e:ci`** (banco novo por execução, `next build && next start`,
  seed). `next dev` não é ambiente de gate; falha vista só em `next dev` não é achado.

## Rito por fatia

1. Planner produz o plano enxuto e abre o PR rascunho da fatia com ele.
2. `$gate-plano` delega o Portão 1 a um Monitor independente: checklist fixo de 10 itens, teto
   de 2 rodadas, veredito como comentário no PR da fatia.
3. `$disparar-onda` usa Executor + Worker para implementar em worktree isolado; o relatório é o
   corpo do PR.
4. `$gate-pr` delega o **Gate único** a novo Monitor (`claude-opus-5.5`): conformidade (CI 8/8
   no head exato, diff vs. plano, DoD→teste, RA-01..06, migrations) e ataque de domínio
   (invariantes, vigência, segregação, concorrência, auditoria antes/depois, RBAC dos 11 perfis,
   UI→API→DB→evento→UI). PR só de documentação/skills: CI 8/8 + diff = escopo, sem ataque.
5. O agente que mergeia usa `gh pr merge --match-head-commit <head aprovado>` e atualiza
   `EXECUCAO-STATUS.md` uma vez.

Nenhuma etapa pula a anterior. **BLOQUEANTE** é fechado em seis classes: perda/corrupção de
dado; cálculo fiscal/financeiro errado; bypass de RBAC/segregação; segredo exposto; violação de
invariante escrito no plano; 500 em caminho de usuário. Tudo o mais é MENOR; **em dúvida, MENOR
com justificativa**. A 2ª rodada só existe com BLOQUEANTE e audita o delta; a 3ª aprova e os
MENORES vão para o PR de hardening do épico. Exceção ao teto só por decisão explícita do Quality
Owner, nunca por AD delegada. Decisão de produto pendente é fail-closed: `bloqueado` /
`requires-human`.

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
- rode as verificações proporcionais ao risco (Playwright só via `npm run e2e:ci`);
- registre o relatório no corpo do PR, com "Divergências" (ou "Nenhuma") e DoD→teste;
- cite comandos, resultados, branch, PR e SHAs reais;
- merge só com Gate único `aprovado` no head exato e `--match-head-commit`; depois atualize
  `EXECUCAO-STATUS.md` uma vez;
- deixe bloqueios e decisões humanas explícitos, sem contorno silencioso.
