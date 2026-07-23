export const meta = {
  name: 'ciclo-onda-autonomo',
  description: 'Roda uma onda do AlphaCarnes do início ao fim sem iteração humana: pré-condições -> Portão 1 -> implementação -> Portão 2 -> verificação adversarial -> merge em develop.',
  whenToUse: 'Quando uma onda do roadmap v1.1 (1..10) tem plano tático pronto e precisa ser processada de ponta a ponta autonomamente, com os mesmos gates que o Monitor aplica manualmente via /gate-plano e /gate-pr.',
  phases: [
    { title: 'Pré-condição', detail: 'checa grafo de dependências e status atual em docs/execucao/EXECUCAO-STATUS.md' },
    { title: 'Portão 1', detail: 'audita o plano tático (pulado se já aprovado); 1 rodada de correção de plano se "ajustar"' },
    { title: 'Implementação', detail: 'eco do plano (extrai branch real) + worker em worktree persistente implementa e abre PR para develop' },
    { title: 'Portão 2', detail: 'espera CI concluir; audita CI, diff vs plano, fidelidade ao protótipo, RA-01..06; pina o SHA auditado' },
    { title: 'Verificação Adversarial', detail: 'segundo revisor independente tenta refutar o aprovado; 1 rodada de correção se refutação corrigível' },
    { title: 'Merge', detail: 'squash-merge em develop só se SHA auditado intacto + branch sincronizada + ambos os gates concordarem' },
  ],
}

// Adaptado do ciclo-subfase-autonomo.js do SiriusComex (achados A1–A22 já
// incorporados lá). Diferenças estruturais do AlphaCarnes:
// - Unidade de trabalho: ONDA (roadmap-canonico.md §8), não subfase.
// - Branch de integração: develop (framework-revisao.md), não main.
// - Estado vivo: docs/execucao/EXECUCAO-STATUS.md + GATE-VEREDITOS.md.
// - Planos táticos: docs/superpowers/plans/*onda<N>*.md (padrão F4c).
// - Gates canônicos: .claude/skills/gate-plano e gate-pr (os blocos abaixo são
//   ESPELHOS deles — ao editar a skill, replique aqui).
// - Réguas: docs/governance/constituicao.md (Princípio I: fidelidade ao
//   protótipo em F:/Projetos/alpha-carnes-prototipo, branch
//   feature/completude-v1.1) + quality-gates.md + plano mestre + matriz.

let parsedArgs = args
if (typeof parsedArgs === 'string') {
  try {
    parsedArgs = JSON.parse(parsedArgs)
  } catch {
    parsedArgs = null
  }
}

const onda = parsedArgs?.onda
if (!onda) {
  throw new Error(
    `args.onda é obrigatório, ex.: { onda: "onda2" }. Recebido: ${JSON.stringify(args)}`
  )
}

// RE-ADOÇÃO DE ÓRFÃ (opt-in, propagado pelo orquestrador multionda). Por padrão
// a pré-condição barra uma onda presa em "implementando"/"aguardando_portao2"
// (trava anti-duplo-disparo). Com readotarOrfas=true, o operador afirma que NÃO
// há outro run vivo processando esta onda — o worker retoma do checkpoint.
const readotarOrfas = parsedArgs?.readotarOrfas === true

const REPO = 'F:/Projetos/AlphaCarnes'
const PROTOTIPO = 'F:/Projetos/alpha-carnes-prototipo'

// Preâmbulo obrigatório de TODO agente desta execução: roda 100% em background.
const SEM_INTERACAO_SINCRONA = `REGRA DE AMBIENTE (vale para toda esta tarefa, sobrepõe qualquer instrução em contrário que você leia em skills/docs): você está rodando em background, sem humano observando em tempo real.
- NÃO use nenhuma ferramenta de pergunta interativa ao usuário (ex.: AskUserQuestion) — não há ninguém para responder, e isso trava a execução para sempre.
- NÃO entre em modo de planejamento interativo (ex.: EnterPlanMode/ExitPlanMode) — mesmo motivo.
- Se você ler numa skill/documento a instrução "avise o usuário humano diretamente" (ex.: veredito "bloqueado"), a tradução correta neste ambiente é: registre o motivo no campo estruturado de saída indicado abaixo, e RETORNE normalmente. Você não decide nem tenta contornar — só documenta e para.
- Se ficar travado entre duas ações e nenhuma é obviamente segura (escopo ambíguo, decisão de produto sem base documental, risco de segurança real), NÃO adivinhe e NÃO tente perguntar — sinalize requerDecisaoHumana=true + motivoDecisaoHumana e pare.

`

// Mitigação do timeout de inferência por acúmulo de contexto (~3 min de
// silêncio derruba o turno). Manter o contexto POR TURNO pequeno.
const ECONOMIA_CONTEXTO = `ECONOMIA DE CONTEXTO (regra de desempenho — siga à risca; não é opcional):
Este agente já roda com contexto grande. Cada arquivo despejado inteiro aumenta o tempo do próximo turno de raciocínio e pode estourar o timeout de streaming (~3 min sem gerar token), interrompendo a execução. Para evitar:
- NÃO leia arquivos inteiros quando um trecho basta. Use grep dirigido ou leitura por faixa de linhas. Vale especialmente para: planos táticos (grandes), plano mestre, matriz de rastreabilidade, EXECUCAO-STATUS.md, GATE-VEREDITOS.md e diffs longos.
- NUNCA releia um arquivo/seção já lido neste turno de trabalho.
- Faça leituras/greps independentes em paralelo (um passo com várias chamadas).
- Seja decisivo: com evidência suficiente, conclua e siga.
- Na saída estruturada, cite trechos curtos, não cole arquivos inteiros.

`

// Lock em disco (mkdir atômico) que serializa escrita em docs/execucao/ e a
// janela crítica de merge entre execuções concorrentes. A lógica vive num
// script versionado — o agente só INVOCA verbatim.
const CAMINHO_LOCK_SH = `${REPO}/.claude/workflows/lib/lock.sh`
const LOCKDIR_COMPARTILHADO = `${REPO}/.claude/workflows/.locks/docs-execucao.lock`
const LOCKDIR_ONDA = `${REPO}/.claude/workflows/.locks/${onda}-run.lock`
const LOCK_ONDA_OWNER_TOKEN = `${onda}-run-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
let lockSequence = 0
let lockTokenPendente = null

function LOCK_ADQUIRIR_DOCS_COMPARTILHADOS(descricaoTrabalho) {
  if (lockTokenPendente) throw new Error('Guarda de lock anterior não foi fechada ao construir o prompt.')
  lockSequence += 1
  lockTokenPendente = `${onda}-${Date.now()}-${lockSequence}-${Math.random().toString(36).slice(2, 12)}`
  return `ANTES de ${descricaoTrabalho}, adquira o lock compartilhado que serializa escrita em docs/execucao/ e a janela crítica de merge contra outras ondas em paralelo. Rode EXATAMENTE este comando (NÃO reescreva a lógica):
\`\`\`bash
bash "${CAMINHO_LOCK_SH}" acquire "${LOCKDIR_COMPARTILHADO}" "${lockTokenPendente}"
\`\`\`
Só prossiga com ${descricaoTrabalho} se a saída for exatamente "LOCK_ACQUIRED". Se for "LOCK_TIMEOUT", NÃO execute a ação protegida: retorne falha no schema desta tarefa e inclua a linha literal "LOCK_TIMEOUT" no campo de detalhe disponível.
Na resposta estruturada, inclua obrigatoriamente \`lockAcquireOutput="LOCK_ACQUIRED"\`.

`
}

function LOCK_LIBERAR_DOCS_COMPARTILHADOS() {
  if (!lockTokenPendente) throw new Error('Nenhuma guarda de lock aberta ao construir a liberação.')
  const token = lockTokenPendente
  lockTokenPendente = null
  return `Libere o lock agora (SEMPRE após LOCK_ACQUIRED, mesmo se a ação protegida falhar — nunca retorne sem isto): \`bash "${CAMINHO_LOCK_SH}" release "${LOCKDIR_COMPARTILHADO}" "${token}"\`. Exija "LOCK_RELEASED"; outro resultado torna a tarefa falha. Cada seção crítica recebe token exclusivo, portanto retry atrasado não pode liberar aquisição posterior. Na resposta estruturada, inclua obrigatoriamente \`lockReleaseOutput="LOCK_RELEASED"\`.

`
}

function lockEstruturadoValido(resultado) {
  return resultado?.lockAcquireOutput === 'LOCK_ACQUIRED'
    && resultado?.lockReleaseOutput === 'LOCK_RELEASED'
}

async function adquirirLockOnda() {
  const resultado = await agent(
    `${SEM_INTERACAO_SINCRONA}Adquira a exclusão mútua de TODA a execução de "${onda}". Rode EXATAMENTE:
\`\`\`bash
bash "${CAMINHO_LOCK_SH}" acquire "${LOCKDIR_ONDA}" "${LOCK_ONDA_OWNER_TOKEN}" 0
\`\`\`
Não leia nem reutilize credencial persistida. Responda adquirido=true somente para a saída literal "LOCK_ACQUIRED"; para "LOCK_TIMEOUT", adquirido=false. Inclua a saída literal em "saida".`,
    {
      label: `lock-run:${onda}:adquirir`,
      schema: {
        type: 'object',
        properties: { adquirido: { type: 'boolean' }, saida: { type: 'string' } },
        required: ['adquirido', 'saida'],
      },
    }
  )
  if (resultado?.adquirido === true && resultado?.saida === 'LOCK_ACQUIRED') return true
  if (resultado?.adquirido === false && resultado?.saida === 'LOCK_TIMEOUT') return false
  throw new Error(`Saída contraditória ao adquirir lock da onda: ${JSON.stringify(resultado)}`)
}

