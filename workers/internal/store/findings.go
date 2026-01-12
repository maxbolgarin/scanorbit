package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type findingStore struct {
	db *DB
}

func newFindingStore(db *DB) *findingStore {
	return &findingStore{db: db}
}

// Upsert inserts or updates a finding.
// Uses ON CONFLICT to update existing findings of the same type for the same resource.
func (s *findingStore) Upsert(ctx context.Context, finding *models.Finding) error {
	finish := metrics.TrackDBQuery("upsert", "findings")

	// Generate ID if not set
	if finding.ID == "" {
		finding.ID = uuid.New().String()
	}

	// Marshal details to JSON
	detailsJSON, err := json.Marshal(finding.Details)
	if err != nil {
		finish("error")
		return fmt.Errorf("marshal details: %w", err)
	}

	// Use a different approach: try to find existing finding first
	// This handles the nullable resource_id/certificate_id columns
	var existingID string
	findQuery := `
		SELECT id FROM findings
		WHERE org_id = $1 AND aws_account_id = $2 AND type = $3
		AND (
			(resource_id IS NOT NULL AND resource_id = $4)
			OR (certificate_id IS NOT NULL AND certificate_id = $5)
			OR (resource_id IS NULL AND certificate_id IS NULL AND $4 IS NULL AND $5 IS NULL)
		)
		LIMIT 1
	`

	err = s.db.Pool().QueryRow(ctx, findQuery,
		finding.OrgID,
		finding.AWSAccountID,
		string(finding.Type),
		finding.ResourceID,
		finding.CertificateID,
	).Scan(&existingID)

	if err == nil {
		// Update existing finding
		updateQuery := `
			UPDATE findings
			SET severity = $2, summary = $3, details = $4, status = $5, updated_at = NOW()
			WHERE id = $1
		`
		_, err = s.db.Pool().Exec(ctx, updateQuery,
			existingID,
			string(finding.Severity),
			finding.Summary,
			detailsJSON,
			string(finding.Status),
		)
		if err != nil {
			finish("error")
			return fmt.Errorf("update finding: %w", err)
		}
		finding.ID = existingID
		finish("success")
		return nil
	}

	// Insert new finding
	insertQuery := `
		INSERT INTO findings (
			id, org_id, aws_account_id, resource_id, certificate_id,
			type, severity, summary, details, status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
	`

	_, err = s.db.Pool().Exec(ctx, insertQuery,
		finding.ID,
		finding.OrgID,
		finding.AWSAccountID,
		finding.ResourceID,
		finding.CertificateID,
		string(finding.Type),
		string(finding.Severity),
		finding.Summary,
		detailsJSON,
		string(finding.Status),
	)
	if err != nil {
		finish("error")
		return fmt.Errorf("insert finding: %w", err)
	}

	finish("success")
	return nil
}

// GetByAccountID retrieves all findings for an AWS account.
func (s *findingStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Finding, error) {
	finish := metrics.TrackDBQuery("select", "findings")

	query := `
		SELECT id, org_id, aws_account_id, resource_id, certificate_id,
		       type, severity, summary, details, status, created_at, updated_at
		FROM findings
		WHERE aws_account_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, accountID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query findings: %w", err)
	}
	defer rows.Close()

	var findings []*models.Finding
	for rows.Next() {
		var f models.Finding
		var detailsJSON []byte

		err := rows.Scan(
			&f.ID,
			&f.OrgID,
			&f.AWSAccountID,
			&f.ResourceID,
			&f.CertificateID,
			&f.Type,
			&f.Severity,
			&f.Summary,
			&detailsJSON,
			&f.Status,
			&f.CreatedAt,
			&f.UpdatedAt,
		)
		if err != nil {
			finish("error")
			return nil, fmt.Errorf("scan finding: %w", err)
		}

		// Unmarshal details
		if len(detailsJSON) > 0 {
			if err := json.Unmarshal(detailsJSON, &f.Details); err != nil {
				finish("error")
				return nil, fmt.Errorf("unmarshal details: %w", err)
			}
		}

		findings = append(findings, &f)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return findings, nil
}
