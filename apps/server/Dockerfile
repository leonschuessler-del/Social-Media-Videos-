FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "apps/server/src/api.ts"]
