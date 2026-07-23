#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [ValidateSet('acquire', 'release', 'status')]
    [string]$Command,

    [Parameter(Mandatory, Position = 1)]
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,127}$')]
    [string]$Name,

    [ValidateSet('coordinator', 'planner', 'monitor', 'executor', 'worker', 'test')]
    [string]$Role = 'coordinator',

    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')]
    [string]$RunId = 'manual',

    [string]$Token,

    [ValidateRange(1, 86400)]
    [int]$StaleAfterSeconds = 1800,

    [ValidateRange(0, 86400)]
    [int]$MaxWaitSeconds = 900,

    [ValidateRange(25, 10000)]
    [int]$PollMilliseconds = 1000,

    [ValidateRange(1, 600)]
    [int]$StealGuardStaleSeconds = 30,

    [string]$RuntimeRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Json {
    param([Parameter(Mandatory)]$Value)
    $Value | ConvertTo-Json -Depth 8 -Compress
}

function Assert-ChildPath {
    param(
        [Parameter(Mandatory)][string]$Parent,
        [Parameter(Mandatory)][string]$Child
    )
    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $childFull = [IO.Path]::GetFullPath($Child)
    $prefix = $parentFull + [IO.Path]::DirectorySeparatorChar
    if (-not $childFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho fora da raiz permitida: $childFull"
    }
    $childFull
}

function Read-Owner {
    param([Parameter(Mandatory)][string]$Path)
    $ownerPath = Join-Path $Path 'owner.json'
    if (-not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) {
        return $null
    }
    try {
        Get-Content -Raw -Encoding utf8 -LiteralPath $ownerPath | ConvertFrom-Json
    } catch {
        $null
    }
}

function Get-OwnerStamp {
    param($Owner, [string]$Path)
    if ($Owner -and $Owner.acquiredAtUtc) {
        $value = $Owner.acquiredAtUtc
        if ($value -is [DateTimeOffset]) {
            return $value
        }
        if ($value -is [DateTime]) {
            return [DateTimeOffset]$value
        }
        return [DateTimeOffset]::Parse(
            [string]$value,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        )
    }
    [DateTimeOffset](Get-Item -LiteralPath $Path).LastWriteTimeUtc
}

function Get-GuardStamp {
    param($Guard, [string]$Path)
    if ($Guard -and $Guard.acquiredAtUtc) {
        try {
            return [DateTimeOffset]::Parse(
                [string]$Guard.acquiredAtUtc,
                [Globalization.CultureInfo]::InvariantCulture,
                [Globalization.DateTimeStyles]::RoundtripKind
            )
        } catch {
            # Metadata incompleto usa o timestamp do diretório e nunca é roubado imediatamente.
        }
    }
    [DateTimeOffset](Get-Item -LiteralPath $Path).LastWriteTimeUtc
}

function Read-Guard {
    param([Parameter(Mandatory)][string]$Path)
    $guardPath = Join-Path $Path 'guard.json'
    if (-not (Test-Path -LiteralPath $guardPath -PathType Leaf)) {
        return $null
    }
    try {
        Get-Content -Raw -Encoding utf8 -LiteralPath $guardPath | ConvertFrom-Json
    } catch {
        $null
    }
}

function Test-SameOwner {
    param($Before, $After)
    if (-not $Before -or -not $After) {
        return (-not $Before -and -not $After)
    }
    ([string]$Before.token -ceq [string]$After.token) -and
        ([string]$Before.acquiredAtUtc -ceq [string]$After.acquiredAtUtc) -and
        ([string]$Before.runId -ceq [string]$After.runId)
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $repoRoot '.codex\runtime'
}
$runtimeFull = Assert-ChildPath -Parent $repoRoot -Child $RuntimeRoot
$locksRoot = Assert-ChildPath -Parent $runtimeFull -Child (Join-Path $runtimeFull 'locks')
$lockPath = Assert-ChildPath -Parent $locksRoot -Child (Join-Path $locksRoot "$Name.lock")
$stealPath = Assert-ChildPath -Parent $locksRoot -Child (Join-Path $locksRoot "$Name.lock.steal")
$stealMutexPath = Assert-ChildPath -Parent $locksRoot -Child (
    Join-Path $locksRoot "$Name.lock.steal.mutex"
)
New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null

