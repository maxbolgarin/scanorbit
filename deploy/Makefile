.PHONY: health redis-cli redis-queue-status status status-api status-scanner status-analyzer metrics metrics-api metrics-scanner metrics-analyzer monitoring-up monitoring-down tunnel-grafana tunnel-prometheus tunnel-loki tunnel-monitoring tunnel-all clean help

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
health:
	@echo "$(YELLOW)Checking service health...$(RESET)"
	@echo ""
	@echo "$(BLUE)API:$(RESET)"
	@curl -s http://localhost:4000/health | jq . 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Scanner Worker:$(RESET)"
	@curl -s http://localhost:9090/health | jq . 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(BLUE)Analyzer Worker:$(RESET)"
	@curl -s http://localhost:9091/health | jq . 2>/dev/null || echo "  Not running"
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

# SSH tunnels for production monitoring
tunnel-grafana:
	@echo "$(YELLOW)Opening SSH tunnel to production Grafana...$(RESET)"
	@echo "  Grafana will be available at: http://localhost:3001"
	@echo "  Press Ctrl+C to close the tunnel"
	@echo ""
	ssh -N -L 3001:localhost:3001 root@scanorbit.cloud

tunnel-prometheus:
	@echo "$(YELLOW)Opening SSH tunnel to production Prometheus...$(RESET)"
	@echo "  Prometheus will be available at: http://localhost:9092"
	@echo "  Press Ctrl+C to close the tunnel"
	@echo ""
	ssh -N -L 9092:localhost:9092 root@scanorbit.cloud

tunnel-loki:
	@echo "$(YELLOW)Opening SSH tunnel to production Loki...$(RESET)"
	@echo "  Loki will be available at: http://localhost:3100"
	@echo "  Press Ctrl+C to close the tunnel"
	@echo ""
	ssh -N -L 3100:localhost:3100 root@scanorbit.cloud

tunnel-monitoring:
	@echo "$(YELLOW)Opening SSH tunnels to all production monitoring services...$(RESET)"
	@echo "  Grafana:    http://localhost:3001"
	@echo "  Prometheus: http://localhost:9092"
	@echo "  Loki:       http://localhost:3100"
	@echo ""
	@echo "  Press Ctrl+C to close all tunnels"
	@echo ""
	ssh -N -L 3001:localhost:3001 -L 9092:localhost:9092 -L 3100:localhost:3100 root@scanorbit.cloud

tunnel-all:
	@echo "$(YELLOW)Opening SSH tunnels to all production services...$(RESET)"
	@echo "  API:        http://localhost:4000"
	@echo "  Grafana:    http://localhost:3001"
	@echo "  Prometheus: http://localhost:9092"
	@echo "  Loki:       http://localhost:3100"
	@echo "  Scanner:    http://localhost:9090/metrics"
	@echo "  Analyzer:   http://localhost:9091/metrics"
	@echo ""
	@echo "  Press Ctrl+C to close all tunnels"
	@echo ""
	ssh -N -L 4000:localhost:4000 -L 3001:localhost:3001 -L 9092:localhost:9092 -L 3100:localhost:3100 -L 9090:localhost:9090 -L 9091:localhost:9091 root@scanorbit.cloud
