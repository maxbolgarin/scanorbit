import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Scan, ArrowRight } from "lucide-react";

interface ConnectionErrorStateProps {
  accountName?: string | null;
  errorMessage?: string | null;
  accountId?: string;
}

/**
 * Full-page error state shown when AWS account has a connection error.
 * Blocks page content and directs user to fix the connection issue.
 */
export function ConnectionErrorState({
  accountName,
  errorMessage,
  accountId,
}: ConnectionErrorStateProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/20 p-5">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="mt-6 text-xl font-semibold text-destructive">
          Connection Error
        </h3>
        <p className="mt-3 max-w-lg text-muted-foreground">
          {errorMessage ||
            `Unable to connect to ${accountName ? `"${accountName}"` : "this AWS account"}. Please verify your IAM role configuration and ensure the trust policy is correctly set up.`}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => navigate(`/accounts/${accountId}/scans`)}
          >
            <Scan className="mr-2 h-4 w-4" />
            Go to Scans
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/accounts")}
          >
            View All Accounts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
