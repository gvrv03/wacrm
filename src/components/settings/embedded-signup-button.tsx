'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FacebookLoginResponse } from '@/components/facebook-sdk';

/**
 * Data returned by the WA_EMBEDDED_SIGNUP message event when the
 * business customer successfully completes the flow.
 */
export interface EmbeddedSignupSessionData {
  phone_number_id: string;
  waba_id: string;
  business_id?: string;
}

interface EmbeddedSignupButtonProps {
  /** Called after the backend successfully exchanges the code and stores config */
  onSuccess: () => void;
}

/**
 * "Connect with Facebook" button that launches the WhatsApp Embedded
 * Signup flow (Meta's official onboarding for Tech Providers).
 *
 * Prerequisites:
 * - <FacebookSDK /> must be rendered somewhere in the tree so window.FB exists.
 * - NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_FB_CONFIG_ID env vars must be set.
 */
export function EmbeddedSignupButton({ onSuccess }: EmbeddedSignupButtonProps) {
  const [loading, setLoading] = useState(false);

  const launchWhatsAppSignup = useCallback(() => {
    if (!window.FB) {
      toast.error('Facebook SDK not loaded yet. Please wait a moment and try again.');
      return;
    }

    // FB.login requires HTTPS — show a clear message in dev
    if (window.location.protocol !== 'https:') {
      toast.error(
        'Facebook Embedded Signup requires HTTPS. Use a production deployment or configure HTTPS for local development.'
      );
      return;
    }

    setLoading(true);

    // Capture session data from the popup via postMessage
    let sessionData: EmbeddedSignupSessionData | null = null;

    const messageHandler = (event: MessageEvent) => {
      if (
        typeof event.origin !== 'string' ||
        !event.origin.endsWith('facebook.com')
      ) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'CANCEL') {
            // User abandoned the flow
            const step = data.data?.current_step;
            console.log('[EmbeddedSignup] User cancelled at step:', step);
            toast.info('Signup flow was cancelled.');
            setLoading(false);
            window.removeEventListener('message', messageHandler);
            return;
          }

          // Successful completion — capture asset IDs
          if (data.data?.phone_number_id && data.data?.waba_id) {
            sessionData = {
              phone_number_id: data.data.phone_number_id,
              waba_id: data.data.waba_id,
              business_id: data.data.business_id,
            };
          }
        }
      } catch {
        // Non-JSON messages from Facebook are expected — ignore
      }
    };

    window.addEventListener('message', messageHandler);

    // Launch the Embedded Signup popup
    window.FB.login(
      (response: FacebookLoginResponse) => {
        window.removeEventListener('message', messageHandler);

        if (response.authResponse?.code) {
          // Exchange the short-lived code for a token on the backend
          fetch('/api/whatsapp/embedded-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: response.authResponse.code,
              phone_number_id: sessionData?.phone_number_id || null,
              waba_id: sessionData?.waba_id || null,
            }),
          })
            .then((res) => res.json().then((result) => ({ ok: res.ok, result })))
            .then(({ ok, result }) => {
              if (!ok) {
                toast.error(result.error || 'Failed to complete signup');
              } else {
                toast.success(
                  result.phone_info?.verified_name
                    ? `Connected to ${result.phone_info.verified_name}`
                    : 'WhatsApp Business Account connected successfully!'
                );
                onSuccess();
              }
            })
            .catch((err) => {
              console.error('[EmbeddedSignup] Token exchange failed:', err);
              toast.error('Failed to exchange token. Please try again.');
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          // User closed the popup without completing
          toast.info('Signup flow was not completed.');
          setLoading(false);
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID!,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
        },
      }
    );
  }, [onSuccess]);

  return (
    <Button
      onClick={launchWhatsAppSignup}
      disabled={loading}
      className="gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-foreground font-semibold h-11 px-6"
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
          </svg>
          Login with Facebook
        </>
      )}
    </Button>
  );
}
