import { loadStripe } from '@stripe/stripe-js';
import { Browser } from '@capacitor/browser';
import { Capacitor } from './capacitor-shim';
import { supabase } from './supabase';
import { STRIPE_PRODUCTS } from '../../stripe-config';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.warn('Stripe publishable key not found. Please add VITE_STRIPE_PUBLISHABLE_KEY to your environment variables.');
}

export const stripe = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

// Export products from config
export { STRIPE_PRODUCTS };

// Get user's subscription data
export const getUserSubscription = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('stripe_user_subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
};

// Get user's order history
export const getUserOrders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('stripe_user_orders')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  return data || [];
};

// Create checkout session
export const createCheckoutSession = async (priceId: string, mode: 'payment' | 'subscription' = 'subscription') => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const successUrl = isNativeIOS
    ? 'com.bowtaifitness.app://payment-success?session_id={CHECKOUT_SESSION_ID}'
    : `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = isNativeIOS
    ? 'com.bowtaifitness.app://payments'
    : `${window.location.origin}/payments`;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_id: priceId,
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const { url } = await response.json();

  if (isNativeIOS) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
};

export const createCustomerPortalSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const returnUrl = isNativeIOS
    ? 'com.bowtaifitness.app://payments'
    : `${window.location.origin}/payments`;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      returnUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create portal session');
  }

  const { url } = await response.json();

  if (isNativeIOS) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
};

export const createSetupCheckoutSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-setup-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success_url: `${window.location.origin}/setup-complete`,
      cancel_url: `${window.location.origin}/auth`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create setup session');
  }

  const { url } = await response.json();
  return url;
};