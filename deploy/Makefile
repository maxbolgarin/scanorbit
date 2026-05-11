.PHONY: health redis-cli redis-queue-status status status-api status-scanner status-analyzer metrics metrics-api metrics-scanner metrics-analyzer monitoring-up monitoring-down tunnel-grafana tunnel-prometheus tunnel-umami tunnel-monitoring tunnel-all clean help

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
	@echo "$(GREEN)ScanOrbit - Deployment Makefile$(RESET)"
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
	@echo "  $(BLUE)monitoring-up$(RESET)   Start monitoring stack (Prometheus + Grafana)"
	@echo "  $(BLUE)monitoring-down$(RESET) Stop monitoring stack"
	@echo ""
	@echo "$(YELLOW)SSH Tunnels (Production):$(RESET)"
	@echo "  $(BLUE)tunnel-grafana$(RESET)    Open tunnel to prod Grafana (localhost:3001)"
	@echo "  $(BLUE)tunnel-prometheus$(RESET) Open tunnel to prod Prometheus (localhost:9092)"
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
# Utilities
# =============================================================================

# Docker compose command (production stack)
COMPOSE_CMD := docker compose -f docker-compose.yml

health:
	@echo "$(YELLOW)Checking service health...$(RESET)"
	@echo ""
	@echo "$(BLUE)API:$(RESET)"
	@$(COMPOSE_CMD) exec -T api wget -q -O- http://127.0.0.1:4000/health 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Worker:$(RESET)"
	@$(COMPOSE_CMD) exec -T scanner wget -q -O- http://127.0.0.1:9090/health 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Worker:$(RESET)"
	@$(COMPOSE_CMD) exec -T analyzer wget -q -O- http://127.0.0.1:9091/health 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)PostgreSQL:$(RESET)"
	@$(COMPOSE_CMD) exec -T postgres pg_isready -U scanorbit 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Redis:$(RESET)"
	@$(COMPOSE_CMD) exec -T redis redis-cli --tls --cert /data/certs/redis.crt --key /data/certs/redis.key --cacert /data/certs/ca.crt -a "$${REDIS_PASSWORD}" ping 2>/dev/null || echo "  Not running"

redis-cli:
	$(COMPOSE_CMD) exec redis redis-cli --tls --cert /data/certs/redis.crt --key /data/certs/redis.key --cacert /data/certs/ca.crt -a "$${REDIS_PASSWORD}"

# Helper for redis commands with TLS
REDIS_CLI := $(COMPOSE_CMD) exec -T redis redis-cli --tls --cert /data/certs/redis.crt --key /data/certs/redis.key --cacert /data/certs/ca.crt -a "$${REDIS_PASSWORD}"

redis-queue-status:
	@echo "$(YELLOW)Redis Queue Status:$(RESET)"
	@$(REDIS_CLI) LLEN jobs:scan_account 2>/dev/null | xargs -I {} echo "  scan_account: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_orphans 2>/dev/null | xargs -I {} echo "  analyze_orphans: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_ssl 2>/dev/null | xargs -I {} echo "  analyze_ssl: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_residency 2>/dev/null | xargs -I {} echo "  analyze_residency: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_security 2>/dev/null | xargs -I {} echo "  analyze_security: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_cost 2>/dev/null | xargs -I {} echo "  analyze_cost: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_tagging 2>/dev/null | xargs -I {} echo "  analyze_tagging: {} jobs"
	@$(REDIS_CLI) LLEN jobs:analyze_iam 2>/dev/null | xargs -I {} echo "  analyze_iam: {} jobs"

# =============================================================================
# Monitoring & Metrics
# =============================================================================
status:
	@echo "$(YELLOW)ScanOrbit Service Status$(RESET)"
	@echo "========================="
	@echo ""
	@echo "$(BLUE)API Service:$(RESET)"
	@$(COMPOSE_CMD) exec -T api wget -q -O- http://127.0.0.1:4000/status 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Worker:$(RESET)"
	@$(COMPOSE_CMD) exec -T scanner wget -q -O- http://127.0.0.1:9090/status 2>/dev/null | jq . || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Worker:$(RESET)"
	@$(COMPOSE_CMD) exec -T analyzer wget -q -O- http://127.0.0.1:9091/status 2>/dev/null | jq . || echo "  Not running"

status-api:
	@$(COMPOSE_CMD) exec -T api wget -q -O- http://127.0.0.1:4000/status | jq .

status-scanner:
	@$(COMPOSE_CMD) exec -T scanner wget -q -O- http://127.0.0.1:9090/status | jq .

status-analyzer:
	@$(COMPOSE_CMD) exec -T analyzer wget -q -O- http://127.0.0.1:9091/status | jq .

metrics:
	@echo "$(YELLOW)Fetching metrics from all services...$(RESET)"
	@echo ""
	@echo "$(BLUE)API Metrics:$(RESET)"
	@$(COMPOSE_CMD) exec -T api wget -q -O- http://127.0.0.1:4000/metrics 2>/dev/null | head -50 || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Metrics:$(RESET)"
	@$(COMPOSE_CMD) exec -T scanner wget -q -O- http://127.0.0.1:9090/metrics 2>/dev/null | head -50 || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Metrics:$(RESET)"
	@$(COMPOSE_CMD) exec -T analyzer wget -q -O- http://127.0.0.1:9091/metrics 2>/dev/null | head -50 || echo "  Not running"

metrics-api:
	@$(COMPOSE_CMD) exec -T api wget -q -O- http://127.0.0.1:4000/metrics

metrics-scanner:
	@$(COMPOSE_CMD) exec -T scanner wget -q -O- http://127.0.0.1:9090/metrics

metrics-analyzer:
	@$(COMPOSE_CMD) exec -T analyzer wget -q -O- http://127.0.0.1:9091/metrics
