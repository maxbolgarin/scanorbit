import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatRelativeTime } from "@/lib/utils";
import type { AwsAccount } from "@/types";
import { MoreHorizontal, RefreshCw, History, Trash2 } from "lucide-react";

interface AccountsTableProps {
  accounts: AwsAccount[];
  onRescan: (accountId: string) => void;
  onViewHistory: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
  rescanningId?: string | null;
}

export function AccountsTable({
  accounts,
  onRescan,
  onViewHistory,
  onDisconnect,
  rescanningId,
}: AccountsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account Name</TableHead>
            <TableHead>AWS Account ID</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Last Scan</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell className="font-mono text-sm">
                {account.awsAccountId}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <AccountStatusBadge status={account.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {account.lastScanAt
                  ? formatRelativeTime(account.lastScanAt)
                  : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRescan(account.id)}
                    disabled={rescanningId === account.id || account.status !== "ok"}
                  >
                    {rescanningId === account.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Rescan</span>
                      </>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewHistory(account.id)}>
                        <History className="mr-2 h-4 w-4" />
                        View scan history
                      </DropdownMenuItem>
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
  );
}
