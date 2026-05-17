import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ServiceIcon, getServiceLabel } from '@/components/shared/ServiceIcon';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { Resource, Finding } from '@/types';

interface ResourcePreviewModalProps {
  resource: Resource | null;
  findings: Finding[];
  isOpen: boolean;
  onClose: () => void;
}

export function ResourcePreviewModal({
  resource,
  findings,
  isOpen,
  onClose,
}: ResourcePreviewModalProps) {
  const navigate = useNavigate();

  if (!resource) return null;

  // Filter findings for this resource
  const resourceFindings = findings.filter(
    (f) => f.resourceId === resource.id && f.status === 'open'
  );

  const handleViewDetails = () => {
    onClose();
    // Navigate with state indicating we came from the map
    navigate(`/resources/${encodeURIComponent(resource.resourceId)}`, {
      state: { from: 'infrastructure-map' },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ServiceIcon service={resource.service} className="h-8 w-8" />
            <div>
              <DialogTitle className="text-left">
                {resource.name || resource.resourceId}
              </DialogTitle>
              <DialogDescription className="text-left">
                {getServiceLabel(resource.service)} • {resource.region || 'Global'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">State</span>
              <div className="mt-1">
                <Badge variant="secondary">{resource.state || 'Unknown'}</Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Monthly Cost</span>
              <div className="mt-1 font-medium">
                {resource.costEstimateMonthly
                  ? formatCurrency(parseFloat(resource.costEstimateMonthly))
                  : 'Free'}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Resource ID</span>
              <div className="mt-1 font-mono text-xs break-all">
                {resource.resourceId}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Last Seen</span>
              <div className="mt-1 text-xs">{formatDateTime(resource.lastSeenAt)}</div>
            </div>
          </div>

          <Separator />

          {/* Findings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Open Findings
              </h4>
              {resourceFindings.length > 0 && (
                <Badge variant="destructive">{resourceFindings.length}</Badge>
              )}
            </div>

            {resourceFindings.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {resourceFindings.slice(0, 5).map((finding) => (
                  <div
                    key={finding.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <SeverityBadge severity={finding.severity} />
                    <span className="flex-1 line-clamp-2">{finding.summary}</span>
                  </div>
                ))}
                {resourceFindings.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{resourceFindings.length - 5} more findings
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No open findings for this resource
              </p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleViewDetails} className="flex-1">
              View Full Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
