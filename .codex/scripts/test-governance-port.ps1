#requires -Version 7.0
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Test-Case {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Body
    )
    try {
        & $Body
        $script:Passed++
        Write-Host "PASS $Name"
    } catch {
        $script:Failed++
        Write-Host "FAIL $Name :: $($_.Exception.Message)"
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Write-Utf8Json {
    param([string]$Path, $Value)
    [IO.File]::WriteAllText(
        $Path,
        ($Value | ConvertTo-Json -Depth 12),
        [Text.UTF8Encoding]::new($false)
    )
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtimeBase = Join-Path $repoRoot '.codex\runtime'
$testRoot = Join-Path $runtimeBase "tests\$([Guid]::NewGuid().ToString('N'))"
$testRootFull = [IO.Path]::GetFullPath($testRoot)
if (-not $testRootFull.StartsWith(
    [IO.Path]::GetFullPath($runtimeBase).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "Raiz de teste insegura: $testRootFull"
}
New-Item -ItemType Directory -Force -Path $testRootFull | Out-Null

$lockScript = Join-Path $PSScriptRoot 'lock.ps1'
$checkpointScript = Join-Path $PSScriptRoot 'checkpoint.ps1'
$visibilityScript = Join-Path $PSScriptRoot 'visibility-ci.ps1'
$waitChecksScript = Join-Path $PSScriptRoot 'wait-pr-checks.ps1'
$invokeWaveScript = Join-Path $PSScriptRoot 'invoke-onda.ps1'
$invokeMultiScript = Join-Path $PSScriptRoot 'invoke-multionda.ps1'

try {
    Test-Case 'PowerShell parser' {
        foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
            $tokens = $null
            $errors = $null
            [void][Management.Automation.Language.Parser]::ParseFile(
                $file.FullName,
                [ref]$tokens,
                [ref]$errors
            )
            $messages = @($errors | ForEach-Object { $_.Message })
            Assert-True ($errors.Count -eq 0) "$($file.Name): $($messages -join '; ')"
        }
    }

    Test-Case 'JSON schema parses' {
        $schema = Get-Content -Raw -Encoding utf8 -LiteralPath (
            Join-Path $repoRoot '.codex\schemas\ciclo-onda-result.schema.json'
        ) | ConvertFrom-Json
        Assert-True ($schema.type -eq 'object') 'Schema não é objeto.'
        Assert-True ($schema.required.Count -ge 10) 'Schema final incompleto.'
    }

    Test-Case 'Agents and skills are discoverable artifacts' {
        foreach ($role in @('planner', 'monitor', 'executor', 'worker')) {
            $path = Join-Path $repoRoot ".codex\agents\$role.toml"
            $content = Get-Content -Raw -Encoding utf8 -LiteralPath $path
            Assert-True ($content -match "name\s*=\s*`"$role`"") "Agente $role sem name."
            Assert-True ($content -match 'developer_instructions\s*=\s*"""') "Agente $role sem instruções."
        }
        foreach ($skill in @('gate-plano', 'gate-pr', 'disparar-onda')) {
            $path = Join-Path $repoRoot ".agents\skills\$skill\SKILL.md"
            $content = Get-Content -Raw -Encoding utf8 -LiteralPath $path
            Assert-True ($content -match "(?m)^name:\s+$skill$") "Skill $skill sem nome."
            Assert-True ($content -match '(?m)^description:\s+\S') "Skill $skill sem descrição."
            Assert-True (
                Test-Path -LiteralPath (Join-Path $repoRoot ".agents\skills\$skill\agents\openai.yaml")
            ) "Skill $skill sem openai.yaml."
        }
    }

    Test-Case 'Runtime ignored but declarative artifacts tracked' {
        & git -C $repoRoot check-ignore -q --no-index '.codex/runtime/probe'
        Assert-True ($LASTEXITCODE -eq 0) '.codex/runtime não está ignorado.'
        & git -C $repoRoot check-ignore -q --no-index '.codex/agents/monitor.toml'
        Assert-True ($LASTEXITCODE -ne 0) '.codex/agents foi ignorado indevidamente.'
        & git -C $repoRoot check-ignore -q --no-index '.agents/skills/gate-pr/SKILL.md'
        Assert-True ($LASTEXITCODE -ne 0) '.agents/skills foi ignorado indevidamente.'
    }

    Test-Case 'Lock ownership and exclusion' {
        $firstRaw = & pwsh -NoProfile -File $lockScript acquire test-lock -Role test `
            -RunId test-lock -MaxWaitSeconds 0 -RuntimeRoot $testRootFull
        Assert-True ($LASTEXITCODE -eq 0) 'Primeira aquisição falhou.'
        $first = $firstRaw | ConvertFrom-Json
        Assert-True ($first.status -eq 'acquired') 'Primeira aquisição não retornou acquired.'

        $secondRaw = & pwsh -NoProfile -File $lockScript acquire test-lock -Role test `
            -RunId competitor -MaxWaitSeconds 0 -RuntimeRoot $testRootFull 2>$null
        Assert-True ($LASTEXITCODE -eq 0) 'Consulta de disputa não deveria quebrar o helper.'
        $second = $secondRaw | Select-Object -First 1 | ConvertFrom-Json
        Assert-True ($second.status -eq 'timeout') 'Disputa não retornou timeout.'

        $wrongRaw = & pwsh -NoProfile -File $lockScript release test-lock -Role test `
            -RunId competitor -Token wrong -RuntimeRoot $testRootFull 2>$null
        Assert-True ($LASTEXITCODE -ne 0) 'Token incorreto deveria falhar.'
        $wrong = $wrongRaw | Select-Object -First 1 | ConvertFrom-Json
        Assert-True ($wrong.status -eq 'ownership-mismatch') 'Token incorreto não foi detectado.'

        $released = & pwsh -NoProfile -File $lockScript release test-lock -Role test `
            -RunId test-lock -Token $first.token -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($released.status -eq 'released') 'Liberação correta falhou.'
    }

    Test-Case 'Checkpoint append-only and idempotent' {
        $init = & $checkpointScript init -RunId test-checkpoint -Wave onda1 -Stage implementation `
            -Role test -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($init.status -eq 'recorded') 'Init não foi registrado.'
        $record = & $checkpointScript record -RunId test-checkpoint -Wave onda1 `
            -Stage implementation -StepId task-1 -Status completed -Role test `
            -Message 'Task concluída.' -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($record.status -eq 'recorded') 'Passo não foi registrado.'
        $duplicate = & $checkpointScript record -RunId test-checkpoint -Wave onda1 `
            -Stage implementation -StepId task-1 -Status completed -Role test `
            -Message 'Repetição.' -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($duplicate.status -eq 'duplicate') 'Idempotência não detectou duplicata.'
        $read = & $checkpointScript read -RunId test-checkpoint -Wave onda1 `
            -Stage implementation -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($read.entries.Count -eq 2) 'Checkpoint deveria conter duas entradas.'
    }

    $canonicalChecks = @(
        'lint', 'type-check', 'test-backend', 'coverage',
        'test-frontend', 'build', 'audit', 'secret-scan'
    ) | ForEach-Object {
        [ordered]@{ name = $_; state = 'SUCCESS'; bucket = 'pass'; workflow = 'CI'; link = '' }
    }

    Test-Case 'Application PR ignores Vercel' {
        $fixture = Join-Path $testRootFull 'ci-app.json'
        Write-Utf8Json -Path $fixture -Value ([ordered]@{
            headRefOid = 'abc'
            headRefName = 'feature/onda1-app'
            baseRefName = 'develop'
            changedFiles = @('app/frontend/src/page.tsx')
            checks = @($canonicalChecks) + @(
                [ordered]@{ name = 'Vercel'; state = 'FAILURE'; bucket = 'fail'; workflow = ''; link = '' }
            )
        })
        $result = & $waitChecksScript -PrNumber 1 -FixturePath $fixture | ConvertFrom-Json
        Assert-True ($result.status -eq 'green') 'PR de app foi bloqueado pelo Vercel.'
        Assert-True (-not $result.landingChanged) 'landingChanged deveria ser falso.'
    }

    Test-Case 'Landing PR requires Vercel' {
        $fixture = Join-Path $testRootFull 'ci-landing.json'
        Write-Utf8Json -Path $fixture -Value ([ordered]@{
            headRefOid = 'def'
            headRefName = 'feature/landing'
            baseRefName = 'develop'
            changedFiles = @('landing/js/index.js')
            checks = @($canonicalChecks) + @(
                [ordered]@{ name = 'Vercel'; state = 'FAILURE'; bucket = 'fail'; workflow = ''; link = '' }
            )
        })
        $result = & $waitChecksScript -PrNumber 2 -FixturePath $fixture | ConvertFrom-Json
        Assert-True ($result.status -eq 'failed') 'PR de landing deveria falhar com Vercel vermelho.'
        Assert-True ($result.landingChanged) 'landingChanged deveria ser verdadeiro.'
    }

    Test-Case 'Visibility wrapper fixture never mutates repository' {
        $fixture = Join-Path $testRootFull 'ci-wrapper.json'
        Write-Utf8Json -Path $fixture -Value ([ordered]@{
            headRefOid = 'ghi'
            headRefName = 'feature/onda1-app'
            baseRefName = 'develop'
            changedFiles = @('app/backend/src/main.ts')
            checks = @($canonicalChecks)
        })
        $result = & $visibilityScript -PrNumber 3 -FixturePath $fixture | ConvertFrom-Json
        Assert-True ($result.mode -eq 'fixture') 'Wrapper não entrou em fixture.'
        Assert-True ($result.visibilityChanged -eq $false) 'Fixture não pode mudar visibilidade.'
        Assert-True ($result.checks.status -eq 'green') 'Fixture deveria resultar verde.'
    }

    Test-Case 'Visibility wrapper dry-run describes private lease' {
        $result = & $visibilityScript -PrNumber 3 -Repository 'owner/repo' -DryRun |
            ConvertFrom-Json
        Assert-True ($result.mode -eq 'dry-run') 'Wrapper não entrou em dry-run.'
        Assert-True ($result.realMutation -eq $false) 'Dry-run não pode mutar.'
        Assert-True ($result.visibilitySequence[0] -match 'PRIVATE') 'Preflight privado ausente.'
        Assert-True ($result.timeoutSeconds -eq 1500) 'Watchdog deve usar 25 minutos.'
    }

    Test-Case 'Visibility lease cannot exceed 25 minutes' {
        $failed = $false
        try {
            $null = & $visibilityScript -PrNumber 3 -Repository 'owner/repo' -DryRun `
                -TimeoutSeconds 1501
        } catch {
            $failed = $true
        }
        Assert-True $failed 'Lease maior que 25 minutos deveria ser rejeitado.'
    }

    Test-Case 'Wave invocation dry-run' {
        $result = & $invokeWaveScript -Wave onda1 -DryRun -RuntimeRoot $testRootFull |
            ConvertFrom-Json
        Assert-True ($result.status -eq 'dry-run') 'Dry-run de onda falhou.'
        Assert-True ($result.autoMerge -eq $false) 'AutoMerge deve ser opt-in.'
    }

    Test-Case 'Multiwave reads dependency graph from status table' {
        $statusPath = Join-Path $testRootFull 'EXECUCAO-STATUS.md'
        $lines = @(
            '| Onda | Escopo | Depende de | Status | Plano |',
            '|---|---|---|---|---|',
            '| 1 | A | — | aguardando_portao1 | plano1 |',
            '| 2 | B | 1 | aguardando_inicio | plano2 |',
            '| 3 | C | 2 | aguardando_inicio | plano3 |',
            '| 4 | D | 3 | aguardando_inicio | plano4 |',
            '| 5 | E | 3 | aguardando_inicio | plano5 |',
            '| 6 | F | 4, 5 | aguardando_inicio | plano6 |',
            '| 7 | G | 6 | aguardando_inicio | plano7 |',
            '| 8 | H | 7 | aguardando_inicio | plano8 |',
            '| 9 | I | 7 | aguardando_inicio | plano9 |',
            '| 10 | J | 8, 9 | aguardando_inicio | plano10 |'
        )
        [IO.File]::WriteAllLines($statusPath, $lines, [Text.UTF8Encoding]::new($false))
        $result = & $invokeMultiScript -DryRun -StatusPath $statusPath `
            -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($result.eligible.Count -eq 1) 'Deveria haver uma onda elegível.'
        Assert-True ($result.eligible[0] -eq 'onda1') 'Onda1 deveria ser elegível.'
    }

    Test-Case 'Multiwave drains active jobs at wave limit' {
        $statusPath = Join-Path $testRootFull 'EXECUCAO-STATUS-CONCURRENT.md'
        $lines = @(
            '| Onda | Escopo | Depende de | Status | Plano |',
            '|---|---|---|---|---|',
            '| 1 | A | — | aguardando_portao1 | plano1 |',
            '| 2 | B | — | aguardando_portao1 | plano2 |',
            '| 3 | C | 2 | aguardando_inicio | plano3 |',
            '| 4 | D | 3 | aguardando_inicio | plano4 |',
            '| 5 | E | 3 | aguardando_inicio | plano5 |',
            '| 6 | F | 4, 5 | aguardando_inicio | plano6 |',
            '| 7 | G | 6 | aguardando_inicio | plano7 |',
            '| 8 | H | 7 | aguardando_inicio | plano8 |',
            '| 9 | I | 7 | aguardando_inicio | plano9 |',
            '| 10 | J | 8, 9 | aguardando_inicio | plano10 |'
        )
        [IO.File]::WriteAllLines($statusPath, $lines, [Text.UTF8Encoding]::new($false))
        $fakeInvoke = Join-Path $testRootFull 'fake-invoke-onda.ps1'
        $fakeLines = @(
            'param([string]$Wave, [string]$RuntimeRoot, [switch]$AutoMerge, [switch]$AdoptOrphan)',
            'if ($Wave -eq ''onda2'') { Start-Sleep -Milliseconds 300 }',
            '[ordered]@{ wave = $Wave; result = ''merged''; message = ''fixture'' } |',
            '    ConvertTo-Json -Compress'
        )
        [IO.File]::WriteAllLines($fakeInvoke, $fakeLines, [Text.UTF8Encoding]::new($false))
        $result = & $invokeMultiScript -StatusPath $statusPath -RuntimeRoot $testRootFull `
            -InvokeWavePath $fakeInvoke -MaxConcurrency 2 -MaxWaves 2 | ConvertFrom-Json
        Assert-True ($result.attempted.Count -eq 2) 'Duas ondas deveriam ser iniciadas.'
        Assert-True ($result.completed.Count -eq 2) 'Jobs ativos devem ser drenados antes da saída.'
    }

    Test-Case 'Documented ports are fixed' {
        $agents = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $repoRoot 'AGENTS.md')
        foreach ($port in @('4000', '4001', '15433', '3000', '3001', '5432')) {
            Assert-True ($agents.Contains($port)) "Porta $port ausente em AGENTS.md."
        }
    }
} finally {
    if (Test-Path -LiteralPath $testRootFull) {
        Remove-Item -Recurse -Force -LiteralPath $testRootFull
    }
}

Write-Host "RESULT passed=$script:Passed failed=$script:Failed"
if ($script:Failed -gt 0) {
    throw "$script:Failed teste(s) falharam."
}
