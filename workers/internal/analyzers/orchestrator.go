package analyzers

import (
	"context"
	"encoding/json"
	"fmt"

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
	analyzer, ok := o.analyzers[queueJob.Type]
	if !ok {
		return fmt.Errorf("unknown job type: %s", queueJob.Type)
	}

	var job models.AnalyzeJob
	if err := json.Unmarshal(queueJob.Payload, &job); err != nil {
		return fmt.Errorf("unmarshal job: %w", err)
	}

	o.logger.Info().
		Str("analyzer", analyzer.Name()).
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting analysis")

	findings, err := analyzer.Analyze(ctx, &job)
	if err != nil {
		o.logger.Error().Err(err).
			Str("analyzer", analyzer.Name()).
			Str("account_id", job.AccountID).
			Msg("analysis failed")
		return fmt.Errorf("analyze: %w", err)
	}

	// Persist findings
	persistedCount := 0
	for _, f := range findings {
		if err := o.store.Findings.Upsert(ctx, f); err != nil {
			o.logger.Error().Err(err).
				Str("finding_id", f.ID).
				Str("type", string(f.Type)).
				Msg("failed to upsert finding")
			continue
		}
		persistedCount++
	}

	o.logger.Info().
		Str("analyzer", analyzer.Name()).
		Str("account_id", job.AccountID).
		Int("findings_detected", len(findings)).
		Int("findings_persisted", persistedCount).
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
