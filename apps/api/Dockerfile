# Build stage
FROM node:25-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy app-specific package.json
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api

# Build TypeScript (use --filter to run the package's own build script)
RUN pnpm --filter @scanorbit/api run build

# Production stage
FROM node:25-alpine AS production
WORKDIR /app

# Install pnpm for production deps
RUN npm install -g pnpm@latest

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy app-specific package.json
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files (keep workspace layout so Node can resolve deps from apps/api/node_modules)
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy migrations folder (needed for migration script)
COPY --from=builder /app/apps/api/src/db/migrations ./apps/api/src/db/migrations

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the application (run from workspace)
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
