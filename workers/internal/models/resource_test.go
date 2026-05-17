package models

import (
	"testing"
)

func TestNewResource(t *testing.T) {
	r := NewResource("i-12345", ServiceEC2, "us-east-1")

	if r.ResourceID != "i-12345" {
		t.Errorf("ResourceID = %q, want %q", r.ResourceID, "i-12345")
	}
	if r.Service != ServiceEC2 {
		t.Errorf("Service = %q, want %q", r.Service, ServiceEC2)
	}
	if r.Region != "us-east-1" {
		t.Errorf("Region = %q, want %q", r.Region, "us-east-1")
	}
	if r.Tags == nil {
		t.Error("Tags should be initialized, got nil")
	}
	if r.LastSeenAt.IsZero() {
		t.Error("LastSeenAt should be set")
	}
}

func TestNewResourceDependency(t *testing.T) {
	dep := NewResourceDependency("src-1", "tgt-1", ServiceVPC, RelationshipInVPC)

	if dep.SourceResourceID != "src-1" {
		t.Errorf("SourceResourceID = %q, want %q", dep.SourceResourceID, "src-1")
	}
	if dep.TargetResourceID != "tgt-1" {
		t.Errorf("TargetResourceID = %q, want %q", dep.TargetResourceID, "tgt-1")
	}
	if dep.TargetService != ServiceVPC {
		t.Errorf("TargetService = %q, want %q", dep.TargetService, ServiceVPC)
	}
	if dep.RelationshipType != RelationshipInVPC {
		t.Errorf("RelationshipType = %q, want %q", dep.RelationshipType, RelationshipInVPC)
	}
}

func TestNewResourceScan(t *testing.T) {
	rs := NewResourceScan("res-1", "scan-1", ResourceScanStatusNew)

	if rs.ResourceID != "res-1" {
		t.Errorf("ResourceID = %q, want %q", rs.ResourceID, "res-1")
	}
	if rs.ScanID != "scan-1" {
		t.Errorf("ScanID = %q, want %q", rs.ScanID, "scan-1")
	}
	if rs.Status != ResourceScanStatusNew {
		t.Errorf("Status = %q, want %q", rs.Status, ResourceScanStatusNew)
	}
	if rs.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}
}
