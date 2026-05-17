package models

import (
	"strings"
	"testing"
)

func TestScanAccountJob_Validate(t *testing.T) {
	validUUID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

	tests := []struct {
		name    string
		job     ScanAccountJob
		wantErr string
	}{
		{
			name: "valid job",
			job:  ScanAccountJob{AccountID: validUUID, OrgID: validUUID},
		},
		{
			name: "valid with all fields",
			job: ScanAccountJob{
				JobID: validUUID, ScanID: validUUID,
				AccountID: validUUID, OrgID: validUUID,
				EnabledScanners: []string{"ec2", "rds"},
			},
		},
		{
			name:    "empty account_id",
			job:     ScanAccountJob{OrgID: validUUID},
			wantErr: "account_id is required",
		},
		{
			name:    "invalid account_id UUID",
			job:     ScanAccountJob{AccountID: "not-a-uuid", OrgID: validUUID},
			wantErr: "account_id must be a valid UUID",
		},
		{
			name:    "empty org_id",
			job:     ScanAccountJob{AccountID: validUUID},
			wantErr: "org_id is required",
		},
		{
			name:    "invalid org_id UUID",
			job:     ScanAccountJob{AccountID: validUUID, OrgID: "bad"},
			wantErr: "org_id must be a valid UUID",
		},
		{
			name:    "invalid job_id UUID",
			job:     ScanAccountJob{AccountID: validUUID, OrgID: validUUID, JobID: "bad"},
			wantErr: "job_id must be a valid UUID",
		},
		{
			name:    "invalid scan_id UUID",
			job:     ScanAccountJob{AccountID: validUUID, OrgID: validUUID, ScanID: "bad"},
			wantErr: "scan_id must be a valid UUID",
		},
		{
			name: "invalid scanner type",
			job: ScanAccountJob{
				AccountID: validUUID, OrgID: validUUID,
				EnabledScanners: []string{"ec2", "fake"},
			},
			wantErr: "invalid scanner type: fake",
		},
		{
			name: "too many scanners",
			job: ScanAccountJob{
				AccountID: validUUID, OrgID: validUUID,
				EnabledScanners: make([]string, MaxEnabledScanners+1),
			},
			wantErr: "enabled_scanners cannot exceed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.job.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got: %v", tt.wantErr, err)
			}
		})
	}
}

func TestScanAccountJob_IsScannerEnabled(t *testing.T) {
	tests := []struct {
		name     string
		scanners []string
		check    string
		want     bool
	}{
		{"empty list enables all", nil, "ec2", true},
		{"scanner in list", []string{"ec2", "rds"}, "ec2", true},
		{"scanner not in list", []string{"ec2"}, "rds", false},
		{"empty string check with empty list", nil, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := &ScanAccountJob{EnabledScanners: tt.scanners}
			if got := job.IsScannerEnabled(tt.check); got != tt.want {
				t.Fatalf("IsScannerEnabled(%q) = %v, want %v", tt.check, got, tt.want)
			}
		})
	}
}

func TestAnalyzeJob_Validate(t *testing.T) {
	validUUID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

	tests := []struct {
		name    string
		job     AnalyzeJob
		wantErr string
	}{
		{
			name: "valid job",
			job:  AnalyzeJob{AccountID: validUUID, OrgID: validUUID},
		},
		{
			name: "valid with policy",
			job: AnalyzeJob{
				AccountID: validUUID, OrgID: validUUID,
				Policy: &ResidencyPolicy{AllowedRegions: []string{"eu-west-1"}},
			},
		},
		{
			name:    "empty account_id",
			job:     AnalyzeJob{OrgID: validUUID},
			wantErr: "account_id is required",
		},
		{
			name:    "invalid account_id",
			job:     AnalyzeJob{AccountID: "bad", OrgID: validUUID},
			wantErr: "account_id must be a valid UUID",
		},
		{
			name:    "empty org_id",
			job:     AnalyzeJob{AccountID: validUUID},
			wantErr: "org_id is required",
		},
		{
			name:    "invalid org_id",
			job:     AnalyzeJob{AccountID: validUUID, OrgID: "bad"},
			wantErr: "org_id must be a valid UUID",
		},
		{
			name: "too many allowed regions",
			job: AnalyzeJob{
				AccountID: validUUID, OrgID: validUUID,
				Policy: &ResidencyPolicy{AllowedRegions: make([]string, 51)},
			},
			wantErr: "allowed_regions cannot exceed 50",
		},
		{
			name: "too many required tags",
			job: AnalyzeJob{
				AccountID: validUUID, OrgID: validUUID,
				RequiredTags: make([]string, 101),
			},
			wantErr: "required_tags cannot exceed 100",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.job.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got: %v", tt.wantErr, err)
			}
		})
	}
}

func TestScanStatus_IsActive(t *testing.T) {
	active := []ScanStatus{ScanStatusQueued, ScanStatusProcessing, ScanStatusRunning, ScanStatusAnalyzingPending, ScanStatusAnalyzing}
	inactive := []ScanStatus{ScanStatusComplete, ScanStatusPartial, ScanStatusError, ScanStatusCanceled}

	for _, s := range active {
		if !s.IsActive() {
			t.Errorf("%q should be active", s)
		}
	}
	for _, s := range inactive {
		if s.IsActive() {
			t.Errorf("%q should not be active", s)
		}
	}
}

func TestScanStatus_IsTerminal(t *testing.T) {
	terminal := []ScanStatus{ScanStatusComplete, ScanStatusPartial, ScanStatusError, ScanStatusCanceled}
	nonTerminal := []ScanStatus{ScanStatusQueued, ScanStatusProcessing, ScanStatusRunning, ScanStatusAnalyzingPending, ScanStatusAnalyzing}

	for _, s := range terminal {
		if !s.IsTerminal() {
			t.Errorf("%q should be terminal", s)
		}
	}
	for _, s := range nonTerminal {
		if s.IsTerminal() {
			t.Errorf("%q should not be terminal", s)
		}
	}
}