let lockOndaLiberado = false
async function liberarLockOnda() {
  if (lockOndaLiberado) return
  const resultado = await agent(
    `${SEM_INTERACAO_SINCRONA}Libere a exclusão mútua de "${onda}". Rode EXATAMENTE: \`bash "${CAMINHO_LOCK_SH}" release "${LOCKDIR_ONDA}" "${LOCK_ONDA_OWNER_TOKEN}"\`. Responda liberado=true somente para "LOCK_RELEASED" e inclua a saída literal em "saida".`,
    {
      label: `lock-run:${onda}:liberar`,
      schema: {
        type: 'object',
        properties: { liberado: { type: 'boolean' }, saida: { type: 'string' } },
        required: ['liberado', 'saida'],
      },
    }
  )
  if (resultado?.liberado !== true || resultado?.saida !== 'LOCK_RELEASED') {
    throw new Error(`Falha ao liberar lock da onda: ${JSON.stringify(resultado)}`)
  }
  lockOndaLiberado = true
}

// MEMÓRIA DE PROGRESSO RETOMÁVEL (anti-loop de heartbeat): checkpoint em disco
// que o agente LÊ no início (retoma do primeiro passo pendente) e APENDA a cada
// passo. Fica sob .locks/ (git-ignored, fora do worktree).
const DIR_LOCKS = `${REPO}/.claude/workflows/.locks`
function MEMORIA_PROGRESSO(etapa) {
  const checkpoint = `${DIR_LOCKS}/progresso-${onda}-${etapa}.md`
  return `MEMÓRIA DE PROGRESSO (regra anti-reinício — siga à risca):
Esta etapa é longa e pode ser reiniciada pelo ambiente a qualquer momento (timeout de streaming). Para que um reinício RETOME em vez de refazer tudo, mantenha um checkpoint em \`${checkpoint}\` (fora do worktree, não commite):
1. PRIMEIRA AÇÃO: leia o checkpoint (\`cat "${checkpoint}"\` — pode não existir; \`mkdir -p "${DIR_LOCKS}"\` se precisar). Se já tiver passos registrados, você está RETOMANDO: NÃO refaça o que está anotado. Confirme o estado real (git status/log no worktree ../AlphaCarnes-${onda}, \`gh pr list --head <branch>\`, arquivos criados) e continue do PRIMEIRO passo pendente.
2. Trabalhe em PASSOS CURTOS. Após CADA passo significativo (setup, cada arquivo, migration aplicada, testes rodados, PR aberto), APENDE: \`echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — <passo concluído>" >> "${checkpoint}"\`.
3. NÃO releia arquivos já lidos; não acumule leituras para um único raciocínio longo no fim.

`
}

// Qualquer saída depois que um agente escreveu em docs/execucao/ precisa avisar
// que há mudanças não commitadas — o commit só acontece no passo final do merge.
const AVISO_DOCS_NAO_COMMITADOS =
  `ATENÇÃO: há veredito/status/plano editado e NÃO COMMITADO em docs/execucao/ no working tree do repo principal (${REPO}). Revise e commite (ou descarte) manualmente.`
let docsSujos = false

// Trilha de auditoria completa do ciclo (payloads estruturados de cada etapa).
const trilha = []
let seqTrilha = 0
function registrar(etapa, dados) {
  trilha.push({ seq: ++seqTrilha, etapa, ...dados })
}

function resultadoFinal(payload) {
  const base = { onda, ...payload, trilha }
  if (docsSujos) base.avisos = AVISO_DOCS_NAO_COMMITADOS
  return base
}

// Retry explícito com teto e log por tentativa (contra timeout de heartbeat e
// erro terminal de API). Cada tentativa é independente.
const MAX_TENTATIVAS_BLOCO = Number(parsedArgs?.maxTentativas) > 0 ? Math.floor(Number(parsedArgs.maxTentativas)) : 5

// Retry adaptativo por CADÊNCIA: o watchdog mata por SILÊNCIO (>~3 min sem
// token), não por tempo total. A diretiva NÃO manda ler menos — manda trabalhar
// em passos curtos, emitindo progresso.
function diretivaRetry(tentativa) {
  return `\n\nATENÇÃO — RE-TENTATIVA ${tentativa}: a anterior NÃO falhou por falta de tempo nem escopo — um turno ficou em silêncio >~3 min e foi interrompido. NÃO reduza a profundidade da auditoria. O que muda é a CADÊNCIA: passos curtos e frequentes — UMA verificação (um grep, uma leitura dirigida), registre a conclusão parcial, e só então a próxima; não acumule leituras para sintetizar num único raciocínio longo no fim.`
}

async function agentComRetry(prompt, opts, contextoLog) {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_BLOCO; tentativa++) {
    log(`[retry ${tentativa}/${MAX_TENTATIVAS_BLOCO}] ${contextoLog}`)
    const promptTentativa = tentativa > 1 ? `${prompt}${diretivaRetry(tentativa)}` : prompt
    const optsTentativa = { ...opts, label: `${opts.label}:t${tentativa}` }
    let resultado = null
    try {
      resultado = await agent(promptTentativa, optsTentativa)
    } catch (e) {
      log(`[retry ${tentativa}/${MAX_TENTATIVAS_BLOCO}] ${contextoLog} — exceção (${e?.message || e}); tratada como tentativa falha.`)
      resultado = null
    }
    if (resultado !== null && resultado !== undefined) {
      if (tentativa > 1) log(`[retry] ${contextoLog} — sucesso após ${tentativa} tentativa(s).`)
      return resultado
    }
    log(`[retry ${tentativa}/${MAX_TENTATIVAS_BLOCO}] ${contextoLog} — retorno vazio; ${tentativa < MAX_TENTATIVAS_BLOCO ? 'próxima tentativa com diretiva de cadência' : 'TETO atingido — bloco falho'}.`)
  }
  return null
}

// ---------------------------------------------------------------------------
// Fase 1 — Pré-condição
// ---------------------------------------------------------------------------
const lockOndaOk = await adquirirLockOnda()
if (!lockOndaOk) {
  log(`Já existe uma execução ativa ou um lock órfão não recuperado para ${onda}. Abortando sem ler/alterar estado.`)
  return resultadoFinal({ resultado: 'run-concorrente-ativo', etapa: 'lock-onda' })
}

