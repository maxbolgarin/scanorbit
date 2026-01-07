import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, ExternalLink } from "lucide-react";
import { iamTrustPolicy, iamPermissionPolicy } from "@/lib/mock-data";

interface PolicyGuideProps {
  awsAccountId: string;
  onNext: () => void;
  onBack: () => void;
}

export function PolicyGuide({ awsAccountId, onNext, onBack }: PolicyGuideProps) {
  const [copiedTrust, setCopiedTrust] = useState(false);
  const [copiedPermission, setCopiedPermission] = useState(false);

  const handleCopy = async (text: string, type: "trust" | "permission") => {
    await navigator.clipboard.writeText(text);
    if (type === "trust") {
      setCopiedTrust(true);
      setTimeout(() => setCopiedTrust(false), 2000);
    } else {
      setCopiedPermission(true);
      setTimeout(() => setCopiedPermission(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-medium">Step 1: Create IAM Role in AWS</h3>
        <p className="text-sm text-muted-foreground">
          Create a new IAM role in your AWS account ({awsAccountId}) that
          ScanOrbit can assume to scan your infrastructure.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Trust Policy</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(iamTrustPolicy, "trust")}
            >
              {copiedTrust ? (
                <>
                  <Check className="mr-1 h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <Card>
            <CardContent className="p-3">
              <pre className="overflow-x-auto text-xs text-muted-foreground">
                {iamTrustPolicy}
              </pre>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Permission Policy</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(iamPermissionPolicy, "permission")}
            >
              {copiedPermission ? (
                <>
                  <Check className="mr-1 h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <Card>
            <CardContent className="p-3">
              <pre className="overflow-x-auto text-xs text-muted-foreground">
                {iamPermissionPolicy}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="mb-2 font-medium">Instructions</h4>
        <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
          <li>
            Open the{" "}
            <a
              href={`https://console.aws.amazon.com/iam/home?region=us-east-1#/roles$new?step=type&roleType=crossAccount`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              IAM Console <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>Create a new role for "Another AWS account"</li>
          <li>Enter ScanOrbit's account ID and external ID from the trust policy</li>
          <li>Attach a custom policy with the permissions above</li>
          <li>Name the role "ScanOrbitReadOnly" and create it</li>
        </ol>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={onNext}>
          I've created the role
        </Button>
      </div>
    </div>
  );
}
