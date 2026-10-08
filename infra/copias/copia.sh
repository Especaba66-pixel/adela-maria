#!/usr/bin/env bash
# Copia de seguridad de la base de datos.
#   - Guarda un volcado comprimido en $DIR_COPIAS (por defecto ./copias).
#   - Junto a él, el número de filas de cada tabla (lo usa probar-restauracion.sh).
#   - Apunta el resultado, bueno o malo, en la tabla copias_seguridad (lo ve Configuración y el inicio).
#   - Borra las copias con más de $DIAS_CONSERVAR días (por defecto 30).
# Uso: DATABASE_URL=... infra/copias/copia.sh
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
DIR_COPIAS="${DIR_COPIAS:-./copias}"
DIAS_CONSERVAR="${DIAS_CONSERVAR:-30}"
mkdir -p "$DIR_COPIAS"

nombre="adela-$(date -u +%Y%m%dT%H%M%SZ)"
archivo="$DIR_COPIAS/$nombre.dump"

apuntar() { # correcta archivo bytes detalle
  psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 \
    -v correcta="$1" -v archivo="$2" -v bytes="$3" -v detalle="$4" <<'SQL' || echo "No se pudo apuntar el resultado en la base de datos" >&2
insert into copias_seguridad (tipo, correcta, archivo, bytes, detalle)
values ('copia', :'correcta', nullif(:'archivo', ''), nullif(:'bytes', '')::int, nullif(:'detalle', ''));
SQL
}

fallo() {
  echo "ERROR: $1" >&2
  apuntar false "" "" "$1"
  exit 1
}
trap 'fallo "la copia se interrumpió en la línea $LINENO"' ERR

# Filas por tabla antes del volcado. Como nada se borra (borrado lógico y registros que solo crecen),
# la copia debe tener al menos estas filas.
psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -F ' ' > "$archivo.conteos" <<'SQL'
select format('select %L, count(*) from %I.%I', table_name, table_schema, table_name)
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name
\gexec
SQL

pg_dump "$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges --file="$archivo"
trap - ERR

bytes=$(stat -c %s "$archivo")
apuntar true "$nombre.dump" "$bytes" "$(wc -l < "$archivo.conteos") tablas"
echo "Copia correcta: $archivo ($bytes bytes)"

find "$DIR_COPIAS" -name 'adela-*.dump*' -type f -mtime +"$DIAS_CONSERVAR" -print -delete
