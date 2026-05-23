'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras: { setup: Record<string, unknown> };
        }
      ) => void;
    };
  }
}

export interface FacebookLoginResponse {
  authResponse?: {
    code: string;
    accessToken?: string;
    userID?: string;
  };
  status?: string;
}

/**
 * Loads the Facebook JavaScript SDK once. Place this component anywhere
 * in the tree that needs FB.login() — it's safe to render multiple
 * instances (the script tag is deduplicated by id).
 */
export function FacebookSDK() {
  useEffect(() => {
    // Define the async init callback before the script loads
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID!,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v22.0',
      });
    };

    // Only inject the script once
    if (document.getElementById('facebook-jssdk')) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
  }, []);

  return null;
}
