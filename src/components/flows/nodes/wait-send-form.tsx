'use client';

import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type {
  WaitSendMessageNodeConfig, WaitDelayUnit, WaitTimingMode, WaitMessageType,
} from '@/lib/flows/types';

interface Props {
  config: WaitSendMessageNodeConfig;
  allNodeKeys: Array<{ key: string; label: string }>;
  onChange: (patch: Partial<WaitSendMessageNodeConfig>) => void;
}

const UNITS: WaitDelayUnit[] = ['minutes', 'hours', 'days', 'weeks'];
const TIMING_MODES: { value: WaitTimingMode; label: string; hint: string }[] = [
  { value: 'fixed', label: 'Fixed', hint: 'Delay from when this node is reached' },
  { value: 'relative', label: 'Relative', hint: 'Delay from last message sent' },
];
const MESSAGE_TYPES: WaitMessageType[] = ['text', 'image', 'video', 'audio', 'file', 'location', 'interactive'];

/**
 * Configuration form for the Wait/Schedule Message node.
 * Pauses the flow for a duration, then sends a message.
 */
export function WaitSendForm({ config, allNodeKeys, onChange }: Props) {
  const content = config.message_content || {};

  function updateContent(patch: Record<string, unknown>) {
    onChange({ message_content: { ...content, ...patch } });
  }

  return (
    <div className="space-y-3">
      {/* Delay */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Delay</Label>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Input
            type="number"
            min={1}
            max={672}
            value={config.delay_amount || 1}
            onChange={(e) => onChange({ delay_amount: Math.min(672, Math.max(1, parseInt(e.target.value) || 1)) })}
          />
          <Select value={config.delay_unit || 'minutes'} onValueChange={(v) => onChange({ delay_unit: v as WaitDelayUnit })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timing mode */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Timing Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          {TIMING_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ timing_mode: m.value })}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                config.timing_mode === m.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <p className="text-xs font-medium text-foreground">{m.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Message type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Message Type</Label>
        <Select value={config.message_type || 'text'} onValueChange={(v) => onChange({ message_type: v as WaitMessageType, message_content: {} })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESSAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Message content (varies by type) */}
      {config.message_type === 'text' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Message Text</Label>
          <Textarea
            value={(content.text as string) || ''}
            onChange={(e) => updateContent({ text: e.target.value })}
            placeholder="Hi {{vars.name}}, just checking in!"
            rows={3}
            maxLength={4096}
          />
        </div>
      )}

      {(config.message_type === 'image' || config.message_type === 'video' ||
        config.message_type === 'audio' || config.message_type === 'file') && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Media URL</Label>
          <Input
            value={(content.media_url as string) || ''}
            onChange={(e) => updateContent({ media_url: e.target.value })}
            placeholder="https://example.com/media.jpg"
            maxLength={2048}
          />
        </div>
      )}

      {config.message_type === 'location' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Latitude</Label>
              <Input
                type="number"
                step="any"
                value={(content.latitude as number) ?? ''}
                onChange={(e) => updateContent({ latitude: parseFloat(e.target.value) })}
                placeholder="12.9716"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Longitude</Label>
              <Input
                type="number"
                step="any"
                value={(content.longitude as number) ?? ''}
                onChange={(e) => updateContent({ longitude: parseFloat(e.target.value) })}
                placeholder="77.5946"
              />
            </div>
          </div>
          <Input
            value={(content.location_name as string) || ''}
            onChange={(e) => updateContent({ location_name: e.target.value })}
            placeholder="Location name (optional)"
          />
          <Input
            value={(content.location_address as string) || ''}
            onChange={(e) => updateContent({ location_address: e.target.value })}
            placeholder="Address (optional)"
          />
        </div>
      )}

      {config.message_type === 'interactive' && (
        <InteractiveButtonsEditor
          buttons={(content.buttons as Array<{ reply_id: string; title: string }>) || []}
          headerText={(content.header_text as string) || ''}
          footerText={(content.footer_text as string) || ''}
          text={(content.text as string) || ''}
          onChange={(patch) => updateContent(patch)}
        />
      )}

      {/* Next node */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">After Send → Next Node</Label>
        <Select value={config.next_node_key || ''} onValueChange={(v) => onChange({ next_node_key: v })}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {allNodeKeys.map((n) => <SelectItem key={n.key} value={n.key}>{n.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Use {'{{vars.X}}'} to insert flow variables in text content.
      </p>
    </div>
  );
}

// ============================================================
// Interactive buttons sub-form (for "interactive" message type)
// ============================================================

function InteractiveButtonsEditor({
  buttons, headerText, footerText, text, onChange,
}: {
  buttons: Array<{ reply_id: string; title: string }>;
  headerText: string;
  footerText: string;
  text: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  function addButton() {
    if (buttons.length >= 3) return;
    onChange({ buttons: [...buttons, { reply_id: `btn_${buttons.length + 1}`, title: '' }] });
  }
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Body Text</Label>
        <Textarea value={text} onChange={(e) => onChange({ text: e.target.value })} rows={3} maxLength={1024} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Buttons (max 3)</Label>
        {buttons.map((btn, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={btn.title}
              onChange={(e) => {
                const next = [...buttons];
                next[i] = { ...btn, title: e.target.value };
                onChange({ buttons: next });
              }}
              placeholder="Button text"
              maxLength={20}
            />
            <button type="button" onClick={() => onChange({ buttons: buttons.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-destructive">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {buttons.length < 3 && (
          <Button variant="outline" size="sm" onClick={addButton}><Plus className="size-3 mr-1" /> Add Button</Button>
        )}
      </div>
    </div>
  );
}
