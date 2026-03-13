import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { ViewingSettings } from "@/components/settings/ViewingSettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { DataPrivacySettings } from "@/components/settings/DataPrivacySettings";
import { AuditLogSettings } from "@/components/settings/AuditLogSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { ApiKeySettings } from "@/components/settings/ApiKeySettings";
import { useAuthStore } from "@/stores/auth-store";
import { TIER_LIMITS } from "@/types";
import { Settings2, Shield, SlidersHorizontal, CreditCard, FileText, ScrollText, Users, Code } from "lucide-react";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "general";
  const { org } = useAuthStore();
  const tier = org?.tier || 'free';
  const canInviteMembers = TIER_LIMITS[tier].canInviteMembers;
  const canViewAuditLogs = TIER_LIMITS[tier].canViewAuditLogs;
  const canUseApiKeys = TIER_LIMITS[tier].canUseApiKeys;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and organization settings
        </p>
      </div>

      <Tabs
        defaultValue={defaultTab}
        className="space-y-6"
        onValueChange={(value) =>
          setSearchParams((prev) => { prev.set("tab", value); return prev; })
        }
      >
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="viewing" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Viewing</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Data & Privacy</span>
          </TabsTrigger>
          {canInviteMembers && (
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
          )}
          {canUseApiKeys && (
            <TabsTrigger value="api" className="gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
          )}
          {canViewAuditLogs && (
            <TabsTrigger value="audit" className="gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="viewing">
          <ViewingSettings />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionSettings />
        </TabsContent>

        <TabsContent value="privacy">
          <DataPrivacySettings />
        </TabsContent>

        {canInviteMembers && (
          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>
        )}

        {canUseApiKeys && (
          <TabsContent value="api">
            <ApiKeySettings />
          </TabsContent>
        )}

        {canViewAuditLogs && (
          <TabsContent value="audit">
            <AuditLogSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
