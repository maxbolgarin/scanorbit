package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type findingScanStore struct {
	db *DB
}

func newFindingScanStore(db *DB) *findingScanStore {
	return &findingScanStore{db: db}
}

// BulkUpsert inserts or updates multiple finding-scan records efficiently.
func (s *findingScanStore) BulkUpsert(ctx context.Context, records []*models.FindingScan) error {
	if len(records) == 0 {
		return nil
	}

	finish := metrics.TrackDBQuery("bulk_upsert", "finding_scans")

	return s.db.WithTx(ctx, func(tx Tx) error {
		query := `
			INSERT INTO finding_scans (id, finding_id, scan_id, status, created_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (finding_id, scan_id)
			DO UPDATE SET status = EXCLUDED.status
		`

		for _, rec := range records {
			if rec.ID == "" {
				rec.ID = uuid.New().String()
			}

			_, err := tx.Exec(ctx, query,
				rec.ID,
				rec.FindingID,
				rec.ScanID,
				string(rec.Status),
			)
			if err != nil {
				finish("error")
				return fmt.Errorf("insert finding_scan: %w", err)
			}
		}

		finish("success")
		return nil
	})
}

// MarkNotDetected inserts 'not_detected' records for open findings that were not detected in this scan.
// detectedFindingIDs contains the IDs of findings that WERE detected in the current scan.
func (s *findingScanStore) MarkNotDetected(ctx context.Context, scanID, accountID string, detectedFindingIDs []string) error {
	finish := metrics.TrackDBQuery("mark_not_detected", "finding_scans")

	// Insert 'not_detected' records for open findings that were not detected in this scan
	query := `
		INSERT INTO finding_scans (id, finding_id, scan_id, status, created_at)
		SELECT gen_random_uuid(), f.id, $1, 'not_detected', NOW()
		FROM findings f
		WHERE f.aws_account_id = $2
		  AND f.status = 'open'
		  AND f.id != ALL($3::uuid[])
		ON CONFLICT (finding_id, scan_id) DO NOTHING
	`

	_, err := s.db.Pool().Exec(ctx, query, scanID, accountID, detectedFindingIDs)
	if err != nil {
		finish("error")
		return fmt.Errorf("mark not detected findings: %w", err)
	}

	finish("success")
	return nil
}

// GetByScanID retrieves all finding-scan records for a specific scan.
func (s *findingScanStore) GetByScanID(ctx context.Context, scanID string) ([]*models.FindingScan, error) {
	finish := metrics.TrackDBQuery("select", "finding_scans")

	query := `
		SELECT id, finding_id, scan_id, status, created_at
		FROM finding_scans
		WHERE scan_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, scanID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query finding_scans: %w", err)
	}
	defer rows.Close()

	var records []*models.FindingScan //nolint:prealloc // rows count unknown
	for rows.Next() {
		var r models.FindingScan
		err := rows.Scan(&r.ID, &r.FindingID, &r.ScanID, &r.Status, &r.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan finding_scan: %w", err)
		}
		records = append(records, &r)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return records, nil
}

// GetByFindingID retrieves scan history for a specific finding.
func (s *findingScanStore) GetByFindingID(ctx context.Context, findingID string) ([]*models.FindingScan, error) {
	finish := metrics.TrackDBQuery("select", "finding_scans")

	query := `
		SELECT id, finding_id, scan_id, status, created_at
		FROM finding_scans
		WHERE finding_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.Pool().Query(ctx, query, findingID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query finding_scans: %w", err)
	}
	defer rows.Close()

	var records []*models.FindingScan //nolint:prealloc // rows count unknown
	for rows.Next() {
		var r models.FindingScan
		err := rows.Scan(&r.ID, &r.FindingID, &r.ScanID, &r.Status, &r.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan finding_scan: %w", err)
		}
		records = append(records, &r)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return records, nil
}
