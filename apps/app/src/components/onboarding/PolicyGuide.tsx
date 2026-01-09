import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, Copy, ExternalLink, AlertCircle, ChevronDown } from "lucide-react";

// ScanOrbit's AWS Account ID - should be set in environment variables for production
const SCANORBIT_AWS_ACCOUNT_ID = import.meta.env.VITE_SCANORBIT_AWS_ACCOUNT_ID || "";

const getPermissionPolicy = () => `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:ListAllMyBuckets",
        "elasticloadbalancing:Describe*",
        "acm:Describe*",
        "acm:List*"
      ],
      "Resource": "*"
    }
  ]
}`;

interface PolicyGuideProps {
  externalId: string;
  onNext: () => void;
  onBack: () => void;
}

export function PolicyGuide({ externalId, onNext, onBack }: PolicyGuideProps) {
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const [copiedExternalId, setCopiedExternalId] = useState(false);
  const [copiedPolicy, setCopiedPolicy] = useState(false);
  const [copiedRoleName, setCopiedRoleName] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);

  const isMissingConfig = !SCANORBIT_AWS_ACCOUNT_ID;
  const permissionPolicy = getPermissionPolicy();

  const handleCopy = async (text: string, type: "accountId" | "externalId" | "policy" | "roleName") => {
    await navigator.clipboard.writeText(text);
    if (type === "accountId") {
      setCopiedAccountId(true);
      setTimeout(() => setCopiedAccountId(false), 2000);
    } else if (type === "externalId") {
      setCopiedExternalId(true);
      setTimeout(() => setCopiedExternalId(false), 2000);
    } else if (type === "policy") {
      setCopiedPolicy(true);
      setTimeout(() => setCopiedPolicy(false), 2000);
    } else if (type === "roleName") {
      setCopiedRoleName(true);
      setTimeout(() => setCopiedRoleName(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {isMissingConfig && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
          <div>
            <p className="font-medium text-yellow-500">Configuration Required</p>
            <p className="text-muted-foreground">
              ScanOrbit AWS Account ID is not configured. Contact your administrator.
            </p>
          </div>
        </div>
      )}

      {/* Part 1: Create Policy */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-sm font-medium text-primary">Part 1: Create IAM Policy</p>
      </div>

      {/* Step 1 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium">Open IAM Policies</p>
            <a
              href="https://console.aws.amazon.com/iam/home#/policies/create"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Click here to create a new policy
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            2
          </div>
          <div className="flex-1 space-y-3">
            <p className="font-medium">Paste the policy JSON</p>
            <p className="text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">"JSON"</span> tab, delete default content, and paste:
            </p>

            <Collapsible open={policyExpanded} onOpenChange={setPolicyExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>View policy JSON</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${policyExpanded ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <Card>
                  <CardContent className="p-3">
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(permissionPolicy, "policy")}
                      >
                        {copiedPolicy ? (
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
                    <pre className="overflow-x-auto text-xs text-muted-foreground">
                      {permissionPolicy}
                    </pre>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            3
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium">Name the policy</p>
            <p className="text-sm text-muted-foreground">
              Click "Next". Enter name: <span className="font-mono font-medium text-foreground">ScanOrbitReadOnlyPolicy</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">"Create policy"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Part 2: Create Role */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-sm font-medium text-primary">Part 2: Create IAM Role</p>
      </div>

      {/* Step 4 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            4
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium">Open IAM Roles</p>
            <a
              href="https://console.aws.amazon.com/iam/home#/roles/create?step=selectEntities"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Click here to create a new role
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Step 5 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            5
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium">Select trusted entity</p>
            <p className="text-sm text-muted-foreground">
              Choose <span className="font-medium text-foreground">"AWS account"</span> → <span className="font-medium text-foreground">"Another AWS account"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Step 6 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            6
          </div>
          <div className="flex-1 space-y-3">
            <p className="font-medium">Enter Account ID</p>
            <p className="text-sm text-muted-foreground">Paste ScanOrbit's Account ID:</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={SCANORBIT_AWS_ACCOUNT_ID || "Not configured"}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(SCANORBIT_AWS_ACCOUNT_ID, "accountId")}
                disabled={!SCANORBIT_AWS_ACCOUNT_ID}
                className="flex-shrink-0"
              >
                {copiedAccountId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 7 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            7
          </div>
          <div className="flex-1 space-y-3">
            <p className="font-medium">Enable External ID</p>
            <p className="text-sm text-muted-foreground">
              Check <span className="font-medium text-foreground">"Require external ID"</span> and paste:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={externalId}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(externalId, "externalId")}
                className="flex-shrink-0"
              >
                {copiedExternalId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">"Next"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Step 8 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            8
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium">Attach the policy</p>
            <p className="text-sm text-muted-foreground">
              Search for <span className="font-mono font-medium text-foreground">ScanOrbitReadOnlyPolicy</span>, check the box, click <span className="font-medium text-foreground">"Next"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Step 9 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            9
          </div>
          <div className="flex-1 space-y-3">
            <p className="font-medium">Name and create the role</p>
            <p className="text-sm text-muted-foreground">Enter role name:</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value="ScanOrbitReadOnly"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy("ScanOrbitReadOnly", "roleName")}
                className="flex-shrink-0"
              >
                {copiedRoleName ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Skip tags, scroll down and click <span className="font-medium text-foreground">"Create role"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
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
