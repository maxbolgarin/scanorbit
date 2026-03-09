package analyzers

import (
	"context"
	"testing"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/rs/zerolog"
)

func TestSSLAnalyzer_Expired(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			testutil.MakeCertificate(-5, models.CertificateSourceACM), // expired 5 days ago
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != models.SeverityCritical {
		t.Errorf("Severity = %q, want critical", findings[0].Severity)
	}
}

func TestSSLAnalyzer_Under7Days(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			testutil.MakeCertificate(3, models.CertificateSourceACM),
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != models.SeverityCritical {
		t.Errorf("Severity = %q, want critical", findings[0].Severity)
	}
}

func TestSSLAnalyzer_Under30Days(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			testutil.MakeCertificate(20, models.CertificateSourceEndpointScan),
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != models.SeverityMedium {
		t.Errorf("Severity = %q, want medium", findings[0].Severity)
	}
}

func TestSSLAnalyzer_Under60Days(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			testutil.MakeCertificate(45, models.CertificateSourceACM),
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != models.SeverityLow {
		t.Errorf("Severity = %q, want low", findings[0].Severity)
	}
}

func TestSSLAnalyzer_Over60Days(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			testutil.MakeCertificate(90, models.CertificateSourceACM),
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings for cert > 60 days out, got %d", len(findings))
	}
}

func TestSSLAnalyzer_NoCerts(t *testing.T) {
	st, _ := testutil.NewMockStore()
	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(findings))
	}
}

func TestSSLAnalyzer_GetRecommendation(t *testing.T) {
	a := &SSLAnalyzer{}

	tests := []struct {
		name      string
		source    models.CertificateSource
		daysLeft  float64
		wantMatch string
	}{
		{"ACM expired", models.CertificateSourceACM, -1, "URGENT"},
		{"endpoint expired", models.CertificateSourceEndpointScan, -1, "URGENT"},
		{"ACM < 7 days", models.CertificateSourceACM, 3, "URGENT"},
		{"ACM > 7 days", models.CertificateSourceACM, 20, "auto-renew"},
		{"endpoint < 7 days", models.CertificateSourceEndpointScan, 3, "URGENT"},
		{"endpoint > 7 days", models.CertificateSourceEndpointScan, 20, "Plan certificate renewal"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := a.getRecommendation(tt.source, tt.daysLeft)
			if len(got) == 0 {
				t.Fatal("expected non-empty recommendation")
			}
		})
	}
}

func TestSSLAnalyzer_MultipleCerts(t *testing.T) {
	st, mocks := testutil.NewMockStore()
	now := time.Now()
	mocks.Certificates.GetByAccountIDFn = func(ctx context.Context, accountID string) ([]*models.Certificate, error) {
		return []*models.Certificate{
			{ID: "cert-1", PrimaryDomain: "expired.com", NotAfter: now.Add(-1 * 24 * time.Hour), Source: models.CertificateSourceACM},
			{ID: "cert-2", PrimaryDomain: "fine.com", NotAfter: now.Add(120 * 24 * time.Hour), Source: models.CertificateSourceACM},
			{ID: "cert-3", PrimaryDomain: "soon.com", NotAfter: now.Add(15 * 24 * time.Hour), Source: models.CertificateSourceEndpointScan},
		}, nil
	}

	a := NewSSLAnalyzer(st, zerolog.Nop())
	findings, err := a.Analyze(context.Background(), testutil.MakeAnalyzeJob())
	if err != nil {
		t.Fatal(err)
	}
	// expired.com (critical) + soon.com (medium) = 2, fine.com is > 60 days
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}
}
