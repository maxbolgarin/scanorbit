import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  useSlackIntegration,
  useSlackChannels,
  useDisconnectSlack,
} from "@/hooks/use-integrations";
import * as api from "@/lib/api";
import { MessageSquare, Link2, Unlink } from "lucide-react";

const EVENT_TYPES = [
  { value: "scan.completed", label: "Scan Completed" },
  { value: "finding.new_critical", label: "New Critical Finding" },
  { value: "finding.new_high", label: "New High Finding" },
  { value: "weekly_digest", label: "Weekly Digest" },
] as const;

export function SlackSettings() {
  const isAdmin = useIsAdmin();
  const { data, isLoading } = useSlackIntegration();
  const { data: channelsData, refetch: refetchChannels } = useSlackChannels();
  const disconnectSlack = useDisconnectSlack();

  const integration = data?.data ?? null;
  const channels = channelsData?.data ?? [];

  const [mappings, setMappings] = useState<
    Record<string, { channelId: string; channelName: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Load existing mappings and fetch channels when connected
  useEffect(() => {
    if (integration?.isConnected) {
      refetchChannels();
      if (integration.channelMappings) {
        const existing: Record<
          string,
          { channelId: string; channelName: string }
        > = {};
        for (const mapping of integration.channelMappings) {
          existing[mapping.eventType] = {
            channelId: mapping.channelId,
            channelName: mapping.channelName,
          };
        }
        setMappings(existing);
      }
    }
  }, [integration?.isConnected, integration?.channelMappings, refetchChannels]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await api.getSlackAuthorizeUrl();
      const url = result.data.url;
      if (!url.startsWith('https://slack.com/')) {
        throw new Error('Invalid Slack authorization URL');
      }
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Failed to start Slack authorization",
        description: (err as Error).message,
        type: "error",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSlack.mutateAsync();
      setMappings({});
      setConfirmDisconnect(false);
      toast({ title: "Slack disconnected", type: "success" });
    } catch (err) {
      toast({
        title: "Failed to disconnect Slack",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  const handleChannelChange = (eventType: string, channelId: string) => {
    const channel = channels.find((c: any) => c.id === channelId);
    if (channel) {
      setMappings((prev) => ({
        ...prev,
        [eventType]: { channelId: channel.id, channelName: channel.name },
      }));
    }
  };

  const handleSaveMappings = async () => {
    const mappingList = Object.entries(mappings)
      .filter(([, v]) => v.channelId)
      .map(([eventType, v]) => ({
        eventType,
        channelId: v.channelId,
        channelName: v.channelName,
      }));

    setIsSaving(true);
    try {
      await api.updateSlackChannelMappings(mappingList);
      toast({ title: "Channel mappings saved", type: "success" });
    } catch (err) {
      toast({
        title: "Failed to save mappings",
        description: (err as Error).message,
        type: "error",
      });
    } finally {
      setIsSaving(false);
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Slack Integration
            </CardTitle>
            <CardDescription>
              Receive scan results and alerts directly in your Slack channels
            </CardDescription>
          </div>
          {integration?.isConnected && (
            <Badge variant="success">Connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!integration?.isConnected ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Connect your Slack workspace to receive notifications about scans
                and findings in your preferred channels.
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" />
                {isConnecting ? "Redirecting..." : "Add to Slack"}
              </Button>
            )}
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Only organization admins can connect Slack.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection info */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {integration.workspaceName || "Slack Workspace"}
                </p>
                {integration.installedBy && (
                  <p className="text-xs text-muted-foreground">
                    Installed by {integration.installedBy}
                  </p>
                )}
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDisconnect(true)}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              )}
            </div>

            <Separator />

            {/* Channel mappings */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Channel Mappings</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose which Slack channel receives each type of notification.
                </p>
              </div>

              <div className="space-y-3">
                {EVENT_TYPES.map((evt) => (
                  <div
                    key={evt.value}
                    className="flex items-center justify-between gap-4"
                  >
                    <Label className="text-sm min-w-[180px]">{evt.label}</Label>
                    <Select
                      value={mappings[evt.value]?.channelId || ""}
                      onValueChange={(value) =>
                        handleChannelChange(evt.value, value)
                      }
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((channel: any) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveMappings}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving ? "Saving..." : "Save Mappings"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Slack</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect Slack? All channel mappings
              will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDisconnect(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnectSlack.isPending}
            >
              {disconnectSlack.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
