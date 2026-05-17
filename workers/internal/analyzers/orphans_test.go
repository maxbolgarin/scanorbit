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

func TestCheckOrphanedEBS_UnattachedOld(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", ResourceID: "vol-123", Service: models.ServiceEBS,
		State: "unattached", Region: "us-east-1",
		CreatedAt: now.Add(-30 * 24 * time.Hour),
		Raw:       json.RawMessage(`{"size": 100}`),
	}

	finding := a.checkOrphanedEBS(r, now)
	if finding == nil {
		t.Fatal("expected finding for old unattached EBS")
	}
	if finding.Type != models.FindingOrphanedVolume {
		t.Errorf("Type = %q, want %q", finding.Type, models.FindingOrphanedVolume)
	}
	if finding.Severity != models.SeverityMedium {
		t.Errorf("Severity = %q, want %q", finding.Severity, models.SeverityMedium)
	}
	// Cost should be 100 * 0.10 = 10.0
	if cost, ok := finding.Details["estimated_monthly_cost"].(float64); !ok || cost != 10.0 {
		t.Errorf("estimated_monthly_cost = %v, want 10.0", finding.Details["estimated_monthly_cost"])
	}
}

func TestCheckOrphanedEBS_AvailableState(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceEBS,
		State: "available", CreatedAt: now.Add(-30 * 24 * time.Hour),
		Raw: json.RawMessage(`{}`),
	}
	if finding := a.checkOrphanedEBS(r, now); finding == nil {
		t.Fatal("expected finding for 'available' state EBS")
	}
}

func TestCheckOrphanedEBS_InUse(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "in-use", Raw: json.RawMessage(`{}`)}
	if finding := a.checkOrphanedEBS(r, time.Now()); finding != nil {
		t.Fatal("expected nil for in-use EBS")
	}
}

func TestCheckOrphanedEBS_RecentUnattached(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		State: "unattached", CreatedAt: now.Add(-3 * 24 * time.Hour),
		Raw: json.RawMessage(`{}`),
	}
	if finding := a.checkOrphanedEBS(r, now); finding != nil {
		t.Fatal("expected nil for recently unattached EBS (3 days)")
	}
}

func TestCheckOrphanedEBS_UsesAWSCreateTime(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	awsTime := now.Add(-60 * 24 * time.Hour).Format(time.RFC3339)
	r := &models.Resource{
		ID: "res-1", State: "unattached",
		CreatedAt: now.Add(-2 * 24 * time.Hour), // DB says 2 days
		Raw:       json.RawMessage(`{"aws_create_time":"` + awsTime + `"}`),
	}
	finding := a.checkOrphanedEBS(r, now)
	if finding == nil {
		t.Fatal("expected finding using AWS create time")
	}
	if days, ok := finding.Details["unattached_days"].(int); !ok || days < 50 {
		t.Errorf("unattached_days = %v, expected >= 50", days)
	}
}

func TestCheckOrphanedEIP_UnassociatedOld(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", State: "unassociated",
		CreatedAt: now.Add(-10 * 24 * time.Hour),
	}
	finding := a.checkOrphanedEIP(r, now)
	if finding == nil {
		t.Fatal("expected finding")
	}
	if finding.Type != models.FindingOrphanedEIP {
		t.Errorf("Type = %q", finding.Type)
	}
	if finding.Severity != models.SeverityLow {
		t.Errorf("Severity = %q", finding.Severity)
	}
}

func TestCheckOrphanedEIP_Associated(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "associated"}
	if finding := a.checkOrphanedEIP(r, time.Now()); finding != nil {
		t.Fatal("expected nil for associated EIP")
	}
}

func TestCheckOrphanedEIP_Recent(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "unassociated", CreatedAt: time.Now().Add(-1 * 24 * time.Hour)}
	if finding := a.checkOrphanedEIP(r, time.Now()); finding != nil {
		t.Fatal("expected nil for recent EIP")
	}
}

