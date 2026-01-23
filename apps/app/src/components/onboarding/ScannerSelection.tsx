import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  PERMISSION_CATEGORIES,
  type ScannerType,
} from "@/types";
import {
  Server,
  Database,
  HardDrive,
  Network,
  Shield,
  Zap,
  Activity,
  Users,
  Key,
  AlertTriangle,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ec2_compute: Server,
  database: Database,
  storage: HardDrive,
  networking: Network,
  certificates: Shield,
  serverless: Zap,
  monitoring: Activity,
  identity: Users,
  secrets: Key,
};

interface ScannerSelectionProps {
  onSelect: (categories: string[], scanners: ScannerType[]) => void;
  onBack: () => void;
  initialCategories?: string[];
}

export function ScannerSelection({
  onSelect,
  onBack,
  initialCategories,
}: ScannerSelectionProps) {
  // Default to all categories selected
  const [selected, setSelected] = useState<string[]>(
    initialCategories ?? PERMISSION_CATEGORIES.map((c) => c.id)
  );

  const toggleCategory = (categoryId: string) => {
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectAll = () => setSelected(PERMISSION_CATEGORIES.map((c) => c.id));
  const deselectAll = () => setSelected([]);

  const getEnabledScanners = (): ScannerType[] => {
    const scanners: ScannerType[] = [];
    PERMISSION_CATEGORIES.forEach((category) => {
      if (selected.includes(category.id)) {
        scanners.push(...category.scanners);
      }
    });
    return [...new Set(scanners)];
  };

  const handleContinue = () => {
    onSelect(selected, getEnabledScanners());
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Select which AWS resources ScanOrbit should scan. The IAM policy will
          be generated based on your selections.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={deselectAll}>
          Deselect All
        </Button>
      </div>

      {/* Category cards */}
      <div className="grid gap-2 sm:gap-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1">
        {PERMISSION_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] || Server;
          const isSelected = selected.includes(category.id);

          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => toggleCategory(category.id)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleCategory(category.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm sm:text-base">{category.label}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {category.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {category.scanners.map((scanner) => (
                        <Badge
                          key={scanner}
                          variant="secondary"
                          className="text-[10px] sm:text-xs"
                        >
                          {scanner}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Warning if nothing selected */}
      {selected.length === 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <p className="text-yellow-600 font-medium">
            At least one category must be selected
          </p>
        </div>
      )}

      {/* Summary */}
      {selected.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {selected.length} of {PERMISSION_CATEGORIES.length} categories
          selected ({getEnabledScanners().length} scanners)
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleContinue}
          disabled={selected.length === 0}
        >
          Continue to IAM Policy
        </Button>
      </div>
    </div>
  );
}
