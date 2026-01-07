import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    // Check auth status on mount
    if (!store.user && store.isAuthenticated) {
      store.checkAuth();
    }
  }, []);

  return store;
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      checkAuth();
    }
  }, [isAuthenticated, isLoading, checkAuth]);

  return { isAuthenticated, isLoading };
}
