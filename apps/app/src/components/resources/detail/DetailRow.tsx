import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DetailRowProps {
  label: string;
  value: string | number | boolean | null | undefined;
  copyable?: boolean;
  mono?: boolean;
  className?: string;
}

export function DetailRow({ label, value, copyable, mono, className }: DetailRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (value === null || value === undefined) return;
    await navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = (() => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  })();

  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div className={cn('flex items-start justify-between py-2 border-b last:border-0', className)}>
      <span className="text-sm text-muted-foreground shrink-0 mr-4">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span
          className={cn(
            'text-sm break-all',
            mono && 'font-mono text-xs',
            !hasValue && 'text-muted-foreground'
          )}
        >
          {displayValue}
        </span>
        {copyable && hasValue && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

interface DetailGridProps {
  children: React.ReactNode;
  columns?: 1 | 2;
}

export function DetailGrid({ children, columns = 2 }: DetailGridProps) {
  return (
    <div className={cn('grid gap-x-6', columns === 2 && 'sm:grid-cols-2')}>
      {children}
    </div>
  );
}
