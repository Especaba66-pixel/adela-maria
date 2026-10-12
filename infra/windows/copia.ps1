<#
  Copia de seguridad diaria (la lanza Windows cada día) y prueba de restauración.
  Guarda la copia en la carpeta de copias (por defecto, Documentos\Copias Adela María) y conserva 30 días.
  Si esa carpeta está dentro de Google Drive para ordenador u OneDrive, la copia sale además del TPV.
  El resultado (bueno o malo) se apunta en la app: si falla, sale un aviso rojo en el inicio.
#>
$ErrorActionPreference = "Stop"
$env:PGOPTIONS = "-c client_min_messages=warning"
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
# Programas de PostgreSQL: los de la instalación de Windows o, si no están, los del PATH.
function Pg($programa) {
  $ruta = "C:\Program Files\PostgreSQL\16\bin\$programa.exe"
  if (Test-Path $ruta) { return $ruta } else { return $programa }
}
$Env = @{}
$ArchivoEnv = if ($env:ADELA_ENV) { $env:ADELA_ENV } else { "$Raiz\.env" }
Get-Content $ArchivoEnv | Where-Object { $_ -match "^\s*([A-Z_]+)=(.*)$" } | ForEach-Object { $Env[$Matches[1]] = $Matches[2] }
$Url = $Env["DATABASE_URL"]
$Carpeta = if ($Env["DIR_COPIAS"]) { $Env["DIR_COPIAS"] } else { Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Copias Adela María" }
New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null

function Apuntar($tipo, $correcta, $archivo, $bytes, $detalle) {
  $sql = "insert into copias_seguridad (tipo, correcta, archivo, bytes, detalle) values ('$tipo', $correcta, " +
    $(if ($archivo) { "'$archivo'" } else { "null" }) + ", " + $(if ($bytes) { $bytes } else { "null" }) + ", '" + ($detalle -replace "'", "''") + "')"
  & (Pg "psql") $Url -qtAc $sql | Out-Null
}

$Nombre = "adela-" + (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ") + ".dump"
$Archivo = Join-Path $Carpeta $Nombre
try {
  # Filas por tabla antes de copiar (nada se borra, así que la copia debe tener al menos estas).
  $Consulta = "select format('select %L, count(*) from public.%I', table_name, table_name) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`n\gexec"
  $Conteos = $Consulta | & (Pg "psql") $Url -qtA -F " "
  if ($LASTEXITCODE -ne 0) { throw "No se pudo contar las filas" }
  $Conteos | Set-Content -Encoding UTF8 "$Archivo.conteos"
  & (Pg "pg_dump") $Url --format=custom --compress=9 --no-owner --no-privileges --file=$Archivo
  if ($LASTEXITCODE -ne 0) { throw "pg_dump falló" }
  $Bytes = (Get-Item $Archivo).Length
  Apuntar "copia" "true" $Nombre $Bytes "$(($Conteos | Measure-Object).Count) tablas"
} catch {
  Apuntar "copia" "false" $null $null "$_"
  exit 1
}

# Prueba de restauración en una base de datos aparte.
try {
  $R = $Env["RESTAURAR_URL"]
  & (Pg "psql") $R -qc "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;" | Out-Null
  & (Pg "pg_restore") --dbname=$R --no-owner --no-privileges --exit-on-error $Archivo
  if ($LASTEXITCODE -ne 0) { throw "pg_restore falló" }
  $Errores = @()
  foreach ($Linea in $Conteos) {
    $Partes = $Linea -split " "
    if ($Partes.Count -ne 2) { continue }
    $Obtenidas = [int](& (Pg "psql") $R -qtAc "select count(*) from public.""$($Partes[0])""")
    if ($Obtenidas -lt [int]$Partes[1]) { $Errores += "$($Partes[0]): $Obtenidas de $($Partes[1]) filas" }
  }
  if ($Errores.Count -gt 0) { throw ($Errores -join "; ") }
  Apuntar "restauracion" "true" $Nombre $null "$(($Conteos | Measure-Object).Count) tablas completas"
} catch {
  Apuntar "restauracion" "false" $Nombre $null "$_"
}

# Se conservan 30 días.
Get-ChildItem $Carpeta -Filter "adela-*.dump*" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
