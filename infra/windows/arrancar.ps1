# Arranca la app (lo lanza Windows al iniciar sesión). Si se cae, la tarea programada la vuelve a lanzar.
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz
$env:NODE_ENV = "production"
# Justo después de instalar, el Programador de tareas aún no ve la ruta de Node (hasta reiniciar): se añade aquí.
foreach ($Ruta in @("C:\Program Files\nodejs", (Join-Path $env:APPDATA "npm"))) {
  if ((Test-Path $Ruta) -and ($env:Path -notlike "*$Ruta*")) { $env:Path = "$Ruta;$env:Path" }
}
pnpm --filter @adela/web start *>> "$Raiz\infra\windows\app.log"