try {
phase('Pré-condição')
log(`Verificando pré-condições para a ${onda}...`)

const precondicao = await agent(
  `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você vai checar as pré-condições para disparar a onda "${onda}" do roadmap v1.1 do AlphaCarnes (repo ${REPO}). NÃO dispare nada, NÃO edite nada — só leia e reporte.

Leia (de forma dirigida — greps/faixas de linha, não arquivos inteiros):
1. docs/execucao/EXECUCAO-STATUS.md — status atual da onda "${onda}" na tabela e o status de TODAS as ondas de que ela depende (coluna "Depende de").
2. docs/execucao/GATE-VEREDITOS.md — procure a linha mais recente com a onda "${onda}" no portão 1. Pode NÃO existir — normal (o Portão 1 será rodado por este ciclo).
3. O plano tático da onda: procure docs/superpowers/plans/*${onda}*.md (glob). Se NÃO existir plano tático, a onda NÃO está pronta (o plano é pré-requisito deste ciclo — ele não planeja, só executa o rito).

Grafo de dependências das ondas (orientativo; a coluna "Depende de" do EXECUCAO-STATUS.md prevalece): 0 -> 1 -> 2 -> 3 -> {4,5} -> 6 -> 7 -> {8,9} -> 10. Onda 6 depende de 4 E 5; onda 10 depende de 8 E 9.

Responda em JSON estruturado com:
- pronta: true/false — true SOMENTE SE: (a) o status atual desta onda é "aguardando_portao1" ou "plano_aprovado", OU já existe veredito "aprovado" de Portão 1 para ela como veredito mais recente${readotarOrfas ? ', OU o status é "implementando"/"aguardando_portao2" (RE-ADOÇÃO DE ÓRFÃ habilitada — retomada de run cortado)' : ''}; E (b) toda onda da qual ela depende está "mergeada"; E (c) ${readotarOrfas ? 'o status "mergeada" continua barrando (já concluída); "implementando"/"aguardando_portao2" são aceitáveis (retomada do checkpoint).' : 'o status atual NÃO é "implementando" nem "mergeada" nem "aguardando_portao2".'}; E (d) o plano tático existe.
- portao1JaAprovado: true SOMENTE SE existe veredito "aprovado" de Portão 1 para esta onda, sem condição pendente, sendo o mais recente dela.
- planoPath: caminho do plano tático encontrado.
- motivo: explique citando os status reais lidos.
- dependenciasFaltantes: array com as ondas não mergeadas de que esta depende.
- statusAtual: status atual desta onda.
- evidencia: linhas literais usadas para decidir (trilha de auditoria).`,
  {
    label: 'precondicao',
    schema: {
      type: 'object',
      properties: {
        pronta: { type: 'boolean' },
        portao1JaAprovado: { type: 'boolean' },
        planoPath: { type: 'string' },
        motivo: { type: 'string' },
        dependenciasFaltantes: { type: 'array', items: { type: 'string' } },
        statusAtual: { type: 'string' },
        evidencia: { type: 'string' },
      },
      required: ['pronta', 'portao1JaAprovado', 'planoPath', 'motivo', 'dependenciasFaltantes', 'statusAtual', 'evidencia'],
    },
  }
)

registrar('precondicao', { saida: precondicao })

if (!precondicao || !precondicao.pronta) {
  log(`Onda ${onda} NÃO está pronta para disparo.`)
  log(`Motivo: ${precondicao ? precondicao.motivo : 'agente de pré-condição falhou'}`)
  return resultadoFinal({ resultado: 'nao-pronta', precondicao })
}

const planoPath = precondicao.planoPath
log(`Pré-condições satisfeitas para ${onda}: ${precondicao.motivo}`)

// ---------------------------------------------------------------------------
// Fase 2 — Portão 1 (pulado se veredito aprovado prévio existe)
// ---------------------------------------------------------------------------
phase('Portão 1')

let veredito1 = null
let planoCorrigido = false

if (precondicao.portao1JaAprovado) {
  veredito1 = {
    veredito: 'aprovado',
    resumo: 'Reaproveitado: veredito "aprovado" de Portão 1 já registrado em GATE-VEREDITOS.md. Não re-executado para não duplicar veredito no arquivo append-only.',
    reaproveitado: true,
  }
  registrar('portao1', { rodada: 0, reaproveitado: true, saida: veredito1 })
  log(`Portão 1 de ${onda}: veredito aprovado prévio reaproveitado.`)
} else {
  // ATENÇÃO — SINCRONIA: o checklist canônico é .claude/skills/gate-plano/SKILL.md.
  // Os blocos abaixo são um ESPELHO dele. Ao editar a skill, replique aqui.
  // Decomposição em blocos paralelos de contexto pequeno (anti-timeout); nenhum
  // bloco escreve em GATE-VEREDITOS.md — a agregação é em JS (pior status vence)
  // e UM agente de contexto mínimo faz o append.
  const BLOCOS_PORTAO1 = [
    {
      id: 'fidelidade-prototipo',
      titulo: 'Constituição Princípio I — fidelidade ao protótipo (referências por tela)',
      instrucao: `Audite APENAS este item, lendo o plano ${planoPath} de forma DIRIGIDA (grep + faixas de linha):
- O plano tem a seção "Referências do protótipo" mapeando CADA tela da onda ao arquivo .tsx do protótipo (${PROTOTIPO}, branch feature/completude-v1.1)? Confira que cada arquivo citado EXISTE no protótipo (ls/glob dirigido).
- Cores/tokens citados no plano pertencem à paleta do protótipo (navy #265389, #3B7FD4, sidebar #1E3A5F->#1B4E9B, status #18A84A/#F5B019/#FC5241/#7C3AED, badge Provisório #FEF3C7/#92400E)? Hex fora da paleta sem justificativa → ajustar.
- Alterações declaradas vs. protótipo se limitam ao permitido (remoção de textos de protótipo, dados reais, discrepâncias registradas no plano mestre)? Qualquer outra → ajustar.`,
    },
    {
      id: 'completude-pendencias',
      titulo: 'Constituição Princípios II, VIII, IX — completude, pendências, terminologia',
      instrucao: `Audite APENAS estes itens, com grep dirigido no plano ${planoPath}:
- Princípio II: grep por "mínim|parcial|fase 2|simplificad|depois|posterior" — nenhuma feature pode entrar incompleta para "complementação posterior". Ocorrência real → ajustar.
- Princípio VIII: o plano fixa como regra de código alguma pendência aberta (P1–P15 do plano mestre §7)? Compare com docs/execucao/DECISOES.md (AD-01..AD-06 estão fechadas; P2, P4, P13 e P14 não são mais pendências). Pendência ainda aberta fixada → bloqueado.
- Princípio IX: grep por "[Mm]arca" como rótulo/campo/entidade — deve ser zero (exceto trechos que corrigem o termo).
- Zero placeholders: grep por "TBD|TODO|a definir|implementar depois" — qualquer ocorrência → ajustar.`,
    },
    {
      id: 'escopo-roadmap',
      titulo: 'Escopo vs. roadmap e matriz de rastreabilidade',
      instrucao: `Audite APENAS este item, com leituras dirigidas:
- docs/governance/roadmap-canonico.md §8 (linha da onda ${onda}) e docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md: TODAS as rotas/linhas da matriz atribuídas a esta onda constam no plano? Alguma coisa de onda futura entrou?
- Dependências da onda satisfeitas em docs/execucao/EXECUCAO-STATUS.md (grep pela linha de cada dependência)?`,
    },
    {
      id: 'autossuficiencia',
      titulo: 'Autossuficiência para worker de modelo inferior (formato F4c)',
      instrucao: `Audite APENAS este item, lendo o plano ${planoPath} por seções:
- Cabeçalho Goal/Architecture/Tech Stack presente; seção "Decisões de design (fixadas)"; "Estrutura de arquivos"; "Mapa DoD → teste (1:1)"; tasks numeradas com CÓDIGO LITERAL (blocos de código reais, não descrições "criar o service X"); comandos com saída esperada; passos de commit.
- Pergunta-guia: um worker que só lê este plano executa sem decidir NADA? Se algum passo exigiria decisão dele → ajustar (cite o passo).`,
    },
    {
      id: 'consistencia-cruzada',
      titulo: 'Consistência cruzada com plano mestre e ondas vizinhas',
      instrucao: `Audite APENAS este item, com grep pelo símbolo específico (NÃO varra o código):
- Nomes de tabelas/endpoints/eventos que este plano declara criar/consumir batem literalmente com o plano mestre (docs/superpowers/plans/2026-07-22-implementacao-completa-prototipo-v1.1.md §3–§4) e com os planos de ondas já aprovadas que ele cita. Divergência de nome → ajustar.`,
    },
  ]

  const SCHEMA_BLOCO = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['aprovado', 'ajustar', 'bloqueado'] },
      feedback: { type: 'string', description: 'Se ajustar/bloqueado: o que corrigir no plano, objetivo e acionável. Vazio se aprovado.' },
      evidencia: { type: 'string', description: 'Trilha: item a item, citando seção/linha que sustenta cada conclusão.' },
    },
    required: ['status', 'feedback', 'evidencia'],
  }

  async function auditarPortao1(rodadaPlano) {
    const resultados = await parallel(
      BLOCOS_PORTAO1.map((bloco) => () =>
        agentComRetry(
          `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você é um auditor de Portão 1 (plano) da onda "${onda}" do AlphaCarnes (repo ${REPO}). Você audita SOMENTE um bloco do checklist — os outros são cobertos por auditores paralelos; NÃO saia do seu bloco.

BLOCO: ${bloco.titulo}

${bloco.instrucao}

NÃO edite nada e NÃO escreva em GATE-VEREDITOS.md — a escrita é de outro agente. Retorne o achado estruturado:
- status: "aprovado" se todos os itens do bloco passam; "ajustar" se algo precisa de correção objetiva; "bloqueado" para violação de princípio NÃO-NEGOCIÁVEL, decisão de produto sem base documental, ou dependência não satisfeita. Em dúvida entre aprovado e ajustar → ajustar.
- feedback: se != aprovado, lista objetiva e acionável (um worker corrige usando só isto). Vazio se aprovado.
- evidencia: item a item com seção/linha que sustenta cada conclusão.`,
          {
            label: `portao1:${onda}:r${rodadaPlano}:${bloco.id}`,
            phase: 'Portão 1',
            schema: SCHEMA_BLOCO,
          },
          `Portão 1 r${rodadaPlano} bloco "${bloco.id}" (${onda})`
        )
      )
    )

    if (resultados.some((r) => !r)) return null

    const blocos = BLOCOS_PORTAO1.map((b, i) => ({ titulo: b.titulo, ...resultados[i] }))
    registrar('portao1-blocos', { rodada: rodadaPlano, blocos })

    const veredito = blocos.some((b) => b.status === 'bloqueado')
      ? 'bloqueado'
      : blocos.some((b) => b.status === 'ajustar')
        ? 'ajustar'
        : 'aprovado'

    const naoAprovados = blocos.filter((b) => b.status !== 'aprovado')
    const feedback = naoAprovados.map((b) => `[${b.titulo}] ${b.feedback}`).join('\n')
    const evidenciaChecada = blocos.map((b) => `[${b.titulo}] (${b.status}) ${b.evidencia}`).join('\n\n')
    const resumo = `Portão 1 decomposto: ${blocos.map((b) => `${b.id}=${b.status}`).join('; ')}.`

    // Escrita serializada, contexto mínimo, sem retry. O rastro é parte do
    // gate: falha de lock/escrita aborta fechado logo abaixo.
    const escrita = await agent(
      `${SEM_INTERACAO_SINCRONA}${LOCK_ADQUIRIR_DOCS_COMPARTILHADOS('anexar o veredito')}Anexe UMA linha na tabela de docs/execucao/GATE-VEREDITOS.md (repo ${REPO}), no formato da tabela existente (leia só o cabeçalho para copiar o formato). Timestamp via \`date -u +%Y-%m-%dT%H:%M:%SZ\`. A linha:
| <timestamp> | ${onda} | 1 | ${veredito} | ${evidenciaChecada.replace(/\n+/g, ' ').replace(/\|/g, '/').slice(0, 700)} | ${(feedback || '—').replace(/\n+/g, ' ').replace(/\|/g, '/').slice(0, 500)} |

NÃO edite mais nada. NÃO commite. ${LOCK_LIBERAR_DOCS_COMPARTILHADOS()}Responda estruturado com ok=true/false e a linha anexada em "linha".`,
      {
        label: `portao1:${onda}:r${rodadaPlano}:escrever-veredito`,
        phase: 'Portão 1',
        effort: 'low',
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            linha: { type: 'string' },
            lockAcquireOutput: { type: 'string' },
            lockReleaseOutput: { type: 'string' },
          },
          required: ['ok', 'linha', 'lockAcquireOutput', 'lockReleaseOutput'],
        },
      }
    )
    registrar('portao1-escrita', { rodada: rodadaPlano, saida: escrita })
    if (!escrita || escrita.ok !== true || !lockEstruturadoValido(escrita)) {
      log(`Registro do Portão 1 falhou fechado: ${escrita ? escrita.linha : 'agente sem resposta'}.`)
      return null
    }

    return { veredito, resumo, feedback, evidenciaChecada }
  }

  const MAX_RODADAS_PLANO = 1
  let rodadaPlano = 0

  while (true) {
    veredito1 = await auditarPortao1(rodadaPlano)

    if (!veredito1) {
      log(`Portão 1 de ${onda} falhou ao executar (rodada ${rodadaPlano}).`)
      return resultadoFinal({ resultado: 'portao1-falhou-execucao', rodadaPlano })
    }

    docsSujos = true
    registrar('portao1', { rodada: rodadaPlano, saida: veredito1 })

    if (veredito1.veredito === 'aprovado') break

    if (veredito1.veredito === 'bloqueado') {
      log(`Portão 1 BLOQUEOU a onda ${onda}: ${veredito1.resumo}`)
      return resultadoFinal({ resultado: 'portao1-bloqueado', veredito1 })
    }

    // 'ajustar'
    if (rodadaPlano >= MAX_RODADAS_PLANO) {
      log(`Portão 1 pediu ajuste de novo após ${MAX_RODADAS_PLANO} rodada(s) de correção — escalando ao humano.`)
      return resultadoFinal({ resultado: 'portao1-ajustar', veredito1, rodadaPlano })
    }

    rodadaPlano++
    log(`Portão 1 pediu ajuste no plano de ${onda} (rodada ${rodadaPlano}/${MAX_RODADAS_PLANO}). Corrigindo...`)

    const correcaoPlano = await agent(
      `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você vai corrigir o plano ${planoPath} do AlphaCarnes (repo ${REPO}). O Monitor auditou (Portão 1) e pediu ajuste. Feedback (corrija EXATAMENTE isto, nada além):

${veredito1.feedback || veredito1.resumo}

Regras:
- Edite SOMENTE ${planoPath}. NÃO commite, NÃO faça push.
- NÃO altere decisões de produto/arquitetura por conta própria: se o feedback exigir decisão sem base documental (constituição, plano mestre, matriz, DECISOES.md), marque requerDecisaoHumana=true, explique, e pare sem editar esse ponto.
- Responda estruturado: resumo do que mudou + lista de seções editadas.`,
      {
        label: `correcao-plano:${onda}:r${rodadaPlano}`,
        phase: 'Portão 1',
        schema: {
          type: 'object',
          properties: {
            resumo: { type: 'string' },
            secoesEditadas: { type: 'array', items: { type: 'string' } },
            requerDecisaoHumana: { type: 'boolean' },
            motivoDecisaoHumana: { type: 'string' },
          },
          required: ['resumo', 'secoesEditadas', 'requerDecisaoHumana'],
        },
      }
    )

    registrar('correcao-plano', { rodada: rodadaPlano, saida: correcaoPlano })

    if (!correcaoPlano) {
      log(`Agente de correção de plano falhou para ${onda}.`)
      return resultadoFinal({ resultado: 'correcao-plano-falhou', veredito1, rodadaPlano })
    }
    if (correcaoPlano.requerDecisaoHumana) {
      log(`Correção de plano sinalizou decisão humana: ${correcaoPlano.motivoDecisaoHumana}`)
      return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'correcao-plano', veredito1, correcaoPlano })
    }

    planoCorrigido = true
    log(`Plano de ${onda} corrigido (${correcaoPlano.resumo}). Re-submetendo ao Portão 1...`)
  }
}

