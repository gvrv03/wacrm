'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  ChevronDown,
  ExternalLink,
  Phone,
  Copy,
  MessageSquare as Reply,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { TemplatePreview } from '@/components/templates/template-preview';
import { MediaUpload } from '@/components/templates/media-upload';

// ============================================================
// Types
// ============================================================

type Category = 'Marketing' | 'Utility' | 'Authentication';
type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document';
type ButtonType = 'quick_reply' | 'url' | 'phone_number' | 'copy_code' | 'flow';

interface TemplateButton {
  id: string;
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

interface CarouselCardButton {
  id: string;
  text: string;
  type: 'quick_reply' | 'url' | 'phone_number';
  url?: string;
  phone_number?: string;
}

interface CarouselCard {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  body_text: string;
  buttons: CarouselCardButton[];
}

export interface TemplateFormState {
  name: string;
  category: Category;
  language: string;
  header_type: HeaderType;
  header_text: string;
  header_media_url: string;
  body_text: string;
  footer_text: string;
  buttons: TemplateButton[];
  carousel_cards: CarouselCard[];
  validity_period_enabled: boolean;
  validity_period_minutes: number;
}

// ============================================================
// Constants
// ============================================================

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Utility', label: 'Utility' },
  { value: 'Authentication', label: 'Authentication' },
];

const LANGUAGES = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'es_MX', label: 'Spanish (MX)' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
];

const BUTTON_OPTIONS: { value: ButtonType; label: string; icon: typeof Reply }[] = [
  { value: 'quick_reply', label: 'Custom', icon: Reply },
  { value: 'url', label: 'Visit website', icon: ExternalLink },
  { value: 'phone_number', label: 'Call phone number', icon: Phone },
  { value: 'copy_code', label: 'Copy offer code', icon: Copy },
  { value: 'flow', label: 'Complete flow', icon: Workflow },
];

const MAX_BUTTONS = 10;
const MAX_QUICK_REPLY = 3;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ============================================================
// Page
// ============================================================

