import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import * as api from "@/lib/api";

/**
 * Hook to fetch and cache subscription status for the current org.
 * Includes scan permissions with cooldown information.
 */
export function useSubscriptionStatus() {
  const org = useAuthStore((state) => state.org);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription", org?.id],
    queryFn: () => api.getSubscriptionStatus(org!.id),
    enabled: !!org?.id,
    // Refetch every 30 seconds to keep cooldown timer accurate
    refetchInterval: 30000,
    // Keep data fresh
    staleTime: 10000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  };

  return {
    status: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    // Convenience accessors
    canScan: query.data?.scanStatus?.canScan ?? true,
    scanReason: query.data?.scanStatus?.reason,
    cooldownEndsAt: query.data?.scanStatus?.cooldownEndsAt,
    tier: query.data?.tier ?? "free",
  };
}
