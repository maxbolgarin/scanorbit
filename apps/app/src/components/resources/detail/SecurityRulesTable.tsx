import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ResourceRelationshipBadge } from './ResourceRelationshipBadge';
import type { SecurityGroupRule } from '@/types/rawData';

interface SecurityRulesTableProps {
  rules: SecurityGroupRule[];
  emptyText?: string;
}

function formatPortRange(fromPort: number | null, toPort: number | null): string {
  if (fromPort === null && toPort === null) return 'All';
  if (fromPort === -1 || toPort === -1) return 'All';
  if (fromPort === toPort) return String(fromPort);
  return `${fromPort}-${toPort}`;
}

function formatProtocol(protocol: string): string {
  if (protocol === '-1' || protocol === 'all') return 'All';
  return protocol.toUpperCase();
}

function isOpenToWorld(cidrBlocks: string[]): boolean {
  return cidrBlocks.includes('0.0.0.0/0') || cidrBlocks.includes('::/0');
}

export function SecurityRulesTable({ rules, emptyText = 'No rules' }: SecurityRulesTableProps) {
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{emptyText}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Protocol</TableHead>
          <TableHead className="w-24">Ports</TableHead>
          <TableHead>Source / Destination</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule, index) => (
          <TableRow key={index}>
            <TableCell>
              <Badge variant="secondary" className="font-mono text-xs">
                {formatProtocol(rule.protocol)}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">
              {formatPortRange(rule.fromPort, rule.toPort)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {rule.cidrBlocks.map((cidr) => (
                  <Badge
                    key={cidr}
                    variant={isOpenToWorld([cidr]) ? 'destructive' : 'outline'}
                    className="font-mono text-xs"
                  >
                    {cidr}
                  </Badge>
                ))}
                {rule.ipv6Blocks.map((cidr) => (
                  <Badge
                    key={cidr}
                    variant={isOpenToWorld([cidr]) ? 'destructive' : 'outline'}
                    className="font-mono text-xs"
                  >
                    {cidr}
                  </Badge>
                ))}
                {rule.securityGroupIds.map((sgId) => (
                  <ResourceRelationshipBadge key={sgId} resourceId={sgId} />
                ))}
                {rule.cidrBlocks.length === 0 &&
                  rule.ipv6Blocks.length === 0 &&
                  rule.securityGroupIds.length === 0 && (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
