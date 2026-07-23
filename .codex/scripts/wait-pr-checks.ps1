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
    [string]$FixturePath,
    [string]$Repository,

    # Injeção exclusiva para testes locais; omitida em uso real.
    [string]$GhCommandPath = 'gh'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Gh {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [int[]]$AcceptedExitCodes = @(0)
    )
    $savedGhRepo = $env:GH_REPO
    try {
        if (-not [string]::IsNullOrWhiteSpace($Repository)) {
            $env:GH_REPO = $Repository
        }
        $output = @(& $GhCommandPath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        if ($null -eq $savedGhRepo) {
            Remove-Item Env:GH_REPO -ErrorAction SilentlyContinue
        } else {
            $env:GH_REPO = $savedGhRepo
        }
    }
    if ($exitCode -notin $AcceptedExitCodes) {
        throw "gh $($Arguments -join ' ') falhou com exit code $exitCode`: $($output -join ' ')"
    }
    $output
}

function Get-ChangedFiles {
    param(
        [Parameter(Mandatory)][int]$Number,
        [Parameter(Mandatory)][int]$ExpectedCount
    )
    $endpoint = "repos/{owner}/{repo}/pulls/$Number/files?per_page=100"
    $raw = Invoke-Gh -Arguments @('api', '--paginate', '--slurp', $endpoint)
    try {
        $pages = ($raw -join "`n") | ConvertFrom-Json -NoEnumerate
    } catch {
        throw "gh api retornou JSON inválido para arquivos do PR #$Number`: $($_.Exception.Message)"
    }
    if ($pages -isnot [Array]) {
        throw "gh api não retornou uma coleção paginada para arquivos do PR #$Number."
    }
    $files = [Collections.Generic.List[string]]::new()
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($page in $pages) {
        if ($page -isnot [Array]) {
            throw "gh api retornou página malformada para arquivos do PR #$Number."
        }
        foreach ($file in $page) {
            if (-not $file -or
                -not $file.PSObject.Properties['filename'] -or
                $file.filename -isnot [string] -or
                [string]::IsNullOrWhiteSpace($file.filename)) {
                throw "gh api retornou item sem filename no PR #$Number."
            }
            $filename = $file.filename
            if (-not $seen.Add($filename)) {
                throw "gh api retornou filename duplicado no PR #$Number`: $filename"
            }
            $files.Add($filename)
        }
    }
    if ($files.Count -ne $ExpectedCount) {
        throw (
            "Enumeração incompleta dos arquivos do PR #$Number`: API retornou $($files.Count), " +
            "gh pr view declarou $ExpectedCount."
        )
    }
    @($files)
}

function Get-Snapshot {
    if (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
        return Get-Content -Raw -Encoding utf8 -LiteralPath $FixturePath | ConvertFrom-Json
    }
    $checksRaw = Invoke-Gh -Arguments @(
        'pr', 'checks', [string]$PrNumber,
        '--json', 'name,state,bucket,workflow,link'
    ) -AcceptedExitCodes @(0, 1, 8)
    $checksText = ($checksRaw -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($checksText) -or
        $checksText -match '^no checks reported') {
        # Janela transitória logo após push: tratar como conjunto vazio mantém
        # o estado pending/fail-closed até os checks obrigatórios aparecerem.
        $checks = @()
    } else {
        try {
            $checks = @($checksText | ConvertFrom-Json)
        } catch {
            throw "gh pr checks retornou saída não-JSON inesperada: $checksText"
        }
    }
    $prRaw = Invoke-Gh -Arguments @(
        'pr', 'view', [string]$PrNumber,
        '--json', 'headRefOid,headRefName,baseRefName,changedFiles'
    )
    $pr = ($prRaw -join "`n") | ConvertFrom-Json
    if (-not $pr.PSObject.Properties['changedFiles'] -or
        $pr.changedFiles -isnot [long] -or
        $pr.changedFiles -lt 0 -or
        $pr.changedFiles -gt [int]::MaxValue) {
        throw "gh pr view não informou changedFiles para o PR #$PrNumber."
    }
    $changedFiles = @(Get-ChangedFiles -Number $PrNumber -ExpectedCount ([int]$pr.changedFiles))
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
