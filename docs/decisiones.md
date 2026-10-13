# Decisiones técnicas

Decisiones tomadas al programar, dentro de lo que fija el plan maestro. Cada una dice qué se eligió y por qué.

## Fase 0

**Drizzle en lugar de Prisma.** El plan dejaba elegir entre los dos. Drizzle escribe SQL muy cercano al real y permite
migraciones a mano en SQL, que hacen falta para que sea la propia base de datos la que impida la doble reserva (fase 1)
y la edición de facturas (fase 2).

**Reglas en la base de datos.** El registro de actividad y el de copias solo admiten añadir filas: un disparador rechaza
cualquier cambio o borrado, incluso si la aplicación falla. Usuarios, tratamientos, categorías y bonos no se pueden
borrar: se desactivan o se marcan como anulados. Los tratamientos duran tramos de 5 minutos y no tienen precio negativo.

**Contraseñas y PIN con scrypt.** Viene incluido en Node.js, así que no depende de programas externos que haya que
compilar en el servidor. Cada secreto lleva su propia sal y el formato guarda los parámetros, para poder endurecerlos más
adelante sin invalidar los existentes.

**El personal entra solo con PIN, sin contraseñas** (decidido por Espe). La única contraseña es la de la administración y
solo sirve para registrar un equipo de confianza (el TPV, o su móvil) una vez. A partir de ahí, en ese equipo se entra
tocando el nombre y escribiendo el PIN. Un PIN de 4 cifras es débil por sí solo, así que solo vale en equipos
registrados: desde cualquier otro sitio no se puede entrar. Los equipos se pueden retirar desde Configuración, y la base
de datos impide que la administración se quede sin contraseña.

**Bloqueo por intentos.** Cinco fallos seguidos (de contraseña o de PIN) bloquean a esa persona 5 minutos. El mensaje de
error no dice si el usuario existe.

**Sesiones en la base de datos.** El navegador solo guarda un código aleatorio; en la base de datos se guarda su huella.
Así se puede cerrar la sesión de alguien a distancia (al desactivarlo, cambiar su rol o retirar el TPV). La sesión se
cierra tras 15 minutos sin actividad (configurable con `SESION_MINUTOS_INACTIVIDAD`).

**Permisos en el código, no en tablas.** Los tres roles del plan y lo que puede hacer cada uno están en
`packages/dominio/src/permisos.ts`, con pruebas. Mientras no haga falta crear roles a medida desde la pantalla, es más
seguro que estén en código revisado que en datos editables. Si se necesita, se pasa a tablas en una fase posterior.

**Siempre queda una administradora.** No se puede desactivar ni quitar el rol a la última persona con administración.

**IVA vacío hasta que confirme la gestoría.** Cada tratamiento tiene su tipo de IVA, pero empieza vacío. La facturación
(fase 2) no dejará cobrar un tratamiento sin IVA asignado.

**Comprobación de copias.** Junto a cada copia se guarda cuántas filas tenía cada tabla. La prueba de restauración
restaura la copia en una base de datos aparte y comprueba que cada tabla tiene al menos esas filas (como nada se borra,
nunca debería tener menos) y que las reglas de la base de datos siguen activas. El resultado se ve en Configuración y,
si falla, sale un aviso rojo en el inicio.

**Las clientas no necesitan claves** (decidido por Espe). La web pública (`/`) muestra los tratamientos y permite pedir
cita con nombre y teléfono. Como cualquiera podría pedir una cita falsa, la petición entra como «por confirmar»: el
centro la ve en el inicio, escribe a la clienta por WhatsApp con un toque y la confirma o la rechaza. Para frenar abusos:
un campo trampa invisible para programas automáticos, un máximo de 3 peticiones sin contestar por teléfono y un freno
si llegan más de 20 en 10 minutos. Se guarda el texto de privacidad que aceptó cada clienta. En la fase 1, con la
agenda, la clienta verá los huecos libres y la petición se convertirá en una cita.

**La gestión del centro vive en `/gestion`** y no aparece en buscadores; la web pública sí.

**Precio y duración pueden quedar por decidir.** Para poder ofrecer un servicio nuevo antes de fijar su precio (diseño
de cejas). La web muestra «Precio a consultar», se puede pedir cita y el inicio avisa de lo que falta. En la fase 2 no
se podrá cobrar un tratamiento sin precio.

