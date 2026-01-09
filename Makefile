.PHONY: install dev build test lint clean docker-up docker-down docker-build help

# Colors for help output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Help
# =============================================================================
help:
	@echo ""
	@echo "$(GREEN)ScanOrbit - Makefile Commands$(RESET)"
	@echo ""
	@echo "$(YELLOW)Setup:$(RESET)"
	@echo "  $(BLUE)install$(RESET)         Install all dependencies (Node.js + Go)"
	@echo "  $(BLUE)setup$(RESET)           Full setup: install + start infra + migrate"
	@echo ""
	@echo "$(YELLOW)Development:$(RESET)"
	@echo "  $(BLUE)dev$(RESET)             Start all TypeScript services (Turbo)"
	@echo "  $(BLUE)dev-infra$(RESET)       Start PostgreSQL and Redis containers"
	@echo "  $(BLUE)dev-api$(RESET)         Start API server in dev mode"
	@echo "  $(BLUE)dev-app$(RESET)         Start React app in dev mode"
	@echo "  $(BLUE)dev-landing$(RESET)     Start landing page in dev mode"
	@echo "  $(BLUE)dev-scanner$(RESET)     Run scanner worker locally"
	@echo "  $(BLUE)dev-analyzer$(RESET)    Run analyzer worker locally"
	@echo "  $(BLUE)dev-all$(RESET)         Start all services (infra + workers)"
	@echo ""
	@echo "$(YELLOW)Build:$(RESET)"
	@echo "  $(BLUE)build$(RESET)           Build all services"
	@echo "  $(BLUE)build-ts$(RESET)        Build TypeScript services only"
	@echo "  $(BLUE)build-go$(RESET)        Build Go workers only"
	@echo ""
	@echo "$(YELLOW)Test & Quality:$(RESET)"
	@echo "  $(BLUE)test$(RESET)            Run all tests"
	@echo "  $(BLUE)lint$(RESET)            Run linters"
	@echo "  $(BLUE)typecheck$(RESET)       TypeScript type checking"
	@echo ""
	@echo "$(YELLOW)Docker:$(RESET)"
	@echo "  $(BLUE)docker-up$(RESET)       Start all containers"
	@echo "  $(BLUE)docker-down$(RESET)     Stop all containers"
	@echo "  $(BLUE)docker-build$(RESET)    Build Docker images"
	@echo "  $(BLUE)docker-prod$(RESET)     Start production deployment"
	@echo "  $(BLUE)docker-logs$(RESET)     Follow container logs"
	@echo "  $(BLUE)docker-ps$(RESET)       Show running containers"
	@echo "  $(BLUE)docker-clean$(RESET)    Remove containers and volumes"
	@echo ""
	@echo "$(YELLOW)Database:$(RESET)"
	@echo "  $(BLUE)db-migrate$(RESET)      Run database migrations"
	@echo "  $(BLUE)db-generate$(RESET)     Generate migrations from schema"
	@echo "  $(BLUE)db-studio$(RESET)       Open Drizzle Studio"
	@echo "  $(BLUE)db-shell$(RESET)        Connect to PostgreSQL shell"
	@echo ""
	@echo "$(YELLOW)Terraform (Test Infrastructure):$(RESET)"
	@echo "  $(BLUE)tf-init$(RESET)         Initialize Terraform"
	@echo "  $(BLUE)tf-plan$(RESET)         Plan Terraform changes"
	@echo "  $(BLUE)tf-apply$(RESET)        Apply Terraform configuration"
	@echo "  $(BLUE)tf-destroy$(RESET)      Destroy test infrastructure"
	@echo ""
	@echo "$(YELLOW)Utilities:$(RESET)"
	@echo "  $(BLUE)clean$(RESET)           Clean all build artifacts"
	@echo "  $(BLUE)health$(RESET)          Check health of all services"
	@echo "  $(BLUE)redis-cli$(RESET)       Connect to Redis CLI"
	@echo ""

