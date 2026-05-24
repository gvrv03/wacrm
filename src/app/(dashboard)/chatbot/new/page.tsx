'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Loader2, Upload,
  MessageSquare, List, ExternalLink, Sparkles,
  Image as ImageIcon, Video, FileText,
  Bold, Italic, Strikethrough, Code,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ============================================================
// Types & Constants
// ============================================================

type ReplyType = 'text' | 'interactive_buttons' | 'interactive_list' | 'cta_url';
type TriggerType = 'welcome' | 'is' | 'starts_with' | 'ends_with' | 'contains_whole_word' | 'contains';

interface FormState {
  name: string;
  reply_type: ReplyType;
  reply_text: string;
  header_type: string;
  header_content: string;
  footer_text: string;
  buttons: Array<{ text: string; id: string }>;
  list_sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  list_button_text: string;
  cta_button_text: string;
  cta_button_url: string;
  trigger_type: TriggerType;
  trigger_value: string;
  case_sensitive: boolean;
  is_active: boolean;
}

const VARIABLES = [
  { key: '{name}', label: 'Name' },
  { key: '{phone}', label: 'Phone' },
  { key: '{email}', label: 'Email' },
  { key: '{company}', label: 'Company' },
];

const TRIGGERS: { value: TriggerType; label: string; hint: string }[] = [
  { value: 'welcome', label: 'Welcome', hint: 'Triggers on first message from a new contact' },
  { value: 'is', label: 'Is', hint: 'Exact match (case-insensitive by default)' },
  { value: 'starts_with', label: 'Starts with', hint: 'Message begins with this text' },
  { value: 'ends_with', label: 'Ends with', hint: 'Message ends with this text' },
  { value: 'contains_whole_word', label: 'Contains whole word', hint: 'Word boundary match' },
  { value: 'contains', label: 'Contains', hint: 'Appears anywhere in the message' },
];

const REPLY_TYPES: { value: ReplyType; label: string; icon: typeof MessageSquare }[] = [
  { value: 'text', label: 'Reply Message', icon: MessageSquare },
  { value: 'interactive_buttons', label: 'Reply Buttons', icon: Sparkles },
  { value: 'cta_url', label: 'CTA URL Button', icon: ExternalLink },
  { value: 'interactive_list', label: 'List Message', icon: List },
];

const EMPTY: FormState = {
  name: '', reply_type: 'interactive_buttons', reply_text: '',
  header_type: 'none', header_content: '', footer_text: '',
  buttons: [{ text: '', id: 'btn_1' }],
  list_sections: [{ title: '', rows: [{ id: 'row_1', title: '' }] }],
  list_button_text: 'View Options', cta_button_text: '', cta_button_url: '',
  trigger_type: 'contains', trigger_value: '', case_sensitive: false, is_active: true,
};

function uid() { return Math.random().toString(36).slice(2, 10); }

// ============================================================
// Page
// ============================================================

