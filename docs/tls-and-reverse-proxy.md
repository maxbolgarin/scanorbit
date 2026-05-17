# TLS and reverse proxy

The bundled `docker-compose.yml` publishes the web app on `:8080` over
HTTP. For anything exposed beyond your laptop, terminate TLS at a reverse
proxy and forward to that port.

The proxy must:

1. Terminate TLS for `FRONTEND_URL`'s hostname.
2. Forward all paths to the `app` container on `:8080`. The `app`
   container (Nginx) proxies `/api/*` to the API container internally —
   you don't need a second upstream.
3. Set `X-Forwarded-For` / `X-Forwarded-Proto`. Add the proxy's IP to
   `TRUSTED_PROXIES` so the API trusts those headers.

Make sure `FRONTEND_URL` in `.env` uses `https://` and matches the
hostname your proxy serves — cookies and email links derive from it.

## Caddy

Caddy gives you auto-HTTPS with one config line. Put a `Caddyfile` next
to `docker-compose.yml`:

```caddyfile
scanorbit.example.com {
    reverse_proxy app:80
    encode gzip
}
```

…and add a Caddy service to compose:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
```

…then drop the `ports:` block from the `app` service so it's only
reachable on the internal Docker network. Set `TRUSTED_PROXIES` to
include Caddy's container IP range (Docker's default bridge is
`172.16.0.0/12`).

## Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name scanorbit.example.com;

  ssl_certificate     /etc/letsencrypt/live/scanorbit.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/scanorbit.example.com/privkey.pem;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        $connection_upgrade;
  }
}

server {
  listen 80;
  server_name scanorbit.example.com;
  return 301 https://$host$request_uri;
}
```

## Traefik

If you're already running Traefik with auto-LetsEncrypt, add labels to the
`app` service:

```yaml
  app:
    # ...existing config...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.scanorbit.rule=Host(`scanorbit.example.com`)"
      - "traefik.http.routers.scanorbit.entrypoints=websecure"
      - "traefik.http.routers.scanorbit.tls.certresolver=letsencrypt"
      - "traefik.http.services.scanorbit.loadbalancer.server.port=80"
```

Add Traefik's network to the service and drop the `ports:` mapping.

## Multi-host (API and app on different subdomains)

Set `COOKIE_DOMAIN=.example.com` if `app.example.com` and `api.example.com`
both terminate at the same proxy. Without it, cookies set by the API
won't be sent back by the app.
