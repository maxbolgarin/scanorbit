.PHONY: install dev build test lint clean docker-up docker-down docker-build

# Development
install:
	pnpm install
	cd workers && go mod download

dev:
	pnpm dev

dev-infra:
	docker compose up db redis -d

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

# Build
build:
	pnpm build
	cd workers && make build

build-ts:
	pnpm build

build-go:
	cd workers && make build

# Test
test:
	pnpm test
	cd workers && make test

lint:
	pnpm lint
	cd workers && make lint

typecheck:
	pnpm typecheck

# Clean
clean:
	pnpm clean
	cd workers && make clean

# Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker-logs:
	docker compose logs -f

# Database
db-migrate:
	pnpm db:migrate

db-generate:
	pnpm db:generate
