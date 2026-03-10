FROM node:25-alpine

WORKDIR /app

# Minimal runtime for the standalone setup script.
RUN npm install -g tsx@4.21.0

COPY apps/listmonk-setup/setup_listmonk.ts ./
COPY apps/listmonk-setup/templates ./templates

CMD ["tsx", "setup_listmonk.ts"]
