import { serve } from "bun";
import index from "@/client/index.html";
import serverRoute from "@/server/route";

const isProd = process.env.NODE_ENV === "production";

async function serveStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const file = Bun.file(`dist${url.pathname}`);
  if (await file.exists()) {
    return new Response(file);
  }
  return new Response(Bun.file("dist/index.html"), {
    headers: { "Content-Type": "text/html" },
  });
}

const envFile = Bun.file("/vault/secrets/env.txt");
if (await envFile.exists()) {
  const text = await envFile.text();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

if (!process.env.STEG_API_KEY) {
  console.error("❌ Missing required environment variable: STEG_API_KEY");
  process.exit(1);
}
if (!process.env.STEG_API_URL) {
  console.error("❌ Missing required environment variable: STEG_API_URL");
  process.exit(1);
}

const server = serve({
  routes: {
    // Serve pre-built dist/ in production, or bundle from source in development.
    "/*": isProd ? serveStatic : index,

    ...serverRoute,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
