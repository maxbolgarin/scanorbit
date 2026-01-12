package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/maxbolgarin/scanorbit/internal/awsclient"
	"github.com/maxbolgarin/scanorbit/internal/config"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/scanner"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	serviceName    = "scanner"
	serviceVersion = "0.1.0"
	metricsPort    = 9090
)

func main() {
	// Setup logger
	logger := zerolog.New(os.Stdout).With().Timestamp().Str("service", "scanner").Logger()

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
		Environment: cfg.LogLevel, // Use log level as environment indicator
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

	// Setup AWS client
	awsClient, err := awsclient.NewClient(ctx, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create aws client")
	}

	// Setup scanner
	scnr := scanner.NewScanner(awsClient, st, cfg.ScanConcurrency, logger)

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		sig := <-sigChan
		logger.Info().Str("signal", sig.String()).Msg("received shutdown signal")
		cancel()
	}()

	logger.Info().Int("metrics_port", metricsPort).Msg("scanner worker started")

	// Consume jobs
	err = q.Consume(ctx, []models.JobType{models.JobTypeScanAccount}, func(ctx context.Context, job *queue.Job) error {
		// Start tracking job metrics
		done := metrics.TrackJobProcessing(serviceName, string(job.Type))

		var scanJob models.ScanAccountJob
		if err := json.Unmarshal(job.Payload, &scanJob); err != nil {
			logger.Error().Err(err).Msg("failed to unmarshal job payload")
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "unmarshal_error").Inc()
			done("error")
			return err
		}

		// Validate job payload
		if scanJob.AccountID == "" {
			err := errors.New("account_id is required but was empty")
			logger.Error().Err(err).Msg("invalid job payload")
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "validation_error").Inc()
			done("error")
			return err
		}
		if scanJob.OrgID == "" {
			err := errors.New("org_id is required but was empty")
			logger.Error().Err(err).Msg("invalid job payload")
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "validation_error").Inc()
			done("error")
			return err
		}

		logger.Info().
			Str("account_id", scanJob.AccountID).
			Str("org_id", scanJob.OrgID).
			Msg("processing scan job")

		if err := scnr.ScanAccount(ctx, &scanJob); err != nil {
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "scan_error").Inc()
			done("error")
			return err
		}

		done("success")
		return nil
	})

	if err != nil && err != context.Canceled {
		logger.Fatal().Err(err).Msg("queue consumer error")
	}

	// Shutdown metrics server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()
	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("failed to shutdown metrics server")
	}

	logger.Info().Msg("scanner worker stopped")
}
