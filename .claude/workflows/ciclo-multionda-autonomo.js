export const meta = {
  name: 'ciclo-multionda-autonomo',
  description: 'Roda o roadmap v1.1 do AlphaCarnes (ondas 1..10) de ponta a ponta, disparando cada onda elegível via ciclo-onda-autonomo.js, respeitando o grafo de dependências, paralelizando ondas independentes e parando por segurança ao primeiro resultado não-mergeado.',
  whenToUse: 'Depois de validar o ciclo autônomo de UMA onda (ciclo-onda-autonomo) contra pelo menos um caso real, quando o objetivo é processar várias ondas sem disparar cada uma manualmente.',
  phases: [
    { title: 'Leitura de estado', detail: 'lê docs/execucao/EXECUCAO-STATUS.md uma vez para saber o que já está mergeado/bloqueado/em andamento' },
    { title: 'Despacho', detail: 'agendador dinâmico: dispara toda onda elegível assim que há vaga e suas dependências mergearam; reavalia após cada conclusão' },
  ],
}

// Adaptado do ciclo-multionda-autonomo.js do SiriusComex. Este script NÃO
// reimplementa lógica de portão/implementação/merge — só decide QUANDO disparar
// CADA onda (workflow() chamando ciclo-onda-autonomo.js por scriptPath).
//
// Uma onda só é ELEGÍVEL quando tem plano tático pronto (aguardando_portao1 /
// plano_aprovado no EXECUCAO-STATUS.md). Como o AlphaCarnes usa planos
// just-in-time (só a Onda 1 nasce planejada), o uso típico é: planejar 1-2
// ondas à frente (Planejador humano/assistido), atualizar o status, e deixar
// este orquestrador processar o que estiver liberado.

let parsedArgs = args
if (typeof parsedArgs === 'string') {
  try {
    parsedArgs = JSON.parse(parsedArgs)
  } catch {
    parsedArgs = null
  }
}

const REPO = 'F:/Projetos/AlphaCarnes'

const SEM_INTERACAO_SINCRONA = `REGRA DE AMBIENTE (vale para toda esta tarefa, sobrepõe qualquer instrução em contrário): você está rodando em background, sem humano observando.
- NÃO use ferramenta de pergunta interativa (ex.: AskUserQuestion) — trava a execução para sempre.
- NÃO entre em modo de planejamento interativo (EnterPlanMode/ExitPlanMode).

`

const ECONOMIA_CONTEXTO = `ECONOMIA DE CONTEXTO (siga à risca): NÃO leia arquivos inteiros quando um trecho basta — grep dirigido ou faixa de linhas. Seja decisivo; não reabra o que já verificou.

`

// -----------------------------------------------------------------------
// Grafo estático de dependências DIRETAS entre ondas (roadmap-canonico.md §8 /
// plano mestre §6). HEURÍSTICA de agendamento — a pré-condição de cada onda
// disparada relê o disco e é autoritativa. Leitura conservadora: errar para
// "espera mais" é seguro; "libera cedo" não.
const GRAFO = {
  onda1: [],
  onda2: ['onda1'],
  onda3: ['onda2'],
  onda4: ['onda3'],
  onda5: ['onda3'],
  onda6: ['onda4', 'onda5'],
  onda7: ['onda6'],
  onda8: ['onda7'],
  onda9: ['onda7'],
  onda10: ['onda8', 'onda9'],
}

// Ondas que este script NUNCA dispara autonomamente, com o motivo.
const POOL_NAO_AUTOMATIZAVEL = {
  // Nenhuma por enquanto. Candidata futura: a homologação EISS real da onda10
  // exige credenciais externas — mas o plano tático dela deve separar o que é
  // automatizável (adapter + fake) do que depende da credencial (smoke real).
}

// Status que tornam uma onda elegível — LISTA POSITIVA: status desconhecido
// resulta em NÃO disparar, nunca em disparar por omissão.
const STATUS_ELEGIVEL = new Set(['aguardando_portao1', 'plano_aprovado'])

// RE-ADOÇÃO DE ÓRFÃS (opt-in, default OFF): run cortado deixa a onda presa em
// "implementando"/"aguardando_portao2". Só ligar quando NÃO há run concorrente.
const READOTAR_ORFAS = parsedArgs?.readotarOrfas === true
const STATUS_ORFAO_READOTAVEL = new Set(['implementando', 'aguardando_portao2'])

