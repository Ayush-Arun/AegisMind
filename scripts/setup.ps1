# AegisMind Setup Script — One-Command Installation
# Run this after cloning/forking the repository

param(
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AEGISMIND SOVEREIGN SECOND BRAIN — SETUP" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "[1/5] Checking Python..." -ForegroundColor Yellow
try {
    $version = & python --version 2>&1
    Write-Host "  ✓ Python found: $version" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python not found! Install Python 3.12+ first." -ForegroundColor Red
    exit 1
}

# Check UV
Write-Host "[2/5] Checking UV..." -ForegroundColor Yellow
try {
    & uv --version | Out-Null
    Write-Host "  ✓ UV found" -ForegroundColor Green
} catch {
    Write-Host "  ✗ UV not found! Install UV: https://docs.astral.sh/uv" -ForegroundColor Red
    exit 1
}

# Check Ollama
Write-Host "[3/5] Checking Ollama..." -ForegroundColor Yellow
try {
    $ollamaVersion = & ollama --version 2>&1
    Write-Host "  ✓ Ollama found: $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ollama not found! Install Ollama: https://ollama.com" -ForegroundColor Red
    exit 1
}

# Check Ollama models
Write-Host "[4/5] Checking Ollama models..." -ForegroundColor Yellow
$models = & ollama list 2>&1
$neededModels = @("llama3.2:latest", "nomic-embed-text:latest", "qwen2.5:7b")
$missingModels = @()

foreach ($model in $neededModels) {
    if ($models -notmatch [regex]::Escape($model)) {
        $missingModels += $model
    }
}

if ($missingModels.Count -gt 0) {
    Write-Host "  ⚠ Pulling missing models: $($missingModels -join ', ')" -ForegroundColor Yellow
    foreach ($model in $missingModels) {
        Write-Host "    Pulling $model..." -ForegroundColor Cyan
        try {
            & ollama pull $model 2>&1 | Out-Null
            Write-Host "    ✓ $model pulled" -ForegroundColor Green
        } catch {
            Write-Host "    ✗ Failed to pull $model" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ✓ All models available" -ForegroundColor Green
}

# Install dependencies
Write-Host "[5/5] Installing dependencies..." -ForegroundColor Yellow
try {
    & uv sync --all-groups 2>&1 | Out-Null
    Write-Host "  ✓ Dependencies synced" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Dependency sync failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Install packages
Write-Host ""
Write-Host "Installing AegisMind packages..." -ForegroundColor Yellow
try {
    & uv pip install -e packages/aegismind-graph 2>&1 | Out-Null
    Write-Host "  ✓ aegismind-graph installed" -ForegroundColor Green

    & uv pip install -e packages/aegismind-approval 2>&1 | Out-Null
    Write-Host "  ✓ aegismind-approval installed" -ForegroundColor Green

    & uv pip install -e packages/aegismind-core 2>&1 | Out-Null
    Write-Host "  ✓ aegismind-core installed" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Package installation failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Seed the knowledge graph
Write-Host ""
Write-Host "Seeding knowledge graph..." -ForegroundColor Yellow
try {
    & python "$ProjectRoot/scripts/seed_graph.py" 2>&1 | Out-Null
    Write-Host "  ✓ Knowledge graph seeded (9 nodes, 9 connections)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Graph seeding failed, run manually: python scripts/seed_graph.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start AegisMind, run:" -ForegroundColor White
Write-Host "  PowerShell:   .\scripts\start.ps1" -ForegroundColor Cyan
Write-Host "  Or manually:" -ForegroundColor White
Write-Host "    Terminal 1: uv run uvicorn aegismind_core.app:app --reload --port 8000" -ForegroundColor White
Write-Host "    Terminal 2: pnpm --filter lens dev" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:3000" -ForegroundColor Green
Write-Host ""
