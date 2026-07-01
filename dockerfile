# Build Stage
FROM node:22-slim AS build
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml  ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Production Stage
FROM node:22-slim AS production
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml  ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
RUN pnpm run generate
RUN pnpm prune --prod
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
