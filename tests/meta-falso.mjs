// Imita la API de WhatsApp de Meta para las pruebas: node tests/meta-falso.mjs <puerto>
// POST …/<número>/messages → guarda el envío y devuelve un wamid; el 699 99 99 99 «no tiene WhatsApp».
// GET /__enviados → lo enviado hasta ahora.
// Además hace de servicio de avisos del móvil: POST /push/<id> guarda el aviso cifrado; GET /__push lo devuelve.
import { createServer } from "node:http";

const enviados = [];
const avisos = [];
let n = 0;
createServer((req, res) => {
  const responder = (estado, cuerpo) => res.writeHead(estado, { "Content-Type": "application/json" }).end(JSON.stringify(cuerpo));
  if (req.method === "GET" && req.url === "/__enviados") return responder(200, enviados);
  if (req.method === "GET" && req.url === "/__push") return responder(200, avisos);
  if (req.method === "POST" && req.url.startsWith("/push/")) {
    const trozos = [];
    req.on("data", (t) => trozos.push(t));
    req.on("end", () => {
      if (req.url === "/push/caducada") return responder(410, {});
      avisos.push({ url: req.url, cabeceras: req.headers, cuerpo: Buffer.concat(trozos).toString("base64") });
      res.writeHead(201).end();
    });
    return;
  }
  if (req.method === "GET") return responder(200, { ok: true });
  let datos = "";
  req.on("data", (t) => (datos += t));
  req.on("end", () => {
    if (req.headers.authorization !== "Bearer token-de-pruebas") return responder(401, { error: { message: "Invalid OAuth access token", code: 190 } });
    if (!/\/messages$/.test(req.url)) return responder(404, { error: { message: "Unknown path", code: 100 } });
    const cuerpo = JSON.parse(datos || "{}");
    if (cuerpo.to === "34699999999") return responder(400, { error: { message: "Message undeliverable", code: 131026, error_data: { details: "El número no tiene WhatsApp" } } });
    const id = `wamid.prueba${++n}`;
    enviados.push({ id, ...cuerpo });
    responder(200, { messaging_product: "whatsapp", contacts: [{ input: cuerpo.to, wa_id: cuerpo.to }], messages: [{ id }] });
  });
}).listen(Number(process.argv[2] ?? 8099), "127.0.0.1");