**Un número de WhatsApp propio del centro, no el móvil personal.** Con WhatsApp Business se puede usar a la vez la app
del móvil y los envíos automáticos de Meta (fase 6) sobre el mismo número. Con el WhatsApp normal de una persona, no. Un
número del centro también separa la vida privada de Adela de las clientas y protege su número personal si Meta
bloqueara los envíos. El teléfono se guarda en **Datos del centro** y lo cambia la administración.

## Fase 1

**La doble reserva la impide la base de datos.** Una restricción de exclusión de PostgreSQL rechaza dos citas no
canceladas de la misma profesional que se solapen, aunque lleguen a la vez desde la web y desde el TPV. La aplicación
solo traduce el error a «Ya hay otra cita a esa hora».

**La cita guarda la duración y el precio de cada servicio en ese momento.** Si mañana cambia una tarifa, las citas ya
dadas no cambian.

**Horas de Madrid con cambio de hora.** Las citas se guardan como instantes reales y el horario como «minutos desde
medianoche». La conversión tiene en cuenta el cambio de hora de marzo y octubre (probado).

**Vista de día como lista con huecos, no como rejilla.** Con servicios de 5 minutos, una rejilla dejaría bloques
demasiado pequeños para el dedo. La lista ordenada con los huecos libres como botones es más cómoda en el TPV.

**Reserva web con hora real, por confirmar.** La hora queda ocupada al momento para que nadie más la coja, y el centro
la confirma por WhatsApp. Si no la confirma, puede rechazarla y el hueco se libera. Hay una antelación mínima de 2 horas.

**Profesionales separadas de usuarios.** Una profesional puede tener usuario (para ver su agenda) o no. Si no tiene
tratamientos apuntados, hace todos.

**Supresión de datos por anonimización.** Al eliminar los datos de una clienta no se borra la fila: se vacían sus datos
personales y notas, y sus citas quedan sin nombre. Así la agenda y, más adelante, la facturación siguen cuadrando.

## Fase 2

**La gestión se instala en el TPV, gratis** (decidido por Espe). La web de clientas es una landing estática gratuita
en GitHub Pages, con cita por WhatsApp. Al estar la app en el mismo ordenador que la impresora, el servidor le habla
directamente: no hace falta el «agente» que preveía el plan.

**Lo cobrado no se toca.** Ventas, líneas, pagos, movimientos de caja, facturas y registros de facturación solo
admiten añadir filas: lo impone la base de datos. Un error se corrige con una devolución, que genera una venta en
negativo y una factura rectificativa enlazadas a la original.

**Numeración sin saltos y registro encadenado.** Cada factura se numera dentro de su serie (T = tickets, F = facturas
con datos, R = rectificativas, una por año) en la misma transacción que la venta. Cada factura genera un registro con
una huella SHA-256 que incluye la del anterior; la base de datos no admite dos registros con la misma «anterior», así
que la cadena no puede bifurcarse. La pantalla de Facturación comprueba la cadena entera. El formato exacto que pide
VERI\*FACTU se ajusta en la fase 8.

**Los precios e IVA los pone el servidor.** El TPV solo manda qué tratamientos y cuántos; el precio y el IVA salen del
catálogo. No se puede cobrar un tratamiento sin precio o sin IVA, ni facturar sin los datos fiscales del centro.

**El desglose de IVA se calcula por tipo, no por línea**, para que base más cuota cuadre siempre con lo cobrado.

**Pagos.** Efectivo (con cambio), tarjeta (en el datáfono del banco, sin integrar) y Bizum; varios pagos en una venta;
y «a deber» lo que falte, que aparece en el TPV y en el inicio hasta cobrarlo. Todo pago va a una caja abierta.

**Si la impresora falla, el cobro no se pierde.** Se guarda primero y se imprime después; el ticket se puede
reimprimir o enviar por WhatsApp.

**Los formularios no se vacían si hay un error.** React vacía los formularios al enviarlos; ahora solo se vacían los
de alta tras guardar bien.

## Fase 3

