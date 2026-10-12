# Landing del centro (gratis, en GitHub Pages)

Una página sencilla con los tratamientos, los precios y los bonos. Las clientas piden cita por WhatsApp con el
mensaje ya escrito. No tiene servidor ni base de datos, así que **no cuesta nada**.

Dirección: **https://especaba66-pixel.github.io/adela-maria/** (más adelante se puede poner un dominio propio, por
ejemplo `adelamaria.es`, que cuesta unos 10 € al año).

## Activarla (una sola vez, 1 minuto)

1. Entra en https://github.com/Especaba66-pixel/adela-maria
2. Pulsa **Settings** (arriba, a la derecha de las pestañas).
3. En el menú de la izquierda, pulsa **Pages**.
4. En **Build and deployment → Source**, elige **GitHub Actions**.

Listo. Cada vez que cambien las tarifas o la página, se vuelve a publicar sola en uno o dos minutos.

## Qué falta para que esté completa

- **El WhatsApp del centro.** Hasta que lo tenga, la página muestra «Muy pronto podrás pedir cita por WhatsApp» en
  lugar de los botones. Se pone en `packages/db/src/datos/centro.ts` (o me lo dices y lo pongo yo).
- ~~La dirección~~: ya puesta (C/ Francisco Pizarro 13, 1.ª planta, Torremejía).
- ~~El logo~~: puesto (originales en `infra/marca`).
- **Fotos de trabajos**: van en `apps/landing/publico/trabajos/<tipo>/` (microblading, maquillaje, unas, faciales) y salen solas en «Nuestros trabajos».
- **Aviso legal.** Una web de un negocio en España debe mostrar el nombre del titular, NIF y forma de contacto (Ley
  de Servicios de la Sociedad de la Información). Necesito esos datos para añadirlo.

## Cómo se hace

La página se genera con `pnpm --filter @adela/landing build` a partir de las mismas tarifas que usa la app
(`packages/db/src/datos/`), así nunca hay dos listas de precios distintas. No carga nada de terceros: ni
tipografías de Google ni estadísticas, así que no necesita aviso de cookies.
