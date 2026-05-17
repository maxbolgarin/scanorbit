package awsclient

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/acm"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// ACMScanner scans ACM certificate resources.
type ACMScanner struct {
	logger zerolog.Logger
}

// NewACMScanner creates a new ACM scanner.
func NewACMScanner(logger zerolog.Logger) *ACMScanner {
	return &ACMScanner{
		logger: logger.With().Str("scanner", "acm").Logger(),
	}
}

// ScanCertificates scans all ACM certificates in a region.
func (s *ACMScanner) ScanCertificates(ctx context.Context, cfg aws.Config, region string) ([]*models.Certificate, error) {
	svc := acm.NewFromConfig(cfg, func(o *acm.Options) {
		o.Region = region
	})

	var certs []*models.Certificate
	paginator := acm.NewListCertificatesPaginator(svc, &acm.ListCertificatesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("list certificates: %w", err)
		}

		for _, certSummary := range output.CertificateSummaryList {
			// Get detailed certificate info
			detail, err := svc.DescribeCertificate(ctx, &acm.DescribeCertificateInput{
				CertificateArn: certSummary.CertificateArn,
			})
			if err != nil {
				s.logger.Warn().Err(err).
					Str("arn", aws.ToString(certSummary.CertificateArn)).
					Msg("failed to describe certificate")
				continue
			}

			cert := detail.Certificate
			altNames := make([]string, 0)
			if cert.SubjectAlternativeNames != nil {
				altNames = cert.SubjectAlternativeNames
			}

			c := &models.Certificate{
				Identifier:    aws.ToString(cert.CertificateArn),
				Source:        models.CertificateSourceACM,
				PrimaryDomain: aws.ToString(cert.DomainName),
				AltNames:      altNames,
				Issuer:        aws.ToString(cert.Issuer),
				Algorithm:     string(cert.KeyAlgorithm),
			}

			if cert.NotBefore != nil {
				c.NotBefore = *cert.NotBefore
			}
			if cert.NotAfter != nil {
				c.NotAfter = *cert.NotAfter
			}

			certs = append(certs, c)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(certs)).Msg("scanned ACM certificates")
	return certs, nil
}
