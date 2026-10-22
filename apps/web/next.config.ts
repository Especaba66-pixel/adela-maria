import { config } from "dotenv";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Las variables viven en el .env de la raíz del repositorio (las del sistema tienen prioridad).
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@adela/db", "@adela/dominio", "@adela/ui"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  // Las fotos de las fichas (ya reducidas en el equipo) pasan por una acción del servidor.
  // Desde el móvil se entra por Tailscale (https://<equipo>.<red>.ts.net), que reenvía al TPV.
  experimental: { serverActions: { bodySizeLimit: "4mb", allowedOrigins: ["*.ts.net"] } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // El service worker de los avisos se revisa siempre, para que los cambios lleguen a los móviles.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
