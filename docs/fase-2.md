# Cierre de la fase 2 · TPV, caja y facturación base

Estado: **pendiente de tu aprobación.** El plan la da por terminada con **un día completo cobrado, con ticket impreso,
cajón abierto y caja cuadrada**. Para eso falta instalarla en el TPV y conectar la impresora (punto 5).

## 1. Qué se ha construido

**TPV (Menú → TPV)**

- A la izquierda, las **citas de hoy por cobrar**; al tocar una, se carga la cuenta con sus servicios y la clienta.
  También se puede cobrar desde la propia cita con el botón **Cobrar**.
- En el centro, los tratamientos para añadir a la cuenta (ventas sin cita).
- En la cuenta: cantidades, **descuentos** (5 %, 10 %, 15 %, 20 %, 50 % o gratis), total grande.
- **Formas de pago**: efectivo (con teclado de importe, billetes rápidos y **cambio**), tarjeta (en el datáfono del
  banco) y Bizum. **Pago mixto** (una parte con tarjeta y el resto de otra forma) y **a deber**: lo que falte queda
  pendiente y aparece en el TPV y en el inicio hasta cobrarlo.
- **Factura con datos** si la clienta la pide (nombre, NIF y dirección; el NIF se comprueba).
- Cobro de una cita de hoy en tres toques: la cita, la forma de pago y **Cobrar**.
- Tras cobrar: el **cambio** en grande, el ticket en pantalla, **Reimprimir** y **Enviar por WhatsApp**. Al cobrar
  una cita, queda como realizada.

**Caja (Menú → Caja)**

- **Abrir** con el fondo del día (propone el que quedó al cerrar la última vez).
- Efectivo que debería haber en el cajón y lo cobrado con cada forma de pago.
- **Meter o sacar efectivo** con su motivo (abre el cajón).
- **Cerrar** contando el efectivo: te dice si cuadra, sobra o falta, y queda guardado.

**Facturación (Más → Facturación)**

- Listado de tickets, facturas y rectificativas, cada una con su ticket.
- **Devoluciones** (solo administración): factura rectificativa en negativo enlazada a la original y devolución del
  dinero (en efectivo sale de la caja). La original nunca se borra.
- Comprobación de que el **registro de facturación está íntegro**.

**Lo que garantiza la base de datos**

- Numeración **sin saltos** por serie y año: T (tickets), F (facturas con datos), R (rectificativas). Dos cobros a la
  vez no se pisan el número.
- **Nada cobrado se edita ni se borra**: ventas, pagos, movimientos de caja, facturas y registros.
- Cada factura deja un **registro encadenado** con huella; si alguien tocara uno, la cadena deja de cuadrar.
- Solo una caja abierta a la vez; los pagos van siempre a una caja abierta.

**Configuración**

- **Datos del centro**: nombre fiscal, NIF (comprobando la letra), dirección fiscal y mensaje del ticket.
- **Tratamientos**: IVA de cada uno y botón para ponérselo **a todos de una vez**.
- **Impresora y cajón**: USB en Windows, red/wifi o simulador; **Imprimir prueba** y **Abrir cajón**. El ticket
  imprime tildes y €.

**Instalación gratuita en el TPV y landing**

- Scripts para instalar la app en el ordenador del TPV, que arranca sola, hace la copia de seguridad diaria (con
  prueba de restauración) y se actualiza con un comando. Guía en `docs/instalacion-tpv.md`.
- Landing gratuita con tratamientos, precios, bonos (que no caducan) y cita por WhatsApp. Guía en `docs/landing.md`.

## 2. Cómo probarlo paso a paso

1. **Más → Tratamientos**: pon el IVA a todos (por ejemplo, 21, si la gestoría lo confirma).
2. **Más → Configuración → Datos del centro**: nombre fiscal, NIF y dirección.
3. **Más → Configuración → Impresora y cajón**: elige tu impresora (o «Simulador») e imprime una prueba.
4. **Caja**: abre con 50 €.
5. **Agenda**: da una cita para hoy, ábrela y pulsa **Cobrar**. Elige **Efectivo**, toca **10 €** y **Cobrar**:
   verás el cambio y el ticket.
