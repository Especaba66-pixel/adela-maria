import { config } from "dotenv";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Las variables viven en el .env de la raíz del repositorio (las del sistema tienen prioridad).
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@adela/db", "@adela/dominio", "@adela/ui"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
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
    ];
  },
};

export default nextConfig;
