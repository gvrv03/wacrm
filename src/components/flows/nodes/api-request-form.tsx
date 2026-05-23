'use client';

import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ApiRequestNodeConfig, ApiRequestMethod } from '@/lib/flows/types';

interface Props {
  config: ApiRequestNodeConfig;
  allNodeKeys: Array<{ key: string; label: string }>;
  onChange: (patch: Partial<ApiRequestNodeConfig>) => void;
}

const METHODS: ApiRequestMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Configuration form for the API Request node type.
 * Validates URL, headers, body shape inline.
 */
export function ApiRequestForm({ config, allNodeKeys, onChange }: Props) {
  const headers = config.headers || {};
  const headerEntries = Object.entries(headers);
  const showBody = config.method !== 'GET' && config.method !== 'DELETE';

  // Inline JSON validation hint
  let bodyJsonValid = true;
  if (config.body && config.body.trim()) {
    try {
      JSON.parse(config.body);
    } catch {
      bodyJsonValid = false;
    }
  }

  function updateHeader(oldKey: string, newKey: string, value: string) {
    const next: Record<string, string> = { ...headers };
    if (oldKey !== newKey) delete next[oldKey];
    if (newKey.trim()) next[newKey] = value;
    onChange({ headers: next });
  }

  function removeHeader(key: string) {
    const next: Record<string, string> = { ...headers };
    delete next[key];
    onChange({ headers: next });
  }

  function addHeader() {
    if (headerEntries.length >= 20) return;
    onChange({ headers: { ...headers, '': '' } });
  }

  return (
    <div className="space-y-3">
      {/* Method + URL */}
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Method</Label>
          <Select value={config.method} onValueChange={(v) => onChange({ method: v as ApiRequestMethod })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input
            value={config.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            maxLength={2048}
          />
          {config.url && !config.url.startsWith('https://') && (
            <p className="text-xs text-destructive mt-1">URL must start with https://</p>
          )}
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Headers ({headerEntries.length}/20)</Label>
          <Button variant="outline" size="sm" type="button" onClick={addHeader} disabled={headerEntries.length >= 20}>
            <Plus className="size-3 mr-1" /> Add Header
          </Button>
        </div>
        {headerEntries.map(([key, value], idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={key}
              onChange={(e) => updateHeader(key, e.target.value, value)}
              placeholder="Authorization"
              maxLength={256}
            />
            <Input
              value={value}
              onChange={(e) => updateHeader(key, key, e.target.value)}
              placeholder="Bearer token"
              maxLength={2048}
            />
            <button type="button" onClick={() => removeHeader(key)} className="text-muted-foreground hover:text-destructive">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Body (POST/PUT/PATCH) */}
      {showBody && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Body (JSON)</Label>
          <Textarea
            value={config.body || ''}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder='{"key": "{{vars.example}}"}'
            rows={5}
            className="font-mono text-xs"
            maxLength={32000}
          />
          {!bodyJsonValid && (
            <p className="text-xs text-yellow-600">⚠ Body is not valid JSON</p>
          )}
        </div>
      )}

      {/* Response storage */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Store Response As (vars.X)</Label>
        <Input
          value={config.response_var_key || ''}
          onChange={(e) => onChange({ response_var_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
          placeholder="api_response"
          className="font-mono"
        />
      </div>

      {/* Routing */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-emerald-600">Success → Next Node</Label>
          <Select value={config.success_next || ''} onValueChange={(v) => onChange({ success_next: v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {allNodeKeys.map((n) => <SelectItem key={n.key} value={n.key}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-red-600">Failure → Next Node</Label>
          <Select value={config.failure_next || ''} onValueChange={(v) => onChange({ failure_next: v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {allNodeKeys.map((n) => <SelectItem key={n.key} value={n.key}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Use {'{{vars.X}}'} to insert flow variables in URL, headers, or body.
      </p>
    </div>
  );
}