**Bono: se factura al venderlo.** Un bono vale para unos tratamientos concretos (los faciales), así que se trata como
bono «univalente»: el IVA se paga al venderlo, con su factura, y cada sesión que se usa se descuenta sin volver a
cobrar ni facturar. **Tarjeta regalo: se factura al usarla.** Vale para cualquier cosa, así que es «polivalente»: al
venderla no hay factura (se entrega un vale) y lo que se paga con ella se factura entonces, como cualquier venta. Es
el criterio general; **lo tiene que confirmar la gestoría**. Si dijera que el bono se factura al usarlo, el cambio es
acotado: la venta del bono pasaría a no llevar factura, como la tarjeta regalo.

**Los bonos no caducan** (decidido por Espe), pero el sistema admite caducidad por si algún día se quiere: cada tipo
de bono puede llevar días de validez.

**Cada bono vendido guarda lo que cubre en ese momento.** Si mañana cambia la tarifa o el tipo de bono, los bonos ya
vendidos siguen valiendo para lo que se compró.

**Las sesiones son un historial que solo crece.** Una sesión gastada es una fila; una sesión devuelta por error es otra
fila en negativo con su motivo (solo administración). La base de datos bloquea el bono al gastar una sesión, así que
dos cobros a la vez no pueden gastar la misma ni pasar del total, ni usar un bono anulado, caducado o que no cubra ese
tratamiento.

**El TPV aplica el bono solo.** Al cobrar una cita, lo que cubre un bono de la clienta se marca «con bono» (se puede
quitar con «Cobrarlo»). Si se usan varios, va primero el que caduca antes y, si no caducan, el más antiguo. Si la
clienta compra el bono ese día, la sesión de ese día ya va con él. Si todo va con bono no hay venta ni factura: solo
se descuentan las sesiones y la cita queda cobrada.

**Tarjeta regalo con código «AM-XXXX-XXXX».** Al azar (8 caracteres de un alfabeto sin letras que se confundan: unos
500 000 millones de combinaciones), se acepta escrito de cualquier forma y se puede pagar una parte con ella. Su saldo
es un historial de movimientos que nunca queda en negativo (lo impone la base de datos). Se paga entera al venderla y
no caduca. Solo se puede devolver sin estrenar; si se devuelve una venta pagada con ella, el saldo vuelve a la tarjeta.

**Devoluciones.** Una venta con un bono solo se devuelve si el bono no se ha usado, y el bono queda anulado.

**Decidido por Espe (12 de octubre de 2026):** los bonos faciales valen para todos los faciales, también «Unos labios
más gruesos», y las tarjetas regalo no caducan.

**Fotos de trabajos en la landing (12 de octubre de 2026).** Espe confirma que las clientas que aparecen en las fotos
de microblading, maquillaje y uñas han dado su permiso para publicarlas en la web. Se publican reducidas y sin los
datos ocultos de la cámara (modelo, fecha, ubicación).

## Reservas por internet

**Calendario propio en Cloudflare, gratis y siempre encendido** (decidido por Espe el 13 de octubre de 2026: que se
pueda reservar a cualquier hora aunque el TPV esté apagado, con varias citas a la vez y sin pagar). Las herramientas
genéricas (Google Calendar, Cal.com, Calendly) no admiten gratis varias citas a la misma hora con tratamientos que van
solos, y las de salones (Booksy, Fresha) cuestan dinero y duplican la app. Un servicio pequeño en Cloudflare Workers
con su base de datos D1 (plan gratuito, en Europa) usa las mismas reglas de agenda que el TPV (`@adela/dominio`).

**El TPV manda, Cloudflare guarda.** El TPV le envía cada minuto tratamientos, horario, citas a la vez y lo ocupado, y
se trae las reservas nuevas a su agenda como citas por confirmar. Cada reserva se importa una sola vez
(`reservas_online`), y al importarla se borran en Cloudflare el nombre y el teléfono.

**Sin solapes aunque reserven dos personas a la vez**: la reserva se guarda solo si nadie ha cambiado la agenda desde
que se comprobó la hora (contador de versión en la misma operación); si no, se vuelve a comprobar.

**Hasta 3 citas a la vez; microblading, maquillaje y uñas van solos** (dato de Espe, 13 de octubre de 2026).

## Fase 4

**El stock es la suma de movimientos que no se editan.** Compras (+), ventas (−), devoluciones (+), gasto en cabina
(−), recuentos (±) y roturas (−). Un error se corrige con otro movimiento, así el historial explica siempre cuánto hay.
Las salidas de una venta van en la misma operación que el cobro: o se guarda todo o nada.

