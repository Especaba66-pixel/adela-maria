# Cierre de la fase 7 · Informes, equipo y fichas avanzadas

Estado: **pendiente de aprobación**. El plan la da por terminada cuando **los informes del mes coinciden con caja y
facturación**. Funciona y está probado (punto 3): el informe hace la comprobación él mismo y la enseña arriba.

## 1. Qué se ha construido

**Informes (Más → Informes, solo administración)**, mes a mes:

- **Cuadre con caja y facturación**: comprueba que las ventas con factura suman lo mismo que las facturas emitidas,
  que las ventas son lo cobrado más lo que queda a deber, y que el efectivo cobrado es el que entró en el cajón. Si
  algo no coincide, lo marca en rojo con la diferencia.
- **Ventas**: total, número, ticket medio, devoluciones, cobrado por método y ventas por día.
- **Tratamientos**: cuántos se cobraron, importe y sesiones de bono hechas. **Bonos vendidos**.
- **Productos**: unidades, importe, coste y margen.
- **Clientas**: nuevas, atendidas, con compra, citas hechas, no vinieron, canceladas, y las que más han gastado.
- **Equipo y comisiones**: por profesional, citas, sesiones de bono, lo vendido sin IVA y su comisión.
- **Caja**: cada apertura con fondo, esperado, contado y diferencia.
- **Descargar para Excel** todo el mes.

**Equipo**

- En **Configuración → Profesionales**, cada una tiene su **comisión en servicios y en productos** (%).
- En el **TPV** se elige **Atendió** (sale solo si hay más de una profesional). Por defecto, la de la cita o quien
  cobra.

**Consentimientos informados**

- **Configuración → Consentimientos informados**: tres textos de partida (micropigmentación, tratamientos faciales y
  corporales, y uso de fotografías), editables, y para qué tratamientos hacen falta. El de micropigmentación ya va
  unido al microblading.
- Si una cita de hoy o mañana lleva un tratamiento que pide consentimiento y la clienta no lo ha firmado, sale en el
  **Inicio** y en la **cita**, con el botón para firmarlo.
- La clienta lo **lee y firma con el dedo** en el TPV. Queda en su ficha con el texto exacto, la firma, la fecha y
  quién lo registró. Se puede **imprimir** y **retirar** (queda anotado; lo firmado no se borra).

**Fotos en la ficha**

- **Antes, después** u otra, con nota. Se reducen en el propio equipo antes de guardarlas y entran en las copias de
  seguridad. Se pueden borrar.

## 2. Cómo probarlo

1. **Configuración → Profesionales**: pon a cada una su comisión.
2. **TPV**: cobra algo y elige quién atendió.
3. **Más → Informes**: arriba debe decir «Todo coincide». Mira el equipo y sus comisiones. Descarga el Excel.
4. **Configuración → Consentimientos informados**: revisa los textos. Da una cita de microblading a una clienta:
   en el Inicio sale que tiene que firmar. Pulsa, que firme con el dedo y mira su ficha.
5. En la ficha de una clienta, **sube una foto** de antes.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (meses y periodos, comisiones sobre la base sin IVA, porcentajes, cuadre que señala la diferencia, consentimientos de partida, variables, firma válida, y todo lo anterior) | 120 de 120 correctas |
| Base de datos (consentimientos sembrados, lo firmado solo se retira una vez, tamaño máximo de las fotos, cada venta y su devolución guardan quién atendió, y todo lo anterior) | 58 de 58 correctas |
| Servicio de Cloudflare y landing | 20 de 20 correctas |
| Recorridos de la fase 7 (comisión con porcentaje no válido y válido; «Atendió» en el TPV y su comisión exacta; **informe del mes que cuadra** con todo lo cobrado en las demás pruebas —efectivo, tarjeta, Bizum, a deber, factura completa, devolución, bonos, tarjetas regalo y productos—; descarga para Excel; mes sin ventas; aviso de consentimiento en la cita y el Inicio, firma con el dedo, sin firma no deja; retirar y vuelve el aviso; foto subida, vista y borrada) | 6 de 6 correctas |
| Recorridos de las fases 0 a 6 y reservas por internet | 96 de 96 correctas |

## 4. Errores encontrados y corregidos

- El informe fallaba al pasar las fechas a la base de datos; corregido antes de cerrar la fase.

## 5. Qué queda pendiente

- **Revisar los textos de los consentimientos** con tu asesoría o tu seguro.
- Decir las **comisiones** de cada profesional (si las hay).
- La fase 6 (WhatsApp automático) sigue esperando a que tengas el teléfono y el alta en Meta.

**Sigue pendiente de antes:** instalar en el TPV, precio y duración de microblading, maquillaje y uñas, WhatsApp del
centro, IVA y datos fiscales con la gestoría, productos y gasto en cabina.

## 6. Aprobación

Pendiente. Cuando apruebes las fases 6 y 7, las paso a la rama principal y empiezo la fase 8 (VERI*FACTU).
