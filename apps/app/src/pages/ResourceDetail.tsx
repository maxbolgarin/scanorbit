import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { useResource, useResourceDependencies, useResourceDependents } from "@/hooks/use-resources";
import { useFilteredFindings } from "@/hooks/use-findings";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft, ExternalLink, ArrowRight, ArrowLeftRight, RefreshCw } from "lucide-react";
import {
  EC2Details,
  EBSDetails,
  SecurityGroupDetails,
  RDSDetails,
  LambdaDetails,
  GenericDetails,
  S3Details,
  ALBDetails,
  IAMUserDetails,
  IAMRoleDetails,
  IAMAccessKeyDetails,
  KMSKeyDetails,
  SecretsDetails,
  CloudWatchLogsDetails,
  CloudWatchAlarmDetails,
  EIPDetails,
  RDSSnapshotDetails,
  ResourceScanHistory,
} from "@/components/resources/detail";
import type { Resource, ServiceType, RelationshipType } from "@/types";

// Valid AWS regions whitelist for URL construction security
const VALID_AWS_REGIONS = new Set([
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "af-south-1", "ap-east-1", "ap-south-1", "ap-south-2",
  "ap-southeast-1", "ap-southeast-2", "ap-southeast-3", "ap-southeast-4",
  "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
  "ca-central-1", "ca-west-1",
  "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3",
  "eu-south-1", "eu-south-2", "eu-north-1",
  "il-central-1", "me-central-1", "me-south-1",
  "sa-east-1",
]);

/**
 * Build AWS console URL for a specific resource.
 * Returns null if region is invalid or URL cannot be built.
 */
function buildAwsConsoleUrl(resource: Resource): string | null {
  const { region, service, resourceId, name, raw } = resource;

  // IAM and S3 are global services
  const isGlobalService = ['iam_user', 'iam_role', 'iam_policy', 'iam_access_key', 's3'].includes(service);

  if (!isGlobalService && (!region || !VALID_AWS_REGIONS.has(region))) {
    return null;
  }

  // URL-encode resource identifiers for safety
  const encode = encodeURIComponent;

  switch (service) {
    case 'ec2':
      return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#InstanceDetails:instanceId=${encode(resourceId)}`;

    case 'ebs':
      return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#VolumeDetails:volumeId=${encode(resourceId)}`;

    case 'security_group':
      return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#SecurityGroup:groupId=${encode(resourceId)}`;

    case 'eip':
      // EIP resourceId is typically the allocation ID
      return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#ElasticIpDetails:AllocationId=${encode(resourceId)}`;

    case 'rds':
    case 'rds_snapshot': {
      // RDS uses DB identifier from raw data or name
      const dbId = (raw as Record<string, unknown>)?.DBInstanceIdentifier ||
                   (raw as Record<string, unknown>)?.DBSnapshotIdentifier ||
                   name || resourceId;
      return `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${encode(String(dbId))}`;
    }

    case 'lambda': {
      // Lambda uses function name
      const funcName = (raw as Record<string, unknown>)?.FunctionName || name || resourceId;
      return `https://${region}.console.aws.amazon.com/lambda/home?region=${region}#/functions/${encode(String(funcName))}`;
    }

    case 's3':
      // S3 is global, bucket name is the resourceId or name
      return `https://s3.console.aws.amazon.com/s3/buckets/${encode(name || resourceId)}`;

    case 'alb': {
      // ALB needs the full ARN
      const arn = (raw as Record<string, unknown>)?.LoadBalancerArn || resourceId;
      return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#LoadBalancer:loadBalancerArn=${encode(String(arn))}`;
    }

    case 'iam_user':
      return `https://console.aws.amazon.com/iam/home#/users/details/${encode(name || resourceId)}`;

    case 'iam_role':
      return `https://console.aws.amazon.com/iam/home#/roles/details/${encode(name || resourceId)}`;

    case 'iam_policy':
      return `https://console.aws.amazon.com/iam/home#/policies`;

    case 'iam_access_key':
      // Access keys link to the user's security credentials
      return `https://console.aws.amazon.com/iam/home#/users`;

    case 'kms_key': {
      const keyId = (raw as Record<string, unknown>)?.KeyId || resourceId;
      return `https://${region}.console.aws.amazon.com/kms/home?region=${region}#/kms/keys/${encode(String(keyId))}`;
    }

    case 'secret': {
      const secretName = (raw as Record<string, unknown>)?.Name || name || resourceId;
      return `https://${region}.console.aws.amazon.com/secretsmanager/secret?name=${encode(String(secretName))}&region=${region}`;
    }

    case 'cloudwatch_logs': {
      const logGroupName = (raw as Record<string, unknown>)?.logGroupName || name || resourceId;
      // CloudWatch log group names need special encoding (replace / with $252F)
      const encodedName = encode(String(logGroupName)).replace(/%2F/g, '$252F');
      return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodedName}`;
    }

    case 'cloudwatch_alarm': {
      const alarmName = (raw as Record<string, unknown>)?.AlarmName || name || resourceId;
      return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encode(String(alarmName))}`;
    }

    case 'acm': {
      // ACM certificate
      const certArn = (raw as Record<string, unknown>)?.CertificateArn || resourceId;
      return `https://${region}.console.aws.amazon.com/acm/home?region=${region}#/certificates/${encode(String(certArn))}`;
    }

    default:
      // Fallback to region console home
      if (region && VALID_AWS_REGIONS.has(region)) {
        return `https://${region}.console.aws.amazon.com/console/home?region=${region}`;
      }
      return null;
  }
}

