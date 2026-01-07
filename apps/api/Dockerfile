# Development stage
FROM node:22-alpine AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.2 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
EXPOSE 4000
CMD ["pnpm", "dev"]

# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.2 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.2 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
