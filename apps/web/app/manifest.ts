import type { MetadataRoute } from "next";

/** Para instalar la gestión en el móvil («Añadir a la pantalla de inicio»): se abre a pantalla completa, sin barra del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Adela María · Gestión",
    short_name: "Adela María",
    description: "Agenda, clientas, cobros y avisos del centro.",
    start_url: "/gestion",
    scope: "/",
    display: "standalone",
    background_color: "#fffdf9",
    theme_color: "#fffdf9",
    lang: "es",
    icons: [
      { src: "/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
