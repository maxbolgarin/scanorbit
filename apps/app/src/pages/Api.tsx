import { ApiKeySettings } from "@/components/settings/ApiKeySettings";

export default function Api() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API</h1>
        <p className="text-muted-foreground">Manage API keys and explore the API documentation</p>
      </div>
      <ApiKeySettings />
    </div>
  );
}
