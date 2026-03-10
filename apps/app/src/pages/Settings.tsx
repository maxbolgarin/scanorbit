import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { ViewingSettings } from "@/components/settings/ViewingSettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { DataPrivacySettings } from "@/components/settings/DataPrivacySettings";
import { Settings2, Shield, SlidersHorizontal, CreditCard, FileText } from "lucide-react";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "general";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and organization settings
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
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
      </Tabs>
    </div>
  );
}
