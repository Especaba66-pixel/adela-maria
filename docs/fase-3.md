# Cierre de la fase 3 · Bonos y tarjetas regalo

Estado: **hecha, pendiente de tu aprobación.** El plan la da por terminada cuando **un bono se vende, se gasta sesión
a sesión y avisa cuando queda una**. Todo eso funciona y está probado (punto 3).

## 1. Qué se ha construido

**Bonos en el TPV**

- Los bonos están en el TPV, en «Bonos y tarjetas regalo». Un bono va siempre a nombre de una clienta: si la cuenta
  no viene de una cita, se elige con **Elegir clienta** (buscando por nombre o teléfono).
- **La primera sesión, el mismo día**: si la clienta compra el bono al cobrar su cita, el tratamiento de ese día ya
  va con el bono nuevo. Solo se cobra el bono.
- **En las visitas siguientes se descuenta solo.** Al cobrar su cita, lo que cubre su bono aparece «Con bono» y no se
  cobra. Si todo va con bono, el botón dice **Descontar del bono**: no hay venta ni factura, la cita queda cobrada y
  se ve cuántas sesiones le quedan. Si un día prefiere pagarlo, se toca **Cobrarlo**.
- En una venta sin cita, al elegir la clienta se ven sus bonos y, en cada tratamiento que cubren, el botón
  **Usar bono**.
- El ticket le dice a la clienta cuántas sesiones le quedan.

**Tarjetas regalo**

- Se venden desde el TPV con el importe que se quiera (atajos de 20, 30, 50 y 100 €), para quién es y de parte de
  quién. Se pagan enteras en el momento.
- Se imprime un **vale** con un código del tipo **AM-XK7P-3RTW**. No es una factura: la factura se hace cuando se
  usa. El vale también se puede enviar por WhatsApp.
- **Para pagar con ella**: forma de pago **Tarjeta regalo**, se escribe el código (da igual mayúsculas, espacios o
  guiones), **Comprobar** y se ve el saldo. Si no llega, se paga lo que tenga y el resto de otra forma. El ticket
  dice el saldo que le queda.

**Más → Bonos y tarjetas regalo**

- Bonos activos con lo que le queda a cada clienta, y los agotados o anulados aparte.
- Tarjetas regalo con su saldo, y **Consultar** por código.
- Cada bono tiene su historial: qué tratamiento, cuándo y quién lo descontó.

**Avisos**

- En el inicio, la tarjeta **Bonos por acabar**: bonos a los que les queda una sesión, para ofrecer otro.
- La ficha de la clienta enseña sus bonos.
- **Más → Tratamientos**: los bonos muestran su IVA, y **Poner a todos** también pone el IVA a los bonos.

**Correcciones (solo administración)**

- **Devolver una sesión** a un bono descontado por error, con su motivo. No se borra nada: queda anotado.
- **Devolver una venta con un bono** (en Facturación): solo si no se ha usado; el bono queda anulado.
- **Devolver una tarjeta regalo** sin estrenar: se devuelve el dinero y deja de valer. Si se devuelve una venta que se
  pagó con tarjeta regalo, el saldo vuelve a la tarjeta.

**Lo que garantiza la base de datos**

- Un bono no gasta más sesiones de las que tiene, aunque se cobre dos veces a la vez, ni se usa si está anulado,
  caducado o para un tratamiento que no cubre.
- El saldo de una tarjeta regalo nunca queda en negativo y una tarjeta anulada no se usa.
- Las sesiones y los movimientos de saldo no se editan ni se borran; los bonos y las tarjetas solo se pueden anular.

**Landing**: nuevo apartado **Tarjeta regalo** con el botón para pedirla por WhatsApp, la **dirección** del centro
(C/ Francisco Pizarro 13, 1.ª planta, 06210 Torremejía) y el enlace a su **Instagram**
(@adela_maria_bellezaholistica). La dirección también queda como dato inicial del centro en la app.

## 2. Cómo probarlo paso a paso

