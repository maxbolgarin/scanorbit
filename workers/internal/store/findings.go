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
// Uses a transaction with SELECT FOR UPDATE to prevent race conditions.
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

	err = s.db.WithTx(ctx, func(tx Tx) error {
		// Find existing finding with row lock to prevent race conditions
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
			FOR UPDATE
		`

		err := tx.QueryRow(ctx, findQuery,
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
			_, err = tx.Exec(ctx, updateQuery,
				existingID,
				string(finding.Severity),
				finding.Summary,
				detailsJSON,
				string(finding.Status),
			)
			if err != nil {
				return fmt.Errorf("update finding: %w", err)
			}
			finding.ID = existingID
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

		_, err = tx.Exec(ctx, insertQuery,
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
			return fmt.Errorf("insert finding: %w", err)
		}

		return nil
	})

	if err != nil {
		finish("error")
		return err
	}

	finish("success")
	return nil
}

// UpsertWithHistory inserts or updates a finding with lifecycle tracking.
// Returns the finding ID and whether it was a new finding.
func (s *findingStore) UpsertWithHistory(ctx context.Context, finding *models.Finding, scanID string) (findingID string, isNew bool, err error) {
	finish := metrics.TrackDBQuery("upsert_with_history", "findings")

	// Generate ID if not set
	if finding.ID == "" {
		finding.ID = uuid.New().String()
	}

	// Marshal details to JSON
	detailsJSON, err := json.Marshal(finding.Details)
	if err != nil {
		finish("error")
		return "", false, fmt.Errorf("marshal details: %w", err)
	}

	err = s.db.WithTx(ctx, func(tx Tx) error {
		// Find existing finding with row lock to prevent race conditions
		var existingID string
		var existingDetectionCount int
		findQuery := `
			SELECT id, detection_count FROM findings
			WHERE org_id = $1 AND aws_account_id = $2 AND type = $3
			AND (
				(resource_id IS NOT NULL AND resource_id = $4)
				OR (certificate_id IS NOT NULL AND certificate_id = $5)
				OR (resource_id IS NULL AND certificate_id IS NULL AND $4 IS NULL AND $5 IS NULL)
			)
			LIMIT 1
			FOR UPDATE
		`

		err := tx.QueryRow(ctx, findQuery,
			finding.OrgID,
			finding.AWSAccountID,
			string(finding.Type),
			finding.ResourceID,
			finding.CertificateID,
		).Scan(&existingID, &existingDetectionCount)

		if err == nil {
			// Update existing finding - re-open if was resolved, increment detection count
			updateQuery := `
				UPDATE findings
				SET severity = $2, summary = $3, details = $4,
				    status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
				    last_detected_at = NOW(),
				    detection_count = $5,
				    last_scan_id = $6,
				    resolved_at = CASE WHEN status = 'resolved' THEN NULL ELSE resolved_at END,
				    updated_at = NOW()
				WHERE id = $1
			`
			_, err = tx.Exec(ctx, updateQuery,
				existingID,
				string(finding.Severity),
				finding.Summary,
				detailsJSON,
				existingDetectionCount+1,
				scanID,
			)
			if err != nil {
				return fmt.Errorf("update finding: %w", err)
			}
			findingID = existingID
			isNew = false
			return nil
		}

		// Insert new finding
		insertQuery := `
			INSERT INTO findings (
				id, org_id, aws_account_id, resource_id, certificate_id,
				type, severity, summary, details, status,
				first_detected_at, last_detected_at, detection_count, last_scan_id,
				created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), 1, $11, NOW(), NOW())
		`

		_, err = tx.Exec(ctx, insertQuery,
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
			scanID,
		)
		if err != nil {
			return fmt.Errorf("insert finding: %w", err)
		}

		findingID = finding.ID
		isNew = true
		return nil
	})

	if err != nil {
		finish("error")
		return "", false, err
	}

	finish("success")
	return findingID, isNew, nil
}

// AutoResolveMissingFindings marks open findings as resolved if they were not detected in this scan.
// Uses the detectedFindingIDs list to determine which findings to preserve.
// Returns the number of findings that were auto-resolved.
func (s *findingStore) AutoResolveMissingFindings(ctx context.Context, _, accountID string, detectedFindingIDs []string) (int64, error) {
	finish := metrics.TrackDBQuery("auto_resolve", "findings")

	query := `
		UPDATE findings
		SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		WHERE aws_account_id = $1
		  AND status = 'open'
		  AND id != ALL($2::uuid[])
	`
	result, err := s.db.Pool().Exec(ctx, query, accountID, detectedFindingIDs)
	if err != nil {
		finish("error")
		return 0, fmt.Errorf("auto resolve findings: %w", err)
	}

	finish("success")
	return result.RowsAffected(), nil
}

// AutoResolveByScanID marks open findings as resolved if they were not detected in this scan.
// Uses the last_scan_id field to determine which findings to resolve.
// Only auto-resolves findings whose type was actively analyzed in this scan
// (i.e., at least one finding of that type appears in finding_scans for this scan).
// This prevents resolving findings from disabled analyzers that didn't run.
// Returns the number of findings that were auto-resolved.
func (s *findingStore) AutoResolveByScanID(ctx context.Context, scanID, accountID string) (int64, error) {
	finish := metrics.TrackDBQuery("auto_resolve_by_scan", "findings")

	query := `
		UPDATE findings
		SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		WHERE aws_account_id = $1
		  AND status = 'open'
		  AND (last_scan_id IS NULL OR last_scan_id != $2)
		  AND type IN (
		    SELECT DISTINCT f.type
		    FROM findings f
		    INNER JOIN finding_scans fs ON fs.finding_id = f.id
		    WHERE fs.scan_id = $2
		  )
	`
	result, err := s.db.Pool().Exec(ctx, query, accountID, scanID)
	if err != nil {
		finish("error")
		return 0, fmt.Errorf("auto resolve findings by scan: %w", err)
	}

	finish("success")
	return result.RowsAffected(), nil
}

// GetByAccountID retrieves all findings for an AWS account.
func (s *findingStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Finding, error) {
	finish := metrics.TrackDBQuery("select", "findings")

	query := `
		SELECT id, org_id, aws_account_id, resource_id, certificate_id,
		       type, severity, summary, details, status,
		       first_detected_at, last_detected_at, detection_count, last_scan_id,
		       created_at, updated_at
		FROM findings
		WHERE aws_account_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, accountID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query findings: %w", err)
	}
	defer rows.Close()

	var findings []*models.Finding //nolint:prealloc // rows count unknown
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
			&f.FirstDetectedAt,
			&f.LastDetectedAt,
			&f.DetectionCount,
			&f.LastScanID,
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
