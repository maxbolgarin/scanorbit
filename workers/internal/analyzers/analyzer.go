package analyzers

import (
	"context"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// Analyzer defines the interface for resource analyzers.
type Analyzer interface {
	// Name returns the analyzer name.
	Name() string

	// Analyze performs analysis and returns findings.
	Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error)
}