# =============================================================================
# Setup
# =============================================================================
install:
	pnpm install
	cd workers && go mod download

setup: install dev-infra
	@echo "Waiting for database to be ready..."
	@sleep 3
	$(MAKE) db-migrate
	@echo ""
	@echo "$(GREEN)Setup complete!$(RESET)"
	@echo "Run 'make dev-api' to start the API server"

# =============================================================================
# Development
# =============================================================================
dev:
	pnpm dev

dev-infra:
	docker compose up db redis -d
	@echo "$(GREEN)Infrastructure started$(RESET)"
	@echo "PostgreSQL: localhost:15432"
	@echo "Redis: localhost:16379"

dev-api:
	pnpm dev:api

dev-app:
	pnpm dev:app

dev-landing:
	pnpm dev:landing

dev-scanner:
	cd workers && make dev-scanner

dev-analyzer:
	cd workers && make dev-analyzer

dev-all: dev-infra
	@echo "Starting all services..."
	@trap 'kill 0' SIGINT; \
	pnpm dev:api & \
	pnpm dev:app & \
	cd workers && go run ./cmd/scanner & \
	cd workers && go run ./cmd/analyzer & \
	wait

# =============================================================================
# Build
# =============================================================================
build:
	pnpm build
	cd workers && make build

build-ts:
	pnpm build

build-go:
	cd workers && make build

# =============================================================================
# Test & Quality
# =============================================================================
test:
	pnpm test
	cd workers && make test

lint:
	pnpm lint
	cd workers && make lint

typecheck:
	pnpm typecheck

# =============================================================================
# Clean
# =============================================================================
clean:
	pnpm clean
	cd workers && make clean

# =============================================================================
# Docker
# =============================================================================
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

docker-prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

docker-logs:
	docker compose logs -f

docker-logs-api:
	docker compose logs -f api

docker-logs-scanner:
	docker compose logs -f scanner

docker-logs-analyzer:
	docker compose logs -f analyzer

docker-ps:
	docker compose ps

docker-clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# =============================================================================
# Database
# =============================================================================
db-migrate:
	pnpm db:migrate

db-reset:
	pnpm db:reset

db-generate:
	pnpm db:generate

db-studio:
	pnpm --filter @scanorbit/api db:studio

db-shell:
	docker exec -it scanorbit-db psql -U scanorbit -d scanorbit

# =============================================================================
# Terraform (Test Infrastructure)
# =============================================================================
tf-init:
	cd terraform && terraform init

tf-plan:
	cd terraform && terraform plan

tf-apply:
	cd terraform && terraform apply

tf-destroy:
	cd terraform && terraform destroy

tf-output:
	cd terraform && terraform output

# =============================================================================
# Utilities
# =============================================================================
health:
	@echo "$(YELLOW)Checking service health...$(RESET)"
	@echo ""
	@echo "$(BLUE)API:$(RESET)"
	@curl -s http://localhost:4000/health | jq . 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(BLUE)PostgreSQL:$(RESET)"
	@docker exec scanorbit-db pg_isready -U scanorbit 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Redis:$(RESET)"
	@docker exec scanorbit-redis redis-cli ping 2>/dev/null || echo "  Not running"

redis-cli:
	docker exec -it scanorbit-redis redis-cli

redis-queue-status:
	@echo "$(YELLOW)Redis Queue Status:$(RESET)"
	@docker exec scanorbit-redis redis-cli LLEN jobs:scan_account 2>/dev/null | xargs -I {} echo "  scan_account: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_orphans 2>/dev/null | xargs -I {} echo "  analyze_orphans: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_ssl 2>/dev/null | xargs -I {} echo "  analyze_ssl: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_residency 2>/dev/null | xargs -I {} echo "  analyze_residency: {} jobs"

# Generate JWT secret
gen-secret:
	@openssl rand -base64 32

# =============================================================================
# Development
# =============================================================================
ssh:
	ssh root@scanorbit.cloud