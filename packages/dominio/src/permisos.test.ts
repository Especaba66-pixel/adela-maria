import { describe, expect, it } from "vitest";
import { PERMISOS, esRol, puede } from "./permisos";

describe("permisos", () => {
  it("el administrador puede todo", () => {
    for (const permiso of PERMISOS) expect(puede("administrador", permiso)).toBe(true);
  });

  it("recepción cobra y lleva la caja, pero no configura, ni ve informes, ni anula facturas", () => {
    expect(puede("recepcion", "cobrar")).toBe(true);
    expect(puede("recepcion", "caja.abrir_cerrar")).toBe(true);
    expect(puede("recepcion", "agenda.ver_toda")).toBe(true);
    expect(puede("recepcion", "configuracion.gestionar")).toBe(false);
    expect(puede("recepcion", "informes.ver")).toBe(false);
    expect(puede("recepcion", "facturas.anular")).toBe(false);
    expect(puede("recepcion", "usuarios.gestionar")).toBe(false);
  });

  it("una profesional solo ve su agenda y sus fichas", () => {
    expect(puede("profesional", "agenda.ver_propia")).toBe(true);
    expect(puede("profesional", "fichas.ver_propias")).toBe(true);
    expect(puede("profesional", "agenda.ver_toda")).toBe(false);
    expect(puede("profesional", "cobrar")).toBe(false);
    expect(puede("profesional", "caja.abrir_cerrar")).toBe(false);
  });

  it("reconoce los roles válidos", () => {
    expect(esRol("recepcion")).toBe(true);
    expect(esRol("jefa")).toBe(false);
    expect(esRol(undefined)).toBe(false);
  });
});
