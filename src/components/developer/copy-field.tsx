'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CopyFieldProps {
  label?: string;
  value: string;
  masked?: boolean;
}

/**
 * Read-only field with a copy button. Optionally masks the value.
 */
export function CopyField({ label, value, masked }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  const displayValue = masked ? value.slice(0, 12) + '••••••••••••••••••••' : value;

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground truncate">
          {displayValue || '—'}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
