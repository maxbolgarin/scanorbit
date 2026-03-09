package models

import (
	"testing"
)

func TestNewFinding(t *testing.T) {
	f := NewFinding(FindingOrphanedVolume, SeverityMedium, "Orphaned EBS volume")

	if f.Type != FindingOrphanedVolume {
		t.Errorf("Type = %q, want %q", f.Type, FindingOrphanedVolume)
	}
	if f.Severity != SeverityMedium {
		t.Errorf("Severity = %q, want %q", f.Severity, SeverityMedium)
	}
	if f.Summary != "Orphaned EBS volume" {
		t.Errorf("Summary = %q, want %q", f.Summary, "Orphaned EBS volume")
	}
	if f.Status != FindingStatusOpen {
		t.Errorf("Status = %q, want %q", f.Status, FindingStatusOpen)
	}
	if f.Details == nil {
		t.Error("Details should be initialized, got nil")
	}
}

func TestFinding_WithResource(t *testing.T) {
	f := NewFinding(FindingOrphanedVolume, SeverityMedium, "test").
		WithResource("res-123")

	if f.ResourceID == nil || *f.ResourceID != "res-123" {
		t.Errorf("ResourceID = %v, want %q", f.ResourceID, "res-123")
	}
}

func TestFinding_WithCertificate(t *testing.T) {
	f := NewFinding(FindingSSLExpiry, SeverityCritical, "test").
		WithCertificate("cert-123")

	if f.CertificateID == nil || *f.CertificateID != "cert-123" {
		t.Errorf("CertificateID = %v, want %q", f.CertificateID, "cert-123")
	}
}

func TestFinding_AddDetail(t *testing.T) {
	f := NewFinding(FindingOrphanedVolume, SeverityMedium, "test").
		AddDetail("key1", "value1").
		AddDetail("key2", 42)

	if f.Details["key1"] != "value1" {
		t.Errorf("Details[key1] = %v, want %q", f.Details["key1"], "value1")
	}
	if f.Details["key2"] != 42 {
		t.Errorf("Details[key2] = %v, want %d", f.Details["key2"], 42)
	}
}

func TestNewFindingScan(t *testing.T) {
	fs := NewFindingScan("finding-1", "scan-1", FindingScanDetected)

	if fs.FindingID != "finding-1" {
		t.Errorf("FindingID = %q, want %q", fs.FindingID, "finding-1")
	}
	if fs.ScanID != "scan-1" {
		t.Errorf("ScanID = %q, want %q", fs.ScanID, "scan-1")
	}
	if fs.Status != FindingScanDetected {
		t.Errorf("Status = %q, want %q", fs.Status, FindingScanDetected)
	}
}
