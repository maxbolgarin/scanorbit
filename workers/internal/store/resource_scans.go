package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type resourceScanStore struct {
	db *DB
}

func newResourceScanStore(db *DB) *resourceScanStore {
	return &resourceScanStore{db: db}
}

// BulkUpsert inserts or updates multiple resource-scan records efficiently.
func (s *resourceScanStore) BulkUpsert(ctx context.Context, records []*models.ResourceScan) error {
	if len(records) == 0 {
		return nil
	}

	finish := metrics.TrackDBQuery("bulk_upsert", "resource_scans")

	return s.db.WithTx(ctx, func(tx Tx) error {
		query := `
			INSERT INTO resource_scans (id, resource_id, scan_id, status, created_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (resource_id, scan_id)
			DO UPDATE SET status = EXCLUDED.status
		`

		for _, rec := range records {
			if rec.ID == "" {
				rec.ID = uuid.New().String()
			}

			_, err := tx.Exec(ctx, query,
				rec.ID,
				rec.ResourceID,
				rec.ScanID,
				string(rec.Status),
			)
			if err != nil {
				finish("error")
				return fmt.Errorf("insert resource_scan: %w", err)
			}
		}

		finish("success")
		return nil
	})
}

// MarkRemovedResources marks resources that were in the previous scan but not in the current scan as 'removed'.
// foundResourceIDs contains the IDs of resources found in the current scan.
func (s *resourceScanStore) MarkRemovedResources(ctx context.Context, scanID, accountID string, foundResourceIDs []string) error {
	finish := metrics.TrackDBQuery("mark_removed", "resource_scans")

	// Find resources from the previous scan that are not in the current scan
	// and insert them as 'removed' in the current scan
	query := `
		INSERT INTO resource_scans (id, resource_id, scan_id, status, created_at)
		SELECT gen_random_uuid(), r.id, $1, 'removed', NOW()
		FROM resources r
		WHERE r.aws_account_id = $2
		  AND r.id != ALL($3::uuid[])
		  AND EXISTS (
			  SELECT 1 FROM resource_scans rs
			  INNER JOIN scans s ON s.id = rs.scan_id
			  WHERE rs.resource_id = r.id
			    AND s.aws_account_id = $2
			    AND s.status IN ('complete', 'partial')
			    AND rs.status != 'removed'
			    AND s.id = (
			        SELECT id FROM scans
			        WHERE aws_account_id = $2
			          AND status IN ('complete', 'partial')
			          AND id != $1
			        ORDER BY completed_at DESC
			        LIMIT 1
			    )
		  )
		ON CONFLICT (resource_id, scan_id) DO NOTHING
	`

	_, err := s.db.Pool().Exec(ctx, query, scanID, accountID, foundResourceIDs)
	if err != nil {
		finish("error")
		return fmt.Errorf("mark removed resources: %w", err)
	}

	finish("success")
	return nil
}

// DeleteStaleResources deletes resources that have been marked 'removed' in the last N consecutive scans.
// Returns the number of deleted resources.
func (s *resourceScanStore) DeleteStaleResources(ctx context.Context, accountID string, minScansRemoved int) (int64, error) {
	finish := metrics.TrackDBQuery("delete_stale", "resource_scans")

	query := `
		WITH recent_scans AS (
			SELECT id FROM scans
			WHERE aws_account_id = $1 AND status IN ('complete', 'partial')
			ORDER BY completed_at DESC
			LIMIT $2
		),
		stale_resources AS (
			SELECT rs.resource_id
			FROM resource_scans rs
			WHERE rs.scan_id IN (SELECT id FROM recent_scans)
			GROUP BY rs.resource_id
			HAVING COUNT(*) = $2 AND COUNT(*) FILTER (WHERE rs.status = 'removed') = $2
		)
		DELETE FROM resources WHERE id IN (SELECT resource_id FROM stale_resources)
	`

	result, err := s.db.Pool().Exec(ctx, query, accountID, minScansRemoved)
	if err != nil {
		finish("error")
		return 0, fmt.Errorf("delete stale resources: %w", err)
	}

	finish("success")
	return result.RowsAffected(), nil
}

// GetByScanID retrieves all resource-scan records for a specific scan.
func (s *resourceScanStore) GetByScanID(ctx context.Context, scanID string) ([]*models.ResourceScan, error) {
	finish := metrics.TrackDBQuery("select", "resource_scans")

	query := `
		SELECT id, resource_id, scan_id, status, created_at
		FROM resource_scans
		WHERE scan_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, scanID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query resource_scans: %w", err)
	}
	defer rows.Close()

	var records []*models.ResourceScan //nolint:prealloc // rows count unknown
	for rows.Next() {
		var r models.ResourceScan
		err := rows.Scan(&r.ID, &r.ResourceID, &r.ScanID, &r.Status, &r.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan resource_scan: %w", err)
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

// GetByResourceID retrieves scan history for a specific resource.
func (s *resourceScanStore) GetByResourceID(ctx context.Context, resourceID string) ([]*models.ResourceScan, error) {
	finish := metrics.TrackDBQuery("select", "resource_scans")

	query := `
		SELECT id, resource_id, scan_id, status, created_at
		FROM resource_scans
		WHERE resource_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.Pool().Query(ctx, query, resourceID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query resource_scans: %w", err)
	}
	defer rows.Close()

	var records []*models.ResourceScan //nolint:prealloc // rows count unknown
	for rows.Next() {
		var r models.ResourceScan
		err := rows.Scan(&r.ID, &r.ResourceID, &r.ScanID, &r.Status, &r.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan resource_scan: %w", err)
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
