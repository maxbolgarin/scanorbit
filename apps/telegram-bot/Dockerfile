# Build stage
FROM node:25-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy app-specific package.json
COPY apps/telegram-bot/package.json ./apps/telegram-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/telegram-bot ./apps/telegram-bot

# Build TypeScript
RUN pnpm --filter @scanorbit/telegram-bot run build

# Production stage
FROM node:25-alpine AS production
WORKDIR /app

# Install pnpm for production deps
RUN npm install -g pnpm@latest

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy app-specific package.json
COPY apps/telegram-bot/package.json ./apps/telegram-bot/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/telegram-bot/dist ./apps/telegram-bot/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Start the application
WORKDIR /app/apps/telegram-bot
CMD ["node", "dist/index.js"]
