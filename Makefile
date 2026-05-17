.PHONY: help install setup \
        run start dev dev-all \
        infra dev-infra dev-api dev-app dev-scanner dev-analyzer dev-landing \
        docker-run docker-up docker-down docker-build docker-logs docker-rebuild \
        build build-ts build-go test lint typecheck \
        db-migrate db-generate db-studio db-shell \
        up down build-images logs clean

# Colors for help output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
DIM := \033[2m
RESET := \033[0m

.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "$(GREEN)ScanOrbit — Makefile$(RESET)"
	@echo ""
	@echo "$(YELLOW)Setup:$(RESET)"
	@echo "  $(BLUE)install$(RESET)         Install Node.js + Go dependencies"
	@echo "  $(BLUE)setup$(RESET)           Install deps + start db/redis + run migrations"
	@echo ""
	@echo "$(YELLOW)Run locally (native processes):$(RESET)"
	@echo "  $(BLUE)run$(RESET)             Start infra + API + app + Go workers $(DIM)(no landing)$(RESET)"
	@echo "  $(BLUE)start$(RESET)           $(DIM)alias for 'run'$(RESET)"
	@echo "  $(BLUE)dev$(RESET)             Run all TS apps via Turbo $(DIM)(api + app + landing; no Go workers)$(RESET)"
	@echo "  $(BLUE)infra$(RESET)           Start only PostgreSQL + Redis containers"
	@echo "  $(BLUE)dev-api$(RESET)         Run the API in watch mode"
	@echo "  $(BLUE)dev-app$(RESET)         Run the React app in dev mode"
	@echo "  $(BLUE)dev-scanner$(RESET)     Run the Go scanner worker"
	@echo "  $(BLUE)dev-analyzer$(RESET)    Run the Go analyzer worker"
	@echo ""
	@echo "$(YELLOW)Run in Docker (full self-host stack):$(RESET)"
	@echo "  $(BLUE)docker-run$(RESET)      Build images + start db + redis + migrate + api + app + workers"
	@echo "  $(BLUE)docker-up$(RESET)       $(DIM)alias for 'docker-run'$(RESET)"
	@echo "  $(BLUE)docker-down$(RESET)     Stop the Docker stack $(DIM)(data preserved)$(RESET)"
	@echo "  $(BLUE)docker-build$(RESET)    Rebuild all Docker images"
	@echo "  $(BLUE)docker-rebuild$(RESET)  docker-down + build + up"
	@echo "  $(BLUE)docker-logs$(RESET)     Tail logs from the Docker stack"
	@echo ""
	@echo "$(YELLOW)Landing site (special dev mode):$(RESET)"
	@echo "  $(BLUE)dev-landing$(RESET)     Run the Astro landing site $(DIM)(not part of 'run')$(RESET)"
	@echo ""
	@echo "$(YELLOW)Build / Test:$(RESET)"
	@echo "  $(BLUE)build$(RESET)           Build all TypeScript + Go services"
	@echo "  $(BLUE)build-ts$(RESET)        Build TypeScript services only"
	@echo "  $(BLUE)build-go$(RESET)        Build Go workers only"
	@echo "  $(BLUE)test$(RESET)            Run all tests"
	@echo "  $(BLUE)lint$(RESET)            Run linters"
	@echo "  $(BLUE)typecheck$(RESET)       Run tsc --noEmit"
	@echo ""
	@echo "$(YELLOW)Database:$(RESET)"
	@echo "  $(BLUE)db-migrate$(RESET)      Apply database migrations"
	@echo "  $(BLUE)db-generate$(RESET)     Generate migrations from schema changes"
	@echo "  $(BLUE)db-studio$(RESET)       Open Drizzle Studio"
	@echo "  $(BLUE)db-shell$(RESET)        Open a psql shell on the dev database"
	@echo ""
	@echo "$(YELLOW)Utilities:$(RESET)"
	@echo "  $(BLUE)clean$(RESET)           Remove all build artifacts and node_modules"
	@echo ""

# =============================================================================
# Setup
# =============================================================================
install:
	pnpm install
	cd workers && go mod download

setup: install infra
	@echo "Waiting for database..."
	@sleep 3
	$(MAKE) db-migrate
	@echo ""
	@echo "$(GREEN)Setup complete!$(RESET) Run 'make run' to start the stack natively, or 'make docker-run' for Docker."

# =============================================================================
# Run locally (native processes — recommended for development)
# =============================================================================
run: infra
	@./scripts/dev.sh

start: run

infra:
	docker compose up db redis -d
	@echo "$(GREEN)Infrastructure started$(RESET)"
	@echo "  PostgreSQL: localhost:15432"
	@echo "  Redis:      localhost:16379"


dev:
	pnpm dev

dev-api:
	pnpm dev:api

dev-app:
	pnpm dev:app

dev-scanner:
	cd workers && make dev-scanner

dev-analyzer:
	cd workers && make dev-analyzer

# Landing site is intentionally NOT part of `run`. It's a separate static
# marketing site (Astro) deployed to GitHub Pages.
dev-landing:
	pnpm dev:landing

dev-all: run

# =============================================================================
# Run in Docker (full self-host stack)
# =============================================================================
docker-run:
	docker compose up -d --build
	@echo ""
	@echo "$(GREEN)Self-host stack running$(RESET)"
	@echo "  App: http://localhost"
	@echo "  Use 'make docker-logs' to tail logs, 'make docker-down' to stop."

docker-up: docker-run

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-rebuild:
	docker compose down
	docker compose build
	docker compose up -d

docker-logs:
	docker compose logs -f


# =============================================================================
# Build / Test
# =============================================================================
build:
	pnpm build
	cd workers && make build

build-ts:
	pnpm build

build-go:
	cd workers && make build

test:
	pnpm test
	cd workers && make test

lint:
	pnpm lint
	cd workers && make lint

typecheck:
	pnpm typecheck

# =============================================================================
# Database
# =============================================================================
db-migrate:
	pnpm db:migrate

db-generate:
	pnpm db:generate

db-studio:
	pnpm db:studio

db-shell:
	docker compose exec db psql -U scanorbit -d scanorbit

# =============================================================================
# Utilities
# =============================================================================
clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/*/dist packages/*/dist
	cd workers && make clean
