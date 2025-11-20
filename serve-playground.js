// Simple static file server for the playground
import { existsSync } from "fs";
import { join } from "path";

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname === "/" ? "/smiles-playground.html" : url.pathname;
    const fullPath = join(process.cwd(), filePath);
    
    try {
      if (!existsSync(fullPath)) {
        return new Response("Not Found", { status: 404 });
      }
      const file = Bun.file(fullPath);
      return new Response(file);
    } catch (e) {
      console.error(`Error serving ${filePath}:`, e.message);
      return new Response("Server Error", { status: 500 });
    }
  },
});

console.log(`✅ Server running at http://localhost:${server.port}`);
console.log(`📖 Open http://localhost:${server.port}/smiles-playground.html`);
