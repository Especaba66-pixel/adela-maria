# WhatsApp automático de Adela María: guía completa

Con esto activado, la app del TPV:

- manda sola el **recordatorio** el día antes de cada cita, con botones «Confirmar» y «Cambiar cita»;
- si la clienta pulsa **Confirmar**, la cita queda confirmada en la agenda sin que Adela haga nada;
- manda la **confirmación** de las reservas de la web, el **«¿qué tal?»** después del tratamiento, el aviso de **bono
  por acabar**, el **«te echamos de menos»** y la **felicitación de cumpleaños**;
- recoge las **respuestas** de las clientas en su ficha y avisa en el Inicio de las que hay que leer;
- si una clienta responde **BAJA**, deja de escribirle.

Mientras no esté activado, todo sigue funcionando con el botón verde, que abre WhatsApp con el mensaje escrito.

## Cómo lo vamos a hacer

Espe y Adela no pueden estar juntas, así que se hace en tres tandas:

| Tanda | Quién | Desde dónde | Cuándo |
| --- | --- | --- | --- |
| **A. Preparar Meta** | Espe sola | iPad, Mac u ordenador | Ya (unos 40 minutos) |
| **B. Conectar el TPV** | Adela 5 minutos, con Espe al teléfono | El TPV del centro | Cuando llegue el TPV |
| **C. El número y el encendido** | Espe, con Adela al teléfono 10 minutos | El Mac de Espe, manejando el TPV | Después de B |

Lo que hace falta tener a mano:

- El **Facebook de Adela** (usuario y contraseña).
- Una **tarjeta** para la forma de pago de Meta (cobra unos céntimos por recordatorio).
- Acceso al **GitHub** del proyecto (el tuyo, Especaba66-pixel).
- Para la tanda C: el **TPV encendido** y **Adela con el móvil del centro** (624 74 57 34) al teléfono.

> **Las claves de Meta (clave secreta de la app y token) no se pegan nunca en un chat, un correo ni un WhatsApp.** La
> clave secreta va solo a GitHub (paso A5) y el token solo al TPV (paso C3).

---

## A. Preparar Meta (Espe sola, ya)

En el iPad: usa **Safari** (no la app de Facebook) y, en cada web, toca **«aA» → «Solicitar sitio web de
escritorio»**. Si alguna pantalla no carga o falta un botón, para y sigue desde un ordenador.

### A1. Cuenta de empresa

1. Entra en **business.facebook.com** con el Facebook de Adela.
2. **Crear cuenta**: nombre **«Adela María · Belleza holística»**, el nombre de Adela y su correo
   (adelamaria_16@hotmail.com). Si ya existe, entra en ella.
