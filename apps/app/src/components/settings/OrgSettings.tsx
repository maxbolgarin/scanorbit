import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import * as api from "@/lib/api";
import { Building2, Users } from "lucide-react";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
});

type OrgFormData = z.infer<typeof orgSchema>;

export function OrgSettings() {
  const { org, setOrg } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: org?.name || "",
    },
  });

  const handleSubmit = async (data: OrgFormData) => {
    setIsUpdating(true);
    try {
      const updatedOrg = await api.updateOrganization(data);
      setOrg(updatedOrg);
      toast({
        title: "Organization updated",
        description: "Your organization has been updated successfully.",
        type: "success",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description:
          err instanceof Error ? err.message : "Failed to update organization",
        type: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Org Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Details
          </CardTitle>
          <CardDescription>Manage your organization settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                {...form.register("name")}
                disabled={isUpdating}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {org?.createdAt && (
              <p className="text-sm text-muted-foreground">
                Created: {formatDateTime(org.createdAt)}
              </p>
            )}

            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <LoadingSpinner size="sm" className="mr-2" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Team Members - Future feature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>Invite and manage team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Coming Soon</p>
            <p className="text-sm text-muted-foreground">
              Team management will be available in a future update
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
