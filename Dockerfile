# Stage 1: Build static assets
FROM oven/bun:debian AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Production runtime
FROM oven/bun:debian

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "src/index.ts"]