3. Si pide **verificar el teléfono de Adela** (no el del centro): manda el código y que Adela te lo dicte.
4. En **Configuración del negocio → Información del negocio** rellena dirección (C/ Francisco Pizarro 13, 1.ª planta,
   06210 Torremejía) y web (https://adelamariatorremejia.es).

Si dice «inténtalo más tarde», es porque la cuenta de Facebook es nueva: vuelve a probar al día siguiente.

### A2. La app de WhatsApp

1. Entra en **developers.facebook.com** con el mismo Facebook → **Empezar** (si es la primera vez, acepta y verifica
   el correo) → **Mis apps → Crear app**.
2. Nombre **«Adela TPV»**, correo de Adela. Caso de uso: **«Conectar con clientes a través de WhatsApp»** (o tipo
   **Empresa** y después añadir el producto **WhatsApp**).
3. Elige la cuenta de empresa del paso A1.
4. Meta crea una **cuenta de WhatsApp** y un **número de prueba**. Todavía **no añadas el 624 74 57 34**: eso es la
   tanda C.

### A3. Forma de pago

En **business.facebook.com → Configuración del negocio → Cuentas → Cuentas de WhatsApp** → la cuenta → **Configuración
de pago** → añade la tarjeta. Sin ella no salen los recordatorios.

### A4. Las 6 plantillas

En **WhatsApp Manager** (business.facebook.com → **WhatsApp Manager → Plantillas de mensajes**) → **Crear plantilla**,
idioma **Español**, y copia exactamente las de la tabla del final de esta guía. Meta suele aprobarlas en minutos u
horas; si rechaza alguna, mándame el motivo.

### A5. Los avisos de Meta (webhook)

Meta avisa de si el mensaje llegó y se leyó, y de lo que contestan las clientas. Esos avisos llegan al servicio de
reservas de Cloudflare (siempre encendido) y el TPV se los trae cada minuto.

1. En **developers.facebook.com → Adela TPV → Configuración de la app → Básica** → **Clave secreta de la app** →
   **Mostrar** → cópiala.
2. En **github.com/Especaba66-pixel/adela-maria → Settings → Secrets and variables → Actions → New repository
   secret**:
   - Nombre `WHATSAPP_SECRETO_APP`, valor: la clave secreta del paso 1.
   - Nombre `WHATSAPP_TOKEN_VERIFICACION`, valor: una palabra larga que te inventes (por ejemplo
     `adela-meta-2026-` seguido de 10 letras al azar). Apúntala, la necesitas en el paso 4.
3. En GitHub → **Actions → «Reservas por internet» → Run workflow → Run workflow**. Espera al tic verde (1 minuto).
4. En **developers.facebook.com → Adela TPV → WhatsApp → Configuración → Webhook → Editar**:
   - URL de devolución de llamada: `https://adela-reservas.especaba66.workers.dev/api/whatsapp`
   - Token de verificación: la palabra del paso 2.
   - **Verificar y guardar**. Después, en **Campos del webhook**, **Suscribirse** a **messages**.

Si al verificar da error, revisa que la palabra sea idéntica en GitHub y en Meta, y que el paso 3 terminara en verde.

**Con esto la tanda A está hecha.** Avísame y lo compruebo.

---

## B. Conectar el TPV (cuando llegue)

Lo que Adela hace en el TPV, contigo al teléfono (está explicado también en `instalacion-tpv.md`):

1. Abre Chrome y entra en **remotedesktop.google.com/support** → **Obtener asistencia** → instala → **Generar
   código** y te lo dicta.
2. Tú, en tu Mac, en la misma web → **Dar asistencia** → escribes el código. Adela pulsa **Compartir**.
3. Ya conectada, deja el **acceso fijo** (remotedesktop.google.com/access → «Configurar acceso remoto», nombre «TPV
   Adela», PIN) e instalamos la app del centro.

Desde ahí ya no hace falta Adela para manejar el TPV.

---

## C. El número y el encendido (Espe desde el Mac, con Adela al teléfono)

Conéctate al TPV (remotedesktop.google.com/access → «TPV Adela»). Todo lo que sigue se hace **en el navegador del
TPV**, así el código QR sale en la pantalla del centro, al lado de Adela.

### C1. Añadir el 624 74 57 34 manteniendo WhatsApp Business

En **developers.facebook.com → Adela TPV → WhatsApp → Configuración de la API → Añadir número de teléfono** (o
**WhatsApp Manager → Números de teléfono → Añadir**):

- **Si aparece «Conectar la app WhatsApp Business» / «Usar un número de WhatsApp Business existente»**
  (coexistencia): elígela. Sale un **código QR en la pantalla del TPV**. Adela, en el móvil del centro, abre
  **WhatsApp Business** y lo escanea donde le indique Meta (normalmente un aviso que le llega en la propia app, o
  **Ajustes → Dispositivos vinculados**). Así el número **sigue funcionando en su móvil** y además en la app del
  TPV. Puede pedir compartir el historial de chats: se puede aceptar.
- **Si no aparece esa opción, no sigas con el 624 74 57 34**: al darlo de alta así dejaría de funcionar en WhatsApp
  Business del móvil. Plan B: una tarjeta prepago a nombre de Adela solo para los mensajes automáticos; se añade
  igual y el código de verificación llega por SMS a ese número (lo puede dictar quien tenga la tarjeta). Las clientas
  pueden contestar a ese número y su respuesta sale en la app.

Cuando esté añadido, apunta el **Identificador del número de teléfono** (Phone number ID): una tira de cifras.

### C2. Token permanente (se crea y se guarda en el TPV)

1. **business.facebook.com → Configuración del negocio → Usuarios → Usuarios del sistema → Añadir**: nombre
   «adela-tpv», rol **Administrador**.
2. **Asignar activos**: la app «Adela TPV» (control total) y la cuenta de WhatsApp (control total).
3. **Generar token** → app «Adela TPV» → caducidad **Nunca** → permisos `whatsapp_business_messaging` y
   `whatsapp_business_management` → **Generar** → **Copiar**.

### C3. Ponerlo en la app del TPV

Sin salir del TPV, abre el **Bloc de notas** con el archivo `C:\AdelaMaria\.env` y añade al final (pegando el token
que acabas de copiar):

```
WHATSAPP_TOKEN=el token copiado
WHATSAPP_NUMERO_ID=el identificador del paso C1
```

Guarda y reinicia la app (o el TPV). En **Más → WhatsApp** debe salir **«Conectado con WhatsApp de Meta»**.

### C4. Datos de cada plantilla en la app

En **Más → WhatsApp**, en cada mensaje → **Datos de Meta**: escribe el nombre que tiene en Meta, la categoría, las
variables en el mismo orden de la tabla y marca los botones si los tiene. Si Meta cambió algo del texto al aprobarla,
cambia también el texto de la app para que coincida.

### C5. Encender el envío automático

**Más → WhatsApp → Envío automático**: marca **Recordatorios** y **Qué tal**, y la franja **de 10:00 a 19:00** (los
mensajes solo salen dentro de esa franja y con el TPV encendido).

### C6. Probar

1. Crea en la app una clienta de prueba con **tu móvil** y una cita para mañana.
2. En su ficha, envía el **recordatorio**: te tiene que llegar con los botones.
3. Pulsa **Confirmar**: en un minuto la cita sale confirmada en la agenda con «✓ confirmó por WhatsApp».
4. Responde **BAJA**: la ficha queda sin permisos y te llega la confirmación.
5. Borra la clienta de prueba.

## Las 6 plantillas (texto exacto)

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