func TestCheckOrphanedSnapshot_Old(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", CreatedAt: now.Add(-60 * 24 * time.Hour),
		Raw: json.RawMessage(`{"AllocatedStorage": 50}`),
	}
	finding := a.checkOrphanedSnapshot(r, now)
	if finding == nil {
		t.Fatal("expected finding")
	}
	if finding.Type != models.FindingOrphanedSnapshot {
		t.Errorf("Type = %q", finding.Type)
	}
	// 50 * 0.095 = 4.75
	if cost, ok := finding.Details["estimated_monthly_cost"].(float64); !ok || cost != 4.75 {
		t.Errorf("cost = %v, want 4.75", cost)
	}
}

func TestCheckOrphanedSnapshot_Recent(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{CreatedAt: time.Now().Add(-10 * 24 * time.Hour), Raw: json.RawMessage(`{}`)}
	if finding := a.checkOrphanedSnapshot(r, time.Now()); finding != nil {
		t.Fatal("expected nil for recent snapshot")
	}
}

func TestCheckIdleLoadBalancer_NoTargetGroups(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		ID: "res-1", State: "active", Name: "my-alb",
		Raw: json.RawMessage(`{"Type": "application"}`),
	}
	finding := a.checkIdleLoadBalancer(r, time.Now())
	if finding == nil {
		t.Fatal("expected finding for ALB with no target groups")
	}
	if finding.Type != models.FindingIdleLoadBalancer {
		t.Errorf("Type = %q", finding.Type)
	}
}

func TestCheckIdleLoadBalancer_NoHealthyTargets(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		ID: "res-1", State: "active", Name: "my-alb",
		Raw: json.RawMessage(`{"Type": "application", "TargetGroups": [{"Targets": [{"HealthState": "unhealthy"}]}]}`),
	}
	finding := a.checkIdleLoadBalancer(r, time.Now())
	if finding == nil {
		t.Fatal("expected finding")
	}
}

func TestCheckIdleLoadBalancer_HasHealthyTargets(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		State: "active",
		Raw:   json.RawMessage(`{"Type": "application", "TargetGroups": [{"Targets": [{"HealthState": "healthy"}]}]}`),
	}
	if finding := a.checkIdleLoadBalancer(r, time.Now()); finding != nil {
		t.Fatal("expected nil for ALB with healthy targets")
	}
}

func TestCheckIdleLoadBalancer_NotActive(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "provisioning", Raw: json.RawMessage(`{}`)}
	if finding := a.checkIdleLoadBalancer(r, time.Now()); finding != nil {
		t.Fatal("expected nil for non-active ALB")
	}
}

func TestCheckIdleLoadBalancer_NLBType(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		ID: "res-1", State: "active", Name: "my-nlb",
		Raw: json.RawMessage(`{"Type": "network"}`),
	}
	finding := a.checkIdleLoadBalancer(r, time.Now())
	if finding == nil {
		t.Fatal("expected finding")
	}
	if finding.Details["lb_type"] != "network" {
		t.Errorf("lb_type = %v, want network", finding.Details["lb_type"])
	}
}

func TestCheckOrphanedENI_UnattachedOld(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", State: "available",
		CreatedAt: now.Add(-10 * 24 * time.Hour),
		Raw:       json.RawMessage(`{}`),
	}
	finding := a.checkOrphanedENI(r, now)
	if finding == nil {
		t.Fatal("expected finding")
	}
	if finding.Type != models.FindingOrphanedENI {
		t.Errorf("Type = %q", finding.Type)
	}
}

func TestCheckOrphanedENI_RequesterManaged(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		State: "available", CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
		Raw: json.RawMessage(`{"requester_managed": true}`),
	}
	if finding := a.checkOrphanedENI(r, time.Now()); finding != nil {
		t.Fatal("expected nil for requester-managed ENI")
	}
}

func TestCheckOrphanedENI_HasRequesterID(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		State: "available", CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
		Raw: json.RawMessage(`{"requester_id": "amazon-elb"}`),
	}
	if finding := a.checkOrphanedENI(r, time.Now()); finding != nil {
		t.Fatal("expected nil for ENI with requester_id")
	}
}

func TestCheckOrphanedENI_InUse(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "in-use"}
	if finding := a.checkOrphanedENI(r, time.Now()); finding != nil {
		t.Fatal("expected nil for in-use ENI")
	}
}

