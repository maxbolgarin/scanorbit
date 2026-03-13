import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function useApiKeys() {
  const org = useAuthStore((s) => s.org);

  return useQuery({
    queryKey: ["api-keys", org?.id],
    queryFn: () => api.getApiKeys(org!.id),
    enabled: !!org?.id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      api.createApiKey(org!.id, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", org?.id] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: (keyId: string) => api.revokeApiKey(org!.id, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", org?.id] });
    },
  });
}
