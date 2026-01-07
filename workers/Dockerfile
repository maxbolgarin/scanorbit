# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download
COPY . .

# Build scanner
FROM builder AS build-scanner
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /scanner ./cmd/scanner

# Build analyzer
FROM builder AS build-analyzer
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /analyzer ./cmd/analyzer

# Scanner production image
FROM alpine:3.21 AS scanner
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build-scanner /scanner .
USER nobody:nobody
ENTRYPOINT ["./scanner"]

# Analyzer production image
FROM alpine:3.21 AS analyzer
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build-analyzer /analyzer .
USER nobody:nobody
ENTRYPOINT ["./analyzer"]
