# Instalar la app en el ordenador del TPV (gratis)

La gestión del centro (agenda, clientas, cobros, caja y facturas) funciona en el **propio ordenador del TPV**. No hay
que pagar alojamiento y sigue funcionando aunque se caiga internet. La web para las clientas es la
[landing gratuita](landing.md).

Lo que hace falta: el TPV con **Windows 10 u 11**, conexión a internet durante la instalación y una hora.

## 1. Descargar el proyecto

1. En el TPV, abre **PowerShell como administrador**: botón de Inicio → escribe «PowerShell» → clic derecho →
   **Ejecutar como administrador**.
2. Copia y pega estas dos líneas (y pulsa Intro):

   ```powershell
   winget install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements
   git clone --branch main https://github.com/Especaba66-pixel/adela-maria.git C:\AdelaMaria
   ```

   Si la segunda línea dice que no conoce «git», cierra PowerShell, ábrelo otra vez como administrador y repite solo
   la segunda línea.

## 2. Instalar

En la misma ventana:

```powershell
cd C:\AdelaMaria
powershell -ExecutionPolicy Bypass -File infra\windows\instalar.ps1
```

Te pedirá tres cosas (apúntalas en un sitio seguro):

- Una **contraseña para la base de datos**.
- Tu **contraseña de administración** de la app (mínimo 10 caracteres).
- Tu **PIN** (de 4 a 6 números).

Tarda unos minutos. Al terminar verás en el escritorio el acceso **«Adela María»**.

## 3. Primer uso

1. Abre **«Adela María»** en el escritorio. Se abre en pantalla completa.
2. Registra el equipo: usuario `adela`, tu contraseña, nombre del equipo «TPV».
3. En **Más → Configuración**:
   - **Datos del centro**: nombre fiscal, NIF y dirección fiscal (sin ellos no se puede cobrar), y el mensaje del
     ticket.
   - **Impresora y cajón**: ver el apartado siguiente.
4. En **Más → Tratamientos**: pon el **IVA** cuando te lo confirme la gestoría (hay un botón para ponerlo a todos de
   una vez).
5. En **Caja**: abre la caja con el fondo del día. Ya puedes cobrar.

## 4. Impresora de tickets y cajón

1. Instala la impresora con el programa del fabricante (como cualquier impresora).
2. **Compártela**: Configuración de Windows → Impresoras → tu impresora → Propiedades de impresora → pestaña
   **Compartir** → marca «Compartir esta impresora» y ponle de nombre **TICKETS**.
3. En la app: **Más → Configuración → Impresora y cajón** → «Por USB, instalada en Windows», nombre **TICKETS**,
   papel de 80 mm (o 58 mm si es la pequeña) → Guardar → **Imprimir prueba**.
4. El cajón se enchufa a la impresora (cable tipo teléfono). Prueba con **Abrir cajón**.

Si tu impresora va por cable de red o wifi, elige esa opción y escribe su dirección IP (sale en el ticket de
configuración que imprime al encenderla manteniendo pulsado el botón de avance de papel).

Si la impresora falla, **el cobro se guarda igual**: el ticket se puede reimprimir o enviar por WhatsApp.

## 5. Copias de seguridad

Cada día a las 14:30 se hace sola una copia en **Documentos → Copias Adela María**, se comprueba que se puede
recuperar y se conservan 30 días. El resultado se ve en **Configuración → Copias de seguridad**; si falla, sale un
aviso rojo en el inicio.

**Muy recomendable:** instala **Google Drive para ordenador** y mueve esa carpeta dentro de tu Drive (o pon en el
`.env` la línea `DIR_COPIAS=` con la carpeta de Drive). Así las copias salen del TPV: si el ordenador se rompe o lo
roban, no se pierde nada.

## 6. Actualizar a una versión nueva

Cuando apruebes una fase nueva:

```powershell
cd C:\AdelaMaria
powershell -ExecutionPolicy Bypass -File infra\windows\actualizar.ps1
```

Hace una copia de seguridad antes, descarga la versión aprobada y reinicia la app.

## Limitaciones de tenerla en el TPV

- Solo se usa **desde el TPV** (no desde tu móvil fuera del centro).
- Las clientas piden cita por **WhatsApp** desde la landing, no eligiendo hora en la web.
- Los **envíos automáticos de WhatsApp** (fase 6) necesitan un servidor en internet. Lo veremos al llegar ahí.

Si más adelante quieres todo eso, la app se puede pasar a internet (ver [puesta-en-marcha.md](puesta-en-marcha.md))
sin perder nada: se copia la base de datos.
