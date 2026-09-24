import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

/** Statischer Server für web/ und Fonts (Chromium blockiert file://-Skripte und -Fonts). */
export async function startStaticServer(extraDirs: Record<string, string> = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const mounts: Record<string, string> = {
    "/web/": join(ROOT, "web"),
    "/fonts/inter/": join(ROOT, "node_modules/@fontsource/inter"),
    "/fonts/oxanium/": join(ROOT, "node_modules/@fontsource/oxanium"),
    "/fonts/jetbrains-mono/": join(ROOT, "node_modules/@fontsource/jetbrains-mono"),
    ...extraDirs,
  };
  const server: Server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
      if (path === "/" || path === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(await readFile(join(ROOT, "web/index.html"))); return; }
      for (const [prefix, dir] of Object.entries(mounts)) {
        if (path.startsWith(prefix)) {
          const file = normalize(join(dir, path.slice(prefix.length)));
          if (!file.startsWith(dir)) break;
          res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
          res.end(await readFile(file)); return;
        }
      }
      res.writeHead(404); res.end("not found");
    } catch { res.writeHead(404); res.end("not found"); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address(); const port = typeof addr === "object" && addr ? addr.port : 0;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}
