"use client";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import { useEffect, useState } from "react";
import { activarAvisos, avisoDePrueba, avisosActivos, clavePublicaAvisos, desactivarAvisos } from "@/app/gestion/(app)/mas/acciones-avisos";

type Estado = "cargando" | "no-admite" | "iphone-sin-instalar" | "bloqueados" | "apagados" | "activados";

const aBytes = (b64u: string) => {
  const t = atob(b64u.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
};

async function registro() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Activar o desactivar los avisos (notificaciones) en el móvil desde el que se usa la app. */
export function AvisosMovil() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setEstado(ios && !instalada ? "iphone-sin-instalar" : "no-admite");
      }
      if (Notification.permission === "denied") return setEstado("bloqueados");
      const sub = await (await registro()).pushManager.getSubscription();
      setEstado(sub && (await avisosActivos(sub.endpoint)) ? "activados" : "apagados");
    })().catch(() => setEstado("no-admite"));
  }, []);

  const activar = async () => {
    setOcupado(true);
    setMensaje(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setEstado("bloqueados");
      const reg = await registro();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(await clavePublicaAvisos()) }));
      const j = sub.toJSON();
      const r = await activarAvisos({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" });
      if (!r.ok) return setMensaje({ ok: false, texto: r.error });
      setEstado("activados");
      const llego = await avisoDePrueba(sub.endpoint);
      setMensaje(llego ? { ok: true, texto: "Hecho. Te acabamos de mandar un aviso de prueba." } : { ok: false, texto: "Quedan activados, pero el aviso de prueba no ha salido. Revisa que el TPV tenga internet." });
    } catch {
      setMensaje({ ok: false, texto: "No se han podido activar en este móvil. Inténtalo de nuevo." });
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    const sub = await (await registro()).pushManager.getSubscription();
    if (sub) {
      await desactivarAvisos(sub.endpoint);
      await sub.unsubscribe();
    }
    setEstado("apagados");
    setMensaje(null);
    setOcupado(false);
  };

  const probar = async () => {
    setOcupado(true);
    const sub = await (await registro()).pushManager.getSubscription();
    const llego = sub ? await avisoDePrueba(sub.endpoint) : false;
    setMensaje(llego ? { ok: true, texto: "Aviso de prueba enviado." } : { ok: false, texto: "No ha salido. Revisa que el TPV tenga internet." });
    setOcupado(false);
  };

  return (
    <section aria-label="Avisos en este móvil">
      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Avisos en este móvil</h2>
        <p className="text-tinta-suave">Te suena una notificación cuando una clienta escribe por WhatsApp o reserva por internet, aunque tengas la app cerrada.</p>
        {estado === "no-admite" && <Aviso prioridad="informativo">Este navegador no admite avisos. En el móvil, abre la app instalada en la pantalla de inicio.</Aviso>}
        {estado === "iphone-sin-instalar" && (
          <Aviso prioridad="informativo">En iPhone, primero añade la app a la pantalla de inicio (compartir → «Añadir a pantalla de inicio») y ábrela desde ese icono.</Aviso>
        )}
        {estado === "bloqueados" && (
          <Aviso prioridad="importante">Los avisos están bloqueados para esta app. Actívalos en los ajustes del móvil (Notificaciones) y vuelve aquí.</Aviso>
        )}
        {mensaje && <Aviso prioridad={mensaje.ok ? "correcto" : "urgente"}>{mensaje.texto}</Aviso>}
        {estado === "apagados" && (
          <Boton onClick={activar} disabled={ocupado}>
            {ocupado ? "Activando…" : "Activar avisos en este móvil"}
          </Boton>
        )}
        {estado === "activados" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-correcto" data-testid="avisos-activados">✓ Activados</span>
            <Boton variante="secundario" onClick={probar} disabled={ocupado}>
              Enviar un aviso de prueba
            </Boton>
            <Boton variante="discreto" onClick={desactivar} disabled={ocupado}>
              Desactivar
            </Boton>
          </div>
        )}
      </Tarjeta>
    </section>
  );
}
