// Local preview: serves /public and maps /b to the book page, like vercel.json does.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const PORT = Number(process.env.PORT) || 5180;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = url.pathname === "/b" ? "book.html" : normalize(decodeURIComponent(url.pathname)).replace(/^([\\/])+/, "");
    if (!path || path.endsWith("/") || path.endsWith("\\")) path = join(path, "index.html");
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    await stat(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 400).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`stuck together running at http://localhost:${PORT}`));
