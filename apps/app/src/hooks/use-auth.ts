import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Hook to access auth store and auto-check auth on mount
 * when isAuthenticated is true but user data is missing (e.g., after page refresh)
 */
export function useAuth() {
  const store = useAuthStore();
  const hasCheckedRef = useRef(false);

  // Get stable reference to checkAuth
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // Check auth status on mount if authenticated flag is set but user is missing
    // This happens when page is refreshed (isAuthenticated persisted, user is not)
    if (!hasCheckedRef.current && !user && isAuthenticated) {
      hasCheckedRef.current = true;
      checkAuth();
    }
  }, [user, isAuthenticated, checkAuth]);

  return store;
}

/**
 * Hook that ensures user is authenticated, triggers checkAuth if not
 * Returns loading and authenticated states for UI rendering
 */
export function useRequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only check auth once if not authenticated and not already loading
    if (!hasCheckedRef.current && !isAuthenticated && !isLoading) {
      hasCheckedRef.current = true;
      checkAuth();
    }
  }, [isAuthenticated, isLoading, checkAuth]);

  return { isAuthenticated, isLoading };
}
