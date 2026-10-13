// Sirve la landing generada (apps/landing/dist) para las pruebas: node tests/servidor-estatico.mjs <puerto>
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const raiz = new URL("../apps/landing/dist/", import.meta.url).pathname;
const tipos = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
createServer((req, res) => {
  let ruta = normalize(join(raiz, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!ruta.startsWith(raiz)) return res.writeHead(403).end();
  if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, "index.html");
  if (!existsSync(ruta)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": tipos[extname(ruta)] ?? "application/octet-stream" });
  createReadStream(ruta).pipe(res);
}).listen(Number(process.argv[2] ?? 8090), "127.0.0.1");
