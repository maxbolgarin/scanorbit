import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";

export function OrgSwitcherSettings() {
  const { org, orgs, switchOrg } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  if (orgs.length <= 1) return null;

  const handleSwitch = async (orgId: string) => {
    setSwitchingTo(orgId);
    try {
      await switchOrg(orgId);
      queryClient.clear();
      navigate("/overview", { replace: true });
    } catch {
      setSwitchingTo(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
        <CardDescription>Switch between organizations you belong to</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orgs.map((o) => {
            const isActive = o.id === org?.id;
            const isSwitching = switchingTo === o.id;
            return (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{o.name}</span>
                  {isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                {!isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSwitch(o.id)}
                    disabled={switchingTo !== null}
                  >
                    {isSwitching ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Switching...
                      </>
                    ) : (
                      "Switch"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
