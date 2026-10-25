<#
  Instala la app de Adela María en el TPV SIN permisos de administrador (para cuando se instala a distancia y nadie
  puede pulsar «Sí» en la ventana de permiso de Windows). Todo queda en la carpeta del usuario de Windows:
    - Programas (Git, Node.js y PostgreSQL portátiles): %LOCALAPPDATA%\AdelaMaria\herramientas
    - Base de datos: %LOCALAPPDATA%\AdelaMaria\datos
    - App: C:\AdelaMaria
  Arranca sola al iniciar sesión en Windows (carpeta Inicio) y hace la copia de seguridad cada día a las 14:30.
  Uso, en PowerShell normal (no hace falta «como administrador»):
    irm https://raw.githubusercontent.com/Especaba66-pixel/adela-maria/main/infra/windows/instalar-sin-admin.ps1 -OutFile $env:TEMP\instalar.ps1
    powershell -ExecutionPolicy Bypass -File $env:TEMP\instalar.ps1
  Se puede repetir sin miedo: lo que ya está hecho se salta.
#>
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Base = Join-Path $env:LOCALAPPDATA "AdelaMaria"
$H = Join-Path $Base "herramientas"
$Datos = Join-Path $Base "datos"
$Raiz = "C:\AdelaMaria"
New-Item -ItemType Directory -Force -Path $H | Out-Null

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Yellow }
function Fallo($texto) { Write-Host "`nERROR: $texto" -ForegroundColor Red; Write-Host "Haz una foto de esta pantalla y mándasela a Claude." -ForegroundColor Red; exit 1 }
function Comprobar($texto) { if ($LASTEXITCODE -ne 0) { Fallo $texto } }
function AlPath($dir) {
  $usuario = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $usuario) { $usuario = "" }
  if (($usuario -split ";") -notcontains $dir) {
    [Environment]::SetEnvironmentVariable("Path", (($usuario.TrimEnd(";") + ";" + $dir).TrimStart(";")), "User")
  }
  if (($env:Path -split ";") -notcontains $dir) { $env:Path = "$dir;$env:Path" }
}
function Descargar($url, $archivo) {
  try { Invoke-WebRequest -Uri $url -OutFile $archivo -UseBasicParsing -Headers @{ "User-Agent" = "adela-maria" }; return $true }
  catch { return $false }
}

# 1. Git portátil (MinGit, de los autores de Git para Windows)
$GitCmd = Join-Path $H "git\cmd"
if (-not (Test-Path "$GitCmd\git.exe") -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
  Paso "Descargando Git"
  try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -Headers @{ "User-Agent" = "adela-maria" }
  } catch { Fallo "No se pudo consultar la última versión de Git: $_" }
  $asset = $rel.assets | Where-Object { $_.name -match '^MinGit-[\d.]+-64-bit\.zip$' } | Select-Object -First 1
  if (-not $asset) { Fallo "No se encontró MinGit en la última versión de Git" }
  if (-not (Descargar $asset.browser_download_url "$H\git.zip")) { Fallo "No se pudo descargar Git" }
  if (Test-Path "$H\git") { Remove-Item -Recurse -Force "$H\git" }
  Expand-Archive -Path "$H\git.zip" -DestinationPath "$H\git" -Force
  Remove-Item "$H\git.zip"
}
if (Test-Path "$GitCmd\git.exe") { AlPath $GitCmd }

