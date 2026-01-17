import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useResourceScanHistory } from "@/hooks/use-resources";
import { formatDateTime } from "@/lib/utils";
import { Clock, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ResourceScanStatus } from "@/types";

interface ResourceScanHistoryProps {
  resourceId: string;
}

function StatusBadge({ status }: { status: ResourceScanStatus }) {
  switch (status) {
    case "new":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Plus className="mr-1 h-3 w-3" />
          New
        </Badge>
      );
    case "updated":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <RefreshCw className="mr-1 h-3 w-3" />
          Updated
        </Badge>
      );
    case "removed":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <Trash2 className="mr-1 h-3 w-3" />
          Removed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ResourceScanHistory({ resourceId }: ResourceScanHistoryProps) {
  const { data: history, isLoading } = useResourceScanHistory(resourceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Scan History
        </CardTitle>
        <CardDescription>
          Resource lifecycle across scan cycles
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : history && history.length > 0 ? (
          <div className="space-y-3">
            {history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {formatDateTime(item.scanCompletedAt || item.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">
                    {item.resourcesDiscovered} resources
                  </span>
                  {item.resourcesDelta !== 0 && (
                    <span
                      className={`ml-2 ${
                        item.resourcesDelta > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      ({item.resourcesDelta > 0 ? "+" : ""}
                      {item.resourcesDelta})
                    </span>
                  )}
                </div>
              </div>
            ))}
            {history.length > 10 && (
              <p className="text-center text-sm text-muted-foreground">
                Showing 10 of {history.length} entries
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No scan history available for this resource
          </p>
        )}
      </CardContent>
    </Card>
  );
}
