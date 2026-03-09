package scanner

import (
	"encoding/json"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// DependencyExtractor extracts resource dependencies from AWS resource data.
type DependencyExtractor struct{}

// NewDependencyExtractor creates a new DependencyExtractor.
func NewDependencyExtractor() *DependencyExtractor {
	return &DependencyExtractor{}
}

// ExtractDependencies extracts dependencies from a resource based on its service type.
func (e *DependencyExtractor) ExtractDependencies(resource *models.Resource) []*models.ResourceDependency {
	if resource.Raw == nil {
		return nil
	}

	switch resource.Service {
	case models.ServiceEC2:
		return e.extractEC2Dependencies(resource)
	case models.ServiceEBS:
		return e.extractEBSDependencies(resource)
	case models.ServiceRDS:
		return e.extractRDSDependencies(resource)
	case models.ServiceLambda:
		return e.extractLambdaDependencies(resource)
	case models.ServiceSecurityGroup:
		return e.extractSecurityGroupDependencies(resource)
	case models.ServiceALB:
		return e.extractALBDependencies(resource)
	case models.ServiceENI:
		return e.extractENIDependencies(resource)
	case models.ServiceNATGateway:
		return e.extractNATGatewayDependencies(resource)
	case models.ServiceS3:
		return e.extractS3Dependencies(resource)
	case models.ServiceSecret:
		return e.extractSecretDependencies(resource)
	case models.ServiceCloudWatchAlarm:
		return e.extractCloudWatchAlarmDependencies(resource)
	default:
		return nil
	}
}

// extractEC2Dependencies extracts dependencies from EC2 instance data.
func (e *DependencyExtractor) extractEC2Dependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		VpcId          string `json:"VpcId"`
		SubnetId       string `json:"SubnetId"`
		SecurityGroups []struct {
			GroupId   string `json:"GroupId"`
			GroupName string `json:"GroupName"`
		} `json:"SecurityGroups"`
		IamInstanceProfile *struct {
			Arn string `json:"Arn"`
		} `json:"IamInstanceProfile"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC relationship
	if raw.VpcId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.VpcId,
			models.ServiceVPC,
			models.RelationshipInVPC,
		))
	}

	// Subnet relationship
	if raw.SubnetId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.SubnetId,
			models.ServiceSubnet,
			models.RelationshipInSubnet,
		))
	}

	// Security group relationships
	for _, sg := range raw.SecurityGroups {
		if sg.GroupId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				sg.GroupId,
				models.ServiceSecurityGroup,
				models.RelationshipUsesSG,
			))
		}
	}

	// IAM role relationship
	if raw.IamInstanceProfile != nil && raw.IamInstanceProfile.Arn != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.IamInstanceProfile.Arn,
			models.ServiceIAMRole,
			models.RelationshipUsesRole,
		))
	}

	return deps
}

// extractEBSDependencies extracts dependencies from EBS volume data.
func (e *DependencyExtractor) extractEBSDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		Attachments []struct {
			InstanceId string `json:"InstanceId"`
		} `json:"Attachments"`
		KmsKeyId string `json:"KmsKeyId"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// Instance attachment relationships
	for _, att := range raw.Attachments {
		if att.InstanceId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				att.InstanceId,
				models.ServiceEC2,
				models.RelationshipAttachedTo,
			))
		}
	}

	// KMS encryption relationship
	if raw.KmsKeyId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.KmsKeyId,
			models.ServiceKMSKey,
			models.RelationshipEncryptedBy,
		))
	}

	return deps
}

