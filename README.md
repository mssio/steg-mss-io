# steg.mss.io

A web app for hiding and revealing secret messages inside images using steganography.

Upload an image, enter a message and password — the message is invisibly embedded into the image. Share the image with anyone; only someone with the correct password can extract the hidden message.

**Stack:** Bun · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · React Router v7 · Zod

## Getting started

```bash
bun install
```

Copy `.env.example` to `.env` and fill in the required values (see [Environment variables](#environment-variables)):

```bash
cp .env.example .env
```

Start the development server with hot reloading:

```bash
bun dev
```

## Environment variables

| Variable | Description |
|---|---|
| `STEG_API_KEY` | API key for the external steganography service |
| `STEG_API_URL` | Base URL of the external steganography service (no trailing slash) |

The server will refuse to start if either variable is missing.

## Scripts

| Command | Description |
|---|---|
| `bun dev` | Start development server with HMR |
| `bun start` | Start production server |
| `bun run build` | Build static assets to `dist/` |

## How it works

The server is a lightweight gateway — it validates incoming requests with Zod and proxies them to the external steganography API. No data is stored.

```text
Browser → POST /api/steg/hide  →  Bun server  →  STEG_API_URL/hide
Browser → POST /api/steg/show  →  Bun server  →  STEG_API_URL/show
```

Images are base64-encoded in the browser before being sent. Supported formats: **PNG and JPEG**.

## Project structure

```text
src/
  index.ts              # Server entry point
  server/
    app/steg/
      hide.ts           # POST /api/steg/hide
      show.ts           # POST /api/steg/show
  client/
    app/steg/
      Hide.tsx          # Hide form page
      HideComplete.tsx  # Download result page
      Show.tsx          # Show form page
      ShowComplete.tsx  # Revealed message page
```

## Docker

```bash
# Build
docker buildx build --platform linux/amd64 -t registry.mss.io/steg-mss-io:1.0.3 --push .

# Run
docker run -p 3000:3000 \
  -e STEG_API_KEY=your_key \
  -e STEG_API_URL=https://your-steg-api.example.com \
  registry.mss.io/steg-mss-io:version
```

The container listens on port **3000** by default. Set the `PORT` environment variable to override (e.g. DigitalOcean App Platform sets `PORT=8080` automatically).
