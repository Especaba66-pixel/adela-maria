# Cierre de la fase 0 · Preparación

Estado: **pendiente de tu aprobación.** No se empieza la fase 1 sin ella.

## 1. Qué se ha construido

- **Proyecto.** Un solo repositorio con la app web (Next.js), las reglas de negocio, la base de datos (PostgreSQL) y el
  sistema de diseño, todo en TypeScript. Ver `docs/desarrollo.md`.
- **Web para clientas, sin claves.** En la dirección principal: presentación, tratamientos con precio y bonos, y un
  formulario para pedir cita (tratamiento, día, mañana o tarde, nombre y teléfono). Pensada para el móvil.
- **Reservas por confirmar.** Las peticiones aparecen en el inicio de gestión. Desde **Más → Reservas web** se escribe
  a la clienta por WhatsApp con el mensaje ya preparado y se confirma o rechaza.
- **Acceso del personal solo con PIN.** La administración registra el TPV una vez con su contraseña; después cada
  persona toca su nombre y teclea su PIN. Cierre de sesión tras 15 minutos sin tocar la pantalla. Bloqueo de 5 minutos
  tras 5 intentos fallidos.
- **Usuarios y roles.** Administración, Recepción y Profesional, con los permisos de la tabla del plan. La administración
  crea usuarios (solo con PIN), cambia roles y PIN, y los desactiva (no se borran).
- **Datos del centro.** La administración pone el teléfono y la dirección en Configuración y salen al pie de la web de
  clientas, con botón de llamar y, si es un móvil, de WhatsApp.
- **Equipos de confianza.** El TPV se registra al entrar con contraseña de administración; solo ahí funciona el PIN. Se
  puede retirar desde Configuración.
- **Registro de actividad.** Entradas, salidas, fallos, bloqueos y cambios de usuarios y equipos, con el valor anterior y
  el nuevo. No se puede modificar ni borrar, ni siquiera desde la base de datos.
- **Copias.** Script de copia diaria (conserva 30 días) y prueba de restauración automática. Los resultados se ven en
  Configuración; si falta o falla una copia, sale un aviso rojo en el inicio.
- **Estilo visual.** Dorado sobre blanco roto, títulos en Cormorant Garamond, texto de 18 px, botones de 64 px y menú de
  7 entradas fijas: Inicio, Agenda, Clientas, TPV, Caja, Avisos y Más. Las pantallas de fases futuras ya están en el
  menú e indican en qué fase llegan.
- **Tarifas.** Categorías Faciales, Depilación y Cejas; los dos bonos faciales (3 sesiones por 120 € y 6 por 240 €), que
  valen para cualquier facial; y **Diseño de cejas**, con precio y duración por decidir («Precio a consultar»).
  **Faltan los 18 tratamientos** de faciales y depilación (ver punto 5).
- **Pruebas automáticas** en GitHub en cada cambio.

## 2. Cómo probarlo paso a paso

**Como clienta (en el móvil):**

1. Abre la dirección principal (en local, http://localhost:3000). No pide ninguna clave.
2. Mira los tratamientos: «Diseño de cejas» sale con «Precio a consultar».
3. Pulsa **Pedir cita** en un tratamiento, elige día y franja, escribe nombre y teléfono, acepta la privacidad y envía.

**Como centro (en el TPV):**

4. Abre http://localhost:3000/gestion. La primera vez pide registrar el equipo: usuario y contraseña de administración
   del `.env`.
5. En el inicio verás la tarjeta **Reservas por confirmar** con la petición del paso 3, y avisos de lo que falta.
6. Abre la tarjeta: pulsa **Escribir por WhatsApp** (abre el chat con el mensaje escrito) y luego **Confirmar**.
7. Ve a **Más → Configuración → Usuarios** y crea a alguien de Recepción solo con un PIN.
8. Pulsa **Cambiar de persona**: elige a esa persona y teclea su PIN. Comprueba que no ve Configuración.
9. Teclea mal el PIN cinco veces: queda bloqueada 5 minutos.
10. Vuelve a entrar como administración y mira **Configuración → Registro de actividad**.
11. Ejecuta `infra/copias/copia.sh` y `infra/copias/probar-restauracion.sh`; en **Configuración → Copias** aparecen las
    dos y el aviso rojo del inicio desaparece.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas de negocio (permisos, credenciales, cifrado, sesión, dinero, teléfonos, peticiones de cita) | 42 de 42 correctas |
| Base de datos (datos iniciales, registro inalterable, sin borrados, contraseña de administración, peticiones) | 9 de 9 correctas |
| Recorrido completo del centro en pantalla de TPV (registro del equipo, PIN, permisos, bloqueo, actividad, datos del centro) | 15 de 15 correctas |
| Recorrido completo de la clienta en móvil y del centro confirmando (incluye cejas sin precio y frenos de abuso) | 7 de 7 correctas |
| Copia y restauración comprobada | Correcta; y detecta una copia incompleta |

Es la primera fase, así que no hay pruebas de fases anteriores que repetir.

## 4. Errores encontrados y corregidos

- Al quinto PIN incorrecto la persona quedaba bloqueada, pero la pantalla seguía diciendo «PIN incorrecto» y no avisaba
  del bloqueo hasta el sexto intento. Ahora avisa en el momento.
- El botón «Cambiar de persona» no cabía en una línea en el menú lateral; se ha ensanchado el menú.
- La parte de gestión no debe salir en buscadores, pero la web de clientas sí: antes estaba todo oculto. Corregido.
- Algunas páginas de la web de clientas leían la base de datos al preparar la web para publicarla, lo que habría
  fallado al ponerla en marcha. Ahora se leen en cada visita.

## 5. Qué queda pendiente

**Necesito de ti:**

- **Las tarifas.** Las fotos de las tarifas no están en tu Drive ni en Notion. Necesito el nombre, la duración y el
  precio de los 7 faciales y los 11 servicios de depilación. Se cargan en `packages/db/src/datos/tarifas.ts`.
- **Precio y duración del diseño de cejas**, cuando los tengas.
- **El número de WhatsApp del centro** (no el móvil personal de Adela). Cuando lo tengas, lo pones tú misma en
  **Más → Configuración → Datos del centro**, junto con la dirección.
- **El logo original** en buena calidad, para ajustar el dorado exacto y sustituir el nombre escrito por el logo.
- **Resolución del TPV**, para afinar tamaños.
- **Respuestas de la gestoría y de mantenimiento** de la lista del plan (régimen fiscal, quién mantiene y con qué
  presupuesto).

**Para poner en marcha en el centro (requiere tus cuentas):**

- Crear el proyecto en Supabase (región UE) y el alojamiento de la app, y pasar sus datos al `.env` de producción.
- Programar la copia diaria y la prueba de restauración, y elegir el segundo proveedor para la copia semanal cifrada.
- La verificación en dos pasos de la administración, que pedía el plan, deja de hacer falta: la contraseña solo sirve
  para registrar equipos, y entrar con PIN solo funciona en equipos ya registrados.

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 1: agenda, clientas y tratamientos. Con la agenda,
la web de clientas pasará a mostrar los huecos libres.
