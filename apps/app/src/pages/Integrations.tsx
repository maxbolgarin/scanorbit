import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebhookSettings } from "@/components/integrations/WebhookSettings";
import { SlackSettings } from "@/components/integrations/SlackSettings";
import { NotificationPreferences } from "@/components/integrations/NotificationPreferences";
import { Webhook, MessageSquare, Bell } from "lucide-react";

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "webhooks";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect ScanOrbit with your tools and configure notifications
        </p>
      </div>

      <Tabs
        defaultValue={defaultTab}
        className="space-y-6"
        onValueChange={(value) =>
          setSearchParams((prev) => {
            prev.set("tab", value);
            return prev;
          })
        }
      >
        <TabsList>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="slack" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Slack</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <WebhookSettings />
        </TabsContent>
        <TabsContent value="slack">
          <SlackSettings />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
}
