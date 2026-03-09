package analyzers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

func TestCheckEBSEncryption_Unencrypted(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceEBS, Name: "vol-test",
		Raw: json.RawMessage(`{"encrypted": false}`),
	}
	findings := a.checkEBSEncryption(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingUnencryptedResource {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Severity != models.SeverityMedium {
		t.Errorf("Severity = %q, want medium", findings[0].Severity)
	}
}

func TestCheckEBSEncryption_Encrypted(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"encrypted": true}`)}
	if findings := a.checkEBSEncryption(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(findings))
	}
}

func TestCheckEBSEncryption_InvalidJSON(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`invalid`)}
	if findings := a.checkEBSEncryption(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings for invalid JSON")
	}
}

func TestCheckRDSEncryption_Unencrypted(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "mydb",
		Raw: json.RawMessage(`{"storage_encrypted": false, "engine": "postgres"}`),
	}
	findings := a.checkRDSEncryption(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != models.SeverityHigh {
		t.Errorf("Severity = %q, want high", findings[0].Severity)
	}
}

func TestCheckRDSEncryption_Encrypted(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{"storage_encrypted": true}`)}
	if findings := a.checkRDSEncryption(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings")
	}
}

func TestCheckS3PublicAccess_AllBlocked(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{
		"public_access_block": {
			"block_public_acls": true,
			"ignore_public_acls": true,
			"block_public_policy": true,
			"restrict_public_buckets": true
		}
	}`)}
	if findings := a.checkS3PublicAccess(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings for fully blocked bucket")
	}
}

func TestCheckS3PublicAccess_PartiallyOpen(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "my-bucket",
		Raw: json.RawMessage(`{
			"public_access_block": {
				"block_public_acls": false,
				"ignore_public_acls": true,
				"block_public_policy": true,
				"restrict_public_buckets": true
			}
		}`),
	}
	findings := a.checkS3PublicAccess(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingPublicAccess {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Severity != models.SeverityHigh {
		t.Errorf("Severity = %q, want high", findings[0].Severity)
	}
}

func TestCheckS3PublicAccess_NoBlock(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{}`)}
	if findings := a.checkS3PublicAccess(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings when no public_access_block")
	}
}

func TestCheckSecurityGroup_AllPortsOpen(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "sg-test",
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "-1",
				"from_port": 0,
				"to_port": 65535,
				"cidr_blocks": ["0.0.0.0/0"]
			}]
		}`),
	}
	findings := a.checkSecurityGroup(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingOpenAllPorts {
		t.Errorf("Type = %q, want open_all_ports", findings[0].Type)
	}
}

func TestCheckSecurityGroup_AllPortsViaRange(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "sg-test",
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "tcp",
				"from_port": 0,
				"to_port": 65535,
				"cidr_blocks": ["0.0.0.0/0"]
			}]
		}`),
	}
	findings := a.checkSecurityGroup(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingOpenAllPorts {
		t.Errorf("Type = %q", findings[0].Type)
	}
}

func TestCheckSecurityGroup_SSHOpenToWorld(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "sg-test",
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "tcp",
				"from_port": 22,
				"to_port": 22,
				"cidr_blocks": ["0.0.0.0/0"]
			}]
		}`),
	}
	findings := a.checkSecurityGroup(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Type != models.FindingPermissiveSG {
		t.Errorf("Type = %q", findings[0].Type)
	}
	if findings[0].Details["exposed_service"] != "SSH" {
		t.Errorf("exposed_service = %v, want SSH", findings[0].Details["exposed_service"])
	}
}

func TestCheckSecurityGroup_IPv6Open(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "sg-test",
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "tcp",
				"from_port": 3389,
				"to_port": 3389,
				"ipv6_blocks": ["::/0"]
			}]
		}`),
	}
	findings := a.checkSecurityGroup(r)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding for IPv6 open RDP, got %d", len(findings))
	}
	if findings[0].Details["exposed_service"] != "RDP" {
		t.Errorf("exposed_service = %v, want RDP", findings[0].Details["exposed_service"])
	}
}

