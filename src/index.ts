import { serve } from "bun";
import index from "@/client/index.html";
import serverRoute from "@/server/route";

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