log(`Portão 1 aprovado para ${onda}. Marcando status "implementando"...`)

// ---------------------------------------------------------------------------
// Fase 3 — Implementação
// ---------------------------------------------------------------------------
phase('Implementação')

// Trava anti-duplo-disparo + rastro de retomada. Falha aqui aborta fechado:
// executar sem transição de estado permitiria um segundo disparo concorrente.
const statusImplementando = await agent(
  `${SEM_INTERACAO_SINCRONA}${LOCK_ADQUIRIR_DOCS_COMPARTILHADOS('editar o status')}Edite docs/execucao/EXECUCAO-STATUS.md (repo ${REPO}): na tabela de ondas, mude o status da onda "${onda}" para \`implementando\` e acrescente na coluna Observações "(ciclo autônomo, worktree ../AlphaCarnes-${onda})". Não mude NADA além. NÃO commite. ${LOCK_LIBERAR_DOCS_COMPARTILHADOS()}Responda estruturado: ok=true/false, linha editada em "detalhe".`,
  {
    label: 'marcar-status:implementando',
    phase: 'Implementação',
    effort: 'low',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        detalhe: { type: 'string' },
        lockAcquireOutput: { type: 'string' },
        lockReleaseOutput: { type: 'string' },
      },
      required: ['ok', 'detalhe', 'lockAcquireOutput', 'lockReleaseOutput'],
    },
  }
)
registrar('marcar-status', { status: 'implementando', saida: statusImplementando })
if (statusImplementando?.ok === true && lockEstruturadoValido(statusImplementando)) {
  docsSujos = true
} else {
  log(`Não marquei "implementando" (${statusImplementando ? statusImplementando.detalhe : 'agente falhou'}). Abortando fechado.`)
  return resultadoFinal({ resultado: 'estado-vivo-falhou', etapa: 'marcar-implementando', statusImplementando })
}

// Eco do plano: força o agente a articular o entendimento antes de tocar em
// qualquer arquivo (branch real do cabeçalho, arquivos, ordem, DoD).
const ecoPlano = await agent(
  `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Antes de escrever qualquer código, leia ${planoPath} (repo ${REPO}). NÃO edite nada — etapa só de compreensão. Leia por seções (cabeçalho, Estrutura de arquivos, Mapa DoD→teste, tasks) em vez de despejar o arquivo inteiro.

Responda estruturado:
- branch: o nome EXATO da branch declarado no plano (padrão feature/${onda}-<slug>). Copie literalmente — NÃO derive.
- arquivosATocar: lista de arquivos que vai criar/modificar, CADA item citando a task de origem ("caminho — Task N"). Não liste arquivo que o plano não menciona.
- ordemPassos: resumo da ordem de execução (mapeando às tasks).
- criteriosAceite: resumo do Mapa DoD→teste que a implementação precisa satisfazer.
- referenciasPrototipo: lista tela→arquivo .tsx do protótipo que o plano manda seguir (Princípio I).
- riscosOuAmbiguidades: qualquer ponto ambíguo/incompleto que exigiria decisão sua. "nenhum" se não houver.
- ambiguidadeBloqueante: true SOMENTE SE algum risco é ambiguidade REAL de escopo/produto/segurança que exigiria perguntar ao usuário (não micro-decisão técnica coberta pelo plano).`,
  {
    label: `eco-plano:${onda}`,
    phase: 'Implementação',
    schema: {
      type: 'object',
      properties: {
        branch: { type: 'string' },
        arquivosATocar: { type: 'array', items: { type: 'string' } },
        ordemPassos: { type: 'string' },
        criteriosAceite: { type: 'string' },
        referenciasPrototipo: { type: 'array', items: { type: 'string' } },
        riscosOuAmbiguidades: { type: 'string' },
        ambiguidadeBloqueante: { type: 'boolean' },
      },
      required: ['branch', 'arquivosATocar', 'ordemPassos', 'criteriosAceite', 'referenciasPrototipo', 'riscosOuAmbiguidades', 'ambiguidadeBloqueante'],
    },
  }
)

registrar('eco-plano', { saida: ecoPlano })

if (
  !ecoPlano ||
  !ecoPlano.arquivosATocar?.length ||
  !ecoPlano.ordemPassos ||
  !ecoPlano.branch?.startsWith('feature/')
) {
  log(`Eco do plano de ${onda} veio vazio/incoerente — não avanço sem entendimento claro.`)
  return resultadoFinal({ resultado: 'eco-plano-incoerente', ecoPlano })
}

if (ecoPlano.ambiguidadeBloqueante) {
  log(`Eco do plano apontou ambiguidade bloqueante: ${ecoPlano.riscosOuAmbiguidades}`)
  return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'eco-plano', ecoPlano })
}

const branch = ecoPlano.branch
log(`Eco registrado: branch ${branch}, ${ecoPlano.arquivosATocar.length} arquivo(s) previstos.`)

