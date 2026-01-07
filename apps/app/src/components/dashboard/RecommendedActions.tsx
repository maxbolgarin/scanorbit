import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, Lightbulb } from "lucide-react";
import type { RecommendedAction } from "@/lib/mock-data";

interface RecommendedActionsProps {
  actions: RecommendedAction[];
}

const priorityColors = {
  high: "error",
  medium: "warning",
  low: "secondary",
} as const;

export function RecommendedActions({ actions }: RecommendedActionsProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Recommended Actions
        </CardTitle>
        <CardDescription>Quick wins to improve your infrastructure</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={priorityColors[action.priority]}>
                    {action.priority}
                  </Badge>
                  <span className="font-medium">{action.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {action.description}
                </p>
                {action.estimatedSavings && (
                  <p className="text-sm font-medium text-green-600">
                    Save {formatCurrency(action.estimatedSavings)}/month
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(
                    action.findingId
                      ? `/findings?id=${action.findingId}`
                      : "/findings"
                  )
                }
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
