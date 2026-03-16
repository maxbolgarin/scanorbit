import { useState } from "react";
import { normalizeApiUrl } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, Copy, Check, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Endpoint metadata
// ---------------------------------------------------------------------------

interface ParamDef {
  name: string;
  in: "path" | "query";
  type: string;
  required?: boolean;
  description: string;
  example?: string;
}

interface EndpointDef {
  id: string;
  method: "GET";
  path: string;
  summary: string;
  description: string;
  params: ParamDef[];
  responseDescription: string;
}

interface EndpointGroup {
  label: string;
  endpoints: EndpointDef[];
}

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    label: "Resources",
    endpoints: [
      {
        id: "list-resources",
        method: "GET",
        path: "/resources",
        summary: "List resources",
        description: "Returns a paginated list of all discovered cloud resources in your organization.",
        params: [
          { name: "page", in: "query", type: "integer", description: "Page number (default: 1)", example: "1" },
          { name: "limit", in: "query", type: "integer", description: "Items per page, max 100 (default: 50)", example: "50" },
          { name: "awsAccountId", in: "query", type: "string", description: "Filter by AWS account UUID", example: "" },
          { name: "region", in: "query", type: "string", description: "Filter by AWS region", example: "us-east-1" },
          { name: "service", in: "query", type: "string", description: "Filter by service type (e.g. ec2, s3, rds, lambda)", example: "ec2" },
          { name: "state", in: "query", type: "string", description: "Filter by resource state (e.g. running, available)", example: "" },
          { name: "costFilter", in: "query", type: "string", description: "Cost filter: all | paid | free", example: "paid" },
        ],
        responseDescription: "Paginated list of Resource objects",
      },
      {
        id: "resource-stats",
        method: "GET",
        path: "/resources/stats",
        summary: "Resource statistics",
        description: "Returns aggregated resource counts broken down by service, region, state, and cost.",
        params: [],
        responseDescription: "Resource counts and aggregates",
      },
      {
        id: "resource-regions",
        method: "GET",
        path: "/resources/regions",
        summary: "List regions",
        description: "Returns the distinct AWS regions that have at least one discovered resource.",
        params: [],
        responseDescription: "Array of region strings",
      },
      {
        id: "resource-services",
        method: "GET",
        path: "/resources/services",
        summary: "List services",
        description: "Returns the distinct AWS services that have at least one discovered resource.",
        params: [],
        responseDescription: "Array of service name strings",
      },
      {
        id: "get-resource",
        method: "GET",
        path: "/resources/:id",
        summary: "Get resource",
        description: "Returns a single resource by its internal UUID or AWS resource ID.",
        params: [
          { name: "id", in: "path", type: "string", required: true, description: "Resource UUID or AWS resource ID", example: "" },
        ],
        responseDescription: "Resource object",
      },
      {
        id: "resource-dependencies",
        method: "GET",
        path: "/resources/:id/dependencies",
        summary: "Resource dependencies",
        description: "Returns resources that this resource depends on (outgoing edges in the infrastructure graph).",
        params: [
          { name: "id", in: "path", type: "string", required: true, description: "Resource UUID", example: "" },
        ],
        responseDescription: "Array of dependency objects",
      },
      {
        id: "resource-dependents",
        method: "GET",
        path: "/resources/:id/dependents",
        summary: "Resource dependents",
        description: "Returns resources that depend on this resource (incoming edges in the infrastructure graph).",
        params: [
          { name: "id", in: "path", type: "string", required: true, description: "Resource UUID", example: "" },
        ],
        responseDescription: "Array of dependent objects",
      },
    ],
  },
  {
    label: "Findings",
    endpoints: [
      {
        id: "list-findings",
        method: "GET",
        path: "/findings",
        summary: "List findings",
        description: "Returns a paginated list of security, cost, and compliance findings.",
        params: [
          { name: "page", in: "query", type: "integer", description: "Page number (default: 1)", example: "1" },
          { name: "limit", in: "query", type: "integer", description: "Items per page, max 100 (default: 50)", example: "50" },
          { name: "awsAccountId", in: "query", type: "string", description: "Filter by AWS account UUID", example: "" },
          { name: "resourceId", in: "query", type: "string", description: "Filter by resource UUID", example: "" },
          { name: "type", in: "query", type: "string", description: "Filter by finding type (e.g. orphaned_volume, ssl_expiry)", example: "" },
          { name: "severity", in: "query", type: "string", description: "Filter by severity: low | medium | high", example: "high" },
          { name: "status", in: "query", type: "string", description: "Filter by status: open | resolved | snoozed | ignored", example: "open" },
        ],
        responseDescription: "Paginated list of Finding objects",
      },
      {
        id: "finding-stats",
        method: "GET",
        path: "/findings/stats",
        summary: "Finding statistics",
        description: "Returns aggregated finding counts broken down by severity, status, and type.",
        params: [],
        responseDescription: "Finding counts and aggregates",
      },
      {
        id: "get-finding",
        method: "GET",
        path: "/findings/:id",
        summary: "Get finding",
        description: "Returns a single finding by UUID, including its associated resource and certificate if available.",
        params: [
          { name: "id", in: "path", type: "string", required: true, description: "Finding UUID", example: "" },
        ],
        responseDescription: "Finding object with optional nested resource",
      },
    ],
  },
  {
    label: "Scans",
    endpoints: [
      {
        id: "active-scans",
        method: "GET",
        path: "/scans/active",
        summary: "Active scans",
        description: "Returns all currently running or queued scans across your organization.",
        params: [],
        responseDescription: "Array of active Scan objects",
      },
      {
        id: "recent-scans",
        method: "GET",
        path: "/scans/recent",
        summary: "Recent scans",
        description: "Returns the most recent completed scans.",
        params: [
          { name: "limit", in: "query", type: "integer", description: "Number of scans to return, max 100 (default: 10)", example: "10" },
        ],
        responseDescription: "Array of recent Scan objects",
      },
    ],
  },
  {
    label: "Accounts",
    endpoints: [
      {
        id: "list-accounts",
        method: "GET",
        path: "/accounts",
        summary: "List AWS accounts",
        description: "Returns all connected AWS accounts. Sensitive fields (role ARN, external ID) are omitted.",
        params: [],
        responseDescription: "Array of safe AwsAccount objects",
      },
    ],
  },
  {
    label: "Organization",
    endpoints: [
      {
        id: "get-organization",
        method: "GET",
        path: "/organization",
        summary: "Get organization",
        description: "Returns metadata about your organization. Subscription and billing details are not included.",
        params: [],
        responseDescription: "Organization metadata object",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE =
  (normalizeApiUrl(import.meta.env.VITE_PUBLIC_API_URL) ?? "").replace(/\/$/, "") +
  "/api/v1";

function buildUrl(path: string, pathValues: Record<string, string>, queryValues: Record<string, string>): string {
  let url = `${API_BASE}${path}`;
  Object.entries(pathValues).forEach(([k, v]) => {
    if (v) url = url.replace(`:${k}`, encodeURIComponent(v));
  });
  const qp = new URLSearchParams();
  Object.entries(queryValues).forEach(([k, v]) => {
    if (v.trim()) qp.set(k, v.trim());
  });
  const qs = qp.toString();
  return qs ? `${url}?${qs}` : url;
}

function getStatusColor(status: number) {
  if (status >= 200 && status < 300) return "text-green-500";
  if (status >= 400 && status < 500) return "text-amber-500";
  return "text-destructive";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApiExplorer() {
  const [selectedId, setSelectedId] = useState<string>(ENDPOINT_GROUPS[0].endpoints[0].id);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const selectedEndpoint = ENDPOINT_GROUPS.flatMap((g) => g.endpoints).find((e) => e.id === selectedId)!;
  const values = paramValues[selectedId] ?? {};
  const pathParams = selectedEndpoint.params.filter((p) => p.in === "path");
  const queryParams = selectedEndpoint.params.filter((p) => p.in === "query");

  const previewUrl = buildUrl(
    selectedEndpoint.path,
    Object.fromEntries(pathParams.map((p) => [p.name, values[p.name] ?? ""])),
    Object.fromEntries(queryParams.map((p) => [p.name, values[p.name] ?? ""]))
  );

  const setParam = (name: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] ?? {}), [name]: value },
    }));
  };

  const handleSend = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(previewUrl, {
        headers: { "X-API-Key": apiKey.trim() },
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON, keep as-is
      }
      setResponse({ status: res.status, body });
    } catch (err) {
      setResponse({ status: 0, body: `Network error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(previewUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSelectEndpoint = (id: string) => {
    setSelectedId(id);
    setResponse(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Explorer</CardTitle>
        <CardDescription>
          Browse endpoints and send test requests using your API key.
          All endpoints are read-only (GET).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex min-h-[600px] divide-x">
          {/* ----------------------------------------------------------------
              Left panel — endpoint list
          ---------------------------------------------------------------- */}
          <div className="w-64 shrink-0 overflow-y-auto py-3">
            {ENDPOINT_GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.endpoints.map((ep) => {
                  const active = ep.id === selectedId;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => handleSelectEndpoint(ep.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", active && "text-primary")} />
                      <span className="truncate">{ep.summary}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ----------------------------------------------------------------
              Right panel — detail + test
          ---------------------------------------------------------------- */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {/* Header */}
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedEndpoint.method}
                </Badge>
                <code className="text-sm font-mono">{selectedEndpoint.path}</code>
              </div>
              <h3 className="text-base font-semibold">{selectedEndpoint.summary}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{selectedEndpoint.description}</p>
            </div>

            {/* Parameters */}
            {selectedEndpoint.params.length > 0 && (
              <div className="mb-5">
                <h4 className="mb-2 text-sm font-semibold">Parameters</h4>
                <div className="rounded-md border divide-y">
                  {selectedEndpoint.params.map((param) => (
                    <div key={param.name} className="grid grid-cols-[160px_1fr] items-start gap-4 p-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-semibold">{param.name}</code>
                          {param.required && (
                            <span className="text-destructive text-xs">*</span>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                            {param.in}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{param.type}</p>
                      </div>
                      <div className="space-y-1">
                        <Input
                          value={values[param.name] ?? ""}
                          onChange={(e) => setParam(param.name, e.target.value)}
                          placeholder={param.example ? `e.g. ${param.example}` : param.description}
                          className="h-7 text-xs"
                        />
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request URL preview */}
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-semibold">Request URL</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all font-mono">
                  {previewUrl}
                </code>
                <Button variant="ghost" size="sm" onClick={handleCopyUrl} className="shrink-0">
                  {copiedUrl ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* API Key + Send */}
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-semibold">Authentication</h4>
              <div className="flex gap-2">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  type="password"
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleSend}
                  disabled={!apiKey.trim() || loading}
                  className="shrink-0"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sent as <code className="bg-muted px-1 py-0.5 rounded">X-API-Key</code> header
              </p>
            </div>

            {/* Response */}
            {response && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Response</h4>
                  <span className={cn("text-sm font-mono font-semibold", getStatusColor(response.status))}>
                    {response.status === 0 ? "Error" : `${response.status}`}
                  </span>
                </div>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
                  {response.body}
                </pre>
              </div>
            )}

            {/* Response description */}
            {!response && (
              <div className="rounded-md border border-dashed p-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Returns:</span> {selectedEndpoint.responseDescription}.
                  Enter your API key and click <span className="font-medium">Send</span> to try this endpoint.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
