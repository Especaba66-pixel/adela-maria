import { defineConfig } from "vitest/config";

// Las pruebas de base de datos comparten una sola base de datos de pruebas: se ejecutan en serie.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 } });