1. **Caja**: ábrela.
2. **Agenda**: da una cita de hoy a una clienta con un facial. Pulsa **Cobrar**.
3. En el TPV toca **Bono facial 3 sesiones**: el facial pasa a «Con bono». Cobra los 120 € con tarjeta. El ticket dice
   que le quedan 2 sesiones.
4. Dale otra cita de hoy con otro facial y pulsa **Cobrar**: sale «Con bono» y total 0 €. Pulsa **Descontar del
   bono**. Te dice que le queda 1 sesión.
5. **Inicio**: «Bonos por acabar» marca 1. En su ficha ves el bono.
6. Abre el bono y prueba **Devolver una sesión al bono…**.
7. **TPV → Tarjeta regalo**: 50 €, para «Lucía», en efectivo. Apunta el código del vale.
8. **TPV**: añade «Verse sin manchas» y «Brazos» (53 €). Forma de pago **Tarjeta regalo**, escribe el código,
   **Comprobar**, **Pagar 50 € así y el resto de otra forma**, **Tarjeta**, **Cobrar**.
9. **Más → Bonos y tarjetas regalo**: consulta el código; tendrá 0 € de saldo.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (estado y caducidad de bonos, a qué bono va cada sesión, códigos de tarjeta legibles y sin sesgo, saldo, importes, y todo lo de las fases 0 a 2) | 93 de 93 correctas |
| Base de datos (bono a nombre de clienta y facturado al venderlo, sesión sin venta ni factura, bono + otro tratamiento, solo sus tratamientos y su clienta, sin pasarse ni con dos cobros a la vez, devolver una sesión, devolución de venta con bono usado y sin usar, caducidad, primera sesión el mismo día; tarjeta sin factura y con código único, consulta por código, pago sin pasar del saldo, saldo que vuelve al devolver, devolución de tarjeta sin usar, y todo lo de la fase 2) | 41 de 41 correctas |
| Landing (con tarjeta regalo e Instagram, sin cargar nada de terceros) | 9 de 9 correctas |
| Recorridos de la fase 3 en pantalla de 15" (bono que necesita clienta, compra con primera sesión, descuento automático, aviso en inicio y ficha, devolver sesión, vender tarjeta y vale, pagar con tarjeta y el resto con tarjeta bancaria, consulta por código, devolver tarjeta, caja, registro de actividad) | 12 de 12 correctas |
| Recorridos de las fases 0 a 2 | 57 de 57 correctas |

## 4. Errores encontrados y corregidos

- Al probar, faltaba un caso real: la clienta que **compra el bono y se hace la primera sesión ese día**. Se cobraba
  el bono y además el facial. Ahora el facial de ese día va con el bono nuevo.
- En la forma de pago, «Tarjeta» y «Tarjeta regalo» se podían confundir al buscarlos: ahora cada botón se identifica
  por su nombre exacto.
- Textos como «quedan 1 sesiones»: ahora dice «queda 1 sesión».

## 5. Qué queda pendiente

**Para la gestoría (importante):** confirmar que **el bono se factura al venderlo** y que **la tarjeta regalo se
factura al usarla** (punto 1 de `docs/decisiones.md`, fase 3). Si dice otra cosa, el cambio es pequeño.

**Para decidir tú:**

- ~~Bonos y labios~~: decidido, los bonos valen también para «Unos labios más gruesos».
- ~~Caducidad de las tarjetas regalo~~: decidido, no caducan.

**Para la web:** las fotos y el logo de su Instagram. Instagram no deja copiarlas desde fuera, así que hace falta que
me las mandes (guardadas desde el móvil o el original del logo). Las pongo en la propia página, sin cargar nada de
Instagram, para que la web siga sin cookies ni rastreo.

**Sigue pendiente de antes:** instalar en el TPV y probar un día real (fase 2), IVA y datos fiscales, WhatsApp del
centro, datos del aviso legal, modelos del TPV, impresora y cajón, y el microblading.

**Mejoras que podrían venir después:** editar el precio o las sesiones de un tipo de bono desde la pantalla (ahora
se cambian en las tarifas), y avisar por WhatsApp a la clienta cuando le queda una sesión (fase 5).

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 4: stock, proveedores y gastos.
