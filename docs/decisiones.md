# Decisiones técnicas

Decisiones tomadas al programar, dentro de lo que fija el plan maestro. Cada una dice qué se eligió y por qué.

## Fase 0

**Drizzle en lugar de Prisma.** El plan dejaba elegir entre los dos. Drizzle escribe SQL muy cercano al real y permite
migraciones a mano en SQL, que hacen falta para que sea la propia base de datos la que impida la doble reserva (fase 1)
y la edición de facturas (fase 2).

**Reglas en la base de datos.** El registro de actividad y el de copias solo admiten añadir filas: un disparador rechaza
cualquier cambio o borrado, incluso si la aplicación falla. Usuarios, tratamientos, categorías y bonos no se pueden
borrar: se desactivan o se marcan como anulados. Los tratamientos duran tramos de 5 minutos y no tienen precio negativo.

**Contraseñas y PIN con scrypt.** Viene incluido en Node.js, así que no depende de programas externos que haya que
compilar en el servidor. Cada secreto lleva su propia sal y el formato guarda los parámetros, para poder endurecerlos más
adelante sin invalidar los existentes.

**El personal entra solo con PIN, sin contraseñas** (decidido por Espe). La única contraseña es la de la administración y
solo sirve para registrar un equipo de confianza (el TPV, o su móvil) una vez. A partir de ahí, en ese equipo se entra
tocando el nombre y escribiendo el PIN. Un PIN de 4 cifras es débil por sí solo, así que solo vale en equipos
registrados: desde cualquier otro sitio no se puede entrar. Los equipos se pueden retirar desde Configuración, y la base
de datos impide que la administración se quede sin contraseña.

**Bloqueo por intentos.** Cinco fallos seguidos (de contraseña o de PIN) bloquean a esa persona 5 minutos. El mensaje de
error no dice si el usuario existe.

**Sesiones en la base de datos.** El navegador solo guarda un código aleatorio; en la base de datos se guarda su huella.
Así se puede cerrar la sesión de alguien a distancia (al desactivarlo, cambiar su rol o retirar el TPV). La sesión se
cierra tras 15 minutos sin actividad (configurable con `SESION_MINUTOS_INACTIVIDAD`).

**Permisos en el código, no en tablas.** Los tres roles del plan y lo que puede hacer cada uno están en
`packages/dominio/src/permisos.ts`, con pruebas. Mientras no haga falta crear roles a medida desde la pantalla, es más
seguro que estén en código revisado que en datos editables. Si se necesita, se pasa a tablas en una fase posterior.

**Siempre queda una administradora.** No se puede desactivar ni quitar el rol a la última persona con administración.

**IVA vacío hasta que confirme la gestoría.** Cada tratamiento tiene su tipo de IVA, pero empieza vacío. La facturación
(fase 2) no dejará cobrar un tratamiento sin IVA asignado.

**Comprobación de copias.** Junto a cada copia se guarda cuántas filas tenía cada tabla. La prueba de restauración
restaura la copia en una base de datos aparte y comprueba que cada tabla tiene al menos esas filas (como nada se borra,
nunca debería tener menos) y que las reglas de la base de datos siguen activas. El resultado se ve en Configuración y,
si falla, sale un aviso rojo en el inicio.

**Las clientas no necesitan claves** (decidido por Espe). La web pública (`/`) muestra los tratamientos y permite pedir
cita con nombre y teléfono. Como cualquiera podría pedir una cita falsa, la petición entra como «por confirmar»: el
centro la ve en el inicio, escribe a la clienta por WhatsApp con un toque y la confirma o la rechaza. Para frenar abusos:
un campo trampa invisible para programas automáticos, un máximo de 3 peticiones sin contestar por teléfono y un freno
si llegan más de 20 en 10 minutos. Se guarda el texto de privacidad que aceptó cada clienta. En la fase 1, con la
agenda, la clienta verá los huecos libres y la petición se convertirá en una cita.

**La gestión del centro vive en `/gestion`** y no aparece en buscadores; la web pública sí.

**Precio y duración pueden quedar por decidir.** Para poder ofrecer un servicio nuevo antes de fijar su precio (diseño
de cejas). La web muestra «Precio a consultar», se puede pedir cita y el inicio avisa de lo que falta. En la fase 2 no
se podrá cobrar un tratamiento sin precio.