6. **TPV**: añade dos tratamientos, ponle un descuento a uno, paga una parte con tarjeta y el resto con Bizum.
7. **TPV**: añade uno y pulsa **Dejarlo todo a deber**; luego cóbralo desde «A deber».
8. **Más → Facturación**: abre el primer ticket y haz una devolución en efectivo.
9. **Caja**: saca 10 € para una compra y cierra contando el efectivo.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (importes, descuentos, IVA por tipo, pagos y cambio, arqueo, numeración, huella encadenada, NIF/NIE/CIF, ticket y ESC/POS, y todo lo de las fases 0 y 1) | 85 de 85 correctas |
| Base de datos (cobro todo o nada, sin datos fiscales no se factura, pago mixto y a deber, factura completa, números seguidos incluso con dos cobros a la vez, nada cobrado se edita ni se borra, cadena intacta y sin bifurcaciones, devolución con rectificativa, caja con descuadre, una sola caja abierta) | 27 de 27 correctas |
| Landing (todos los tratamientos y precios, bonos, WhatsApp con mensaje, nada de terceros) | 7 de 7 correctas |
| Recorridos del TPV en pantalla de 15" (IVA, datos fiscales, impresora simulada, abrir caja, cobrar una cita con cambio, descuento y pago mixto, a deber, factura con datos, devolución, cerrar caja con descuadre, registro de actividad) | 12 de 12 correctas |
| Recorridos de las fases 0 y 1 (acceso, agenda, cabinas, clientas, reservas) | 45 de 45 correctas |
| Copia de seguridad de Windows ejecutada de verdad (copia y restauración de las 29 tablas) | Correcta |

## 4. Errores encontrados y corregidos

- **Formularios que se vaciaban al dar error.** Si al guardar algo salía un error (un NIF mal escrito, por ejemplo),
  se borraba todo lo escrito. Pasaba en casi todos los formularios, también en el de reserva de las clientas.
  Corregido: ahora solo se vacían los de alta, después de guardar bien.
- Al cerrar la caja o poner el IVA a todos, el mensaje de resultado desaparecía porque la pantalla cambiaba. Ahora
  lo muestra la página.
- El script de copias para Windows pasaba mal una consulta a PostgreSQL. Se corrigió y se ha ejecutado de verdad:
  copia y restauración correctas.
- «Diseño de cejas» estaba duplicado con «Diseño y depilación de cejas». Quitado.
- En la pantalla de 15", al pagar en efectivo el teclado dejaba el botón **Cobrar** fuera de la vista. Ahora el botón
  va justo debajo de las formas de pago y el teclado debajo.

## 5. Qué queda pendiente

**Para cerrar la fase (requiere tu parte):**

- **Instalar en el TPV** siguiendo `docs/instalacion-tpv.md` y **activar la landing** (`docs/landing.md`, un
  minuto).
- **Hardware**: marca y modelo del TPV, de la impresora y del cajón, para probar la impresión real. Los scripts de
  Windows están comprobados aquí (sintaxis y la copia de seguridad ejecutada de verdad), pero la instalación completa
  y la impresora solo se pueden probar en tu ordenador.
- **Gestoría**: tipo de IVA de los tratamientos y régimen fiscal.
- **Datos fiscales**: nombre del titular, NIF y dirección fiscal.
- **WhatsApp del centro** y dirección, para la landing. Y los datos del aviso legal (titular y NIF).

**Sigue pendiente de antes:**

- Si los bonos excluyen «Unos labios más gruesos».
- El precio y la duración del microblading (puedes añadirlo tú en Tratamientos, marcando «Va sola»).

**Para la fase 8 (VERI\*FACTU):** el registro encadenado ya existe; falta el formato oficial de la huella, el QR y el
envío a la Agencia Tributaria. Para Adela, autónoma, la fecha límite hoy es el 1 de julio de 2027.

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 3: bonos y tarjetas regalo.
