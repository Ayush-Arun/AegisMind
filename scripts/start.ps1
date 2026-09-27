# AegisMind Start Script — Start all services

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AEGISMIND SOVEREIGN SECOND BRAIN — STARTING" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is running
try {
    $ollamaStatus = & curl -s http://localhost:11434/api/tags 2>&1
    if ($ollamaStatus) {
        Write-Host "  ✓ Ollama is running" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ Ollama not detected! Start it with: ollama serve" -ForegroundColor Yellow
    Write-Host "  Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Get the project root (parent of scripts/)
$ProjectRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

# Start backend
Write-Host ""
Write-Host "Starting backend API on port 8000..." -ForegroundColor Cyan
Start-Process "uv" -ArgumentList "run", "uvicorn", "aegismind_core.app:app", "--reload", "--port", "8000" -WorkingDirectory $ProjectRoot -WindowStyle Normal

Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend on port 3000..." -ForegroundColor Cyan
Start-Process "pnpm" -ArgumentList "--filter", "lens", "dev" -WorkingDirectory $ProjectRoot -WindowStyle Normal

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SERVICES STARTING..." -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:8000 (API Docs: http://localhost:8000/docs)" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C in each terminal to stop." -ForegroundColor Yellow
Write-Host ""

# Open browser
Start-Process "http://localhost:3000"
