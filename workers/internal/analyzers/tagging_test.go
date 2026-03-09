package analyzers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

func TestFindMissingTags_AllPresent(t *testing.T) {
	a := &TaggingAnalyzer{}
	r := &models.Resource{Tags: map[string]string{
		"Environment": "prod",
		"Owner":       "team-a",
		"CostCenter":  "123",
	}}
	missing := a.findMissingTagsWithList(r, []string{"Environment", "Owner", "CostCenter"})
	if len(missing) != 0 {
		t.Fatalf("expected 0 missing, got %v", missing)
	}
}

func TestFindMissingTags_SomeMissing(t *testing.T) {
	a := &TaggingAnalyzer{}
	r := &models.Resource{Tags: map[string]string{"Environment": "prod"}}
	missing := a.findMissingTagsWithList(r, []string{"Environment", "Owner", "CostCenter"})
	if len(missing) != 2 {
		t.Fatalf("expected 2 missing, got %v", missing)
	}
}

func TestFindMissingTags_CaseInsensitive(t *testing.T) {
	a := &TaggingAnalyzer{}
	r := &models.Resource{Tags: map[string]string{
		"environment": "prod",
		"OWNER":       "team-a",
	}}
	missing := a.findMissingTagsWithList(r, []string{"Environment", "Owner"})
	if len(missing) != 0 {
		t.Fatalf("expected case-insensitive match, got missing: %v", missing)
	}
}

func TestFindMissingTags_EmptyValue(t *testing.T) {
	a := &TaggingAnalyzer{}
	r := &models.Resource{Tags: map[string]string{"Environment": ""}}
	missing := a.findMissingTagsWithList(r, []string{"Environment"})
	if len(missing) != 1 {
		t.Fatalf("expected 1 missing for empty value, got %v", missing)
	}
}

func TestFindMissingTags_NilTags(t *testing.T) {
	a := &TaggingAnalyzer{}
	r := &models.Resource{Tags: nil}
	missing := a.findMissingTagsWithList(r, []string{"Environment"})
	if len(missing) != 1 {
		t.Fatalf("expected 1 missing for nil tags, got %v", missing)
	}
}

func TestTaggingAnalyzer_Analyze_WithJobTags(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return []*models.Resource{
			{
				ID: "1", Service: models.ServiceEC2, Name: "my-ec2",
				Tags: map[string]string{"Team": "backend"},
				Raw:  json.RawMessage(`{}`),
			},
		}, nil
	}

	a := NewTaggingAnalyzer(st, zerolog.Nop())
	job := testutil.MakeAnalyzeJob()
	job.RequiredTags = []string{"Team", "Project"}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	// "Team" is present, "Project" is missing
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingMissingTag {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Severity != models.SeverityTrivial {
		t.Errorf("Severity = %q, want trivial", findings[0].Severity)
	}
}

func TestTaggingAnalyzer_Analyze_NoRequiredTags(t *testing.T) {
	st, _ := testutil.NewMockStore()
	a := &TaggingAnalyzer{store: st, requiredTags: nil, logger: zerolog.Nop()}
	job := testutil.MakeAnalyzeJob()

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings when no required tags, got %d", len(findings))
	}
}

func TestTaggingAnalyzer_Analyze_SkipsNonTaggable(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceIAMUser, Tags: map[string]string{}},
			{ID: "2", Service: models.ServiceIAMRole, Tags: map[string]string{}},
		}, nil
	}

	a := NewTaggingAnalyzer(st, zerolog.Nop())
	job := testutil.MakeAnalyzeJob()
	job.RequiredTags = []string{"Environment"}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings for non-taggable services, got %d", len(findings))
	}
}

func TestTaggingAnalyzer_Analyze_AllTaggableServices(t *testing.T) {
	st, mocks := testutil.NewMockStore()

	taggableServices := []models.ServiceType{
		models.ServiceEC2, models.ServiceEBS, models.ServiceRDS,
		models.ServiceS3, models.ServiceALB, models.ServiceLambda,
		models.ServiceSecurityGroup, models.ServiceSecret, models.ServiceKMSKey,
		models.ServiceCloudWatchLogs, models.ServiceCloudWatchAlarm,
	}

	var resources []*models.Resource
	for i, svc := range taggableServices {
		resources = append(resources, &models.Resource{
			ID: string(rune('a' + i)), Service: svc, Name: "test",
			Tags: map[string]string{},
		})
	}

	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return resources, nil
	}

	a := NewTaggingAnalyzer(st, zerolog.Nop())
	job := testutil.MakeAnalyzeJob()
	job.RequiredTags = []string{"Env"}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != len(taggableServices) {
		t.Fatalf("expected %d findings (one per taggable service), got %d", len(taggableServices), len(findings))
	}
}