// Worktree manual PERSISTENTE (a correção do Portão 2 e o merge voltam ao mesmo
// diretório em agentes distintos). Implementação com retry + memória de progresso.
const implementacao = await agentComRetry(
  `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}${MEMORIA_PROGRESSO('implementacao')}Você é o Worker de implementação da onda "${onda}" do AlphaCarnes. Execute o plano ${planoPath} task a task, na ordem, LITERALMENTE — você executa, não decide (o plano já decidiu tudo; se não decidiu, você PARA e reporta).

ENTENDIMENTO PRODUZIDO NA ETAPA ANTERIOR (valide contra o plano; divergência → o plano prevalece e você reporta em divergenciasReportadas):
- Branch: ${branch}
- Arquivos previstos: ${ecoPlano.arquivosATocar.join(', ')}
- Ordem: ${ecoPlano.ordemPassos}
- DoD→teste: ${ecoPlano.criteriosAceite}
- Referências do protótipo (Princípio I — leia o .tsx do protótipo ANTES de escrever cada tela): ${ecoPlano.referenciasPrototipo.join(', ') || 'nenhuma tela nesta onda'}

INSTRUÇÕES DE ORQUESTRAÇÃO:
- Worktree isolado: git -C ${REPO} fetch origin && git -C ${REPO} worktree add ../AlphaCarnes-${onda} -b ${branch} origin/develop (se a branch/worktree já existir, reutilize — você pode estar RETOMANDO).
- Siga TDD conforme o plano; rode o "Gate local completo" do plano antes de abrir o PR.
- Abra o PR ${branch} -> develop com o template .github/pull_request_template.md preenchido e o relatório no formato de docs/governance/pipeline-execucao.md §7 (inclui screenshots por tela quando a onda tem UI).
- NÃO faça merge.
- Se o plano tiver ambiguidade real de escopo/produto, ou um old_string não casar, ou um teste falhar após 1 correção: NÃO adivinhe/contorne. requerDecisaoHumana=true + motivoDecisaoHumana e pare (código parcial commitado no worktree é aceitável, sem abrir PR).
- Responda estruturado: prNumero, branch, commits (SHAs), testesLocais, resumo — trilha de auditoria.`,
  {
    label: `implementacao:${onda}`,
    schema: {
      type: 'object',
      properties: {
        prNumero: { type: 'number' },
        branch: { type: 'string' },
        commits: { type: 'array', items: { type: 'string' } },
        testesLocais: { type: 'string' },
        resumo: { type: 'string' },
        divergenciasReportadas: { type: 'string' },
        requerDecisaoHumana: { type: 'boolean' },
        motivoDecisaoHumana: { type: 'string' },
      },
      required: ['resumo', 'requerDecisaoHumana'],
    },
  },
  `implementação (${onda})`
)

registrar('implementacao', { branch, saida: implementacao })

if (implementacao && implementacao.requerDecisaoHumana) {
  log(`Implementação de ${onda} sinalizou decisão humana: ${implementacao.motivoDecisaoHumana}`)
  return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'implementacao', implementacao })
}

if (!implementacao || !implementacao.prNumero) {
  log(`Implementação de ${onda} não produziu PR válido.`)
  return resultadoFinal({ resultado: 'implementacao-falhou', implementacao })
}

const prNumero = implementacao.prNumero
log(`PR #${prNumero} aberto para ${onda} (branch ${branch}). Marcando "aguardando_portao2"...`)

const statusAguardando = await agent(
  `${SEM_INTERACAO_SINCRONA}${LOCK_ADQUIRIR_DOCS_COMPARTILHADOS('editar o status')}Edite docs/execucao/EXECUCAO-STATUS.md (repo ${REPO}): mude o status da onda "${onda}" para \`aguardando_portao2\` e registre "PR #${prNumero}" na coluna PR. Nada além. NÃO commite. ${LOCK_LIBERAR_DOCS_COMPARTILHADOS()}Responda estruturado: ok, detalhe.`,
  {
    label: 'marcar-status:aguardando-portao2',
    phase: 'Implementação',
    effort: 'low',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        detalhe: { type: 'string' },
        lockAcquireOutput: { type: 'string' },
        lockReleaseOutput: { type: 'string' },
      },
      required: ['ok', 'detalhe', 'lockAcquireOutput', 'lockReleaseOutput'],
    },
  }
)
registrar('marcar-status', { status: 'aguardando_portao2', saida: statusAguardando })
if (statusAguardando?.ok === true && lockEstruturadoValido(statusAguardando)) {
  docsSujos = true
} else {
  log(`Não marquei "aguardando_portao2" (${statusAguardando ? statusAguardando.detalhe : 'agente falhou'}). Abortando fechado.`)
  return resultadoFinal({ resultado: 'estado-vivo-falhou', etapa: 'marcar-aguardando-portao2', prNumero, statusAguardando })
}

// ---------------------------------------------------------------------------
// Fases 4 e 5 — Portão 2 + Verificação Adversarial
// (loop externo: 1 reinício completo se refutação adversarial corrigível)
// ---------------------------------------------------------------------------
phase('Portão 2')

// ATENÇÃO — SINCRONIA: checklist canônico em .claude/skills/gate-pr/SKILL.md.
// Os blocos de auditarPortao2 são espelho — ao editar a skill, replique.

// O CI leva minutos; PR recém-aberto está "pending" — esperar antes de auditar.
async function aguardarCi(contexto) {
  const ci = await agent(
    `${SEM_INTERACAO_SINCRONA}Aguarde a conclusão dos checks de CI do PR #${prNumero} do repo ${REPO} (contexto: ${contexto}). Rode: gh pr checks ${prNumero} --watch (timeout generoso, ~25 min — o test-backend sobe Postgres). Se após isso houver check obrigatório pending, pare e reporte. NÃO corrija nada.

Responda estruturado:
- ciVerde: true SOMENTE SE os oito checks canônicos CONCLUÍRAM com sucesso (jobs: lint, type-check, test-backend, coverage, test-frontend, build, audit, secret-scan). Consulte o diff: Vercel é obrigatório somente quando houver arquivo em landing/**; fora desse escopo, ignore o status Vercel.
- checks: array "nome: estado-final".
- detalhe: observações.`,
    {
      label: `aguardar-ci:${contexto}`,
      phase: 'Portão 2',
      effort: 'low',
      schema: {
        type: 'object',
        properties: {
          ciVerde: { type: 'boolean' },
          checks: { type: 'array', items: { type: 'string' } },
          detalhe: { type: 'string' },
        },
        required: ['ciVerde', 'checks', 'detalhe'],
      },
    }
  )
  registrar('aguardar-ci', { contexto, saida: ci })
  if (ci) log(`CI do PR #${prNumero} (${contexto}): ${ci.ciVerde ? 'verde' : `NÃO verde — ${ci.detalhe}`}`)
  return ci
}

const MAX_RODADAS_CORRECAO = 2
const MAX_CORRECOES_ADVERSARIAL = 1
let veredito2 = null
let adversarial = null
let shaAuditado = null
let cicloAuditoria = 0

const SCHEMA_BLOCO_P2 = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['aprovado', 'ajustar', 'bloqueado'] },
    feedback: { type: 'string' },
    evidencia: { type: 'string' },
  },
  required: ['status', 'feedback', 'evidencia'],
}

