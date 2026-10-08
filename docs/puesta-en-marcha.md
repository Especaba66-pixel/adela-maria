# Poner la app en marcha (Render, en Frankfurt)

Guía paso a paso. Tardarás unos 20 minutos. Necesitas tu cuenta de GitHub y una tarjeta para el pago mensual.

**Coste aproximado:** unos 15 a 30 € al mes (servidor «Starter» y base de datos «Basic»). Comprueba el precio al
crearlo: Render lo muestra antes de confirmar.

## 1. Crear la cuenta

1. Entra en https://render.com y pulsa **Get Started**.
2. Elige **Sign up with GitHub** y acepta. Así Render puede leer el proyecto.
3. Cuando te pregunte, da acceso al repositorio **adela-maria** (solo a ese).
4. Añade una tarjeta en **Billing** (el plan gratuito borra la base de datos a los pocos días; no sirve).

## 2. Crear la app y la base de datos de una vez

1. En el panel de Render pulsa **New** → **Blueprint**.
2. Elige el repositorio **adela-maria**. Render lee el archivo `render.yaml` y te enseña lo que va a crear:
   - **adela-maria**: la aplicación.
   - **adela-maria-db**: la base de datos.
   Las dos en **Frankfurt**.
3. Te pedirá dos valores. Escríbelos y guárdalos en un sitio seguro:
   - **ADMIN_CONTRASENA**: tu contraseña de administración (mínimo 10 caracteres). Solo la usarás para registrar
     el TPV y tu móvil.
   - **ADMIN_PIN**: tu PIN de 4 a 6 números (no vale 1234 ni números repetidos).
4. Pulsa **Apply**. Render tarda unos minutos en preparar todo.

Cuando termine, la app tendrá una dirección del tipo `https://adela-maria.onrender.com`.

## 3. Primeros pasos en la app

1. Abre `https://…onrender.com/gestion` **en el TPV**.
2. Registra el equipo: usuario `adela`, la contraseña del paso 2 y nombre del equipo «TPV».
3. En **Más → Configuración**:
   - **Datos del centro**: teléfono de WhatsApp del centro y dirección (las cabinas ya están en 2).
   - **Horario**: tu horario de la semana.
4. En **Más → Tratamientos**, añade el **Microblading** con la casilla «Va sola» marcada, y pon precio y duración
   al diseño de cejas si es distinto del de depilación.
5. Haz lo mismo en tu móvil si quieres ver la agenda fuera del centro: abre `/gestion` y regístralo como «Móvil de
   Adela».

La web de clientas es la dirección principal (`https://…onrender.com`). Más adelante podemos ponerle un dominio
propio (por ejemplo, `adelamaria.es`).

## 4. Avísame

Cuando esté creado, dime la dirección y comprobaré que todo funciona. Si algún paso no sale como aquí, mándame una
captura de pantalla.

## Lo que queda para después

- **Copia de seguridad propia.** Render guarda copias continuas y permite volver a cualquier momento de los últimos
  días. El plan pide además una copia diaria conservada 30 días y otra semanal cifrada en un segundo proveedor.
  Hasta que la configuremos, el inicio de la app mostrará el aviso rojo de copias: es intencionado, para no olvidarlo.
- **Dominio propio**, si lo quieres.
