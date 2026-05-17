import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookOpen, AlertTriangle, Server } from "lucide-react";
import { FindingsArticle, ResourcesArticle } from "@/components/docs";

// Available articles
const articles = [
  {
    id: "resources",
    title: "Scanned Resources",
    description: "All AWS resource types that ScanOrbit discovers and monitors",
    icon: Server,
  },
  {
    id: "findings",
    title: "Findings Reference",
    description: "Security issues, compliance gaps, and cost optimization findings",
    icon: AlertTriangle,
  },
];

function ArticleList({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Articles</h3>
      {articles.map((article) => {
        const isSelected = selectedId === article.id;
        return (
          <button
            key={article.id}
            onClick={() => onSelect(article.id)}
            className={cn(
              "w-full text-left rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <article.icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{article.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              {article.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ArticleContent({ articleId }: { articleId: string | undefined }) {
  if (!articleId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Select an Article</h3>
        <p className="text-muted-foreground max-w-md">
          Choose an article from the list to view documentation about ScanOrbit
          features and findings.
        </p>
      </div>
    );
  }

  switch (articleId) {
    case "resources":
      return <ResourcesArticle />;
    case "findings":
      return <FindingsArticle />;
    default:
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h3 className="text-lg font-medium mb-2">Article Not Found</h3>
          <p className="text-muted-foreground">
            The requested article could not be found.
          </p>
        </div>
      );
  }
}

export default function Docs() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();

  const handleSelectArticle = (id: string) => {
    navigate(`/docs/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground">
          Browse guides and references for ScanOrbit
        </p>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar - Article List */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="p-4">
              <ArticleList
                selectedId={articleId}
                onSelect={handleSelectArticle}
              />
            </CardContent>
          </Card>
        </div>

        {/* Article Content */}
        <div className="min-w-0">
          <ArticleContent articleId={articleId} />
        </div>
      </div>
    </div>
  );
}
