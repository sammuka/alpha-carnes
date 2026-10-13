---
name: gate-plano
description: Audita o plano tático de uma onda do AlphaCarnes antes da implementação e registra o Portão 1. Use quando um plano em docs/superpowers/plans estiver pronto, quando o status estiver aguardando_portao1, ou quando alguém pedir gate, revisão ou aprovação de plano de onda.
---

# Portão 1 — Gate de plano

Delegue a auditoria inteira a uma nova instância do agente `monitor`. O coordenador não audita,
não edita o plano e não escreve o veredito. Se não for possível criar um Monitor independente,
retorne `bloqueado`.

## Entrada e resolução do plano

1. Normalize o argumento para `onda<N>`.
2. Leia somente a linha correspondente em `docs/execucao/EXECUCAO-STATUS.md`.
3. Resolva o plano pelo link da coluna `Plano tático`. Não escolha por data ou por “arquivo mais
   recente”. Link ausente, `just-in-time` ou mais de um plano autoritativo significa `bloqueado`.
4. Calcule SHA-256 do plano e use esse hash em toda evidência desta rodada.
5. Leia as réguas: constituição, roadmap, plano mestre, matriz de rastreabilidade,
   `DECISOES.md` e estado das dependências.

Arquivo ou régua ausente bloqueia o gate; não use conhecimento presumido.

## Auditoria do Monitor

Leia o plano inteiro e verifique:

1. **Constituição**
   - Cada tela aponta para o `.tsx` exato do protótipo e o arquivo existe.
   - Tokens e cores pertencem à paleta validada.
   - Nada entra mínimo, parcial ou “depois”.
   - P1–P15 abertas permanecem parâmetro + badge Provisório.
   - Zero uso de “Marca” como rótulo, campo ou entidade nova.
2. **Escopo**
   - Todas as linhas da matriz destinadas à onda estão cobertas.
   - Nenhuma entrega de onda futura entrou.
   - Todas as dependências estão `mergeada`.
3. **Decisões**
   - AD-xx vigentes são respeitadas e nenhuma decisão fechada é reaberta.
4. **Autossuficiência**
   - Goal, Architecture, Tech Stack, decisões fixadas, estrutura e referências.
   - Mapa DoD → teste 1:1.
   - Tasks numeradas com paths, interfaces, código literal, comandos, saída esperada e commit.
   - Zero `TBD`, `TODO`, “a definir”, “implementar depois” ou “similar à Task”.
5. **Consistência**
   - Tabelas, endpoints, eventos e tipos batem com o plano mestre e ondas aprovadas.

Em dúvida sobre a **severidade**, classifique como BLOQUEANTE. Registre `bloqueado` no veredito
para decisão de produto ausente, dependência não satisfeita ou violação não negociável. Na saída
estruturada do ciclo, decisão de produto ausente mapeia obrigatoriamente para `requires-human`;
os demais bloqueios mapeiam para `blocked`.

## Severidade, rodadas e classe de risco (AD-22)

- **BLOQUEANTE**: viola invariante (integridade, dinheiro, segredo, segurança, regra de fonte,
  decisão de produto) ou torna o plano inexecutável. Impede `aprovado`.
- **MENOR**: imprecisão resolvível sem decidir regra. **Não** impede `aprovado`; vai no feedback
  como item obrigatório do Worker (ou do próximo plano).
- `aprovado` = zero BLOQUEANTE. `ajustar` = ao menos um BLOQUEANTE corrigível.
- Da 2ª rodada em diante: leia o veredito anterior **depois** de formar a conclusão sobre o
  delta (`git diff <sha-anterior>..<sha-atual> -- <plano>`) e audite a resolução dos achados.
  Achado novo fora do delta só conta se for BLOQUEANTE.
- Teto de 3 rodadas por portão. Na 4ª, o coordenador escala ao Quality Owner com o histórico.
- Pin: sha256 do blob git do plano (`git show <sha>:<plano>` em arquivo temporário +
  `Get-FileHash`), nunca do arquivo em disco (autocrlf).
- Confirme a classe de risco declarada no plano (`alto` ou `baixo`). Plano sem classe, ou com
  classe incompatível com o escopo, é BLOQUEANTE.
- Reprove como BLOQUEANTE plano que afirme estado volátil (HEAD, head de PR, contagem de
  commits, "última linha") como fato ou que use contagens de SHAs como verificação.

## Registro

Adquira o lock compartilhado:

```powershell
pwsh -NoProfile -File .codex/scripts/lock.ps1 acquire coordination -Role monitor -RunId <run-id>
```

Anexe exatamente uma linha a `GATE-VEREDITOS.md`, preserve o histórico e libere o lock em
`finally`:

```text
| <timestamp UTC> | onda<N> | 1 | aprovado|ajustar|bloqueado | plano=<path>; sha256(blob)=<hash>; risco=alto|baixo; modelo solicitado=<id>; efetivo=<id ou nao atestavel>; comandos=<resumo> | <BLOQUEANTES numerados; MENORES numerados como itens obrigatórios> |
```

Escape `|` e quebras de linha dentro das células. `aprovado` com MENORES listados é válido
(AD-22); `aprovado` com BLOQUEANTE pendente nunca é.

## Saída

Retorne `onda`, `plano`, `sha256`, `veredito`, evidências curtas, feedback numerado e a linha
anexada. Se aprovado, informe que o Executor pode marcar `plano_aprovado`.
