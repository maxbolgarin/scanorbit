import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ServiceIcon, getServiceLabel } from '@/components/shared/ServiceIcon';
import { Filter, X } from 'lucide-react';
import type { ServiceType } from '@/types';
import type { MapFilters } from '@/types/graph';

interface MapFiltersProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  availableServices: ServiceType[];
  availableRegions: string[];
}

export function MapFiltersComponent({
  filters,
  onFiltersChange,
  availableServices,
  availableRegions,
}: MapFiltersProps) {
  const activeFilterCount =
    filters.services.length +
    filters.regions.length +
    (filters.showOrphans ? 0 : 1) +
    (filters.minFindingsCount > 0 ? 1 : 0);

  const toggleService = (service: ServiceType) => {
    const services = filters.services.includes(service)
      ? filters.services.filter((s) => s !== service)
      : [...filters.services, service];
    onFiltersChange({ ...filters, services });
  };

  const toggleRegion = (region: string) => {
    const regions = filters.regions.includes(region)
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region];
    onFiltersChange({ ...filters, regions });
  };

  const clearFilters = () => {
    onFiltersChange({
      services: [],
      regions: [],
      relationshipTypes: [],
      showOrphans: true,
      minFindingsCount: 0,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-auto px-2 py-1 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-2">
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => onFiltersChange({ ...filters, showOrphans: !filters.showOrphans })}
            >
              <Checkbox checked={filters.showOrphans} className="pointer-events-none" />
              <span className="text-xs">Show unconnected resources</span>
            </div>
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  minFindingsCount: filters.minFindingsCount > 0 ? 0 : 1,
                })
              }
            >
              <Checkbox checked={filters.minFindingsCount > 0} className="pointer-events-none" />
              <span className="text-xs">Only show resources with findings</span>
            </div>
          </div>

          <Separator />

          {/* Services Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Services</Label>
            <div className="grid grid-cols-2 gap-2">
              {availableServices.map((service) => (
                <div
                  key={service}
                  className="flex items-center space-x-2 cursor-pointer"
                  onClick={() => toggleService(service)}
                >
                  <Checkbox
                    checked={
                      filters.services.length === 0 || filters.services.includes(service)
                    }
                    className="pointer-events-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <ServiceIcon service={service} className="h-3.5 w-3.5" />
                    <span className="text-xs truncate">{getServiceLabel(service)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Regions Filter */}
          {availableRegions.length > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Regions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableRegions.map((region) => (
                    <Badge
                      key={region}
                      variant={
                        filters.regions.length === 0 || filters.regions.includes(region)
                          ? 'default'
                          : 'outline'
                      }
                      className="cursor-pointer text-xs"
                      onClick={() => toggleRegion(region)}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

        </div>
      </PopoverContent>
    </Popover>
  );
}
