package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the workers.
type Config struct {
	DatabaseURL      string
	DBCACert         string
	RedisURL         string
	RedisCACert      string
	LogLevel         string
	Environment      string // Environment name (e.g., production, staging, development)
	ScanConcurrency  int
	ScanTimeout      time.Duration // Overall timeout for scan operations
	ShutdownTimeout  time.Duration
	MetricsBindAddr  string // Bind address for metrics server (default: 127.0.0.1 for security)
	EncryptionKey    string // 64-char hex string (32 bytes) for AES-256-GCM decryption of external IDs
}

// Load reads configuration from Docker secrets (files at /run/secrets/) with
// environment variable fallback. In development, secrets don't exist as files.
func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:     getSecret("DATABASE_URL", "database_url", ""),
		DBCACert:        getEnv("DB_CA_CERT", ""),
		RedisURL:        getSecret("REDIS_URL", "redis_url", "redis://localhost:6379"),
		RedisCACert:     getEnv("REDIS_CA_CERT", ""),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		Environment:     getEnv("ENVIRONMENT", "development"),
		ScanConcurrency: getEnvInt("SCAN_CONCURRENCY", 10),
		ScanTimeout:     time.Duration(getEnvInt("SCAN_TIMEOUT_MINUTES", 60)) * time.Minute,
		ShutdownTimeout: time.Duration(getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 30)) * time.Second,
		MetricsBindAddr: getEnv("METRICS_BIND_ADDR", "127.0.0.1"), // Default to localhost for security
		EncryptionKey:   getSecret("OAUTH_ENCRYPTION_KEY", "oauth_encryption_key", ""), // Same key as API for decrypting external IDs
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks that all required configuration is present.
func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.RedisURL == "" {
		return fmt.Errorf("REDIS_URL is required")
	}
	if c.ScanConcurrency < 1 {
		return fmt.Errorf("SCAN_CONCURRENCY must be at least 1")
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getSecret reads a Docker secret from /run/secrets/<secretName>, falling back to
// the environment variable. In development, secret files don't exist.
func getSecret(envKey, secretName, defaultValue string) string {
	data, err := os.ReadFile("/run/secrets/" + secretName)
	if err == nil {
		return strings.TrimSpace(string(data))
	}
	return getEnv(envKey, defaultValue)
}
