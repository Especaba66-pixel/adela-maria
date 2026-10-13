# Reservas por internet (gratis, aunque el TPV esté apagado)

Lo primero que ve la clienta en la web es el **calendario de reservas**: elige tratamiento, día y hora libre, deja su
nombre y teléfono y reserva. La cita entra en la agenda del TPV «por confirmar» y se le confirma por WhatsApp.

## Cómo funciona

```text
 Clienta (móvil)  ──►  Web (GitHub Pages, gratis)
                         │  pide horas libres y reserva
                         ▼
               Servicio de reservas (Cloudflare, gratis, siempre encendido)
                         ▲  cada minuto, si el TPV está encendido:
                         │  · se trae las reservas nuevas a la agenda
                         │  · manda tratamientos, horario, citas a la vez y lo ocupado
                       TPV (app de gestión)
```

- **Siempre se puede reservar**, también de noche con el TPV apagado: el servicio de Cloudflare guarda las reservas
  y el TPV se las trae al encenderse.
- **Mismas reglas que la agenda**: hasta 3 citas a la vez; microblading, maquillaje y uñas van solos; respeta el
  horario, los bloqueos (vacaciones) y pide 2 horas de antelación como mínimo.
- **Nunca se pisan dos reservas**: la comprobación y el guardado van juntos, aunque reserven dos personas a la vez.
- **Privacidad**: cuando el TPV se trae una reserva, en Cloudflare se borran el nombre y el teléfono. Los datos
  quedan solo en el TPV. La base de datos de Cloudflare está en Europa.
- **Gratis**: el plan gratuito de Cloudflare da 100 000 visitas al día, de sobra.
- Si el TPV estuvo apagado y mientras tanto alguien cogió esa hora en el centro, la reserva entra como **petición**
  («la hora ya no estaba libre») para llamar a la clienta.

## Ponerlo en marcha (una sola vez, unos 10 minutos)

1. **Crear la cuenta de Cloudflare** (gratis): https://dash.cloudflare.com/sign-up con el correo del centro.
   No hace falta tarjeta ni dominio.
2. **Copiar el «Account ID»**: en el panel de Cloudflare, menú **Workers y Pages**; a la derecha sale
   **Account ID**. Cópialo.
3. **Crear un permiso (token) para GitHub**: arriba a la derecha, icono de persona → **My Profile → API Tokens →
   Create Token** → plantilla **Edit Cloudflare Workers** → **Use template**. En «Permissions» pulsa **+ Add more**
   y añade **Account · D1 · Edit**. En «Account Resources» elige tu cuenta. **Continue to summary → Create Token**.
   Copia el token (solo se ve una vez).
4. **Guardar tres secretos en GitHub**: en el repositorio, **Settings → Secrets and variables → Actions →
   New repository secret**, uno por uno:
   - `CLOUDFLARE_API_TOKEN`: el token del paso 3.
   - `CLOUDFLARE_ACCOUNT_ID`: el Account ID del paso 2.
   - `RESERVAS_CLAVE`: una clave larga (al menos 32 caracteres) que te paso yo. Es la que usa el TPV.
5. **Avisar** para lanzar la publicación. Al terminar da una dirección del tipo
   `https://adela-reservas.<tu-nombre>.workers.dev`. Se pone en `packages/db/src/datos/centro.ts` (`reservas`) y la
   web empieza a mostrar el calendario.
6. **En el TPV**: en el archivo `.env` (o al instalar) se ponen `RESERVAS_URL` (la dirección del paso 5) y
   `RESERVAS_CLAVE` (la misma clave del paso 4). En **Más → Reservas web** se ve «Reservas por internet al día».

## Para el día a día

- Las reservas de internet aparecen en **Reservas web** y en la agenda como «por confirmar». Confírmalas (con el
  botón de WhatsApp ya escrito) o recházalas: el hueco vuelve a quedar libre en internet al momento.
- Para que un tratamiento se pueda reservar por internet necesita **duración** (y conviene el precio). Microblading,
  maquillaje y uñas aparecerán cuando les pongas precio y duración en **Más → Tratamientos**.
- Para cerrar la agenda unos días (vacaciones), crea un **bloqueo** en la agenda: internet deja de ofrecer esas horas.
