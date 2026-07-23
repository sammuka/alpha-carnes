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

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) {
    $RuntimeRoot = Join-Path $repoRoot '.codex\runtime'
}
$runtimeFull = Assert-ChildPath -Parent $repoRoot -Child $RuntimeRoot
$locksRoot = Assert-ChildPath -Parent $runtimeFull -Child (Join-Path $runtimeFull 'locks')
$lockPath = Assert-ChildPath -Parent $locksRoot -Child (Join-Path $locksRoot "$Name.lock")
$stealPath = Assert-ChildPath -Parent $locksRoot -Child (Join-Path $locksRoot "$Name.lock.steal")
New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null

switch ($Command) {
    'acquire' {
        $deadline = [DateTimeOffset]::UtcNow.AddSeconds($MaxWaitSeconds)
        while ($true) {
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
                    if (-not (Test-Path -LiteralPath $lockPath -PathType Container)) {
                        throw
                    }
                }
            }

            $owner = Read-Owner -Path $lockPath
            $stamp = Get-OwnerStamp -Owner $owner -Path $lockPath
            $age = ([DateTimeOffset]::UtcNow - $stamp).TotalSeconds

            if ($age -gt $StaleAfterSeconds) {
                try {
                    New-Item -ItemType Directory -Path $stealPath -ErrorAction Stop | Out-Null
                    try {
                        $ownerAfterGuard = Read-Owner -Path $lockPath
                        $stampAfterGuard = if (Test-Path -LiteralPath $lockPath) {
                            Get-OwnerStamp -Owner $ownerAfterGuard -Path $lockPath
                        } else {
                            [DateTimeOffset]::UtcNow
                        }
                        $stillStale = (Test-Path -LiteralPath $lockPath) -and
                            (([DateTimeOffset]::UtcNow - $stampAfterGuard).TotalSeconds -gt $StaleAfterSeconds)
                        if ($stillStale) {
                            $orphanPath = Assert-ChildPath -Parent $locksRoot -Child (
                                Join-Path $locksRoot "$Name.lock.orphan.$([Guid]::NewGuid().ToString('N'))"
                            )
                            [IO.Directory]::Move($lockPath, $orphanPath)
                            [IO.Directory]::Delete($orphanPath, $true)
                        }
                    } finally {
                        if (Test-Path -LiteralPath $stealPath) {
                            [IO.Directory]::Delete($stealPath, $false)
                        }
                    }
                    continue
                } catch {
                    if (-not (Test-Path -LiteralPath $stealPath)) {
                        throw
                    }
                }
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
        [IO.Directory]::Move($lockPath, $releasePath)
        [IO.Directory]::Delete($releasePath, $true)
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
