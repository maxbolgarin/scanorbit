import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Mail, Calendar, Users, Crown } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";
import { TIER_LIMITS } from "@/types";
import * as api from "@/lib/api";

export default function Profile() {
  const { user, org } = useAuthStore();
  const tier = org?.tier || "free";
  const canViewMembers = TIER_LIMITS[tier].canInviteMembers;

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => api.getOrgMembers(org!.id),
    enabled: !!org?.id && canViewMembers,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">View your team information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">
                {user ? getInitials(user.fullName || user.email) : "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div>
                <h2 className="text-xl font-semibold">
                  {user?.fullName || "No name set"}
                </h2>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
                  <Mail className="h-4 w-4" />
                  <span>{user?.email}</span>
                </div>

                {user?.createdAt && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {formatDate(user.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
            {members && (
              <Badge variant="secondary" className="ml-1">{members.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Members of your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {!canViewMembers ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Team Management</p>
              <p className="text-sm text-muted-foreground">
                Upgrade to the Team plan to view and manage team members.
              </p>
            </div>
          ) : membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : !members || members.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No members found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.user?.fullName || member.user?.email || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {member.user?.fullName || "No name"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.user?.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                          {member.role === "admin" && <Crown className="mr-1 h-3 w-3" />}
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
