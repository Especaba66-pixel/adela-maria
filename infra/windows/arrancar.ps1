# Arranca la app (lo lanza Windows al iniciar sesión) y la vigila: si se para, la vuelve a lanzar a los pocos segundos.
# No lanza otra si ya hay una en marcha (puerto 3000 ocupado) ni mientras se actualiza.
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz
$env:NODE_ENV = "production"
# Justo después de instalar, el Programador de tareas aún no ve la ruta de Node (hasta reiniciar): se añade aquí.
foreach ($Ruta in @("C:\Program Files\nodejs", (Join-Path $env:APPDATA "npm"))) {
  if ((Test-Path $Ruta) -and ($env:Path -notlike "*$Ruta*")) { $env:Path = "$Ruta;$env:Path" }
}
while ($true) {
  $Ocupado = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ((Test-Path "$Raiz\infra\windows\actualizando") -or $Ocupado) { Start-Sleep -Seconds 20; continue }
  "$(Get-Date -Format s) Arrancando la app" | Out-File -Append -Encoding UTF8 "$Raiz\infra\windows\app.log"
  pnpm --filter @adela/web start *>> "$Raiz\infra\windows\app.log"
  Start-Sleep -Seconds 5
}
