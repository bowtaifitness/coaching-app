import { createClient } from '@supabase/supabase-js'
import { Capacitor } from './capacitor-shim';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Browser } from '@capacitor/browser';
import { getAuthStorage } from './secureStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const NATIVE_CALLBACK_URL = 'com.bowtaifitness.app://callback';

// Initialize @capgo/capacitor-social-login for Google/Facebook only (Apple uses its own plugin)
let socialLoginInitialized = false;

async function ensureSocialLoginInitialized() {
  if (socialLoginInitialized || !Capacitor.isNativePlatform()) return;

  const googleWebClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '';
  const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '';

  const config: Record<string, unknown> = {};
  if (googleWebClientId) {
    config.google = { webClientId: googleWebClientId };
  }
  if (facebookAppId) {
    config.facebook = { appId: facebookAppId };
  }

  if (Object.keys(config).length === 0) return;

  await SocialLogin.initialize(config as Parameters<typeof SocialLogin.initialize>[0]);
  socialLoginInitialized = true;
}

export function getRedirectUrl(path = '/'): string {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_CALLBACK_URL;
  }
  return `${window.location.origin}${path}`;
}

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Missing Supabase environment variables', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    env: import.meta.env.MODE
  });
}

console.log('Supabase configuration:', {
  url: supabaseUrl,
  anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'missing',
  env: import.meta.env.MODE
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-qzgduzlvaqbruekcttyi-auth-token',
    storage: getAuthStorage(),
  }
});

export const signUp = async (email: string, password: string, role: 'coach' | 'client', firstName: string, lastName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        first_name: firstName,
        last_name: lastName,
      },
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export type SocialProvider = 'google' | 'apple' | 'facebook';

async function openBrowserOAuth(provider: SocialProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: getRedirectUrl('/'),
    },
  });

  if (data?.url) {
    await Browser.open({ url: data.url, windowName: '_blank' });
  }

  return { data, error };
}

export const signInWithSocial = async (provider: SocialProvider) => {
  // Native Apple Sign-In
  if (provider === 'apple' && Capacitor.isNativePlatform()) {
    try {
      const result = await SignInWithApple.authorize({
        clientId: 'com.bowtaifitness.app',
        redirectURI: NATIVE_CALLBACK_URL,
        scopes: 'email name',
      });

      console.log('Apple Sign-In result:', {
        hasIdentityToken: !!result.response.identityToken,
        hasUser: !!result.response.user,
        email: result.response.email,
        hasNonce: !!result.response.nonce,
      });

      if (!result.response.identityToken) {
        console.warn('Apple Sign-In: No identity token, falling back to browser OAuth');
        return await openBrowserOAuth(provider);
      }

      const signInPayload: { provider: 'apple'; token: string; nonce?: string } = {
        provider: 'apple',
        token: result.response.identityToken,
      };
      if (result.response.nonce) {
        signInPayload.nonce = result.response.nonce;
      }

      const { data, error } = await supabase.auth.signInWithIdToken(signInPayload);

      if (error) {
        console.error('Supabase signInWithIdToken (apple) error:', error);
      } else {
        console.log('Apple Sign-In successful, user:', data?.user?.id);
      }

      return { data, error };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // User cancelled - re-throw so AuthForm can detect cancellation
      if (message.toLowerCase().includes('cancel') || message.includes('1001') || message.includes('user_cancelled')) {
        throw err;
      }
      // Native Apple Sign-In failed (capability not configured) - fall back to browser OAuth
      console.warn('Native Apple Sign-In unavailable, using browser OAuth:', message);
      return await openBrowserOAuth(provider);
    }
  }

  // Native Google Sign-In via @capgo/capacitor-social-login
  if (provider === 'google' && Capacitor.isNativePlatform()) {
    try {
      await ensureSocialLoginInitialized();

      const result = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['email', 'profile'] },
      });

      const googleResult = result.result as { idToken?: string; responseType?: string };
      if (!googleResult?.idToken) {
        return await openBrowserOAuth(provider);
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleResult.idToken,
      });

      return { data, error };
    } catch {
      return await openBrowserOAuth(provider);
    }
  }

  // Native Facebook Sign-In via @capgo/capacitor-social-login
  if (provider === 'facebook' && Capacitor.isNativePlatform()) {
    try {
      await ensureSocialLoginInitialized();

      const result = await SocialLogin.login({
        provider: 'facebook',
        options: { permissions: ['email', 'public_profile'] },
      });

      const fbResult = result.result as { accessToken?: { token?: string } };
      const accessToken = fbResult?.accessToken?.token;
      if (!accessToken) {
        return await openBrowserOAuth(provider);
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'facebook',
        token: accessToken,
      });

      return { data, error };
    } catch {
      return await openBrowserOAuth(provider);
    }
  }

  // Native fallback: open OAuth in system browser
  if (Capacitor.isNativePlatform()) {
    return await openBrowserOAuth(provider);
  }

  // Web OAuth flow
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectUrl('/'),
      queryParams: provider === 'google'
        ? { access_type: 'offline', prompt: 'consent' }
        : undefined,
    },
  });
  return { data, error };
};