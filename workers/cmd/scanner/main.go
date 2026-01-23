package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/awsclient"
	"github.com/maxbolgarin/scanorbit/internal/config"
	"github.com/maxbolgarin/scanorbit/internal/crypto"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/recovery"
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
		Environment: cfg.Environment,
		Version:     serviceVersion,
	})

	// Start metrics server (binds to localhost by default for security)
	metricsServer := metrics.NewServer(metricsPort, cfg.MetricsBindAddr, serviceName, serviceVersion, cfg.Environment, logger)
	go func() {
		if err := metricsServer.Start(); err != nil && err != http.ErrServerClosed {
			logger.Error().Err(err).Msg("metrics server error")
		}
	}()

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup database
	db, err := store.NewDB(ctx, cfg.DatabaseURL, cfg.DBCACert)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// Setup decryptor for encrypted fields (external_id)
	var decryptor *crypto.Decryptor
	if cfg.EncryptionKey != "" {
		decryptor, err = crypto.NewDecryptor(cfg.EncryptionKey)
		if err != nil {
			logger.Fatal().Err(err).Msg("failed to create decryptor")
		}
		logger.Info().Msg("encryption key configured, external IDs will be decrypted")
	} else {
		logger.Warn().Msg("OAUTH_ENCRYPTION_KEY not set, encrypted external IDs will not work")
	}

	// Setup store
	st := store.NewStore(db, decryptor)

	// Setup Redis queue
	q, err := queue.NewRedisQueue(cfg.RedisURL, cfg.RedisCACert, logger)
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

	// Setup job recovery
	recoveryPeriod := 5 * time.Minute
	recoveryAge := 5 * time.Minute
	recoveryRunner := recovery.NewRunner(st.JobRecovery, st.DeadLetters, q, recoveryPeriod, recoveryAge, logger)

	// Recover orphaned jobs on startup
	recovered, err := recoveryRunner.RecoverOnce(ctx)
	if err != nil {
		logger.Error().Err(err).Msg("failed to recover orphaned jobs on startup")
	} else if recovered > 0 {
		logger.Info().Int("count", recovered).Msg("recovered orphaned jobs on startup")
	}

	// Start periodic recovery in background
	go recoveryRunner.Start(ctx)

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		sig := <-sigChan
		logger.Info().Str("signal", sig.String()).Msg("received shutdown signal")
		cancel()
	}()

	logger.Info().Int("metrics_port", metricsPort).Msg("scanner worker started")

	// Dead letter handler - stores failed jobs and updates job/scan status
	deadLetterHandler := func(ctx context.Context, job *queue.Job, jobErr error) {
		// Try to parse job payload to get job_id and scan_id
		var scanJob models.ScanAccountJob
		if err := json.Unmarshal(job.Payload, &scanJob); err == nil {
			// Atomically update job and scan status to error
			if scanJob.JobID != "" || scanJob.ScanID != "" {
				if err := st.FailJobWithScan(ctx, scanJob.JobID, scanJob.ScanID, jobErr.Error()); err != nil {
					logger.Error().Err(err).
						Str("job_id", scanJob.JobID).
						Str("scan_id", scanJob.ScanID).
						Msg("failed to mark job/scan as error")
				}
			}
		}

		deadJob := &store.DeadLetterJob{
			JobID:   scanJob.JobID, // Reference to original job (may be empty for old jobs)
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
		if err := scanJob.Validate(); err != nil {
			logger.Error().Err(err).Msg("invalid job payload")
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "validation_error").Inc()
			done("error")
			return err
		}

		// Apply overall scan timeout from config
		scanCtx, scanCancel := context.WithTimeout(ctx, cfg.ScanTimeout)
		defer scanCancel()
		ctx = scanCtx

		// Mark job as running
		if scanJob.JobID != "" {
			if err := st.Jobs.MarkRunning(ctx, scanJob.JobID); err != nil {
				logger.Warn().Err(err).Str("job_id", scanJob.JobID).Msg("failed to mark job as running")
			}
		}

		// Use scan_id as trace_id for log correlation across services
		traceID := scanJob.ScanID
		if traceID == "" {
			traceID = scanJob.JobID
		}

		logger.Info().
			Str("account_id", scanJob.AccountID).
			Str("org_id", scanJob.OrgID).
			Str("job_id", scanJob.JobID).
			Str("scan_id", scanJob.ScanID).
			Str("trace_id", traceID).
			Msg("processing scan job")

		if err := scnr.ScanAccount(ctx, &scanJob); err != nil {
			// Mark job as error
			if scanJob.JobID != "" {
				if markErr := st.Jobs.MarkError(ctx, scanJob.JobID, err.Error()); markErr != nil {
					logger.Warn().Err(markErr).Str("job_id", scanJob.JobID).Msg("failed to mark job as error")
				}
			}
			metrics.JobErrors.WithLabelValues(serviceName, string(job.Type), "scan_error").Inc()
			done("error")
			return err
		}

		// Mark job as complete
		if scanJob.JobID != "" {
			if err := st.Jobs.MarkComplete(ctx, scanJob.JobID); err != nil {
				logger.Warn().Err(err).Str("job_id", scanJob.JobID).Msg("failed to mark job as complete")
			}
		}

		// Update scan status to analyzing_pending before creating analyzer jobs
		if scanJob.ScanID != "" {
			if err := st.Scans.UpdateStatusOnly(ctx, scanJob.ScanID, string(models.ScanStatusAnalyzingPending)); err != nil {
				logger.Warn().Err(err).Str("scan_id", scanJob.ScanID).Msg("failed to update scan to analyzing_pending")
			}
		}

		// Create and enqueue analyzer jobs with PostgreSQL durability
		analyzerTypes := []models.JobType{
			models.JobTypeAnalyzeOrphans,
			models.JobTypeAnalyzeSSL,
			models.JobTypeAnalyzeResidency,
			models.JobTypeAnalyzeSecurity,
			models.JobTypeAnalyzeCost,
			models.JobTypeAnalyzeTagging,
			models.JobTypeAnalyzeIAM,
		}

		enqueuedCount := 0
		for _, analyzerType := range analyzerTypes {
			// Create job payload (will be stored in DB)
			basePayload, _ := json.Marshal(models.AnalyzeJob{
				ScanID:    scanJob.ScanID,
				OrgID:     scanJob.OrgID,
				AccountID: scanJob.AccountID,
			})

			// Create job record in PostgreSQL for durability
			var scanIDPtr *string
			if scanJob.ScanID != "" {
				scanIDPtr = &scanJob.ScanID
			}
			jobID, err := st.Jobs.Create(ctx, &store.Job{
				Type:    string(analyzerType),
				ScanID:  scanIDPtr,
				Payload: basePayload,
				Status:  string(models.JobStatusQueued),
			})
			if err != nil {
				logger.Error().Err(err).
					Str("analyzer_type", string(analyzerType)).
					Str("account_id", scanJob.AccountID).
					Msg("failed to create analyzer job in database")
				continue
			}

			// Create payload with job_id for Redis queue
			payloadWithID, _ := json.Marshal(models.AnalyzeJob{
				JobID:     jobID,
				ScanID:    scanJob.ScanID,
				OrgID:     scanJob.OrgID,
				AccountID: scanJob.AccountID,
			})

			// Enqueue to Redis
			if err := q.Enqueue(ctx, analyzerType, payloadWithID); err != nil {
				logger.Error().Err(err).
					Str("analyzer_type", string(analyzerType)).
					Str("job_id", jobID).
					Str("account_id", scanJob.AccountID).
					Msg("failed to enqueue analyzer job to redis")
				// Job is in DB with queued status - will be recovered
			} else {
				logger.Debug().
					Str("analyzer_type", string(analyzerType)).
					Str("job_id", jobID).
					Str("account_id", scanJob.AccountID).
					Msg("created and enqueued analyzer job")
				enqueuedCount++
			}
		}

		// Update scan status to analyzing after jobs are created
		if scanJob.ScanID != "" && enqueuedCount > 0 {
			if err := st.Scans.UpdateStatusOnly(ctx, scanJob.ScanID, string(models.ScanStatusAnalyzing)); err != nil {
				logger.Warn().Err(err).Str("scan_id", scanJob.ScanID).Msg("failed to update scan to analyzing")
			}
		}

		logger.Info().
			Str("account_id", scanJob.AccountID).
			Str("scan_id", scanJob.ScanID).
			Str("trace_id", traceID).
			Int("analyzers_enqueued", enqueuedCount).
			Msg("created and enqueued analyzer jobs after scan")

		done("success")
		return nil

	}, deadLetterHandler)

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
