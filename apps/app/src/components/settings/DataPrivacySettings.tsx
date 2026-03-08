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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Download,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileJson,
  Shield,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function DataPrivacySettings() {
  const { user } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<api.DeletionRequest | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchDeletionStatus = async () => {
    try {
      const { requests } = await api.getDeletionStatus();
      // Find the most recent pending request
      const pendingRequest = requests.find((r) => r.status === "pending");
      setDeletionStatus(pendingRequest || null);
    } catch (error) {
      console.error("Failed to fetch deletion status:", error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchDeletionStatus();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportGdprData();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scanorbit-data-export-${user?.id || "user"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Data exported",
        description: "Your personal data has been downloaded successfully.",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export data",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm account deletion.",
        type: "error",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await api.requestAccountDeletion(deleteReason || undefined);

      toast({
        title: "Deletion scheduled",
        description: `Your account will be deleted on ${new Date(response.scheduledDeletionAt).toLocaleDateString()}. You can cancel this within 30 days.`,
        type: "success",
      });

      setShowDeleteDialog(false);
      setConfirmText("");
      setDeleteReason("");
      fetchDeletionStatus();
    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to request deletion",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!deletionStatus) return;

    setIsCancelling(true);
    try {
      await api.cancelDeletionRequest(deletionStatus.id);

      toast({
        title: "Deletion cancelled",
        description: "Your account deletion request has been cancelled.",
        type: "success",
      });

      setShowCancelDialog(false);
      setDeletionStatus(null);
    } catch (error) {
      toast({
        title: "Cancel failed",
        description: error instanceof Error ? error.message : "Failed to cancel deletion",
        type: "error",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const daysUntilDeletion = deletionStatus
    ? Math.ceil(
        (new Date(deletionStatus.scheduledDeletionAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Pending Deletion Alert */}
      {deletionStatus && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Deletion Scheduled</AlertTitle>
          <AlertDescription className="mt-2">
            <p>
              Your account is scheduled for deletion on{" "}
              <strong>{formatDate(deletionStatus.scheduledDeletionAt)}</strong>{" "}
              ({daysUntilDeletion} days remaining).
            </p>
            <p className="mt-2">
              You can cancel this request at any time before the scheduled date.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Deletion Request
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your personal data (GDPR Article 20 - Right to Data Portability)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <FileJson className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <h4 className="font-medium">Personal Data Export</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Includes your profile information, organization memberships, consent history, and recent activity logs.
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Account details (email, name)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Organization memberships
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Consent records
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Activity log (last 90 days)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Billing and subscription data
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Email marketing history
                  </li>
                </ul>
              </div>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download JSON
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Your Account
          </CardTitle>
          <CardDescription>
            Request permanent deletion of your account and all associated data (GDPR Article 17 - Right to Erasure)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h4 className="font-medium text-destructive">What happens when you delete your account?</h4>
              <ul className="text-sm mt-2 space-y-2">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>
                    <strong>30-day grace period:</strong> You can cancel the deletion request within 30 days
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                  <span>
                    <strong>Permanently deleted:</strong> Your account, profile, and organization memberships
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>
                    <strong>Anonymized:</strong> Audit logs (user ID removed, kept for compliance)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
                  <span>
                    <strong>Preserved:</strong> Consent records (required for GDPR proof of consent)
                  </span>
                </li>
              </ul>
            </div>

            {isLoadingStatus ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : deletionStatus ? (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/30 p-4 bg-amber-500/10">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-400">Deletion pending</p>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                      Scheduled for {formatDate(deletionStatus.scheduledDeletionAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/50">
                  {daysUntilDeletion} days left
                </Badge>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Request Account Deletion
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Privacy Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Privacy Rights
          </CardTitle>
          <CardDescription>
            Learn more about how we protect your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium">Privacy Policy</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            <a
              href="/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium">Cookie Policy</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Data Protection Contact</span>
              <p className="text-sm text-muted-foreground mt-1">
                For GDPR requests or privacy concerns: <a href="mailto:dpa@scanorbit.cloud" className="text-primary hover:underline">dpa@scanorbit.cloud</a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription>
              This action will schedule your account for permanent deletion. You have 30 days to cancel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-reason">Reason for leaving (optional)</Label>
              <textarea
                id="delete-reason"
                placeholder="Help us improve by sharing why you're leaving..."
                value={deleteReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeleteReason(e.target.value)}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <strong>DELETE</strong> to confirm
              </Label>
              <Input
                id="confirm-delete"
                placeholder="DELETE"
                value={confirmText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfirmText("");
                setDeleteReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={isDeleting || confirmText !== "DELETE"}
            >
              {isDeleting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Deletion Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Account Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your account deletion request? Your account will remain active.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Deletion Scheduled
            </Button>
            <Button
              type="button"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Deletion"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
