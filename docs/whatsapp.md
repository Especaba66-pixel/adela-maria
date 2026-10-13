# WhatsApp automático: alta en Meta paso a paso

Hasta que esto esté hecho, la app funciona igual que en la fase 5: el botón verde abre WhatsApp con el mensaje escrito.
Cuando esté hecho, los mensajes aprobados se envían desde la app, los recordatorios salen solos y las respuestas de
las clientas llegan a la app.

## Antes de empezar: el número

Un número dado de alta en la API **deja de funcionar en la app de WhatsApp del móvil** (salvo la modalidad
«coexistencia» de WhatsApp Business, que Meta no ofrece en todos los casos). Lo más sencillo es usar **un número aparte**
(una línea móvil barata o un fijo que reciba SMS o llamadas) solo para los envíos automáticos. Las clientas pueden
responder a ese número y su respuesta sale en la app.

## 1. Cuenta de empresa en Meta

1. Entra en <https://business.facebook.com> con tu Facebook y crea la cuenta de empresa «Adela María · Belleza
   holística» (nombre, dirección y web del centro).
2. En <https://developers.facebook.com> → **Mis apps** → **Crear app** → tipo **Empresa** → añade el producto
   **WhatsApp**. Elige la cuenta de empresa del paso 1.
3. En **WhatsApp → Configuración de la API** → **Añadir número de teléfono**: escribe el número del centro para los
   envíos y verifícalo con el código que llega por SMS o llamada.
4. Apunta el **Identificador del número de teléfono** (Phone number ID, una tira de cifras). Es `WHATSAPP_NUMERO_ID`.
5. Añade una **forma de pago** en la cuenta de WhatsApp (Meta cobra cada mensaje de utilidad o marketing).

## 2. Token permanente

1. En **Configuración del negocio → Usuarios del sistema** → **Añadir** → nombre «adela-tpv», rol **Administrador**.
2. **Asignar activos**: la app (control total) y la cuenta de WhatsApp (control total).
3. **Generar token** → elige la app → permisos `whatsapp_business_messaging` y `whatsapp_business_management` →
   caducidad **Nunca**. Copia el token: es `WHATSAPP_TOKEN`. **No lo pegues en el chat ni en ningún mensaje**: solo en
   el archivo `.env` del TPV.

## 3. Avisos de Meta (webhook)

Meta avisa de si un mensaje llegó, se leyó o falló, y de lo que contestan las clientas. Esos avisos llegan al servicio
de Cloudflare de las reservas, que está siempre encendido.

1. En la app de Meta → **Configuración → Básica** → copia la **Clave secreta de la app**.
2. Inventa un **token de verificación** (una palabra larga cualquiera, por ejemplo `adela-whatsapp-2026-xyz`).
3. En GitHub → el repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `WHATSAPP_SECRETO_APP` = la clave secreta de la app.
   - `WHATSAPP_TOKEN_VERIFICACION` = el token del paso 2.
4. En GitHub → **Actions** → «Servicio de reservas» → **Run workflow** (para publicarlo con esos secretos).
5. En Meta → **WhatsApp → Configuración → Webhook** → **Editar**:
   - URL: `https://adela-reservas.especaba66.workers.dev/api/whatsapp`
   - Token de verificación: el del paso 2.
   - Pulsa **Verificar y guardar** y después **Suscribirse** al campo **messages**.

## 4. En el TPV

En el archivo `.env` de la app del TPV añade las dos líneas y reinicia la app:

```
WHATSAPP_TOKEN=el token del punto 2
WHATSAPP_NUMERO_ID=el identificador del punto 1
```

Las reservas por internet (`RESERVAS_URL` y `RESERVAS_CLAVE`) tienen que estar puestas: por ahí llegan los avisos de
Meta. En **Más → WhatsApp** debe salir «Conectado con WhatsApp de Meta».

## 5. Plantillas para aprobar en Meta

En Meta → **WhatsApp → Plantillas de mensajes** → **Crear plantilla**, idioma **Español**. Copia el texto tal cual (las
variables se escriben `{{1}}`, `{{2}}`…). Meta suele aprobarlas en minutos u horas.

| Mensaje de la app | Nombre en Meta | Categoría | Texto | Variables en la app | Botones |
| --- | --- | --- | --- | --- | --- |
| Recordatorio de la cita de mañana | `recordatorio_cita` | Utilidad | Hola, {{1}}. Te recordamos tu cita de {{2}} mañana, {{3}}, a las {{4}} en Adela María · Belleza holística. ¿Nos confirmas que vienes? | nombre, servicios, fecha, hora | Respuesta rápida: «Confirmar» y «Cambiar cita» (en ese orden) |
| Confirmar una cita pedida en la web | `confirmar_cita` | Utilidad | Hola, {{1}}. Te confirmamos tu cita de {{2}} el {{3}} a las {{4}} en Adela María · Belleza holística. ¡Te esperamos! | nombre, servicios, fecha, hora | — |
| Qué tal después del tratamiento | `que_tal_tratamiento` | Utilidad | Hola, {{1}}. ¿Qué tal te encuentras después de tu {{2}}? Cualquier duda, aquí estamos. | nombre, servicios | — |
| Le queda una sesión del bono | `renovar_bono` | Utilidad | Hola, {{1}}. Te queda {{2}} de tu {{3}}. Si quieres seguir, te reservamos la próxima cita o te preparamos un bono nuevo. | nombre, quedan, bono | — |
| Hace tiempo que no viene | `te_echamos_de_menos` | Marketing | Hola, {{1}}. ¡Hace tiempo que no te vemos por Adela María! Cuando quieras, te buscamos un hueco para cuidarte. Si no quieres recibir más mensajes, responde BAJA. | nombre | — |
| Felicitación de cumpleaños | `felicitacion` | Marketing | ¡Feliz cumpleaños, {{1}}! Todo el equipo de Adela María · Belleza holística te desea un día precioso. Si no quieres recibir más mensajes, responde BAJA. | nombre | — |

Cuando Meta apruebe cada una: en la app, **Más → WhatsApp** → el mensaje → **Datos de Meta** → escribe el nombre, la
categoría, las variables en el mismo orden y marca los botones si los tiene. Cambia también el texto de la app para que
coincida (es el que se guarda en la ficha). Meta decide la categoría final.

## 6. Encender el envío automático

**Más → WhatsApp → Envío automático**: marca **Recordatorios** (y, si quieres, **Qué tal**) y la franja horaria. Con
el TPV encendido dentro de esa franja, cada recordatorio sale una sola vez el día anterior.

## Qué hace la app con las respuestas

- **Confirmar** (o «sí», «confirmo», «ok»): la cita queda confirmada, se marca «✓ confirmó por WhatsApp» en la agenda
  y se le contesta «¡Gracias…! Tu cita queda confirmada».
- **Cambiar cita** o cualquier otra cosa: sale en el Inicio para que la leas; desde su ficha le contestas (gratis
  durante 24 horas desde su mensaje).
- **BAJA**: se le retiran los dos permisos, queda anotado en su ficha y se le confirma.
- Un número que no está en ninguna ficha: sale en el Inicio con el número.

## Coste

Meta cobra cada mensaje de **utilidad** y de **marketing** entregado, con una tarifa por país que publica en
<https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing>. Las respuestas en las 24 horas
siguientes a un mensaje de la clienta (y las plantillas de utilidad dentro de esa ventana) son gratis. En **Más →
WhatsApp** se ve cuántos se han enviado este mes de cada tipo.
