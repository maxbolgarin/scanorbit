.PHONY: install dev build test lint clean docker-up docker-down docker-build tunnel-umami help

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
	@echo "$(YELLOW)Database:$(RESET)"
	@echo "  $(BLUE)db-migrate$(RESET)      Run database migrations"
	@echo "  $(BLUE)db-generate$(RESET)     Generate migrations from schema"
	@echo "  $(BLUE)db-studio$(RESET)       Open Drizzle Studio"
	@echo "  $(BLUE)db-shell$(RESET)        Connect to PostgreSQL shell"
	@echo ""
	@echo "$(YELLOW)Terraform (Test Infrastructure):$(RESET)"
	@echo "  $(BLUE)tf-test-init$(RESET)         Initialize Terraform"
	@echo "  $(BLUE)tf-test-plan$(RESET)         Plan Terraform changes"
	@echo "  $(BLUE)tf-test-apply$(RESET)        Apply Terraform configuration"
	@echo "  $(BLUE)tf-test-destroy$(RESET)      Destroy test infrastructure"
	@echo ""
	@echo "$(YELLOW)Terraform (Production Infrastructure):$(RESET)"
	@echo "  $(BLUE)tf-prod-init$(RESET)         Initialize Terraform"
	@echo "  $(BLUE)tf-prod-plan$(RESET)         Plan Terraform changes"
	@echo "  $(BLUE)tf-prod-apply$(RESET)        Apply Terraform configuration"
	@echo "  $(BLUE)tf-prod-destroy$(RESET)      Destroy production infrastructure"
	@echo ""
	@echo "$(YELLOW)Monitoring & Metrics:$(RESET)"
	@echo "  $(BLUE)status$(RESET)          Show detailed status of all services"
	@echo "  $(BLUE)status-api$(RESET)      Show API service status"
	@echo "  $(BLUE)status-scanner$(RESET)  Show scanner worker status"
	@echo "  $(BLUE)status-analyzer$(RESET) Show analyzer worker status"
	@echo "  $(BLUE)metrics$(RESET)         Fetch Prometheus metrics from all services"
	@echo "  $(BLUE)metrics-api$(RESET)     Fetch API service metrics"
	@echo "  $(BLUE)metrics-scanner$(RESET) Fetch scanner worker metrics"
	@echo "  $(BLUE)metrics-analyzer$(RESET) Fetch analyzer worker metrics"
	@echo "  $(BLUE)monitoring-up$(RESET)   Start monitoring stack (Prometheus + Grafana + Loki)"
	@echo "  $(BLUE)monitoring-down$(RESET) Stop monitoring stack"
	@echo ""
	@echo "$(YELLOW)Logs (Loki):$(RESET)"
	@echo "  $(BLUE)logs$(RESET)            View recent logs from all services"
	@echo "  $(BLUE)logs-api$(RESET)        View API service logs"
	@echo "  $(BLUE)logs-scanner$(RESET)    View scanner worker logs"
	@echo "  $(BLUE)logs-analyzer$(RESET)   View analyzer worker logs"
	@echo "  $(BLUE)logs-errors$(RESET)     View error logs only"
	@echo "  $(BLUE)logs-tail$(RESET)       Tail logs in real-time"
	@echo ""
	@echo "$(YELLOW)SSH Tunnels (Production):$(RESET)"
	@echo "  $(BLUE)tunnel-grafana$(RESET)    Open tunnel to prod Grafana (localhost:3001)"
	@echo "  $(BLUE)tunnel-prometheus$(RESET) Open tunnel to prod Prometheus (localhost:9092)"
	@echo "  $(BLUE)tunnel-loki$(RESET)       Open tunnel to prod Loki (localhost:3100)"
	@echo "  $(BLUE)tunnel-umami$(RESET)      Open tunnel to prod Umami analytics (localhost:3002)"
	@echo "  $(BLUE)tunnel-monitoring$(RESET) Open tunnels to all monitoring services"
	@echo "  $(BLUE)tunnel-all$(RESET)        Open tunnels to all prod services"
	@echo ""
	@echo "$(YELLOW)Utilities:$(RESET)"
	@echo "  $(BLUE)clean$(RESET)           Clean all build artifacts"
	@echo "  $(BLUE)health$(RESET)          Check health of all services"
	@echo "  $(BLUE)redis-cli$(RESET)       Connect to Redis CLI"
	@echo "  $(BLUE)redis-queue-status$(RESET) Show job queue lengths"
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
tf-test-init:
	cd terraform/test-aws && terraform init

tf-test-plan:
	cd terraform/test-aws && terraform plan

tf-test-apply:
	cd terraform/test-aws && terraform apply

tf-test-destroy:
	cd terraform/test-aws && terraform destroy

tf-test-output:
	cd terraform/test-aws && terraform output

# =============================================================================
# Terraform (Production Infrastructure)
# =============================================================================

tf-prod-init:
	cd terraform/scaleway && terraform init

tf-prod-plan:
	cd terraform/scaleway && terraform plan

tf-prod-apply:
	cd terraform/scaleway && terraform apply

tf-prod-destroy:
	cd terraform/scaleway && terraform destroy

# =============================================================================
# Deployment
# =============================================================================
send-deploy-files:
	scp -r deploy/ deploy@scanorbit.cloud:/opt/scanorbit/
	scp deploy/docker-compose.prod.yml deploy@scanorbit.cloud:/opt/scanorbit/deploy/docker-compose.yml
	scp .env.prod deploy@scanorbit.cloud:/opt/scanorbit/deploy/.env

send-docker-compose:
	scp deploy/docker-compose.prod.yml deploy@scanorbit.cloud:/opt/scanorbit/deploy/docker-compose.yml 

send-caddyfile:
	scp deploy/Caddyfile deploy@scanorbit.cloud:/opt/scanorbit/deploy/Caddyfile

send-env:
	scp .env.prod deploy@scanorbit.cloud:/opt/scanorbit/deploy/.env

send-ssh-key:
	scp deploy/.ssh/id_ed25519_github.pub deploy@scanorbit.cloud:/home/deploy/.ssh/id_ed25519_github.pub
	scp deploy/.ssh/id_ed25519_github deploy@scanorbit.cloud:/home/deploy/.ssh/id_ed25519_github
	scp deploy/.ssh/config deploy@scanorbit.cloud:/home/deploy/.ssh/config


# SSH tunnels for production monitoring
tunnel-grafana:
	@echo "$(YELLOW)Opening SSH tunnel to production Grafana...$(RESET)"
	@echo "  Grafana will be available at: http://localhost:3001"
	@echo "  Press Ctrl+C to close the tunnel"
	@echo ""
	ssh -N -L 3001:localhost:3001 deploy@scanorbit.cloud

tunnel-umami:
	@echo "$(YELLOW)Opening SSH tunnel to production Umami analytics...$(RESET)"
	@echo "  Umami will be available at: http://localhost:3002"
	@echo "  Press Ctrl+C to close the tunnel"
	@echo ""
	ssh -N -L 3002:localhost:3002 deploy@scanorbit.cloud
