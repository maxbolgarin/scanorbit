package testutil

import (
	"encoding/json"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// Test UUID constants
const (
	TestAccountID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	TestOrgID     = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
	TestScanID    = "c3d4e5f6-a7b8-9012-cdef-123456789012"
	TestJobID     = "d4e5f6a7-b8c9-0123-defa-234567890123"
)

// MakeResource creates a test resource with the given parameters.
func MakeResource(service models.ServiceType, state string, raw json.RawMessage) *models.Resource {
	return &models.Resource{
		ID:           "res-" + string(service) + "-1",
		OrgID:        TestOrgID,
		AWSAccountID: TestAccountID,
		ResourceID:   "aws-" + string(service) + "-12345",
		Service:      service,
		Region:       "us-east-1",
		Name:         string(service) + "-test",
		State:        state,
		Tags:         make(map[string]string),
		Raw:          raw,
		CreatedAt:    time.Now().Add(-30 * 24 * time.Hour),
		LastSeenAt:   time.Now(),
	}
}

// MakeResourceWithAge creates a test resource created at a specific time ago.
func MakeResourceWithAge(service models.ServiceType, state string, age time.Duration, raw json.RawMessage) *models.Resource {
	r := MakeResource(service, state, raw)
	r.CreatedAt = time.Now().Add(-age)
	return r
}

// MakeAnalyzeJob creates a valid test AnalyzeJob.
func MakeAnalyzeJob() *models.AnalyzeJob {
	return &models.AnalyzeJob{
		JobID:     TestJobID,
		ScanID:    TestScanID,
		AccountID: TestAccountID,
		OrgID:     TestOrgID,
	}
}

// MakeScanAccountJob creates a valid test ScanAccountJob.
func MakeScanAccountJob() *models.ScanAccountJob {
	return &models.ScanAccountJob{
		JobID:     TestJobID,
		ScanID:    TestScanID,
		AccountID: TestAccountID,
		OrgID:     TestOrgID,
	}
}

// MakeCertificate creates a test certificate expiring in the given number of days.
func MakeCertificate(daysUntilExpiry int, source models.CertificateSource) *models.Certificate {
	return &models.Certificate{
		ID:            "cert-1",
		OrgID:         TestOrgID,
		AWSAccountID:  TestAccountID,
		Identifier:    "arn:aws:acm:us-east-1:123456789012:certificate/test",
		Source:        source,
		PrimaryDomain: "example.com",
		AltNames:      []string{"www.example.com"},
		NotBefore:     time.Now().Add(-365 * 24 * time.Hour),
		NotAfter:      time.Now().Add(time.Duration(daysUntilExpiry) * 24 * time.Hour),
		Issuer:        "Amazon",
		Algorithm:     "RSA-2048",
		LastSeenAt:    time.Now(),
		CreatedAt:     time.Now(),
	}
}

// RawJSON is a helper to create json.RawMessage from a map.
func RawJSON(m map[string]any) json.RawMessage {
	b, _ := json.Marshal(m)
	return b
}
