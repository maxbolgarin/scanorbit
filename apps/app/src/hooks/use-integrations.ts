import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";

export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.getWebhooks(),
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { url: string; eventTypes: string[]; description?: string }) =>
      api.createWebhook(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhooks"] }); },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...params }: { id: string; url?: string; eventTypes?: string[]; isActive?: boolean; description?: string }) =>
      api.updateWebhook(id, params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhooks"] }); },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWebhook(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhooks"] }); },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => api.testWebhook(id),
  });
}

export function useWebhookDeliveries(webhookId: string, page = 1) {
  return useQuery({
    queryKey: ["webhook-deliveries", webhookId, page],
    queryFn: () => api.getWebhookDeliveries(webhookId, page),
    enabled: !!webhookId,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.getNotificationPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { digestFrequency?: string; timezone?: string; notifyScanComplete?: boolean; notifyCriticalFindings?: boolean; notifyHighFindings?: boolean }) =>
      api.updateNotificationPreferences(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }); },
  });
}

export function useSlackIntegration() {
  return useQuery({
    queryKey: ["slack-integration"],
    queryFn: () => api.getSlackIntegration(),
  });
}

export function useSlackChannels() {
  return useQuery({
    queryKey: ["slack-channels"],
    queryFn: () => api.getSlackChannels(),
    enabled: false, // manually triggered
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectSlack(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["slack-integration"] }); },
  });
}
