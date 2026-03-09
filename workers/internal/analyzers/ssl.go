package analyzers

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	sslHighSeverityDays   = 7  // < 7 days = high
	sslMediumSeverityDays = 30 // < 30 days = medium
	sslLowSeverityDays    = 60 // < 60 days = low
)

// SSLAnalyzer detects SSL certificate expiration issues.
type SSLAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewSSLAnalyzer creates a new SSLAnalyzer.
func NewSSLAnalyzer(st *store.Store, logger zerolog.Logger) *SSLAnalyzer {
	return &SSLAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "ssl").Logger(),
	}
}

// Name returns the analyzer name.
func (a *SSLAnalyzer) Name() string {
	return "ssl"
}

// Analyze checks certificate expiration.
func (a *SSLAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting SSL analysis")

	certs, err := a.store.Certificates.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get certificates: %w", err)
	}

	findings := make([]*models.Finding, 0, len(certs))
	now := time.Now()

	for _, cert := range certs {
		daysUntilExpiry := cert.NotAfter.Sub(now).Hours() / 24

		var severity models.FindingSeverity
		switch {
		case daysUntilExpiry < 0:
			// Already expired - CRITICAL
			severity = models.SeverityCritical
		case daysUntilExpiry < sslHighSeverityDays:
			// < 7 days - CRITICAL
			severity = models.SeverityCritical
		case daysUntilExpiry < sslMediumSeverityDays:
			severity = models.SeverityMedium
		case daysUntilExpiry < sslLowSeverityDays:
			severity = models.SeverityLow
		default:
			// Certificate is fine, no finding needed
			continue
		}

		var summary string
		if daysUntilExpiry < 0 {
			summary = fmt.Sprintf("SSL certificate for %s has EXPIRED", cert.PrimaryDomain)
		} else {
			summary = fmt.Sprintf("SSL certificate for %s expires in %d days", cert.PrimaryDomain, int(daysUntilExpiry))
		}

		certID := cert.ID
		finding := &models.Finding{
			ID:            uuid.New().String(),
			OrgID:         job.OrgID,
			AWSAccountID:  job.AccountID,
			CertificateID: &certID,
			Type:          models.FindingSSLExpiry,
			Severity:      severity,
			Summary:       summary,
			Details: map[string]any{
				"domain":     cert.PrimaryDomain,
				"alt_names":  cert.AltNames,
				"expires_at": cert.NotAfter.Format(time.RFC3339),
				"days_left":  int(daysUntilExpiry),
				"issuer":     cert.Issuer,
				"source":     string(cert.Source),
				"identifier": cert.Identifier,
				"algorithm":  cert.Algorithm,
				"action":     a.getRecommendation(cert.Source, daysUntilExpiry),
				"doc_url":    "https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html",
			},
			Status: models.FindingStatusOpen,
		}

		findings = append(findings, finding)
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Int("findings", len(findings)).
		Msg("SSL analysis completed")

	return findings, nil
}

// getRecommendation returns the appropriate action based on certificate source.
func (a *SSLAnalyzer) getRecommendation(source models.CertificateSource, daysLeft float64) string {
	if daysLeft < 0 {
		if source == models.CertificateSourceACM {
			return "URGENT: Certificate has expired. Check ACM for renewal status or re-validate domain ownership"
		}
		return "URGENT: Certificate has expired. Renew immediately to prevent service disruption"
	}

	if source == models.CertificateSourceACM {
		if daysLeft < 7 {
			return "URGENT: ACM certificate expiring soon. Check if auto-renewal is working and domain validation is still valid"
		}
		return "ACM certificates typically auto-renew. Verify domain validation is working"
	}

	if daysLeft < 7 {
		return "URGENT: Renew this certificate immediately to prevent service disruption"
	}
	return "Plan certificate renewal before expiration"
}
