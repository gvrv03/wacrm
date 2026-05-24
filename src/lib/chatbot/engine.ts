import { createClient } from '@supabase/supabase-js';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ChatbotReply {
  id: string;
  user_id: string;
  name: string;
  reply_type: 'text' | 'interactive_buttons' | 'interactive_list' | 'cta_url' | 'carousel';
  reply_text: string;
  header_type: string | null;
  header_content: string | null;
  footer_text: string | null;
  buttons: Array<{ text: string; id: string }> | null;
  list_sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> | null;
  list_button_text: string | null;
  cta_button_text: string | null;
  cta_button_url: string | null;
  carousel_cards: Array<CarouselCard> | null;
  trigger_type: 'welcome' | 'is' | 'starts_with' | 'ends_with' | 'contains_whole_word' | 'contains';
  trigger_value: string | null;
  case_sensitive: boolean;
  is_active: boolean;
  priority: number;
}

export interface CarouselCard {
  header_type: 'image' | 'video';
  header_url: string;
  body_text?: string;
  buttons: Array<CarouselCardButton>;
}

export interface CarouselCardButton {
  type: 'cta_url' | 'quick_reply';
  // For cta_url
  display_text?: string;
  url?: string;
  // For quick_reply
  id?: string;
  title?: string;
}

export interface ChatbotMatchResult {
  matched: boolean;
  reply?: ChatbotReply;
  /** The WhatsApp API payload to send */
  payload?: Record<string, unknown>;
}

/**
 * Find a matching chatbot reply for an incoming message.
 * Returns the highest-priority match with the WhatsApp API payload.
 */
export async function matchChatbotReply(
  userId: string,
  messageText: string,
  isFirstMessage: boolean
): Promise<ChatbotMatchResult> {
  const db = adminDb();

  const { data: replies, error } = await db
    .from('chatbot_replies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error || !replies || replies.length === 0) {
    return { matched: false };
  }

  for (const reply of replies as ChatbotReply[]) {
    if (matchesTrigger(reply, messageText, isFirstMessage)) {
      // Increment trigger count
      await db
        .from('chatbot_replies')
        .update({
          trigger_count: (reply as unknown as { trigger_count: number }).trigger_count + 1,
          last_triggered_at: new Date().toISOString(),
        })
        .eq('id', reply.id);

      return {
        matched: true,
        reply,
        payload: buildWhatsAppPayload(reply),
      };
    }
  }

  return { matched: false };
}

/**
 * Check if a message matches a reply's trigger condition.
 */
function matchesTrigger(reply: ChatbotReply, text: string, isFirstMessage: boolean): boolean {
  if (reply.trigger_type === 'welcome') {
    return isFirstMessage;
  }

  if (!reply.trigger_value) return false;

  const keywords = reply.trigger_value.split(',').map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) return false;

  const normalize = (s: string) => reply.case_sensitive ? s : s.toLowerCase();
  const normalizedText = normalize(text);

  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);

    switch (reply.trigger_type) {
      case 'is':
        return normalizedText === normalizedKeyword;

      case 'starts_with':
        return normalizedText.startsWith(normalizedKeyword);

      case 'ends_with':
        return normalizedText.endsWith(normalizedKeyword);

      case 'contains_whole_word': {
        const regex = new RegExp(
          `\\b${escapeRegex(normalizedKeyword)}\\b`,
          reply.case_sensitive ? '' : 'i'
        );
        return regex.test(text);
      }

      case 'contains':
        return normalizedText.includes(normalizedKeyword);

      default:
        return false;
    }
  });
}

/**
 * Build the WhatsApp Cloud API message payload based on reply type.
 */
export function buildWhatsAppPayload(reply: ChatbotReply): Record<string, unknown> {
  const base: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
  };

  switch (reply.reply_type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        text: { body: reply.reply_text },
      };

    case 'interactive_buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          ...(reply.header_type && reply.header_type !== 'none' && reply.header_content
            ? {
                header: reply.header_type === 'text'
                  ? { type: 'text', text: reply.header_content }
                  : { type: reply.header_type, [reply.header_type]: { link: reply.header_content } },
              }
            : {}),
          body: { text: reply.reply_text },
          ...(reply.footer_text ? { footer: { text: reply.footer_text } } : {}),
          action: {
            buttons: (reply.buttons || []).slice(0, 3).map((btn) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.text },
            })),
          },
        },
      };

    case 'interactive_list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          ...(reply.header_type === 'text' && reply.header_content
            ? { header: { type: 'text', text: reply.header_content } }
            : {}),
          body: { text: reply.reply_text },
          ...(reply.footer_text ? { footer: { text: reply.footer_text } } : {}),
          action: {
            button: reply.list_button_text || 'View Options',
            sections: (reply.list_sections || []).map((section) => ({
              title: section.title,
              rows: section.rows.map((row) => ({
                id: row.id,
                title: row.title,
                ...(row.description ? { description: row.description } : {}),
              })),
            })),
          },
        },
      };

    case 'cta_url':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: reply.reply_text },
          ...(reply.footer_text ? { footer: { text: reply.footer_text } } : {}),
          action: {
            name: 'cta_url',
            parameters: {
              display_text: reply.cta_button_text || 'Visit',
              url: reply.cta_button_url || '',
            },
          },
        },
      };

    case 'carousel':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'carousel',
          body: { text: reply.reply_text },
          action: {
            cards: (reply.carousel_cards || []).map((card, idx) => {
              const cardObj: Record<string, unknown> = {
                card_index: idx,
                header: {
                  type: card.header_type,
                  [card.header_type]: { link: card.header_url },
                },
              };
              if (card.body_text) {
                cardObj.body = { text: card.body_text };
              }
              // Build card action based on button types
              const ctaBtn = card.buttons.find((b) => b.type === 'cta_url');
              const quickBtns = card.buttons.filter((b) => b.type === 'quick_reply');
              if (ctaBtn) {
                cardObj.type = 'cta_url';
                cardObj.action = {
                  name: 'cta_url',
                  parameters: {
                    display_text: ctaBtn.display_text || 'Visit',
                    url: ctaBtn.url || '',
                  },
                };
              }
              if (quickBtns.length > 0) {
                if (!cardObj.action) cardObj.action = {};
                (cardObj.action as Record<string, unknown>).buttons = quickBtns.map((b) => ({
                  type: 'quick_reply',
                  quick_reply: { id: b.id || '', title: b.title || '' },
                }));
              }
              return cardObj;
            }),
          },
        },
      };

    default:
      return { ...base, type: 'text', text: { body: reply.reply_text } };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