// extractRDSDependencies extracts dependencies from RDS instance data.
func (e *DependencyExtractor) extractRDSDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		DBSubnetGroup *struct {
			VpcId   string `json:"VpcId"`
			Subnets []struct {
				SubnetIdentifier string `json:"SubnetIdentifier"`
			} `json:"Subnets"`
		} `json:"DBSubnetGroup"`
		VpcSecurityGroups []struct {
			VpcSecurityGroupId string `json:"VpcSecurityGroupId"`
		} `json:"VpcSecurityGroups"`
		KmsKeyId string `json:"KmsKeyId"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC and subnet relationships from DB subnet group
	if raw.DBSubnetGroup != nil {
		if raw.DBSubnetGroup.VpcId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				raw.DBSubnetGroup.VpcId,
				models.ServiceVPC,
				models.RelationshipInVPC,
			))
		}
		for _, subnet := range raw.DBSubnetGroup.Subnets {
			if subnet.SubnetIdentifier != "" {
				deps = append(deps, models.NewResourceDependency(
					resource.ID,
					subnet.SubnetIdentifier,
					models.ServiceSubnet,
					models.RelationshipInSubnet,
				))
			}
		}
	}

	// Security group relationships
	for _, sg := range raw.VpcSecurityGroups {
		if sg.VpcSecurityGroupId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				sg.VpcSecurityGroupId,
				models.ServiceSecurityGroup,
				models.RelationshipUsesSG,
			))
		}
	}

	// KMS encryption relationship
	if raw.KmsKeyId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.KmsKeyId,
			models.ServiceKMSKey,
			models.RelationshipEncryptedBy,
		))
	}

	return deps
}

// extractLambdaDependencies extracts dependencies from Lambda function data.
func (e *DependencyExtractor) extractLambdaDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		Role      string `json:"Role"`
		VpcConfig *struct {
			VpcId            string   `json:"VpcId"`
			SubnetIds        []string `json:"SubnetIds"`
			SecurityGroupIds []string `json:"SecurityGroupIds"`
		} `json:"VpcConfig"`
		Layers []struct {
			Arn string `json:"Arn"`
		} `json:"Layers"`
		KMSKeyArn string `json:"KMSKeyArn"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// IAM role relationship
	if raw.Role != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.Role,
			models.ServiceIAMRole,
			models.RelationshipUsesRole,
		))
	}

	// VPC configuration relationships
	if raw.VpcConfig != nil {
		if raw.VpcConfig.VpcId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				raw.VpcConfig.VpcId,
				models.ServiceVPC,
				models.RelationshipInVPC,
			))
		}
		for _, subnetId := range raw.VpcConfig.SubnetIds {
			if subnetId != "" {
				deps = append(deps, models.NewResourceDependency(
					resource.ID,
					subnetId,
					models.ServiceSubnet,
					models.RelationshipInSubnet,
				))
			}
		}
		for _, sgId := range raw.VpcConfig.SecurityGroupIds {
			if sgId != "" {
				deps = append(deps, models.NewResourceDependency(
					resource.ID,
					sgId,
					models.ServiceSecurityGroup,
					models.RelationshipUsesSG,
				))
			}
		}
	}

	// Layer relationships
	for _, layer := range raw.Layers {
		if layer.Arn != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				layer.Arn,
				models.ServiceLambdaLayer,
				models.RelationshipUsesLayer,
			))
		}
	}

	// KMS encryption relationship
	if raw.KMSKeyArn != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.KMSKeyArn,
			models.ServiceKMSKey,
			models.RelationshipEncryptedBy,
		))
	}

	return deps
}

// extractSecurityGroupDependencies extracts dependencies from security group data.
func (e *DependencyExtractor) extractSecurityGroupDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		VpcId string `json:"VpcId"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC relationship
	if raw.VpcId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.VpcId,
			models.ServiceVPC,
			models.RelationshipInVPC,
		))
	}

	return deps
}

// extractALBDependencies extracts dependencies from ALB data.
func (e *DependencyExtractor) extractALBDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		VpcId             string   `json:"VpcId"`
		SecurityGroups    []string `json:"SecurityGroups"`
		AvailabilityZones []struct {
			SubnetId string `json:"SubnetId"`
		} `json:"AvailabilityZones"`
		TargetGroups []struct {
			TargetGroupArn  string `json:"TargetGroupArn"`
			TargetGroupName string `json:"TargetGroupName"`
			TargetType      string `json:"TargetType"`
			Targets         []struct {
				TargetId string `json:"TargetId"`
			} `json:"Targets"`
		} `json:"TargetGroups"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC relationship
	if raw.VpcId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.VpcId,
			models.ServiceVPC,
			models.RelationshipInVPC,
		))
	}

	// Security group relationships
	for _, sgId := range raw.SecurityGroups {
		if sgId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				sgId,
				models.ServiceSecurityGroup,
				models.RelationshipUsesSG,
			))
		}
	}

	// Subnet relationships from availability zones
	for _, az := range raw.AvailabilityZones {
		if az.SubnetId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				az.SubnetId,
				models.ServiceSubnet,
				models.RelationshipInSubnet,
			))
		}
	}

	// Target group relationships
	for _, tg := range raw.TargetGroups {
		if tg.TargetGroupArn != "" {
			// ALB owns target group
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				tg.TargetGroupArn,
				models.ServiceTargetGroup,
				models.RelationshipOwns,
			))

			// Target group targets EC2 instances (or other targets)
			for _, target := range tg.Targets {
				if target.TargetId != "" {
					// Determine target service type based on target type
					targetService := models.ServiceEC2 // Default for "instance" type
					if tg.TargetType == "lambda" {
						targetService = models.ServiceLambda
					}
					// For "ip" type, we still track it but as EC2 (IP usually resolves to EC2)

					deps = append(deps, models.NewResourceDependency(
						resource.ID,
						target.TargetId,
						targetService,
						models.RelationshipTargets,
					))
				}
			}
		}
	}

	return deps
}