/**
 * Get the service-specific detail component for a resource type.
 */
function getServiceDetailComponent(service: ServiceType): React.ComponentType<{ resource: Resource }> {
  switch (service) {
    case 'ec2':
      return EC2Details;
    case 'ebs':
      return EBSDetails;
    case 'security_group':
      return SecurityGroupDetails;
    case 'rds':
      return RDSDetails;
    case 'lambda':
      return LambdaDetails;
    case 's3':
      return S3Details;
    case 'alb':
      return ALBDetails;
    case 'iam_user':
      return IAMUserDetails;
    case 'iam_role':
      return IAMRoleDetails;
    case 'iam_access_key':
      return IAMAccessKeyDetails;
    case 'kms_key':
      return KMSKeyDetails;
    case 'secret':
      return SecretsDetails;
    case 'cloudwatch_logs':
      return CloudWatchLogsDetails;
    case 'cloudwatch_alarm':
      return CloudWatchAlarmDetails;
    case 'eip':
      return EIPDetails;
    case 'rds_snapshot':
      return RDSSnapshotDetails;
    default:
      return GenericDetails;
  }
}

/**
 * Get human-readable label for relationship type
 */
function getRelationshipLabel(type: RelationshipType): string {
  switch (type) {
    case 'uses_role': return 'Uses Role';
    case 'in_vpc': return 'In VPC';
    case 'in_subnet': return 'In Subnet';
    case 'uses_sg': return 'Uses Security Group';
    case 'attached_to': return 'Attached To';
    case 'targets': return 'Targets';
    case 'owns': return 'Owns';
    case 'uses_layer': return 'Uses Layer';
    case 'encrypted_by': return 'Encrypted By';
    default: return type;
  }
}

// Type for location state
interface LocationState {
  from?: 'infrastructure-map' | 'resources';
}

