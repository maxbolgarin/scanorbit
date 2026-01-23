import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, Copy, ExternalLink, ChevronDown, Info } from "lucide-react";
import { PERMISSION_CATEGORIES, generateIAMPolicy } from "@/types";

// Full policy with all permissions (for backward compatibility when no categories selected)
const getFullPermissionPolicy = () => `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ScanOrbitReadAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:GetBucketPolicy",
        "s3:GetBucketPolicyStatus",
        "s3:GetPublicAccessBlock",
        "elasticloadbalancing:Describe*",
        "acm:List*",
        "acm:Describe*",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:ListTags",
        "kms:ListKeys",
        "kms:DescribeKey",
        "kms:ListResourceTags",
        "kms:GetKeyRotationStatus",
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret",
        "logs:DescribeLogGroups",
        "logs:ListTagsForResource",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListTagsForResource",
        "iam:ListUsers",
        "iam:ListUserTags",
        "iam:ListMFADevices",
        "iam:ListRoles",
        "iam:ListRoleTags",
        "iam:GetRole",
        "iam:ListAccessKeys",
        "iam:GetAccessKeyLastUsed",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:GetRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}`;

interface PolicyGuideProps {
  selectedCategories?: string[];
  onNext: () => void;
  onBack: () => void;
}

export function PolicyGuide({ selectedCategories, onNext, onBack }: PolicyGuideProps) {
  const [copiedPolicy, setCopiedPolicy] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);

  // Generate policy based on selected categories, or use full policy if none/all selected
  const allCategoryIds = PERMISSION_CATEGORIES.map((c) => c.id);
  const hasCustomSelection = selectedCategories && selectedCategories.length > 0 && selectedCategories.length < allCategoryIds.length;
  const permissionPolicy = hasCustomSelection
    ? generateIAMPolicy(selectedCategories)
    : getFullPermissionPolicy();

  // Get names of enabled categories for display
  const enabledCategoryNames = hasCustomSelection
    ? PERMISSION_CATEGORIES.filter((c) => selectedCategories.includes(c.id)).map((c) => c.label)
    : [];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(permissionPolicy);
    setCopiedPolicy(true);
    setTimeout(() => setCopiedPolicy(false), 2000);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Show enabled categories if custom selection */}
      {hasCustomSelection && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <div>
            <p className="font-medium text-blue-600">Custom Scanner Configuration</p>
            <p className="text-muted-foreground mb-2">
              This policy includes permissions for your selected scanners only:
            </p>
            <div className="flex flex-wrap gap-1">
              {enabledCategoryNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 */}
      <div className="rounded-lg border p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] sm:text-xs font-medium text-primary-foreground">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium text-sm sm:text-base">Open IAM Policies</p>
            <a
              href="https://console.aws.amazon.com/iam/home#/policies/create"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:underline"
            >
              Click here to create a new policy
              <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="rounded-lg border p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] sm:text-xs font-medium text-primary-foreground">
            2
          </div>
          <div className="flex-1 space-y-2 sm:space-y-3">
            <p className="font-medium text-sm sm:text-base">Paste the policy JSON</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
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
                  <CardContent className="p-2 sm:p-3">
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
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
                    <pre className="overflow-x-auto text-[10px] sm:text-xs text-muted-foreground max-h-[200px] sm:max-h-none">
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
      <div className="rounded-lg border p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] sm:text-xs font-medium text-primary-foreground">
            3
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium text-sm sm:text-base">Name the policy</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Click "Next". Enter name: <span className="font-mono font-medium text-foreground text-[10px] sm:text-sm">ScanOrbitReadOnlyPolicy</span>
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">"Create policy"</span>
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
          Next
        </Button>
      </div>
    </div>
  );
}
