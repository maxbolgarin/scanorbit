# Build stage
FROM node:24-alpine AS builder
WORKDIR /repo

# Install pnpm
RUN npm install -g pnpm@10.27.0

# Copy root-level package files (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy workspace package.json files
COPY apps/api/package.json ./apps/api/
COPY apps/app/package.json ./apps/app/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy app source code
COPY apps/app ./apps/app

# Build arguments for environment variables
ARG VITE_PUBLIC_API_URL
ARG VITE_SCANORBIT_AWS_ACCOUNT_ID
ENV VITE_PUBLIC_API_URL=$VITE_PUBLIC_API_URL
ENV VITE_SCANORBIT_AWS_ACCOUNT_ID=$VITE_SCANORBIT_AWS_ACCOUNT_ID

# Build the application
RUN pnpm --filter @scanorbit/app run build

# Font files for @fontsource are referenced from the generated CSS as "./files/<font-file>".
# Vite outputs CSS into dist/assets/*.css, so we must place the font files in dist/assets/files.
RUN mkdir -p ./apps/app/dist/assets/files && \
    cp -R ./apps/app/node_modules/@fontsource/geist-sans/files/* ./apps/app/dist/assets/files/ && \
    cp -R ./apps/app/node_modules/@fontsource/geist-mono/files/* ./apps/app/dist/assets/files/

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /repo/apps/app/dist /usr/share/nginx/html

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
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
