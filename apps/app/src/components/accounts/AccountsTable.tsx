import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import type { AwsAccount } from "@/types";
import { MoreHorizontal, History, Trash2, LayoutDashboard, Settings2 } from "lucide-react";

interface AccountsTableProps {
  accounts: AwsAccount[];
  onEdit: (accountId: string) => void;
  onViewHistory: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
}

export function AccountsTable({
  accounts,
  onEdit,
  onViewHistory,
  onDisconnect,
}: AccountsTableProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile card view */}
      <div className="space-y-3 sm:hidden">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-lg border p-3 space-y-3">
            {/* Header row: Name + Status */}
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => navigate(`/accounts/${account.id}`)}
                className="font-medium text-left hover:text-primary hover:underline"
              >
                {account.name}
              </button>
              <AccountStatusBadge status={account.status} />
            </div>

            {/* AWS Account ID */}
            <p className="font-mono text-xs text-muted-foreground">
              {account.awsAccountId}
            </p>

            {/* Info row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {account.enabledScanners?.length || 0} scanners
              </Badge>
              <span>
                {account.lastScanAt
                  ? `Last scan: ${formatRelativeTime(account.lastScanAt)}`
                  : "Never scanned"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/accounts/${account.id}`)}
              >
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(account.id)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewHistory(account.id)}>
                    <History className="mr-2 h-4 w-4" />
                    View scan history
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDisconnect(account.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="rounded-lg border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>AWS Account ID</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Scanners</TableHead>
              <TableHead className="hidden lg:table-cell">Last Scan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  <button
                    onClick={() => navigate(`/accounts/${account.id}`)}
                    className="hover:text-primary hover:underline text-left"
                  >
                    {account.name}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {account.awsAccountId}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <AccountStatusBadge status={account.status} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant="secondary" className="text-xs">
                    {account.enabledScanners?.length || 0} of 11
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {account.lastScanAt
                    ? formatRelativeTime(account.lastScanAt)
                    : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(account.id)}
                    >
                      <Settings2 className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/accounts/${account.id}`)}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          View Dashboard
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewHistory(account.id)}>
                          <History className="mr-2 h-4 w-4" />
                          View scan history
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDisconnect(account.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
