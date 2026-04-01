import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookDeliveries,
} from "@/hooks/use-integrations";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const EVENT_TYPES = [
  { value: "scan.completed", label: "Scan Completed" },
  { value: "finding.new_critical", label: "New Critical Finding" },
  { value: "finding.new_high", label: "New High Finding" },
  { value: "weekly_digest", label: "Weekly Digest" },
] as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  "scan.completed": "Scan Completed",
  "finding.new_critical": "New Critical Finding",
  "finding.new_high": "New High Finding",
  "weekly_digest": "Weekly Digest",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateUrl(url: string, maxLength = 50) {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + "...";
}

function DeliveryStatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return <Badge variant="success">Success</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="warning">Pending</Badge>;
  }
  return <Badge variant="error">Failed</Badge>;
}

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { data, isLoading } = useWebhookDeliveries(webhookId);
  const deliveries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center">
        No deliveries yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Code</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.map((delivery: any) => (
          <TableRow key={delivery.id}>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(delivery.createdAt)}
            </TableCell>
            <TableCell className="text-xs">
              {EVENT_TYPE_LABELS[delivery.eventType] || delivery.eventType}
            </TableCell>
            <TableCell>
              <DeliveryStatusBadge status={delivery.status} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {delivery.statusCode ?? "---"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WebhookRow({
  webhook,
  isAdmin,
}: {
  webhook: any;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggleActive = async () => {
    try {
      await updateWebhook.mutateAsync({
        id: webhook.id,
        isActive: !webhook.isActive,
      });
      toast({
        title: webhook.isActive ? "Webhook paused" : "Webhook activated",
        type: "success",
      });
    } catch (err) {
      toast({
        title: "Failed to update webhook",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  const handleTest = async () => {
    try {
      const result = await testWebhook.mutateAsync(webhook.id);
      if (result.data.success) {
        toast({
          title: "Test delivery sent",
          description: `Status code: ${result.data.statusCode}`,
          type: "success",
        });
      } else {
        toast({
          title: "Test delivery failed",
          description: `Status code: ${result.data.statusCode}`,
          type: "error",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to send test",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWebhook.mutateAsync(webhook.id);
      toast({ title: "Webhook deleted", type: "success" });
      setConfirmDelete(false);
    } catch (err) {
      toast({
        title: "Failed to delete webhook",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <TableRow>
          <TableCell>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 text-left">
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-mono text-xs" title={webhook.url}>
                  {truncateUrl(webhook.url)}
                </span>
              </button>
            </CollapsibleTrigger>
            {webhook.description && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                {webhook.description}
              </p>
            )}
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {(webhook.eventTypes || []).map((evt: string) => (
                <Badge key={evt} variant="secondary" className="text-[10px]">
                  {EVENT_TYPE_LABELS[evt] || evt}
                </Badge>
              ))}
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={webhook.isActive ? "success" : "outline"}>
              {webhook.isActive ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleActive}
                    disabled={updateWebhook.isPending}
                    title={webhook.isActive ? "Pause webhook" : "Activate webhook"}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTest}
                    disabled={testWebhook.isPending}
                    title="Send test event"
                  >
                    <PlayCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleteWebhook.isPending}
                    title="Delete webhook"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="p-0">
            <CollapsibleContent>
              <div className="border-t bg-muted/20 px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Recent Deliveries
                </p>
                <DeliveryLog webhookId={webhook.id} />
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? All delivery history
              will be lost. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWebhook.isPending}
            >
              {deleteWebhook.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WebhookSettings() {
  const isAdmin = useIsAdmin();
  const { data, isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEventTypes, setNewEventTypes] = useState<string[]>([]);

  // Secret reveal state
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const webhooks = data?.data ?? [];

  const handleCreate = async () => {
    const url = newUrl.trim();
    if (!url || newEventTypes.length === 0) return;

    try {
      const result = await createWebhook.mutateAsync({
        url,
        eventTypes: newEventTypes,
        description: newDescription.trim() || undefined,
      });
      setRevealedSecret(result.data.secret);
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Webhook created", type: "success" });
    } catch (err) {
      toast({
        title: "Failed to create webhook",
        description: (err as Error).message,
        type: "error",
      });
    }
  };

  const resetForm = () => {
    setNewUrl("");
    setNewDescription("");
    setNewEventTypes([]);
  };

  const toggleEventType = (eventType: string) => {
    setNewEventTypes((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType]
    );
  };

  const handleCopySecret = async () => {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = revealedSecret;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Receive HTTP notifications when events occur in your organization
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowCreateDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Webhook
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Webhook className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No webhooks configured yet.
                {isAdmin && " Add one to start receiving event notifications."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook: any) => (
                  <WebhookRow
                    key={webhook.id}
                    webhook={webhook}
                    isAdmin={isAdmin}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure an endpoint to receive event notifications via HTTP POST.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-description">Description (optional)</Label>
              <Input
                id="webhook-description"
                placeholder="e.g., Production alerts channel"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Event Types</Label>
              <div className="space-y-2">
                {EVENT_TYPES.map((evt) => (
                  <Checkbox
                    key={evt.value}
                    id={`evt-${evt.value}`}
                    checked={newEventTypes.includes(evt.value)}
                    onChange={() => toggleEventType(evt.value)}
                    label={evt.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !newUrl.trim() ||
                newEventTypes.length === 0 ||
                createWebhook.isPending
              }
            >
              {createWebhook.isPending ? "Creating..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Reveal Dialog */}
      <Dialog
        open={!!revealedSecret}
        onOpenChange={() => {
          setRevealedSecret(null);
          setCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              Copy your webhook signing secret now. You will not be able to see
              it again. Use this to verify webhook payloads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded-md text-xs break-all font-mono select-all">
                {revealedSecret}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopySecret}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Store this secret securely. It will not be shown again.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedSecret(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
