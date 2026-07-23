#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateRange(1, 2)][int]$MaxConcurrency = 1,
    [ValidateRange(1, 10)][int]$MaxWaves = 10,
    [ValidatePattern('^onda(?:[1-9]|10)$')]
    [string[]]$OnlyWave = @(),
    [switch]$AutoMerge,
    [switch]$AdoptOrphans,
    [switch]$DryRun,
    [string]$StatusPath,
    [string]$RuntimeRoot,
    [string]$InvokeWavePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 20 -Compress
}

function Read-StatusTable {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Arquivo de status ausente: $Path"
    }
    $map = @{}
    foreach ($line in Get-Content -Encoding utf8 -LiteralPath $Path) {
        if ($line -notmatch '^\|\s*(\d+)\s*\|') {
            continue
        }
        $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        if ($cells.Count -lt 5) {
            throw "Linha de status malformada: $line"
        }
        $number = [int]$cells[0]
        if ($number -gt 10) {
            continue
        }
        $wave = "onda$number"
        $statusMatch = [regex]::Match(
            $cells[3],
            '^(aguardando_inicio|planejando|aguardando_portao1|plano_aprovado|implementando|aguardando_portao2|mergeada|bloqueada)'
        )
        if (-not $statusMatch.Success) {
            throw "Status desconhecido para $wave`: '$($cells[3])'."
        }
        $dependencies = @(
            if ($cells[2] -notin @('', '—', '-')) {
                [regex]::Matches($cells[2], '\d+') | ForEach-Object { "onda$($_.Value)" }
            }
        )
        $map[$wave] = [ordered]@{
            status = $statusMatch.Groups[1].Value
            dependencies = $dependencies
        }
    }
    foreach ($number in 1..10) {
        if (-not $map.ContainsKey("onda$number")) {
            throw "Linha ausente no status: onda$number."
        }
    }
    $map
}

function Get-Eligible {
    param($StatusMap, [string[]]$Excluded)
    @(
        foreach ($number in 1..10) {
            $wave = "onda$number"
            if ($wave -in $Excluded) { continue }
            if ($OnlyWave.Count -gt 0 -and $wave -notin $OnlyWave) { continue }
            if ($StatusMap[$wave].status -notin @('aguardando_portao1', 'plano_aprovado')) {
                continue
            }
            if (@($StatusMap[$wave].dependencies | Where-Object {
                $StatusMap[$_].status -ne 'mergeada'
            }).Count -eq 0) {
                $wave
            }
        }
    )
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($StatusPath)) {
    $StatusPath = Join-Path $repoRoot 'docs\execucao\EXECUCAO-STATUS.md'
}
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $repoRoot '.codex\runtime'
}
$invokeWave = if ([string]::IsNullOrWhiteSpace($InvokeWavePath)) {
    Join-Path $PSScriptRoot 'invoke-onda.ps1'
} else {
    [IO.Path]::GetFullPath($InvokeWavePath)
}
if (-not (Test-Path -LiteralPath $invokeWave -PathType Leaf)) {
    throw "Helper de onda ausente: $invokeWave"
}
$lockScript = Join-Path $PSScriptRoot 'lock.ps1'
$statusMap = Read-StatusTable -Path $StatusPath
$initialEligible = @(Get-Eligible -StatusMap $statusMap -Excluded @())

if ($DryRun) {
    Write-Json ([ordered]@{
        status = 'dry-run'
        eligible = $initialEligible
        maxConcurrency = $MaxConcurrency
        maxWaves = $MaxWaves
        autoMerge = [bool]$AutoMerge
        adoptOrphans = [bool]$AdoptOrphans
    })
    return
}

$runId = 'multi-{0}-{1}' -f [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ'),
    ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$lockResult = & $lockScript acquire multionda -Role coordinator -RunId $runId `
    -StaleAfterSeconds 21600 -MaxWaitSeconds 0 -RuntimeRoot $RuntimeRoot | ConvertFrom-Json
if (-not $lockResult -or $lockResult.status -ne 'acquired') {
    throw 'Já existe um ciclo multionda ativo.'
}
$lockToken = [string]$lockResult.token
$jobs = @{}
$attempted = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$completed = [Collections.Generic.List[object]]::new()
$blocked = $false

try {
    while ($jobs.Count -gt 0 -or (-not $blocked -and $attempted.Count -lt $MaxWaves)) {
        $statusMap = Read-StatusTable -Path $StatusPath
        $eligible = @(Get-Eligible -StatusMap $statusMap -Excluded @($attempted))
        while (-not $blocked -and $jobs.Count -lt $MaxConcurrency -and $eligible.Count -gt 0 -and
            $attempted.Count -lt $MaxWaves) {
            $wave = $eligible[0]
            $eligible = @($eligible | Select-Object -Skip 1)
            $null = $attempted.Add($wave)
            $job = Start-Job -ArgumentList @(
                $invokeWave,
                $wave,
                [bool]$AutoMerge,
                [bool]$AdoptOrphans,
                $RuntimeRoot
            ) -ScriptBlock {
                param($Script, $Wave, $AutoMerge, $AdoptOrphans, $RuntimeRoot)
                $parameters = @{ Wave = $Wave; RuntimeRoot = $RuntimeRoot }
                if ($AutoMerge) { $parameters.AutoMerge = $true }
                if ($AdoptOrphans) { $parameters.AdoptOrphan = $true }
                & $Script @parameters
            }
            $jobs[$job.Id] = [ordered]@{ job = $job; wave = $wave }
        }

        if ($jobs.Count -eq 0) {
            break
        }

        $finished = Wait-Job -Job @($jobs.Values.job) -Any
        $metadata = $jobs[$finished.Id]
        $output = @(Receive-Job -Job $finished)
        $errors = @($finished.ChildJobs[0].Error | ForEach-Object { $_.ToString() })
        Remove-Job -Job $finished -Force
        $jobs.Remove($finished.Id)

        $result = $null
        foreach ($line in @($output | Select-Object -Last 5)) {
            try {
                $candidate = [string]$line | ConvertFrom-Json
                if ($candidate.result) {
                    $result = $candidate
                }
            } catch {
                continue
            }
        }
        if (-not $result) {
            $result = [pscustomobject]@{
                wave = $metadata.wave
                result = 'failed'
                message = ($errors -join '; ')
            }
        }
        $completed.Add($result)
        if ($result.result -notin @('merged', 'not-ready')) {
            $blocked = $true
        }
    }

    Write-Json ([ordered]@{
        runId = $runId
        result = if ($blocked) { 'stopped-on-blocker' } else { 'completed-eligible' }
        attempted = @($attempted)
        completed = @($completed)
        remainingEligible = @(Get-Eligible -StatusMap (Read-StatusTable -Path $StatusPath) `
            -Excluded @($attempted))
    })
} finally {
    foreach ($metadata in @($jobs.Values)) {
        Stop-Job -Job $metadata.job -ErrorAction SilentlyContinue
        Remove-Job -Job $metadata.job -Force -ErrorAction SilentlyContinue
    }
    if ($lockToken) {
        $null = & $lockScript release multionda -Token $lockToken -Role coordinator `
            -RunId $runId -RuntimeRoot $RuntimeRoot
    }
}
