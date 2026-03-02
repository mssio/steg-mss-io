---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: true
---

## Project: steg.mss.io

A full-stack steganography web app for hiding and revealing secret messages inside images. Built with Bun + React 19 + TypeScript + Tailwind CSS.

### Architecture

The server acts as a **gateway** to an external steganography API. It validates requests with Zod, then proxies them to `STEG_API_URL` with the `STEG_API_KEY` auth header.

```text
src/
  index.ts                  # Bun.serve() entry point — validates env vars, mounts routes
  server/
    route.ts                # Aggregates all API route objects
    app/
      steg/
        hide.ts             # POST /api/steg/hide — validate → proxy to external API
        show.ts             # POST /api/steg/show — validate → proxy to external API
      hello/
        route.ts            # Demo endpoint (not production-critical)
  client/
    index.html              # SPA entry point
    frontend.tsx            # React root (RouterProvider + StrictMode + HMR)
    route.ts                # React Router v7 route definitions
    index.css               # Global styles + animated background
    styles/globals.css      # Tailwind v4 + shadcn/ui CSS custom properties (light/dark)
    app/
      home/page.tsx         # Landing page — links to /hide and /show
      steg/
        Hide.tsx            # /hide — form to hide a message in an image
        HideComplete.tsx    # /hide/complete — download result image
        Show.tsx            # /show — form to reveal a message from an image
        ShowComplete.tsx    # /show/complete — display revealed message
    components/ui/          # shadcn/ui components (button, card, input, label, select, textarea)
    lib/utils.ts            # cn() helper (clsx + tailwind-merge)
```

### Environment Variables (required at startup)

- `STEG_API_KEY` — API key sent as `x-api-token` header to the external steg API
- `STEG_API_URL` — Base URL of the external steg API (no trailing slash). Endpoints appended: `/hide`, `/show`

### Scripts

```sh
bun run dev        # Development with HMR (bun --hot src/index.ts)
bun run start      # Production (NODE_ENV=production bun src/index.ts)
bun run build      # Build static assets to dist/ (build.ts)
```

### Key Conventions

- **Routing**: SPA — `"/*"` serves `index.html`; API routes are mounted under `/api/`
- **Validation**: Zod schemas in each server route file. `image_base64` validated with `z.base64()`, `image_type` is `"jpeg" | "png"`
- **Image handling**: Images are base64-encoded by the client before being sent to the server
- **Error shape**: All API responses use `{ success: boolean, api: string, ... }`. Client only checks `data.success`
- **UI**: Tailwind v4 with shadcn/ui (new-york style). Dark mode via `.dark` class. Path alias `@/*` → `src/*`
- **No state management library** — React hooks only (useState, useRef, useNavigate, useLocation)
- **Complete pages** (`HideComplete`, `ShowComplete`) receive data via React Router `location.state`. They show a fallback if state is missing (e.g. direct navigation)

### Do Not

- Add a database — the app is stateless
- Add authentication — handled by the external API via `STEG_API_KEY`
- Use `express`, `vite`, `dotenv`, or `node:fs` — see Bun conventions below

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
