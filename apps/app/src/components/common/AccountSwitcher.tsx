import { Check, ChevronDown, Building2, Cloud, Plus, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccountContext } from "@/hooks/use-account-context";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { TIER_LIMITS } from "@/types";

export function AccountSwitcher() {
  const navigate = useNavigate();
  const {
    currentAccountId,
    currentAccount,
    isOrgOverview,
    accounts,
    switchToAccount,
  } = useAccountContext();
  const { org } = useAuthStore();

  const tier = org?.tier || 'free';
  const tierLimits = TIER_LIMITS[tier];
  const canViewOrgOverview = tierLimits.canViewOrgOverview;
  const isTeamTier = tier === 'team';
  const hasAccounts = accounts.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isOrgOverview ? (
              <>
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium">All Accounts</span>
                  <span className="text-xs text-muted-foreground">
                    Organization Overview
                  </span>
                </div>
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium truncate max-w-[140px]">
                    {currentAccount?.name || "Select Account"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentAccount?.awsAccountId}
                  </span>
                </div>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="start">
        <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Organization Overview option - only show for Team tier */}
        {canViewOrgOverview && (
          <DropdownMenuItem
            onClick={() => switchToAccount(null)}
            className={cn(
              "cursor-pointer",
              isOrgOverview && "bg-accent"
            )}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <div className="flex-1">
              <span>Organization Overview</span>
            </div>
            {isOrgOverview && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        )}

        {hasAccounts && (
          <>
            {canViewOrgOverview && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              AWS Accounts ({accounts.length})
            </DropdownMenuLabel>
          </>
        )}

        {/* Individual accounts */}
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => switchToAccount(account.id)}
            className={cn(
              "cursor-pointer",
              currentAccountId === account.id && "bg-accent"
            )}
          >
            <Cloud className="mr-2 h-4 w-4 shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate">{account.name}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {account.awsAccountId}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {account.status === "error" && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  Error
                </Badge>
              )}
              {account.status === "pending" && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Pending
                </Badge>
              )}
              {currentAccountId === account.id && (
                <Check className="h-4 w-4 shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        {!hasAccounts && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No AWS accounts connected
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Add Account button */}
        {isTeamTier ? (
          <DropdownMenuItem
            onClick={() => navigate('/onboarding/aws')}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add Account</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled
            className="cursor-not-allowed opacity-60"
          >
            <Lock className="mr-2 h-4 w-4" />
            <span>Add Account</span>
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
              Team
            </Badge>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
