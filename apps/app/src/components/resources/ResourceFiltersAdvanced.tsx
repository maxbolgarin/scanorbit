import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import type { ResourceFilters as Filters, ResourceHealthFilter, ServiceType, CostFilterType } from "@/types";
import { Search, X, DollarSign, Heart } from "lucide-react";

interface ResourceFiltersAdvancedProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  regions: string[];
  services: ServiceType[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

const stateOptions = [
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "available", label: "Available" },
  { value: "in-use", label: "In Use" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function ResourceFiltersAdvanced({
  filters,
  onFiltersChange,
  regions,
  services,
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}: ResourceFiltersAdvancedProps) {
  const hasFilters = filters.service || filters.region || filters.state || filters.costFilter || filters.health || searchQuery;
  const activeFilterCount = [filters.service, filters.region, filters.state, filters.costFilter, filters.health, searchQuery].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({});
    onSearchChange("");
  };

  const clearSingleFilter = (key: keyof Filters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.service || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                service: value === "all" ? undefined : (value as ServiceType),
              })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  <div className="flex items-center gap-2">
                    <ServiceIcon service={service} className="h-4 w-4" />
                    <span>{getServiceLabel(service)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.region || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                region: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Cost filter */}
          <Select
            value={filters.costFilter || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                costFilter: value === "all" ? undefined : (value as CostFilterType),
              })
            }
          >
            <SelectTrigger className="w-[150px]">
              <DollarSign className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Free & Paid</SelectItem>
              <SelectItem value="paid">Paid Only</SelectItem>
              <SelectItem value="free">Free Only</SelectItem>
            </SelectContent>
          </Select>

          {/* State filter */}
          <Select
            value={filters.state || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                state: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {stateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Health filter */}
          <Select
            value={filters.health || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                health: value === "all" ? undefined : (value as ResourceHealthFilter),
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <Heart className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="orphaned">Orphaned</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear all button */}
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Active filters badges & count */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Result count */}
        <span className="text-sm text-muted-foreground">
          {hasFilters ? (
            <>
              Showing <span className="font-medium text-foreground">{filteredCount.toLocaleString()}</span> of{" "}
              {totalCount.toLocaleString()} resources
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> resources
            </>
          )}
        </span>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-2">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Search: "{searchQuery.length > 15 ? `${searchQuery.slice(0, 15)  }...` : searchQuery}"
                <button
                  onClick={() => onSearchChange("")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.service && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <ServiceIcon service={filters.service} className="h-3 w-3" />
                {getServiceLabel(filters.service)}
                <button
                  onClick={() => clearSingleFilter("service")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.region && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {filters.region}
                <button
                  onClick={() => clearSingleFilter("region")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.state && (
              <Badge variant="secondary" className="gap-1 pr-1">
                State: {filters.state}
                <button
                  onClick={() => clearSingleFilter("state")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.costFilter && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <DollarSign className="h-3 w-3" />
                {filters.costFilter === "paid" ? "Paid Only" : "Free Only"}
                <button
                  onClick={() => clearSingleFilter("costFilter")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.health && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <Heart className="h-3 w-3" />
                Health: {filters.health.charAt(0).toUpperCase() + filters.health.slice(1)}
                <button
                  onClick={() => clearSingleFilter("health")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
