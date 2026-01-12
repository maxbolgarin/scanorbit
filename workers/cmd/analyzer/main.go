package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/maxbolgarin/scanorbit/internal/analyzers"
	"github.com/maxbolgarin/scanorbit/internal/config"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	serviceName    = "analyzer"
	serviceVersion = "0.1.0"
	metricsPort    = 9091
)

func main() {
	// Setup logger
	logger := zerolog.New(os.Stdout).With().Timestamp().Str("service", "analyzer").Logger()

	// Load config
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to load config")
	}

	// Set log level
	switch cfg.LogLevel {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// Initialize metrics
	metrics.Init(metrics.Config{
		ServiceName: serviceName,
		Environment: cfg.LogLevel,
		Version:     serviceVersion,
	})

	// Start metrics server
	metricsServer := metrics.NewServer(metricsPort, serviceName, serviceVersion, cfg.LogLevel, logger)
	go func() {
		if err := metricsServer.Start(); err != nil && err != http.ErrServerClosed {
			logger.Error().Err(err).Msg("metrics server error")
		}
	}()

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup database
	db, err := store.NewDB(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// Setup store
	st := store.NewStore(db)

	// Setup Redis queue
	q, err := queue.NewRedisQueue(cfg.RedisURL, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to redis")
	}
	defer func() {
		if err := q.Close(); err != nil {
			logger.Error().Err(err).Msg("failed to close queue")
		}
	}()

	// Setup orchestrator with analyzers
	orchestrator := analyzers.NewOrchestrator(st, logger)
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeOrphans, analyzers.NewOrphanAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeSSL, analyzers.NewSSLAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeResidency, analyzers.NewResidencyAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeSecurity, analyzers.NewSecurityAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeCost, analyzers.NewCostAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeTagging, analyzers.NewTaggingAnalyzer(st, logger))
	orchestrator.RegisterAnalyzer(models.JobTypeAnalyzeIAM, analyzers.NewIAMAnalyzer(st, logger))

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		sig := <-sigChan
		logger.Info().Str("signal", sig.String()).Msg("received shutdown signal")
		cancel()
	}()

	logger.Info().Int("metrics_port", metricsPort).Msg("analyzer worker started")

	// Consume all analyzer jobs
	err = q.Consume(ctx, []models.JobType{
		models.JobTypeAnalyzeOrphans,
		models.JobTypeAnalyzeSSL,
		models.JobTypeAnalyzeResidency,
		models.JobTypeAnalyzeSecurity,
		models.JobTypeAnalyzeCost,
		models.JobTypeAnalyzeTagging,
		models.JobTypeAnalyzeIAM,
	}, orchestrator.HandleJob)

	if err != nil && err != context.Canceled {
		logger.Fatal().Err(err).Msg("queue consumer error")
	}

	// Shutdown metrics server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()
	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("failed to shutdown metrics server")
	}

	logger.Info().Msg("analyzer worker stopped")
}
