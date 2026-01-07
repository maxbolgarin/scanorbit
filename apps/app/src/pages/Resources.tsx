import { useState } from "react";
import { ResourceFilters } from "@/components/resources/ResourceFilters";
import { ResourcesTable } from "@/components/resources/ResourcesTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useResources, useResourceRegions, useResourceServices } from "@/hooks/use-resources";
import type { ResourceFilters as Filters } from "@/types";
import { Server } from "lucide-react";

export default function Resources() {
  const [filters, setFilters] = useState<Filters>({});
  const { data: resources, isLoading } = useResources(filters);
  const regions = useResourceRegions();
  const services = useResourceServices();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="text-muted-foreground">
          Browse all discovered AWS infrastructure
        </p>
      </div>

      <ResourceFilters
        filters={filters}
        onFiltersChange={setFilters}
        regions={regions}
        services={services}
      />

      {resources && resources.length > 0 ? (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {resources.length} resources
          </div>
          <ResourcesTable resources={resources} />
        </>
      ) : (
        <EmptyState
          icon={Server}
          title="No resources found"
          description={
            filters.search || filters.service || filters.region
              ? "Try adjusting your filters"
              : "Connect an AWS account to discover resources"
          }
        />
      )}
    </div>
  );
}
