import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebhookSettings } from "@/components/integrations/WebhookSettings";
import { SlackSettings } from "@/components/integrations/SlackSettings";
import { NotificationPreferences } from "@/components/integrations/NotificationPreferences";
import { useAuthStore } from "@/stores/auth-store";
import { useSubscriptionStatus } from "@/hooks/use-subscription";
import { TIER_LIMITS } from "@/types";
import { Webhook, MessageSquare, Bell, Lock, Sparkles } from "lucide-react";

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "webhooks";
  const { org } = useAuthStore();
  const { status } = useSubscriptionStatus();
  const tier = org?.tier || "free";
  const canConfigure =
    TIER_LIMITS[tier].canConfigureWebhooks ||
    TIER_LIMITS[tier].canConfigureNotifications;

  const canStartTrial =
    status?.stripeEnabled &&
    status?.subscriptionStatus === "none" &&
    status?.tier === "free";

  if (!canConfigure) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect ScanOrbit with your tools
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Integrations</h3>
            <p className="mb-6 max-w-md text-muted-foreground">
              Configure webhooks, Slack notifications, and email alerts to stay
              informed about your infrastructure changes.
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              This feature is available on Pro and Team plans.
            </p>
            {canStartTrial ? (
              <div className="flex flex-col items-center gap-2">
                <Button asChild>
                  <Link to="/checkout?plan=pro">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start 7-Day Free Trial
                  </Link>
                </Button>
                <Button variant="link" size="sm" asChild>
                  <Link to="/settings?tab=subscription">View all plans</Link>
                </Button>
              </div>
            ) : (
              <Button asChild>
                <Link to="/settings?tab=subscription" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
