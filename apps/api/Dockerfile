FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PUPPETEER_CACHE_DIR=/app/.puppeteer

RUN corepack enable

# System libraries required by the Chromium that Puppeteer downloads.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      fonts-noto-cjk \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      libpango-1.0-0 \
      libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching). This also triggers
# puppeteer's postinstall to download Chromium into PUPPETEER_CACHE_DIR.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/protocol/package.json packages/protocol/
RUN pnpm install --frozen-lockfile

# Copy the rest of the source. The API runs straight from TS via tsx, and
# @hds/protocol is consumed as TS source, so no build step is needed.
COPY . .

ENV PORT=3000 \
    HOST=0.0.0.0
EXPOSE 3000

CMD ["pnpm", "--filter", "@hds/api", "exec", "tsx", "src/server.ts"]
