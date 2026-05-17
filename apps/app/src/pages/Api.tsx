import { ApiKeySettings } from "@/components/settings/ApiKeySettings";
import { ApiExplorer } from "@/components/settings/ApiExplorer";

export default function Api() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API</h1>
        <p className="text-muted-foreground">
          Manage API keys and explore endpoints. Authenticate requests with
          the <code className="px-1 py-0.5 bg-muted rounded text-xs">X-API-Key</code> header.
        </p>
      </div>
      <ApiKeySettings />
      <ApiExplorer />
    </div>
  );
}