export default function ResourceDetail() {
  const { id, accountId } = useParams<{ id: string; accountId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: resource, isLoading } = useResource(id || "");
  const { data: findingsResponse } = useFilteredFindings(
    { resourceId: id, status: 'open' },
    { enabled: !!id }
  );
  const { data: dependencies = [] } = useResourceDependencies(id || "");
  const { data: dependents = [] } = useResourceDependents(id || "");
  const resourceFindings = findingsResponse?.data || [];

  // Build context-aware path prefix for navigation
  const pathPrefix = accountId ? `/accounts/${accountId}` : '/overview';

  // Determine back navigation destination based on where user came from
  const locationState = location.state as LocationState | null;
  const cameFromMap = locationState?.from === 'infrastructure-map';

  const handleBack = () => {
    if (cameFromMap) {
      navigate(`${pathPrefix}/infrastructure-map`);
    } else {
      navigate(`${pathPrefix}/resources`);
    }
  };

  const backLabel = cameFromMap ? 'Back to Map' : 'Back to Resources';

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Resource not found</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
      </div>
    );
  }

  const DetailComponent = getServiceDetailComponent(resource.service);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Button>
          <div className="flex items-center gap-3">
            <ServiceIcon service={resource.service} className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{resource.name || resource.resourceId}</h1>
              <p className="text-sm text-muted-foreground">
                {getServiceLabel(resource.service)} • {resource.region || 'Global'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-sm">
            {resource.state || 'Unknown'}
          </Badge>
          {buildAwsConsoleUrl(resource) && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={buildAwsConsoleUrl(resource)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Open in AWS</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Resource ID</div>
            <p className="mt-1 break-all font-mono text-sm">{resource.resourceId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Region</div>
            <p className="mt-1">{resource.region || 'Global'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Est. Monthly Cost</div>
            <p className="mt-1 text-lg font-semibold">
              {resource.costEstimateMonthly
                ? formatCurrency(parseFloat(resource.costEstimateMonthly))
                : "Free"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Last Seen</div>
            <p className="mt-1">{formatDateTime(resource.lastSeenAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Service-Specific Details */}
        <div className="lg:col-span-2">
          <DetailComponent resource={resource} />
        </div>

        {/* Sidebar - Related Findings & Dependencies */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related Findings</CardTitle>
              <CardDescription>
                Open issues for this resource
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resourceFindings && resourceFindings.length > 0 ? (
                <div className="space-y-3">
                  {resourceFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      onClick={() => navigate(`${pathPrefix}/findings?id=${finding.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <SeverityBadge severity={finding.severity} />
                        {(finding.detectionCount || 1) > 1 && (
                          <span
                            className="flex items-center gap-1 text-xs text-amber-600"
                            title={`Detected ${finding.detectionCount} times`}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {finding.detectionCount}×
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium">{finding.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No open findings for this resource
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dependencies Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Dependencies
              </CardTitle>
              <CardDescription>
                Resources this depends on and resources that depend on this
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Outgoing Dependencies (this resource depends on) */}
              {dependencies.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Depends On ({dependencies.length})
                  </h4>
                  <div className="space-y-2">
                    {dependencies.map((dep) => (
                      <div
                        key={dep.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          dep.targetResource ? 'cursor-pointer hover:bg-muted/50' : ''
                        }`}
                        onClick={() => {
                          if (dep.targetResource) {
                            navigate(`${pathPrefix}/resources/${dep.targetResource.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ServiceIcon service={dep.targetService as ServiceType} className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {dep.targetResource?.name || dep.targetResourceId}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getRelationshipLabel(dep.relationshipType)}
                          </Badge>
                        </div>
                        {!dep.targetResource && (
                          <p className="text-xs text-muted-foreground mt-1">
                            External resource
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incoming Dependencies (resources that depend on this) */}
              {dependents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Depended On By ({dependents.length})
                  </h4>
                  <div className="space-y-2">
                    {dependents.map((dep) => (
                      <div
                        key={dep.id}
                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        onClick={() => navigate(`${pathPrefix}/resources/${dep.sourceResource.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ServiceIcon service={dep.sourceResource.service as ServiceType} className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {dep.sourceResource.name || dep.sourceResource.resourceId}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getRelationshipLabel(dep.relationshipType)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No dependencies message */}
              {dependencies.length === 0 && dependents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No dependencies found for this resource
                </p>
              )}
            </CardContent>
          </Card>

          {/* Scan History Card */}
          <ResourceScanHistory resourceId={resource.id} />
        </div>
      </div>
    </div>
  );
}
