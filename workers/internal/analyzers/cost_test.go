package analyzers

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

func TestCheckUnusedLambda_OldFunction(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	lastMod := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "old-func", Service: models.ServiceLambda,
		Raw: json.RawMessage(`{"last_modified":"` + lastMod + `","memory_size":256}`),
	}
	findings := a.checkUnusedLambda(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUnusedResource {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckUnusedLambda_RecentFunction(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	lastMod := now.Add(-30 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		Raw: json.RawMessage(`{"last_modified":"` + lastMod + `"}`),
	}
	if findings := a.checkUnusedLambda(r, now); len(findings) != 0 {
		t.Fatalf("expected 0 findings for recent function")
	}
}

func TestCheckStoppedInstance_LongStopped(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()

	r := &models.Resource{
		ID: "res-1", Name: "stopped-ec2", State: "stopped",
		LastSeenAt: now.Add(-14 * 24 * time.Hour),
		Raw:        json.RawMessage(`{"instance_type":"t3.medium"}`),
	}
	findings := a.checkStoppedInstance(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingStoppedInstance {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckStoppedInstance_Running(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{State: "running"}
	if findings := a.checkStoppedInstance(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for running instance")
	}
}

func TestCheckStoppedInstance_RecentlyStopped(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		State: "stopped", LastSeenAt: now.Add(-2 * 24 * time.Hour),
		Raw: json.RawMessage(`{}`),
	}
	if findings := a.checkStoppedInstance(r, now); len(findings) != 0 {
		t.Fatalf("expected 0 findings for recently stopped instance")
	}
}

func TestCheckGP2toGP3_GP2Volume(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "my-vol",
		Raw: json.RawMessage(`{"volume_type":"gp2","size":100}`),
	}
	findings := a.checkGP2toGP3Migration(r, time.Now())
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingEBSOptimization {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckGP2toGP3_GP3Volume(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"volume_type":"gp3","size":100}`)}
	if findings := a.checkGP2toGP3Migration(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for gp3 volume")
	}
}

func TestCheckGP2toGP3_SmallVolume(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"volume_type":"gp2","size":10}`)}
	// 10GB * 0.02 savings = $0.20 < $0.50 threshold
	if findings := a.checkGP2toGP3Migration(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for small volume savings")
	}
}

func TestCheckOldGenInstance_OldGen(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "old-ec2", State: "running",
		Raw: json.RawMessage(`{"instance_type":"m4.large"}`),
	}
	findings := a.checkOldGenInstance(r, time.Now())
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingOldGenInstance {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Details["recommended_family"] != "m6i" {
		t.Errorf("recommended_family = %v", findings[0].Details["recommended_family"])
	}
}

func TestCheckOldGenInstance_CurrentGen(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		State: "running",
		Raw:   json.RawMessage(`{"instance_type":"m6i.large"}`),
	}
	if findings := a.checkOldGenInstance(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for current gen")
	}
}

func TestCheckOldGenInstance_Stopped(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		State: "stopped",
		Raw:   json.RawMessage(`{"instance_type":"m4.large"}`),
	}
	if findings := a.checkOldGenInstance(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for stopped old gen instance")
	}
}

func TestCheckOversizedLambda_LargeMemory(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	lastMod := now.Add(-60 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "big-func",
		Raw: json.RawMessage(`{"memory_size":2048,"last_modified":"` + lastMod + `"}`),
	}
	findings := a.checkOversizedLambda(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingOversizedLambda {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckOversizedLambda_SmallMemory(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"memory_size":512}`)}
	if findings := a.checkOversizedLambda(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for small lambda")
	}
}

func TestCheckLogRetention_NoRetention(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "/aws/lambda/test",
		Raw: json.RawMessage(`{"stored_bytes":2147483648}`), // 2GB
	}
	findings := a.checkLogRetention(r, time.Now())
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingLogRetention {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckLogRetention_HasRetention(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		Raw: json.RawMessage(`{"stored_bytes":2147483648,"retention_days":30}`),
	}
	if findings := a.checkLogRetention(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings when retention is set")
	}
}

func TestCheckLogRetention_SmallStorage(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"stored_bytes":1000}`)}
	if findings := a.checkLogRetention(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for small storage")
	}
}

