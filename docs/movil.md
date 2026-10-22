# Usar la gestión desde el móvil

La app vive en el TPV del centro. Desde el móvil se entra a esa misma app: lo que hagas en el móvil se ve en el TPV
y al revés. Las pantallas se adaptan al móvil y se puede instalar como una app más.

## Dentro del centro (misma wifi)

Funciona con la conexión privada de abajo. Sin ella, no: la app solo admite conexiones seguras (https) y, por la wifi,
el TPV no las ofrece.

## Desde cualquier sitio: Tailscale (gratis)

Tailscale crea una conexión privada y cifrada entre el móvil y el TPV. **La app no queda abierta a internet**: solo
entran los aparatos que tú añades a tu cuenta de Tailscale. Es gratis para uso personal (hasta 3 usuarios y 100
aparatos).

### 1. En el TPV

1. Entra en <https://tailscale.com> → **Get started** y crea la cuenta con tu Google o Microsoft.
2. Descarga **Tailscale para Windows**, instálalo y entra con esa cuenta.
3. En <https://login.tailscale.com/admin/dns>: activa **MagicDNS** y, más abajo, **HTTPS Certificates** → **Enable**.
4. En el TPV, abre **PowerShell como administrador** y escribe:

   ```powershell
   tailscale serve --bg 3000
   ```

   Te dirá una dirección como `https://tpv-adela.tu-red.ts.net`. **Apúntala**: es la de la app en el móvil. Solo hay
   que hacerlo una vez; se mantiene aunque se reinicie el TPV.

### 2. En el móvil

1. Instala la app **Tailscale** (Play Store o App Store) y entra con **la misma cuenta**. Actívala.
2. Abre en el navegador la dirección del paso 1.4.
3. Sale «Registrar este equipo»: escribe tu usuario y contraseña de administración. Desde entonces entras con tu PIN.
4. **Instálala como app**:
   - Android (Chrome): menú ⋮ → **Añadir a pantalla de inicio** (o **Instalar app**).
   - iPhone (Safari): botón compartir → **Añadir a pantalla de inicio**.

### 3. Avisos en el móvil (notificaciones)

Para que suene el móvil cuando una clienta escribe por WhatsApp o reserva por internet:

1. Abre la app **desde el icono de la pantalla de inicio** (en iPhone es obligatorio: iOS 16.4 o posterior).
2. **Más** → abajo, **Avisos en este móvil** → **Activar avisos en este móvil** → **Permitir**.
3. Llega un aviso de prueba. Al tocar un aviso se abre la ficha de la clienta o la agenda.

Qué avisa: mensajes de clientas que no son una simple confirmación (cambiar la cita, preguntas, números sin ficha)
y las reservas por internet (también si no había hueco). Las confirmaciones y las bajas no avisan: se resuelven solas.
Llega a quien tenga permiso para atenderlo (administración y recepción). Se desactiva en el mismo sitio; al quitar
el móvil en **Equipos** deja de recibirlos.

Los avisos los manda el TPV (tarda como mucho lo que tarde en sincronizar, 1 minuto) a través del servicio de
notificaciones de Google o Apple, así que llegan aunque el móvil no tenga Tailscale activo en ese momento. Solo
llevan el nombre de la clienta y el texto, cifrados de punta a punta.

### Cosas a saber

- **El TPV tiene que estar encendido** y con internet para entrar desde fuera (la app y los datos están en él).
- La sesión se cierra sola tras 15 minutos sin usarla; vuelves a entrar con el PIN.
- **Si pierdes el móvil**: en el TPV, **Más → Configuración → Equipos** → quita el móvil; y en
  <https://login.tailscale.com/admin/machines>, quita el aparato. Así no puede entrar nadie con él.
- Otra persona del equipo puede usar su móvil igual: se le invita a tu red de Tailscale (**Users → Invite**) y entra
  con su usuario y su PIN, con los permisos de su rol.

## Alternativa

Con un **dominio propio** (unos 10 €/año) se puede usar **Cloudflare Tunnel** con una dirección tipo
`gestion.adelamaria.es` sin instalar nada en el móvil. Es más cómodo para muchas personas, pero la app queda
accesible desde internet (protegida por usuario y contraseña) y hay que configurar un control de acceso. Si lo
prefieres, te lo preparo.
