package main

import (
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"

	"github.com/maxbolgarin/scanorbit/internal/awsclient"
	"github.com/maxbolgarin/scanorbit/internal/config"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/scanner"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
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

	logger.Info().Msg("scanner worker started")

	// Dead letter handler - stores failed jobs in database
	deadLetterHandler := func(ctx context.Context, job *queue.Job, jobErr error) {
		deadJob := &store.DeadLetterJob{
			JobType: string(job.Type),
			Payload: job.Payload,
			Error:   jobErr.Error(),
			Retries: job.RetryCount,
		}
		if err := st.DeadLetters.Create(ctx, deadJob); err != nil {
			logger.Error().Err(err).Str("job_type", string(job.Type)).Msg("failed to store dead letter job")
		}
	}

	// Consume jobs
	err = q.Consume(ctx, []models.JobType{models.JobTypeScanAccount}, func(ctx context.Context, job *queue.Job) error {
		var scanJob models.ScanAccountJob
		if err := json.Unmarshal(job.Payload, &scanJob); err != nil {
			logger.Error().Err(err).Msg("failed to unmarshal job payload")
			return err
		}

		// Validate job payload
		if err := scanJob.Validate(); err != nil {
			logger.Error().Err(err).Msg("invalid job payload")
			return err
		}

		logger.Info().
			Str("account_id", scanJob.AccountID).
			Str("org_id", scanJob.OrgID).
			Msg("processing scan job")

		return scnr.ScanAccount(ctx, &scanJob)
	}, deadLetterHandler)

	if err != nil && err != context.Canceled {
		logger.Fatal().Err(err).Msg("queue consumer error")
	}

	logger.Info().Msg("scanner worker stopped")
}
