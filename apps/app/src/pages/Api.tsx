import { ApiKeySettings } from "@/components/settings/ApiKeySettings";
import { ApiExplorer } from "@/components/settings/ApiExplorer";

export default function Api() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API</h1>
        <p className="text-muted-foreground">
          Manage API keys and explore the API documentation.{" "}
          <a
            href="https://scanorbit.cloud/api-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            View full API reference
          </a>
        </p>
      </div>
      <ApiKeySettings />
      <ApiExplorer />
    </div>
  );
}
