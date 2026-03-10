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
import { Pencil } from "lucide-react";

const generalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64, "Name must be at most 64 characters"),
  orgName: z.string().min(2, "Organization name must be at least 2 characters").max(32, "Organization name must be at most 32 characters"),
});

type GeneralFormData = z.infer<typeof generalSchema>;

export function ProfileSettings() {
  const { user, org, updateUser, setOrg } = useAuthStore();
  const hasActiveSubscription = org?.tier === 'pro' || org?.tier === 'team';
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<GeneralFormData>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: user?.fullName || "",
      orgName: org?.name || "",
    },
  });

  const handleCancel = () => {
    form.reset({
      name: user?.fullName || "",
      orgName: org?.name || "",
    });
    setIsEditing(false);
  };

  const handleSubmit = async (data: GeneralFormData) => {
    setIsUpdating(true);
    try {
      const updatedUser = await api.updateProfile({ fullName: data.name });
      updateUser(updatedUser);

      const updatedOrg = await api.updateOrganization({ name: data.orgName });
      setOrg(updatedOrg);

      setIsEditing(false);
      toast({
        title: "Settings updated",
        description: "Your settings have been updated successfully.",
        type: "success",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Failed to update settings",
        type: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Your personal and organization details</CardDescription>
          </div>
          {!isEditing && !hasActiveSubscription && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...form.register("name")}
                disabled={!isEditing || isUpdating}
              />
              {hasActiveSubscription && (
                <p className="text-sm text-muted-foreground">
                  Name cannot be changed while you have an active subscription.
                </p>
              )}
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                {...form.register("orgName")}
                disabled={!isEditing || isUpdating}
              />
              {form.formState.errors.orgName && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.orgName.message}
                </p>
              )}
            </div>

            {org?.createdAt && (
              <p className="text-sm text-muted-foreground">
                Organization created: {formatDateTime(org.createdAt)}
              </p>
            )}

            {isEditing && (
              <div className="flex gap-2">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <LoadingSpinner size="sm" className="mr-2" />}
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isUpdating}>
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
