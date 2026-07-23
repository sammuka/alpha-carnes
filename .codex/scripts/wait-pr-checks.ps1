#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$PrNumber,

    [string[]]$RequiredChecks = @(
        'lint',
        'type-check',
        'test-backend',
        'coverage',
        'test-frontend',
        'build',
        'audit',
        'secret-scan'
    ),

    [switch]$Watch,
    [ValidateRange(1, 7200)][int]$TimeoutSeconds = 1500,
    [ValidateRange(1, 300)][int]$PollSeconds = 15,
    [string]$FixturePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Snapshot {
    if (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
        return Get-Content -Raw -Encoding utf8 -LiteralPath $FixturePath | ConvertFrom-Json
    }
    $checks = @(gh pr checks $PrNumber --json name,state,bucket,workflow,link | ConvertFrom-Json)
    if ($LASTEXITCODE -notin @(0, 1, 8)) {
        throw "gh pr checks falhou com exit code $LASTEXITCODE."
    }
    $pr = gh pr view $PrNumber --json headRefOid,headRefName,baseRefName | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "gh pr view falhou com exit code $LASTEXITCODE."
    }
    $changedFiles = @(gh pr diff $PrNumber --name-only)
    if ($LASTEXITCODE -ne 0) {
        throw "gh pr diff falhou com exit code $LASTEXITCODE."
    }
    [pscustomobject]@{
        headRefOid = $pr.headRefOid
        headRefName = $pr.headRefName
        baseRefName = $pr.baseRefName
        changedFiles = @($changedFiles | ForEach-Object { [string]$_ })
        checks = $checks
    }
}

function Test-Snapshot {
    param([Parameter(Mandatory)]$Snapshot)
    $checks = @($Snapshot.checks)
    $changedFiles = @(
        if ($Snapshot.PSObject.Properties.Name -contains 'changedFiles') {
            $Snapshot.changedFiles
        }
    )
    $landingChanged = @($changedFiles | Where-Object {
        ([string]$_).Replace('\', '/').StartsWith('landing/', [StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
    $byName = @{}
    foreach ($check in $checks) {
        if (-not $byName.ContainsKey([string]$check.name)) {
            $byName[[string]$check.name] = @()
        }
        $byName[[string]$check.name] += $check
    }

    $missing = @($RequiredChecks | Where-Object { -not $byName.ContainsKey($_) })
    $requiredNotPassing = @(
        foreach ($name in $RequiredChecks) {
            if ($byName.ContainsKey($name)) {
                foreach ($check in $byName[$name]) {
                    if ([string]$check.bucket -cne 'pass') {
                        [pscustomobject]@{ name = $name; bucket = $check.bucket; state = $check.state }
                    }
                }
            }
        }
    )
    $vercelChecks = @($checks | Where-Object { [string]$_.name -match '^Vercel(?:$|\s)' })
    $vercelMissing = $landingChanged -and $vercelChecks.Count -eq 0
    $vercelNotPassing = @(
        if ($landingChanged) {
            $vercelChecks | Where-Object { [string]$_.bucket -cne 'pass' } | ForEach-Object {
                [pscustomobject]@{ name = $_.name; bucket = $_.bucket; state = $_.state }
            }
        }
    )
    $pendingRequired = @(
        $requiredNotPassing | Where-Object { [string]$_.bucket -eq 'pending' }
        if ($landingChanged) {
            $vercelNotPassing | Where-Object { [string]$_.bucket -eq 'pending' }
        }
    )

    $terminalFailures = @(
        $requiredNotPassing | Where-Object { [string]$_.bucket -ne 'pending' }
        $vercelNotPassing | Where-Object { [string]$_.bucket -ne 'pending' }
    )
    $state = if ($terminalFailures.Count -gt 0) {
        'failed'
    } elseif ($missing.Count -gt 0 -or $vercelMissing -or $pendingRequired.Count -gt 0) {
        'pending'
    } else {
        'green'
    }

    [ordered]@{
        status = $state
        prNumber = $PrNumber
        headRefOid = [string]$Snapshot.headRefOid
        headRefName = [string]$Snapshot.headRefName
        baseRefName = [string]$Snapshot.baseRefName
        changedFiles = $changedFiles
        landingChanged = $landingChanged
        requiredMissing = $missing
        requiredNotPassing = $requiredNotPassing
        vercelMissing = $vercelMissing
        vercelNotPassing = $vercelNotPassing
        pending = @($pendingRequired | ForEach-Object { [string]$_.name })
        checks = @($checks | ForEach-Object {
            [ordered]@{ name = $_.name; bucket = $_.bucket; state = $_.state }
        })
    }
}

$deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
do {
    $result = Test-Snapshot -Snapshot (Get-Snapshot)
    if ($result.status -ne 'pending' -or -not $Watch -or $FixturePath) {
        $result | ConvertTo-Json -Depth 10 -Compress
        return
    }
    if ([DateTimeOffset]::UtcNow -ge $deadline) {
        $result.status = 'timeout'
        $result | ConvertTo-Json -Depth 10 -Compress
        return
    }
    Start-Sleep -Seconds $PollSeconds
} while ($true)