switch ($Command) {
    'acquire' {
        $deadline = [DateTimeOffset]::UtcNow.AddSeconds($MaxWaitSeconds)
        while ($true) {
            $stealMutex = $null
            try {
                $stealMutex = [IO.File]::Open(
                    $stealMutexPath,
                    [IO.FileMode]::OpenOrCreate,
                    [IO.FileAccess]::ReadWrite,
                    [IO.FileShare]::None
                )
            } catch {
                if ([DateTimeOffset]::UtcNow -ge $deadline) {
                    Write-Json ([ordered]@{
                        status = 'timeout'
                        name = $Name
                        path = $lockPath
                        owner = Read-Owner -Path $lockPath
                    })
                    return
                }
                Start-Sleep -Milliseconds $PollMilliseconds
                continue
            }

            try {
                if (Test-Path -LiteralPath $stealPath -PathType Container) {
                    $guard = Read-Guard -Path $stealPath
                    $guardStamp = Get-GuardStamp -Guard $guard -Path $stealPath
                    if (([DateTimeOffset]::UtcNow - $guardStamp).TotalSeconds -gt
                        $StealGuardStaleSeconds) {
                        $recoveryPath = Assert-ChildPath -Parent $locksRoot -Child (
                            Join-Path $locksRoot (
                                "$Name.lock.steal.recovery.$([Guid]::NewGuid().ToString('N'))"
                            )
                        )
                        [IO.Directory]::Move($stealPath, $recoveryPath)
                        $guardAfterMove = Read-Guard -Path $recoveryPath
                        if (-not (Test-SameOwner -Before $guard -After $guardAfterMove)) {
                            [IO.Directory]::Move($recoveryPath, $stealPath)
                            throw "Ownership do guard '$Name' mudou durante a recuperação."
                        }
                        [IO.Directory]::Delete($recoveryPath, $true)
                        continue
                    }
                }

                if (-not (Test-Path -LiteralPath $stealPath)) {
                    try {
                        New-Item -ItemType Directory -Path $lockPath -ErrorAction Stop | Out-Null
                        $newToken = [Guid]::NewGuid().ToString('N')
                        $owner = [ordered]@{
                            schemaVersion = 1
                            name = $Name
                            token = $newToken
                            runId = $RunId
                            role = $Role
                            pid = $PID
                            host = [Environment]::MachineName
                            acquiredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
                        }
                        [IO.File]::WriteAllText(
                            (Join-Path $lockPath 'owner.json'),
                            ($owner | ConvertTo-Json -Depth 4),
                            [Text.UTF8Encoding]::new($false)
                        )
                        Write-Json ([ordered]@{
                            status = 'acquired'
                            name = $Name
                            token = $newToken
                            path = $lockPath
                            owner = $owner
                        })
                        return
                    } catch {
                        # Outra instância pode criar e liberar o diretório entre
                        # o New-Item e este catch. ResourceExists é contenção
                        # normal mesmo quando o lock já desapareceu; deixe o
                        # fluxo abaixo respeitar timeout/poll antes de tentar
                        # novamente, sem converter a colisão em erro terminal.
                        if ($_.CategoryInfo.Category -ne
                            [Management.Automation.ErrorCategory]::ResourceExists -and
                            -not (Test-Path -LiteralPath $lockPath -PathType Container)) {
                            throw
                        }
                    }
                }

                $owner = Read-Owner -Path $lockPath
                $lockExists = Test-Path -LiteralPath $lockPath -PathType Container
                $age = if ($lockExists) {
                    $stamp = Get-OwnerStamp -Owner $owner -Path $lockPath
                    ([DateTimeOffset]::UtcNow - $stamp).TotalSeconds
                } else {
                    0
                }

                if ($lockExists -and $age -gt $StaleAfterSeconds) {
                    $guardToken = [Guid]::NewGuid().ToString('N')
                    New-Item -ItemType Directory -Path $stealPath -ErrorAction Stop | Out-Null
                    $guardOwner = [ordered]@{
                        schemaVersion = 1
                        name = $Name
                        token = $guardToken
                        runId = $RunId
                        role = $Role
                        pid = $PID
                        host = [Environment]::MachineName
                        acquiredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
                    }
                    [IO.File]::WriteAllText(
                        (Join-Path $stealPath 'guard.json'),
                        ($guardOwner | ConvertTo-Json -Depth 4),
                        [Text.UTF8Encoding]::new($false)
                    )
                    try {
                        $ownerAfterGuard = Read-Owner -Path $lockPath
                        $stampAfterGuard = if (Test-Path -LiteralPath $lockPath) {
                            Get-OwnerStamp -Owner $ownerAfterGuard -Path $lockPath
                        } else {
                            [DateTimeOffset]::UtcNow
                        }
                        $stillStale = (Test-Path -LiteralPath $lockPath) -and
                            (([DateTimeOffset]::UtcNow - $stampAfterGuard).TotalSeconds -gt $StaleAfterSeconds)
                        if ($stillStale -and (Test-SameOwner -Before $owner -After $ownerAfterGuard)) {
                            $orphanPath = Assert-ChildPath -Parent $locksRoot -Child (
                                Join-Path $locksRoot "$Name.lock.orphan.$([Guid]::NewGuid().ToString('N'))"
                            )
                            [IO.Directory]::Move($lockPath, $orphanPath)
                            [IO.Directory]::Delete($orphanPath, $true)
                        }
                    } finally {
                        if (Test-Path -LiteralPath $stealPath) {
                            $ownedGuard = Read-Guard -Path $stealPath
                            if ($ownedGuard -and [string]$ownedGuard.token -ceq $guardToken) {
                                [IO.Directory]::Delete($stealPath, $true)
                            }
                        }
                    }
                    continue
                }

                if ([DateTimeOffset]::UtcNow -ge $deadline) {
                    Write-Json ([ordered]@{
                        status = 'timeout'
                        name = $Name
                        path = $lockPath
                        owner = $owner
                    })
                    return
                }
            } finally {
                $stealMutex.Dispose()
            }
            Start-Sleep -Milliseconds $PollMilliseconds
        }
    }

    'release' {
        if (-not (Test-Path -LiteralPath $lockPath -PathType Container)) {
            Write-Json ([ordered]@{ status = 'already-released'; name = $Name; path = $lockPath })
            return
        }
        if ([string]::IsNullOrWhiteSpace($Token)) {
            throw 'Token é obrigatório para liberar um lock existente.'
        }
        $owner = Read-Owner -Path $lockPath
        if (-not $owner -or [string]$owner.token -cne $Token) {
            Write-Json ([ordered]@{
                status = 'ownership-mismatch'
                name = $Name
                path = $lockPath
                owner = $owner
            })
            throw "O token informado não é proprietário do lock '$Name'."
        }
        $releasePath = Assert-ChildPath -Parent $locksRoot -Child (
            Join-Path $locksRoot "$Name.lock.release.$Token"
        )
        $releaseDeadline = [DateTimeOffset]::UtcNow.AddSeconds(5)
        while ($true) {
            try {
                [IO.Directory]::Move($lockPath, $releasePath)
                break
            } catch {
                $releaseError = $_.Exception.GetBaseException()
                if ($releaseError -isnot [IO.IOException] -and
                    $releaseError -isnot [UnauthorizedAccessException]) {
                    throw
                }
                if ((Test-Path -LiteralPath $releasePath -PathType Container) -and
                    -not (Test-Path -LiteralPath $lockPath -PathType Container)) {
                    break
                }
                if ([DateTimeOffset]::UtcNow -ge $releaseDeadline) {
                    throw
                }
                $ownerDuringRetry = Read-Owner -Path $lockPath
                if ($ownerDuringRetry -and
                    [string]$ownerDuringRetry.token -cne $Token) {
                    throw "Ownership do lock '$Name' mudou durante a liberação."
                }
                Start-Sleep -Milliseconds 25
            }
        }
        $cleanupDeadline = [DateTimeOffset]::UtcNow.AddSeconds(5)
        while ($true) {
            try {
                [IO.Directory]::Delete($releasePath, $true)
                break
            } catch {
                $cleanupError = $_.Exception.GetBaseException()
                if ($cleanupError -isnot [IO.IOException] -and
                    $cleanupError -isnot [UnauthorizedAccessException]) {
                    throw
                }
                if (-not (Test-Path -LiteralPath $releasePath)) {
                    break
                }
                if ([DateTimeOffset]::UtcNow -ge $cleanupDeadline) {
                    throw
                }
                Start-Sleep -Milliseconds 25
            }
        }
        Write-Json ([ordered]@{ status = 'released'; name = $Name; token = $Token; path = $lockPath })
    }

    'status' {
        $exists = Test-Path -LiteralPath $lockPath -PathType Container
        Write-Json ([ordered]@{
            status = if ($exists) { 'locked' } else { 'free' }
            name = $Name
            path = $lockPath
            owner = if ($exists) { Read-Owner -Path $lockPath } else { $null }
        })
    }
}
