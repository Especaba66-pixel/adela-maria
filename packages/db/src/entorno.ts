import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Las variables viven en el .env de la raíz del repositorio.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
