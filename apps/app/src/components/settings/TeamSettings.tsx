import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import {
  useOrgMembers,
  useOrgInvitations,
  useSeatInfo,
  useInviteMember,
  useCancelInvitation,
  useResendInvitation,
  useRemoveMember,
  useChangeMemberRole,
} from "@/hooks/use-members";
import { Users, UserPlus, Trash2, Mail, AlertTriangle, RotateCcw } from "lucide-react";
import type { OrgMember } from "@/types";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TeamSettings() {
  const { user, org } = useAuthStore();
  const { data: members, isLoading: membersLoading } = useOrgMembers();
  const { data: invitations, isLoading: invitationsLoading } = useOrgInvitations();
  const { data: seatInfo } = useSeatInfo();

  const inviteMember = useInviteMember();
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();
  const removeMember = useRemoveMember();
  const changeMemberRole = useChangeMemberRole();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "remove" | "paid-seat" | "role-change";
    member?: OrgMember & { email: string; fullName: string | null };
    email?: string;
    targetRole?: "admin" | "member";
  } | null>(null);

  // Determine if current user is admin
  const currentMember = members?.find((m) => m.userId === user?.id);
  const isAdmin = currentMember?.role === "admin";
  const adminCount = members?.filter((m) => m.role === "admin").length ?? 0;

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;

    // Check if this will add a paid seat
    if (seatInfo && seatInfo.totalMembers >= seatInfo.includedSeats) {
      setConfirmDialog({ type: "paid-seat", email });
      return;
    }

    await submitInvite(email);
  };

  const submitInvite = async (email: string) => {
    try {
      await inviteMember.mutateAsync({ email, role: inviteRole });
      toast({ title: "Invitation sent", description: `Invitation sent to ${email}`, type: "success" });
      setInviteEmail("");
      setConfirmDialog(null);
    } catch (err) {
      toast({ title: "Failed to send invitation", description: (err as Error).message, type: "error" });
    }
  };

  const handleCancel = async (invitationId: string) => {
    try {
      await cancelInvitation.mutateAsync(invitationId);
      toast({ title: "Invitation canceled", type: "success" });
    } catch (err) {
      toast({ title: "Failed to cancel invitation", description: (err as Error).message, type: "error" });
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      await resendInvitation.mutateAsync(invitationId);
      toast({ title: "Invitation resent", type: "success" });
    } catch (err) {
      toast({ title: "Failed to resend invitation", description: (err as Error).message, type: "error" });
    }
  };

  const handleRemove = async (member: OrgMember & { email: string; fullName: string | null }) => {
    setConfirmDialog({ type: "remove", member });
  };

  const confirmRemove = async () => {
    if (!confirmDialog?.member) return;
    try {
      await removeMember.mutateAsync(confirmDialog.member.userId);
      toast({ title: "Member removed", type: "success" });
      setConfirmDialog(null);
    } catch (err) {
      toast({ title: "Failed to remove member", description: (err as Error).message, type: "error" });
    }
  };

  const handleRoleChange = (
    member: OrgMember & { email: string; fullName: string | null },
    targetRole: "admin" | "member"
  ) => {
    setConfirmDialog({ type: "role-change", member, targetRole });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog?.member || !confirmDialog?.targetRole) return;
    try {
      await changeMemberRole.mutateAsync({
        userId: confirmDialog.member.userId,
        role: confirmDialog.targetRole,
      });
      toast({ title: "Role updated", type: "success" });
      setConfirmDialog(null);
    } catch (err) {
      toast({ title: "Failed to update role", description: (err as Error).message, type: "error" });
    }
  };

  if (membersLoading || invitationsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seat Usage Banner */}
      {seatInfo && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            Using <strong>{seatInfo.totalMembers}</strong> of{" "}
            <strong>{seatInfo.includedSeats}</strong> included seats.
            {seatInfo.paidSeats > 0 && (
              <> {seatInfo.paidSeats} paid seat{seatInfo.paidSeats !== 1 ? "s" : ""} at ${seatInfo.seatPriceMonthly}/mo each.</>
            )}
            {seatInfo.pendingInvitations > 0 && (
              <> {seatInfo.pendingInvitations} pending invitation{seatInfo.pendingInvitations !== 1 ? "s" : ""}.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>
            People with access to {org?.name || "this organization"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead className="w-[140px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => {
                const isCurrentUser = member.userId === user?.id;
                const isLastAdmin = member.role === "admin" && adminCount <= 1;
                const m = member as OrgMember & { email: string; fullName: string | null };
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      {m.fullName || "—"}
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          {!isLastAdmin && !(isCurrentUser && member.role === "admin") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRoleChange(m, member.role === "admin" ? "member" : "admin")
                              }
                              disabled={changeMemberRole.isPending}
                            >
                              {member.role === "admin" ? "Demote" : "Promote"}
                            </Button>
                          )}
                          {!isCurrentUser && !isLastAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(m)}
                              disabled={removeMember.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {isAdmin && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.inviterName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResend(inv.id)}
                          disabled={resendInvitation.isPending}
                          title="Resend invitation"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(inv.id)}
                          disabled={cancelInvitation.isPending}
                          title="Cancel invitation"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Form — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Member
            </CardTitle>
            <CardDescription>
              Send an invitation to join {org?.name || "this organization"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="max-w-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
              />
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "admin" | "member")}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviteMember.isPending}
              >
                {inviteMember.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
            {seatInfo && seatInfo.totalMembers >= seatInfo.includedSeats && (
              <p className="mt-2 text-sm text-muted-foreground">
                <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-500" />
                Adding a new member will add a paid seat (${seatInfo.seatPriceMonthly}/mo).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialogs */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          {confirmDialog?.type === "remove" && confirmDialog.member && (
            <>
              <DialogHeader>
                <DialogTitle>Remove member</DialogTitle>
                <DialogDescription>
                  Remove {confirmDialog.member.fullName || confirmDialog.member.email} from{" "}
                  {org?.name}? They will lose access to all organization resources immediately.
                  {seatInfo && seatInfo.paidSeats > 0 && (
                    <> Your monthly bill will decrease by ${seatInfo.seatPriceMonthly}/mo.</>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmRemove}
                  disabled={removeMember.isPending}
                >
                  {removeMember.isPending ? "Removing..." : "Remove Member"}
                </Button>
              </DialogFooter>
            </>
          )}
          {confirmDialog?.type === "role-change" && confirmDialog.member && confirmDialog.targetRole && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmDialog.targetRole === "admin" ? "Promote to admin" : "Demote to member"}
                </DialogTitle>
                <DialogDescription>
                  {confirmDialog.targetRole === "admin"
                    ? `Promote ${confirmDialog.member.fullName || confirmDialog.member.email} to admin? They will gain full administrative access to ${org?.name}.`
                    : `Demote ${confirmDialog.member.fullName || confirmDialog.member.email} to member? They will lose administrative privileges in ${org?.name}.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={confirmDialog.targetRole === "admin" ? "default" : "destructive"}
                  onClick={confirmRoleChange}
                  disabled={changeMemberRole.isPending}
                >
                  {changeMemberRole.isPending
                    ? "Updating..."
                    : confirmDialog.targetRole === "admin"
                      ? "Promote"
                      : "Demote"}
                </Button>
              </DialogFooter>
            </>
          )}
          {confirmDialog?.type === "paid-seat" && confirmDialog.email && (
            <>
              <DialogHeader>
                <DialogTitle>Paid seat required</DialogTitle>
                <DialogDescription>
                  Your Team plan includes {seatInfo?.includedSeats} members. You currently have{" "}
                  {seatInfo?.totalMembers} active members. Adding {confirmDialog.email} will add
                  a paid seat at ${seatInfo?.seatPriceMonthly}/month. The charge will apply when the invitation is accepted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => submitInvite(confirmDialog.email!)}
                  disabled={inviteMember.isPending}
                >
                  {inviteMember.isPending
                    ? "Sending..."
                    : `Send Invite — $${seatInfo?.seatPriceMonthly}/mo extra`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
