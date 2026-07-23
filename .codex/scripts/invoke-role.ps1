#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('planner', 'monitor', 'executor', 'worker')]
    [string]$Role,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z][a-z0-9-]{1,63}$')]
    [string]$Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^onda(?:[1-9]|10)$')]
    [string]$Wave,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')]
    [string]$RunId,

    [Parameter(Mandatory)]
    [string]$Prompt,

    [string]$RuntimeRoot,
    [string]$FixtureEventsPath,
    [string]$FixtureResultPath,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 20 -Compress
}

function Read-AgentConfig {
    param([Parameter(Mandatory)][string]$Path)
    $content = Get-Content -Raw -Encoding utf8 -LiteralPath $Path
    $modelMatch = [regex]::Match($content, '(?m)^model\s*=\s*"([^"]+)"\s*$')
    $effortMatch = [regex]::Match(
        $content,
        '(?m)^model_reasoning_effort\s*=\s*"([^"]+)"\s*$'
    )
    $sandboxMatch = [regex]::Match($content, '(?m)^sandbox_mode\s*=\s*"([^"]+)"\s*$')
    $instructionsMatch = [regex]::Match(
        $content,
        '(?s)developer_instructions\s*=\s*"""(.*?)"""'
    )
    if (-not $modelMatch.Success -or -not $effortMatch.Success -or
        -not $sandboxMatch.Success -or -not $instructionsMatch.Success) {
        throw "Configuração de agente incompleta: $Path"
    }
    [ordered]@{
        model = $modelMatch.Groups[1].Value
        effort = $effortMatch.Groups[1].Value
        sandbox = $sandboxMatch.Groups[1].Value
        instructions = $instructionsMatch.Groups[1].Value.Trim()
    }
}

function Read-Events {
    param([Parameter(Mandatory)][string[]]$Lines)
    $events = [Collections.Generic.List[object]]::new()
    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        try {
            $events.Add(($line | ConvertFrom-Json))
        } catch {
            throw "Linha não JSON no stream Codex: $line"
        }
    }
    @($events)
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

$agentPath = Join-Path $repoRoot ".codex\agents\$Role.toml"
$schemaPath = Join-Path $repoRoot '.codex\schemas\role-result.schema.json'
if (-not (Test-Path -LiteralPath $agentPath -PathType Leaf)) {
    throw "Agente declarativo ausente: $agentPath"
}
if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    throw "Schema de papel ausente: $schemaPath"
}
$agent = Read-AgentConfig -Path $agentPath
$invocationId = '{0}-{1}-{2}' -f $Role, $Stage,
    ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$invocationRoot = Join-Path $runtimeFull "runs\$RunId\roles\$invocationId"
$eventsPath = Join-Path $invocationRoot 'events.jsonl'
$stderrPath = Join-Path $invocationRoot 'stderr.log'
$resultPath = Join-Path $invocationRoot 'result.json'

if ($DryRun) {
    Write-Json ([ordered]@{
        status = 'dry-run'
        mechanism = 'independent-codex-exec-process'
        role = $Role
        stage = $Stage
        wave = $Wave
        runId = $RunId
        agentPath = $agentPath
        schemaPath = $schemaPath
        model = $agent.model
        effort = $agent.effort
        sandbox = $agent.sandbox
        multiAgentInsideRole = $false
    })
    return
}

New-Item -ItemType Directory -Force -Path $invocationRoot | Out-Null
$rolePrompt = @"
Execute somente o papel '$Role' no estágio '$Stage' da $Wave, run ID '$RunId'.
Sua instância é um processo Codex independente criado pelo orquestrador PowerShell.
Não delegue, não simule outro papel e não declare thread ID; o wrapper coleta a evidência do runtime.
Não faça perguntas síncronas. Se faltar decisão autorizada, retorne result='requires-human'.
Retorne apenas o objeto do schema, com role='$Role', stage='$Stage', wave='$Wave' e runId='$RunId'.

Tarefa específica:
$Prompt
"@

