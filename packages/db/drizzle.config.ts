import "./src/entorno";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/esquema.ts",
  out: "./migraciones",
  casing: "snake_case",
});
