package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
)

type resourceStore struct {
	db *DB
}

func newResourceStore(db *DB) *resourceStore {
	return &resourceStore{db: db}
}

// Upsert inserts or updates a resource.
func (s *resourceStore) Upsert(ctx context.Context, resource *models.Resource) error {
	finish := metrics.TrackDBQuery("upsert", "resources")

	// Generate ID if not set
	if resource.ID == "" {
		resource.ID = uuid.New().String()
	}

	// Marshal tags to JSON
	tagsJSON, err := json.Marshal(resource.Tags)
	if err != nil {
		finish("error")
		return fmt.Errorf("marshal tags: %w", err)
	}

	query := `
		INSERT INTO resources (
			id, org_id, aws_account_id, resource_id, service, region,
			name, state, tags, cost_estimate_monthly, last_seen_at, raw, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW(), NOW())
		ON CONFLICT (org_id, aws_account_id, resource_id)
		DO UPDATE SET
			name = EXCLUDED.name,
			state = EXCLUDED.state,
			tags = EXCLUDED.tags,
			cost_estimate_monthly = EXCLUDED.cost_estimate_monthly,
			last_seen_at = NOW(),
			raw = EXCLUDED.raw,
			updated_at = NOW()
	`

	_, err = s.db.Pool().Exec(ctx, query,
		resource.ID,
		resource.OrgID,
		resource.AWSAccountID,
		resource.ResourceID,
		string(resource.Service),
		resource.Region,
		resource.Name,
		resource.State,
		tagsJSON,
		resource.CostEstimateMonthly,
		resource.Raw,
	)
	if err != nil {
		finish("error")
		return fmt.Errorf("upsert resource: %w", err)
	}

	finish("success")
	return nil
}

// GetByAccountID retrieves all resources for an AWS account.
func (s *resourceStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Resource, error) {
	finish := metrics.TrackDBQuery("select", "resources")

	query := `
		SELECT id, org_id, aws_account_id, resource_id, service, region,
		       name, state, tags, cost_estimate_monthly, last_seen_at, raw, created_at
		FROM resources
		WHERE aws_account_id = $1
	`

	rows, err := s.db.Pool().Query(ctx, query, accountID)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query resources: %w", err)
	}
	defer rows.Close()

	var resources []*models.Resource
	for rows.Next() {
		var r models.Resource
		var tagsJSON []byte

		err := rows.Scan(
			&r.ID,
			&r.OrgID,
			&r.AWSAccountID,
			&r.ResourceID,
			&r.Service,
			&r.Region,
			&r.Name,
			&r.State,
			&tagsJSON,
			&r.CostEstimateMonthly,
			&r.LastSeenAt,
			&r.Raw,
			&r.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan resource: %w", err)
		}

		// Unmarshal tags
		if len(tagsJSON) > 0 {
			if err := json.Unmarshal(tagsJSON, &r.Tags); err != nil {
				return nil, fmt.Errorf("unmarshal tags: %w", err)
			}
		}

		resources = append(resources, &r)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return resources, nil
}

// GetByService retrieves resources by service type for an AWS account.
func (s *resourceStore) GetByService(ctx context.Context, accountID string, service models.ServiceType) ([]*models.Resource, error) {
	finish := metrics.TrackDBQuery("select", "resources")

	query := `
		SELECT id, org_id, aws_account_id, resource_id, service, region,
		       name, state, tags, cost_estimate_monthly, last_seen_at, raw, created_at
		FROM resources
		WHERE aws_account_id = $1 AND service = $2
	`

	rows, err := s.db.Pool().Query(ctx, query, accountID, string(service))
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query resources: %w", err)
	}
	defer rows.Close()

	var resources []*models.Resource
	for rows.Next() {
		var r models.Resource
		var tagsJSON []byte

		err := rows.Scan(
			&r.ID,
			&r.OrgID,
			&r.AWSAccountID,
			&r.ResourceID,
			&r.Service,
			&r.Region,
			&r.Name,
			&r.State,
			&tagsJSON,
			&r.CostEstimateMonthly,
			&r.LastSeenAt,
			&r.Raw,
			&r.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan resource: %w", err)
		}

		if len(tagsJSON) > 0 {
			if err := json.Unmarshal(tagsJSON, &r.Tags); err != nil {
				return nil, fmt.Errorf("unmarshal tags: %w", err)
			}
		}

		resources = append(resources, &r)
	}

	if err := rows.Err(); err != nil {
		finish("error")
		return nil, fmt.Errorf("rows error: %w", err)
	}

	finish("success")
	return resources, nil
}