if (-not [string]::IsNullOrWhiteSpace($FixtureEventsPath) -or
    -not [string]::IsNullOrWhiteSpace($FixtureResultPath)) {
    if ([string]::IsNullOrWhiteSpace($FixtureEventsPath) -or
        [string]::IsNullOrWhiteSpace($FixtureResultPath)) {
        throw 'Fixtures exigem EventsPath e ResultPath juntos.'
    }
    $eventLines = @(Get-Content -Encoding utf8 -LiteralPath $FixtureEventsPath)
    Copy-Item -LiteralPath $FixtureResultPath -Destination $resultPath
    [IO.File]::WriteAllLines($eventsPath, $eventLines, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($stderrPath, '', [Text.UTF8Encoding]::new($false))
} else {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
        throw 'Codex CLI não encontrado.'
    }
    $instructionsToml = $agent.instructions | ConvertTo-Json -Compress
    $arguments = @(
        '--ask-for-approval', 'never',
        'exec',
        '--strict-config',
        '--ignore-user-config',
        '--json',
        '--sandbox', $agent.sandbox,
        '-c', 'features.multi_agent=false',
        '-c', 'sandbox_workspace_write.network_access=true',
        '-c', "model_reasoning_effort=$($agent.effort)",
        '-c', "developer_instructions=$instructionsToml",
        '--output-schema', $schemaPath,
        '--output-last-message', $resultPath,
        '-C', $repoRoot,
        '-m', $agent.model,
        '-'
    )
    $eventLines = @($rolePrompt | & codex @arguments 2>> $stderrPath)
    $exitCode = $LASTEXITCODE
    [IO.File]::WriteAllLines($eventsPath, $eventLines, [Text.UTF8Encoding]::new($false))
    if ($exitCode -ne 0) {
        throw "Processo Codex do papel $Role/$Stage falhou com exit code $exitCode."
    }
}

$events = @(Read-Events -Lines $eventLines)
$threadEvents = @($events | Where-Object { [string]$_.type -ceq 'thread.started' })
$turnCompleted = @($events | Where-Object { [string]$_.type -ceq 'turn.completed' })
$collabCalls = @($events | Where-Object {
    $_.PSObject.Properties['item'] -and
        [string]$_.item.type -ceq 'collab_tool_call'
})
$errorEvents = @($events | Where-Object {
    [string]$_.type -in @('error', 'turn.failed')
})
if ($threadEvents.Count -ne 1 -or
    [string]::IsNullOrWhiteSpace([string]$threadEvents[0].thread_id)) {
    throw "Evidência inválida para $Role/$Stage`: esperado exatamente um thread.started."
}
if ($turnCompleted.Count -ne 1) {
    throw "Evidência inválida para $Role/$Stage`: turn.completed ausente ou duplicado."
}
if ($collabCalls.Count -gt 0) {
    throw "Papel $Role/$Stage tentou delegar; multi-agent interno é proibido."
}
if ($errorEvents.Count -gt 0) {
    throw "Stream Codex registrou falha para $Role/$Stage."
}
if (-not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
    throw "Resultado estruturado ausente para $Role/$Stage."
}

try {
    $roleResult = Get-Content -Raw -Encoding utf8 -LiteralPath $resultPath | ConvertFrom-Json
} catch {
    throw "Resultado JSON inválido para $Role/$Stage`: $($_.Exception.Message)"
}
if ([int]$roleResult.schemaVersion -ne 1 -or
    [string]$roleResult.runId -cne $RunId -or
    [string]$roleResult.wave -cne $Wave -or
    [string]$roleResult.role -cne $Role -or
    [string]$roleResult.stage -cne $Stage) {
    throw "Resultado não corresponde à invocação $Role/$Stage/$Wave/$RunId."
}

Write-Json ([ordered]@{
    status = 'completed'
    mechanism = 'independent-codex-exec-process'
    invocationId = $invocationId
    role = $Role
    stage = $Stage
    threadId = [string]$threadEvents[0].thread_id
    eventsPath = $eventsPath
    stderrPath = $stderrPath
    resultPath = $resultPath
    result = $roleResult
})
