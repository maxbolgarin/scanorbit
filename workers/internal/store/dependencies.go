package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type dependencyStore struct {
	db *DB
}

func newDependencyStore(db *DB) *dependencyStore {
	return &dependencyStore{db: db}
}

// Upsert inserts or updates a resource dependency.
func (s *dependencyStore) Upsert(ctx context.Context, dep *models.ResourceDependency) error {
	finish := metrics.TrackDBQuery("upsert", "resource_dependencies")

	// Generate ID if not set
	if dep.ID == "" {
		dep.ID = uuid.New().String()
	}

	query := `
		INSERT INTO resource_dependencies (
			id, org_id, source_resource_id, target_resource_id, target_service, relationship_type, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT ON CONSTRAINT resource_dependencies_unique_idx
		DO UPDATE SET
			target_service = EXCLUDED.target_service
	`

	_, err := s.db.Pool().Exec(ctx, query,
		dep.ID,
		dep.OrgID,
		dep.SourceResourceID,
		dep.TargetResourceID,
		string(dep.TargetService),
		string(dep.RelationshipType),
	)
	if err != nil {
		finish("error")
		return fmt.Errorf("upsert dependency: %w", err)
	}

	finish("success")
	return nil
}

// BulkUpsert inserts or updates multiple dependencies efficiently.
func (s *dependencyStore) BulkUpsert(ctx context.Context, deps []*models.ResourceDependency) error {
	if len(deps) == 0 {
		return nil
	}

	finish := metrics.TrackDBQuery("bulk_upsert", "resource_dependencies")

	// Use a transaction for bulk insert
	return s.db.WithTx(ctx, func(tx Tx) error {
		query := `
			INSERT INTO resource_dependencies (
				id, org_id, source_resource_id, target_resource_id, target_service, relationship_type, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT ON CONSTRAINT resource_dependencies_unique_idx
			DO UPDATE SET
				target_service = EXCLUDED.target_service
		`

		for _, dep := range deps {
			if dep.ID == "" {
				dep.ID = uuid.New().String()
			}

			_, err := tx.Exec(ctx, query,
				dep.ID,
				dep.OrgID,
				dep.SourceResourceID,
				dep.TargetResourceID,
				string(dep.TargetService),
				string(dep.RelationshipType),
			)
			if err != nil {
				finish("error")
				return fmt.Errorf("insert dependency: %w", err)
			}
		}

		finish("success")
		return nil
	})
}

// DeleteBySourceResourceID deletes all dependencies for a source resource.
func (s *dependencyStore) DeleteBySourceResourceID(ctx context.Context, sourceResourceID string) error {
	finish := metrics.TrackDBQuery("delete", "resource_dependencies")

	query := `DELETE FROM resource_dependencies WHERE source_resource_id = $1`
	_, err := s.db.Pool().Exec(ctx, query, sourceResourceID)
	if err != nil {
		finish("error")
		return fmt.Errorf("delete dependencies: %w", err)
	}

	finish("success")
	return nil
}

// DeleteByAccountID deletes all dependencies for an AWS account (via org_id join).
func (s *dependencyStore) DeleteByAccountID(ctx context.Context, accountID string) error {
	finish := metrics.TrackDBQuery("delete", "resource_dependencies")

	query := `
		DELETE FROM resource_dependencies rd
		USING resources r
		WHERE rd.source_resource_id = r.id AND r.aws_account_id = $1
	`
	_, err := s.db.Pool().Exec(ctx, query, accountID)
	if err != nil {
		finish("error")
		return fmt.Errorf("delete dependencies by account: %w", err)
	}

	finish("success")
	return nil
}

// GetBySourceResourceID retrieves all dependencies for a source resource.
func (s *dependencyStore) GetBySourceResourceID(ctx context.Context, sourceResourceID string) ([]*models.ResourceDependency, error) {
	finish := metrics.TrackDBQuery("select", "resource_dependencies")

	query := `
		SELECT id, org_id, source_resource_id, target_resource_id, target_service, relationship_type, created_at
		FROM resource_dependencies
		WHERE source_resource_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, sourceResourceID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query dependencies: %w", err)
	}
	defer rows.Close()

	var deps []*models.ResourceDependency
	for rows.Next() {
		var d models.ResourceDependency
		err := rows.Scan(
			&d.ID,
			&d.OrgID,
			&d.SourceResourceID,
			&d.TargetResourceID,
			&d.TargetService,
			&d.RelationshipType,
			&d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan dependency: %w", err)
		}
		deps = append(deps, &d)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return deps, nil
}

// GetByTarget retrieves all dependencies that point to the given target resource ID.
// Used to check if a resource (like a security group) is referenced by other resources.
func (s *dependencyStore) GetByTarget(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error) {
	finish := metrics.TrackDBQuery("select", "resource_dependencies")

	query := `
		SELECT id, org_id, source_resource_id, target_resource_id, target_service, relationship_type, created_at
		FROM resource_dependencies
		WHERE target_resource_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, targetResourceID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query dependencies by target: %w", err)
	}
	defer rows.Close()

	var deps []*models.ResourceDependency
	for rows.Next() {
		var d models.ResourceDependency
		err := rows.Scan(
			&d.ID,
			&d.OrgID,
			&d.SourceResourceID,
			&d.TargetResourceID,
			&d.TargetService,
			&d.RelationshipType,
			&d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan dependency: %w", err)
		}
		deps = append(deps, &d)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return deps, nil
}
