<#
  Actualiza la app a la última versión aprobada (rama «main»). Ejecutar en PowerShell desde la carpeta del proyecto:
      powershell -ExecutionPolicy Bypass -File infra\windows\actualizar.ps1
  Antes de actualizar hace una copia de seguridad.
#>
$ErrorActionPreference = "Stop"
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz
& "$PSScriptRoot\copia.ps1"
Stop-ScheduledTask -TaskName "Adela María - App" -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
git fetch origin main
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm db:seed
Start-ScheduledTask -TaskName "Adela María - App"
Write-Host "Actualizada." -ForegroundColor Green
