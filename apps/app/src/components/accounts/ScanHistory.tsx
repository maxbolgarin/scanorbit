import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { useScanHistory } from "@/hooks/use-aws-accounts";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { CheckCircle2, Clock, XCircle, PlayCircle } from "lucide-react";
import type { ScanStatus } from "@/types";

interface ScanHistoryProps {
  accountId: string | null;
  accountName?: string;
  onClose: () => void;
}

const statusIcons: Record<ScanStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  running: <PlayCircle className="h-4 w-4 text-blue-500 animate-pulse" />,
  complete: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabels: Record<ScanStatus, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Completed",
  error: "Failed",
};

export function ScanHistory({ accountId, accountName, onClose }: ScanHistoryProps) {
  const { data: scans, isLoading } = useScanHistory(accountId || "");

  return (
    <Dialog open={!!accountId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan History{accountName && ` - ${accountName}`}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : scans && scans.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="flex items-start justify-between rounded-lg border p-3"
              >
                <div className="flex items-start gap-3">
                  {statusIcons[scan.status]}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {statusLabels[scan.status]}
                      </span>
                      {scan.status === "complete" && (
                        <Badge variant="secondary" className="text-xs">
                          {scan.resourcesDiscovered} resources
                        </Badge>
                      )}
                    </div>
                    {scan.startedAt && (
                      <p className="text-sm text-muted-foreground">
                        Started: {formatDateTime(scan.startedAt)}
                      </p>
                    )}
                    {scan.completedAt && (
                      <p className="text-sm text-muted-foreground">
                        Completed: {formatDateTime(scan.completedAt)}
                      </p>
                    )}
                    {scan.errorMessage && (
                      <p className="text-sm text-red-600">{scan.errorMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No scan history available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
