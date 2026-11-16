<#
  Actualiza la app a la última versión aprobada (rama «main»). Ejecutar en PowerShell desde la carpeta del proyecto:
      powershell -ExecutionPolicy Bypass -File infra\windows\actualizar.ps1
  Antes de actualizar hace una copia de seguridad. Pase lo que pase, la app se vuelve a encender al terminar.
  Con -Auto (lo usa la tarea programada de cada noche) no hace nada si no hay versión nueva y guarda lo que pasa en
  infra\windows\actualizar.log.
#>
param([switch]$Auto)
$ErrorActionPreference = "Stop"
# Los programas externos (git, pnpm) no paran el script al fallar: se comprueba cada uno.
function Comprobar($texto) { if ($LASTEXITCODE -ne 0) { throw "$texto. La app sigue con la versión anterior en la copia de hoy." } }
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz
if ($Auto) {
  try { Start-Transcript -Path "$PSScriptRoot\actualizar.log" -Append | Out-Null } catch { }
  # Sin internet o sin versión nueva no se toca nada (así no se para la app para nada).
  try {
    git fetch origin main 2>$null
    if ($LASTEXITCODE -ne 0) { throw "sin conexión" }
    if ((git rev-parse HEAD) -eq (git rev-parse origin/main)) { Write-Host "$(Get-Date -Format s) Sin versión nueva."; try { Stop-Transcript | Out-Null } catch { }; exit 0 }
  } catch { Write-Host "$(Get-Date -Format s) No se pudo comprobar si hay versión nueva ($_)."; try { Stop-Transcript | Out-Null } catch { }; exit 0 }
}
# Mientras se actualiza, el arranque automático (instalación sin administrador) no relanza la app.
New-Item -ItemType File -Force "$PSScriptRoot\actualizando" | Out-Null
$Fallo = $null
try {
& "$PSScriptRoot\copia.ps1"
Stop-ScheduledTask -TaskName "Adela María - App" -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
git fetch origin main
git checkout main
git pull --ff-only origin main; Comprobar "No se pudo descargar la versión nueva"
pnpm install --frozen-lockfile; Comprobar "Falló la instalación de las piezas de la app"
pnpm build; Comprobar "Falló la preparación de la app"
pnpm db:migrate; Comprobar "Falló la preparación de la base de datos"
pnpm db:seed; Comprobar "Falló la carga de los datos iniciales"
} catch {
  # Si algo falla, no se deja la app apagada: se vuelve a encender abajo y se cuenta qué pasó.
  $Fallo = $_
} finally {
  Remove-Item "$PSScriptRoot\actualizando" -Force -ErrorAction SilentlyContinue
}
if (Get-ScheduledTask -TaskName "Adela María - App" -ErrorAction SilentlyContinue) {
  Start-ScheduledTask -TaskName "Adela María - App"
} else {
  # Instalación sin administrador: el arranque automático vuelve a lanzar la app solo; si no estaba en marcha, se lanza.
  if (-not (Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object { $_.CommandLine -like "*arrancar-usuario*" })) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSScriptRoot\arrancar-usuario.ps1`""
  }
}
if ($Fallo) {
  Write-Host "No se pudo actualizar: $($Fallo.Exception.Message)" -ForegroundColor Red
  if ($Auto) { try { Stop-Transcript | Out-Null } catch { } }
  exit 1
}
Write-Host "Actualizada." -ForegroundColor Green
if ($Auto) { try { Stop-Transcript | Out-Null } catch { } }
