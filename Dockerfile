# Website and Express API
FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system journal \
  && useradd --system --gid journal --home-dir /app --shell /usr/sbin/nologin journal \
  && mkdir -p /data/pglite \
  && chown journal:journal /data/pglite

WORKDIR /app

COPY --from=build --chown=journal:journal /app /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    JOURNAL_DATA=/data/pglite

USER journal
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
VOLUME ["/data/pglite"]

CMD ["node", "--import", "tsx", "server/index.ts"]
