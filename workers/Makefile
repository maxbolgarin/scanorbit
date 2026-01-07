.PHONY: build build-scanner build-analyzer run-scanner run-analyzer test clean lint

BUILD_DIR=./bin

# Build both binaries
build: build-scanner build-analyzer

build-scanner:
	go build -o $(BUILD_DIR)/scanner ./cmd/scanner

build-analyzer:
	go build -o $(BUILD_DIR)/analyzer ./cmd/analyzer

# Run
run-scanner: build-scanner
	$(BUILD_DIR)/scanner

run-analyzer: build-analyzer
	$(BUILD_DIR)/analyzer

# Development
dev-scanner:
	go run ./cmd/scanner

dev-analyzer:
	go run ./cmd/analyzer

# Test & Lint
test:
	go test -v ./...

lint:
	golangci-lint run

# Clean
clean:
	rm -rf $(BUILD_DIR)
	go clean