**Se puede vender aunque la app diga que no queda.** Si el stock está mal contado, lo que manda es lo que hay en la
estantería; el recuento lo corrige después. El aviso de reponer sale al llegar al mínimo.

**Gasto en cabina por tratamiento, en unidades enteras.** Se configura en cada producto de cabina y se descuenta al
cobrar el tratamiento o descontarlo de un bono. Si se quieren mililitros o gramos, se cuentan como unidades.

**Compras con un solo tipo de IVA por factura** (lo habitual en proveedores de cosmética); los costes se apuntan sin
IVA. Cada compra genera su gasto, con base, IVA y total.

**Gastos y resumen de IVA por trimestre**, con descarga en CSV (se abre en Excel, con «;» y coma decimal) para la
gestoría: resumen, facturas emitidas y gastos. El cálculo oficial (modelo 303) es de la gestoría.

**Permisos**: recepción lleva stock, proveedores y compras; los gastos y su descarga, solo administración.

## Fase 5

**Los avisos se calculan al abrir la pantalla**, a partir de las citas, bonos, fichas y stock de ese momento: no hay
tareas programadas que puedan fallar con el TPV apagado. Solo se guarda qué aviso se ha atendido o dejado para mañana
(`avisos_atendidos`), con una clave por aviso (por ejemplo, el recordatorio de una cita concreta).

**WhatsApp con un clic, sin envíos automáticos.** El botón abre WhatsApp con el mensaje ya escrito y la persona pulsa
enviar. Al abrirlo se anota en la ficha qué se preparó (`mensajes`, que no se edita) y el aviso deja de salir. El envío
automático con la API oficial de WhatsApp es de la fase 6.

**Solo se escribe a quien ha dado permiso**: avisos de citas para recordatorios, seguimiento y bonos; promociones para
cumpleaños y «te echamos de menos». Confirmar una cita que la clienta pidió en la web no necesita permiso aparte. Sin
permiso, el aviso sale igual pero sin botón y explica por qué.

**Mensajes editables con variables** ({nombre}, {centro}, {fecha}, {hora}, {servicios}, {quedan}, {bono}); la app
no deja guardar una variable que no existe. Las de partida se siembran una vez y no se pisan si se han cambiado.

**Inactiva**: vino alguna vez, hace más de 90 días (ajustable; 0 = no avisar) y no tiene cita por delante. En el
Inicio salen como mucho 10 a la vez para no tapar lo urgente.

**Al eliminar los datos de una clienta** se borran también los mensajes que se le prepararon y el texto de las tareas
sobre ella.

## Fase 6

**El TPV envía; Cloudflare escucha.** Los envíos salen del TPV (que tiene los datos de las clientas) llamando a la API
de Meta. Los avisos de Meta (estados y respuestas) necesitan una dirección pública siempre encendida: llegan al servicio
de Cloudflare de las reservas, que comprueba la firma de Meta y los guarda tal cual hasta que el TPV se los lleva al
sincronizar (cada minuto); entonces se borran allí. Nada se pierde con el TPV apagado; lo que no se recoja en 30 días
se descarta.

**Envío automático solo con el TPV encendido y dentro de una franja** (por defecto de 10:00 a 20:00): así los datos
de las clientas no salen del centro. Cada cita recibe cada aviso automático una sola vez (lo garantiza la base de
datos); si falla, sale en el Inicio con el motivo para hacerlo a mano. Si el TPV no se enciende en la franja, el
recordatorio aparece en el Inicio como en la fase 5.

**Solo se aplica sin dudas**: un botón «Confirmar»/«Cambiar», «BAJA» o un «sí / confirmo» corto. Lo demás lo lee una
persona en el Inicio. Confirmar marca la cita como confirmada por la clienta (nuevo dato en la cita).

**Las plantillas siguen siendo de la app**, con sus datos de Meta (nombre, categoría, orden de variables y botones) al
lado. Sin datos de Meta, el botón abre WhatsApp como en la fase 5; con ellos, envía desde la app.

**Los mensajes guardan su estado** (enviando, enviado, entregado, leído, no se pudo enviar); del registro solo cambia
el estado, nunca el texto. Los estados de Meta llegan desordenados: nunca se retrocede (un «leído» no vuelve a
«entregado»).

**Envíos a grupos** solo a quien acepta promociones, con mensajes de marketing aprobados, y con resumen de entregados y
leídos.
