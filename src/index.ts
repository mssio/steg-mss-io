import { serve } from "bun";
import index from "@/client/index.html";
import serverRoute from "@/server/route";

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
    // Serve index.html for all unmatched routes.
    "/*": index,

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
