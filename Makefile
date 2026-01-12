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
	@echo "  $(BLUE)docker-update-watchtower$(RESET)  Update Watchtower to latest version"
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

docker-update-watchtower:
	@echo "$(YELLOW)Updating Watchtower to latest version...$(RESET)"
	docker pull nickfedor/watchtower:latest
	docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate --no-deps watchtower
	@echo "$(GREEN)Watchtower updated!$(RESET)"

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
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_security 2>/dev/null | xargs -I {} echo "  analyze_security: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_cost 2>/dev/null | xargs -I {} echo "  analyze_cost: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_tagging 2>/dev/null | xargs -I {} echo "  analyze_tagging: {} jobs"
	@docker exec scanorbit-redis redis-cli LLEN jobs:analyze_iam 2>/dev/null | xargs -I {} echo "  analyze_iam: {} jobs"

# =============================================================================
# Monitoring & Metrics
# =============================================================================
status:
	@echo "$(YELLOW)ScanOrbit Service Status$(RESET)"
	@echo "========================="
	@echo ""
	@echo "$(BLUE)API Service:$(RESET)"
	@curl -s http://localhost:4000/status 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Worker:$(RESET)"
	@curl -s http://localhost:9090/status 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Worker:$(RESET)"
	@curl -s http://localhost:9091/status 2>/dev/null | jq . || echo "  Not running"

status-api:
	@curl -s http://localhost:4000/status | jq .

status-scanner:
	@curl -s http://localhost:9090/status | jq .

status-analyzer:
	@curl -s http://localhost:9091/status | jq .

metrics:
	@echo "$(YELLOW)Fetching metrics from all services...$(RESET)"
	@echo ""
	@echo "$(BLUE)API Metrics (http://localhost:4000/metrics):$(RESET)"
	@curl -s http://localhost:4000/metrics 2>/dev/null | head -50 || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Metrics (http://localhost:9090/metrics):$(RESET)"
	@curl -s http://localhost:9090/metrics 2>/dev/null | head -50 || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Metrics (http://localhost:9091/metrics):$(RESET)"
	@curl -s http://localhost:9091/metrics 2>/dev/null | head -50 || echo "  Not running"

metrics-api:
	@curl -s http://localhost:4000/metrics

metrics-scanner:
	@curl -s http://localhost:9090/metrics

metrics-analyzer:
	@curl -s http://localhost:9091/metrics

# Production status (using production ports/hosts)
status-prod:
	@echo "$(YELLOW)Production Service Status$(RESET)"
	@echo "=========================="
	@echo ""
	@echo "$(BLUE)API Service:$(RESET)"
	@curl -s http://api:4000/status 2>/dev/null | jq . || curl -s http://localhost:4000/status 2>/dev/null | jq . || echo "  Not available"
	@echo ""
	@echo "$(BLUE)Scanner Worker:$(RESET)"
	@curl -s http://scanner:9090/status 2>/dev/null | jq . || curl -s http://localhost:9090/status 2>/dev/null | jq . || echo "  Not available"
	@echo ""
	@echo "$(BLUE)Analyzer Worker:$(RESET)"
	@curl -s http://analyzer:9091/status 2>/dev/null | jq . || curl -s http://localhost:9091/status 2>/dev/null | jq . || echo "  Not available"

# Show all running parameters and config
config-show:
	@echo "$(YELLOW)Service Configuration$(RESET)"
	@echo "====================="
	@echo ""
	@echo "$(BLUE)Environment Variables (from .env):$(RESET)"
	@test -f .env && grep -v '^#' .env | grep -v '^$$' | sed 's/=.*/=***/' || echo "  No .env file found"
	@echo ""
	@echo "$(BLUE)Docker Compose Services:$(RESET)"
	@docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  Docker not running"

# =============================================================================
# Logs (Loki)
# =============================================================================
logs:
	@echo "$(YELLOW)Recent logs from all services (last 100 lines):$(RESET)"
	@curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit"}&limit=100' 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null | head -100 || echo "  Loki not running. Start with: make monitoring-up"

logs-api:
	@echo "$(YELLOW)API Service Logs:$(RESET)"
	@curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit",service="api"}&limit=100' 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null | head -100 || echo "  Loki not running"

logs-scanner:
	@echo "$(YELLOW)Scanner Worker Logs:$(RESET)"
	@curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit",service="scanner"}&limit=100' 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null | head -100 || echo "  Loki not running"

logs-analyzer:
	@echo "$(YELLOW)Analyzer Worker Logs:$(RESET)"
	@curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit",service="analyzer"}&limit=100' 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null | head -100 || echo "  Loki not running"

logs-errors:
	@echo "$(YELLOW)Error Logs (all services):$(RESET)"
	@curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit",level=~"error|fatal"}&limit=100' 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null | head -100 || echo "  Loki not running"

logs-tail:
	@echo "$(YELLOW)Tailing logs (Ctrl+C to stop)...$(RESET)"
	@while true; do \
		curl -s 'http://localhost:3100/loki/api/v1/query_range?query={app="scanorbit"}&limit=10&start='$$(date -d '10 seconds ago' +%s)000000000 2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null; \
		sleep 2; \
	done

# Start monitoring stack (Prometheus + Grafana + Loki)
monitoring-up:
	docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile monitoring up -d prometheus grafana loki promtail
	@echo ""
	@echo "$(GREEN)Monitoring stack started!$(RESET)"
	@echo "  Prometheus: http://localhost:9092"
	@echo "  Grafana:    http://localhost:3001 (admin/admin)"
	@echo "  Loki:       http://localhost:3100"

monitoring-down:
	docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile monitoring down

# Generate JWT secret
gen-secret:
	@openssl rand -base64 32

# =============================================================================
# Development
# =============================================================================
ssh:
	ssh root@scanorbit.cloud

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