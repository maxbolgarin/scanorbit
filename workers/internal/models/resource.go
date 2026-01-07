package models

import (
	"encoding/json"
	"time"
)

// ServiceType represents the type of AWS service.
type ServiceType string

const (
	ServiceEC2         ServiceType = "ec2"
	ServiceEBS         ServiceType = "ebs"
	ServiceEIP         ServiceType = "eip"
	ServiceRDS         ServiceType = "rds"
	ServiceRDSSnapshot ServiceType = "rds_snapshot"
	ServiceS3          ServiceType = "s3"
	ServiceALB         ServiceType = "alb"
	ServiceACM         ServiceType = "acm"
)

// Resource represents an AWS resource discovered during scanning.
type Resource struct {
	ID                  string
	OrgID               string
	AWSAccountID        string
	ResourceID          string // AWS resource identifier (e.g., i-xxx, vol-xxx)
	Service             ServiceType
	Region              string
	Name                string
	State               string
	Tags                map[string]string
	CostEstimateMonthly float64
	LastSeenAt          time.Time
	Raw                 json.RawMessage // Full AWS API response
	CreatedAt           time.Time
}

// NewResource creates a new Resource with sensible defaults.
func NewResource(resourceID string, service ServiceType, region string) *Resource {
	return &Resource{
		ResourceID: resourceID,
		Service:    service,
		Region:     region,
		Tags:       make(map[string]string),
		LastSeenAt: time.Now(),
	}
}
