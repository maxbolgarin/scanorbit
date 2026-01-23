import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, Building2 } from "lucide-react";
import { createOrg, setAccessToken, type JobTitle } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const JOB_TITLES: { value: JobTitle; label: string }[] = [
  { value: "devops", label: "DevOps Engineer" },
  { value: "cto", label: "CTO / Tech Lead" },
  { value: "developer", label: "Developer" },
  { value: "security", label: "Security Engineer" },
  { value: "personal", label: "Personal Use" },
  { value: "other", label: "Other" },
];

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(64, "Name must be at most 64 characters"),
  orgName: z.string().min(2, "Organization name must be at least 2 characters").max(32, "Organization name must be at most 32 characters"),
  title: z.enum(["devops", "cto", "developer", "security", "personal", "other"]).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileStepProps {
  onComplete: () => void;
}

export function ProfileStep({ onComplete }: ProfileStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setOrg } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const title = watch("title");

  const onSubmit = async (data: ProfileFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const { org, accessToken } = await createOrg({
        orgName: data.orgName,
        fullName: data.fullName,
        title: data.title,
      });
      // Store the new access token that contains the org ID
      setAccessToken(accessToken);
      // Update auth store with the new org
      setOrg(org);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Complete your profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us a bit about yourself and your organization
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Your Name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Smith"
            autoFocus
            {...register("fullName")}
            disabled={isLoading}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="orgName">Organization Name</Label>
          <Input
            id="orgName"
            type="text"
            placeholder="Acme Inc."
            {...register("orgName")}
            disabled={isLoading}
          />
          {errors.orgName && (
            <p className="text-sm text-destructive">{errors.orgName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">What best describes your role?</Label>
          <Select
            value={title}
            onValueChange={(value) => setValue("title", value as JobTitle)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TITLES.map((job) => (
                <SelectItem key={job.value} value={job.value}>
                  {job.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This helps us personalize your experience
          </p>
        </div>

      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Creating organization...
          </>
        ) : (
          "Get Started"
        )}
      </Button>
    </form>
  );
}
