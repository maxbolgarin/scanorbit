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

func TestCheckUserMFA_Disabled(t *testing.T) {
	a := &IAMAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "admin-user",
		Raw: json.RawMessage(`{"mfa_enabled": false}`),
	}
	findings := a.checkUserMFA(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUserWithoutMFA {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Severity != models.SeverityHigh {
		t.Errorf("Severity = %q, want high", findings[0].Severity)
	}
}

func TestCheckUserMFA_Enabled(t *testing.T) {
	a := &IAMAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"mfa_enabled": true}`)}
	if findings := a.checkUserMFA(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings")
	}
}

func TestCheckUserMFA_InvalidJSON(t *testing.T) {
	a := &IAMAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`invalid`)}
	if findings := a.checkUserMFA(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings for invalid JSON")
	}
}

func TestCheckAccessKey_OldKey(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "AKIATEST",
		State: "Active",
		Raw:   json.RawMessage(`{"create_date":"` + createDate + `","user_name":"admin","last_used_date":"` + now.Add(-1*24*time.Hour).Format(time.RFC3339) + `"}`),
	}
	findings := a.checkAccessKey(r, now)

	// Should have old key finding (120 days > 90)
	foundOld := false
	for _, f := range findings {
		if f.Type == models.FindingOldAccessKey {
			foundOld = true
			if f.Severity != models.SeverityMedium {
				t.Errorf("old key Severity = %q, want medium", f.Severity)
			}
		}
	}
	if !foundOld {
		t.Error("expected FindingOldAccessKey")
	}
}

func TestCheckAccessKey_NeverUsed(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-30 * 24 * time.Hour).Format(time.RFC3339) // 30 days old

	r := &models.Resource{
		ID: "res-1", Name: "AKIATEST", State: "Active",
		Raw: json.RawMessage(`{"create_date":"` + createDate + `","user_name":"admin"}`),
	}
	findings := a.checkAccessKey(r, now)

	foundUnused := false
	for _, f := range findings {
		if f.Type == models.FindingUnusedAccessKey {
			foundUnused = true
		}
	}
	if !foundUnused {
		t.Error("expected FindingUnusedAccessKey for never-used active key")
	}
}

func TestCheckAccessKey_NeverUsedNewKey(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-3 * 24 * time.Hour).Format(time.RFC3339) // 3 days old - grace period

	r := &models.Resource{
		ID: "res-1", Name: "AKIATEST", State: "Active",
		Raw: json.RawMessage(`{"create_date":"` + createDate + `","user_name":"admin"}`),
	}
	findings := a.checkAccessKey(r, now)

	for _, f := range findings {
		if f.Type == models.FindingUnusedAccessKey {
			t.Error("should not flag unused key within 7-day grace period")
		}
	}
}

func TestCheckAccessKey_LongUnused(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-200 * 24 * time.Hour).Format(time.RFC3339)
	lastUsed := now.Add(-100 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "AKIATEST", State: "Active",
		Raw: json.RawMessage(`{"create_date":"` + createDate + `","user_name":"admin","last_used_date":"` + lastUsed + `"}`),
	}
	findings := a.checkAccessKey(r, now)

	foundUnused := false
	for _, f := range findings {
		if f.Type == models.FindingUnusedAccessKey {
			foundUnused = true
		}
	}
	if !foundUnused {
		t.Error("expected FindingUnusedAccessKey for key unused 100 days")
	}
}

func TestCheckAccessKey_RecentlyUsed(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-30 * 24 * time.Hour).Format(time.RFC3339)
	lastUsed := now.Add(-5 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "AKIATEST", State: "Active",
		Raw: json.RawMessage(`{"create_date":"` + createDate + `","user_name":"admin","last_used_date":"` + lastUsed + `"}`),
	}
	findings := a.checkAccessKey(r, now)
	// Key is 30 days old (< 90) and used 5 days ago - no findings
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings for recently used key, got %d", len(findings))
	}
}

func TestCheckUnusedRole_NeverUsedOld(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "my-old-role",
		Raw: json.RawMessage(`{"create_date":"` + createDate + `","path":"/"}`),
	}
	findings := a.checkUnusedRole(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUnusedIAMRole {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckUnusedRole_NotUsedInLongTime(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	lastUsed := now.Add(-100 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		ID: "res-1", Name: "stale-role",
		Raw: json.RawMessage(`{"last_used_date":"` + lastUsed + `","path":"/"}`),
	}
	findings := a.checkUnusedRole(r, now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
}

func TestCheckUnusedRole_RecentlyUsed(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	lastUsed := now.Add(-10 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		Name: "active-role",
		Raw:  json.RawMessage(`{"last_used_date":"` + lastUsed + `","path":"/"}`),
	}
	if findings := a.checkUnusedRole(r, now); len(findings) != 0 {
		t.Fatalf("expected 0 findings for recently used role")
	}
}

func TestCheckUnusedRole_AWSManagedRole(t *testing.T) {
	a := &IAMAnalyzer{}
	r := &models.Resource{
		Name: "AWSServiceRoleForECS",
		Raw:  json.RawMessage(`{"path":"/"}`),
	}
	if findings := a.checkUnusedRole(r, time.Now()); len(findings) != 0 {
		t.Fatalf("expected 0 findings for AWS-managed role")
	}
}

func TestCheckUnusedRole_ServiceLinkedRole(t *testing.T) {
	a := &IAMAnalyzer{}
	now := time.Now()
	createDate := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	r := &models.Resource{
		Name: "ecs-service-role",
		Raw:  json.RawMessage(`{"create_date":"` + createDate + `","path":"/service-role/"}`),
	}
	if findings := a.checkUnusedRole(r, now); len(findings) != 0 {
		t.Fatalf("expected 0 findings for service-linked role")
	}
}

func TestIAMAnalyzer_Analyze(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	now := time.Now()
	oldCreate := now.Add(-120 * 24 * time.Hour).Format(time.RFC3339)

	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceIAMUser, Name: "no-mfa", Raw: json.RawMessage(`{"mfa_enabled": false}`)},
			{ID: "2", Service: models.ServiceIAMUser, Name: "has-mfa", Raw: json.RawMessage(`{"mfa_enabled": true}`)},
			{ID: "3", Service: models.ServiceIAMRole, Name: "old-role", Raw: json.RawMessage(`{"create_date":"` + oldCreate + `","path":"/"}`)},
		}, nil
	}

	a := NewIAMAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	// no-mfa user + unused old-role = 2
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}
}
