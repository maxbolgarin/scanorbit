.DEFAULT_GOAL := help

GREEN  := \033[0;32m
YELLOW := \033[1;33m
BLUE   := \033[0;34m
RESET  := \033[0m

.PHONY: help
help:
	@echo "$(YELLOW)Setup$(RESET)"
	@echo "  $(BLUE)install$(RESET)         Install all dependencies (Node + Go)"
	@echo "  $(BLUE)setup$(RESET)           install + dev-infra + db-migrate"
	@echo ""
	@echo "$(YELLOW)Development$(RESET)"
	@echo "  $(BLUE)dev$(RESET)             Run all TypeScript apps via Turbo"
	@echo "  $(BLUE)dev-infra$(RESET)       Start postgres + redis containers"
	@echo "  $(BLUE)dev-api$(RESET)         Start the API in watch mode"
	@echo "  $(BLUE)dev-app$(RESET)         Start the React app in watch mode"
	@echo "  $(BLUE)dev-scanner$(RESET)     Run the Go scanner locally"
	@echo "  $(BLUE)dev-analyzer$(RESET)    Run the Go analyzer locally"
	@echo ""
	@echo "$(YELLOW)Build & test$(RESET)"
	@echo "  $(BLUE)build$(RESET)           Build all apps"
	@echo "  $(BLUE)test$(RESET)            Run API tests"
	@echo "  $(BLUE)lint$(RESET)            Lint all apps"
	@echo "  $(BLUE)typecheck$(RESET)       Typecheck all apps"
	@echo ""
	@echo "$(YELLOW)Database$(RESET)"
	@echo "  $(BLUE)db-migrate$(RESET)      Apply pending migrations"
	@echo "  $(BLUE)db-generate$(RESET)     Generate a new migration from schema"
	@echo "  $(BLUE)db-studio$(RESET)       Open Drizzle Studio"
	@echo ""
	@echo "$(YELLOW)Self-host$(RESET)"
	@echo "  $(BLUE)up$(RESET)              docker compose up -d (build & start everything)"
	@echo "  $(BLUE)down$(RESET)            docker compose down"
	@echo "  $(BLUE)logs$(RESET)            Tail container logs"

# -------- Setup --------

.PHONY: install setup
install:
	pnpm install
	cd workers && go mod download

setup: install dev-infra
	@echo "Waiting for database..."
	@sleep 3
	$(MAKE) db-migrate
	@echo "$(GREEN)Setup complete. Run 'make dev' to start the apps.$(RESET)"

# -------- Development --------

.PHONY: dev dev-infra dev-api dev-app dev-scanner dev-analyzer dev-all
dev:
	pnpm dev

dev-infra:
	docker compose up db redis -d
	@echo "$(GREEN)Postgres on 127.0.0.1:15432, Redis on 127.0.0.1:16379$(RESET)"

dev-api:
	pnpm --filter @scanorbit/api dev

dev-app:
	pnpm --filter @scanorbit/app dev

dev-scanner:
	cd workers && make dev-scanner

dev-analyzer:
	cd workers && make dev-analyzer

dev-all: dev-infra
	@trap 'kill 0' SIGINT; \
	pnpm --filter @scanorbit/api dev & \
	pnpm --filter @scanorbit/app dev & \
	cd workers && go run ./cmd/scanner & \
	cd workers && go run ./cmd/analyzer & \
	wait

# -------- Build & test --------

.PHONY: build test lint typecheck clean
build:
	pnpm build

test:
	pnpm --filter @scanorbit/api test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

clean:
	pnpm -r clean
	cd workers && make clean

# -------- Database --------

.PHONY: db-migrate db-generate db-studio db-shell
db-migrate:
	pnpm --filter @scanorbit/api db:migrate

db-generate:
	pnpm --filter @scanorbit/api db:generate

db-studio:
	pnpm --filter @scanorbit/api db:studio

db-shell:
	docker exec -it scanorbit-db psql -U $${POSTGRES_USER:-scanorbit} -d $${POSTGRES_DB:-scanorbit}

# -------- Self-host --------

.PHONY: up down logs
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f
