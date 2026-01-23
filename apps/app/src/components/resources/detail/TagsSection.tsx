import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DetailSection } from './DetailSection';

interface TagsSectionProps {
  tags: Record<string, string>;
}

export function TagsSection({ tags }: TagsSectionProps) {
  const entries = Object.entries(tags);

  return (
    <DetailSection
      title={
        <span className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </span>
      }
    >
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <Badge key={key} variant="outline" className="max-w-full break-all">
              {key}: {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No tags</p>
      )}
    </DetailSection>
  );
}