// Classificação do resultado: 'sucesso' mergeou; 'adiavel' falha benigna
// (re-elegível após um merge mudar o grafo); 'bloqueante' exige humano.
const RESULTADOS_ADIAVEIS = new Set(['nao-pronta', 'erro-execucao-workflow'])
function classificarResultado(veredito) {
  if (veredito === 'mergeado') return 'sucesso'
  if (RESULTADOS_ADIAVEIS.has(veredito)) return 'adiavel'
  return 'bloqueante'
}

const MAX_CONCORRENCIA = Number(parsedArgs?.maxConcorrencia) > 0 ? Math.floor(Number(parsedArgs.maxConcorrencia)) : 2
// Teto global de disparos por run (10 ondas; folga para reprocesso).
const MAX_ONDAS_POR_RUN = Number(parsedArgs?.maxOndas) > 0 ? Math.floor(Number(parsedArgs.maxOndas)) : 14
// args.somenteOndas: ["onda4","onda5"] restringe o disparo (dependências fora
// da lista ainda precisam estar mergeadas de verdade).
const SOMENTE_ONDAS = Array.isArray(parsedArgs?.somenteOndas) && parsedArgs.somenteOndas.length
  ? new Set(parsedArgs.somenteOndas.map((s) => String(s).toLowerCase()))
  : null

// GUARDA DE INSTÂNCIA ÚNICA (lock de run): dois runs sobrepostos multiplicam
// workers node (jest/tsc/build) e saturam a RAM. Se já houver um vivo, aborta.
const CAMINHO_LOCK_SH = `${REPO}/.claude/workflows/lib/lock.sh`
const LOCKDIR_RUN = `${REPO}/.claude/workflows/.locks/multionda-run.lock`
const LOCK_RUN_TIMEOUT_S = 21600 // 6h — acima de qualquer run legítimo; mais velho = órfão.
const LOCK_RUN_OWNER_TOKEN = `multionda-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

async function adquirirLockRun() {
  const r = await agent(
    `${SEM_INTERACAO_SINCRONA}Adquira o lock de INSTÂNCIA ÚNICA do orquestrador multionda. Rode EXATAMENTE:
\`\`\`bash
bash "${CAMINHO_LOCK_SH}" acquire "${LOCKDIR_RUN}" "${LOCK_RUN_OWNER_TOKEN}" ${LOCK_RUN_TIMEOUT_S} 0
\`\`\`
Reporte estruturado: adquirido=true SE a saída foi exatamente "LOCK_ACQUIRED"; false se "LOCK_TIMEOUT". Em "saida", a linha literal.`,
    {
      label: 'multionda:lock-run-adquirir',
      schema: {
        type: 'object',
        properties: { adquirido: { type: 'boolean' }, saida: { type: 'string' } },
        required: ['adquirido', 'saida'],
      },
    }
  )
  if (r?.saida === 'LOCK_ACQUIRED') return true
  if (r?.saida === 'LOCK_TIMEOUT') return false
  throw new Error(`Saída inválida ao adquirir lock multionda: ${JSON.stringify(r)}`)
}

let lockRunLiberado = false
async function liberarLockRun() {
  if (lockRunLiberado) return
  const r = await agent(
    `${SEM_INTERACAO_SINCRONA}Libere o lock de instância única. Rode EXATAMENTE: \`bash "${CAMINHO_LOCK_SH}" release "${LOCKDIR_RUN}" "${LOCK_RUN_OWNER_TOKEN}"\`. Reporte liberado=true somente se a saída for "LOCK_RELEASED" ou "LOCK_ALREADY_RELEASED"; inclua a saída literal em "saida".`,
    {
      label: 'multionda:lock-run-liberar',
      schema: {
        type: 'object',
        properties: { liberado: { type: 'boolean' }, saida: { type: 'string' } },
        required: ['liberado', 'saida'],
      },
    }
  )
  if (!r || r.liberado !== true || !['LOCK_RELEASED', 'LOCK_ALREADY_RELEASED'].includes(r.saida)) {
    throw new Error(`Falha ao liberar lock multionda: ${JSON.stringify(r)}`)
  }
  lockRunLiberado = true
}

