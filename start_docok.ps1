# DocOK Launcher Script
# UTF-8 encoding

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# 1. Start Backend server in separate window
Write-Host "Starting Backend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "chcp 65001 | Out-Null; cd '$PSScriptRoot\server'; & '$PSScriptRoot\venv\Scripts\python.exe' -m uvicorn main:app --reload --port 8000"

# Wait for backend to start
Start-Sleep -Seconds 2

# 2. Start Frontend
Write-Host "Starting Frontend (Vite)..." -ForegroundColor Cyan
pnpm dev
