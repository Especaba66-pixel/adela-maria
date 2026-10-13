# Cierre de la fase 4 · Stock, proveedores y gastos

Estado: **hecha, pendiente de tu aprobación.** El plan la da por terminada cuando **una venta descuenta stock y salta
el aviso de stock bajo**. Funciona y está probado (punto 3).

## 1. Qué se ha construido

**Stock (Más → Stock)**

- Productos **para vender** (con precio e IVA) y **para cabina** (los que se gastan en los tratamientos).
- Para cada uno: cuántos quedan, el mínimo («avisar cuando queden…») y el proveedor.
- **Aviso de stock bajo**: en el Inicio sale «Hay que reponer: …» y la tarjeta **Stock bajo** dice cuántos. En la
  lista, los que hay que reponer salen marcados.
- Ficha de cada producto con su **historial** (compras, ventas, gasto en cabina, recuentos), el **recuento** (cuentas
  lo que hay y se anota la diferencia) y **roto o caducado**.
- **Gasto en cabina**: en un producto de cabina se indica cuánto gasta cada tratamiento (por ejemplo, 1 de cera por
  piernas). Al cobrar el tratamiento, o descontarlo de un bono, se resta solo.

**Compras (Stock → Registrar una compra)**

- Se copia la factura del proveedor: productos, cantidades y coste sin IVA. Calcula base, IVA y total.
- Al guardarla, los productos **entran en el stock**, se guarda su último coste y la compra queda **en los gastos**.

**TPV**

- Nuevo apartado **Productos** con el precio y lo que queda de cada uno. Al cobrar, **se descuentan del stock** en el
  mismo cobro (si el cobro falla, no se descuenta nada). Si se devuelve la venta, vuelven al stock.

**Proveedores (Más → Proveedores)**

- Nombre, NIF, teléfono, email y notas; cuántas compras y cuánto gasto lleva cada uno.

**Gastos (Más → Gastos, solo administración)**

- Por trimestre: se anota cada factura recibida (luz, alquiler, material…) con el total y el IVA; la app separa
  base e IVA. Si se paga **con dinero de la caja**, sale del cajón.
- Resumen del trimestre: gastos, **IVA de las ventas** (de las facturas emitidas) e **IVA de los gastos**, con la
  diferencia orientativa.
- **Descargar el trimestre para la gestoría**: un archivo que abre Excel con el resumen de IVA, las facturas emitidas
  y los gastos (con nº de factura y NIF del proveedor).
- Un gasto anotado por error se **anula** (no se borra).

**Lo que garantiza la base de datos**

- El stock es la suma de los movimientos, y los movimientos no se editan ni se borran: un error se corrige con un
  recuento. Las compras tampoco se modifican.
- Productos, proveedores y gastos no se borran (se anulan o se retiran).
- En cada gasto, base más IVA cuadra siempre con el total.

## 2. Cómo probarlo paso a paso

1. **Más → Proveedores**: añade uno.
2. **Más → Stock → Añadir un producto**: uno para vender, con precio, IVA y «Avisar cuando queden» 1.
3. **Registrar una compra**: elige el proveedor y el producto, 3 unidades con su coste. Verás que el stock sube a 3.
4. **TPV**: en «Productos», vende 2. Vuelve al **Inicio**: «Stock bajo» marca 1 y sale el aviso «Hay que reponer».
5. Entra en el producto y prueba un **recuento**.
6. **Más → Gastos**: anota la luz del mes y pulsa **Descargar el trimestre para la gestoría**.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (stock y mínimos, productos, desglose de IVA de un total, totales de compra, trimestres, CSV para Excel, permisos, y todo lo anterior) | 99 de 99 correctas |
| Base de datos (alta de productos y proveedores, compra que entra en stock con su gasto, venta que descuenta en el mismo cobro, cobro fallido que no descuenta, gasto en cabina al cobrar un tratamiento, devolución que repone, recuento, merma, historial inalterable, gasto pagado con la caja, anulación, y todo lo anterior) | 51 de 51 correctas |
| Reservas por internet y landing | 18 de 18 correctas |
| Recorridos de la fase 4 en pantalla de 15" (proveedor, productos, compra, venta en TPV, aviso de stock bajo en el Inicio, historial y recuento, gastos con IVA, descarga para la gestoría, registro de actividad) | 7 de 7 correctas |
| Recorridos de las fases 0 a 3 y reservas por internet | 76 de 76 correctas |

## 4. Errores encontrados y corregidos

- Ninguno en las pruebas de la fase. Se ajustó una prueba: un producto con 0 unidades y mínimo 1 ya sale como
  «reponer», que es lo correcto.

## 5. Qué queda pendiente

**Para empezar a usarlo:**

- Dar de alta los **productos** que vendes y los de cabina, y hacer un **recuento** inicial de cada uno (es la forma
  de cargar lo que ya tienes).
- Decirme si quieres que **el gasto en cabina** se descuente (por ejemplo, cera en depilación) y cuánto por tratamiento.

**Para la gestoría:** que revise el archivo trimestral y diga si necesita otro formato (el plan prevé Excel; el archivo
es CSV y se abre directamente con Excel).

**Sigue pendiente de antes:** instalar en el TPV, precio y duración de microblading, maquillaje y uñas, WhatsApp del
centro, IVA y datos fiscales confirmados por la gestoría.

## 6. Aprobación

Revisa los pasos del punto 2. Cuando lo apruebes, empiezo la fase 5: avisos, tareas y seguimiento.
