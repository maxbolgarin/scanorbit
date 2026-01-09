package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/maxbolgarin/scanorbit/internal/analyzers"
	"github.com/maxbolgarin/scanorbit/internal/config"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
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
	defer q.Close()

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

	logger.Info().Msg("analyzer worker started")

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

	logger.Info().Msg("analyzer worker stopped")
}
