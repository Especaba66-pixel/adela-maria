# Cierre de la fase 5 · Avisos, tareas y seguimiento

Estado: **aprobada** el 13 de octubre de 2026. El plan la da por terminada cuando **el Inicio responde a «qué tengo que hacer
hoy» sin buscar**. Funciona y está probado (punto 3).

## 1. Qué se ha construido

**Inicio: «Qué hay que hacer hoy»**

Una sola lista, de lo más urgente a lo menos, con todo lo que pide atención hoy:

- Caja de otro día sin cerrar, clientas que deben dinero, citas pedidas en la web por confirmar, solicitudes sin hora.
- Productos que hay que reponer.
- **Recordatorios** de las citas de mañana.
- **Seguimiento**: preguntar qué tal a quien vino ayer.
- **Bonos** a los que queda una sesión: ofrecer renovarlo.
- **Cumpleaños** de hoy.
- Clientas que **hace tiempo que no vienen** (más de 90 días y sin cita).
- **Tareas** apuntadas a mano.

Cada aviso trae su acción: **WhatsApp** (abre WhatsApp con el mensaje ya escrito), **Hecho** (deja de salir) o
**Mañana** (vuelve a salir mañana). Si una clienta no tiene teléfono o no ha dado permiso, el aviso sale sin botón y
dice por qué.

**WhatsApp con un clic**

- No se envía nada solo: se abre WhatsApp con el texto y tú pulsas enviar.
- Lo que se prepara queda anotado en la ficha de la clienta («Mensajes preparados»: qué, quién y cuándo).
- En la ficha, el botón **WhatsApp** ofrece los mensajes que se le pueden mandar (recordatorio de su próxima cita,
  felicitación, «hace tiempo que no te vemos»…) o **Escribir otra cosa**.

**Avisos y tareas (menú Avisos)**

- La lista completa de hoy, **apuntar una tarea** (con día y clienta opcionales), las de más adelante y las últimas
  hechas, con quién las hizo. En la ficha de cada clienta también se puede apuntar una tarea sobre ella.

**Mensajes de WhatsApp (menú WhatsApp, administración)**

- Los seis mensajes de partida se pueden cambiar. Se ve cómo queda con un ejemplo, y no deja guardar una palabra entre
  llaves que no exista.

**Avisos automáticos (Más → Configuración → Avisos)**

- Encender o apagar recordatorios, seguimiento, bonos y cumpleaños, y los días para considerar que una clienta no
  vuelve.

**Grupos de clientas (Clientas)**

- Con cita próxima, hace tiempo que no vienen, cumplen años este mes, con bono activo, nuevas este mes y aceptan
  promociones. En «hace tiempo que no vienen» y «cumplen años» cada una tiene su botón de WhatsApp si lo permite.

## 2. Cómo probarlo paso a paso

1. En **Clientas → + Nueva clienta**, crea una con tu móvil, el **cumpleaños** de hoy (cualquier año) y marca
   **Promociones y novedades**.
2. Ve al **Inicio**: en «Qué hay que hacer hoy» sale «Hoy cumple años…». Pulsa **WhatsApp**: se abre con la
   felicitación escrita. Vuelve a la app: el aviso ya no sale y en su ficha aparece en «Mensajes preparados».
3. Da una cita para mañana a una clienta con **Avisos de sus citas** marcado: sale el recordatorio. Prueba **Mañana**.
4. En **Avisos**, apunta una tarea; sale en el Inicio. Márcala **Hecha**.
5. En **WhatsApp**, cambia el texto de la felicitación y repite el paso 2 con otra clienta.
6. En **Clientas**, pulsa «Cumplen años este mes».

## 3. Pruebas ejecutadas

| Conjunto | Resultado |
| --- | --- |
| Reglas (plantillas y variables, orden por urgencia, ajustes, cumpleaños incluido el 29 de febrero, clientas que no vuelven, y todo lo anterior) | 106 de 106 correctas |
| Base de datos (mensajes de partida sin pisar los cambiados, mensajes preparados inalterables, y todo lo anterior) | 53 de 53 correctas |
| Reservas por internet y landing | 18 de 18 correctas |
| Recorridos de la fase 5 en pantalla de 15" (Inicio con WhatsApp ya escrito y anotado en la ficha, sin botón si no hay permiso, «Mañana», tareas, editar mensajes, grupos de clientas, apagar avisos) | 6 de 6 correctas |
| Recorridos de las fases 0 a 4 y reservas por internet | 83 de 83 correctas |

## 4. Errores encontrados y corregidos

- Ninguno en las pruebas de la fase. Se ajustó una prueba anterior: el botón WhatsApp de la ficha ahora abre un menú
  de mensajes.

## 5. Qué queda pendiente

- **Revisar los textos** de los seis mensajes (menú WhatsApp) y cambiarlos a tu manera de hablar.
- Que las clientas tengan marcados sus **permisos** y su **cumpleaños** en la ficha para que salgan los avisos.
- Envío automático de recordatorios: es la **fase 6** (API oficial de WhatsApp, con su alta y su coste por mensaje).

**Sigue pendiente de antes:** instalar en el TPV, precio y duración de microblading, maquillaje y uñas, WhatsApp del
centro, IVA y datos fiscales confirmados por la gestoría, productos y gasto en cabina.

## 6. Aprobación

Aprobada por Espe el 13 de octubre de 2026. Siguiente: fase 6, WhatsApp automático con la API oficial.
