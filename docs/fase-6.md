# Cierre de la fase 6 · WhatsApp automático

Estado: **aprobada** el 13 de octubre de 2026. El plan la da por terminada cuando **un recordatorio sale solo y la respuesta de la
clienta confirma la cita**. Funciona y está probado con un Meta de prueba (punto 3). Para usarlo de verdad falta el alta
del centro en Meta (punto 5 y [docs/whatsapp.md](whatsapp.md)).

## 1. Qué se ha construido

**Envío desde la app (API oficial de Meta)**

- Cuando un mensaje está aprobado en Meta, el botón de los avisos y de la ficha pasa a ser **Enviar WhatsApp**: se envía
  sin salir de la app. Los que no están aprobados siguen abriendo WhatsApp, como en la fase 5.
- Cada mensaje queda en la ficha con su estado: **Enviado, Entregado, Leído** o **No se pudo enviar** (con el motivo).

**Recordatorios automáticos**

- Con el TPV encendido y dentro de la franja elegida (por defecto, de 10:00 a 20:00), sale solo el recordatorio de las
  citas de mañana a las clientas con permiso. Cada cita lo recibe una sola vez.
- Opcional: el «qué tal» del día después.
- Si un envío falla, sale en el Inicio «No se pudo enviar el recordatorio a…» con el motivo, para hacerlo a mano.

**Respuestas de las clientas**

- El recordatorio lleva los botones **Confirmar** y **Cambiar cita**. Al pulsar Confirmar (o contestar «sí»,
  «confirmo», «ok»), la cita queda confirmada, en la agenda sale **✓ confirmó por WhatsApp** y se le contesta
  «¡Gracias! Tu cita queda confirmada».
- «Cambiar cita» o cualquier otro mensaje sale en el Inicio. Desde su ficha se le **contesta** (gratis durante 24 horas
  desde su mensaje). La ficha muestra la conversación.
- Si responde **BAJA**, se le quitan los permisos, queda anotado en su ficha y se le confirma.

**Envío a un grupo (Más → WhatsApp → Enviar a un grupo de clientas)**

- Se elige un grupo (cumplen años este mes, hace tiempo que no vienen…) y un mensaje de promoción aprobado. Se ve a
  quién va (solo a quien acepta promociones) antes de enviar. Después, cuántos se entregaron y leyeron.

**Más → WhatsApp**

- Estado de la conexión con Meta, mensajes enviados este mes por tipo (lo que cobra Meta), envío automático (qué y en
  qué franja) y, en cada mensaje, sus **Datos de Meta**.

**Servicio de Cloudflare**: recibe los avisos de Meta (comprobando que vienen de Meta) y los guarda hasta que el TPV se
los lleva, aunque el TPV esté apagado.

## 2. Cómo probarlo

Sin el alta en Meta se puede ver todo menos el envío: **Más → WhatsApp** dice «Sin conectar» y los botones siguen
abriendo WhatsApp. Con el alta hecha:

1. Da de alta en Meta la plantilla `recordatorio_cita` con sus botones y apúntala en **Más → WhatsApp → Datos de Meta**.
2. Enciende **Recordatorios** en «Envío automático».
3. Crea una clienta con tu móvil y «Avisos de sus citas», y dale una cita para mañana.
4. En un minuto te llega el recordatorio. Pulsa **Confirmar**: en la agenda sale «✓ confirmó por WhatsApp».
5. Contesta otra cosa: sale en el Inicio. Respóndele desde su ficha.

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (avisos de Meta: estados, mensajes, botones y fotos; estados que no retroceden; respuestas «confirmar», «cambiar», «baja»; ventana de 24 horas; plantilla con variables y botones; franja horaria, y todo lo anterior) | 115 de 115 correctas |
| Base de datos (de un mensaje solo cambia el estado; el mismo aviso de una cita no se envía dos veces; y todo lo anterior) | 54 de 54 correctas |
| Servicio de Cloudflare (firma de Meta, alta del webhook, disponibilidad) y landing | 20 de 20 correctas |
| Recorridos de la fase 6 con un Meta de prueba (alta de los datos de Meta y del envío automático; recordatorio que sale solo una vez con sus botones; entregado y leído; la clienta confirma y se le da las gracias; mensaje libre en el Inicio y respuesta desde la ficha; BAJA; número sin WhatsApp con el motivo en el Inicio; envío desde un aviso; envío a un grupo solo a quien acepta promociones) | 7 de 7 correctas |
| Recorridos de las fases 0 a 5 y reservas por internet | 89 de 89 correctas |

## 4. Errores encontrados y corregidos

- Ninguno en el funcionamiento. Se ajustaron pruebas anteriores: en la ficha, el botón WhatsApp convive ahora con la
  sección «WhatsApp» de la conversación.

## 5. Qué queda pendiente (por tu parte)

- **Decidir el número**: un número dado de alta en la API deja de funcionar en la app del móvil. Recomiendo una línea
  aparte solo para los envíos automáticos.
- **Alta en Meta** siguiendo [docs/whatsapp.md](whatsapp.md): cuenta de empresa, número, forma de pago, token, webhook y
  las plantillas (vienen escritas). El token **no se pega en el chat**: va en el `.env` del TPV y los dos secretos del
  webhook en GitHub.
- Consultar la **tarifa de Meta para España** al empezar a enviar.

**Sigue pendiente de antes:** instalar en el TPV, precio y duración de microblading, maquillaje y uñas, WhatsApp del
centro, IVA y datos fiscales con la gestoría, productos y gasto en cabina.

## 6. Aprobación

Aprobada por Espe el 13 de octubre de 2026. Falta activarla de verdad con el alta en Meta (docs/whatsapp.md).
