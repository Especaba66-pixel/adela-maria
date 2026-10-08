# Cierre de la fase 1 · Agenda, clientas y tratamientos

Estado: **pendiente de tu aprobación.** Según el plan, la fase se da por terminada cuando el centro lleve **una semana
real de citas sin doble reserva**. Para eso falta ponerla en marcha (ver punto 5).

## 1. Qué se ha construido

**Agenda (Menú → Agenda)**

- Vistas de **día, semana y mes**, con botones Hoy, anterior y siguiente, y filtro por profesional.
- En la vista de día, cada profesional tiene su columna con sus citas en orden y los **huecos libres como botones**:
  se toca «+ Cita» en un hueco y se abre la cita con el día, la hora y la profesional ya puestos.
- **Nueva cita**: buscar la clienta por nombre o teléfono (o darla de alta ahí mismo), elegir uno o varios
  tratamientos (se suma la duración), la profesional, el día y una hora de la lista de horas libres. Puede repetirse
  cada 1 a 8 semanas.
- **Sin doble reserva**: la base de datos rechaza dos citas a la vez de la misma profesional, también si dos personas
  lo intentan en el mismo segundo. En una cita repetida, si una fecha choca no se crea ninguna y se dice cuál.
- **Estados**: por confirmar, confirmada, realizada («ha venido»), no vino y cancelada. Se puede deshacer un «ha
  venido» o un «no vino» marcado por error. Al cancelar, el hueco queda libre.
- **Mover** una cita de día, hora o profesional. **Cancelar una serie** entera desde una de sus citas.
- **Bloqueos**: vacaciones, descansos o cierres, de una profesional o de todo el centro, por días enteros u horas.
- Botón de **WhatsApp** en cada cita con el mensaje de confirmación o recordatorio ya escrito.

**Clientas (Menú → Clientas)**

- Buscador por nombre o teléfono y alta de clientas. No se permiten dos fichas con el mismo teléfono.
- **Ficha** con su **historial**: citas (con su estado), notas del personal, permisos que ha dado y fecha de alta. Número
  de visitas, veces que no vino y citas próximas.
- **Permisos de WhatsApp separados** (avisos de citas y promociones), con registro de cada cambio.
- **Protección de datos**: la administración puede descargar todos los datos de una clienta o eliminarlos si lo pide
  (se borran nombre, teléfono, correo y notas; las citas quedan sin nombre).

**Web de clientas**

- La reserva ahora es **con hora real**: tratamiento → día → hora libre → nombre y teléfono. La hora queda guardada en la
  agenda como «por confirmar» y ya no se ofrece a nadie más. Solo se ofrecen horas con al menos 2 horas de antelación
  y hasta 60 días vista.
- Si una clienta ya existe (mismo teléfono), la cita va a su ficha; si no, se crea su ficha, con el permiso de
  privacidad que aceptó.
- Los tratamientos sin duración se siguen pidiendo sin hora, y el centro les da cita con «Dar cita».

**Configuración**

- **Horario** semanal de cada profesional, con mañana y tarde.
- **Profesionales**: quién atiende, su color, qué usuario ve su agenda y qué tratamientos hace.
- **Tratamientos**: la administración edita nombre, duración, precio, descripción, retira tratamientos y crea
  categorías. Así puedes poner tú misma el precio del diseño de cejas.

**Inicio**

- Tarjetas con **citas de hoy** y **reservas por confirmar**, y la lista de las **próximas citas de hoy**.
- Avisos de lo que falta: horario, precios o duraciones, copias.

**Permisos**

- Recepción da y gestiona citas y clientas. Una **profesional** solo ve **su propia agenda** y no puede dar citas ni
  abrir fichas.

## 2. Cómo probarlo paso a paso

1. **Más → Configuración → Horario**: pon tu horario de la semana y guarda.
2. **Agenda**: en la vista de día, toca «+ Cita» en un hueco libre. Pulsa «+ Clienta nueva», escribe nombre y teléfono,
   elige un tratamiento y guarda.
3. Intenta dar otra cita a la misma hora: te dirá «Ya hay otra cita a esa hora».
4. Abre la cita: márcala «Ha venido», cámbiala de hora o cancélala.
5. Da una cita que se repita cada semana 4 veces y mira la vista de mes.
6. **Agenda → Bloqueos**: bloquea un día entero. Ese día no queda ningún hueco.
7. **Clientas**: busca la clienta, añade una nota y mira su historial.
8. Desde el móvil, abre la web, pulsa **Pedir cita**, elige tratamiento, día y hora y envía. En el TPV aparece en
   **Reservas por confirmar**: escríbele por WhatsApp y confírmala.
9. **Más → Tratamientos**: ponle precio y duración al diseño de cejas y mira cómo cambia en la web.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (horas de Madrid con cambio de hora, huecos libres, horario, estados, series, fichas y todo lo de la fase 0) | 67 de 67 correctas |
| Base de datos (sin doble reserva, citas seguidas, canceladas liberan hueco, tramos de 5 min, teléfono único, permisos inalterables, horario válido y lo de la fase 0) | 16 de 16 correctas |
| Recorridos de la agenda en el TPV (16 pasos: horario, citas, doble reserva, varios servicios, estados, mover, series, bloqueos, fichas, supresión de datos, agenda de una profesional, registro de actividad) | 16 de 16 correctas |
| Recorridos de la fase 0 en el TPV (acceso con PIN, permisos, bloqueo, actividad, datos del centro) | 15 de 15 correctas |
| Recorridos de la web de clientas y del centro (reserva con hora, hora ocupada, sin duración, abusos, confirmar, dar cita) | 14 de 14 correctas |
| Copia y restauración, comprobando que la regla contra la doble reserva se conserva | Correcta |

## 4. Errores encontrados y corregidos

- Al cancelar una serie entera, el mensaje «N citas canceladas» desaparecía al instante, porque el botón que lo
  mostraba se ocultaba al quedar la cita cancelada. Ahora el aviso lo muestra la página.
- En el móvil, el desplegable de tratamientos de la reserva se salía de la pantalla por los nombres largos. Corregido,
  y los días se muestran en dos columnas.

## 5. Qué queda pendiente

**Para cerrar la fase (requiere tu parte):**

- Poner la aplicación en marcha en el centro (alojamiento en la nube y base de datos en la UE) y usar la agenda una
  semana real. Necesito que crees las cuentas o me digas quién lo hará.
- Tu **horario real** y el de cada profesional, y **cuántas profesionales** sois.

**Sigue pendiente de antes:**

- Las dudas de tarifas: si «Diseño de cejas» es distinto de «Diseño y depilación de cejas», si los bonos excluyen
  «Unos labios más gruesos» y si los bonos caducan.
- **Cabinas y aparatos**: si hay tratamientos que no pueden hacerse a la vez por compartir cabina o aparato, la agenda
  tendrá que tenerlo en cuenta. Ahora solo evita solapes por profesional.
- **Situación actual**: si tenéis clientas en papel, Excel u otro programa, puedo preparar la importación.

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 2: TPV, caja y facturación base.
