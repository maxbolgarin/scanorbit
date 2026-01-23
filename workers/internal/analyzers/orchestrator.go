package analyzers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Orchestrator dispatches analysis jobs to the appropriate analyzers.
type Orchestrator struct {
	analyzers map[models.JobType]Analyzer
	store     *store.Store
	logger    zerolog.Logger
}

// NewOrchestrator creates a new Orchestrator.
func NewOrchestrator(st *store.Store, logger zerolog.Logger) *Orchestrator {
	return &Orchestrator{
		analyzers: make(map[models.JobType]Analyzer),
		store:     st,
		logger:    logger.With().Str("component", "orchestrator").Logger(),
	}
}

// RegisterAnalyzer registers an analyzer for a job type.
func (o *Orchestrator) RegisterAnalyzer(jobType models.JobType, analyzer Analyzer) {
	o.analyzers[jobType] = analyzer
	o.logger.Info().
		Str("job_type", string(jobType)).
		Str("analyzer", analyzer.Name()).
		Msg("registered analyzer")
}

// HandleJob handles a job from the queue.
func (o *Orchestrator) HandleJob(ctx context.Context, queueJob *queue.Job) error {
	startTime := time.Now()
	analyzerType := string(queueJob.Type)

	// Track job in flight
	metrics.JobsInFlight.WithLabelValues("analyzer", analyzerType).Inc()
	defer metrics.JobsInFlight.WithLabelValues("analyzer", analyzerType).Dec()

	analyzer, ok := o.analyzers[queueJob.Type]
	if !ok {
		metrics.JobsProcessedTotal.WithLabelValues("analyzer", analyzerType, "error").Inc()
		metrics.JobErrors.WithLabelValues("analyzer", analyzerType, "unknown_type").Inc()
		return fmt.Errorf("unknown job type: %s", queueJob.Type)
	}

	var job models.AnalyzeJob
	if err := json.Unmarshal(queueJob.Payload, &job); err != nil {
		metrics.JobsProcessedTotal.WithLabelValues("analyzer", analyzerType, "error").Inc()
		metrics.JobErrors.WithLabelValues("analyzer", analyzerType, "unmarshal_error").Inc()
		return fmt.Errorf("unmarshal job: %w", err)
	}

	if err := job.Validate(); err != nil {
		return fmt.Errorf("invalid job payload: %w", err)
	}

	// Mark job as running in PostgreSQL
	if job.JobID != "" {
		if err := o.store.Jobs.MarkRunning(ctx, job.JobID); err != nil {
			o.logger.Warn().Err(err).Str("job_id", job.JobID).Msg("failed to mark analyzer job as running")
		}
	}

	// Use scan_id as trace_id for log correlation across services
	traceID := job.ScanID
	if traceID == "" {
		traceID = job.JobID
	}

	o.logger.Info().
		Str("analyzer", analyzer.Name()).
		Str("job_id", job.JobID).
		Str("scan_id", job.ScanID).
		Str("trace_id", traceID).
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting analysis")

	findings, err := analyzer.Analyze(ctx, &job)
	if err != nil {
		// Atomically mark job as error and check scan completion
		scanCompleted, markErr := o.store.FailAnalyzerJob(ctx, job.JobID, job.ScanID, err.Error())
		if markErr != nil {
			o.logger.Warn().Err(markErr).Str("job_id", job.JobID).Msg("failed to mark analyzer job as error")
		} else if scanCompleted {
			o.logger.Info().Str("scan_id", job.ScanID).Msg("all analyzer jobs complete, scan marked as complete")
		}

		o.logger.Error().Err(err).
			Str("analyzer", analyzer.Name()).
			Str("job_id", job.JobID).
			Str("scan_id", job.ScanID).
			Str("trace_id", traceID).
			Str("account_id", job.AccountID).
			Msg("analysis failed")
		metrics.JobsProcessedTotal.WithLabelValues("analyzer", analyzerType, "error").Inc()
		metrics.JobErrors.WithLabelValues("analyzer", analyzerType, "analysis_error").Inc()
		metrics.AnalysesCompleted.WithLabelValues(analyzerType, "error").Inc()
		return fmt.Errorf("analyze: %w", err)
	}

	// Persist findings with history tracking
	persistedCount := 0
	var detectedFindingIDs []string
	var findingScanRecords []*models.FindingScan

	for _, f := range findings {
		findingID, isNew, err := o.store.Findings.UpsertWithHistory(ctx, f, job.ScanID)
		if err != nil {
			o.logger.Error().Err(err).
				Str("finding_id", f.ID).
				Str("type", string(f.Type)).
				Msg("failed to upsert finding")
			continue
		}

		persistedCount++
		detectedFindingIDs = append(detectedFindingIDs, findingID)

		// Track finding-scan detection
		findingScanRecords = append(findingScanRecords, models.NewFindingScan(
			findingID,
			job.ScanID,
			models.FindingScanDetected,
		))

		// Track findings by severity
		if isNew {
			metrics.FindingsCreated.WithLabelValues(analyzerType, string(f.Severity)).Inc()
		}
	}

	// Record finding-scan history
	if len(findingScanRecords) > 0 {
		if err := o.store.FindingScans.BulkUpsert(ctx, findingScanRecords); err != nil {
			o.logger.Error().Err(err).Msg("failed to record finding-scan history")
		}
	}

	// Atomically mark job as complete and check scan completion
	scanCompleted, err := o.store.CompleteAnalyzerJob(ctx, job.JobID, job.ScanID)
	if err != nil {
		o.logger.Warn().Err(err).Str("job_id", job.JobID).Msg("failed to complete analyzer job")
	} else if scanCompleted {
		o.logger.Info().Str("scan_id", job.ScanID).Msg("all analyzer jobs complete, scan marked as complete")

		// Auto-resolve findings that were not detected in this scan
		resolved, resolveErr := o.store.Findings.AutoResolveByScanID(ctx, job.ScanID, job.AccountID)
		if resolveErr != nil {
			o.logger.Warn().Err(resolveErr).Str("scan_id", job.ScanID).Msg("failed to auto-resolve missing findings")
		} else if resolved > 0 {
			o.logger.Info().Int64("count", resolved).Str("scan_id", job.ScanID).Msg("auto-resolved findings not detected in scan")
		}
	}

	// Track successful completion
	duration := time.Since(startTime).Seconds()
	metrics.JobsProcessedTotal.WithLabelValues("analyzer", analyzerType, "success").Inc()
	metrics.JobProcessingTime.WithLabelValues("analyzer", analyzerType).Observe(duration)
	metrics.AnalysesCompleted.WithLabelValues(analyzerType, "success").Inc()
	metrics.AnalysisDuration.WithLabelValues(analyzerType).Observe(duration)

	o.logger.Info().
		Str("analyzer", analyzer.Name()).
		Str("job_id", job.JobID).
		Str("scan_id", job.ScanID).
		Str("trace_id", traceID).
		Str("account_id", job.AccountID).
		Int("findings_detected", len(findings)).
		Int("findings_persisted", persistedCount).
		Float64("duration_seconds", duration).
		Msg("analysis completed")

	return nil
}

// GetSupportedJobTypes returns all job types that have registered analyzers.
func (o *Orchestrator) GetSupportedJobTypes() []models.JobType {
	types := make([]models.JobType, 0, len(o.analyzers))
	for t := range o.analyzers {
		types = append(types, t)
	}
	return types
}
