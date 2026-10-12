"use client";
import { startTransition, type FormEvent } from "react";

/**
 * Envía un formulario sin vaciarlo. Con `<form action={…}>`, React vacía el formulario al terminar, también cuando
 * hay un error, y se perdería todo lo escrito. Con esto los datos se quedan hasta que se guardan bien.
 */
export function sinReinicio(accion: (datos: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  };
}
