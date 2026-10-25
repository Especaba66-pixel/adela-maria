# Arranca la app (lo lanza Windows al iniciar sesión). Si se cae, la tarea programada la vuelve a lanzar.
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz
$env:NODE_ENV = "production"
pnpm --filter @adela/web start *>> "$Raiz\infra\windows\app.log"
