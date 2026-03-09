package analyzers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

// mockAnalyzer implements the Analyzer interface for testing.
type mockAnalyzer struct {
	name     string
	findings []*models.Finding
	err      error
	called   bool
}

func (m *mockAnalyzer) Name() string { return m.name }
func (m *mockAnalyzer) Analyze(_ context.Context, _ *models.AnalyzeJob) ([]*models.Finding, error) {
	m.called = true
	return m.findings, m.err
}

func TestOrchestrator_RegisterAndGetSupported(t *testing.T) {
	st, _ := testutil.NewMockStore()
	o := NewOrchestrator(st, zerolog.Nop())

	o.RegisterAnalyzer(models.JobTypeAnalyzeOrphans, &mockAnalyzer{name: "orphans"})
	o.RegisterAnalyzer(models.JobTypeAnalyzeSecurity, &mockAnalyzer{name: "security"})

	types := o.GetSupportedJobTypes()
	if len(types) != 2 {
		t.Fatalf("expected 2 supported types, got %d", len(types))
	}
}

func TestOrchestrator_HandleJob_UnknownType(t *testing.T) {
	st, _ := testutil.NewMockStore()
	o := NewOrchestrator(st, zerolog.Nop())

	qj := &queue.Job{
		Type:    "nonexistent",
		Payload: []byte(`{}`),
	}

	err := o.HandleJob(context.Background(), qj)
	if err == nil {
		t.Fatal("expected error for unknown job type")
	}
	if !strings.Contains(err.Error(), "unknown job type") {
		t.Errorf("error = %q, want 'unknown job type'", err)
	}
}

func TestOrchestrator_HandleJob_InvalidPayload(t *testing.T) {
	st, _ := testutil.NewMockStore()
	o := NewOrchestrator(st, zerolog.Nop())

	o.RegisterAnalyzer(models.JobTypeAnalyzeOrphans, &mockAnalyzer{name: "orphans"})

	qj := &queue.Job{
		Type:    models.JobTypeAnalyzeOrphans,
		Payload: []byte(`not json`),
	}

	err := o.HandleJob(context.Background(), qj)
	if err == nil {
		t.Fatal("expected error for invalid payload")
	}
	if !strings.Contains(err.Error(), "unmarshal") {
		t.Errorf("error = %q, want unmarshal error", err)
	}
}

func TestOrchestrator_HandleJob_ValidationFailure(t *testing.T) {
	st, _ := testutil.NewMockStore()
	o := NewOrchestrator(st, zerolog.Nop())

	o.RegisterAnalyzer(models.JobTypeAnalyzeOrphans, &mockAnalyzer{name: "orphans"})

	// Empty required fields
	payload, _ := json.Marshal(models.AnalyzeJob{})
	qj := &queue.Job{
		Type:    models.JobTypeAnalyzeOrphans,
		Payload: payload,
	}

	err := o.HandleJob(context.Background(), qj)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "invalid job payload") {
		t.Errorf("error = %q, want 'invalid job payload'", err)
	}
}

// NOTE: HandleJob tests for analyzer error/success paths are skipped because
// FailAnalyzerJob/CompleteAnalyzerJob use the private store.db field which
// cannot be mocked without a real database connection.
