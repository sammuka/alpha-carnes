#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateRange(0, [int]::MaxValue)]
    [int]$PrNumber = 0,

    [string]$Repository,
    [switch]$EnableVisibilityLease,
    [ValidateRange(60, 1500)][int]$TimeoutSeconds = 1500,
    [ValidateRange(1, 300)][int]$PollSeconds = 15,
    [scriptblock]$ActionScript,
    [string]$FixturePath,
    [switch]$DryRun,
    [string]$RuntimeRoot,

    # Parâmetros internos exclusivos do processo watchdog.
    [switch]$Watchdog,
    [string]$LeaseId,
    [string]$LeaseRoot,
    [string]$LockToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 20 -Compress
}

function Invoke-Gh {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = @(& gh @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments -join ' ') falhou: $($output -join ' ')"
    }
    $output
}

function Get-RepositoryVisibility {
    param([string]$Repo = '')
    $arguments = @('repo', 'view')
    if (-not [string]::IsNullOrWhiteSpace($Repo)) {
        $arguments += $Repo
    }
    $arguments += @('--json', 'visibility,nameWithOwner')
    $raw = Invoke-Gh -Arguments $arguments
    $raw | ConvertFrom-Json
}

function Set-RepositoryVisibility {
    param(
        [Parameter(Mandatory)][string]$Repo,
        [Parameter(Mandatory)][ValidateSet('public', 'private')][string]$Visibility,
        [ValidateRange(1, 8)][int]$Attempts = 5
    )
    $errors = @()
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $null = Invoke-Gh -Arguments @(
                'repo', 'edit', $Repo,
                '--visibility', $Visibility,
                '--accept-visibility-change-consequences'
            )
            $observed = Get-RepositoryVisibility -Repo $Repo
            if ([string]$observed.visibility -ieq $Visibility) {
                return [ordered]@{
                    ok = $true
                    visibility = ([string]$observed.visibility).ToUpperInvariant()
                    attempt = $attempt
                }
            }
            $errors += "tentativa $attempt observou $($observed.visibility)"
        } catch {
            $errors += "tentativa $attempt`: $($_.Exception.Message)"
        }
        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds ([Math]::Min(2 * $attempt, 10))
        }
    }
    [ordered]@{
        ok = $false
        visibility = 'UNKNOWN'
        attempt = $Attempts
        errors = $errors
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
$lockScript = Join-Path $PSScriptRoot 'lock.ps1'
$waitScript = Join-Path $PSScriptRoot 'wait-pr-checks.ps1'

if ($Watchdog) {
    if ([string]::IsNullOrWhiteSpace($Repository) -or
        [string]::IsNullOrWhiteSpace($LeaseId) -or
        [string]::IsNullOrWhiteSpace($LeaseRoot)) {
        throw 'Watchdog exige Repository, LeaseId e LeaseRoot.'
    }
    $leaseRootFull = [IO.Path]::GetFullPath($LeaseRoot)
    if (-not $leaseRootFull.StartsWith(
        $runtimeFull.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "LeaseRoot do watchdog fora do runtime: $leaseRootFull"
    }
    $completeMarker = Join-Path $leaseRootFull 'complete.json'
    $watchdogLog = Join-Path $leaseRootFull 'watchdog-result.json'
    Start-Sleep -Seconds $TimeoutSeconds
    if (-not (Test-Path -LiteralPath $completeMarker -PathType Leaf)) {
        $restore = Set-RepositoryVisibility -Repo $Repository -Visibility private -Attempts 5
        [IO.File]::WriteAllText(
            $watchdogLog,
            ($restore | ConvertTo-Json -Depth 8),
            [Text.UTF8Encoding]::new($false)
        )
        if (-not $restore.ok) {
            throw "WATCHDOG não conseguiu restaurar $Repository para PRIVATE."
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($LockToken)) {
        try {
            $null = & $lockScript release visibility-ci -Token $LockToken -Role executor `
                -RunId $LeaseId -RuntimeRoot $runtimeFull
        } catch {
            # O processo principal pode ter liberado primeiro; release é melhor esforço aqui.
        }
    }
    return
}

if ($DryRun) {
    Write-Json ([ordered]@{
        mode = 'dry-run'
        prNumber = $PrNumber
        repository = $Repository
        timeoutSeconds = $TimeoutSeconds
        visibilitySequence = @('PRIVATE preflight', 'PUBLIC lease', 'action/checks', 'PRIVATE finally')
        realMutation = $false
    })
    return
}

if (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
    if ($PrNumber -le 0) {
        throw 'PrNumber é obrigatório no modo fixture.'
    }
    $checks = & $waitScript -PrNumber $PrNumber -FixturePath $FixturePath |
        ConvertFrom-Json
    Write-Json ([ordered]@{
        mode = 'fixture'
        visibilityChanged = $false
        checks = $checks
    })
    return
}

if (-not $EnableVisibilityLease) {
    throw 'Modo real exige -EnableVisibilityLease explicitamente.'
}
if ($PrNumber -le 0 -and -not $ActionScript) {
    throw 'PrNumber é obrigatório quando ActionScript não é informado.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI não encontrado.'
}
gh auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI não está autenticado.'
}
if ([string]::IsNullOrWhiteSpace($Repository)) {
    $Repository = [string](Get-RepositoryVisibility).nameWithOwner
}

$preflight = Get-RepositoryVisibility -Repo $Repository
if ([string]$preflight.visibility -ine 'PRIVATE') {
    throw "Preflight exige repositório PRIVATE; observado $($preflight.visibility)."
}

$LeaseId = 'visibility-{0}-{1}' -f [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ'),
    ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$LeaseRoot = Join-Path $runtimeFull "visibility-leases\$LeaseId"
New-Item -ItemType Directory -Force -Path $LeaseRoot | Out-Null
$leaseMetadata = [ordered]@{
    schemaVersion = 1
    leaseId = $LeaseId
    repository = $Repository
    prNumber = if ($PrNumber -gt 0) { $PrNumber } else { $null }
    startedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
    timeoutSeconds = $TimeoutSeconds
}
[IO.File]::WriteAllText(
    (Join-Path $LeaseRoot 'lease.json'),
    ($leaseMetadata | ConvertTo-Json -Depth 5),
    [Text.UTF8Encoding]::new($false)
)

$lockResult = & $lockScript acquire visibility-ci -Role executor -RunId $LeaseId `
    -StaleAfterSeconds ($TimeoutSeconds + 300) -MaxWaitSeconds 0 `
    -RuntimeRoot $runtimeFull | ConvertFrom-Json
if (-not $lockResult -or $lockResult.status -ne 'acquired') {
    throw 'Já existe um lease de visibilidade ativo.'
}
$LockToken = [string]$lockResult.token
$watchdogProcess = $null
$publicVerified = $false
$privateRestore = $null
$actionResult = $null

try {
    $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
    $watchdogStdout = Join-Path $LeaseRoot 'watchdog.stdout.log'
    $watchdogStderr = Join-Path $LeaseRoot 'watchdog.stderr.log'
    $watchdogArguments = @(
        '-NoProfile',
        '-File', "`"$PSCommandPath`"",
        '-Watchdog',
        '-Repository', $Repository,
        '-LeaseId', $LeaseId,
        '-LeaseRoot', "`"$LeaseRoot`"",
        '-LockToken', $LockToken,
        '-TimeoutSeconds', [string]$TimeoutSeconds,
        '-RuntimeRoot', "`"$runtimeFull`""
    )
    $watchdogProcess = Start-Process -FilePath $pwshPath -ArgumentList $watchdogArguments `
        -WindowStyle Hidden -RedirectStandardOutput $watchdogStdout `
        -RedirectStandardError $watchdogStderr -PassThru
    if (-not $watchdogProcess -or $watchdogProcess.HasExited) {
        throw 'Watchdog de visibilidade não iniciou.'
    }

    $public = Set-RepositoryVisibility -Repo $Repository -Visibility public -Attempts 3
    if (-not $public.ok) {
        throw "Não foi possível verificar PUBLIC: $($public.errors -join '; ')"
    }
    $publicVerified = $true

    if ($ActionScript) {
        $actionResult = & $ActionScript
    } else {
        $actionResult = & $waitScript -PrNumber $PrNumber -Watch `
            -TimeoutSeconds $TimeoutSeconds -PollSeconds $PollSeconds | ConvertFrom-Json
        if ([string]$actionResult.status -cne 'green') {
            throw "Checks obrigatórios terminaram em '$($actionResult.status)'."
        }
    }
} finally {
    $privateRestore = Set-RepositoryVisibility -Repo $Repository -Visibility private -Attempts 5
    if ($privateRestore.ok) {
        $complete = [ordered]@{
            leaseId = $LeaseId
            repository = $Repository
            restoredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
            visibility = 'PRIVATE'
        }
        [IO.File]::WriteAllText(
            (Join-Path $LeaseRoot 'complete.json'),
            ($complete | ConvertTo-Json -Depth 5),
            [Text.UTF8Encoding]::new($false)
        )
        if ($watchdogProcess -and -not $watchdogProcess.HasExited) {
            Stop-Process -Id $watchdogProcess.Id -Force -ErrorAction SilentlyContinue
        }
        try {
            $null = & $lockScript release visibility-ci -Token $LockToken -Role executor `
                -RunId $LeaseId -RuntimeRoot $runtimeFull
        } catch {
            # O watchdog pode ter liberado primeiro.
        }
    }
}

if (-not $privateRestore -or -not $privateRestore.ok) {
    throw "FALHA CRÍTICA: não foi possível restaurar $Repository para PRIVATE."
}

Write-Json ([ordered]@{
    mode = 'real'
    leaseId = $LeaseId
    repository = $Repository
    publicVerified = $publicVerified
    privateRestored = [bool]$privateRestore.ok
    watchdogPid = if ($watchdogProcess) { $watchdogProcess.Id } else { $null }
    actionResult = $actionResult
})