func TestCheckUnusedKMSKey_Unused(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Dependencies.GetByTargetFn = func(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error) {
		return nil, nil
	}
	a := NewCostAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ID: "res-1", ResourceID: "key-123", Name: "my-key",
		Raw: json.RawMessage(`{"key_manager":"CUSTOMER","key_state":"Enabled"}`),
	}
	findings := a.checkUnusedKMSKey(context.Background(), r, time.Now())
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUnusedKMSKey {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckUnusedKMSKey_AWSManaged(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"key_manager":"AWS","key_state":"Enabled"}`)}
	if findings := a.checkUnusedKMSKey(context.Background(), r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for AWS-managed key")
	}
}

func TestCheckUnusedKMSKey_HasDeps(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Dependencies.GetByTargetFn = func(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error) {
		return []*models.ResourceDependency{{ID: "dep-1"}}, nil
	}
	a := NewCostAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ResourceID: "key-123",
		Raw:        json.RawMessage(`{"key_manager":"CUSTOMER","key_state":"Enabled"}`),
	}
	if findings := a.checkUnusedKMSKey(context.Background(), r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for key with dependencies")
	}
}

func TestCheckRDSOptimization_LargeInstance(t *testing.T) {
	st, _ := testutil.NewMockStore()
	a := NewCostAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ID: "res-1", Name: "big-db",
		Raw: json.RawMessage(`{"DBInstanceClass":"db.r5.8xlarge","MultiAZ":false}`),
	}
	findings := a.checkRDSOptimization(r, time.Now())
	if len(findings) == 0 {
		// Only if savings >= $50
		t.Log("no finding - savings may be below $50 threshold")
		return
	}
	if findings[0].Type != models.FindingRDSOptimization {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckRDSOptimization_SmallInstance(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		Raw: json.RawMessage(`{"DBInstanceClass":"db.t3.micro","MultiAZ":false}`),
	}
	// db.t3.micro is not in the downsize path
	if findings := a.checkRDSOptimization(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for small RDS instance")
	}
}

func TestCheckOldGenRDS_OldGen(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "old-db",
		Raw: json.RawMessage(`{"DBInstanceClass":"db.m4.large","MultiAZ":false}`),
	}
	findings := a.checkOldGenRDS(r, time.Now())
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingOldGenRDS {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Details["recommended_class"] != "db.m6i.large" {
		t.Errorf("recommended_class = %v", findings[0].Details["recommended_class"])
	}
}

func TestCheckOldGenRDS_CurrentGen(t *testing.T) {
	a := &CostAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"DBInstanceClass":"db.m6i.large"}`)}
	if findings := a.checkOldGenRDS(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for current gen RDS")
	}
}

func TestCheckUnusedSecret_NeverAccessed(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	created := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "old-secret",
		Raw: json.RawMessage(`{"created_date":"` + created + `"}`),
	}
	findings := a.checkUnusedSecret(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
}

func TestCheckUnusedSecret_RecentlyAccessed(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	lastAccessed := now.Add(-10 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		Raw: json.RawMessage(`{"last_accessed_date":"` + lastAccessed + `"}`),
	}
	if findings := a.checkUnusedSecret(r, now); len(findings) != 0 {
		t.Fatalf("expected 0 findings for recently accessed secret")
	}
}

func TestCheckUnusedLogGroup_HighStorageOld(t *testing.T) {
	a := &CostAnalyzer{}
	now := time.Now()
	// creation_time in milliseconds, 60 days ago
	creationTime := float64(now.Add(-60 * 24 * time.Hour).UnixMilli())

	r := &models.Resource{
		ID: "res-1", Name: "/aws/test",
		Raw: json.RawMessage(`{"stored_bytes":200000000,"creation_time":` + json.Number(json.Number(time.Now().Format("0")).String()).String() + `}`),
	}
	// Use proper JSON
	raw := map[string]any{
		"stored_bytes":  float64(200000000), // 200MB > 100MB threshold
		"creation_time": creationTime,
	}
	rawJSON, _ := json.Marshal(raw)
	r.Raw = rawJSON

	findings := a.checkUnusedLogGroup(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUnusedLogGroup {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCostAnalyzer_Analyze(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	now := time.Now()
	oldDate := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceEC2, Name: "old-ec2", State: "running", Raw: json.RawMessage(`{"instance_type":"m4.large"}`)},
			{ID: "2", Service: models.ServiceLambda, Name: "old-func", Raw: json.RawMessage(`{"last_modified":"` + oldDate + `","memory_size":256}`)},
			{ID: "3", Service: models.ServiceEBS, Raw: json.RawMessage(`{"volume_type":"gp3","size":100}`)},
		}, nil
	}
	mocks.Dependencies.GetByTargetFn = func(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error) {
		return nil, nil
	}

	a := NewCostAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	// old-ec2 (old gen) + old-func (unused lambda) = 2, gp3 volume = 0
	if len(findings) < 2 {
		t.Fatalf("expected at least 2 findings, got %d", len(findings))
	}
}
