import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DetailSection } from './DetailSection';
import { SecurityRulesTable } from './SecurityRulesTable';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { extractSecurityGroupData, type SecurityGroupRule } from '@/types/rawData';
import * as api from '@/lib/api';

interface SecurityGroupRef {
  groupId: string;
  groupName: string;
}

interface SecurityGroupsPanelProps {
  securityGroups: SecurityGroupRef[];
}

function hasOpenToWorld(rules: SecurityGroupRule[]): boolean {
  return rules.some(
    (rule) =>
      rule.cidrBlocks.includes('0.0.0.0/0') ||
      rule.ipv6Blocks.includes('::/0')
  );
}

function SecurityGroupCard({
  groupId,
  groupName,
  isLoading,
  resource,
}: {
  groupId: string;
  groupName: string;
  isLoading: boolean;
  resource?: {
    id: string;
    raw: Record<string, unknown> | null;
  };
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const data = resource?.raw ? extractSecurityGroupData(resource.raw) : null;
  const isOpenToWorld = data ? hasOpenToWorld(data.ingressRules) : false;
  const totalRules = data ? data.ingressRules.length + data.egressRules.length : 0;

  const handleViewDetails = () => {
    if (resource?.id) {
      navigate(`/resources/${resource.id}`);
    } else {
      navigate(`/resources/${encodeURIComponent(groupId)}`);
    }
  };

  return (
    <div className="border rounded-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{groupName || groupId}</span>
                  {isOpenToWorld && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Open to Internet
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{groupId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : data ? (
                <Badge variant="secondary" className="text-xs">
                  {totalRules} rule{totalRules !== 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Not scanned
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : data ? (
              <>
                {data.description && (
                  <p className="text-sm text-muted-foreground">{data.description}</p>
                )}

                {/* Inbound Rules */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      Inbound Rules
                      <Badge variant="secondary" className="text-xs">
                        {data.ingressRules.length}
                      </Badge>
                    </h4>
                  </div>
                  <SecurityRulesTable
                    rules={data.ingressRules}
                    emptyText="No inbound rules (all incoming traffic is blocked)"
                  />
                </div>

                {/* Outbound Rules */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      Outbound Rules
                      <Badge variant="secondary" className="text-xs">
                        {data.egressRules.length}
                      </Badge>
                    </h4>
                  </div>
                  <SecurityRulesTable
                    rules={data.egressRules}
                    emptyText="No outbound rules"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleViewDetails}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Details
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Security group data not available. This security group may not have been scanned yet.
                </p>
                <Button variant="outline" size="sm" onClick={handleViewDetails}>
                  View Security Group
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function SecurityGroupsPanel({ securityGroups }: SecurityGroupsPanelProps) {
  // Fetch all security groups in parallel
  const queries = useQueries({
    queries: securityGroups.map((sg) => ({
      queryKey: ['resource', sg.groupId],
      queryFn: () => api.getResource(sg.groupId),
      staleTime: 60000, // Cache for 1 minute
      retry: 1, // Only retry once since the SG might not exist in our system
    })),
  });

  if (securityGroups.length === 0) {
    return (
      <DetailSection title="Security Groups">
        <p className="text-sm text-muted-foreground">No security groups attached</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection
      title="Security Groups"
      description="Firewall rules controlling inbound and outbound traffic"
    >
      <div className="space-y-3">
        {securityGroups.map((sg, index) => (
          <SecurityGroupCard
            key={sg.groupId}
            groupId={sg.groupId}
            groupName={sg.groupName}
            isLoading={queries[index]?.isLoading ?? false}
            resource={queries[index]?.data as { id: string; raw: Record<string, unknown> | null } | undefined}
          />
        ))}
      </div>
    </DetailSection>
  );
}
