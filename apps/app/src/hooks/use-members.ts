import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function useOrgMembers() {
  const org = useAuthStore((s) => s.org);

  return useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => api.getOrgMembers(org!.id),
    enabled: !!org?.id,
  });
}

export function useOrgInvitations() {
  const org = useAuthStore((s) => s.org);

  return useQuery({
    queryKey: ["org-invitations", org?.id],
    queryFn: () => api.getOrgInvitations(org!.id),
    enabled: !!org?.id,
  });
}

export function useSeatInfo() {
  const org = useAuthStore((s) => s.org);

  return useQuery({
    queryKey: ["seat-info", org?.id],
    queryFn: () => api.getSeatInfo(org!.id),
    enabled: !!org?.id,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: "admin" | "member" }) =>
      api.createInvitation(org!.id, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations", org?.id] });
      queryClient.invalidateQueries({ queryKey: ["seat-info", org?.id] });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: (invitationId: string) => api.cancelInvitation(org!.id, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations", org?.id] });
    },
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: (invitationId: string) => api.resendInvitation(org!.id, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations", org?.id] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: (userId: string) => api.removeMember(org!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", org?.id] });
      queryClient.invalidateQueries({ queryKey: ["seat-info", org?.id] });
    },
  });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.org);

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "member" }) =>
      api.changeMemberRole(org!.id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", org?.id] });
    },
  });
}
