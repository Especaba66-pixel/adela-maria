<#
  Instala la app de gestión de Adela María en el ordenador del TPV (Windows 10 u 11).
  Ejecutar UNA vez, en PowerShell como administrador, desde la carpeta del proyecto:
      powershell -ExecutionPolicy Bypass -File infra\windows\instalar.ps1
  Hace: instala Node.js, PostgreSQL y Git si faltan; crea la base de datos; prepara la app; y programa que
  arranque sola al encender el ordenador y que haga la copia de seguridad cada día.
#>
$ErrorActionPreference = "Stop"
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Raiz

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Yellow }
# Los programas externos (pnpm, git…) no paran el script al fallar: se comprueba cada uno.
function Comprobar($texto) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: $texto. Haz una foto de esta pantalla y vuelve a lanzar el instalador." -ForegroundColor Red
    exit 1
  }
}

function Instalar-SiFalta($comando, $paquete) {
  if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) {
    Paso "Instalando $paquete"
    winget install --id $paquete --exact --silent --accept-package-agreements --accept-source-agreements
  }
}

# 1. Programas necesarios
Instalar-SiFalta "node" "OpenJS.NodeJS.LTS"
Instalar-SiFalta "git" "Git.Git"
$PgBin = "C:\Program Files\PostgreSQL\16\bin"
if (-not (Test-Path "$PgBin\psql.exe")) {
  Paso "Instalando PostgreSQL 16"
  $ClavePg = Read-Host "Elige una contraseña para la base de datos (guárdala)"
  winget install --id PostgreSQL.PostgreSQL.16 --exact --silent --accept-package-agreements --accept-source-agreements `
    --override "--mode unattended --superpassword `"$ClavePg`" --serverport 5432"
} else {
  $ClavePg = Read-Host "Contraseña de la base de datos (la que elegiste al instalar PostgreSQL)"
}
$env:Path = "$env:Path;$PgBin;C:\Program Files\nodejs"
$env:PGPASSWORD = $ClavePg

# 2. Base de datos
Paso "Creando la base de datos"
$Existe = & "$PgBin\psql.exe" -U postgres -h localhost -tAc "select 1 from pg_database where datname = 'adela'"
if ($Existe -ne "1") { & "$PgBin\psql.exe" -U postgres -h localhost -c "create database adela" }
$ExisteR = & "$PgBin\psql.exe" -U postgres -h localhost -tAc "select 1 from pg_database where datname = 'adela_restauracion'"
if ($ExisteR -ne "1") { & "$PgBin\psql.exe" -U postgres -h localhost -c "create database adela_restauracion" }

# 3. Configuración (.env)
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

# 4. App
Paso "Preparando la app (tarda unos minutos)"
corepack enable
pnpm install --frozen-lockfile; Comprobar "Falló la instalación de las piezas de la app"
pnpm build; Comprobar "Falló la preparación de la app"
pnpm db:migrate; Comprobar "Falló la preparación de la base de datos"
pnpm db:seed; Comprobar "Falló la carga de los datos iniciales"

# 5. Arranque automático y copia diaria
Paso "Programando el arranque automático y la copia de seguridad"
$Usuario = "$env:USERDOMAIN\$env:USERNAME"
$Arrancar = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\arrancar.ps1`"" -WorkingDirectory $Raiz
Register-ScheduledTask -TaskName "Adela María - App" -Action $Arrancar -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $Usuario) `
  -Settings (New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit 0) -Force | Out-Null
$Copia = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\copia.ps1`"" -WorkingDirectory $Raiz
Register-ScheduledTask -TaskName "Adela María - Copia diaria" -Action $Copia -Trigger (New-ScheduledTaskTrigger -Daily -At "14:30") `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -Force | Out-Null

# 6. Acceso directo en el escritorio (pantalla completa)
$Escritorio = [Environment]::GetFolderPath("Desktop")
$Atajo = (New-Object -ComObject WScript.Shell).CreateShortcut("$Escritorio\Adela María.lnk")
$Atajo.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$Atajo.Arguments = "--app=http://localhost:3000/gestion --start-fullscreen"
$Atajo.Save()

Start-ScheduledTask -TaskName "Adela María - App"
Paso "Listo. Abre «Adela María» en el escritorio. La primera vez, registra el equipo con tu contraseña."