async function auditarPortao2(cicloAuditoria, rodadaCorrecao) {
  const tag = `c${cicloAuditoria}r${rodadaCorrecao}`

  // Bloco 1 — CI + sincronia com develop + captura do SHA auditado.
  const ciSync = await agentComRetry(
    `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você audita SOMENTE CI + sincronia de branch do PR #${prNumero} (onda "${onda}", branch ${branch}) do AlphaCarnes (repo ${REPO}). Verifique por comando — não confie em relato. NÃO edite nada, NÃO escreva em GATE-VEREDITOS.md.

1. PIN ANTES DO CI: capture \`headAntes=$(gh pr view ${prNumero} --json headRefOid --jq .headRefOid)\`.
2. CI: gh pr checks ${prNumero} → os 8 jobs canônicos (lint, type-check, test-backend, coverage, test-frontend, build, audit, secret-scan) verdes. Consulte os arquivos do PR: Vercel é obrigatório somente se houver arquivo em landing/**; fora desse escopo, ignore o status Vercel. Pending obrigatório → aguarde com --watch.
3. PIN DEPOIS DO CI: capture novamente headRefOid e exija igualdade EXATA com \`headAntes\`. Mudou durante a espera → "bloqueado"; não associe checks antigos ao SHA novo.
4. Sincronia dos objetos fixos: git -C ${REPO} fetch origin; capture \`baseOid=$(git -C ${REPO} rev-parse origin/develop)\`; exija \`git -C ${REPO} rev-parse origin/${branch}\` igual a \`headAntes\` e \`git -C ${REPO} merge-base --is-ancestor "$baseOid" "$headAntes"\`. Qualquer falha → "bloqueado".
5. Retorne \`headAntes\` como headRefOid e \`baseOid\` como baseRefOid, ambos completos. Evidência deve mostrar os dois pins do head iguais, o pin da base e os checks.

Retorne estruturado: status, feedback, evidencia (comandos+outputs), headRefOid, baseRefOid.`,
    {
      label: `portao2:${onda}:${tag}:ci-sync`,
      phase: 'Portão 2',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['aprovado', 'ajustar', 'bloqueado'] },
          feedback: { type: 'string' },
          evidencia: { type: 'string' },
          headRefOid: { type: 'string' },
          baseRefOid: { type: 'string' },
        },
        required: ['status', 'feedback', 'evidencia', 'headRefOid', 'baseRefOid'],
      },
    },
    `Portão 2 ${tag} bloco "ci-sync" (${onda}, PR #${prNumero})`
  )

  // Blocos 2, 3 e 4 — paralelos (mesmo head; correções só entram entre rodadas).
  const [diffEscopo, dodRa, fidelidade] = await parallel([
    () =>
      agentComRetry(
        `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você audita SOMENTE "diff vs plano" do PR #${prNumero} (onda "${onda}", branch ${branch}) do AlphaCarnes (repo ${REPO}). NÃO edite nada, NÃO escreva em GATE-VEREDITOS.md.

Leia o plano fixo com \`git -C ${REPO} show ${ciSync.headRefOid}:${planoPath}\` (Estrutura de arquivos + tasks, por faixa) e rode:
- git -C ${REPO} diff ${ciSync.baseRefOid}...${ciSync.headRefOid} --stat, depois arquivos-chave dos mesmos objetos (nunca refs simbólicos). Verifique: (a) toda task do plano presente; (b) NADA fora do escopo; (c) migrations batem com o plano; (d) schemas/DTOs com os nomes exatos.

Em dúvida → ajustar. Retorne estruturado: status, feedback, evidencia.`,
        { label: `portao2:${onda}:${tag}:diff-escopo`, phase: 'Portão 2', schema: SCHEMA_BLOCO_P2 },
        `Portão 2 ${tag} bloco "diff-escopo" (${onda})`
      ),
    () =>
      agentComRetry(
        `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você audita SOMENTE "Mapa DoD→teste + RA-01..06 + segurança" do PR #${prNumero} (onda "${onda}", branch ${branch}) do AlphaCarnes (repo ${REPO}). NÃO edite nada, NÃO escreva em GATE-VEREDITOS.md.

Leia só o "Mapa DoD → teste" do plano fixo via \`git -C ${REPO} show ${ciSync.headRefOid}:${planoPath}\` e rode você mesmo sobre o objeto ${ciSync.headRefOid}:
- Cada invariante do mapa: localize o teste no diff (grep pelo nome) e LEIA a asserção — ela falharia se a regra fosse violada? Teste superficial → ajustar.
- RA-01: grep no diff do frontend por lógica de decisão (saldo, bloqueio, cálculo crítico) — deve estar no backend.
- RA-02: mutações críticas dentro de db.transaction + auditoria no mesmo escopo.
- RA-04: eventos pós-commit; nenhum setInterval/polling novo.
- RA-05/06: nenhum success mascarando erro; falha externa com log + status explícito.
- RBAC: endpoints novos com @RequirePermissoes + teste de 403.
- Segredos: git -C ${REPO} diff ${ciSync.baseRefOid}...${ciSync.headRefOid} | grep -iE "senha|password|secret|api[_-]?key" → nada em texto claro.

Segredo em claro ou RA violada estruturalmente → bloqueado. Em dúvida → ajustar. Retorne estruturado: status, feedback, evidencia.`,
        { label: `portao2:${onda}:${tag}:dod-ra`, phase: 'Portão 2', schema: SCHEMA_BLOCO_P2 },
        `Portão 2 ${tag} bloco "dod-ra" (${onda})`
      ),
    () =>
      agentComRetry(
        `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você audita SOMENTE "fidelidade ao protótipo (Princípio I da constituição — NÃO-NEGOCIÁVEL)" do PR #${prNumero} (onda "${onda}", branch ${branch}) do AlphaCarnes (repo ${REPO}). NÃO edite nada, NÃO escreva em GATE-VEREDITOS.md. Se a onda não tem telas (só backend), retorne "aprovado" com evidencia "onda sem UI".

Leia a seção "Referências do protótipo" do plano fixo via \`git -C ${REPO} show ${ciSync.headRefOid}:${planoPath}\` e, para CADA tela do objeto ${ciSync.headRefOid}:
- Abra o .tsx correspondente do protótipo (${PROTOTIPO}, branch feature/completude-v1.1) e o arquivo da tela no diff. Compare ESTRUTURA: seções, abas, modais, botões, rótulos, estados visuais, fluxo. Divergência não autorizada pelo plano → ajustar ("ficou melhor" NÃO aprova; fiel é o critério).
- Grep no diff por cores hex fora dos tokens do DS/paleta do protótipo (#265389 #1E4070 #3B7FD4 #E8EEF5 #F5F7FA #1A2332 #64748B #94A3B8 #18A84A #F5B019 #FC5241 #7C3AED #1E3A5F #1B4E9B #2563EB #1844B8 #FEF3C7 #92400E e tokens var(--...)) → hex avulso estranho à paleta → ajustar.
- Grep por "[Mm]arca" em rótulo/copy de UI → ajustar (Princípio IX).
- Se o PR tem screenshots Playwright, compare com a tela do protótipo.

Retorne estruturado: status, feedback (tela a tela), evidencia.`,
        { label: `portao2:${onda}:${tag}:fidelidade`, phase: 'Portão 2', schema: SCHEMA_BLOCO_P2 },
        `Portão 2 ${tag} bloco "fidelidade" (${onda})`
      ),
  ])

  if (!ciSync || !diffEscopo || !dodRa || !fidelidade) return null

  const blocos = [
    { titulo: 'CI + sincronia (develop)', ...ciSync },
    { titulo: 'diff vs plano', ...diffEscopo },
    { titulo: 'DoD→teste + RA-01..06 + segurança', ...dodRa },
    { titulo: 'fidelidade ao protótipo (Princípio I)', ...fidelidade },
  ]
  registrar('portao2-blocos', { ciclo: cicloAuditoria, rodada: rodadaCorrecao, blocos })

  const veredito = blocos.some((b) => b.status === 'bloqueado')
    ? 'bloqueado'
    : blocos.some((b) => b.status === 'ajustar')
      ? 'ajustar'
      : 'aprovado'

  const naoAprovados = blocos.filter((b) => b.status !== 'aprovado')
  const feedback = naoAprovados.map((b) => `[${b.titulo}] ${b.feedback}`).join('\n')
  const evidenciaChecada = blocos.map((b) => `[${b.titulo}] (${b.status}) ${b.evidencia}`).join('\n\n')
  const resumo = `Portão 2 decomposto: ${blocos.map((b) => `${b.titulo}=${b.status}`).join('; ')}.`
  const headRefOid = ciSync.headRefOid
  const baseRefOid = ciSync.baseRefOid

  const escrita = await agent(
    `${SEM_INTERACAO_SINCRONA}${LOCK_ADQUIRIR_DOCS_COMPARTILHADOS('anexar o veredito')}ANTES de escrever e já DENTRO do lock: rode \`git -C ${REPO} fetch origin develop ${branch}\`; exija \`git -C ${REPO} rev-parse origin/develop\` EXATAMENTE igual a ${baseRefOid}, \`git -C ${REPO} rev-parse origin/${branch}\` EXATAMENTE igual a ${headRefOid} e \`gh pr view ${prNumero} --json headRefOid --jq .headRefOid\` EXATAMENTE igual a ${headRefOid}. Se qualquer pin mudou, NÃO anexe, libere o lock e retorne ok=false com os valores observados.

Somente com os três pins intactos, anexe UMA linha na tabela de docs/execucao/GATE-VEREDITOS.md (repo ${REPO}), formato da tabela existente. Timestamp via \`date -u +%Y-%m-%dT%H:%M:%SZ\`. A linha:
| <timestamp> | ${onda} | 2 | ${veredito} | PR #${prNumero}, base ${baseRefOid}, head ${headRefOid}: ${evidenciaChecada.replace(/\n+/g, ' ').replace(/\|/g, '/').slice(0, 560)} | ${(feedback || '—').replace(/\n+/g, ' ').replace(/\|/g, '/').slice(0, 500)} |

NÃO edite mais nada. NÃO commite. ${LOCK_LIBERAR_DOCS_COMPARTILHADOS()}Responda estruturado: ok, linha, headRevalidado e baseRevalidada com os OIDs completos observados dentro do lock.`,
    {
      label: `portao2:${onda}:${tag}:escrever-veredito`,
      phase: 'Portão 2',
      effort: 'low',
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          linha: { type: 'string' },
          lockAcquireOutput: { type: 'string' },
          lockReleaseOutput: { type: 'string' },
          headRevalidado: { type: 'string' },
          baseRevalidada: { type: 'string' },
        },
        required: [
          'ok', 'linha', 'lockAcquireOutput', 'lockReleaseOutput',
          'headRevalidado', 'baseRevalidada',
        ],
      },
    }
  )
  registrar('portao2-escrita', { ciclo: cicloAuditoria, rodada: rodadaCorrecao, saida: escrita })
  if (
    !escrita
    || escrita.ok !== true
    || !lockEstruturadoValido(escrita)
    || escrita.headRevalidado !== headRefOid
    || escrita.baseRevalidada !== baseRefOid
  ) {
    log(`Registro do Portão 2 falhou fechado: ${escrita ? escrita.linha : 'agente sem resposta'}.`)
    return null
  }

  return { veredito, resumo, feedback, headRefOid, baseRefOid, evidenciaChecada }
}

