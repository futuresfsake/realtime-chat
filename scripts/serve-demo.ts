// A tiny static file server for the built demo (npm run demo, port 3200).
// It exists so the demo can be opened locally and tested; on GitHub Pages the
// host does this job. It serves files from one folder and nothing else.
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export function serveDirectory(dir: string, port: number): Promise<Server> {
  const root = path.resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root)) {
        res.writeHead(403).end("forbidden"); // never leave the folder
        return;
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 3200);
  await serveDirectory(path.join(process.cwd(), "demo-dist"), port);
  process.stdout.write(`demo at http://localhost:${port}\n`);
}
