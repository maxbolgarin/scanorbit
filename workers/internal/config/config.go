package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the workers.
type Config struct {
	DatabaseURL     string
	DBCACert        string
	RedisURL        string
	RedisCACert     string
	LogLevel        string
	ScanConcurrency int
	ShutdownTimeout time.Duration
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		DBCACert:        getEnv("DB_CA_CERT", ""),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379"),
		RedisCACert:     getEnv("REDIS_CA_CERT", ""),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		ScanConcurrency: getEnvInt("SCAN_CONCURRENCY", 10),
		ShutdownTimeout: time.Duration(getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 30)) * time.Second,
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
