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
$invokeRoleScript = Join-Path $PSScriptRoot 'invoke-role.ps1'
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
        foreach ($name in @('ciclo-onda-result.schema.json', 'role-result.schema.json')) {
            $schema = Get-Content -Raw -Encoding utf8 -LiteralPath (
                Join-Path $repoRoot ".codex\schemas\$name"
            ) | ConvertFrom-Json
            Assert-True ($schema.type -eq 'object') "Schema $name não é objeto."
            Assert-True ($schema.required.Count -ge 10) "Schema $name incompleto."
        }
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
            Assert-True ($content -match "(?m)^name:\s+$skill\r?$") "Skill $skill sem nome."
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

    Test-Case 'Lock recovers crashed steal guard only after guard becomes stale' {
        $locksRoot = Join-Path $testRootFull 'locks'
        New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null
        $guardPath = Join-Path $locksRoot 'guard-crash.lock.steal'
        New-Item -ItemType Directory -Path $guardPath | Out-Null
        Write-Utf8Json -Path (Join-Path $guardPath 'guard.json') -Value ([ordered]@{
            schemaVersion = 1
            name = 'guard-crash'
            token = 'crashed-guard-token'
            runId = 'dead-run'
            role = 'test'
            pid = 999999
            host = [Environment]::MachineName
            acquiredAtUtc = [DateTimeOffset]::UtcNow.AddMinutes(-5).ToString('o')
        })
        $acquired = & $lockScript acquire guard-crash -Role test -RunId recovery `
            -MaxWaitSeconds 2 -PollMilliseconds 25 -StealGuardStaleSeconds 1 `
            -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($acquired.status -eq 'acquired') 'Guard órfão não foi recuperado.'
        Assert-True (-not (Test-Path -LiteralPath $guardPath)) 'Guard órfão permaneceu.'
        $released = & $lockScript release guard-crash -Role test -RunId recovery `
            -Token $acquired.token -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($released.status -eq 'released') 'Lock recuperado não foi liberado.'
    }

    Test-Case 'Lock quarantines only the stale owner observed before guarded steal' {
        $locksRoot = Join-Path $testRootFull 'locks'
        New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null
        $lockPath = Join-Path $locksRoot 'stale-owner.lock'
        New-Item -ItemType Directory -Path $lockPath | Out-Null
        Write-Utf8Json -Path (Join-Path $lockPath 'owner.json') -Value ([ordered]@{
            schemaVersion = 1
            name = 'stale-owner'
            token = 'old-owner-token'
            runId = 'old-run'
            role = 'test'
            pid = 999999
            host = [Environment]::MachineName
            acquiredAtUtc = [DateTimeOffset]::UtcNow.AddMinutes(-5).ToString('o')
        })
        $acquired = & $lockScript acquire stale-owner -Role test -RunId new-run `
            -StaleAfterSeconds 1 -StealGuardStaleSeconds 30 -MaxWaitSeconds 2 `
            -PollMilliseconds 25 -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($acquired.status -eq 'acquired') 'Owner stale não foi substituído.'
        Assert-True ($acquired.owner.runId -eq 'new-run') 'Novo owner não ficou registrado.'
        Assert-True (
            -not (Test-Path -LiteralPath (Join-Path $locksRoot 'stale-owner.lock.steal'))
        ) 'Guard de steal ficou órfão após sucesso.'
        $released = & $lockScript release stale-owner -Role test -RunId new-run `
            -Token $acquired.token -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($released.status -eq 'released') 'Novo owner não liberou o lock.'
    }

    Test-Case 'Live steal guard blocks acquisition without lock directory' {
        $locksRoot = Join-Path $testRootFull 'locks'
        New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null
        $guardPath = Join-Path $locksRoot 'guard-live.lock.steal'
        New-Item -ItemType Directory -Path $guardPath | Out-Null
        Write-Utf8Json -Path (Join-Path $guardPath 'guard.json') -Value ([ordered]@{
            schemaVersion = 1
            name = 'guard-live'
            token = 'live-guard-token'
            runId = 'live-run'
            role = 'test'
            pid = $PID
            host = [Environment]::MachineName
            acquiredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        })
        $blocked = & $lockScript acquire guard-live -Role test -RunId competitor `
            -MaxWaitSeconds 0 -StealGuardStaleSeconds 60 -RuntimeRoot $testRootFull |
            ConvertFrom-Json
        Assert-True ($blocked.status -eq 'timeout') 'Guard vivo deveria bloquear aquisição.'
        $guard = Get-Content -Raw -Encoding utf8 -LiteralPath (
            Join-Path $guardPath 'guard.json'
        ) | ConvertFrom-Json
        Assert-True ($guard.token -eq 'live-guard-token') 'Competidor alterou ownership do guard.'
    }

    Test-Case 'Exclusive steal mutex closes recovery and guard replacement race' {
        $locksRoot = Join-Path $testRootFull 'locks'
        New-Item -ItemType Directory -Force -Path $locksRoot | Out-Null
        $mutexPath = Join-Path $locksRoot 'mutex-race.lock.steal.mutex'
        $held = [IO.File]::Open(
            $mutexPath,
            [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None
        )
        try {
            $blocked = & $lockScript acquire mutex-race -Role test -RunId competitor `
                -MaxWaitSeconds 0 -RuntimeRoot $testRootFull | ConvertFrom-Json
            Assert-True (
                $blocked.status -eq 'timeout'
            ) 'Competidor entrou na seção de recuperação com mutex exclusivo ativo.'
        } finally {
            $held.Dispose()
        }
        $acquired = & $lockScript acquire mutex-race -Role test -RunId owner `
            -MaxWaitSeconds 1 -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($acquired.status -eq 'acquired') 'Mutex liberado não permitiu aquisição.'
        $null = & $lockScript release mutex-race -Role test -RunId owner `
            -Token $acquired.token -RuntimeRoot $testRootFull
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

    Test-Case 'Checkpoint detects interrupted JSONL tail' {
        $init = & $checkpointScript init -RunId test-interrupted -Wave onda1 `
            -Stage implementation -Role test -RuntimeRoot $testRootFull | ConvertFrom-Json
        [IO.File]::AppendAllText(
            [string]$init.path,
            '{"schemaVersion":',
            [Text.UTF8Encoding]::new($false)
        )
        $beforeLength = (Get-Item -LiteralPath $init.path).Length
        $read = & $checkpointScript read -RunId test-interrupted -Wave onda1 `
            -Stage implementation -Role test -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($read.status -eq 'corrupt') 'Cauda parcial deveria retornar corrupt.'
        Assert-True ($read.tailPartial -eq $true) 'Cauda interrompida deveria ser marcada partial.'
        Assert-True ($read.entries.Count -eq 1) 'Entradas válidas anteriores devem ser preservadas.'
        $write = & $checkpointScript record -RunId test-interrupted -Wave onda1 `
            -Stage implementation -StepId after-corruption -Status completed -Role test `
            -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($write.status -eq 'corrupt') 'Escrita sobre cauda parcial deve falhar fechada.'
        Assert-True (
            (Get-Item -LiteralPath $init.path).Length -eq $beforeLength
        ) 'Checkpoint corrupto não pode receber append.'
    }

    Test-Case 'Checkpoint serializes concurrent writers and coherent read' {
        $null = & $checkpointScript init -RunId test-concurrent -Wave onda2 `
            -Stage implementation -Role test -RuntimeRoot $testRootFull
        $jobs = @(
            foreach ($number in 1..8) {
                Start-Job -ArgumentList @(
                    $checkpointScript,
                    $testRootFull,
                    $number
                ) -ScriptBlock {
                    param($Script, $RuntimeRoot, $Number)
                    & $Script record -RunId test-concurrent -Wave onda2 -Stage implementation `
                        -StepId "writer-$Number" -Status completed -Role test `
                        -RuntimeRoot $RuntimeRoot
                }
            }
        )
        try {
            # Start-Job cria processos pwsh completos; runners Linux frios podem
            # levar mais de 30 s apenas para inicializar oito workers.
            $null = Wait-Job -Job $jobs -Timeout 90
            Assert-True (
                @($jobs | Where-Object { $_.State -ne 'Completed' }).Count -eq 0
            ) "Writers concorrentes não terminaram: $(
                @($jobs | ForEach-Object { $_.State }) -join ','
            )."
            foreach ($raw in @(Receive-Job -Job $jobs)) {
                $result = [string]$raw | ConvertFrom-Json
                Assert-True ($result.status -eq 'recorded') 'Writer concorrente não registrou.'
            }
        } finally {
            Remove-Job -Job $jobs -Force -ErrorAction SilentlyContinue
        }
        $read = & $checkpointScript read -RunId test-concurrent -Wave onda2 `
            -Stage implementation -Role test -RuntimeRoot $testRootFull | ConvertFrom-Json
        Assert-True ($read.status -eq 'read') 'Leitura coerente deveria retornar read.'
        Assert-True ($read.entries.Count -eq 9) 'Init mais oito writers deveriam estar presentes.'
        Assert-True (
            @($read.entries.stepId | Sort-Object -Unique).Count -eq 9
        ) 'Checkpoint concorrente contém perda ou duplicação.'
    }

    Test-Case 'Independent role wrapper accepts runtime evidence and binds identity' {
        $events = Join-Path $testRootFull 'role-events-ok.jsonl'
        $resultPath = Join-Path $testRootFull 'role-result-ok.json'
        [IO.File]::WriteAllLines(
            $events,
            @(
                '{"type":"thread.started","thread_id":"thread-monitor-1"}',
                '{"type":"turn.started"}',
                '{"type":"item.completed","item":{"type":"agent_message","text":"done"}}',
                '{"type":"turn.completed","usage":{}}'
            ),
            [Text.UTF8Encoding]::new($false)
        )
        Write-Utf8Json -Path $resultPath -Value ([ordered]@{
            schemaVersion = 1
            runId = 'role-test'
            wave = 'onda1'
            role = 'monitor'
            stage = 'gate1'
            result = 'approved'
            planPath = 'docs/plan.md'
            planSha256 = 'abc'
            branch = ''
            prNumber = $null
            auditedHeadSha = ''
            squashSha = ''
            message = 'Aprovado por fixture.'
        })
        $envelope = & $invokeRoleScript -Role monitor -Stage gate1 -Wave onda1 `
            -RunId role-test -Prompt fixture -RuntimeRoot $testRootFull `
            -FixtureEventsPath $events -FixtureResultPath $resultPath | ConvertFrom-Json
        Assert-True (
            $envelope.mechanism -eq 'independent-codex-exec-process'
        ) 'Mecanismo independente não foi atestado.'
        Assert-True ($envelope.threadId -eq 'thread-monitor-1') 'Thread do runtime não foi ligada.'
        Assert-True ($envelope.result.role -eq 'monitor') 'Identidade do papel não foi validada.'
    }

    Test-Case 'Independent role wrapper rejects self-declared output without thread evidence' {
        $events = Join-Path $testRootFull 'role-events-no-thread.jsonl'
        $resultPath = Join-Path $testRootFull 'role-result-no-thread.json'
        [IO.File]::WriteAllLines(
            $events,
            @('{"type":"turn.started"}', '{"type":"turn.completed","usage":{}}'),
            [Text.UTF8Encoding]::new($false)
        )
        Write-Utf8Json -Path $resultPath -Value ([ordered]@{
            schemaVersion = 1
            runId = 'role-no-thread'
            wave = 'onda1'
            role = 'monitor'
            stage = 'gate1'
            result = 'approved'
            planPath = ''
            planSha256 = ''
            branch = ''
            prNumber = $null
            auditedHeadSha = ''
            squashSha = ''
            message = 'Alegação sem evidência.'
        })
        $failed = $false
        try {
            $null = & $invokeRoleScript -Role monitor -Stage gate1 -Wave onda1 `
                -RunId role-no-thread -Prompt fixture -RuntimeRoot $testRootFull `
                -FixtureEventsPath $events -FixtureResultPath $resultPath
        } catch {
            $failed = $_.Exception.Message -match 'thread.started'
        }
        Assert-True $failed 'Saída auto-declarada sem thread deveria falhar fechada.'
    }

    Test-Case 'Independent role wrapper rejects hidden internal delegation' {
        $events = Join-Path $testRootFull 'role-events-collab.jsonl'
        $resultPath = Join-Path $testRootFull 'role-result-collab.json'
        [IO.File]::WriteAllLines(
            $events,
            @(
                '{"type":"thread.started","thread_id":"thread-monitor-collab"}',
                '{"type":"turn.started"}',
                '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent"}}',
                '{"type":"turn.completed","usage":{}}'
            ),
            [Text.UTF8Encoding]::new($false)
        )
        Write-Utf8Json -Path $resultPath -Value ([ordered]@{
            schemaVersion = 1
            runId = 'role-collab'
            wave = 'onda1'
            role = 'monitor'
            stage = 'gate1'
            result = 'approved'
            planPath = ''
            planSha256 = ''
            branch = ''
            prNumber = $null
            auditedHeadSha = ''
            squashSha = ''
            message = 'Delegou indevidamente.'
        })
        $failed = $false
        try {
            $null = & $invokeRoleScript -Role monitor -Stage gate1 -Wave onda1 `
                -RunId role-collab -Prompt fixture -RuntimeRoot $testRootFull `
                -FixtureEventsPath $events -FixtureResultPath $resultPath
        } catch {
            $failed = $_.Exception.Message -match 'tentou delegar'
        }
        Assert-True $failed 'Delegação interna deveria falhar fechada.'
    }

    $canonicalChecks = @(
        'lint', 'type-check', 'test-backend', 'coverage',
        'test-frontend', 'build', 'audit', 'secret-scan'
    ) | ForEach-Object {
        [ordered]@{ name = $_; state = 'SUCCESS'; bucket = 'pass'; workflow = 'CI'; link = '' }
    }

    $prFilesMock = Join-Path $testRootFull 'gh-pr-files-mock.ps1'
    $prFilesLog = Join-Path $testRootFull 'gh-pr-files-calls.log'
    $prFilesMockSource = @'
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Remaining)
Add-Content -LiteralPath $env:CODEX_PR_FILES_LOG -Value ($Remaining -join ' ')
if ($Remaining.Count -ge 2 -and $Remaining[0] -eq 'pr' -and $Remaining[1] -eq 'checks') {
    if ($env:CODEX_PR_FILES_MODE -eq 'no-checks') {
        Write-Output 'no checks reported on the ''feature/transient'' branch'
        exit 1
    }
    $checks = @(
        'lint', 'type-check', 'test-backend', 'coverage',
        'test-frontend', 'build', 'audit', 'secret-scan', 'Vercel'
    ) | ForEach-Object {
        [ordered]@{
            name = $_
            state = 'SUCCESS'
            bucket = 'pass'
            workflow = if ($_ -eq 'Vercel') { '' } else { 'CI' }
            link = ''
        }
    }
    $checks | ConvertTo-Json -Depth 5 -Compress
    exit 0
}
if ($Remaining.Count -ge 2 -and $Remaining[0] -eq 'pr' -and $Remaining[1] -eq 'view') {
    $changedFiles = if ($env:CODEX_PR_FILES_MODE -eq 'bad-count-string') {
        '1'
    } elseif ($env:CODEX_PR_FILES_MODE -eq 'bad-count-bool') {
        $true
    } elseif ($env:CODEX_PR_FILES_MODE -match '^bad-filename-') {
        1
    } elseif ($env:CODEX_PR_FILES_MODE -eq 'no-checks') {
        1
    } else {
        301
    }
    [ordered]@{
        headRefOid = 'large-pr-sha'
        headRefName = 'feature/large-pr'
        baseRefName = 'develop'
        changedFiles = $changedFiles
    } | ConvertTo-Json -Compress
    exit 0
}
if ($Remaining.Count -ge 1 -and $Remaining[0] -eq 'api') {
    if ($env:CODEX_PR_FILES_MODE -eq 'error') {
        Write-Output 'HTTP 503 fixture'
        exit 86
    }
    if ($env:CODEX_PR_FILES_MODE -match '^bad-filename-') {
        $badFilename = if ($env:CODEX_PR_FILES_MODE -eq 'bad-filename-number') {
            123
        } else {
            [ordered]@{ nested = 'a' }
        }
        $badPages = [Collections.Generic.List[object]]::new()
        $badPages.Add(@([ordered]@{ filename = $badFilename }))
        ConvertTo-Json -InputObject @($badPages) -Depth 6 -Compress
        exit 0
    }
    $count = if ($env:CODEX_PR_FILES_MODE -eq 'incomplete') {
        300
    } elseif ($env:CODEX_PR_FILES_MODE -eq 'no-checks') {
        1
    } else {
        301
    }
    $allFiles = @(
        foreach ($index in 1..$count) {
            [ordered]@{
                filename = if ($index -eq 301) {
                    'landing/src/cliente.tsx'
                } else {
                    "app/backend/src/generated/file-$index.ts"
                }
            }
        }
    )
    $pages = [Collections.Generic.List[object]]::new()
    for ($offset = 0; $offset -lt $allFiles.Count; $offset += 100) {
        $last = [Math]::Min($offset + 99, $allFiles.Count - 1)
        $pages.Add(@($allFiles[$offset..$last]))
    }
    ConvertTo-Json -InputObject @($pages) -Depth 6 -Compress
    exit 0
}
exit 87
'@
    [IO.File]::WriteAllText(
        $prFilesMock,
        $prFilesMockSource,
        [Text.UTF8Encoding]::new($false)
    )

    Test-Case 'PR files API paginates beyond 300 and still detects landing' {
        [IO.File]::WriteAllText($prFilesLog, '', [Text.UTF8Encoding]::new($false))
        $savedMode = $env:CODEX_PR_FILES_MODE
        $savedLog = $env:CODEX_PR_FILES_LOG
        try {
            $env:CODEX_PR_FILES_MODE = 'full'
            $env:CODEX_PR_FILES_LOG = $prFilesLog
            $result = & $waitChecksScript -PrNumber 9 -GhCommandPath $prFilesMock |
                ConvertFrom-Json
            Assert-True ($result.status -eq 'green') 'PR grande com checks verdes deveria passar.'
            Assert-True ($result.changedFiles.Count -eq 301) 'Paginação perdeu arquivos após 300.'
            Assert-True $result.landingChanged 'Arquivo landing na quarta página não foi detectado.'
            $calls = Get-Content -Raw -LiteralPath $prFilesLog
            Assert-True (
                $calls -match 'api --paginate --slurp repos/\{owner\}/\{repo\}/pulls/9/files\?per_page=100'
            ) 'Chamada REST não usou paginação e slurp.'
            Assert-True ($calls -notmatch 'pr diff') 'Caminho sujeito a HTTP 406 ainda foi usado.'
        } finally {
            $env:CODEX_PR_FILES_MODE = $savedMode
            $env:CODEX_PR_FILES_LOG = $savedLog
        }
    }

    Test-Case 'Transient PR without reported checks remains pending' {
        $savedMode = $env:CODEX_PR_FILES_MODE
        $savedLog = $env:CODEX_PR_FILES_LOG
        try {
            $env:CODEX_PR_FILES_MODE = 'no-checks'
            $env:CODEX_PR_FILES_LOG = $prFilesLog
            $result = & $waitChecksScript -PrNumber 9 -GhCommandPath $prFilesMock |
                ConvertFrom-Json
            Assert-True ($result.status -eq 'pending') (
                'Janela sem checks deveria permanecer pending.'
            )
            Assert-True ($result.requiredMissing.Count -eq 8) (
                'Os oito checks obrigatórios deveriam constar como ausentes.'
            )
            Assert-True (-not $result.landingChanged) (
                'Fixture transitória não deveria envolver landing.'
            )
        } finally {
            $env:CODEX_PR_FILES_MODE = $savedMode
            $env:CODEX_PR_FILES_LOG = $savedLog
        }
    }

    Test-Case 'PR files API error fails closed' {
        $savedMode = $env:CODEX_PR_FILES_MODE
        $savedLog = $env:CODEX_PR_FILES_LOG
        try {
            $env:CODEX_PR_FILES_MODE = 'error'
            $env:CODEX_PR_FILES_LOG = $prFilesLog
            $message = ''
            try {
                $null = & $waitChecksScript -PrNumber 9 -GhCommandPath $prFilesMock
            } catch {
                $message = $_.Exception.Message
            }
            Assert-True (
                $message -match 'gh api .*exit code 86'
            ) 'Erro REST não interrompeu o gate com diagnóstico.'
        } finally {
            $env:CODEX_PR_FILES_MODE = $savedMode
            $env:CODEX_PR_FILES_LOG = $savedLog
        }
    }

    Test-Case 'PR files count mismatch fails closed' {
        $savedMode = $env:CODEX_PR_FILES_MODE
        $savedLog = $env:CODEX_PR_FILES_LOG
        try {
            $env:CODEX_PR_FILES_MODE = 'incomplete'
            $env:CODEX_PR_FILES_LOG = $prFilesLog
            $message = ''
            try {
                $null = & $waitChecksScript -PrNumber 9 -GhCommandPath $prFilesMock
            } catch {
                $message = $_.Exception.Message
            }
            Assert-True (
                $message -match 'Enumeração incompleta.*retornou 300.*declarou 301'
            ) 'Resposta truncada da API não falhou fechada.'
        } finally {
            $env:CODEX_PR_FILES_MODE = $savedMode
            $env:CODEX_PR_FILES_LOG = $savedLog
        }
    }

    Test-Case 'PR files rejects coerced filename and changedFiles types' {
        $savedMode = $env:CODEX_PR_FILES_MODE
        $savedLog = $env:CODEX_PR_FILES_LOG
        try {
            $env:CODEX_PR_FILES_LOG = $prFilesLog
            foreach ($case in @(
                [ordered]@{ mode = 'bad-filename-number'; pattern = 'item sem filename' },
                [ordered]@{ mode = 'bad-filename-object'; pattern = 'item sem filename' },
                [ordered]@{ mode = 'bad-count-string'; pattern = 'não informou changedFiles' },
                [ordered]@{ mode = 'bad-count-bool'; pattern = 'não informou changedFiles' }
            )) {
                $env:CODEX_PR_FILES_MODE = $case.mode
                $message = ''
                try {
                    $null = & $waitChecksScript -PrNumber 9 -GhCommandPath $prFilesMock
                } catch {
                    $message = $_.Exception.Message
                }
                Assert-True (
                    $message -match $case.pattern
                ) "Tipo inválido foi aceito em $($case.mode): $message"
            }
        } finally {
            $env:CODEX_PR_FILES_MODE = $savedMode
            $env:CODEX_PR_FILES_LOG = $savedLog
        }
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

    $ghMockRoot = Join-Path $testRootFull 'gh-mock'
    New-Item -ItemType Directory -Force -Path $ghMockRoot | Out-Null
    $ghMockScript = Join-Path $ghMockRoot 'gh-mock.ps1'
    $ghMockCmd = Join-Path $ghMockRoot 'gh.cmd'
    $ghMockSource = @'
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Remaining)
$statePath = $env:CODEX_GH_MOCK_STATE
$logPath = $env:CODEX_GH_MOCK_LOG
if ($Remaining.Count -ge 2 -and $Remaining[0] -eq 'auth' -and $Remaining[1] -eq 'status') {
    exit 0
}
if ($Remaining.Count -ge 2 -and $Remaining[0] -eq 'repo' -and $Remaining[1] -eq 'view') {
    $visibility = (Get-Content -Raw -LiteralPath $statePath).Trim()
    [ordered]@{ visibility = $visibility; nameWithOwner = 'owner/repo' } |
        ConvertTo-Json -Compress
    exit 0
}
if ($Remaining.Count -ge 2 -and $Remaining[0] -eq 'repo' -and $Remaining[1] -eq 'edit') {
    $visibilityIndex = [Array]::IndexOf($Remaining, '--visibility')
    if ($visibilityIndex -lt 0 -or $visibilityIndex + 1 -ge $Remaining.Count) {
        exit 31
    }
    $visibility = $Remaining[$visibilityIndex + 1].ToUpperInvariant()
    if ($visibility -eq 'PUBLIC') {
        $ready = @(Get-ChildItem -LiteralPath $env:CODEX_GH_MOCK_RUNTIME -Recurse `
            -Filter 'watchdog-ready.json' -ErrorAction SilentlyContinue)
        if ($ready.Count -eq 0) {
            Add-Content -LiteralPath $logPath -Value 'PUBLIC-BEFORE-WATCHDOG'
            exit 32
        }
    }
    if ($visibility -eq 'PRIVATE' -and $env:CODEX_GH_MOCK_FAIL_PRIVATE -eq '1') {
        Add-Content -LiteralPath $logPath -Value 'PRIVATE-FAILED'
        exit 33
    }
    if ($visibility -eq 'PRIVATE' -and
        -not [string]::IsNullOrWhiteSpace($env:CODEX_GH_MOCK_FAIL_PRIVATE_COUNT)) {
        $counterPath = $env:CODEX_GH_MOCK_PRIVATE_COUNTER
        $count = if (Test-Path -LiteralPath $counterPath) {
            [int](Get-Content -Raw -LiteralPath $counterPath)
        } else {
            0
        }
        $count++
        [IO.File]::WriteAllText(
            $counterPath,
            [string]$count,
            [Text.UTF8Encoding]::new($false)
        )
        if ($count -le [int]$env:CODEX_GH_MOCK_FAIL_PRIVATE_COUNT) {
            Add-Content -LiteralPath $logPath -Value "PRIVATE-FAILED-$count"
            exit 33
        }
    }
    [IO.File]::WriteAllText($statePath, $visibility, [Text.UTF8Encoding]::new($false))
    Add-Content -LiteralPath $logPath -Value $visibility
    exit 0
}
exit 34
'@
    [IO.File]::WriteAllText(
        $ghMockScript,
        $ghMockSource,
        [Text.UTF8Encoding]::new($false)
    )
    [IO.File]::WriteAllLines(
        $ghMockCmd,
        @(
            '@echo off',
            'pwsh -NoProfile -File "%~dp0gh-mock.ps1" %*',
            'exit /b %ERRORLEVEL%'
        ),
        [Text.ASCIIEncoding]::new()
    )
    $ghMockCommand = if ($IsWindows) { $ghMockCmd } else { $ghMockScript }

    Test-Case 'Visibility lease uses GH mock and waits for watchdog readiness' {
        $statePath = Join-Path $ghMockRoot 'state.txt'
        $logPath = Join-Path $ghMockRoot 'calls.log'
        [IO.File]::WriteAllText($statePath, 'PRIVATE', [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($logPath, '', [Text.UTF8Encoding]::new($false))
        $savedState = $env:CODEX_GH_MOCK_STATE
        $savedLog = $env:CODEX_GH_MOCK_LOG
        $savedRuntime = $env:CODEX_GH_MOCK_RUNTIME
        $savedFailPrivate = $env:CODEX_GH_MOCK_FAIL_PRIVATE
        try {
            $env:CODEX_GH_MOCK_STATE = $statePath
            $env:CODEX_GH_MOCK_LOG = $logPath
            $env:CODEX_GH_MOCK_RUNTIME = $testRootFull
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = '0'
            $result = & $visibilityScript -Repository 'owner/repo' -EnableVisibilityLease `
                -ActionScript {
                    $visibility = (Get-Content -Raw -LiteralPath $env:CODEX_GH_MOCK_STATE).Trim()
                    if ($visibility -ne 'PUBLIC') {
                        throw "Ação observou $visibility em vez de PUBLIC."
                    }
                    [ordered]@{ status = 'green'; source = 'mock' }
                } -RuntimeRoot $testRootFull -TimeoutSeconds 60 `
                -VisibilityRetryDelayMilliseconds 1 `
                -GhCommandPath $ghMockCommand | ConvertFrom-Json
            Assert-True ($result.watchdogReady -eq $true) 'Readiness do watchdog não foi confirmada.'
            Assert-True ($result.publicVerified -eq $true) 'PUBLIC não foi verificado no mock.'
            Assert-True ($result.privateRestored -eq $true) 'PRIVATE não foi restaurado no mock.'
            Assert-True (
                (Get-Content -Raw -LiteralPath $statePath).Trim() -eq 'PRIVATE'
            ) 'Estado final do mock deve ser PRIVATE.'
            $calls = @(Get-Content -LiteralPath $logPath | Where-Object { $_ })
            Assert-True (
                ($calls -join ',') -eq 'PUBLIC,PRIVATE'
            ) "Sequência de visibilidade inesperada: $($calls -join ',')."
        } finally {
            $env:CODEX_GH_MOCK_STATE = $savedState
            $env:CODEX_GH_MOCK_LOG = $savedLog
            $env:CODEX_GH_MOCK_RUNTIME = $savedRuntime
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = $savedFailPrivate
        }
    }

    Test-Case 'Visibility lease restores PRIVATE after primary action error' {
        $statePath = Join-Path $ghMockRoot 'state-primary.txt'
        $logPath = Join-Path $ghMockRoot 'calls-primary.log'
        [IO.File]::WriteAllText($statePath, 'PRIVATE', [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($logPath, '', [Text.UTF8Encoding]::new($false))
        $savedState = $env:CODEX_GH_MOCK_STATE
        $savedLog = $env:CODEX_GH_MOCK_LOG
        $savedRuntime = $env:CODEX_GH_MOCK_RUNTIME
        $savedFailPrivate = $env:CODEX_GH_MOCK_FAIL_PRIVATE
        try {
            $env:CODEX_GH_MOCK_STATE = $statePath
            $env:CODEX_GH_MOCK_LOG = $logPath
            $env:CODEX_GH_MOCK_RUNTIME = $testRootFull
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = '0'
            $message = ''
            try {
                $null = & $visibilityScript -Repository 'owner/repo' -EnableVisibilityLease `
                    -ActionScript { throw 'PRIMARY-MOCK' } -RuntimeRoot $testRootFull `
                    -TimeoutSeconds 60 -VisibilityRetryDelayMilliseconds 1 `
                    -GhCommandPath $ghMockCommand
            } catch {
                $message = $_.Exception.Message
            }
            Assert-True ($message -match 'PRIMARY-MOCK') 'Erro principal deveria ser preservado.'
            Assert-True (
                (Get-Content -Raw -LiteralPath $statePath).Trim() -eq 'PRIVATE'
            ) 'PRIVATE deve ser restaurado mesmo após erro principal.'
        } finally {
            $env:CODEX_GH_MOCK_STATE = $savedState
            $env:CODEX_GH_MOCK_LOG = $savedLog
            $env:CODEX_GH_MOCK_RUNTIME = $savedRuntime
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = $savedFailPrivate
        }
    }

    Test-Case 'Visibility watchdog persists beyond five failures and restores PRIVATE' {
        $statePath = Join-Path $ghMockRoot 'state-restore-failure.txt'
        $logPath = Join-Path $ghMockRoot 'calls-restore-failure.log'
        $counterPath = Join-Path $ghMockRoot 'private-counter.txt'
        [IO.File]::WriteAllText($statePath, 'PRIVATE', [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($logPath, '', [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($counterPath, '0', [Text.UTF8Encoding]::new($false))
        $savedState = $env:CODEX_GH_MOCK_STATE
        $savedLog = $env:CODEX_GH_MOCK_LOG
        $savedRuntime = $env:CODEX_GH_MOCK_RUNTIME
        $savedFailPrivate = $env:CODEX_GH_MOCK_FAIL_PRIVATE
        $savedFailCount = $env:CODEX_GH_MOCK_FAIL_PRIVATE_COUNT
        $savedCounter = $env:CODEX_GH_MOCK_PRIVATE_COUNTER
        try {
            $env:CODEX_GH_MOCK_STATE = $statePath
            $env:CODEX_GH_MOCK_LOG = $logPath
            $env:CODEX_GH_MOCK_RUNTIME = $testRootFull
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = '0'
            $env:CODEX_GH_MOCK_FAIL_PRIVATE_COUNT = '6'
            $env:CODEX_GH_MOCK_PRIVATE_COUNTER = $counterPath
            $message = ''
            try {
                $null = & $visibilityScript -Repository 'owner/repo' -EnableVisibilityLease `
                    -ActionScript { throw 'PRIMARY-MOCK' } -RuntimeRoot $testRootFull `
                    -TimeoutSeconds 60 -VisibilityRetryDelayMilliseconds 1 `
                    -RecoveryWaitSeconds 10 -GhCommandPath $ghMockCommand
            } catch {
                $message = $_.Exception.Message
            }
            Assert-True (
                $message -match 'PRIMARY-MOCK'
            ) 'Erro principal deve reaparecer após a recuperação durável.'
            Assert-True (
                [int](Get-Content -Raw -LiteralPath $counterPath) -ge 7
            ) 'Watchdog não continuou além das cinco tentativas síncronas.'
            Assert-True (
                (Get-Content -Raw -LiteralPath $statePath).Trim() -eq 'PRIVATE'
            ) 'Recuperação durável não confirmou PRIVATE.'
            $calls = @(Get-Content -LiteralPath $logPath | Where-Object { $_ })
            Assert-True (
                @($calls | Where-Object { $_ -match '^PRIVATE-FAILED-' }).Count -eq 6
            ) 'Número adversarial de falhas transitórias inesperado.'
        } finally {
            $env:CODEX_GH_MOCK_STATE = $savedState
            $env:CODEX_GH_MOCK_LOG = $savedLog
            $env:CODEX_GH_MOCK_RUNTIME = $savedRuntime
            $env:CODEX_GH_MOCK_FAIL_PRIVATE = $savedFailPrivate
            $env:CODEX_GH_MOCK_FAIL_PRIVATE_COUNT = $savedFailCount
            $env:CODEX_GH_MOCK_PRIVATE_COUNTER = $savedCounter
        }
    }

    Test-Case 'Wave invocation dry-run' {
        $result = & $invokeWaveScript -Wave onda1 -DryRun -RuntimeRoot $testRootFull |
            ConvertFrom-Json
        Assert-True ($result.status -eq 'dry-run') 'Dry-run de onda falhou.'
        Assert-True ($result.autoMerge -eq $false) 'AutoMerge deve ser opt-in.'
        Assert-True (
            $result.lockName -eq 'orchestration-onda-1'
        ) 'Lock externo deve ser orchestration-onda-N.'
        Assert-True (
            $result.functionalContextPath -match '^docs_v2/'
        ) 'Contexto funcional docs_v2 deve estar no preflight.'
        Assert-True (
            $result.mechanism -match 'independent codex exec process'
        ) 'Dry-run deve declarar processos Codex independentes.'
        Assert-True (
            $result.internalDelegation -match 'disabled'
        ) 'Delegação interna precisa estar desabilitada.'
        Assert-True (
            @($result.roleSequence | Where-Object { $_ -match '^monitor:' }).Count -ge 4
        ) 'Sequência deve incluir Monitores novos para gates e revisão adversarial.'
    }

    Test-Case 'Codex 0.145 accepts role isolation config' {
        $probe = @(& codex debug prompt-input -c 'features.multi_agent=false' `
            -c 'developer_instructions="role-probe"' 'probe')
        Assert-True ($LASTEXITCODE -eq 0) 'CLI rejeitou config de isolamento de papel.'
        Assert-True (
            ($probe -join "`n") -match 'role-probe'
        ) 'Developer instructions do papel não entraram no prompt efetivo.'
    }

    Test-Case 'Multiwave reads dependency graph from status table' {
        $statusPath = Join-Path $testRootFull 'EXECUCAO-STATUS.md'
        $lines = @(
            '| Onda | Escopo | Depende de | Status | Plano |',
            '|---|---|---|---|---|',
            '| 0 | Base | — | mergeada | plano0 |',
            '| 1 | A | 0 | aguardando_portao1 | plano1 |',
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
