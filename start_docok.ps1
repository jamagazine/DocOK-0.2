# 1. Запуск Python-сервера в отдельном окне
Write-Host "Запуск Backend сервера..." -ForegroundColor Green
Start-Process powershell -ArgumentList "cd server; python -m uvicorn main:app --reload --port 8000"

# 2. Запуск Frontend интерфейса
Write-Host "Запуск Frontend (Vite)..." -ForegroundColor Cyan
pnpm dev