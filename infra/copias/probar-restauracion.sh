#!/usr/bin/env bash
# Prueba de restauración: restaura la última copia en una base de datos vacía y comprueba que está completa.
#   - RESTAURAR_URL: base de datos de pruebas que se VACÍA y se rellena con la copia. Nunca la de producción.
#   - DATABASE_URL: base de datos principal, donde se apunta el resultado.
# Comprueba que cada tabla tiene al menos las filas que tenía al hacer la copia y que las reglas
# de la base de datos (disparadores) siguen activas.
# Uso: DATABASE_URL=... RESTAURAR_URL=... infra/copias/probar-restauracion.sh [archivo.dump]
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
: "${RESTAURAR_URL:?Falta RESTAURAR_URL}"
DIR_COPIAS="${DIR_COPIAS:-./copias}"
if [[ "$RESTAURAR_URL" == "$DATABASE_URL" ]]; then
  echo "RESTAURAR_URL no puede ser la base de datos principal" >&2
  exit 2
fi

archivo="${1:-$(ls -1t "$DIR_COPIAS"/adela-*.dump 2>/dev/null | head -n1 || true)}"

apuntar() { # correcta detalle
  psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -v correcta="$1" -v archivo="$(basename "${archivo:-}")" -v detalle="$2" <<'SQL' || true
insert into copias_seguridad (tipo, correcta, archivo, detalle)
values ('restauracion', :'correcta', nullif(:'archivo', ''), :'detalle');
SQL
}
fallo() {
  echo "ERROR: $1" >&2
  apuntar false "$1"
  exit 1
}

[[ -n "$archivo" && -f "$archivo" ]] || fallo "no hay ninguna copia que restaurar"
[[ -f "$archivo.conteos" ]] || fallo "falta el archivo de conteos de $(basename "$archivo")"

PGOPTIONS="-c client_min_messages=warning" psql "$RESTAURAR_URL" -q -v ON_ERROR_STOP=1 \
  -c "drop schema if exists public cascade" -c "drop schema if exists drizzle cascade" -c "create schema public" \
  || fallo "no se pudo vaciar la base de datos de restauración"
pg_restore --dbname="$RESTAURAR_URL" --no-owner --no-privileges --exit-on-error "$archivo" \
  || fallo "pg_restore falló"

errores=()
while read -r tabla esperadas; do
  [[ -z "$tabla" ]] && continue
  obtenidas=$(psql "$RESTAURAR_URL" -qtA -c "select count(*) from public.\"$tabla\"" 2>/dev/null || echo "-1")
  if (( obtenidas < esperadas )); then errores+=("$tabla: $obtenidas de $esperadas filas"); fi
done < "$archivo.conteos"

disparadores=$(psql "$RESTAURAR_URL" -qtA -c "select count(*) from pg_trigger where tgname like '%inalterable' or tgname like '%sin_borrado'")
(( disparadores >= 7 )) || errores+=("faltan reglas de la base de datos ($disparadores disparadores)")

if (( ${#errores[@]} > 0 )); then
  fallo "$(IFS='; '; echo "${errores[*]}")"
fi
tablas=$(wc -l < "$archivo.conteos")
apuntar true "$tablas tablas completas"
echo "Restauración correcta: $(basename "$archivo") ($tablas tablas)"