export default function NewTemplatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<TemplateFormState>({
    name: '',
    category: 'Marketing',
    language: 'en_US',
    header_type: 'none',
    header_text: '',
    header_media_url: '',
    body_text: '',
    footer_text: '',
    buttons: [],
    carousel_cards: [],
    validity_period_enabled: false,
    validity_period_minutes: 10,
  });

  // ─── Validation ───
  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = 'Template name is required';
    else if (!/^[a-z0-9_]+$/.test(form.name.trim())) {
      errs.name = 'Only lowercase letters, numbers, and underscores';
    }
    if (form.name.length > 512) errs.name = 'Max 512 characters';

    if (!form.body_text.trim()) errs.body_text = 'Body text is required';
    if (form.body_text.length > 1024) errs.body_text = 'Max 1024 characters';

    if (form.header_type === 'text' && form.header_text.length > 60) {
      errs.header_text = 'Max 60 characters';
    }

    if (form.footer_text.length > 60) errs.footer_text = 'Max 60 characters';

    const quickReplies = form.buttons.filter((b) => b.type === 'quick_reply');
    if (quickReplies.length > MAX_QUICK_REPLY) errs.buttons = `Max ${MAX_QUICK_REPLY} quick reply buttons`;
    if (form.buttons.length > MAX_BUTTONS) errs.buttons = `Max ${MAX_BUTTONS} buttons`;

    for (const btn of form.buttons) {
      if (!btn.text.trim()) errs[`btn_${btn.id}`] = 'Button text required';
      if (btn.text.length > 25) errs[`btn_${btn.id}`] = 'Max 25 characters';
      if (btn.type === 'url' && !btn.url?.trim()) errs[`btn_${btn.id}_url`] = 'URL required';
      if (btn.type === 'phone_number' && !btn.phone_number?.trim()) errs[`btn_${btn.id}_phone`] = 'Phone required';
    }

    // Carousel validations
    if (form.carousel_cards.length > 10) errs.carousel = 'Max 10 carousel cards';
    for (const card of form.carousel_cards) {
      if (!card.body_text.trim()) errs[`card_${card.id}`] = 'Card body text required';
      if (card.body_text.length > 160) errs[`card_${card.id}`] = 'Card body max 160 characters';
      if (card.buttons.length > 2) errs[`card_${card.id}_btns`] = 'Max 2 buttons per card';
      for (const cbtn of card.buttons) {
        if (!cbtn.text.trim()) errs[`cbtn_${cbtn.id}`] = 'Card button text required';
        if (cbtn.text.length > 25) errs[`cbtn_${cbtn.id}`] = 'Max 25 characters';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Save ───
  async function handleSave() {
    if (!validate()) return;
    if (!user) { toast.error('Not authenticated'); return; }

    setSaving(true);
    try {
      const supabase = createClient();

      const payload: Record<string, unknown> = {
        user_id: user.id,
        name: form.name.trim(),
        category: form.category,
        language: form.language,
        header_type: form.header_type === 'none' ? null : form.header_type,
        header_content: form.header_type === 'text'
          ? form.header_text.trim()
          : (form.header_type !== 'none' && form.header_media_url.trim())
            ? form.header_media_url.trim()
            : null,
        body_text: form.body_text.trim(),
        footer_text: form.footer_text.trim() || null,
        buttons: form.buttons.length > 0
          ? form.buttons.map((b) => ({
              type: b.type,
              text: b.text,
              ...(b.type === 'url' && b.url ? { url: b.url } : {}),
              ...(b.type === 'phone_number' && b.phone_number ? { phone_number: b.phone_number } : {}),
              ...(b.type === 'copy_code' && b.example ? { example: b.example } : {}),
            }))
          : null,
        carousel_cards: form.carousel_cards.length > 0
          ? form.carousel_cards.map((c) => ({
              media_type: c.media_type,
              media_url: c.media_url || null,
              body_text: c.body_text,
              buttons: c.buttons.map((cb) => ({
                type: cb.type,
                text: cb.text,
                ...(cb.url ? { url: cb.url } : {}),
                ...(cb.phone_number ? { phone_number: cb.phone_number } : {}),
              })),
            }))
          : null,
        validity_period_minutes: form.validity_period_enabled ? form.validity_period_minutes : null,
        status: 'Draft',
      };

      const { error } = await supabase.from('message_templates').insert(payload);
      if (error) throw error;
      toast.success('Template created');
      router.push('/templates');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  // ─── Button helpers ───
  function addButton(type: ButtonType) {
    if (form.buttons.length >= MAX_BUTTONS) return;
    if (type === 'quick_reply' && form.buttons.filter((b) => b.type === 'quick_reply').length >= MAX_QUICK_REPLY) {
      toast.error(`Max ${MAX_QUICK_REPLY} quick reply buttons`);
      return;
    }
    setForm((f) => ({
      ...f,
      buttons: [...f.buttons, { id: uid(), type, text: '', url: '', phone_number: '', example: '' }],
    }));
  }

  function updateButton(id: string, patch: Partial<TemplateButton>) {
    setForm((f) => ({ ...f, buttons: f.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }

  function removeButton(id: string) {
    setForm((f) => ({ ...f, buttons: f.buttons.filter((b) => b.id !== id) }));
  }

  // ─── Carousel helpers ───
  function addCarouselCard() {
    if (form.carousel_cards.length >= 10) return;
    setForm((f) => ({
      ...f,
      carousel_cards: [...f.carousel_cards, { id: uid(), media_type: 'image', media_url: '', body_text: '', buttons: [] }],
    }));
  }

  function updateCarouselCard(id: string, patch: Partial<CarouselCard>) {
    setForm((f) => ({
      ...f,
      carousel_cards: f.carousel_cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeCarouselCard(id: string) {
    setForm((f) => ({ ...f, carousel_cards: f.carousel_cards.filter((c) => c.id !== id) }));
  }

  function addCarouselCardButton(cardId: string) {
    setForm((f) => ({
      ...f,
      carousel_cards: f.carousel_cards.map((c) =>
        c.id === cardId && c.buttons.length < 2
          ? { ...c, buttons: [...c.buttons, { id: uid(), text: '', type: 'quick_reply' as const }] }
          : c
      ),
    }));
  }

  function updateCarouselCardButton(cardId: string, btnId: string, patch: Partial<CarouselCardButton>) {
    setForm((f) => ({
      ...f,
      carousel_cards: f.carousel_cards.map((c) =>
        c.id === cardId
          ? { ...c, buttons: c.buttons.map((b) => (b.id === btnId ? { ...b, ...patch } : b)) }
          : c
      ),
    }));
  }

  function removeCarouselCardButton(cardId: string, btnId: string) {
    setForm((f) => ({
      ...f,
      carousel_cards: f.carousel_cards.map((c) =>
        c.id === cardId ? { ...c, buttons: c.buttons.filter((b) => b.id !== btnId) } : c
      ),
    }));
  }

  function insertCardFormatting(cardId: string, prefix: string, suffix: string) {
    setForm((f) => ({
      ...f,
      carousel_cards: f.carousel_cards.map((c) => {
        if (c.id !== cardId) return c;
        return { ...c, body_text: c.body_text + prefix + suffix };
      }),
    }));
  }

  // ─── Body formatting ───
  function insertFormatting(prefix: string, suffix: string) {
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-body-input]');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.body_text;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setForm({ ...form, body_text: newText });
  }

  function addVariable() {
    const vars = form.body_text.match(/\{\{(\d+)\}\}/g) || [];
    const nextNum = vars.length + 1;
    setForm({ ...form, body_text: form.body_text + `{{${nextNum}}}` });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/templates')} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Create template</h1>
        </div>
        <Button variant="outline" onClick={() => router.push('/templates')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
          {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
          Submit for Review
        </Button>
      </div>

      {/* Template name badge */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
          <Reply className="size-5 text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {form.name || 'your_template_name'} · {LANGUAGES.find((l) => l.code === form.language)?.label || form.language}
          </p>
          <p className="text-xs text-muted-foreground">{form.category} · Default</p>
        </div>
      </div>

      {/* Notice for Authentication & Flow templates */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <span className="font-medium">Note:</span> Authentication templates (OTP) and Flow templates are supported for sending, however you need to create/edit those templates directly on{' '}
          <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-amber-900">Meta&apos;s Template Editor</a>. Use &quot;Sync from Meta&quot; on the templates page to pull them into this app after approval.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Template name and language */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Template name and language</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
              <div className="space-y-1.5">
                <Label>Name your template</Label>
                <div className="relative">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    placeholder="Enter a template name"
                    className="font-mono pr-16"
                    maxLength={512}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {form.name.length}/512
                  </span>
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Select language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Content</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add a header, body and footer for your template. Cloud API hosted by Meta will review the template variables and content.
              </p>
            </div>

            {/* Header */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Header · <span className="font-normal text-muted-foreground">Optional</span></Label>
              <Select value={form.header_type} onValueChange={(v) => setForm({ ...form, header_type: v as HeaderType })}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>

              {form.header_type === 'text' && (
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      value={form.header_text}
                      onChange={(e) => setForm({ ...form, header_text: e.target.value })}
                      placeholder="Add a short line of text to the header of your message in English"
                      maxLength={60}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {form.header_text.length}/60
                    </span>
                  </div>
                  {errors.header_text && <p className="text-xs text-destructive">{errors.header_text}</p>}
                </div>
              )}

              {(form.header_type === 'image' || form.header_type === 'video' || form.header_type === 'document') && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Media sample · Optional</Label>
                  <MediaUpload
                    value={form.header_media_url}
                    onChange={(url) => setForm({ ...form, header_media_url: url })}
                    mediaType={form.header_type}
                    pathPrefix="header/"
                  />
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Body</Label>
              <div className="rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring">
                <Textarea
                  data-body-input
                  value={form.body_text}
                  onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                  placeholder="Enter your message body text"
                  rows={5}
                  className="resize-y border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                  maxLength={1024}
                />
                <div className="flex items-center justify-between border-t border-border px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => insertFormatting('*', '*')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Bold">
                      <Bold className="size-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => insertFormatting('_', '_')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Italic">
                      <Italic className="size-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => insertFormatting('~', '~')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Strikethrough">
                      <Strikethrough className="size-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => insertFormatting('```', '```')} className="flex size-7 items-center justify-center rounded hover:bg-muted" title="Code">
                      <Code className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <button type="button" onClick={addVariable} className="text-xs text-primary hover:text-primary/80 font-medium">
                    + Add variable
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                {errors.body_text && <p className="text-xs text-destructive">{errors.body_text}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{form.body_text.length}/1024</p>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Footer · <span className="font-normal text-muted-foreground">Optional</span></Label>
              <div className="relative">
                <Input
                  value={form.footer_text}
                  onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
                  placeholder="Add a short line of text to the bottom of your message in English"
                  maxLength={60}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {form.footer_text.length}/60
                </span>
              </div>
              {errors.footer_text && <p className="text-xs text-destructive">{errors.footer_text}</p>}
            </div>
          </section>

          {/* Buttons */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Buttons · <span className="font-normal text-muted-foreground">Optional</span></h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create buttons that let customers respond to your message or take action. You can add up to ten buttons. If you add more than three buttons, they will appear in a list.
              </p>
            </div>

            {errors.buttons && <p className="text-xs text-destructive">{errors.buttons}</p>}

            {/* Button list */}
            {form.buttons.map((btn, idx) => (
              <div key={btn.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {BUTTON_OPTIONS.find((o) => o.value === btn.type)?.label}
                    </span>
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>
                  <button type="button" onClick={() => removeButton(btn.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={btn.text}
                      onChange={(e) => updateButton(btn.id, { text: e.target.value })}
                      placeholder="Button text"
                      maxLength={25}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {btn.text.length}/25
                    </span>
                  </div>
                  {errors[`btn_${btn.id}`] && <p className="text-xs text-destructive">{errors[`btn_${btn.id}`]}</p>}

                  {btn.type === 'url' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Website URL</Label>
                      <Input
                        value={btn.url || ''}
                        onChange={(e) => updateButton(btn.id, { url: e.target.value })}
                        placeholder="https://example.com/{{1}}"
                      />
                      {errors[`btn_${btn.id}_url`] && <p className="text-xs text-destructive">{errors[`btn_${btn.id}_url`]}</p>}
                    </div>
                  )}

                  {btn.type === 'phone_number' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Phone number</Label>
                      <Input
                        value={btn.phone_number || ''}
                        onChange={(e) => updateButton(btn.id, { phone_number: e.target.value })}
                        placeholder="+1234567890"
                      />
                      {errors[`btn_${btn.id}_phone`] && <p className="text-xs text-destructive">{errors[`btn_${btn.id}_phone`]}</p>}
                    </div>
                  )}

                  {btn.type === 'copy_code' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Offer code example</Label>
                      <Input
                        value={btn.example || ''}
                        onChange={(e) => updateButton(btn.id, { example: e.target.value })}
                        placeholder="SAVE20"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add button dropdown */}
            {form.buttons.length < MAX_BUTTONS && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="size-3.5 mr-1.5" />
                    Add button
                    <ChevronDown className="size-3.5 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  {BUTTON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <DropdownMenuItem key={opt.value} onClick={() => addButton(opt.value)}>
                        <Icon className="size-4" />
                        {opt.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </section>

          {/* Carousel */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Carousel · <span className="font-normal text-muted-foreground">Optional</span></h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add up to 10 media cards with image/video headers, body text, and up to 2 buttons each. Carousel templates allow customers to swipe through product cards.
              </p>
            </div>

            {form.carousel_cards.map((card, idx) => (
              <div key={card.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Card {idx + 1}</span>
                  <button type="button" onClick={() => removeCarouselCard(card.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Media type</Label>
                    <Select value={card.media_type} onValueChange={(v) => updateCarouselCard(card.id, { media_type: v as 'image' | 'video' })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Media ({card.media_type})</Label>
                    <MediaUpload
                      value={card.media_url}
                      onChange={(url) => updateCarouselCard(card.id, { media_url: url })}
                      mediaType={card.media_type}
                      pathPrefix={`carousel/${card.id}/`}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Card body text</Label>
                    <div className="rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring">
                      <Textarea
                        value={card.body_text}
                        onChange={(e) => updateCarouselCard(card.id, { body_text: e.target.value })}
                        placeholder="Product description..."
                        rows={2}
                        className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                        maxLength={160}
                      />
                      <div className="flex items-center justify-between border-t border-border px-2 py-1 bg-muted/30">
                        <div className="flex items-center gap-0.5">
                          <button type="button" onClick={() => insertCardFormatting(card.id, '*', '*')} className="flex size-6 items-center justify-center rounded hover:bg-muted" title="Bold">
                            <Bold className="size-3 text-muted-foreground" />
                          </button>
                          <button type="button" onClick={() => insertCardFormatting(card.id, '_', '_')} className="flex size-6 items-center justify-center rounded hover:bg-muted" title="Italic">
                            <Italic className="size-3 text-muted-foreground" />
                          </button>
                          <button type="button" onClick={() => insertCardFormatting(card.id, '~', '~')} className="flex size-6 items-center justify-center rounded hover:bg-muted" title="Strikethrough">
                            <Strikethrough className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{card.body_text.length}/160</span>
                      </div>
                    </div>
                  </div>

                  {/* Card buttons (max 2) */}
                  {card.buttons.map((cbtn, bIdx) => (
                    <div key={cbtn.id} className="flex items-center gap-2">
                      <Input
                        value={cbtn.text}
                        onChange={(e) => updateCarouselCardButton(card.id, cbtn.id, { text: e.target.value })}
                        placeholder={`Button ${bIdx + 1} text`}
                        className="flex-1"
                        maxLength={25}
                      />
                      <button type="button" onClick={() => removeCarouselCardButton(card.id, cbtn.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {card.buttons.length < 2 && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => addCarouselCardButton(card.id)}>
                      <Plus className="size-3 mr-1" /> Add card button
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {form.carousel_cards.length < 10 && (
              <Button variant="outline" size="sm" onClick={addCarouselCard}>
                <Plus className="size-3.5 mr-1.5" />
                Add carousel card ({form.carousel_cards.length}/10)
              </Button>
            )}
          </section>

          {/* Message validity period */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Message validity period</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                You can set a custom validity period that your marketing message must be delivered by before it expires. If a message is not delivered within this time frame, you will not be charged and your customer will not see the message.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Set custom validity period for your message</p>
                <p className="text-xs text-muted-foreground">
                  If you don&apos;t set a custom validity period, the standard 10 minutes WhatsApp message validity period will be applied.
                </p>
              </div>
              <Switch
                checked={form.validity_period_enabled}
                onCheckedChange={(v) => setForm({ ...form, validity_period_enabled: !!v })}
              />
            </div>

            {form.validity_period_enabled && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Validity period (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={form.validity_period_minutes}
                  onChange={(e) => setForm({ ...form, validity_period_minutes: Math.max(1, Number(e.target.value)) })}
                  className="w-32"
                />
              </div>
            )}
          </section>
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-6">
          <TemplatePreview form={form} />
        </div>
      </div>
    </div>
  );
}