func TestCheckSecurityGroup_InternalOnly(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "tcp",
				"from_port": 22,
				"to_port": 22,
				"cidr_blocks": ["10.0.0.0/8"]
			}]
		}`),
	}
	if findings := a.checkSecurityGroup(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings for internal-only CIDR, got %d", len(findings))
	}
}

func TestCheckSecurityGroup_PortRange(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{
		ID: "res-1", Name: "sg-test",
		Raw: json.RawMessage(`{
			"ingress_rules": [{
				"protocol": "tcp",
				"from_port": 3300,
				"to_port": 3400,
				"cidr_blocks": ["0.0.0.0/0"]
			}]
		}`),
	}
	findings := a.checkSecurityGroup(r)
	// Port range 3300-3400 includes MySQL (3306) and MSSQL (1433 is outside)
	found := false
	for _, f := range findings {
		if f.Details["exposed_service"] == "MySQL" {
			found = true
		}
	}
	if !found {
		t.Error("expected MySQL finding for port range 3300-3400")
	}
}

func TestCheckSecurityGroup_NoIngressRules(t *testing.T) {
	a := &SecurityAnalyzer{}
	r := &models.Resource{Raw: json.RawMessage(`{}`)}
	if findings := a.checkSecurityGroup(r); len(findings) != 0 {
		t.Fatalf("expected 0 findings for no ingress rules")
	}
}

func TestSecurityAnalyzer_Analyze(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Resources.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Resource, error) {
		return []*models.Resource{
			{ID: "1", Service: models.ServiceEBS, Raw: json.RawMessage(`{"encrypted": false}`)},
			{ID: "2", Service: models.ServiceEBS, Raw: json.RawMessage(`{"encrypted": true}`)},
			{ID: "3", Service: models.ServiceS3, Raw: json.RawMessage(`{
				"public_access_block": {
					"block_public_acls": false,
					"ignore_public_acls": true,
					"block_public_policy": true,
					"restrict_public_buckets": true
				}
			}`)},
		}, nil
	}

	a := NewSecurityAnalyzer(st, zerolog.Nop())
	job := &models.AnalyzeJob{AccountID: testutil.TestAccountID, OrgID: testutil.TestOrgID}

	findings, err := a.Analyze(context.Background(), job)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 1 unencrypted EBS + 1 public S3 = 2 findings
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}
}

func TestGetBoolValue(t *testing.T) {
	m := map[string]any{"a": true, "b": "not-bool"}
	if !getBoolValue(m, "a") {
		t.Error("expected true")
	}
	if getBoolValue(m, "b") {
		t.Error("expected false for non-bool")
	}
	if getBoolValue(m, "missing") {
		t.Error("expected false for missing key")
	}
}

func TestGetStringValue(t *testing.T) {
	m := map[string]any{"a": "hello", "b": 42}
	if v := getStringValue(m, "a"); v != "hello" {
		t.Errorf("got %q", v)
	}
	if v := getStringValue(m, "b"); v != "" {
		t.Errorf("expected empty for non-string, got %q", v)
	}
}

func TestGetInt32Value(t *testing.T) {
	m := map[string]any{"a": float64(22), "b": "nope"}
	if v := getInt32Value(m, "a"); v != 22 {
		t.Errorf("got %d", v)
	}
	if v := getInt32Value(m, "b"); v != 0 {
		t.Errorf("expected 0 for non-float, got %d", v)
	}
}

func TestGetStringSlice(t *testing.T) {
	m := map[string]any{
		"a": []any{"x", "y"},
		"b": "not-slice",
	}
	if v := getStringSlice(m, "a"); len(v) != 2 || v[0] != "x" {
		t.Errorf("got %v", v)
	}
	if v := getStringSlice(m, "b"); v != nil {
		t.Errorf("expected nil for non-slice, got %v", v)
	}
}
