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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/use-api-keys";
import { useOrgMembers } from "@/hooks/use-members";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import type { ApiKeyInfo } from "@/types";

const MAX_API_KEYS = 5;

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(ts: string | null) {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

export function ApiKeySettings() {
  const { user } = useAuthStore();
  const { data: keys, isLoading } = useApiKeys();
  const { data: members } = useOrgMembers();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [keyName, setKeyName] = useState("");
  const [keyDescription, setKeyDescription] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKeyInfo | null>(null);

  // Determine if current user is admin
  const currentMember = members?.find((m) => m.userId === user?.id);
  const isAdmin = currentMember?.role === "admin";

  const handleCreate = async () => {
    const name = keyName.trim();
    if (!name) return;

    try {
      const result = await createApiKey.mutateAsync({
        name,
        description: keyDescription.trim() || undefined,
      });
      setRevealedKey(result.rawKey);
      setKeyName("");
      setKeyDescription("");
      toast({ title: "API key created", type: "success" });
    } catch (err) {
      toast({ title: "Failed to create API key", description: (err as Error).message, type: "error" });
    }
  };

  const handleRevoke = async () => {
    if (!confirmRevoke) return;
    try {
      await revokeApiKey.mutateAsync(confirmRevoke.id);
      toast({ title: "API key revoked", type: "success" });
      setConfirmRevoke(null);
    } catch (err) {
      toast({ title: "Failed to revoke API key", description: (err as Error).message, type: "error" });
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
    } catch {
      // Fallback for non-secure contexts (e.g., HTTP dev servers)
      const ta = document.createElement("textarea");
      ta.value = revealedKey;
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

  const keyCount = keys?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Key Usage Banner */}
      <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Using <strong>{keyCount}</strong> of <strong>{MAX_API_KEYS}</strong> API keys.
              API keys provide read-only access to your organization's data via the public API.
            </AlertDescription>
          </Alert>

          {/* Existing Keys */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Manage API keys for programmatic access to your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keyCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No API keys yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys?.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{key.name}</span>
                        {key.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{key.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        sk_live_{key.keyPrefix}...
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.creatorName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelative(key.lastUsedAt)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRevoke(key)}
                          disabled={revokeApiKey.isPending}
                          title="Revoke API key"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Key Form — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create API Key
            </CardTitle>
            <CardDescription>
              Create a new API key for programmatic access.
              {keyCount >= MAX_API_KEYS && " You've reached the maximum number of keys."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  placeholder="Key name (e.g., CI/CD Pipeline)"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="max-w-sm"
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
                <Button
                  onClick={handleCreate}
                  disabled={!keyName.trim() || createApiKey.isPending || keyCount >= MAX_API_KEYS}
                >
                  {createApiKey.isPending ? "Creating..." : "Create Key"}
                </Button>
              </div>
              <Input
                placeholder="Description (optional)"
                value={keyDescription}
                onChange={(e) => setKeyDescription(e.target.value)}
                className="max-w-sm"
                maxLength={500}
              />
              {keyCount >= MAX_API_KEYS && (
                <p className="text-sm text-muted-foreground">
                  <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-500" />
                  Maximum {MAX_API_KEYS} API keys per organization. Revoke an existing key to create a new one.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Reveal Dialog */}
      <Dialog open={!!revealedKey} onOpenChange={() => { setRevealedKey(null); setCopied(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded-md text-xs break-all font-mono select-all">
                {revealedKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Store this key securely. It will not be shown again.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => { setRevealedKey(null); setCopied(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!confirmRevoke} onOpenChange={() => setConfirmRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Revoke <strong>{confirmRevoke?.name}</strong>? Any applications using this key will
              immediately lose access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revokeApiKey.isPending}
            >
              {revokeApiKey.isPending ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
