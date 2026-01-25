import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TierBadge } from "@/components/shared/TierBadge";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, LogOut, Orbit, Settings, User, Building2, Cloud, Plus, Lock, Check } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { useAccountContext } from "@/hooks/use-account-context";
import { TIER_LIMITS } from "@/types";

export function Header() {
  const navigate = useNavigate();
  const { user, org } = useAuthStore();
  const {
    currentAccountId,
    currentAccount,
    isOrgOverview,
    accounts,
    switchToAccount,
  } = useAccountContext();

  const tier = org?.tier || 'free';
  const tierLimits = TIER_LIMITS[tier];
  const canViewOrgOverview = tierLimits.canViewOrgOverview;
  const isTeamTier = tier === 'team';
  const hasAccounts = accounts.length > 0;

  const handleLogout = () => {
    // Clear local auth state first (before navigating away)
    setAccessToken(null);
    localStorage.removeItem('auth-storage');

    // Navigate directly to API logout endpoint (not through Vite proxy)
    // This is needed because the refresh_token cookie was set by the API directly
    // during OAuth callback, so it's stored for the API origin, not the frontend origin
    const apiUrl = import.meta.env.VITE_API_URL;
    let logoutUrl = "/api/auth/logout";

    if (apiUrl) {
      const normalized = apiUrl.trim().replace(/\/+$/, '');
      if (normalized.startsWith("/")) {
        logoutUrl = `${normalized}/auth/logout`;
      } else if (!normalized.includes("://")) {
        const isLocal = normalized.startsWith("localhost") || normalized.startsWith("127.0.0.1");
        logoutUrl = `${isLocal ? "http" : "https"}://${normalized}/auth/logout`;
      } else {
        logoutUrl = `${normalized}/auth/logout`;
      }
    }

    // Use GET navigation so the browser sends the cookie (SameSite=Lax allows GET navigations)
    window.location.href = logoutUrl;
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-12 items-center justify-between px-3 md:h-14 md:px-4">
        {/* Logo */}
        <a href="/dashboard" className="flex items-center gap-2 group">
          <Orbit className="h-6 w-6 text-cyber-cyan group-hover:animate-spin md:h-8 md:w-8" />
          <span className="text-lg font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent md:text-xl">
            ScanOrbit
          </span>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile Account Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden h-8 px-2 gap-1"
              >
                {isOrgOverview ? (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="max-w-[80px] truncate text-xs font-medium">
                  {isOrgOverview ? "All" : (currentAccount?.name || "Select")}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px]" align="end">
              <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Organization Overview option */}
              {canViewOrgOverview && (
                <DropdownMenuItem
                  onClick={() => switchToAccount(null)}
                  className={cn("cursor-pointer", isOrgOverview && "bg-accent")}
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
                  className={cn("cursor-pointer", currentAccountId === account.id && "bg-accent")}
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
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">Error</Badge>
                    )}
                    {currentAccountId === account.id && <Check className="h-4 w-4 shrink-0" />}
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
                <DropdownMenuItem onClick={() => navigate('/onboarding/aws')} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Add Account</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled className="cursor-not-allowed opacity-60">
                  <Lock className="mr-2 h-4 w-4" />
                  <span>Add Account</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">Team</Badge>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Org selector */}
          {org && (
            <div className="hidden items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:flex">
              <span className="font-medium">{org.name}</span>
              <TierBadge tier={org.tier || 'free'} />
            </div>
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">
                    {user ? getInitials(user.fullName || user.email) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-block">
                  {user?.fullName || user?.email}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
