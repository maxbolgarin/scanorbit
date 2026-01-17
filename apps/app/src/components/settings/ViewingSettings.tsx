import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useOrgSettings } from "@/hooks/use-org-settings";
import type { FindingType } from "@/types";
import {
  Tag,
  Eye,
  Plus,
  X,
  Shield,
  DollarSign,
  Key,
  CheckCircle,
} from "lucide-react";

// Finding types grouped by category
const FINDING_CATEGORIES: {
  key: string;
  label: string;
  icon: React.ElementType;
  types: { value: FindingType; label: string }[];
}[] = [
  {
    key: "security",
    label: "Security",
    icon: Shield,
    types: [
      { value: "unencrypted_resource", label: "Unencrypted Resource" },
      { value: "public_access", label: "Public Access" },
      { value: "permissive_security_group", label: "Permissive Security Group" },
      { value: "open_all_ports", label: "Open All Ports" },
      { value: "publicly_accessible_rds", label: "Publicly Accessible RDS" },
      { value: "public_snapshot", label: "Public Snapshot" },
      { value: "insecure_tls", label: "Insecure TLS" },
    ],
  },
  {
    key: "cost",
    label: "Cost",
    icon: DollarSign,
    types: [
      { value: "orphaned_volume", label: "Orphaned Volume" },
      { value: "orphaned_eip", label: "Orphaned EIP" },
      { value: "orphaned_snapshot", label: "Orphaned Snapshot" },
      { value: "orphaned_eni", label: "Orphaned ENI" },
      { value: "idle_load_balancer", label: "Idle Load Balancer" },
      { value: "unused_security_group", label: "Unused Security Group" },
      { value: "unused_resource", label: "Unused Resource" },
      { value: "stopped_instance", label: "Stopped Instance" },
      { value: "unused_log_group", label: "Unused Log Group" },
      { value: "idle_nat_gateway", label: "Idle NAT Gateway" },
      { value: "oversized_instance", label: "Oversized Instance" },
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    icon: CheckCircle,
    types: [
      { value: "data_residency_violation", label: "Data Residency Violation" },
      { value: "ssl_expiry", label: "SSL Expiry" },
      { value: "cloudtrail_disabled", label: "CloudTrail Disabled" },
      { value: "vpc_flow_logs_disabled", label: "VPC Flow Logs Disabled" },
      { value: "backup_not_configured", label: "Backup Not Configured" },
    ],
  },
  {
    key: "iam",
    label: "IAM",
    icon: Key,
    types: [
      { value: "old_access_key", label: "Old Access Key" },
      { value: "unused_access_key", label: "Unused Access Key" },
      { value: "unused_iam_role", label: "Unused IAM Role" },
      { value: "user_without_mfa", label: "User Without MFA" },
      { value: "root_account_usage", label: "Root Account Usage" },
      { value: "overly_permissive_policy", label: "Overly Permissive Policy" },
      { value: "cross_account_trust", label: "Cross Account Trust" },
    ],
  },
  {
    key: "tagging",
    label: "Tagging",
    icon: Tag,
    types: [{ value: "missing_tag", label: "Missing Tag" }],
  },
];

// All finding types for quick access
const ALL_FINDING_TYPES = FINDING_CATEGORIES.flatMap((cat) =>
  cat.types.map((t) => t.value)
);

export function ViewingSettings() {
  const {
    settings,
    isLoading,
    updateSettings,
  } = useOrgSettings();

  const [newTag, setNewTag] = useState("");

  // Auto-save helper
  const saveSettings = async (updates: {
    requiredTags?: string[];
    hiddenFindingTypes?: FindingType[];
    hideTrivial?: boolean;
  }) => {
    try {
      await updateSettings({
        requiredTags: updates.requiredTags ?? settings?.requiredTags ?? [],
        hiddenFindingTypes: updates.hiddenFindingTypes ?? settings?.hiddenFindingTypes ?? [],
        hideTrivial: updates.hideTrivial ?? settings?.hideTrivial ?? false,
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description:
          err instanceof Error ? err.message : "Failed to save settings",
        type: "error",
      });
    }
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && settings && !settings.requiredTags.includes(tag)) {
      const newTags = [...settings.requiredTags, tag];
      setNewTag("");
      saveSettings({ requiredTags: newTags });
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (settings) {
      const newTags = settings.requiredTags.filter((t) => t !== tag);
      saveSettings({ requiredTags: newTags });
    }
  };

  const handleToggleFindingType = (type: FindingType) => {
    if (settings) {
      const newHidden = settings.hiddenFindingTypes.includes(type)
        ? settings.hiddenFindingTypes.filter((t) => t !== type)
        : [...settings.hiddenFindingTypes, type];
      saveSettings({ hiddenFindingTypes: newHidden });
    }
  };

  const handleSelectAll = () => {
    saveSettings({ hiddenFindingTypes: [] });
  };

  const handleDeselectAll = () => {
    saveSettings({ hiddenFindingTypes: [...ALL_FINDING_TYPES] });
  };

  const handleToggleHideTrivial = (checked: boolean) => {
    saveSettings({ hideTrivial: checked });
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Global Filters
          </CardTitle>
          <CardDescription>
            Control what findings are displayed across the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideTrivial"
              checked={settings.hideTrivial}
              onChange={(e) => handleToggleHideTrivial(e.target.checked)}
            />
            <Label htmlFor="hideTrivial" className="cursor-pointer">
              Hide trivial severity findings
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Finding Types Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Finding Types Visibility</CardTitle>
          <CardDescription>
            Unchecked finding types will be hidden from all pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              Show All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
            >
              Hide All
            </Button>
          </div>

          {/* Categories */}
          {FINDING_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.key} className="space-y-3">
                <h4 className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4" />
                  {category.label}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {category.types.map((type) => {
                    const isVisible = !settings.hiddenFindingTypes.includes(type.value);
                    return (
                      <div
                        key={type.value}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={type.value}
                          checked={isVisible}
                          onChange={() => handleToggleFindingType(type.value)}
                        />
                        <Label
                          htmlFor={type.value}
                          className="cursor-pointer text-sm"
                        >
                          {type.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Required Tags - only show if missing_tag type is enabled */}
      {!settings.hiddenFindingTypes.includes("missing_tag") && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Required Tags
          </CardTitle>
          <CardDescription>
            Resources missing these tags will generate findings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.requiredTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
