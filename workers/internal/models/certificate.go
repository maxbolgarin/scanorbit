package models

import "time"

// CertificateSource represents the source of a certificate.
type CertificateSource string

const (
	CertificateSourceACM          CertificateSource = "acm"
	CertificateSourceEndpointScan CertificateSource = "endpoint_scan"
)

// Certificate represents an SSL/TLS certificate.
type Certificate struct {
	ID            string
	OrgID         string
	AWSAccountID  string
	Identifier    string // ARN for ACM, fingerprint for endpoint scan
	Source        CertificateSource
	PrimaryDomain string
	AltNames      []string
	NotBefore     time.Time
	NotAfter      time.Time
	Issuer        string
	Algorithm     string
	LastSeenAt    time.Time
	CreatedAt     time.Time
}

// DaysUntilExpiry returns the number of days until the certificate expires.
func (c *Certificate) DaysUntilExpiry() float64 {
	return c.NotAfter.Sub(time.Now()).Hours() / 24
}

// IsExpired returns true if the certificate has expired.
func (c *Certificate) IsExpired() bool {
	return time.Now().After(c.NotAfter)
}

// NewCertificate creates a new Certificate with sensible defaults.
func NewCertificate(identifier string, source CertificateSource) *Certificate {
	return &Certificate{
		Identifier: identifier,
		Source:     source,
		AltNames:   make([]string, 0),
		LastSeenAt: time.Now(),
	}
}
