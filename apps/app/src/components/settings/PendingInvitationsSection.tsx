import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import * as api from "@/lib/api";
import { setAccessToken } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Mail } from "lucide-react";

export function PendingInvitationsSection() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const [processingToken, setProcessingToken] = useState<string | null>(null);

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["my-pending-invitations"],
    queryFn: () => api.getMyPendingInvitations(),
  });

  const declineMutation = useMutation({
    mutationFn: (token: string) => api.declineInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-pending-invitations"] });
      toast({ title: "Invitation declined", type: "success" });
    },
    onError: (err) => {
      toast({
        title: "Failed to decline invitation",
        description: err instanceof Error ? err.message : "Please try again",
        type: "error",
      });
    },
    onSettled: () => setProcessingToken(null),
  });

  const handleAccept = async (token: string) => {
    setProcessingToken(token);
    try {
      const { accessToken } = await api.acceptInvitation(token);
      setAccessToken(accessToken);
      await refreshAuth();
      await queryClient.invalidateQueries({ queryKey: ["my-pending-invitations"] });
      toast({ title: "Joined organization successfully!", type: "success" });
      navigate("/overview", { replace: true });
    } catch (err) {
      toast({
        title: "Failed to accept invitation",
        description: err instanceof Error ? err.message : "Please try again",
        type: "error",
      });
      setProcessingToken(null);
    }
  };

  const handleDecline = (token: string) => {
    setProcessingToken(token);
    declineMutation.mutate(token);
  };

  if (isLoading || !invitations || invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Pending Invitations</CardTitle>
        </div>
        <CardDescription>
          You have been invited to join {invitations.length === 1 ? "an organization" : "organizations"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-lg border p-4 gap-4"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{inv.orgName}</span>
                <Badge variant="secondary" className="capitalize shrink-0">
                  {inv.role}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Invited by {inv.inviterName || "a team admin"}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {formatDateTime(inv.expiresAt)}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handleAccept(inv.token)}
                disabled={processingToken === inv.token}
              >
                {processingToken === inv.token ? (
                  <LoadingSpinner size="sm" className="mr-1" />
                ) : null}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(inv.token)}
                disabled={processingToken === inv.token}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
