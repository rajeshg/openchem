// Simple static file server for the playground
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const server = Bun.serve({
  port: 4141,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname === "/" ? "/smiles-playground.html" : url.pathname;

    // accept error reports from the playground (browser) so we can log import failures
    if (url.pathname === "/__import_error" && req.method === "POST") {
      try {
        const body = await req.text();
        const outPath = join(process.cwd(), "dist", "__import_error.log");
        writeFileSync(outPath, `[${new Date().toISOString()}] ${body}\n\n`, {
          flag: "a",
        });
        console.log("Playground import error received and logged to", outPath);
        return new Response("ok", { status: 200 });
      } catch (e) {
        console.error("Failed to write import error:", e.message);
        return new Response("error", { status: 500 });
      }
    }
    let fullPath = join(process.cwd(), filePath);

    // If the file is requested from /dist/third-party but not present (fast build
    // doesn't copy third-party assets), fall back to the source copy so wasm
    // and support files can still be served during development.
    if (!existsSync(fullPath) && filePath.startsWith("/dist/third-party")) {
      const alt = filePath.replace("/dist/third-party", "/src/third-party");
      const altPath = join(process.cwd(), alt);
      if (existsSync(altPath)) {
        fullPath = altPath;
      }
    }

    try {
      if (!existsSync(fullPath)) {
        return new Response("Not Found", { status: 404 });
      }
      const file = Bun.file(fullPath);

      // Set correct MIME types
      const headers = {};
      if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
        headers["Content-Type"] = "application/javascript; charset=utf-8";
      } else if (filePath.endsWith(".wasm")) {
        headers["Content-Type"] = "application/wasm";
      } else if (filePath.endsWith(".html")) {
        headers["Content-Type"] = "text/html; charset=utf-8";
      }

      return new Response(file, { headers });
    } catch (e) {
      console.error(`Error serving ${filePath}:`, e.message);
      return new Response("Server Error", { status: 500 });
    }
  },
});

console.log(`✅ Server running at http://localhost:${server.port}`);
console.log(`📖 Open http://localhost:${server.port}/smiles-playground.html`);
