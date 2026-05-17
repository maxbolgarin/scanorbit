import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ResourceRelationshipBadgeProps {
  resourceId: string;
  label?: string;
  className?: string;
}

/**
 * Clickable badge that links to a related AWS resource.
 * Navigates directly to the resource detail page using the AWS resource ID.
 */
export function ResourceRelationshipBadge({
  resourceId,
  label,
  className,
}: ResourceRelationshipBadgeProps) {
  const navigate = useNavigate();

  if (!resourceId) return null;

  const handleClick = () => {
    // Navigate directly to resource page - backend supports lookup by AWS resource ID
    navigate(`/resources/${encodeURIComponent(resourceId)}`);
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer hover:bg-muted transition-colors font-mono text-xs',
        className
      )}
      onClick={handleClick}
    >
      {label || resourceId}
    </Badge>
  );
}

interface ResourceRelationshipListProps {
  items: Array<{ id: string; label?: string }>;
  emptyText?: string;
}

/**
 * List of clickable resource relationship badges.
 */
export function ResourceRelationshipList({ items, emptyText = 'None' }: ResourceRelationshipListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <ResourceRelationshipBadge
          key={item.id}
          resourceId={item.id}
          label={item.label}
        />
      ))}
    </div>
  );
}
