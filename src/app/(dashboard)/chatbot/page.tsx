'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface BotReply {
  id: string;
  name: string;
  reply_type: string;
  trigger_type: string;
  trigger_value: string | null;
  is_active: boolean;
  trigger_count: number;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  interactive_buttons: 'Interactive Buttons',
  interactive_list: 'List Message',
  cta_url: 'CTA URL',
};

export default function ChatbotPage() {
  const router = useRouter();
  const [replies, setReplies] = useState<BotReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/chatbot');
      const data = await res.json();
      setReplies(data.replies || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  async function handleToggle(reply: BotReply) {
    await fetch(`/api/chatbot/${reply.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !reply.is_active }),
    });
    setReplies((r) => r.map((x) => x.id === reply.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bot reply?')) return;
    await fetch(`/api/chatbot/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    setReplies((r) => r.filter((x) => x.id !== id));
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bot Replies</h1>
          <p className="text-sm text-muted-foreground mt-1">Auto-reply with interactive WhatsApp messages.</p>
        </div>
        <Button onClick={() => router.push('/chatbot/new')}><Plus className="size-4 mr-1.5" />Add Bot Reply</Button>
      </div>

      {replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 bg-card">
          <Bot className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-base font-medium text-foreground">No bot replies yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create auto-replies triggered by keywords.</p>
          <Button onClick={() => router.push('/chatbot/new')} variant="outline"><Plus className="size-4 mr-1.5" />Create First Reply</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase">Trigger</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase">Subject</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {replies.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-5 py-4 font-medium text-foreground">{r.name}</td>
                  <td className="px-5 py-4"><Badge variant="secondary" className="text-xs">{TYPE_LABELS[r.reply_type] || r.reply_type}</Badge></td>
                  <td className="px-5 py-4 text-muted-foreground capitalize text-xs">{r.trigger_type.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-4 text-muted-foreground font-mono text-xs truncate max-w-[150px]">{r.trigger_value || '—'}</td>
                  <td className="px-5 py-4 text-center"><Switch checked={r.is_active} onCheckedChange={() => handleToggle(r)} /></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => router.push(`/chatbot/new?edit=${r.id}`)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                      <button type="button" onClick={() => handleDelete(r.id)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
