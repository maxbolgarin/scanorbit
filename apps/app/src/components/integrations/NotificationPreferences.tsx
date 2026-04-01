import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-integrations";
import { Bell } from "lucide-react";

const DIGEST_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
] as const;

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "US/Eastern", label: "US/Eastern" },
  { value: "US/Central", label: "US/Central" },
  { value: "US/Mountain", label: "US/Mountain" },
  { value: "US/Pacific", label: "US/Pacific" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
] as const;

function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-primary" : "bg-muted-foreground/30"}
      `}
    >
      <span
        className={`
          pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform
          ${checked ? "translate-x-4" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}

export function NotificationPreferences() {
  const { data, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [digestFrequency, setDigestFrequency] = useState("weekly");
  const [timezone, setTimezone] = useState("UTC");
  const [notifyScanComplete, setNotifyScanComplete] = useState(true);
  const [notifyCriticalFindings, setNotifyCriticalFindings] = useState(true);
  const [notifyHighFindings, setNotifyHighFindings] = useState(true);

  // Pre-populate from server data
  useEffect(() => {
    if (data?.data) {
      const prefs = data.data;
      if (prefs.digestFrequency) setDigestFrequency(prefs.digestFrequency);
      if (prefs.timezone) setTimezone(prefs.timezone);
      if (prefs.notifyScanComplete !== undefined)
        setNotifyScanComplete(prefs.notifyScanComplete);
      if (prefs.notifyCriticalFindings !== undefined)
        setNotifyCriticalFindings(prefs.notifyCriticalFindings);
      if (prefs.notifyHighFindings !== undefined)
        setNotifyHighFindings(prefs.notifyHighFindings);
    }
  }, [data?.data]);

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync({
        digestFrequency,
        timezone,
        notifyScanComplete,
        notifyCriticalFindings,
        notifyHighFindings,
      });
      toast({ title: "Notification preferences saved", type: "success" });
    } catch (err) {
      toast({
        title: "Failed to save preferences",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Configure how and when you receive notifications about your
          infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Digest frequency */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Digest Frequency</Label>
          <div className="flex gap-2" role="radiogroup" aria-label="Digest frequency">
            {DIGEST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={digestFrequency === opt.value}
                onClick={() => setDigestFrequency(opt.value)}
                className={`
                  rounded-md border px-4 py-2 text-sm font-medium transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  ${
                    digestFrequency === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label htmlFor="timezone-select" className="text-sm font-medium">
            Timezone
          </Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone-select" className="w-[280px]">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Toggle switches */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Alert Types</Label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="notify-scan-complete"
                className="text-sm text-foreground cursor-pointer"
              >
                Scan completed notifications
              </Label>
              <ToggleSwitch
                id="notify-scan-complete"
                checked={notifyScanComplete}
                onChange={setNotifyScanComplete}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label
                htmlFor="notify-critical"
                className="text-sm text-foreground cursor-pointer"
              >
                New critical findings
              </Label>
              <ToggleSwitch
                id="notify-critical"
                checked={notifyCriticalFindings}
                onChange={setNotifyCriticalFindings}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label
                htmlFor="notify-high"
                className="text-sm text-foreground cursor-pointer"
              >
                New high severity findings
              </Label>
              <ToggleSwitch
                id="notify-high"
                checked={notifyHighFindings}
                onChange={setNotifyHighFindings}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updatePreferences.isPending}
            size="sm"
          >
            {updatePreferences.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
