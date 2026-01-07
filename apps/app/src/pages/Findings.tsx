import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FindingFilters } from "@/components/findings/FindingFilters";
import { FindingsTable } from "@/components/findings/FindingsTable";
import { FindingDetailModal } from "@/components/findings/FindingDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useFindings, useUpdateFindingStatus, useFindingCounts } from "@/hooks/use-findings";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { FindingFilters as Filters, Finding, FindingStatus } from "@/types";
import { AlertTriangle } from "lucide-react";

export default function Findings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({});
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const { data: findings, isLoading } = useFindings(filters);
  const counts = useFindingCounts();
  const updateStatus = useUpdateFindingStatus();

  // Handle URL parameter for opening finding detail
  useEffect(() => {
    const findingId = searchParams.get("id");
    if (findingId && findings) {
      const finding = findings.find((f) => f.id === findingId);
      if (finding) {
        setSelectedFinding(finding);
      }
    }
  }, [searchParams, findings]);

  const handleSelectFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    setSearchParams({ id: finding.id });
  };

  const handleCloseModal = () => {
    setSelectedFinding(null);
    setSearchParams({});
  };

  const handleUpdateStatus = async (
    id: string,
    status: FindingStatus,
    snoozeDays?: number
  ) => {
    try {
      await updateStatus.mutateAsync({ id, status, snoozeDays });
      toast({
        title: "Finding updated",
        description: `Finding marked as ${status}`,
        type: "success",
      });
      handleCloseModal();
    } catch {
      toast({
        title: "Update failed",
        description: "Failed to update finding status",
        type: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Findings</h1>
          <p className="text-muted-foreground">
            Security and cost optimization issues
          </p>
        </div>
        <div className="flex gap-2">
          {counts.high > 0 && (
            <Badge variant="error">{counts.high} High</Badge>
          )}
          {counts.medium > 0 && (
            <Badge variant="warning">{counts.medium} Medium</Badge>
          )}
          {counts.low > 0 && (
            <Badge variant="secondary">{counts.low} Low</Badge>
          )}
        </div>
      </div>

      <FindingFilters filters={filters} onFiltersChange={setFilters} />

      {findings && findings.length > 0 ? (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {findings.length} findings
          </div>
          <FindingsTable
            findings={findings}
            onSelectFinding={handleSelectFinding}
          />
        </>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="No findings"
          description={
            filters.search || filters.type || filters.severity || filters.status
              ? "Try adjusting your filters"
              : "Great! No issues found in your infrastructure"
          }
        />
      )}

      <FindingDetailModal
        finding={selectedFinding}
        onClose={handleCloseModal}
        onUpdateStatus={handleUpdateStatus}
        isUpdating={updateStatus.isPending}
      />
    </div>
  );
}
