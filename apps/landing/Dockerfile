# Build stage
FROM node:25-alpine AS builder
WORKDIR /repo

# Install pnpm
RUN npm install -g pnpm@10.27.0

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy workspace package.json files
COPY apps/api/package.json ./apps/api/
COPY apps/app/package.json ./apps/app/
COPY apps/landing/package.json ./apps/landing/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy landing source code
COPY apps/landing ./apps/landing

# Build the application
RUN pnpm --filter @scanorbit/landing run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files (Astro outputs to dist/)
COPY --from=builder /repo/apps/landing/dist /usr/share/nginx/html

# Create non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
