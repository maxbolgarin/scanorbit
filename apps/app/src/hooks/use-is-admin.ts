import { useAuthStore } from "@/stores/auth-store";

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.org?.role === "admin");
}