export default function NewChatbotReplyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing reply for editing
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/chatbot`).then((r) => r.json()).then((d) => {
      const reply = (d.replies || []).find((r: { id: string }) => r.id === editId);
      if (!reply) return;
      setForm({
        name: reply.name, reply_type: reply.reply_type, reply_text: reply.reply_text,
        header_type: reply.header_type || 'none', header_content: reply.header_content || '',
        footer_text: reply.footer_text || '',
        buttons: reply.buttons || [{ text: '', id: 'btn_1' }],
        list_sections: reply.list_sections || [{ title: '', rows: [{ id: 'row_1', title: '' }] }],
        list_button_text: reply.list_button_text || 'View Options',
        cta_button_text: reply.cta_button_text || '', cta_button_url: reply.cta_button_url || '',
        trigger_type: reply.trigger_type, trigger_value: reply.trigger_value || '',
        case_sensitive: reply.case_sensitive, is_active: reply.is_active,
      });
    });
  }, [editId]);

  // ─── Validation (Meta WhatsApp API limits) ───
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.reply_text.trim()) e.reply_text = 'Required';
    if (form.reply_text.length > 4096) e.reply_text = 'Max 4096 characters (WhatsApp limit)';
    if (form.trigger_type !== 'welcome' && !form.trigger_value.trim()) e.trigger_value = 'Required';
    if (form.header_type === 'text' && form.header_content.length > 60) e.header_content = 'Max 60 chars';
    if (form.footer_text.length > 60) e.footer_text = 'Max 60 chars';

    if (form.reply_type === 'interactive_buttons') {
      const valid = form.buttons.filter((b) => b.text.trim());
      if (valid.length === 0) e.buttons = 'At least 1 button required';
      if (valid.length > 3) e.buttons = 'Max 3 buttons (WhatsApp limit)';
      for (const btn of form.buttons) {
        if (btn.text.length > 20) e[`btn_${btn.id}`] = 'Max 20 chars per button';
      }
    }
    if (form.reply_type === 'interactive_list') {
      const totalRows = form.list_sections.reduce((s, sec) => s + sec.rows.length, 0);
      if (totalRows === 0) e.list = 'At least 1 row required';
      if (totalRows > 10) e.list = 'Max 10 rows total (WhatsApp limit)';
      if (form.list_sections.length > 10) e.list = 'Max 10 sections';
      for (const sec of form.list_sections) {
        for (const row of sec.rows) {
          if (row.title.length > 24) e[`row_${row.id}`] = 'Row title max 24 chars';
          if (row.description && row.description.length > 72) e[`row_${row.id}_desc`] = 'Description max 72 chars';
        }
      }
    }
    if (form.reply_type === 'cta_url') {
      if (!form.cta_button_url.trim()) e.cta_url = 'URL required';
      if (form.cta_button_text.length > 20) e.cta_text = 'Max 20 chars';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 MB'); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/chatbot/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('template-media').upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('template-media').getPublicUrl(path);
      setForm((f) => ({ ...f, header_content: data.publicUrl }));
      toast.success('Uploaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Chatbot Upload]', msg);
      toast.error(`Upload failed: ${msg}`);
    }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        buttons: form.reply_type === 'interactive_buttons' ? form.buttons.filter((b) => b.text.trim()) : null,
        list_sections: form.reply_type === 'interactive_list' ? form.list_sections : null,
        header_type: form.header_type === 'none' ? null : form.header_type,
        header_content: form.header_type !== 'none' ? form.header_content : null,
        cta_button_text: form.reply_type === 'cta_url' ? form.cta_button_text : null,
        cta_button_url: form.reply_type === 'cta_url' ? form.cta_button_url : null,
      };
      const res = editId
        ? await fetch(`/api/chatbot/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
      toast.success(editId ? 'Updated' : 'Created');
      router.push('/chatbot');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  }

  function insertFormat(prefix: string, suffix: string) {
    const el = document.querySelector<HTMLTextAreaElement>('[data-reply-input]');
    if (!el) { setForm((f) => ({ ...f, reply_text: f.reply_text + prefix + suffix })); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = form.reply_text;
    const selected = text.slice(start, end);
    setForm({ ...form, reply_text: text.slice(0, start) + prefix + selected + suffix + text.slice(end) });
  }

  return (
    <div className="space-y-6 mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/chatbot')} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{editId ? 'Edit' : 'Create'} Bot Reply</h1>
          <p className="text-sm text-muted-foreground">Configure an auto-reply with WhatsApp interactive messages</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/chatbot')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
          {editId ? 'Save Changes' : 'Create Reply'}
        </Button>
      </div>

      {/* Two-column layout — form left, preview fixed right */}
      <div className="flex gap-6 items-start">
        {/* Left: Form (scrollable) */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Name */}
          <Section title="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welcome Message, FAQ Menu" />
            {errors.name && <Err>{errors.name}</Err>}
          </Section>

          {/* Reply Type */}
          <Section title="Reply Type">
            <div className="grid grid-cols-2 gap-2">
              {REPLY_TYPES.map((rt) => {
                const Icon = rt.icon;
                const active = form.reply_type === rt.value;
                return (
                  <button key={rt.value} type="button" onClick={() => setForm({ ...form, reply_type: rt.value })}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-3 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30'}`}>
                    <Icon className={`size-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{rt.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Reply Text */}
          <Section title="Reply Text">
            <div className="rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring">
              <Textarea
                data-reply-input
                value={form.reply_text}
                onChange={(e) => setForm({ ...form, reply_text: e.target.value })}
                placeholder="Your message body text"
                rows={5}
                className="resize-y border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
              />
              <div className="flex items-center justify-between border-t border-border px-3 py-2 bg-muted/20">
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => insertFormat('*', '*')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Bold"><Bold className="size-3.5 text-muted-foreground" /></button>
                  <button type="button" onClick={() => insertFormat('_', '_')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Italic"><Italic className="size-3.5 text-muted-foreground" /></button>
                  <button type="button" onClick={() => insertFormat('~', '~')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Strikethrough"><Strikethrough className="size-3.5 text-muted-foreground" /></button>
                  <button type="button" onClick={() => insertFormat('```', '```')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Code"><Code className="size-3.5 text-muted-foreground" /></button>
                </div>
                <span className="text-[11px] text-muted-foreground">{form.reply_text.length}/4096</span>
              </div>
            </div>
            {errors.reply_text && <Err>{errors.reply_text}</Err>}
            <div className="rounded-lg bg-muted/30 border border-border p-3 mt-3">
              <p className="text-xs font-medium text-foreground mb-2">Insert contact variable:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button key={v.key} type="button" onClick={() => setForm((f) => ({ ...f, reply_text: f.reply_text + ' ' + v.key }))}
                    className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-mono text-primary hover:bg-primary/20 transition-colors">
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{form.reply_text.length}/4096</p>
          </Section>

          {/* Header */}
          <Section title="Header Type" optional>
            <Select value={form.header_type} onValueChange={(v) => setForm({ ...form, header_type: v, header_content: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
            {form.header_type === 'text' && (
              <><Input value={form.header_content} onChange={(e) => setForm({ ...form, header_content: e.target.value })} placeholder="Header text" maxLength={60} className="mt-2" />
              {errors.header_content && <Err>{errors.header_content}</Err>}</>
            )}
            {['image', 'video', 'document'].includes(form.header_type) && (
              <div className="mt-2">
                {form.header_content ? (
                  <div className="relative rounded-lg border border-border overflow-hidden">
                    {form.header_type === 'image' && <img src={form.header_content} alt="" className="w-full h-36 object-cover" />}
                    {form.header_type === 'video' && <video src={form.header_content} className="w-full h-36 object-cover" controls />}
                    {form.header_type === 'document' && <div className="h-14 flex items-center gap-2 px-3 bg-muted/30"><FileText className="size-5 text-muted-foreground" /><span className="text-xs truncate">{form.header_content.split('/').pop()}</span></div>}
                    <button type="button" onClick={() => setForm({ ...form, header_content: '' })} className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X className="size-3.5" /></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:border-primary/40 transition-colors">
                    {uploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Upload className="size-5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{uploading ? 'Uploading...' : `Upload ${form.header_type}`}</span>
                    <input ref={fileRef} type="file" className="hidden" accept={form.header_type === 'image' ? 'image/*' : form.header_type === 'video' ? 'video/*' : '*'} onChange={handleUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            )}
          </Section>

          {/* Buttons */}
          {form.reply_type === 'interactive_buttons' && (
            <Section title="Reply Buttons" hint="Max 3 buttons, 20 chars each (WhatsApp limit)">
              {errors.buttons && <Err>{errors.buttons}</Err>}
              <div className="space-y-2">
                {form.buttons.map((btn, i) => (
                  <div key={btn.id} className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                    <Input value={btn.text} onChange={(e) => { const u = [...form.buttons]; u[i] = { ...btn, text: e.target.value }; setForm({ ...form, buttons: u }); }} placeholder="Button text" maxLength={20} className="flex-1" />
                    {form.buttons.length > 1 && <button type="button" onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>}
                  </div>
                ))}
                {form.buttons.length < 3 && <Button variant="outline" size="sm" onClick={() => setForm({ ...form, buttons: [...form.buttons, { text: '', id: `btn_${uid()}` }] })}><Plus className="size-3 mr-1" />Add Button</Button>}
              </div>
            </Section>
          )}

          {/* CTA URL */}
          {form.reply_type === 'cta_url' && (
            <Section title="CTA URL Button">
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Button Text (max 20 chars)</Label><Input value={form.cta_button_text} onChange={(e) => setForm({ ...form, cta_button_text: e.target.value })} placeholder="Visit Website" maxLength={20} className="mt-1" />{errors.cta_text && <Err>{errors.cta_text}</Err>}</div>
                <div><Label className="text-xs text-muted-foreground">URL</Label><Input value={form.cta_button_url} onChange={(e) => setForm({ ...form, cta_button_url: e.target.value })} placeholder="https://example.com" className="mt-1" />{errors.cta_url && <Err>{errors.cta_url}</Err>}</div>
              </div>
            </Section>
          )}

          {/* List */}
          {form.reply_type === 'interactive_list' && (
            <Section title="List Sections" hint="Max 10 sections, 10 rows total, row title max 24 chars">
              {errors.list && <Err>{errors.list}</Err>}
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Menu Button Text</Label><Input value={form.list_button_text} onChange={(e) => setForm({ ...form, list_button_text: e.target.value })} placeholder="View Options" className="mt-1" maxLength={20} /></div>
                {form.list_sections.map((sec, sIdx) => (
                  <div key={sIdx} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Section {sIdx + 1}</span>{form.list_sections.length > 1 && <button type="button" onClick={() => setForm({ ...form, list_sections: form.list_sections.filter((_, i) => i !== sIdx) })} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>}</div>
                    <Input value={sec.title} onChange={(e) => { const u = [...form.list_sections]; u[sIdx] = { ...sec, title: e.target.value }; setForm({ ...form, list_sections: u }); }} placeholder="Section title" />
                    {sec.rows.map((row, rIdx) => (
                      <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input value={row.title} onChange={(e) => { const u = [...form.list_sections]; const rows = [...u[sIdx].rows]; rows[rIdx] = { ...row, title: e.target.value }; u[sIdx] = { ...sec, rows }; setForm({ ...form, list_sections: u }); }} placeholder="Row title" maxLength={24} />
                        <Input value={row.description || ''} onChange={(e) => { const u = [...form.list_sections]; const rows = [...u[sIdx].rows]; rows[rIdx] = { ...row, description: e.target.value }; u[sIdx] = { ...sec, rows }; setForm({ ...form, list_sections: u }); }} placeholder="Description" maxLength={72} />
                        {sec.rows.length > 1 && <button type="button" onClick={() => { const u = [...form.list_sections]; u[sIdx] = { ...sec, rows: sec.rows.filter((_, i) => i !== rIdx) }; setForm({ ...form, list_sections: u }); }} className="text-muted-foreground hover:text-destructive self-center"><X className="size-3.5" /></button>}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => { const u = [...form.list_sections]; u[sIdx] = { ...sec, rows: [...sec.rows, { id: `row_${uid()}`, title: '' }] }; setForm({ ...form, list_sections: u }); }}><Plus className="size-3 mr-1" />Add Row</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, list_sections: [...form.list_sections, { title: '', rows: [{ id: `row_${uid()}`, title: '' }] }] })}><Plus className="size-3 mr-1" />Add Section</Button>
              </div>
            </Section>
          )}

          {/* Footer */}
          <Section title="Footer Text" optional>
            <Input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="Optional footer (max 60 chars)" maxLength={60} />
            {errors.footer_text && <Err>{errors.footer_text}</Err>}
          </Section>

          {/* Trigger */}
          <Section title="Trigger Type">
            <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v as TriggerType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{TRIGGERS.find((t) => t.value === form.trigger_type)?.hint}</p>
          </Section>

          {form.trigger_type !== 'welcome' && (
            <Section title="Trigger Subject">
              <Input value={form.trigger_value} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })} placeholder="Keywords (comma separated for multiple)" />
              {errors.trigger_value && <Err>{errors.trigger_value}</Err>}
              <p className="text-xs text-muted-foreground mt-1">Comma-separated for multiple triggers. E.g: hello, hi, hey</p>
            </Section>
          )}

          {/* Status */}
          <Section title="Status">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-foreground">Active</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
            </div>
          </Section>
        </div>

        {/* Right: WhatsApp Preview (sticky) */}
        <div className="hidden lg:block  shrink-0 sticky top-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Message Preview</h3>
            </div>
            <div className="p-5 bg-[#e5ddd5] min-h-[380px] flex flex-col justify-end">
              <div className="space-y-1.5 max-w-[250px] ml-auto">
                {/* Bubble */}
                <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                  {/* Header media */}
                  {form.header_type === 'image' && form.header_content && <img src={form.header_content} alt="" className="w-full h-[110px] object-cover" />}
                  {form.header_type === 'image' && !form.header_content && <div className="h-[80px] bg-gray-100 flex items-center justify-center"><ImageIcon className="size-6 text-gray-300" /></div>}
                  {form.header_type === 'video' && form.header_content && <video src={form.header_content} className="w-full h-[80px] object-cover" />}
                  {form.header_type === 'video' && !form.header_content && <div className="h-[80px] bg-gray-100 flex items-center justify-center"><Video className="size-6 text-gray-300" /></div>}
                  {form.header_type === 'document' && <div className="h-10 bg-gray-50 flex items-center gap-2 px-2.5 border-b border-gray-100"><FileText className="size-4 text-gray-400" /><span className="text-[10px] text-gray-500">Document</span></div>}
                  {form.header_type === 'text' && form.header_content && <div className="px-3 pt-2"><p className="text-[12px] font-bold text-gray-900">{form.header_content}</p></div>}

                  {/* Body with formatting */}
                  {form.reply_text ? (
                    <div className="px-3 py-2">
                      <div
                        className="text-[11.5px] text-gray-800 leading-[1.5] [&_strong]:font-bold [&_em]:italic [&_del]:line-through [&_code]:font-mono [&_code]:text-[10.5px] [&_code]:bg-gray-100 [&_code]:px-0.5 [&_code]:rounded-sm"
                        dangerouslySetInnerHTML={{ __html: renderWAFormat(form.reply_text) }}
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-3"><p className="text-[11px] text-gray-400 italic">Your message will appear here...</p></div>
                  )}

                  {/* Footer */}
                  {form.footer_text && <div className="px-3 pb-1"><p className="text-[10px] text-gray-400">{form.footer_text}</p></div>}

                  <div className="px-3 pb-1.5 flex justify-end"><span className="text-[9px] text-gray-400">10:32</span></div>
                </div>

                {/* Buttons preview */}
                {form.reply_type === 'interactive_buttons' && form.buttons.filter((b) => b.text.trim()).length > 0 && (
                  <div className="space-y-[1px]">
                    {form.buttons.filter((b) => b.text.trim()).map((btn) => (
                      <div key={btn.id} className="flex w-full items-center justify-center rounded-md bg-white py-1.5 text-[11px] font-medium text-[#00a884] shadow-sm">{btn.text}</div>
                    ))}
                  </div>
                )}

                {/* CTA preview */}
                {form.reply_type === 'cta_url' && form.cta_button_text && (
                  <div className="flex w-full items-center justify-center gap-1 rounded-md bg-white py-1.5 text-[11px] font-medium text-[#00a884] shadow-sm">
                    <ExternalLink className="size-3" />{form.cta_button_text}
                  </div>
                )}

                {/* List preview */}
                {form.reply_type === 'interactive_list' && (
                  <div className="flex w-full items-center justify-center gap-1 rounded-md bg-white py-1.5 text-[11px] font-medium text-[#00a884] shadow-sm">
                    <List className="size-3" />{form.list_button_text || 'View Options'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function Section({ title, optional, hint, children }: { title: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {title}{optional && <span className="text-muted-foreground font-normal ml-1">· Optional</span>}
        </h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive mt-1">{children}</p>;
}

function renderWAFormat(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```([\s\S]*?)```/g, '<code>$1</code>');
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/~(.*?)~/g, '<del>$1</del>');
  html = html.replace(/\{(\w+)\}/g, '<span style="background:#dcfce7;color:#166534;padding:0 3px;border-radius:2px;font-size:10px;">{$1}</span>');
  html = html.replace(/\n/g, '<br>');
  return html;
}
