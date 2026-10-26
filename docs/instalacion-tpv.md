# Instalar la app en el ordenador del TPV (gratis)

La gestión del centro (agenda, clientas, cobros, caja y facturas) funciona en el **propio ordenador del TPV**. No hay
que pagar alojamiento y sigue funcionando aunque se caiga internet. La web para las clientas es la
[landing gratuita](landing.md).

Lo que hace falta: el TPV con **Windows 10 u 11**, conexión a internet durante la instalación y una hora.

## 0. Acceso remoto y que no se apague (si se instala a distancia)

1. En el TPV, en **Chrome**: **remotedesktop.google.com/support** → «Obtener asistencia» → instalar → **Generar
   código**. Quien instala, desde su ordenador, entra en la misma web → «Dar asistencia» → escribe el código; en el TPV
   se pulsa **Compartir**.
2. Ya conectados, en el TPV: **remotedesktop.google.com/access** → «Configurar acceso remoto» → nombre «TPV Adela» y
   un PIN. Desde entonces se entra sin ayuda (el TPV tiene que estar encendido).
3. Que no se suspenda: en PowerShell como administrador,
   `powercfg /change standby-timeout-ac 0` y `powercfg /change hibernate-timeout-ac 0`.
4. La app arranca al **iniciar sesión** en Windows: si el TPV tiene contraseña de Windows, al encenderlo hay que
   entrar en la sesión (o configurar el inicio de sesión automático).

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

Te pedirá estas cosas (apúntalas en un sitio seguro):

- Una **contraseña para la base de datos**.
- Tu **contraseña de administración** de la app (mínimo 10 caracteres).
- Tu **PIN** (de 4 a 6 números).
- La **dirección del servicio de reservas**: `https://adela-reservas.especaba66.workers.dev`
- La **clave de sincronización de las reservas**: la misma que el secreto `RESERVAS_CLAVE` de GitHub. Para hacer una
  nueva sin que pase por ningún chat, antes de lanzar el instalador escribe en PowerShell
  `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_}) | Set-Clipboard`: queda copiada.
  Pégala en GitHub (**Settings → Secrets and variables → Actions → RESERVAS_CLAVE → ✏️ → Update**), vuelve a publicar
  el servicio (**Actions → «Reservas por internet» → Run workflow**) y pégala también cuando la pida el instalador.

Tarda unos minutos. Al terminar verás en el escritorio el acceso **«Adela María»**.

### Si algo falla (lo que pasó en la instalación de Adela)

- **«No se puede cargar el archivo pnpm.ps1… la ejecución de scripts está deshabilitada»**: usa `pnpm.cmd` en vez de
  `pnpm`, o antes `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (contesta **S**).
- **«Could not find a production build»**: la preparación no terminó. En `C:\AdelaMaria`: `pnpm.cmd build`,
  `pnpm.cmd db:migrate` y `pnpm.cmd db:seed`. Si `build` falla, el motivo sale encima de «ERR_PNPM…»; para leerlo
  entero: `pnpm.cmd build > error.txt 2>&1` y `notepad error.txt`.
- **No se acuerda de la contraseña de PostgreSQL**: `winget uninstall PostgreSQL.PostgreSQL.16`, borrar
  `C:\Program Files\PostgreSQL` y `C:\AdelaMaria\.env`, y volver a lanzar el instalador.
- **La app se arranca sola en segundo plano** (tarea «Adela María - App»; lo que escribe va a
  `infra\windows\app.log`). Para que lea cambios del `.env`, en PowerShell como administrador:
  `Stop-ScheduledTask -TaskName "Adela María - App"`, `Stop-Process -Name node -Force` y
  `Start-ScheduledTask -TaskName "Adela María - App"`. Lanzarla a mano a la vez falla (el puerto ya está ocupado).
- **«Reservas por internet: no se ha podido conectar»**: el motivo está en `app.log` («respondió 401» = la clave del
  `.env` no es la de GitHub). Las líneas `RESERVAS_URL=` y `RESERVAS_CLAVE=` van al final del `.env`.
- **Copiar y pegar entre el ordenador y el TPV** no siempre funciona con el escritorio remoto: abre esta guía en el
  navegador del propio TPV y copia los comandos desde ahí.

## 3. Primer uso

1. Abre **«Adela María»** en el escritorio. Se abre en pantalla completa.
2. Registra el equipo: tu correo (`adelamaria_16@hotmail.com`), tu contraseña de la app, nombre del equipo «TPV».
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

## Lo que hace falta además

- **Reservas por internet**: con la dirección y la clave del paso 2, en **Reservas web** sale «Reservas por internet
  al día» y las reservas de la web llegan solas cada minuto.
- **Desde el móvil**: ver [movil.md](movil.md) (Tailscale).
- **WhatsApp automático**: ver [whatsapp.md](whatsapp.md), tandas B y C.

La app depende de que el TPV esté encendido. Si más adelante se quiere en un servidor de internet, se puede pasar sin
perder nada (ver [puesta-en-marcha.md](puesta-en-marcha.md)): se copia la base de datos.
