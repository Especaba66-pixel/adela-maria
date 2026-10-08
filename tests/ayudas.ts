import { expect, type Page } from "@playwright/test";

/** Los avisos de la app (Next.js añade otro role="alert" vacío para anunciar los cambios de página). */
export const alerta = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function teclearPin(page: Page, pin: string) {
  for (const cifra of pin) await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/** Registra el equipo (navegador) como TPV con la contraseña de administración y entra. */
export async function registrarTpv(page: Page) {
  await page.goto("/gestion");
  await expect(page).toHaveURL(/\/gestion\/registrar-equipo$/);
  await page.getByLabel("Usuario de administración").fill("adela");
  await page.getByLabel("Contraseña").fill("contrasena-de-prueba");
  await page.getByRole("button", { name: "Registrar este equipo" }).click();
  await expect(page.getByTestId("usuario-actual")).toHaveText("Adela");
}

/** Día AAAA-MM-DD en Madrid, sumando días a hoy. */
export function diaMadrid(diasDesdeHoy: number): string {
  const d = new Date(Date.now() + diasDesdeHoy * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
}
