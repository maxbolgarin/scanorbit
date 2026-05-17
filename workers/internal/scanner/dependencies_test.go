package scanner

import (
	"encoding/json"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

func TestExtractDependencies_NilRaw(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{Service: models.ServiceEC2, Raw: nil}
	if deps := e.ExtractDependencies(r); deps != nil {
		t.Fatalf("expected nil for nil Raw, got %d deps", len(deps))
	}
}

func TestExtractDependencies_InvalidJSON(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{Service: models.ServiceEC2, Raw: json.RawMessage(`invalid`)}
	if deps := e.ExtractDependencies(r); deps != nil {
		t.Fatalf("expected nil for invalid JSON, got %d deps", len(deps))
	}
}

func TestExtractDependencies_UnsupportedService(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{Service: models.ServiceACM, Raw: json.RawMessage(`{}`)}
	if deps := e.ExtractDependencies(r); deps != nil {
		t.Fatalf("expected nil for unsupported service, got %d deps", len(deps))
	}
}

func TestExtractEC2Dependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceEC2,
		Raw: json.RawMessage(`{
			"VpcId": "vpc-123",
			"SubnetId": "subnet-456",
			"SecurityGroups": [{"GroupId": "sg-789"}],
			"IamInstanceProfile": {"Arn": "arn:aws:iam::123:instance-profile/test"}
		}`),
	}
	deps := e.ExtractDependencies(r)
	if len(deps) != 4 {
		t.Fatalf("expected 4 deps (vpc+subnet+sg+iam), got %d", len(deps))
	}

	assertDep(t, deps, "vpc-123", models.ServiceVPC, models.RelationshipInVPC)
	assertDep(t, deps, "subnet-456", models.ServiceSubnet, models.RelationshipInSubnet)
	assertDep(t, deps, "sg-789", models.ServiceSecurityGroup, models.RelationshipUsesSG)
}

func TestExtractEC2Dependencies_Empty(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{ID: "res-1", Service: models.ServiceEC2, Raw: json.RawMessage(`{}`)}
	if deps := e.ExtractDependencies(r); len(deps) != 0 {
		t.Fatalf("expected 0 deps for empty EC2, got %d", len(deps))
	}
}

func TestExtractEBSDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceEBS,
		Raw: json.RawMessage(`{
			"Attachments": [{"InstanceId": "i-123"}],
			"KmsKeyId": "arn:aws:kms:us-east-1:123:key/abc"
		}`),
	}
	deps := e.ExtractDependencies(r)
	if len(deps) != 2 {
		t.Fatalf("expected 2 deps (instance+kms), got %d", len(deps))
	}
	assertDep(t, deps, "i-123", models.ServiceEC2, models.RelationshipAttachedTo)
	assertDep(t, deps, "arn:aws:kms:us-east-1:123:key/abc", models.ServiceKMSKey, models.RelationshipEncryptedBy)
}

func TestExtractRDSDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceRDS,
		Raw: json.RawMessage(`{
			"DBSubnetGroup": {
				"VpcId": "vpc-abc",
				"Subnets": [{"SubnetIdentifier": "subnet-1"}, {"SubnetIdentifier": "subnet-2"}]
			},
			"VpcSecurityGroups": [{"VpcSecurityGroupId": "sg-def"}],
			"KmsKeyId": "key-123"
		}`),
	}
	deps := e.ExtractDependencies(r)
	// vpc + 2 subnets + sg + kms = 5
	if len(deps) != 5 {
		t.Fatalf("expected 5 deps, got %d", len(deps))
	}
	assertDep(t, deps, "vpc-abc", models.ServiceVPC, models.RelationshipInVPC)
	assertDep(t, deps, "subnet-1", models.ServiceSubnet, models.RelationshipInSubnet)
	assertDep(t, deps, "sg-def", models.ServiceSecurityGroup, models.RelationshipUsesSG)
}

func TestExtractLambdaDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceLambda,
		Raw: json.RawMessage(`{
			"Role": "arn:aws:iam::123:role/lambda-role",
			"VpcConfig": {
				"VpcId": "vpc-xyz",
				"SubnetIds": ["subnet-a"],
				"SecurityGroupIds": ["sg-b"]
			},
			"Layers": [{"Arn": "arn:aws:lambda:us-east-1:123:layer:my-layer:1"}]
		}`),
	}
	deps := e.ExtractDependencies(r)
	// role + vpc + subnet + sg + layer = 5
	if len(deps) != 5 {
		t.Fatalf("expected 5 deps, got %d", len(deps))
	}
	assertDep(t, deps, "arn:aws:iam::123:role/lambda-role", models.ServiceIAMRole, models.RelationshipUsesRole)
	assertDep(t, deps, "vpc-xyz", models.ServiceVPC, models.RelationshipInVPC)
}

func TestExtractSecurityGroupDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceSecurityGroup,
		Raw: json.RawMessage(`{"VpcId": "vpc-sg-vpc"}`),
	}
	deps := e.ExtractDependencies(r)
	if len(deps) != 1 {
		t.Fatalf("expected 1 dep, got %d", len(deps))
	}
	assertDep(t, deps, "vpc-sg-vpc", models.ServiceVPC, models.RelationshipInVPC)
}

func TestExtractALBDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceALB,
		Raw: json.RawMessage(`{
			"VpcId": "vpc-alb",
			"SecurityGroups": ["sg-alb"],
			"TargetGroups": [{"TargetGroupArn": "arn:tg-1"}]
		}`),
	}
	deps := e.ExtractDependencies(r)
	// vpc + sg + target group = 3
	if len(deps) < 2 {
		t.Fatalf("expected at least 2 deps, got %d", len(deps))
	}
	assertDep(t, deps, "vpc-alb", models.ServiceVPC, models.RelationshipInVPC)
}

func TestExtractENIDependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceENI,
		Raw: json.RawMessage(`{
			"vpc_id": "vpc-eni",
			"subnet_id": "subnet-eni",
			"security_groups": [{"group_id": "sg-eni"}],
			"attachment": {"instance_id": "i-eni"}
		}`),
	}
	deps := e.ExtractDependencies(r)
	// vpc + subnet + sg + instance = 4
	if len(deps) != 4 {
		t.Fatalf("expected 4 deps, got %d", len(deps))
	}
}

func TestExtractS3Dependencies(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{
		ID: "res-1", Service: models.ServiceS3,
		Raw: json.RawMessage(`{
			"kms_key_id": "key-s3"
		}`),
	}
	deps := e.ExtractDependencies(r)
	if len(deps) != 1 {
		t.Fatalf("expected 1 dep, got %d", len(deps))
	}
	assertDep(t, deps, "key-s3", models.ServiceKMSKey, models.RelationshipEncryptedBy)
}

func TestExtractS3Dependencies_NoEncryption(t *testing.T) {
	e := NewDependencyExtractor()
	r := &models.Resource{ID: "res-1", Service: models.ServiceS3, Raw: json.RawMessage(`{}`)}
	if deps := e.ExtractDependencies(r); len(deps) != 0 {
		t.Fatalf("expected 0 deps for unencrypted S3, got %d", len(deps))
	}
}

// assertDep checks that at least one dependency matches the given target, service, and relationship.
func assertDep(t *testing.T, deps []*models.ResourceDependency, targetID string, targetService models.ServiceType, relType models.RelationshipType) {
	t.Helper()
	for _, d := range deps {
		if d.TargetResourceID == targetID && d.TargetService == targetService && d.RelationshipType == relType {
			return
		}
	}
	t.Errorf("no dependency found with target=%q service=%q rel=%q", targetID, targetService, relType)
}
