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
$roleSchemaPath = Join-Path $repoRoot '.codex\schemas\role-result.schema.json'
$lockScript = Join-Path $PSScriptRoot 'lock.ps1'
$checkpointScript = Join-Path $PSScriptRoot 'checkpoint.ps1'
$invokeRoleScript = Join-Path $PSScriptRoot 'invoke-role.ps1'
$runRoot = Join-Path $runtimeFull "runs\$runId"
$resultPath = Join-Path $runRoot 'result.json'
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
        roleSchemaPath = $roleSchemaPath
        lockName = $lockName
        functionalContextPath = 'docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md'
        mechanism = 'PowerShell launches one independent codex exec process per role/stage'
        roleSequence = @(
            'monitor:gate1',
            'planner:plan-fix (conditional)',
            'monitor:gate1-recheck (fresh process)',
            'executor:prepare',
            'worker:implementation',
            'monitor:gate2',
            'worker:implementation-fix (conditional)',
            'monitor:gate2-recheck (fresh process)',
            'monitor:gate-a (fresh process)',
            'executor:finalize'
        )
        evidence = 'unique runtime thread.started plus turn.completed per role; no self-declared roleTrace'
        internalDelegation = 'disabled with features.multi_agent=false'
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
    '.codex/schemas/role-result.schema.json',
    '.codex/scripts/invoke-role.ps1',
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

    $roleTrace = [Collections.Generic.List[object]]::new()
    $threadIds = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )

    function Invoke-RoleStage {
        param(
            [Parameter(Mandatory)][string]$Role,
            [Parameter(Mandatory)][string]$Stage,
            [Parameter(Mandatory)][string]$Prompt
        )
        $checkpointResult = & $checkpointScript record -RunId $runId -Wave $Wave `
            -Stage orchestration -StepId "$Role-$Stage" -Status started -Role coordinator `
            -Message "Processo independente iniciado: $Role/$Stage." `
            -RuntimeRoot $runtimeFull | ConvertFrom-Json
        if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
            throw "Checkpoint inicial inválido para $Role/$Stage."
        }
        $envelope = & $invokeRoleScript -Role $Role -Stage $Stage -Wave $Wave `
            -RunId $runId -Prompt $Prompt -RuntimeRoot $runtimeFull | ConvertFrom-Json
        if ([string]$envelope.status -cne 'completed' -or
            [string]$envelope.mechanism -cne 'independent-codex-exec-process') {
            throw "Envelope inválido para $Role/$Stage."
        }
        if (-not $threadIds.Add([string]$envelope.threadId)) {
            throw "Thread reutilizada entre papéis: $($envelope.threadId)."
        }
        $roleTrace.Add([ordered]@{
            role = $Role
            stage = $Stage
            threadId = [string]$envelope.threadId
            invocationId = [string]$envelope.invocationId
            result = [string]$envelope.result.result
            summary = [string]$envelope.result.message
        })
        $checkpointResult = & $checkpointScript record -RunId $runId -Wave $Wave `
            -Stage orchestration -StepId "$Role-$Stage" -Status completed -Role coordinator `
            -Message "Processo $Role/$Stage terminou em $($envelope.result.result)." `
            -RuntimeRoot $runtimeFull | ConvertFrom-Json
        if ($checkpointResult.status -notin @('recorded', 'duplicate')) {
            throw "Checkpoint final inválido para $Role/$Stage."
        }
        $envelope.result
    }

    function New-ResultFromRole {
        param($RoleResult, [string]$ResultOverride = '', [string]$StageOverride = '')
        [ordered]@{
            schemaVersion = 1
            runId = $runId
            wave = $Wave
            result = if ($ResultOverride) { $ResultOverride } else { [string]$RoleResult.result }
            stage = if ($StageOverride) { $StageOverride } else { [string]$RoleResult.stage }
            planPath = [string]$RoleResult.planPath
            planSha256 = [string]$RoleResult.planSha256
            branch = [string]$RoleResult.branch
            prNumber = $RoleResult.prNumber
            auditedHeadSha = [string]$RoleResult.auditedHeadSha
            squashSha = [string]$RoleResult.squashSha
            message = [string]$RoleResult.message
            roleTrace = @($roleTrace)
        }
    }

    $validResult = $null
    :cycle do {
        $gate1 = Invoke-RoleStage -Role monitor -Stage gate1 -Prompt (
            'Execute $gate-plano para a onda indicada, com verificação própria. ' +
            'Registre o veredito sob lock e retorne approved, adjust, requires-human, blocked ou failed.'
        )
        $correction = 0
        while ([string]$gate1.result -ceq 'adjust' -and $correction -lt $MaxAttempts) {
            $correction++
            $planner = Invoke-RoleStage -Role planner -Stage "plan-fix-$correction" -Prompt (
                "Corrija somente os bloqueadores do último Portão 1 da $Wave. " +
                'Não implemente. Retorne completed ou um estado terminal.'
            )
            if ([string]$planner.result -ne 'completed') {
                $validResult = New-ResultFromRole -RoleResult $planner
                break cycle
            }
            $gate1 = Invoke-RoleStage -Role monitor -Stage "gate1-recheck-$correction" -Prompt (
                'Use uma auditoria nova com $gate-plano; não confie no relato do Planner. ' +
                'Registre e retorne o veredito atual.'
            )
        }
        if ([string]$gate1.result -ne 'approved') {
            $mapped = if ([string]$gate1.result -eq 'adjust') { 'not-ready' } else {
                [string]$gate1.result
            }
            $validResult = New-ResultFromRole -RoleResult $gate1 -ResultOverride $mapped
            break cycle
        }

        $prepare = Invoke-RoleStage -Role executor -Stage prepare -Prompt (
            "Prepare estado, branch e worktree da $Wave conforme `$disparar-onda. " +
            "AdoptOrphan=$([bool]$AdoptOrphan). Não implemente. Retorne ready ou estado terminal."
        )
        if ([string]$prepare.result -ne 'ready') {
            $validResult = New-ResultFromRole -RoleResult $prepare
            break cycle
        }

        $worker = Invoke-RoleStage -Role worker -Stage implementation -Prompt (
            'Implemente literalmente o plano aprovado no worktree preparado, com TDD, gate local e PR. ' +
            'Não edite estado nem faça merge. Retorne implemented ou estado terminal.'
        )
        if ([string]$worker.result -ne 'implemented') {
            $validResult = New-ResultFromRole -RoleResult $worker
            break cycle
        }

        $gate2 = Invoke-RoleStage -Role monitor -Stage gate2 -Prompt (
            'Execute $gate-pr no PR e SHA exatos produzidos pelo Worker, incluindo CI e fidelidade. ' +
            'Registre e retorne approved, adjust ou estado terminal.'
        )
        $fix = 0
        while ([string]$gate2.result -ceq 'adjust' -and $fix -lt $MaxAttempts) {
            $fix++
            $worker = Invoke-RoleStage -Role worker -Stage "implementation-fix-$fix" -Prompt (
                "Corrija somente os bloqueadores técnicos do último Portão 2 da $Wave. " +
                'Rode novamente o gate local e atualize o mesmo PR; retorne implemented.'
            )
            if ([string]$worker.result -ne 'implemented') {
                $validResult = New-ResultFromRole -RoleResult $worker
                break cycle
            }
            $gate2 = Invoke-RoleStage -Role monitor -Stage "gate2-recheck-$fix" -Prompt (
                'Faça nova auditoria $gate-pr do novo SHA; não aprove por herança. Registre o veredito.'
            )
        }
        if ([string]$gate2.result -ne 'approved') {
            $mapped = if ([string]$gate2.result -eq 'adjust') { 'not-ready' } else {
                [string]$gate2.result
            }
            $validResult = New-ResultFromRole -RoleResult $gate2 -ResultOverride $mapped
            break cycle
        }

        $gateA = Invoke-RoleStage -Role monitor -Stage gate-a -Prompt (
            'Faça revisão adversarial independente do mesmo SHA sem ler a conclusão do Portão 2 ' +
            'que está tentando refutar. Registre Portão A e retorne approved ou estado terminal.'
        )
        if ([string]$gateA.result -ne 'approved') {
            $validResult = New-ResultFromRole -RoleResult $gateA
            break cycle
        }

        $finalize = Invoke-RoleStage -Role executor -Stage finalize -Prompt (
            "Confirme Portão 2 e Portão A para o mesmo SHA. AutoMerge=$([bool]$AutoMerge). " +
            'Faça merge somente se autorizado; caso contrário retorne ready-for-merge.'
        )
        $expectedFinal = if ($AutoMerge) { 'merged' } else { 'ready-for-merge' }
        if ([string]$finalize.result -ne $expectedFinal -and
            [string]$finalize.result -notin @('requires-human', 'blocked', 'failed')) {
            $validResult = New-ResultFromRole -RoleResult $finalize -ResultOverride failed `
                -StageOverride orchestration
            $validResult.message = (
                "Executor retornou '$($finalize.result)'; esperado '$expectedFinal'."
            )
            break cycle
        }
        $validResult = New-ResultFromRole -RoleResult $finalize
    } while ($false)

    if (-not $validResult) {
        $validResult = New-FailureResult -Stage orchestration `
            -Message 'Orquestração terminou sem resultado.'
        $validResult.roleTrace = @($roleTrace)
    }
    [IO.File]::WriteAllText(
        $resultPath,
        ($validResult | ConvertTo-Json -Depth 20),
        [Text.UTF8Encoding]::new($false)
    )

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