# 2. Node.js 22 portátil (la versión con la que se prueba la app)
$NodeDir = Join-Path $H "node"
if (-not (Test-Path "$NodeDir\node.exe")) {
  Paso "Descargando Node.js"
  try { $indice = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" } catch { Fallo "No se pudo consultar las versiones de Node.js: $_" }
  $v = ($indice | Where-Object { $_.version -like "v22.*" -and $_.files -contains "win-x64-zip" } | Select-Object -First 1).version
  if (-not $v) { Fallo "No se encontró Node.js 22" }
  if (-not (Descargar "https://nodejs.org/dist/$v/node-$v-win-x64.zip" "$H\node.zip")) { Fallo "No se pudo descargar Node.js $v" }
  if (Test-Path "$H\node-tmp") { Remove-Item -Recurse -Force "$H\node-tmp" }
  Expand-Archive -Path "$H\node.zip" -DestinationPath "$H\node-tmp" -Force
  Move-Item "$H\node-tmp\node-$v-win-x64" $NodeDir
  Remove-Item -Recurse -Force "$H\node-tmp", "$H\node.zip"
}
AlPath $NodeDir

# 3. PostgreSQL 16 portátil (los binarios oficiales de EDB, los mismos que usa el instalador normal)
$PgBin = Join-Path $H "pgsql\bin"
if (-not (Test-Path "$PgBin\pg_ctl.exe")) {
  Paso "Descargando PostgreSQL 16 (unos 300 MB, puede tardar)"
  $ok = $false
  foreach ($menor in 30..4) {
    if (Descargar "https://get.enterprisedb.com/postgresql/postgresql-16.$menor-1-windows-x64-binaries.zip" "$H\pg.zip") { $ok = $true; Write-Host "PostgreSQL 16.$menor"; break }
  }
  if (-not $ok) { Fallo "No se pudo descargar PostgreSQL 16" }
  if (Test-Path "$H\pgsql") { Remove-Item -Recurse -Force "$H\pgsql" }
  Expand-Archive -Path "$H\pg.zip" -DestinationPath $H -Force
  Remove-Item "$H\pg.zip"
  if (-not (Test-Path "$PgBin\pg_ctl.exe")) { Fallo "PostgreSQL no se descomprimió bien" }
}
AlPath $PgBin

# 4. Base de datos (en la carpeta del usuario) y arrancarla
if (-not (Test-Path "$Datos\PG_VERSION")) {
  Paso "Creando la base de datos"
  $ClavePg = Read-Host "Elige una contraseña para la base de datos (apúntala)"
  $Fichero = Join-Path $Base "clave.tmp"
  [IO.File]::WriteAllText($Fichero, $ClavePg)
  & "$PgBin\initdb.exe" -D $Datos -U postgres -A scram-sha-256 "--pwfile=$Fichero" -E UTF8 --no-locale
  $codigo = $LASTEXITCODE
  Remove-Item $Fichero -Force
  if ($codigo -ne 0) { Fallo "No se pudo crear la base de datos" }
} else {
  $ClavePg = Read-Host "Contraseña de la base de datos (la que elegiste la primera vez)"
}
& "$PgBin\pg_ctl.exe" -D $Datos status *> $null
if ($LASTEXITCODE -ne 0) {
  & "$PgBin\pg_ctl.exe" -D $Datos -l "$Base\postgres.log" -o "-p 5432" -w start
  Comprobar "No arranca la base de datos (mira $Base\postgres.log)"
}
$env:PGPASSWORD = $ClavePg
foreach ($bd in "adela", "adela_restauracion") {
  $existe = & "$PgBin\psql.exe" -U postgres -h localhost -tAc "select 1 from pg_database where datname = '$bd'"
  Comprobar "La contraseña de la base de datos no es correcta"
  if ($existe -ne "1") { & "$PgBin\psql.exe" -U postgres -h localhost -qc "create database $bd"; Comprobar "No se pudo crear la base $bd" }
}

# 5. Descargar la app
if (-not (Test-Path "$Raiz\.git")) {
  Paso "Descargando la app"
  if (Test-Path $Raiz) { Fallo "Ya existe la carpeta $Raiz pero no es la app. Bórrala o cámbiale el nombre y repite." }
  git clone --branch main https://github.com/Especaba66-pixel/adela-maria.git $Raiz
  Comprobar "No se pudo descargar la app de GitHub"
}
Set-Location $Raiz

# 6. Configuración (.env)
if (-not (Test-Path "$Raiz\.env")) {
  Paso "Configuración inicial"
  $Contrasena = Read-Host "Contraseña de administración de la app (mínimo 10 caracteres)"
  $Pin = Read-Host "PIN de Adela (4 a 6 números)"
  $ReservasUrl = Read-Host "Dirección del servicio de reservas por internet (Intro para dejarlo para luego)"
  $ReservasClave = if ($ReservasUrl) { Read-Host "Clave de sincronización de las reservas (la misma que en GitHub)" } else { "" }
  $ClaveUrl = [uri]::EscapeDataString($ClavePg)
  @"
DATABASE_URL=postgres://postgres:$ClaveUrl@localhost:5432/adela
RESTAURAR_URL=postgres://postgres:$ClaveUrl@localhost:5432/adela_restauracion
ADMIN_NOMBRE=Adela
ADMIN_USUARIO=adela
ADMIN_CONTRASENA=$Contrasena
ADMIN_PIN=$Pin
SESION_MINUTOS_INACTIVIDAD=15
PORT=3000
RESERVAS_URL=$ReservasUrl
RESERVAS_CLAVE=$ReservasClave
"@ | ForEach-Object { [IO.File]::WriteAllText("$Raiz\.env", $_, (New-Object Text.UTF8Encoding $false)) }
}

# 7. Preparar la app
Paso "Preparando la app (tarda unos minutos)"
$pm = ((Get-Content "$Raiz\package.json" -Raw | ConvertFrom-Json).packageManager)
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { npm install -g $pm --no-fund --no-audit; Comprobar "No se pudo instalar pnpm" }
pnpm install --frozen-lockfile; Comprobar "Falló la instalación de las piezas de la app"
pnpm build; Comprobar "Falló la preparación de la app"
pnpm db:migrate; Comprobar "Falló la preparación de la base de datos"
pnpm db:seed; Comprobar "Falló la carga de los datos iniciales"

# 8. Arranque al iniciar sesión (carpeta Inicio de Windows) y copia diaria
Paso "Programando el arranque y la copia de seguridad"
$Shell = New-Object -ComObject WScript.Shell
$Inicio = [Environment]::GetFolderPath("Startup")
$Atajo = $Shell.CreateShortcut("$Inicio\Adela María (arranque).lnk")
$Atajo.TargetPath = "powershell.exe"
$Atajo.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\arrancar-usuario.ps1`""
$Atajo.WorkingDirectory = $Raiz
$Atajo.WindowStyle = 7
$Atajo.Save()
try {
  $Copia = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\copia.ps1`"" -WorkingDirectory $Raiz
  Register-ScheduledTask -TaskName "Adela María - Copia diaria" -Action $Copia -Trigger (New-ScheduledTaskTrigger -Daily -At "14:30") `
    -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -Force -ErrorAction Stop | Out-Null
} catch {
  Write-Host "Aviso: no se pudo programar la copia diaria sin permisos ($_). Se hará cuando se instale con administrador." -ForegroundColor DarkYellow
}

# 9. Acceso directo en el escritorio (pantalla completa)
$Edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$Escritorio = [Environment]::GetFolderPath("Desktop")
$App = $Shell.CreateShortcut("$Escritorio\Adela María.lnk")
$App.TargetPath = $Edge
$App.Arguments = "--app=http://localhost:3000/gestion --start-fullscreen"
$App.Save()

# 10. Arrancar ya
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\arrancar-usuario.ps1`""
Paso "Listo. En un minuto abre «Adela María» en el escritorio. La primera vez, registra el equipo con el correo y la contraseña."