auditoria: while (true) {
  await aguardarCi(cicloAuditoria === 0 ? 'pos-abertura-do-pr' : `pos-correcao-adversarial-c${cicloAuditoria}`)

  let rodadaCorrecao = 0
  veredito2 = null
  shaAuditado = null

  while (rodadaCorrecao <= MAX_RODADAS_CORRECAO) {
    veredito2 = await auditarPortao2(cicloAuditoria, rodadaCorrecao)

    if (!veredito2) {
      log(`Portão 2 falhou ao executar (c${cicloAuditoria}r${rodadaCorrecao}) para ${onda}.`)
      return resultadoFinal({ resultado: 'portao2-falhou-execucao', prNumero, cicloAuditoria, rodadaCorrecao })
    }

    docsSujos = true
    registrar('portao2', { ciclo: cicloAuditoria, rodada: rodadaCorrecao, saida: veredito2 })

    if (veredito2.veredito === 'aprovado') {
      shaAuditado = veredito2.headRefOid
      log(`Portão 2 aprovou o PR #${prNumero} de ${onda}. SHA auditado: ${shaAuditado}`)
      break
    }

    if (veredito2.veredito === 'bloqueado') {
      log(`Portão 2 BLOQUEOU o PR #${prNumero}: ${veredito2.resumo}`)
      return resultadoFinal({ resultado: 'bloqueado-portao2', prNumero, veredito2 })
    }

    // 'ajustar'
    rodadaCorrecao++
    if (rodadaCorrecao > MAX_RODADAS_CORRECAO) {
      log(`Excedido o máximo de rodadas de correção (${MAX_RODADAS_CORRECAO}) — escalando.`)
      return resultadoFinal({ resultado: 'max-rodadas-excedido', prNumero, veredito2 })
    }

    log(`Portão 2 pediu ajuste (c${cicloAuditoria}r${rodadaCorrecao}/${MAX_RODADAS_CORRECAO}). Repassando ao worker...`)

    const correcao = await agentComRetry(
      `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}${MEMORIA_PROGRESSO(`correcao-c${cicloAuditoria}r${rodadaCorrecao}`)}Você é o worker do PR #${prNumero} da onda "${onda}" (worktree ../AlphaCarnes-${onda}, branch ${branch}). O Monitor pediu ajuste. Feedback:

${veredito2.feedback || veredito2.resumo}

Corrija exatamente o pedido, no MESMO worktree/branch (continue no PR #${prNumero}). Rode os testes localmente antes do push. Responda estruturado: resumo, commits (SHAs), testesLocais.

Feedback ambíguo ou exigindo decisão de produto → requerDecisaoHumana=true + motivo e pare sem push.`,
      {
        label: `correcao:${onda}:c${cicloAuditoria}r${rodadaCorrecao}`,
        phase: 'Portão 2',
        schema: {
          type: 'object',
          properties: {
            resumo: { type: 'string' },
            commits: { type: 'array', items: { type: 'string' } },
            testesLocais: { type: 'string' },
            requerDecisaoHumana: { type: 'boolean' },
            motivoDecisaoHumana: { type: 'string' },
          },
          required: ['resumo', 'requerDecisaoHumana'],
        },
      },
      `correção Portão 2 (${onda}, c${cicloAuditoria}r${rodadaCorrecao})`
    )

    registrar('correcao', { ciclo: cicloAuditoria, rodada: rodadaCorrecao, saida: correcao })

    if (correcao && correcao.requerDecisaoHumana) {
      log(`Correção sinalizou decisão humana: ${correcao.motivoDecisaoHumana}`)
      return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'correcao', prNumero, veredito2, correcao })
    }

    log(`Worker corrigiu: ${correcao ? correcao.resumo : 'sem resposta'}`)
    await aguardarCi(`pos-correcao-c${cicloAuditoria}r${rodadaCorrecao}`)
  }

  if (!veredito2 || veredito2.veredito !== 'aprovado') {
    return resultadoFinal({ resultado: 'portao2-nao-aprovado-apos-rodadas', prNumero, veredito2 })
  }

  // ---- Verificação Adversarial ----
  log(`Rodando verificação adversarial independente do PR #${prNumero} (ciclo ${cicloAuditoria})...`)

  adversarial = await agentComRetry(
    `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}Você é um revisor SÊNIOR e ADVERSARIAL, totalmente independente. Outro revisor (Monitor) já auditou o PR #${prNumero} da onda "${onda}" do AlphaCarnes (repo ${REPO}) e concluiu "aprovado". Você NÃO viu o raciocínio dele — tente REFUTAR esse veredito, do zero, com ceticismo real.

INDEPENDÊNCIA ESTRITA: NÃO leia docs/execucao/GATE-VEREDITOS.md antes de formar sua conclusão.

PIN DE AUDITORIA: o "aprovado" auditou o commit ${shaAuditado}. Primeiro passo: gh pr view ${prNumero} --json headRefOid — se o head atual for DIFERENTE, alguém empurrou commits pós-auditoria: refutado=true, achados="head mudou após o Portão 2 (esperado ${shaAuditado})", corrigivel=false.

Leia o plano pelo objeto auditado (\`git -C ${REPO} show ${shaAuditado}:${planoPath}\`, Mapa DoD→teste + Referências do protótipo) e rode você mesmo:
- gh pr checks ${prNumero} — todos os 8 jobs realmente verdes agora; depois repita \`gh pr view --json headRefOid\` e exija ainda ${shaAuditado}.
- git -C ${REPO} diff ${veredito2.baseRefOid}...${shaAuditado} --stat + arquivos-chave dos objetos fixos — algo fora do escopo, guardrail enfraquecido, teste superficial que não prova o que afirma.
- Rode pessoalmente ao menos 2 verificações do Mapa DoD→teste do plano.
- Se a onda tem UI: abra 1-2 telas do diff LADO A LADO com o .tsx do protótipo (${PROTOTIPO}) — divergência estrutural de layout/fluxo/rótulo é violação do Princípio I (NÃO-NEGOCIÁVEL) e refuta.
- Procure: segredos em claro, regra de negócio no frontend (RA-01), mutação crítica sem transação/auditoria (RA-02), polling (RA-04), erro engolido (RA-05), migration destrutiva, "[Mm]arca" em UI.

Padrão de decisão: refutado=false SOMENTE SE genuinamente não encontrar nada após tentar ativamente. Dúvida real → refutado=true.
Se refutar: corrigivel=true SÓ para defeitos técnicos objetivos e acionáveis (teste faltando, hex fora da paleta, arquivo fora do escopo); corrigivel=false para decisão de produto/segurança/escopo.
Achado que exige decisão humana (não bug técnico) → requerDecisaoHumana=true + motivo, preenchendo mesmo assim refutado/achados.

Responda estruturado. Em verificacoesExecutadas, liste comandos + resultado resumido.`,
    {
      label: `adversarial:${onda}:c${cicloAuditoria}`,
      phase: 'Verificação Adversarial',
      schema: {
        type: 'object',
        properties: {
          refutado: { type: 'boolean' },
          achados: { type: 'string' },
          corrigivel: { type: 'boolean' },
          verificacoesExecutadas: { type: 'array', items: { type: 'string' } },
          requerDecisaoHumana: { type: 'boolean' },
          motivoDecisaoHumana: { type: 'string' },
        },
        required: ['refutado', 'achados', 'corrigivel', 'verificacoesExecutadas', 'requerDecisaoHumana'],
      },
    },
    `verificação adversarial (${onda}, c${cicloAuditoria})`
  )

  registrar('adversarial', { ciclo: cicloAuditoria, shaAuditado, saida: adversarial })

  if (adversarial && adversarial.requerDecisaoHumana) {
    log(`Adversarial sinalizou decisão humana: ${adversarial.motivoDecisaoHumana}`)
    return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'adversarial', prNumero, veredito2, adversarial })
  }

  if (!adversarial || !adversarial.refutado) {
    if (!adversarial) {
      log('Agente adversarial falhou — tratando como refutação (não mergear sem o segundo gate).')
      return resultadoFinal({ resultado: 'refutado-por-verificacao-adversarial', prNumero, veredito2, adversarial: null })
    }
    log(`Adversarial concordou com o aprovado (ciclo ${cicloAuditoria}). Prosseguindo para o merge.`)
    break auditoria
  }

  log(`Adversarial REFUTOU o aprovado do PR #${prNumero} (ciclo ${cicloAuditoria}). Achados: ${adversarial.achados}`)

  if (adversarial.corrigivel && cicloAuditoria < MAX_CORRECOES_ADVERSARIAL) {
    cicloAuditoria++
    log(`Refutação corrigível — corrigindo e re-auditando do zero (ciclo ${cicloAuditoria}/${MAX_CORRECOES_ADVERSARIAL})...`)

    const correcaoAdversarial = await agentComRetry(
      `${SEM_INTERACAO_SINCRONA}${ECONOMIA_CONTEXTO}${MEMORIA_PROGRESSO(`correcao-adversarial-c${cicloAuditoria}`)}Você é o worker do PR #${prNumero} da onda "${onda}" (worktree ../AlphaCarnes-${onda}, branch ${branch}). Um revisor adversarial refutou a aprovação com os achados abaixo. Corrija exatamente o apontado, no MESMO worktree/branch. Achados:

${adversarial.achados}

Rode testes localmente antes do push. Responda estruturado: resumo, commits, testesLocais. Achado ambíguo/decisão de produto → requerDecisaoHumana=true e pare sem push.`,
      {
        label: `correcao-adversarial:${onda}:c${cicloAuditoria}`,
        phase: 'Verificação Adversarial',
        schema: {
          type: 'object',
          properties: {
            resumo: { type: 'string' },
            commits: { type: 'array', items: { type: 'string' } },
            testesLocais: { type: 'string' },
            requerDecisaoHumana: { type: 'boolean' },
            motivoDecisaoHumana: { type: 'string' },
          },
          required: ['resumo', 'requerDecisaoHumana'],
        },
      },
      `correção adversarial (${onda}, c${cicloAuditoria})`
    )

    registrar('correcao-adversarial', { ciclo: cicloAuditoria, saida: correcaoAdversarial })

    if (!correcaoAdversarial) {
      return resultadoFinal({ resultado: 'refutado-por-verificacao-adversarial', prNumero, veredito2, adversarial })
    }
    if (correcaoAdversarial.requerDecisaoHumana) {
      return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'correcao-adversarial', prNumero, veredito2, adversarial, correcaoAdversarial })
    }

    log(`Correção pós-refutação enviada: ${correcaoAdversarial.resumo}. Reiniciando auditoria completa...`)
    continue auditoria
  }

  return resultadoFinal({ resultado: 'refutado-por-verificacao-adversarial', prNumero, veredito2, adversarial })
}

