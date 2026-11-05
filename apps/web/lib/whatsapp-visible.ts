/**
 * Mientras WhatsApp no funcione, la app no ofrece nada de WhatsApp (botones, enlaces ni la entrada del menú).
 * Para volver a mostrarlo: MOSTRAR_WHATSAPP=1 en el .env del TPV y actualizar.ps1.
 */
export const mostrarWhatsapp = () => process.env.MOSTRAR_WHATSAPP === "1";
