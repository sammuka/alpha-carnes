#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^onda(?:[1-9]|10)$')]
    [string]$Wave,

    [switch]$AutoMerge,
    [switch]$AdoptOrphan,
    [switch]$DryRun,
    [switch]$AllowNonDevelopCoordinator,
    [ValidateRange(1, 5)][int]$MaxAttempts = 3,
    [string]$RuntimeRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 20 -Compress
}

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando obrigatório ausente: $Name"
    }
}

function New-FailureResult {
    param([string]$Stage, [string]$Message)
    [ordered]@{
        schemaVersion = 1
        runId = $runId
        wave = $Wave
        result = 'failed'
        stage = $Stage
        planPath = ''
        planSha256 = ''
        branch = ''
        prNumber = $null
        auditedHeadSha = ''
        squashSha = ''
        message = $Message
        roleTrace = @()
    }
}

function Get-ThreadId {
    param([string[]]$Lines)
    foreach ($line in $Lines) {
        try {
            $event = $line | ConvertFrom-Json
            if ([string]$event.type -eq 'thread.started' -and $event.thread_id) {
                return [string]$event.thread_id
            }
        } catch {
            continue
        }
    }
    ''
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $repoRoot '.codex\runtime'
}
$runtimeFull = [IO.Path]::GetFullPath($RuntimeRoot)
if (-not $runtimeFull.StartsWith(
    $repoRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "RuntimeRoot deve ficar dentro do repositório: $runtimeFull"
}

$runId = '{0}-{1}-{2}' -f (
    [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ')
), $Wave, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$schemaPath = Join-Path $repoRoot '.codex\schemas\ciclo-onda-result.schema.json'
$lockScript = Join-Path $PSScriptRoot 'lock.ps1'
$checkpointScript = Join-Path $PSScriptRoot 'checkpoint.ps1'
$runRoot = Join-Path $runtimeFull "runs\$runId"
$resultPath = Join-Path $runRoot 'result.json'
$eventsPath = Join-Path $runRoot 'events.jsonl'
$stderrPath = Join-Path $runRoot 'stderr.log'
$lockName = "orchestration-onda-$($Wave.Replace('onda', ''))"

if ($DryRun) {
    Write-Json ([ordered]@{
        status = 'dry-run'
        runId = $runId
        wave = $Wave
        autoMerge = [bool]$AutoMerge
        adoptOrphan = [bool]$AdoptOrphan
        repoRoot = $repoRoot
        runtimeRoot = $runtimeFull
        schemaPath = $schemaPath
        lockName = $lockName
        functionalContextPath = 'docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md'
        command = 'codex --ask-for-approval never exec --strict-config --json --sandbox workspace-write'
        resumeCommand = "codex --ask-for-approval never --sandbox workspace-write -C `"$repoRoot`" exec resume --strict-config --json <thread-id> <prompt>"
    })
    return
}

Assert-Command -Name 'codex'
Assert-Command -Name 'git'
Assert-Command -Name 'gh'
Assert-Command -Name 'pwsh'

$requiredPaths = @(
    'AGENTS.md',
    '.codex/config.toml',
    '.codex/agents/planner.toml',
    '.codex/agents/monitor.toml',
    '.codex/agents/executor.toml',
    '.codex/agents/worker.toml',
    '.agents/skills/gate-plano/SKILL.md',
    '.agents/skills/gate-pr/SKILL.md',
    '.agents/skills/disparar-onda/SKILL.md',
    'docs/governance/constituicao.md',
    'docs/governance/pipeline-execucao.md',
    'docs/execucao/EXECUCAO-STATUS.md',
    'docs/execucao/GATE-VEREDITOS.md',
    'docs/execucao/DECISOES.md',
    'docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md'
)
$missing = @($requiredPaths | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $repoRoot $_))
})
if ($missing.Count -gt 0) {
    throw "Pré-condição ausente: $($missing -join ', ')"
}
if (-not (Test-Path -LiteralPath 'F:\Projetos\alpha-carnes-prototipo')) {
    throw 'Protótipo obrigatório não encontrado em F:\Projetos\alpha-carnes-prototipo.'
}

$codexVersionText = codex --version
if ($codexVersionText -notmatch '(\d+)\.(\d+)\.(\d+)') {
    throw "Não foi possível ler a versão do Codex: $codexVersionText"
}
$codexVersion = [Version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
if ($codexVersion -lt [Version]'0.145.0') {
    throw "Codex >= 0.145.0 é obrigatório; encontrado $codexVersion."
}

$currentBranch = (git -C $repoRoot branch --show-current).Trim()
if (-not $AllowNonDevelopCoordinator -and $currentBranch -ne 'develop') {
    throw "O worktree coordenador deve estar em develop; atual: '$currentBranch'."
}
$dirty = @(git -C $repoRoot status --porcelain --untracked-files=normal)
if ($dirty.Count -gt 0) {
    throw "O worktree coordenador deve estar limpo. Alterações: $($dirty -join '; ')"
}
gh auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI não está autenticado.'
}

New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
$lockResult = & $lockScript acquire $lockName -Role coordinator -RunId $runId `
    -StaleAfterSeconds 21600 -MaxWaitSeconds 0 -RuntimeRoot $runtimeFull | ConvertFrom-Json
if (-not $lockResult -or $lockResult.status -ne 'acquired') {
    throw "Já existe execução ativa para $Wave."
}
$lockToken = [string]$lockResult.token

try {
    $checkpointResult = & $checkpointScript init -RunId $runId -Wave $Wave `
        -Stage orchestration -Role coordinator -Message 'Ciclo iniciado.' `
        -RuntimeRoot $runtimeFull | ConvertFrom-Json
    if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
        throw "Checkpoint init inválido: $($checkpointResult.status)."
    }

    $promptTemplate = @'
Você é somente o coordenador raiz do ciclo autônomo do AlphaCarnes. Leia AGENTS.md e não
escreva arquivos por conta própria. Processe a onda {0}, run ID {1}.

Delegue cada papel ao custom agent nominal:
1. nova instância monitor para Portão 1 usando $gate-plano;
2. se ajustar, nova instância planner corrige somente o plano e outro monitor reaudita;
3. executor prepara worktree/estado e worker implementa usando $disparar-onda;
4. nova instância monitor executa $gate-pr;
5. ajustes técnicos voltam ao worker e cada nova auditoria usa outro monitor;
6. um monitor adversarial independente forma a conclusão sem ler o veredito anterior e registra
   Portão A para o mesmo SHA;
7. executor faz merge somente se AutoMerge={2}; caso contrário retorna ready-for-merge.

AdoptOrphan={3}. Use os helpers .codex/scripts/lock.ps1, checkpoint.ps1 e visibility-ci.ps1.
Não use perguntas síncronas. Decisão humana ausente retorna requires-human. Falhe fechado.
Retorne somente o objeto final compatível com o schema fornecido, incluindo roleTrace real.
'@
    $prompt = $promptTemplate -f $Wave, $runId, ([bool]$AutoMerge).ToString().ToLowerInvariant(),
        ([bool]$AdoptOrphan).ToString().ToLowerInvariant()

    $threadId = ''
    $validResult = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $checkpointResult = & $checkpointScript record -RunId $runId -Wave $Wave -Stage orchestration `
            -StepId "attempt-$attempt" -Status started -Role coordinator `
            -Message "Tentativa Codex $attempt." -RuntimeRoot $runtimeFull | ConvertFrom-Json
        if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
            throw "Checkpoint da tentativa inválido: $($checkpointResult.status)."
        }

        if ($attempt -eq 1) {
            $arguments = @(
                '--ask-for-approval', 'never',
                'exec',
                '--strict-config',
                '--ignore-user-config',
                '--json',
                '--sandbox', 'workspace-write',
                '-c', 'sandbox_workspace_write.network_access=true',
                '--output-schema', $schemaPath,
                '--output-last-message', $resultPath,
                '-C', $repoRoot,
                '-m', 'gpt-5.6-sol',
                '-'
            )
            $eventLines = @($prompt | & codex @arguments 2>> $stderrPath)
        } else {
            if ([string]::IsNullOrWhiteSpace($threadId)) {
                break
            }
            $resumePrompt = "Retome o run $runId da $Wave pelo checkpoint; não repita passos concluídos."
            $arguments = @(
                '--ask-for-approval', 'never',
                '--sandbox', 'workspace-write',
                '-C', $repoRoot,
                'exec', 'resume',
                '--strict-config',
                '--ignore-user-config',
                '--json',
                '-c', 'sandbox_workspace_write.network_access=true',
                '--output-schema', $schemaPath,
                '--output-last-message', $resultPath,
                '-m', 'gpt-5.6-sol',
                $threadId,
                $resumePrompt
            )
            $eventLines = @(& codex @arguments 2>> $stderrPath)
        }
        Add-Content -LiteralPath $eventsPath -Encoding utf8 -Value $eventLines
        if ([string]::IsNullOrWhiteSpace($threadId)) {
            $threadId = Get-ThreadId -Lines $eventLines
        }

        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            try {
                $validResult = Get-Content -Raw -Encoding utf8 -LiteralPath $resultPath |
                    ConvertFrom-Json
            } catch {
                $validResult = $null
            }
        }
        if ($validResult) {
            break
        }
        $checkpointResult = & $checkpointScript record -RunId $runId -Wave $Wave -Stage orchestration `
            -StepId "attempt-$attempt" -Status failed -Role coordinator `
            -Message "Codex não produziu resultado estruturado; thread=$threadId." `
            -RuntimeRoot $runtimeFull | ConvertFrom-Json
        if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
            throw "Checkpoint de falha inválido: $($checkpointResult.status)."
        }
    }

    if (-not $validResult) {
        $validResult = New-FailureResult -Stage 'codex-exec' `
            -Message "Nenhum resultado estruturado após $MaxAttempts tentativa(s); thread=$threadId."
        [IO.File]::WriteAllText(
            $resultPath,
            ($validResult | ConvertTo-Json -Depth 20),
            [Text.UTF8Encoding]::new($false)
        )
    }

    $checkpointResult = & $checkpointScript complete -RunId $runId -Wave $Wave `
        -Stage orchestration -Role coordinator -Message "Resultado final: $($validResult.result)." `
        -RuntimeRoot $runtimeFull | ConvertFrom-Json
    if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
        throw "Checkpoint final inválido: $($checkpointResult.status)."
    }
    Write-Json $validResult
} finally {
    if ($lockToken) {
        $null = & $lockScript release $lockName -Token $lockToken -Role coordinator `
            -RunId $runId -RuntimeRoot $runtimeFull
    }
}
