#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [ValidateSet('init', 'record', 'read', 'complete')]
    [string]$Command,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')]
    [string]$RunId,

    [Parameter(Mandatory)]
    [ValidatePattern('^onda(?:[1-9]|10)$')]
    [string]$Wave,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,63}$')]
    [string]$Stage,

    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')]
    [string]$StepId,

    [ValidateSet('started', 'completed', 'blocked', 'failed', 'info')]
    [string]$Status = 'info',

    [ValidateSet('coordinator', 'planner', 'monitor', 'executor', 'worker', 'test')]
    [string]$Role = 'coordinator',

    [string]$Message = '',
    [string]$Branch = '',
    [string]$CommitSha = '',
    [ValidateRange(0, [int]::MaxValue)][int]$PrNumber = 0,
    [string]$RuntimeRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 12 -Compress
}

function Assert-SafeChild {
    param([string]$Parent, [string]$Child)
    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $childFull = [IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith(
        $parentFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Caminho de checkpoint fora da raiz: $childFull"
    }
    $childFull
}

function Read-Entries {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return @()
    }
    @(
        Get-Content -Encoding utf8 -LiteralPath $Path |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_ | ConvertFrom-Json }
    )
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $repoRoot '.codex\runtime'
}
$runtimeFull = Assert-SafeChild -Parent $repoRoot -Child $RuntimeRoot
$checkpointRoot = Assert-SafeChild -Parent $runtimeFull -Child (Join-Path $runtimeFull 'checkpoints')
$runRoot = Assert-SafeChild -Parent $checkpointRoot -Child (Join-Path $checkpointRoot $RunId)
$waveRoot = Assert-SafeChild -Parent $runRoot -Child (Join-Path $runRoot $Wave)
$checkpointPath = Assert-SafeChild -Parent $waveRoot -Child (Join-Path $waveRoot "$Stage.jsonl")
$lockName = "checkpoint-$($Wave.Replace('onda', 'o'))-$Stage"
$lockScript = Join-Path $PSScriptRoot 'lock.ps1'

if ($Command -eq 'read') {
    Write-Json ([ordered]@{
        status = 'read'
        runId = $RunId
        wave = $Wave
        stage = $Stage
        path = $checkpointPath
        entries = @(Read-Entries -Path $checkpointPath)
    })
    return
}

$lockResult = & $lockScript acquire $lockName -Role $Role -RunId $RunId `
    -MaxWaitSeconds 10 -RuntimeRoot $runtimeFull | ConvertFrom-Json
if (-not $lockResult -or $lockResult.status -ne 'acquired') {
    throw "Não foi possível adquirir o lock de checkpoint '$lockName'."
}
$lockToken = [string]$lockResult.token

try {
    New-Item -ItemType Directory -Force -Path $waveRoot | Out-Null
    $entries = @(Read-Entries -Path $checkpointPath)

    if ($Command -eq 'init') {
        $StepId = 'init'
        $Status = 'started'
        if ([string]::IsNullOrWhiteSpace($Message)) {
            $Message = 'Checkpoint iniciado.'
        }
    } elseif ($Command -eq 'complete') {
        $StepId = 'stage-complete'
        $Status = 'completed'
        if ([string]::IsNullOrWhiteSpace($Message)) {
            $Message = 'Etapa concluída.'
        }
    } elseif ([string]::IsNullOrWhiteSpace($StepId)) {
        throw 'StepId é obrigatório para record.'
    }

    $duplicate = $entries | Where-Object {
        [string]$_.stepId -ceq $StepId -and [string]$_.status -ceq $Status
    } | Select-Object -Last 1
    if ($duplicate) {
        Write-Json ([ordered]@{
            status = 'duplicate'
            path = $checkpointPath
            entry = $duplicate
        })
        return
    }

    $entry = [ordered]@{
        schemaVersion = 1
        timestampUtc = [DateTimeOffset]::UtcNow.ToString('o')
        runId = $RunId
        wave = $Wave
        stage = $Stage
        stepId = $StepId
        status = $Status
        role = $Role
        message = $Message
        branch = $Branch
        commitSha = $CommitSha
        prNumber = if ($PrNumber -gt 0) { $PrNumber } else { $null }
    }
    Add-Content -LiteralPath $checkpointPath -Encoding utf8 -Value (
        $entry | ConvertTo-Json -Depth 5 -Compress
    )
    Write-Json ([ordered]@{ status = 'recorded'; path = $checkpointPath; entry = $entry })
} finally {
    if ($lockToken) {
        $null = & $lockScript release $lockName -Token $lockToken -Role $Role `
            -RunId $RunId -RuntimeRoot $runtimeFull
    }
}