async function lerStatusAtual() {
  const resposta = await agent(
    `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Leia docs/execucao/EXECUCAO-STATUS.md (repo ${REPO}) — só a tabela de ondas. NÃO edite nada.

Para CADA onda (onda1..onda10, coluna "Onda" traz o número — normalize para "onda<N>"), reporte o status LITERAL da célula. Valores possíveis: aguardando_inicio | planejando | aguardando_portao1 | plano_aprovado | implementando | aguardando_portao2 | mergeada | bloqueada.

Responda estruturado: "status" = array de {onda, statusLiteral}, com "onda" em minúsculo (ex.: "onda1").`,
    {
      label: 'multionda:ler-status',
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                onda: { type: 'string' },
                statusLiteral: { type: 'string' },
              },
              required: ['onda', 'statusLiteral'],
            },
          },
        },
        required: ['status'],
      },
    }
  )
  if (!resposta || !Array.isArray(resposta.status)) return null
  const mapa = {}
  // Normaliza para o token canônico ANTES de comparar — a célula real costuma
  // trazer sufixo (ex.: "mergeada (PR #12, squash abc123)").
  const TOKENS_CANONICOS = ['aguardando_inicio', 'planejando', 'aguardando_portao1', 'plano_aprovado', 'implementando', 'aguardando_portao2', 'mergeada', 'bloqueada']
  for (const { onda, statusLiteral } of resposta.status) {
    const literal = String(statusLiteral)
    const token = TOKENS_CANONICOS.find((t) => literal.startsWith(t)) || literal
    mapa[String(onda).toLowerCase()] = token
  }
  return mapa
}

function elegiveis(statusMap, exclusoes) {
  return Object.keys(GRAFO).filter((o) => {
    if (o in POOL_NAO_AUTOMATIZAVEL) return false
    if (SOMENTE_ONDAS && !SOMENTE_ONDAS.has(o)) return false
    if (exclusoes.has(o)) return false
    const elegivelPorStatus = STATUS_ELEGIVEL.has(statusMap[o])
      || (READOTAR_ORFAS && STATUS_ORFAO_READOTAVEL.has(statusMap[o]))
    if (!elegivelPorStatus) return false
    return GRAFO[o].every((dep) => statusMap[dep] === 'mergeada')
  })
}

// ---------------------------------------------------------------------------
// Fase 1 — Leitura de estado inicial
// ---------------------------------------------------------------------------
phase('Leitura de estado')

const lockRunOk = await adquirirLockRun()
if (!lockRunOk) {
  log('Já existe um run de ciclo-multionda-autonomo ATIVO (lock ocupado). Abortando sem disparar nada — pare o run anterior antes de redisparar.')
  return { resultado: 'run-concorrente-ativo', concluidas: [] }
}

log('Lendo o estado atual das ondas...')

const statusMap = await lerStatusAtual()

if (!statusMap) {
  log('Falha ao ler o estado inicial — abortando sem disparar (não agir sobre estado desconhecido).')
  await liberarLockRun()
  return { resultado: 'leitura-estado-falhou', concluidas: [] }
}

const jaMergeadasAntes = Object.keys(GRAFO).filter((o) => statusMap[o] === 'mergeada')
const atencaoHumanaAntes = Object.keys(GRAFO).filter(
  (o) => ['implementando', 'aguardando_portao2', 'bloqueada'].includes(statusMap[o])
)
log(`Estado inicial: ${jaMergeadasAntes.length} onda(s) mergeada(s); ${atencaoHumanaAntes.length} exigindo atenção pré-existente (${atencaoHumanaAntes.join(', ') || 'nenhuma'}).`)

// ---------------------------------------------------------------------------
// Fase 2 — Despacho (agendador dinâmico)
// ---------------------------------------------------------------------------
phase('Despacho')

const emVoo = new Map()
const jaTentadas = new Set()
const adiadas = new Set()
const concluidas = []
let totalDespachos = 0
let parar = false
let motivoParada = null

const CAMINHO_CICLO_ONDA = `${REPO}/.claude/workflows/ciclo-onda-autonomo.js`

