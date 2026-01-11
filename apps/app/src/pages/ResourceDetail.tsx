import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { useResource } from "@/hooks/use-resources";
import { useFindings } from "@/hooks/use-findings";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Tag } from "lucide-react";

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
 * Build AWS console URL with validated region to prevent URL injection.
 * Returns null if region is invalid.
 */
function buildAwsConsoleUrl(region: string | null | undefined): string | null {
  if (!region || !VALID_AWS_REGIONS.has(region)) {
    return null;
  }
  return `https://${region}.console.aws.amazon.com`;
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: resource, isLoading } = useResource(id || "");
  const { data: findingsResponse } = useFindings();
  const allFindings = findingsResponse?.data || [];

  // Filter findings for this resource
  const resourceFindings = allFindings.filter(
    (f) => f.resourceId === id && f.status === "open"
  );

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
        <Button variant="outline" onClick={() => navigate("/resources")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Resources
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2"
            onClick={() => navigate("/resources")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <ServiceIcon service={resource.service} className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">{resource.name}</h1>
              <p className="text-sm text-muted-foreground">
                {getServiceLabel(resource.service)} • {resource.region}
              </p>
            </div>
          </div>
        </div>
        {buildAwsConsoleUrl(resource.region) && (
          <Button variant="outline" asChild>
            <a
              href={buildAwsConsoleUrl(resource.region)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in AWS
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resource Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Resource ID
                </p>
                <p className="mt-1 break-all font-mono text-sm">
                  {resource.resourceId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Region</p>
                <p className="mt-1">{resource.region}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">State</p>
                <Badge className="mt-1" variant="secondary">
                  {resource.state}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Est. Monthly Cost
                </p>
                <p className="mt-1">
                  {resource.costEstimateMonthly
                    ? formatCurrency(parseFloat(resource.costEstimateMonthly))
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Seen
                </p>
                <p className="mt-1">{formatDateTime(resource.lastSeenAt)}</p>
              </div>
            </div>

            <Separator />

            {/* Tags */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="h-4 w-4" />
                Tags
              </div>
              {Object.keys(resource.tags).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(resource.tags).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Related Findings */}
        <Card>
          <CardHeader>
            <CardTitle>Related Findings</CardTitle>
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
                    onClick={() => navigate(`/findings?id=${finding.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
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
      </div>
    </div>
  );
}
