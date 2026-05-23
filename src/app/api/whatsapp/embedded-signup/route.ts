import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { encrypt } from '@/lib/whatsapp/encryption';

/**
 * POST /api/whatsapp/embedded-signup
 *
 * Receives the short-lived exchangeable code from the Facebook Embedded
 * Signup flow, exchanges it for a long-lived business token via the
 * Graph API, verifies the phone number with Meta, encrypts the token,
 * and stores the config in the database.
 *
 * Request body:
 *   { code: string, phone_number_id?: string, waba_id?: string }
 *
 * The phone_number_id and waba_id come from the WA_EMBEDDED_SIGNUP
 * message event in the browser. If not provided, we extract them from
 * the token debug endpoint after exchange.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, phone_number_id, waba_id } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Exchangeable code is required' },
        { status: 400 }
      );
    }

    // ─── Step 1: Exchange the short-lived code for a user access token ───
    const tokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[embedded-signup] Token exchange failed:', tokenData.error);
      return NextResponse.json(
        {
          error: `Token exchange failed: ${tokenData.error.message || 'Unknown error'}`,
        },
        { status: 400 }
      );
    }

    const accessToken: string = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token returned from Meta' },
        { status: 400 }
      );
    }

    // ─── Step 2: Debug the token to get WABA info if not provided ───
    let resolvedPhoneNumberId = phone_number_id;
    let resolvedWabaId = waba_id;

    if (!resolvedPhoneNumberId || !resolvedWabaId) {
      try {
        const debugUrl = new URL('https://graph.facebook.com/v22.0/debug_token');
        debugUrl.searchParams.set('input_token', accessToken);
        debugUrl.searchParams.set(
          'access_token',
          `${process.env.NEXT_PUBLIC_META_APP_ID}|${process.env.META_APP_SECRET}`
        );

        const debugRes = await fetch(debugUrl.toString());
        const debugData = await debugRes.json();

        if (debugData.data?.granular_scopes) {
          for (const scope of debugData.data.granular_scopes) {
            if (
              scope.permission === 'whatsapp_business_management' &&
              scope.target_ids?.length
            ) {
              resolvedWabaId = resolvedWabaId || scope.target_ids[0];
            }
            if (
              scope.permission === 'whatsapp_business_messaging' &&
              scope.target_ids?.length
            ) {
              resolvedPhoneNumberId =
                resolvedPhoneNumberId || scope.target_ids[0];
            }
          }
        }
      } catch (err) {
        console.error('[embedded-signup] Token debug failed:', err);
        // Non-fatal — we may still have the IDs from the message event
      }
    }

    if (!resolvedPhoneNumberId) {
      return NextResponse.json(
        {
          error:
            'Could not determine Phone Number ID. The signup flow may not have completed fully.',
        },
        { status: 400 }
      );
    }

    // ─── Step 3: Verify the phone number with Meta ───
    let phoneInfo;
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: resolvedPhoneNumberId,
        accessToken,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('[embedded-signup] Phone verification failed:', message);
      return NextResponse.json(
        { error: `Meta API verification failed: ${message}` },
        { status: 400 }
      );
    }

    // ─── Step 4: Encrypt and store ───
    let encryptedToken: string;
    try {
      encryptedToken = encrypt(accessToken);
    } catch (err) {
      console.error('[embedded-signup] Encryption failed:', err);
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is configured correctly.',
        },
        { status: 500 }
      );
    }

    // Upsert — overwrite any existing config for this user
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const configPayload = {
      phone_number_id: resolvedPhoneNumberId,
      waba_id: resolvedWabaId || null,
      access_token: encryptedToken,
      verify_token: null,
      status: 'connected' as const,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update(configPayload)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[embedded-signup] DB update failed:', updateError);
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({ user_id: user.id, ...configPayload });

      if (insertError) {
        console.error('[embedded-signup] DB insert failed:', insertError);
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        );
      }
    }

    // ─── Step 5: Subscribe to the WABA (Tech Provider requirement) ───
    if (resolvedWabaId) {
      try {
        const subscribeRes = await fetch(
          `https://graph.facebook.com/v22.0/${resolvedWabaId}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const subscribeData = await subscribeRes.json();
        if (!subscribeData.success) {
          console.warn(
            '[embedded-signup] WABA subscription warning:',
            subscribeData
          );
        }
      } catch (err) {
        // Non-fatal — log but don't fail the whole flow
        console.warn('[embedded-signup] WABA subscription failed:', err);
      }
    }

    // ─── Step 6: Register the phone number ───
    try {
      const registerRes = await fetch(
        `https://graph.facebook.com/v22.0/${resolvedPhoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '000000', // Default 2FA pin — customer can change later
          }),
        }
      );
      const registerData = await registerRes.json();
      if (registerData.error) {
        // Phone may already be registered — non-fatal
        console.warn(
          '[embedded-signup] Phone registration note:',
          registerData.error.message
        );
      }
    } catch (err) {
      console.warn('[embedded-signup] Phone registration failed:', err);
    }

    return NextResponse.json({ success: true, phone_info: phoneInfo });
  } catch (error) {
    console.error('[embedded-signup] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