function tentarDespachar() {
  if (parar) return
  if (totalDespachos >= MAX_ONDAS_POR_RUN) {
    if (!motivoParada) log(`Teto de segurança (${MAX_ONDAS_POR_RUN} disparos) atingido — aguardando só as em voo.`)
    return
  }
  const vagas = MAX_CONCORRENCIA - emVoo.size
  if (vagas <= 0) return
  const candidatas = elegiveis(statusMap, new Set([...jaTentadas, ...emVoo.keys()])).slice(0, vagas)
  for (const o of candidatas) {
    jaTentadas.add(o)
    totalDespachos++
    log(`Despachando onda "${o}" (dependências: ${GRAFO[o].join(', ') || 'nenhuma'})...`)
    // Disparo por scriptPath (não por nome — o registro por nome pode cachear
    // versão antiga do script). O .catch impede que uma rejeição derrube o
    // Promise.race do loop.
    const p = workflow({ scriptPath: CAMINHO_CICLO_ONDA }, { onda: o, readotarOrfas: READOTAR_ORFAS }).catch((e) => ({
      resultado: 'erro-execucao-workflow',
      onda: o,
      erro: String(e?.message || e),
    }))
    emVoo.set(o, p)
  }
}

tentarDespachar()

if (emVoo.size === 0) {
  log('Nenhuma onda elegível para disparo (verifique se há plano tático pronto e status aguardando_portao1/plano_aprovado no EXECUCAO-STATUS.md).')
}

while (emVoo.size > 0) {
  const entradas = [...emVoo.entries()]
  const { o, resultado } = await Promise.race(
    entradas.map(([onda, p]) => p.then((resultado) => ({ o: onda, resultado })))
  )
  emVoo.delete(o)
  concluidas.push({ onda: o, resultado })

  const veredito = resultado?.resultado
  const classe = classificarResultado(veredito)
  if (classe === 'sucesso') {
    statusMap[o] = 'mergeada'
    log(`Onda "${o}" MERGEADA (PR #${resultado.prNumero}, SHA ${resultado.shaAuditado}).`)
    const compartilhados = resultado.merge?.arquivosCompartilhadosTocados
    if (compartilhados?.length) {
      log(`AVISO: "${o}" tocou arquivo(s) compartilhado(s) (${compartilhados.join(', ')}). Ondas irmãs em voo podem precisar de rebase — o merge de cada uma tenta auto-recuperação sozinho.`)
    }
    if (adiadas.size) {
      for (const a of adiadas) jaTentadas.delete(a)
      adiadas.clear()
    }
    tentarDespachar()
  } else if (classe === 'adiavel') {
    adiadas.add(o)
    log(`Onda "${o}" voltou benigna (resultado: "${veredito}") — adiada; reconsiderada se um merge liberar dependências.`)
    tentarDespachar()
  } else {
    parar = true
    motivoParada = { onda: o, resultado: veredito, detalhe: resultado }
    log(`Onda "${o}" NÃO mergeou (BLOQUEANTE: "${veredito}"). Parando novos disparos — deixando ${emVoo.size} em voo terminar(em).`)
  }
}

// ---------------------------------------------------------------------------
// Relatório final
// ---------------------------------------------------------------------------
const naoAlcancadas = Object.keys(GRAFO).filter(
  (o) => !jaTentadas.has(o) && !adiadas.has(o) && !jaMergeadasAntes.includes(o) && !atencaoHumanaAntes.includes(o)
).map((o) => ({ onda: o, dependenciasPendentes: GRAFO[o].filter((d) => statusMap[d] !== 'mergeada') }))

log(`Ciclo multionda concluído. ${concluidas.filter((c) => c.resultado?.resultado === 'mergeado').length} onda(s) mergeada(s) nesta execução. Parou por falha: ${parar}.`)

await liberarLockRun()

return {
  resultado: parar ? 'parou-por-falha' : (naoAlcancadas.length ? 'concluido-com-pendencias' : 'concluido-tudo-elegivel'),
  concluidas,
  pararPorFalha: parar,
  motivoParada,
  totalDisparadas: jaTentadas.size,
  jaMergeadasAntesDaExecucao: jaMergeadasAntes,
  atencaoHumanaPreExistente: atencaoHumanaAntes,
  naoAlcancadas,
  adiadas: [...adiadas],
  statusFinalConhecido: statusMap,
}
