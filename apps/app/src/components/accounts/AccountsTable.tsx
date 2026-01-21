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
    <div className="rounded-lg border">
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
  );
}
