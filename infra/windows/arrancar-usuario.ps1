# Arranque de la instalación sin administrador (instalar-sin-admin.ps1). Lo lanza el acceso de la carpeta Inicio
# de Windows al iniciar sesión: arranca la base de datos y la app, y si la app se cae la vuelve a lanzar.
$Base = Join-Path $env:LOCALAPPDATA "AdelaMaria"
$H = Join-Path $Base "herramientas"
$PgBin = Join-Path $H "pgsql\bin"
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
$env:Path = "$H\node;$H\git\cmd;$PgBin;$env:Path"
& "$PgBin\pg_ctl.exe" -D "$Base\datos" status *> $null
if ($LASTEXITCODE -ne 0) { & "$PgBin\pg_ctl.exe" -D "$Base\datos" -l "$Base\postgres.log" -o "-p 5432" -w start *> $null }
while ($true) {
  $ocupado = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ((Test-Path "$Raiz\infra\windows\actualizando") -or $ocupado) { Start-Sleep -Seconds 20; continue }
  & "$PSScriptRoot\arrancar.ps1"
  Start-Sleep -Seconds 5
}