// ---------------------------------------------------------------------------
// Fase 6 — Merge (em develop)
// ---------------------------------------------------------------------------
phase('Merge')

const merge = await agent(
  `${SEM_INTERACAO_SINCRONA}Você vai fazer o merge final do PR #${prNumero} da onda "${onda}" (branch ${branch}) do AlphaCarnes (repo ${REPO}), alvo develop. Dois revisores independentes aprovaram — você só executa. A auditoria vale para o commit ${shaAuditado}, e SOMENTE para ele.

Passos (ordem exata):

1. Verificações de segurança (SEM lock — leitura ou worktree isolado da própria onda):
   1a. gh pr view ${prNumero} --json mergeable,mergeStateStatus,headRefOid — exige MERGEABLE + CLEAN + headRefOid IGUAL a ${shaAuditado}. SHA diferente → commits pós-auditoria: PARE (requerDecisaoHumana=true; re-auditoria necessária).
   1b. git -C ${REPO} fetch origin; capture \`baseAtual=$(git -C ${REPO} rev-parse origin/develop)\` e exija igualdade EXATA com a base auditada ${veredito2.baseRefOid}. Depois exija \`git -C ${REPO} merge-base --is-ancestor "$baseAtual" "${shaAuditado}"\`. Base diferente → PARE e exija novo Portão 2; branch desatualizada → passo 1c.
   1c. AUTO-RECUPERAÇÃO, TODA no worktree ../AlphaCarnes-${onda} (NUNCA no repo principal, SEM lock):
       git -C ../AlphaCarnes-${onda} fetch origin && git -C ../AlphaCarnes-${onda} rebase origin/develop
       - Rebase limpo: rode os testes do plano no worktree; passando: git -C ../AlphaCarnes-${onda} push --force-with-lease. RE-ESPERE o CI (gh pr checks ${prNumero} --watch). Mesmo com CI verde, o HEAD mudou e as aprovações anteriores NÃO valem: PARE com requerDecisaoHumana=true e motivo "HEAD alterado para <novo SHA>; reiniciar Portão 2 + verificação adversarial". NUNCA siga ao passo 2 nesta execução.
       - Conflito, teste falho ou CI vermelho: git rebase --abort (se em rebase) e PARE — requerDecisaoHumana=true com o estado exato.
2. ADQUIRA O LOCK AGORA: ${LOCK_ADQUIRIR_DOCS_COMPARTILHADOS('mergear (squash) e tocar docs/execucao/ no repo principal')}
   2a. Re-checagem DENTRO do lock: rode \`git -C ${REPO} fetch origin\`, exija \`git -C ${REPO} rev-parse origin/develop\` EXATAMENTE igual a ${veredito2.baseRefOid}; depois \`gh pr view ${prNumero} --json mergeable,mergeStateStatus,headRefOid\` exige MERGEABLE + CLEAN + headRefOid EXATAMENTE IGUAL a ${shaAuditado}. Qualquer diferença → LIBERE O LOCK e pare com requerDecisaoHumana=true ("base, estado ou SHA mudou aguardando o lock — nova auditoria necessária").
   2b. Execute compare-and-swap: \`gh pr merge ${prNumero} --squash --delete-branch --match-head-commit ${shaAuditado}\`. Qualquer recusa impede o merge. Anote o SHA em commitSquash.
   2c. Detecte arquivos de coordenação compartilhada tocados: git -C ${REPO} diff origin/develop~1..origin/develop --name-only | grep -E "schema/index.ts$|app.module.ts$|eventos.ts$|permissoes.ts$|globals.css$" (DEPOIS do squash). Preencha arquivosCompartilhadosTocados (vazio se nenhum).
3. Remova o worktree de implementação: git -C ${REPO} worktree remove ../AlphaCarnes-${onda} --force (se existir). Falhou → reporte e SIGA.
4. A branch protection proíbe push direto em develop. Ainda DENTRO do lock, faça a atualização formal por PR de coordenação:
   4a. git -C ${REPO} fetch origin develop; crie worktree limpo ../AlphaCarnes-${onda}-estado, branch \`docs/execucao-${onda}-<shortCommitSquash>\`, a partir do novo origin/develop.
   4b. Copie a versão corrente de \`${REPO}/docs/execucao/GATE-VEREDITOS.md\` para o worktree de estado (ela contém os vereditos acumulados sob lock). No worktree de estado, atualize EXECUCAO-STATUS.md: "${onda}" → "mergeada" com PR #${prNumero} + SHA squash. Se \`planoCorrigido\`, copie também o plano corrigido.
   4c. Commit, push e abra PR de coordenação para develop. Espere os oito checks obrigatórios. Fixe base/head antes e depois do CI; exija base ainda igual ao origin/develop capturado após o squash e head intacto.
   4d. Mergeie o PR de coordenação com \`gh pr merge <prEstado> --squash --delete-branch --match-head-commit <headEstado>\`. Mudança de base/head, CI não verde ou recusa → libere o lock e pare com decisão humana; nunca faça push direto.
   4e. Remova o worktree de estado; atualize o develop local sem descartar arquivos fora de docs/execucao. Confirme que origin/develop contém a linha mergeada e os vereditos.
5. ${LOCK_LIBERAR_DOCS_COMPARTILHADOS()}

Responda estruturado. Em "verificacoes", cada comando do passo 1 (e 1c se rodou) com output literal resumido. Sempre inclua lockAcquireOutput e lockReleaseOutput: ambos "NOT_ACQUIRED" se parou antes do passo 2; se adquiriu o lock, os valores literais devem ser "LOCK_ACQUIRED" e "LOCK_RELEASED".`,
  {
    label: `merge:${onda}`,
    schema: {
      type: 'object',
      properties: {
        mergeado: { type: 'boolean' },
        commitSquash: { type: 'string' },
        prCoordenacao: { type: 'number' },
        commitEstado: { type: 'string' },
        autoRecuperacaoBranch: { type: 'boolean' },
        arquivosCompartilhadosTocados: { type: 'array', items: { type: 'string' } },
        verificacoes: { type: 'array', items: { type: 'string' } },
        detalhe: { type: 'string' },
        requerDecisaoHumana: { type: 'boolean' },
        motivoDecisaoHumana: { type: 'string' },
        lockAcquireOutput: { type: 'string' },
        lockReleaseOutput: { type: 'string' },
      },
      required: [
        'mergeado', 'detalhe', 'verificacoes', 'requerDecisaoHumana',
        'lockAcquireOutput', 'lockReleaseOutput',
      ],
    },
  }
)

registrar('merge', { shaAuditado, planoCorrigido, saida: merge })

const mergeParouAntesDoLock = merge?.mergeado === false
  && merge?.lockAcquireOutput === 'NOT_ACQUIRED'
  && merge?.lockReleaseOutput === 'NOT_ACQUIRED'
if (!merge || (!lockEstruturadoValido(merge) && !mergeParouAntesDoLock)) {
  return resultadoFinal({
    resultado: 'merge-falhou',
    etapa: 'evidencia-lock-merge',
    prNumero,
    shaAuditado,
    merge,
  })
}

if (merge && merge.requerDecisaoHumana) {
  log(`Merge do PR #${prNumero} parou por decisão humana: ${merge.motivoDecisaoHumana}`)
  return resultadoFinal({ resultado: 'requer-decisao-humana', etapa: 'merge', prNumero, shaAuditado, veredito2, adversarial, merge })
}

if (merge && merge.mergeado) {
  docsSujos = false
}

log(`Ciclo autônomo da onda ${onda} concluído. Mergeada: ${merge ? merge.mergeado : 'desconhecido'}.`)

return resultadoFinal({
  resultado: merge && merge.mergeado ? 'mergeado' : 'merge-falhou',
  prNumero,
  branch,
  shaAuditado,
  planoCorrigido,
  veredito1,
  veredito2,
  adversarial,
  merge,
})
} finally {
  await liberarLockOnda()
}
