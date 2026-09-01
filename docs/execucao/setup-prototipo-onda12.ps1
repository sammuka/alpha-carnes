#Requires -Version 7
<#
Clona/atualiza o repo canônico do protótipo e fixa ALPHACARNES_PROTOTYPE_PATH.
Uso: pwsh -File setup-prototipo-onda12.ps1 [-ParentDir D:\Projetos]
Pré-requisito: convite de colaborador em sammuka/alpha-carnes-prototipo já aceito.
#>
param(
    [string]$ParentDir = 'D:\Projetos',
    [string]$RepoUrl = 'https://github.com/sammuka/alpha-carnes-prototipo.git',
    [string]$Branch = 'main'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git não encontrado no PATH. Instale o Git for Windows e reabra o terminal antes de rodar este script."
}

$prototypePath = Join-Path $ParentDir 'alpha-carnes-prototipo'

if (Test-Path (Join-Path $prototypePath '.git')) {
    Write-Host "Repo já existe em $prototypePath — atualizando."
    git -C $prototypePath fetch origin
    git -C $prototypePath checkout $Branch
    git -C $prototypePath pull --ff-only origin $Branch
} else {
    New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
    git clone --branch $Branch $RepoUrl $prototypePath
}

[Environment]::SetEnvironmentVariable('ALPHACARNES_PROTOTYPE_PATH', $prototypePath, 'User')
$env:ALPHACARNES_PROTOTYPE_PATH = $prototypePath

Write-Host "OK: ALPHACARNES_PROTOTYPE_PATH = $prototypePath"
Write-Host "Abra um novo terminal (ou reinicie a sessão do agente) para herdar a env var persistida."
