import { useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAccountContextStore } from "@/stores/account-context-store";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import { useAuthStore } from "@/stores/auth-store";
import { TIER_LIMITS } from "@/types";

/**
 * Hook for managing account context across the application.
 * Syncs URL parameters with the account context store and provides
 * utilities for switching between accounts.
 */
export function useAccountContext() {
  const { accountId } = useParams<{ accountId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts } = useAwsAccounts();
  const { org } = useAuthStore();
  const { currentAccountId, setCurrentAccount } = useAccountContextStore();

  // Get tier limits
  const tier = org?.tier || 'free';
  const tierLimits = TIER_LIMITS[tier];
  const canViewOrgOverview = tierLimits.canViewOrgOverview;

  // Sync URL param to store when route changes
  useEffect(() => {
    if (accountId && accountId !== currentAccountId) {
      // Validate account exists
      const accountExists = accounts.some((a) => a.id === accountId);
      if (accountExists) {
        setCurrentAccount(accountId);
      } else if (accounts.length > 0) {
        // Account doesn't exist, redirect to overview or first account based on tier
        if (canViewOrgOverview) {
          navigate("/overview", { replace: true });
        } else {
          navigate(`/accounts/${accounts[0].id}`, { replace: true });
        }
      }
    } else if (!accountId && location.pathname.startsWith("/overview")) {
      // We're in overview mode
      if (!canViewOrgOverview && accounts.length > 0) {
        // Free/Pro tier users can't view org overview, redirect to first account
        const pagePart = location.pathname.replace("/overview", "");
        navigate(`/accounts/${accounts[0].id}${pagePart}`, { replace: true });
      } else if (currentAccountId !== null) {
        // Team tier - ensure store reflects overview mode
        setCurrentAccount(null);
      }
    }
  }, [accountId, accounts, currentAccountId, setCurrentAccount, navigate, location.pathname, canViewOrgOverview]);

  /**
   * Switch to a different account or overview mode.
   * Navigates to the equivalent page in the new context.
   */
  const switchToAccount = useCallback(
    (newAccountId: string | null) => {
      setCurrentAccount(newAccountId);
      const currentPath = location.pathname;

      if (newAccountId === null) {
        // Switch to overview
        if (currentPath.includes("/accounts/")) {
          // Extract the page part after the account ID
          const match = currentPath.match(/\/accounts\/[^/]+(.*)$/);
          const pagePart = match?.[1] || "";
          navigate(`/overview${pagePart}`);
        } else {
          navigate("/overview");
        }
      } else {
        // Switch to specific account
        if (currentPath.startsWith("/overview")) {
          const pagePart = currentPath.replace("/overview", "");
          navigate(`/accounts/${newAccountId}${pagePart}`);
        } else if (currentPath.includes("/accounts/")) {
          // Replace current account ID with new one
          const newPath = currentPath.replace(
            /\/accounts\/[^/]+/,
            `/accounts/${newAccountId}`
          );
          navigate(newPath);
        } else {
          navigate(`/accounts/${newAccountId}`);
        }
      }
    },
    [location.pathname, navigate, setCurrentAccount]
  );

  // Find the current account object
  const currentAccount = useMemo(
    () => accounts.find((a) => a.id === currentAccountId),
    [accounts, currentAccountId]
  );

  // Determine if we're in organization overview mode
  const isOrgOverview = currentAccountId === null;

  // Get the effective account ID for API calls
  // Returns undefined if in overview mode (no filtering)
  const effectiveAccountId = isOrgOverview ? undefined : currentAccountId;

  return {
    /** Current account ID, null if in overview mode */
    currentAccountId,
    /** Current account object, undefined if in overview mode */
    currentAccount,
    /** Whether we're viewing organization overview (all accounts) */
    isOrgOverview,
    /** All connected AWS accounts */
    accounts,
    /** Switch to a different account or null for overview */
    switchToAccount,
    /** Account ID to use for API filtering, undefined if overview */
    effectiveAccountId,
  };
}

/**
 * Simplified hook that just returns the effective account ID for API calls.
 * Use this in data-fetching hooks that need to filter by account.
 */
export function useEffectiveAccountId(): string | undefined {
  const { accountId } = useParams<{ accountId?: string }>();
  const location = useLocation();

  // If we're on an account-specific route, use that account ID
  if (accountId) {
    return accountId;
  }

  // If we're on overview routes, return undefined (no filtering)
  if (location.pathname.startsWith("/overview")) {
    return undefined;
  }

  // For other routes (settings, accounts management, etc.), return undefined
  return undefined;
}
