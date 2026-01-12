package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type certificateStore struct {
	db *DB
}

func newCertificateStore(db *DB) *certificateStore {
	return &certificateStore{db: db}
}

// Upsert inserts or updates a certificate.
func (s *certificateStore) Upsert(ctx context.Context, cert *models.Certificate) error {
	finish := metrics.TrackDBQuery("upsert", "certificates")

	// Generate ID if not set
	if cert.ID == "" {
		cert.ID = uuid.New().String()
	}

	// Marshal alt names to JSON
	altNamesJSON, err := json.Marshal(cert.AltNames)
	if err != nil {
		finish("error")
		return fmt.Errorf("marshal alt_names: %w", err)
	}

	query := `
		INSERT INTO certificates (
			id, org_id, aws_account_id, identifier, source, primary_domain,
			alt_names, not_before, not_after, issuer, algorithm,
			last_seen_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
		ON CONFLICT (org_id, aws_account_id, identifier)
		DO UPDATE SET
			primary_domain = EXCLUDED.primary_domain,
			alt_names = EXCLUDED.alt_names,
			not_before = EXCLUDED.not_before,
			not_after = EXCLUDED.not_after,
			issuer = EXCLUDED.issuer,
			algorithm = EXCLUDED.algorithm,
			last_seen_at = NOW(),
			updated_at = NOW()
	`

	_, err = s.db.Pool().Exec(ctx, query,
		cert.ID,
		cert.OrgID,
		cert.AWSAccountID,
		cert.Identifier,
		string(cert.Source),
		cert.PrimaryDomain,
		altNamesJSON,
		cert.NotBefore,
		cert.NotAfter,
		cert.Issuer,
		cert.Algorithm,
	)
	if err != nil {
		finish("error")
		return fmt.Errorf("upsert certificate: %w", err)
	}

	finish("success")
	return nil
}

// GetByAccountID retrieves all certificates for an AWS account.
func (s *certificateStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Certificate, error) {
	finish := metrics.TrackDBQuery("select", "certificates")

	query := `
		SELECT id, org_id, aws_account_id, identifier, source, primary_domain,
		       alt_names, not_before, not_after, issuer, algorithm, last_seen_at, created_at
		FROM certificates
		WHERE aws_account_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, accountID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query certificates: %w", err)
	}
	defer rows.Close()

	var certs []*models.Certificate
	for rows.Next() {
		var c models.Certificate
		var altNamesJSON []byte

		err := rows.Scan(
			&c.ID,
			&c.OrgID,
			&c.AWSAccountID,
			&c.Identifier,
			&c.Source,
			&c.PrimaryDomain,
			&altNamesJSON,
			&c.NotBefore,
			&c.NotAfter,
			&c.Issuer,
			&c.Algorithm,
			&c.LastSeenAt,
			&c.CreatedAt,
		)
		if err != nil {
			finish("error")
			return nil, fmt.Errorf("scan certificate: %w", err)
		}

		// Unmarshal alt names
		if len(altNamesJSON) > 0 {
			if err := json.Unmarshal(altNamesJSON, &c.AltNames); err != nil {
				finish("error")
				return nil, fmt.Errorf("unmarshal alt_names: %w", err)
			}
		}

		certs = append(certs, &c)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return certs, nil
}
