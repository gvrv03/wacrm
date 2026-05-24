'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GMapCom } from '@/components/shared/gmap-com';

// ============================================================
// Shared media upload component
// ============================================================

function MediaUploadField({
  value, onChange, accept, label,
}: { value: string; onChange: (url: string) => void; accept: string; label: string }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('Max 16 MB'); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/flows/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('template-media').upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('template-media').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Uploaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[MediaUpload] Upload failed:', msg);
      toast.error(`Upload failed: ${msg}`);
    }
    finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  }

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="relative rounded-lg border border-border overflow-hidden">
          {accept.startsWith('image') && <img src={value} alt="" className="w-full h-24 object-cover" />}
          {!accept.startsWith('image') && (
            <div className="h-12 flex items-center gap-2 px-3 bg-muted/30">
              <span className="text-xs text-muted-foreground truncate flex-1">{value.split('/').pop()}</span>
            </div>
          )}
          <button type="button" onClick={() => onChange('')} className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <X className="size-3" />
          </button>
        </div>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Or paste URL" className="text-xs font-mono" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <label className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-border py-5 cursor-pointer hover:border-primary/40 transition-colors">
        {uploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Upload className="size-4 text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">{uploading ? 'Uploading...' : 'Click to upload or drag'}</span>
        <input ref={ref} type="file" className="hidden" accept={accept} onChange={handleUpload} disabled={uploading} />
      </label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Or paste URL directly" className="text-xs font-mono" />
    </div>
  );
}

// ============================================================
// Send Image Form
// ============================================================

export function SendImageForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <MediaUploadField value={(config.image_url as string) || ''} onChange={(url) => onChange({ image_url: url })} accept="image/*" label="Image (jpg, png, webp)" />
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Caption (optional, max 1024)</Label>
        <Textarea value={(config.caption as string) || ''} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Image caption..." rows={2} maxLength={1024} />
      </div>
    </div>
  );
}

// ============================================================
// Send Document Form
// ============================================================

export function SendDocumentForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <MediaUploadField value={(config.document_url as string) || ''} onChange={(url) => onChange({ document_url: url })} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" label="Document (pdf, doc, xls, etc)" />
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Filename (shown to customer)</Label>
        <Input value={(config.filename as string) || ''} onChange={(e) => onChange({ filename: e.target.value })} placeholder="invoice.pdf" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
        <Input value={(config.caption as string) || ''} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Here's your document" maxLength={1024} />
      </div>
    </div>
  );
}

// ============================================================
// Send Location Form
// ============================================================

export function SendLocationForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <GMapCom
        value={{
          latitude: (config.latitude as number) || undefined,
          longitude: (config.longitude as number) || undefined,
          name: (config.name as string) || '',
          address: (config.address as string) || '',
        }}
        onChange={(loc) => onChange({
          latitude: loc.latitude,
          longitude: loc.longitude,
          name: loc.name,
          address: loc.address,
        })}
        height="250px"
      />
    </div>
  );
}

// ============================================================
// Send Contacts Form
// ============================================================

export function SendContactsForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const contacts = (config.contacts as Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>) || [];

  function updateContact(idx: number, patch: Record<string, unknown>) {
    const updated = [...contacts];
    updated[idx] = { ...updated[idx], ...patch };
    onChange({ contacts: updated });
  }

  function addContact() {
    onChange({ contacts: [...contacts, { name: { formatted_name: '' }, phones: [{ phone: '' }] }] });
  }

  function removeContact(idx: number) {
    onChange({ contacts: contacts.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      {contacts.map((c, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Contact {idx + 1}</span>
            {contacts.length > 1 && <button type="button" onClick={() => removeContact(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}
          </div>
          <Input value={c.name?.formatted_name || ''} onChange={(e) => updateContact(idx, { name: { formatted_name: e.target.value } })} placeholder="Full name" />
          <Input value={c.phones?.[0]?.phone || ''} onChange={(e) => updateContact(idx, { phones: [{ phone: e.target.value }] })} placeholder="Phone (+1234567890)" />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addContact}><Plus className="size-3 mr-1" /> Add Contact</Button>
    </div>
  );
}

// ============================================================
// Send CTA URL Form
// ============================================================

export function SendCtaUrlForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Body Text (required)</Label>
        <Textarea value={(config.body_text as string) || ''} onChange={(e) => onChange({ body_text: e.target.value })} placeholder="Check out our latest offer!" rows={3} maxLength={1024} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Footer (optional)</Label>
        <Input value={(config.footer_text as string) || ''} onChange={(e) => onChange({ footer_text: e.target.value })} placeholder="Tap the button below" maxLength={60} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Button Text (max 20 chars)</Label>
        <Input value={(config.button_text as string) || ''} onChange={(e) => onChange({ button_text: e.target.value })} placeholder="Visit Website" maxLength={20} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">URL</Label>
        <Input value={(config.url as string) || ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://example.com" />
      </div>
    </div>
  );
}

// ============================================================
// Ask Location Form
// ============================================================

export function AskLocationForm({ config, onChange }: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Prompt Text</Label>
        <Textarea value={(config.body_text as string) || ''} onChange={(e) => onChange({ body_text: e.target.value })} placeholder="Please share your location so we can find the nearest store." rows={3} maxLength={1024} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        This sends a location request message. The customer will see a &quot;Send Location&quot; button that opens WhatsApp&apos;s native location picker.
      </p>
    </div>
  );
}