func TestCheckUnusedSecurityGroup_NoDeps(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Dependencies.GetByTargetFn = func(_ context.Context, _ string) ([]*models.ResourceDependency, error) {
		return nil, nil
	}
	a := NewOrphanAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ID: "res-1", ResourceID: "sg-123", Name: "test-sg",
		Service: models.ServiceSecurityGroup,
		Raw:     json.RawMessage(`{"group_name": "test-sg"}`),
	}
	finding := a.checkUnusedSecurityGroup(context.Background(), r, time.Now())
	if finding == nil {
		t.Fatal("expected finding for unused SG")
	}
	if finding.Type != models.FindingUnusedSecurityGroup {
		t.Errorf("Type = %q", finding.Type)
	}
}

func TestCheckUnusedSecurityGroup_HasDeps(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Dependencies.GetByTargetFn = func(_ context.Context, _ string) ([]*models.ResourceDependency, error) {
		return []*models.ResourceDependency{{ID: "dep-1"}}, nil
	}
	a := NewOrphanAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ResourceID: "sg-123", Raw: json.RawMessage(`{"group_name": "test-sg"}`),
	}
	if finding := a.checkUnusedSecurityGroup(context.Background(), r, time.Now()); finding != nil {
		t.Fatal("expected nil for SG with dependencies")
	}
}

func TestCheckUnusedSecurityGroup_DefaultSG(t *testing.T) {
	st, _ := testutil.NewMockStore()
	a := NewOrphanAnalyzer(st, zerolog.Nop())

	r := &models.Resource{
		ResourceID: "sg-123", Raw: json.RawMessage(`{"group_name": "default"}`),
	}
	if finding := a.checkUnusedSecurityGroup(context.Background(), r, time.Now()); finding != nil {
		t.Fatal("expected nil for default SG")
	}
}

func TestCheckIdleNATGateway_Old(t *testing.T) {
	a := &OrphanAnalyzer{}
	now := time.Now()
	r := &models.Resource{
		ID: "res-1", State: "available",
		CreatedAt: now.Add(-30 * 24 * time.Hour),
		Raw:       json.RawMessage(`{}`),
	}
	finding := a.checkIdleNATGateway(r, now)
	if finding == nil {
		t.Fatal("expected finding")
	}
	if finding.Type != models.FindingIdleNATGateway {
		t.Errorf("Type = %q", finding.Type)
	}
}

func TestCheckIdleNATGateway_Recent(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{
		State: "available", CreatedAt: time.Now().Add(-2 * 24 * time.Hour),
		Raw: json.RawMessage(`{}`),
	}
	if finding := a.checkIdleNATGateway(r, time.Now()); finding != nil {
		t.Fatal("expected nil for recent NAT gateway")
	}
}

func TestCheckIdleNATGateway_NotAvailable(t *testing.T) {
	a := &OrphanAnalyzer{}
	r := &models.Resource{State: "deleting"}
	if finding := a.checkIdleNATGateway(r, time.Now()); finding != nil {
		t.Fatal("expected nil for non-available NAT gateway")
	}
}

func TestOrphanAnalyzer_Analyze(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	now := time.Now()

	mocks.Resources.GetByAccountIDFn = func(_ context.Context, _ string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceEBS, State: "unattached", CreatedAt: now.Add(-30 * 24 * time.Hour), Raw: json.RawMessage(`{}`)},
			{ID: "2", Service: models.ServiceEC2, State: "running", Raw: json.RawMessage(`{}`)},
			{ID: "3", Service: models.ServiceEIP, State: "unassociated", CreatedAt: now.Add(-10 * 24 * time.Hour)},
		}, nil
	}
	mocks.Dependencies.GetByTargetFn = func(_ context.Context, _ string) ([]*models.ResourceDependency, error) {
		return nil, nil
	}

	a := NewOrphanAnalyzer(st, zerolog.Nop())
	job := &models.AnalyzeJob{AccountID: testutil.TestAccountID, OrgID: testutil.TestOrgID}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings (EBS + EIP), got %d", len(findings))
	}

	// Verify OrgID and AWSAccountID are set
	for _, f := range findings {
		if f.OrgID != testutil.TestOrgID {
			t.Errorf("finding OrgID = %q, want %q", f.OrgID, testutil.TestOrgID)
		}
		if f.AWSAccountID != testutil.TestAccountID {
			t.Errorf("finding AWSAccountID = %q, want %q", f.AWSAccountID, testutil.TestAccountID)
		}
	}
}
