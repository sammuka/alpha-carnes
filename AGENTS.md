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
estado ou veredito.

| Papel | Escrita autorizada | Nunca faz |
|---|---|---|
| `planner` | Um plano tático em `docs/superpowers/plans/` | implementar, auditar ou mudar estado |
| `monitor` | Append em `docs/execucao/GATE-VEREDITOS.md` | implementar, corrigir plano ou mudar status |
| `worker` | Código/testes no worktree da onda e PR correspondente | decidir regra, auditar, mergear ou editar `docs/execucao/` |
| `executor` | `EXECUCAO-STATUS.md`, worktrees e operação de merge | escrever veredito, plano ou código de produto |

Regras:

- Use uma nova instância `monitor` para cada Portão 1, Portão 2 e revisão adversarial.
- O Monitor forma sua conclusão antes de ler um veredito anterior da mesma rodada.
- Correção de plano volta a uma nova instância `planner`; correção de código volta ao `worker`.
- Somente o `monitor` altera o conteúdo de `GATE-VEREDITOS.md`. O Executor pode incluí-lo
  byte a byte em um commit de coordenação, sem editá-lo.
- `DECISOES.md` só recebe uma decisão fornecida explicitamente pelo Quality Owner.
- Falha de delegação ou indisponibilidade do agente exigido é bloqueio; o coordenador não
  assume o papel.

## Rito por onda

1. Planner produz plano autossuficiente.
2. `$gate-plano` delega o Portão 1 a um Monitor independente.
3. `$disparar-onda` usa Executor + Worker para implementar em worktree isolado.
4. `$gate-pr` delega o Portão 2 a novo Monitor.
5. No modo autônomo, outro Monitor faz a revisão adversarial e registra Portão `A`.
6. Executor só mergeia o SHA aprovado por Portão 2 e Portão A.

Nenhuma etapa pula a anterior. Em dúvida entre `aprovado` e `ajustar`, use `ajustar`.

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
- rode as verificações proporcionais ao risco;
- cite comandos, resultados, branch, PR e SHAs reais;
- deixe bloqueios e decisões humanas explícitos, sem contorno silencioso.
