#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateRange(0, [int]::MaxValue)]
    [int]$PrNumber = 0,

    [string]$Repository,
    [switch]$EnableVisibilityLease,
    [ValidateRange(1, 1500)][int]$TimeoutSeconds = 1500,
    [ValidateRange(1, 300)][int]$PollSeconds = 15,
    [scriptblock]$ActionScript,
    [string]$FixturePath,
    [switch]$DryRun,
    [string]$RuntimeRoot,
    [ValidateRange(1, 30)][int]$WatchdogReadyTimeoutSeconds = 10,
    [ValidateRange(1, 10000)][int]$VisibilityRetryDelayMilliseconds = 2000,
    [ValidateRange(1, 300)][int]$RecoveryWaitSeconds = 30,
    [string]$GhCommandPath = 'gh',

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
    Push-Location $repoRoot
    try {
        $output = @(& $GhCommandPath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($exitCode -ne 0) {
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
        [ValidateRange(1, 8)][int]$Attempts = 5,
        [ValidateRange(1, 10000)][int]$RetryDelayMilliseconds = 2000
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
            Start-Sleep -Milliseconds (
                [Math]::Min($RetryDelayMilliseconds * $attempt, 10000)
            )
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
    $restoreRequiredMarker = Join-Path $leaseRootFull 'restore-required.json'
    $readyMarker = Join-Path $leaseRootFull 'watchdog-ready.json'
    $watchdogLog = Join-Path $leaseRootFull 'watchdog-result.json'
    [IO.File]::WriteAllText(
        $readyMarker,
        ([ordered]@{
            leaseId = $LeaseId
            pid = $PID
            readyAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        } | ConvertTo-Json -Depth 4),
        [Text.UTF8Encoding]::new($false)
    )
    $restoreDeadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while (-not (Test-Path -LiteralPath $completeMarker -PathType Leaf) -and
        -not (Test-Path -LiteralPath $restoreRequiredMarker -PathType Leaf) -and
        [DateTimeOffset]::UtcNow -lt $restoreDeadline) {
        Start-Sleep -Milliseconds 250
    }

    $attempt = 0
    while (-not (Test-Path -LiteralPath $completeMarker -PathType Leaf)) {
        $attempt++
        $restore = Set-RepositoryVisibility -Repo $Repository -Visibility private -Attempts 1 `
            -RetryDelayMilliseconds $VisibilityRetryDelayMilliseconds
        $restoreErrors = if ($restore.Contains('errors')) { @($restore['errors']) } else { @() }
        $recoveryState = [ordered]@{
            schemaVersion = 1
            leaseId = $LeaseId
            repository = $Repository
            watchdogPid = $PID
            attempt = $attempt
            attemptedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
            restored = [bool]$restore.ok
            errors = $restoreErrors
        }
        [IO.File]::WriteAllText(
            $watchdogLog,
            ($recoveryState | ConvertTo-Json -Depth 8),
            [Text.UTF8Encoding]::new($false)
        )
        if ($restore.ok) {
            [IO.File]::WriteAllText(
                $completeMarker,
                ([ordered]@{
                    leaseId = $LeaseId
                    repository = $Repository
                    restoredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
                    visibility = 'PRIVATE'
                    restoredBy = 'durable-watchdog'
                    recoveryAttempts = $attempt
                } | ConvertTo-Json -Depth 5),
                [Text.UTF8Encoding]::new($false)
            )
            break
        }
        Start-Sleep -Milliseconds (
            [Math]::Min($VisibilityRetryDelayMilliseconds * [Math]::Min($attempt, 10), 30000)
        )
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
        recovery = 'watchdog retries until PRIVATE is verified; no fixed retry ceiling'
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
if (-not (Get-Command $GhCommandPath -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI não encontrado.'
}
$null = Invoke-Gh -Arguments @('auth', 'status')
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
$primaryError = $null
$cleanupErrors = [Collections.Generic.List[string]]::new()
$watchdogReady = $false
$durableRecoveryUsed = $false

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
        '-VisibilityRetryDelayMilliseconds', [string]$VisibilityRetryDelayMilliseconds,
        '-RecoveryWaitSeconds', [string]$RecoveryWaitSeconds,
        '-RuntimeRoot', "`"$runtimeFull`"",
        '-GhCommandPath', "`"$GhCommandPath`""
    )
    $startParameters = @{
        FilePath = $pwshPath
        ArgumentList = $watchdogArguments
        RedirectStandardOutput = $watchdogStdout
        RedirectStandardError = $watchdogStderr
        PassThru = $true
    }
    if ($IsWindows) {
        $startParameters.WindowStyle = 'Hidden'
    }
    $watchdogProcess = Start-Process @startParameters
    if (-not $watchdogProcess -or $watchdogProcess.HasExited) {
        throw 'Watchdog de visibilidade não iniciou.'
    }
    $readyMarker = Join-Path $LeaseRoot 'watchdog-ready.json'
    $readyDeadline = [DateTimeOffset]::UtcNow.AddSeconds($WatchdogReadyTimeoutSeconds)
    while (-not (Test-Path -LiteralPath $readyMarker -PathType Leaf)) {
        if ($watchdogProcess.HasExited) {
            throw 'Watchdog encerrou antes de confirmar readiness.'
        }
        if ([DateTimeOffset]::UtcNow -ge $readyDeadline) {
            throw "Watchdog não confirmou readiness em $WatchdogReadyTimeoutSeconds segundo(s)."
        }
        Start-Sleep -Milliseconds 100
    }
    $ready = Get-Content -Raw -Encoding utf8 -LiteralPath $readyMarker | ConvertFrom-Json
    if ([string]$ready.leaseId -cne $LeaseId -or [int]$ready.pid -ne $watchdogProcess.Id) {
        throw 'Readiness do watchdog não corresponde ao processo/lease ativo.'
    }
    $watchdogReady = $true

    $public = Set-RepositoryVisibility -Repo $Repository -Visibility public -Attempts 3 `
        -RetryDelayMilliseconds $VisibilityRetryDelayMilliseconds
    if (-not $public.ok) {
        throw "Não foi possível verificar PUBLIC: $($public.errors -join '; ')"
    }
    $publicVerified = $true

    if ($ActionScript) {
        $actionResult = & $ActionScript
    } else {
        $actionResult = & $waitScript -PrNumber $PrNumber -Watch `
            -TimeoutSeconds $TimeoutSeconds -PollSeconds $PollSeconds `
            -Repository $Repository -GhCommandPath $GhCommandPath | ConvertFrom-Json
        if ([string]$actionResult.status -cne 'green') {
            throw "Checks obrigatórios terminaram em '$($actionResult.status)'."
        }
    }
} catch {
    $primaryError = $_
} finally {
    try {
        $privateRestore = Set-RepositoryVisibility -Repo $Repository -Visibility private `
            -Attempts 5 -RetryDelayMilliseconds $VisibilityRetryDelayMilliseconds
    } catch {
        $privateRestore = [ordered]@{
            ok = $false
            visibility = 'UNKNOWN'
            errors = @($_.Exception.Message)
        }
    }
    if (-not $privateRestore.ok) {
        $durableRecoveryUsed = $true
        try {
            [IO.File]::WriteAllText(
                (Join-Path $LeaseRoot 'restore-required.json'),
                ([ordered]@{
                    leaseId = $LeaseId
                    repository = $Repository
                    requestedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
                    initialErrors = @($privateRestore.errors)
                } | ConvertTo-Json -Depth 6),
                [Text.UTF8Encoding]::new($false)
            )
        } catch {
            $cleanupErrors.Add("restore-required marker: $($_.Exception.Message)")
        }
        $recoveryDeadline = [DateTimeOffset]::UtcNow.AddSeconds($RecoveryWaitSeconds)
        $completePath = Join-Path $LeaseRoot 'complete.json'
        while (-not (Test-Path -LiteralPath $completePath -PathType Leaf) -and
            $watchdogProcess -and -not $watchdogProcess.HasExited -and
            [DateTimeOffset]::UtcNow -lt $recoveryDeadline) {
            Start-Sleep -Milliseconds 100
        }
        if (Test-Path -LiteralPath $completePath -PathType Leaf) {
            try {
                $recovered = Get-Content -Raw -Encoding utf8 -LiteralPath $completePath |
                    ConvertFrom-Json
                if ([string]$recovered.visibility -ceq 'PRIVATE' -and
                    [string]$recovered.leaseId -ceq $LeaseId) {
                    $privateRestore = [ordered]@{
                        ok = $true
                        visibility = 'PRIVATE'
                        attempt = 5 + [int]$recovered.recoveryAttempts
                        restoredBy = 'durable-watchdog'
                    }
                }
            } catch {
                $cleanupErrors.Add("read durable recovery: $($_.Exception.Message)")
            }
        }
    }
    if ($privateRestore.ok -and -not $durableRecoveryUsed) {
        $complete = [ordered]@{
            leaseId = $LeaseId
            repository = $Repository
            restoredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
            visibility = 'PRIVATE'
        }
        try {
            [IO.File]::WriteAllText(
                (Join-Path $LeaseRoot 'complete.json'),
                ($complete | ConvertTo-Json -Depth 5),
                [Text.UTF8Encoding]::new($false)
            )
        } catch {
            $cleanupErrors.Add("complete marker: $($_.Exception.Message)")
        }
        if ($watchdogProcess -and -not $watchdogProcess.HasExited) {
            try {
                Stop-Process -Id $watchdogProcess.Id -Force -ErrorAction Stop
            } catch {
                $cleanupErrors.Add("stop watchdog: $($_.Exception.Message)")
            }
        }
        try {
            $null = & $lockScript release visibility-ci -Token $LockToken -Role executor `
                -RunId $LeaseId -RuntimeRoot $runtimeFull
        } catch {
            $cleanupErrors.Add("release lock: $($_.Exception.Message)")
        }
    }
}

if (-not $privateRestore -or -not $privateRestore.ok) {
    $restoreDetails = @($privateRestore.errors) -join '; '
    $primaryDetails = if ($primaryError) {
        " Erro principal anterior: $($primaryError.Exception.Message)"
    } else {
        ''
    }
    $recoveryState = Join-Path $LeaseRoot 'watchdog-result.json'
    $recoveryPid = if ($watchdogProcess) { $watchdogProcess.Id } else { 'not-started' }
    throw (
        "FALHA CRÍTICA: PRIVATE ainda não foi verificado; recuperação durável segue ativa " +
        "no watchdog PID $recoveryPid, lease $LeaseRoot, estado $recoveryState. " +
        "$restoreDetails$primaryDetails"
    )
}
if ($primaryError) {
    throw $primaryError
}
if ($cleanupErrors.Count -gt 0) {
    throw "Lease restaurado para PRIVATE, mas a limpeza falhou: $($cleanupErrors -join '; ')"
}

Write-Json ([ordered]@{
    mode = 'real'
    leaseId = $LeaseId
    repository = $Repository
    publicVerified = $publicVerified
    privateRestored = [bool]$privateRestore.ok
    watchdogReady = $watchdogReady
    watchdogPid = if ($watchdogProcess) { $watchdogProcess.Id } else { $null }
    durableRecoveryUsed = $durableRecoveryUsed
    actionResult = $actionResult
})
