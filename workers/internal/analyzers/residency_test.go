package analyzers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

func TestResidencyAnalyzer_DefaultEURegions(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceRDS, Region: "us-east-1", Name: "mydb", Raw: json.RawMessage(`{}`)},
			{ID: "2", Service: models.ServiceRDS, Region: "eu-west-1", Name: "eudb", Raw: json.RawMessage(`{}`)},
		}, nil
	}

	a := NewResidencyAnalyzer(st, zerolog.Nop())
	job := testutil.MakeAnalyzeJob()

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	// us-east-1 RDS should be flagged, eu-west-1 should not
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingDataResidency {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Severity != models.SeverityHigh {
		t.Errorf("Severity = %q, want high", findings[0].Severity)
	}
}

func TestResidencyAnalyzer_CustomPolicy(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceS3, Region: "us-west-2", Name: "us-bucket"},
			{ID: "2", Service: models.ServiceS3, Region: "ap-southeast-1", Name: "sg-bucket"},
		}, nil
	}

	a := NewResidencyAnalyzer(st, zerolog.Nop())
	job := testutil.MakeAnalyzeJob()
	job.Policy = &models.ResidencyPolicy{AllowedRegions: []string{"us-west-2", "us-east-1"}}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	// ap-southeast-1 should be flagged, us-west-2 should not
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
}

func TestResidencyAnalyzer_OnlyRDSAndS3(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceEC2, Region: "us-east-1", Name: "my-ec2"},
			{ID: "2", Service: models.ServiceLambda, Region: "us-east-1", Name: "my-func"},
		}, nil
	}

	a := NewResidencyAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	// EC2 and Lambda should not be checked
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings for non-data services, got %d", len(findings))
	}
}

func TestResidencyAnalyzer_EmptyRegion(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceRDS, Region: "", Name: "no-region"},
		}, nil
	}

	a := NewResidencyAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings for empty region, got %d", len(findings))
	}
}

func TestResidencyAnalyzer_AllCompliant(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceRDS, Region: "eu-central-1"},
			{ID: "2", Service: models.ServiceS3, Region: "eu-west-2"},
		}, nil
	}

	a := NewResidencyAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(findings))
	}
}
