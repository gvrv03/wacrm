'use client';

import { useEffect, useState } from 'react';
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  ExternalLink,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CopyField } from '@/components/developer/copy-field';
import { CodeBlock } from '@/components/developer/code-block';

// ============================================================
// Types
// ============================================================

interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  events: string[];
}

const WEBHOOK_EVENTS = [
  { value: 'message.received', label: 'Message Received' },
  { value: 'message.sent', label: 'Message Sent' },
  { value: 'message.delivered', label: 'Message Delivered' },
  { value: 'message.read', label: 'Message Read' },
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'contact.updated', label: 'Contact Updated' },
  { value: 'conversation.assigned', label: 'Conversation Assigned' },
  { value: 'conversation.closed', label: 'Conversation Closed' },
];

// ============================================================
// Page
// ============================================================

export default function ApiWebhookPage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [webhook, setWebhook] = useState<WebhookConfig>({ enabled: false, url: '', secret: '', events: [] });
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [tokenName, setTokenName] = useState('');

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBaseUrl = `${siteUrl}/api/v1`;
  const webhookEndpoint = `${siteUrl}/api/whatsapp/webhook`;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tokensRes, webhookRes] = await Promise.all([
        fetch('/api/developer/tokens'),
        fetch('/api/developer/webhook'),
      ]);
      const tokensData = await tokensRes.json();
      const webhookData = await webhookRes.json();
      setTokens(tokensData.tokens || []);
      if (webhookData.webhook) setWebhook(webhookData.webhook);
    } catch {
      toast.error('Failed to load API settings');
    } finally {
      setLoading(false);
    }
  }

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch('/api/developer/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName || 'Default' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setNewToken(data.token);
      setTokenName('');
      loadData();
      toast.success('API token generated');
    } catch {
      toast.error('Failed to generate token');
    } finally {
      setGenerating(false);
    }
  }

  async function revokeToken(id: string) {
    try {
      const res = await fetch('/api/developer/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { toast.error('Failed to revoke'); return; }
      setTokens((t) => t.filter((tk) => tk.id !== id));
      toast.success('Token revoked');
    } catch {
      toast.error('Failed to revoke token');
    }
  }

  async function saveWebhook() {
    setSavingWebhook(true);
    try {
      const res = await fetch('/api/developer/webhook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhook),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      toast.success('Webhook settings saved');
    } catch {
      toast.error('Failed to save webhook');
    } finally {
      setSavingWebhook(false);
    }
  }

  async function generateWebhookSecret() {
    const res = await fetch('/api/developer/webhook', { method: 'POST' });
    const data = await res.json();
    setWebhook((w) => ({ ...w, secret: data.secret }));
    toast.success('New secret generated');
  }

  function toggleEvent(event: string) {
    setWebhook((w) => ({
      ...w,
      events: w.events.includes(event)
        ? w.events.filter((e) => e !== event)
        : [...w.events, event],
    }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const exampleSendUrl = `${apiBaseUrl}/send-message`;
  const verifyToken = user?.id?.slice(0, 8) || 'your_verify_token';

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API & Webhook</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integrate with external applications using API tokens and webhooks.
        </p>
      </div>

      {/* ─── Webhook Endpoint ─── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Webhook className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Webhook Endpoint</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          WhatsApp webhook payloads will be forwarded to the following endpoint via POST method.
        </p>

        <div className="flex items-center gap-3">
          <Switch
            checked={webhook.enabled}
            onCheckedChange={(v) => setWebhook((w) => ({ ...w, enabled: !!v }))}
          />
          <span className="text-sm font-medium text-foreground">Enable Webhook Forwarding</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input
              value={webhook.url}
              onChange={(e) => setWebhook((w) => ({ ...w, url: e.target.value }))}
              placeholder="https://your-app.com/api/webhook"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Webhook Secret</Label>
            <div className="flex gap-2">
              <Input
                value={webhook.secret}
                onChange={(e) => setWebhook((w) => ({ ...w, secret: e.target.value }))}
                placeholder="Your webhook signing secret"
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={generateWebhookSecret}>
                <RefreshCw className="size-3.5" />
                New
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((evt) => (
                <label key={evt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhook.events.includes(evt.value)}
                    onChange={() => toggleEvent(evt.value)}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">{evt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={saveWebhook} disabled={savingWebhook}>
            {savingWebhook && <Loader2 className="size-4 animate-spin mr-1.5" />}
            Save Webhook Settings
          </Button>
        </div>

        <CodeBlock
          title="Example Webhook Response"
          code={JSON.stringify({
            event: 'message.received',
            timestamp: new Date().toISOString(),
            data: {
              contact: {
                id: 'uuid',
                phone: '+1234567890',
                name: 'John Doe',
              },
              message: {
                id: 'wamid.xxx',
                type: 'text',
                text: 'Hello!',
                timestamp: new Date().toISOString(),
              },
            },
          }, null, 2)}
        />
      </section>

      {/* ─── API Access Token ─── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Key className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Your Account Access API</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Access tokens are required to use your APIs. Pass the token as a Bearer token in the Authorization header.
        </p>

        {/* New token display */}
        {newToken && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-green-700" />
              <p className="text-sm font-medium text-green-800">
                Your new API token (copy it now — it won&apos;t be shown again):
              </p>
            </div>
            <CopyField value={newToken} />
            <Button variant="outline" size="sm" onClick={() => setNewToken(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Generate new token */}
        <div className="flex items-center gap-2">
          <Input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name (optional)"
            className="max-w-[200px]"
          />
          <Button onClick={generateToken} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
            Generate New Token
          </Button>
        </div>

        {/* Token list */}
        {tokens.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border">
            {tokens.map((tk) => (
              <div key={tk.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{tk.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {tk.token_prefix}••••••••
                    {tk.last_used_at && ` · Last used ${new Date(tk.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revokeToken(tk.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── API Endpoint Information ─── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">API Endpoint Information</h2>
        </div>

        <CopyField label="API Base URL" value={apiBaseUrl} />
        <CopyField label="Your Verify UUID" value={user?.id || ''} />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Example: Send Message Endpoint</Label>
          <CopyField value={`${exampleSendUrl}?phone_number=+1234567890&message=Hello`} />
        </div>

        <CodeBlock
          title="Example: Send Message via cURL"
          code={`curl -X POST ${exampleSendUrl} \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "+1234567890",
    "message": "Hello from the API!"
  }'`}
        />

        <CodeBlock
          title="Example: Send Template via cURL"
          code={`curl -X POST ${exampleSendUrl} \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "+1234567890",
    "template_name": "order_confirmation",
    "template_language": "en_US",
    "template_variables": ["John", "ORD-12345"]
  }'`}
        />
      </section>

      {/* ─── API Documentation ─── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-foreground">API Documentation</h2>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Variables and Parameters</h3>
          <p className="text-xs text-muted-foreground">
            You can use the following dynamic variables for parameters including <code className="bg-muted px-1 rounded">phone_number</code>, <code className="bg-muted px-1 rounded">template_name</code>, <code className="bg-muted px-1 rounded">template_language</code> which will get replaced with contact&apos;s concerned field values.
          </p>
        </div>

        <CodeBlock
          title="Example Parameters"
          code={JSON.stringify({
            phone_number_id: "Phone number ID from which you would like to send message, if not provided default one will be used",
            phone_number: "Phone number with country code without prefixing + or 0",
            template_name: "your_template_name",
            template_language: "en_US",
            message: "Plain text message (use this OR template_name, not both)",
            header_content: "https://example.com/image.jpg",
            header_document: "https://example.com/document.pdf",
            header_document_name: "file_name",
            location_name: "Example Name",
            location_address: "Example address",
            location_latitude: "12.12",
            location_longitude: "72.72",
            fields: {
              "{{1}}": "{{full_name}}",
              "{{2}}": "{{phone_number}}",
              "{{3}}": "{{email}}",
            },
            buttons: {
              "{{0,1}}": "{{coupon_code}}",
              "button_0": "https://example.com",
              "button_1": "{{phone_number}}",
              "copy_code": "COUPON_CODE",
            },
          }, null, 2)}
        />

        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="size-4" />
          API Documentation - Meta WhatsApp Cloud API
        </a>
      </section>
    </div>
  );
}
