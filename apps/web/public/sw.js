// Avisos al móvil de Adela María. Solo muestra la notificación y, al tocarla, abre la pantalla de la app que toca.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let datos = { titulo: "Adela María", texto: "Tienes un aviso nuevo.", url: "/gestion" };
  try {
    datos = { ...datos, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.texto,
      icon: "/app-192.png",
      badge: "/app-192.png",
      data: { url: datos.url },
      lang: "es",
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/gestion", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && "focus" in v) return v.navigate(url).then((w) => (w || v).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
