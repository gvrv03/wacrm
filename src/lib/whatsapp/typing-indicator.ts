/**
 * WhatsApp Typing Indicator + Read Receipt
 *
 * Sends a "read" status with typing_indicator to show the customer
 * that the bot is preparing a response. The indicator auto-dismisses
 * after 25 seconds or when a message is sent, whichever comes first.
 *
 * Usage: Call before any bot/flow reply to improve UX.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/typing-indicators
 */

const META_API_VERSION = 'v22.0';

export interface TypingIndicatorArgs {
  phoneNumberId: string;
  accessToken: string;
  messageId: string;
}

/**
 * Send a typing indicator (marks message as read + shows "typing..." to customer).
 * Fire-and-forget — failures are logged but don't block the response flow.
 */
export async function sendTypingIndicator({
  phoneNumberId,
  accessToken,
  messageId,
}: TypingIndicatorArgs): Promise<void> {
  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: {
          type: 'text',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[typing-indicator] Failed:', res.status, err);
    }
  } catch (err) {
    // Non-fatal — don't let typing indicator failures break the flow
    console.warn('[typing-indicator] Error:', err instanceof Error ? err.message : err);
  }
}