// extractENIDependencies extracts dependencies from ENI data.
func (e *DependencyExtractor) extractENIDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		VpcId      string `json:"vpc_id"`
		SubnetId   string `json:"subnet_id"`
		Attachment *struct {
			InstanceId string `json:"instance_id"`
		} `json:"attachment"`
		SecurityGroups []struct {
			GroupId   string `json:"group_id"`
			GroupName string `json:"group_name"`
		} `json:"security_groups"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC relationship
	if raw.VpcId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.VpcId,
			models.ServiceVPC,
			models.RelationshipInVPC,
		))
	}

	// Subnet relationship
	if raw.SubnetId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.SubnetId,
			models.ServiceSubnet,
			models.RelationshipInSubnet,
		))
	}

	// EC2 attachment relationship
	if raw.Attachment != nil && raw.Attachment.InstanceId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.Attachment.InstanceId,
			models.ServiceEC2,
			models.RelationshipAttachedTo,
		))
	}

	// Security group relationships
	for _, sg := range raw.SecurityGroups {
		if sg.GroupId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				sg.GroupId,
				models.ServiceSecurityGroup,
				models.RelationshipUsesSG,
			))
		}
	}

	return deps
}

// extractNATGatewayDependencies extracts dependencies from NAT Gateway data.
func (e *DependencyExtractor) extractNATGatewayDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		VpcId     string `json:"vpc_id"`
		SubnetId  string `json:"subnet_id"`
		Addresses []struct {
			AllocationId       string `json:"allocation_id"`
			NetworkInterfaceId string `json:"network_interface_id"`
		} `json:"addresses"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// VPC relationship
	if raw.VpcId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.VpcId,
			models.ServiceVPC,
			models.RelationshipInVPC,
		))
	}

	// Subnet relationship
	if raw.SubnetId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.SubnetId,
			models.ServiceSubnet,
			models.RelationshipInSubnet,
		))
	}

	// EIP and ENI relationships from addresses
	for _, addr := range raw.Addresses {
		if addr.AllocationId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				addr.AllocationId,
				models.ServiceEIP,
				models.RelationshipUsesEIP,
			))
		}
		if addr.NetworkInterfaceId != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				addr.NetworkInterfaceId,
				models.ServiceENI,
				models.RelationshipAttachedTo,
			))
		}
	}

	return deps
}

// extractS3Dependencies extracts dependencies from S3 bucket data.
func (e *DependencyExtractor) extractS3Dependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		KmsKeyId string `json:"kms_key_id"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// KMS encryption relationship
	if raw.KmsKeyId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.KmsKeyId,
			models.ServiceKMSKey,
			models.RelationshipEncryptedBy,
		))
	}

	return deps
}

// extractSecretDependencies extracts dependencies from Secrets Manager secret data.
func (e *DependencyExtractor) extractSecretDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		KmsKeyId string `json:"kms_key_id"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// KMS encryption relationship
	if raw.KmsKeyId != "" {
		deps = append(deps, models.NewResourceDependency(
			resource.ID,
			raw.KmsKeyId,
			models.ServiceKMSKey,
			models.RelationshipEncryptedBy,
		))
	}

	return deps
}

// extractCloudWatchAlarmDependencies extracts dependencies from CloudWatch Alarm data.
func (e *DependencyExtractor) extractCloudWatchAlarmDependencies(resource *models.Resource) []*models.ResourceDependency {
	var deps []*models.ResourceDependency

	var raw struct {
		Dimensions []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"dimensions"`
	}

	if err := json.Unmarshal(resource.Raw, &raw); err != nil {
		return nil
	}

	// Map dimension names to service types
	dimensionServiceMap := map[string]models.ServiceType{
		"InstanceId":           models.ServiceEC2,
		"DBInstanceIdentifier": models.ServiceRDS,
		"FunctionName":         models.ServiceLambda,
		"LoadBalancer":         models.ServiceALB,
		"NatGatewayId":         models.ServiceNATGateway,
		"BucketName":           models.ServiceS3,
	}

	// Extract target resource relationships from dimensions
	for _, dim := range raw.Dimensions {
		if targetService, ok := dimensionServiceMap[dim.Name]; ok && dim.Value != "" {
			deps = append(deps, models.NewResourceDependency(
				resource.ID,
				dim.Value,
				targetService,
				models.RelationshipMonitors,
			))
		}
	}

	return deps
}
