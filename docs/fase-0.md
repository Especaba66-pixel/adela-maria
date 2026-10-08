# Cierre de la fase 0 · Preparación

Estado: **pendiente de tu aprobación.** No se empieza la fase 1 sin ella.

## 1. Qué se ha construido

- **Proyecto.** Un solo repositorio con la app web (Next.js), las reglas de negocio, la base de datos (PostgreSQL) y el
  sistema de diseño, todo en TypeScript. Ver `docs/desarrollo.md`.
- **Acceso.** Entrada con usuario y contraseña. Entrada rápida con PIN en el TPV, eligiendo tu nombre y tecleando el PIN
  en pantalla. Cierre de sesión tras 15 minutos sin tocar la pantalla. Bloqueo de 5 minutos tras 5 intentos fallidos.
- **Usuarios y roles.** Administración, Recepción y Profesional, con los permisos de la tabla del plan. La administración
  crea usuarios, cambia roles, contraseñas y PIN, y los desactiva (no se borran).
- **Equipos de confianza.** El TPV se registra al entrar con contraseña de administración; solo ahí funciona el PIN. Se
  puede retirar desde Configuración.
- **Registro de actividad.** Entradas, salidas, fallos, bloqueos y cambios de usuarios y equipos, con el valor anterior y
  el nuevo. No se puede modificar ni borrar, ni siquiera desde la base de datos.
- **Copias.** Script de copia diaria (conserva 30 días) y prueba de restauración automática. Los resultados se ven en
  Configuración; si falta o falla una copia, sale un aviso rojo en el inicio.
- **Estilo visual.** Dorado sobre blanco roto, títulos en Cormorant Garamond, texto de 18 px, botones de 64 px y menú de
  7 entradas fijas: Inicio, Agenda, Clientas, TPV, Caja, Avisos y Más. Las pantallas de fases futuras ya están en el
  menú e indican en qué fase llegan.
- **Tarifas.** Categorías Faciales y Depilación y los dos bonos faciales (3 sesiones por 120 € y 6 por 240 €), que valen
  para cualquier facial. **Faltan los 18 tratamientos** (ver punto 5).
- **Pruebas automáticas** en GitHub en cada cambio.

## 2. Cómo probarlo paso a paso

1. Arranca el proyecto como dice `docs/desarrollo.md` y abre http://localhost:3000.
2. Entra con el usuario y la contraseña de administración del `.env`, marcando «Este equipo es el TPV del centro».
3. En el inicio verás el saludo, las seis tarjetas del día (aún vacías) y dos avisos: no hay copias y faltan tarifas.
4. Ve a **Más → Configuración → Usuarios** y crea a alguien de Recepción con un PIN.
5. Pulsa **Cambiar de persona**: aparece la pantalla de PIN. Elige a esa persona y teclea su PIN.
6. Comprueba que en **Más** no aparece Configuración y que la dirección `/mas/configuracion` dice que no tiene acceso.
7. Teclea mal el PIN cinco veces: queda bloqueada 5 minutos.
8. Vuelve a entrar como administración y mira **Configuración → Registro de actividad**: está todo lo anterior.
9. Ejecuta `infra/copias/copia.sh` y `infra/copias/probar-restauracion.sh`; en **Configuración → Copias** aparecen las dos
   y el aviso rojo del inicio desaparece.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas de negocio (permisos, credenciales, cifrado, sesión, dinero) | 14 de 14 correctas |
| Base de datos (datos iniciales, registro inalterable, sin borrados, tramos de 5 minutos, usuario único) | 7 de 7 correctas |
| Recorrido completo en navegador con pantalla de TPV (12 pasos, del 2 al 8 de arriba y más) | 12 de 12 correctas |
| Copia y restauración comprobada | Correcta; y detecta una copia incompleta |

Es la primera fase, así que no hay pruebas de fases anteriores que repetir.

## 4. Errores encontrados y corregidos

- Al quinto PIN incorrecto la persona quedaba bloqueada, pero la pantalla seguía diciendo «PIN incorrecto» y no avisaba
  del bloqueo hasta el sexto intento. Ahora avisa en el momento.
- El botón «Cambiar de persona» no cabía en una línea en el menú lateral; se ha ensanchado el menú.

## 5. Qué queda pendiente

**Necesito de ti:**

- **Las tarifas.** Las fotos de las tarifas no están en tu Drive ni en Notion. Necesito el nombre, la duración y el
  precio de los 7 faciales y los 11 servicios de depilación. Se cargan en `packages/db/src/datos/tarifas.ts`.
- **El logo original** en buena calidad, para ajustar el dorado exacto y sustituir el nombre escrito por el logo.
- **Resolución del TPV**, para afinar tamaños.
- **Respuestas de la gestoría y de mantenimiento** de la lista del plan (régimen fiscal, quién mantiene y con qué
  presupuesto).

**Para poner en marcha en el centro (requiere tus cuentas):**

- Crear el proyecto en Supabase (región UE) y el alojamiento de la app, y pasar sus datos al `.env` de producción.
- Programar la copia diaria y la prueba de restauración, y elegir el segundo proveedor para la copia semanal cifrada.
- Verificación en dos pasos para la administración: el plan la pide. La dejo para cuando tengamos el alojamiento
  definitivo, antes de que el centro use la app con datos reales.

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 1: agenda, clientas y tratamientos.
