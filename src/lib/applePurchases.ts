import { NativePurchases } from '@capgo/native-purchases';
import type { Product, Transaction } from '@capgo/native-purchases';
import { PURCHASE_TYPE } from '@capgo/native-purchases';
import { supabase } from './supabase';

export const APPLE_PRODUCT_IDS = {
  MONTHLY: 'M2',
  ANNUAL: 'A2',
};

const STORE_TIMEOUT_MS = 10000;

type StoreStatus = 'idle' | 'initializing' | 'ready' | 'error';

let storeStatus: StoreStatus = 'idle';
let storeError: string | null = null;
let initPromise: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[IAP] ${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function initializeStore(): Promise<void> {
  if (initPromise) return initPromise;
  if (storeStatus === 'ready') return Promise.resolve();

  storeStatus = 'initializing';

  initPromise = (async () => {
    try {
      // Register listeners BEFORE any product/purchase calls
      await NativePurchases.addListener('transactionUpdated', (transaction: Transaction) => {
        console.info('[IAP] Transaction updated:', transaction.transactionIdentifier);
      });

      await NativePurchases.addListener('transactionVerificationFailed', (payload) => {
        console.warn('[IAP] Transaction verification failed:', payload);
      });

      storeStatus = 'ready';
      storeError = null;
    } catch (err: any) {
      storeStatus = 'error';
      storeError = err?.message || 'Store initialization failed';

      // Handle sandbox-specific errors gracefully
      if (isSandboxError(err)) {
        console.warn('[IAP] Sandbox environment detected, store may be limited:', err?.message);
      } else {
        console.error('[IAP] Store initialization error:', err);
      }
      throw err;
    }
  })();

  return initPromise;
}

function isSandboxError(err: any): boolean {
  const message = (err?.message || err?.localizedDescription || '').toLowerCase();
  return (
    message.includes('sandbox') ||
    message.includes('cannot connect to itunes store') ||
    message.includes('skerror') ||
    message.includes('storekit') ||
    message.includes('receipt is from the test environment') ||
    message.includes('no products available')
  );
}

export async function getAppleProducts(): Promise<Product[]> {
  try {
    await withTimeout(initializeStore(), STORE_TIMEOUT_MS, 'Store initialization');
  } catch (err: any) {
    console.warn('[IAP] Store init failed or timed out, attempting product fetch anyway:', err?.message);
  }

  try {
    const { products } = await withTimeout(
      NativePurchases.getProducts({
        productIdentifiers: [APPLE_PRODUCT_IDS.MONTHLY, APPLE_PRODUCT_IDS.ANNUAL],
        productType: PURCHASE_TYPE.SUBS,
      }),
      STORE_TIMEOUT_MS,
      'getProducts'
    );

    if (!products || products.length === 0) {
      storeError = 'Unable to load subscription options. Please check your connection or try again.';
      console.warn('[IAP] StoreKit returned empty products array');
      throw new Error(storeError);
    }

    return products;
  } catch (err: any) {
    storeError = err?.message || 'Failed to fetch products';

    if (isSandboxError(err)) {
      console.warn('[IAP] Sandbox/review environment: products unavailable');
    } else {
      console.error('[IAP] getProducts failed:', err);
    }

    throw new Error(storeError);
  }
}

export function isUserCancellation(err: any): boolean {
  const message = (err?.message || '').toLowerCase();
  return (
    message.includes('user cancelled') ||
    message.includes('user canceled') ||
    message.includes('payment not allowed') ||
    message.includes('transaction pending')
  );
}

export async function purchaseAppleProduct(productIdentifier: string): Promise<Transaction> {
  try {
    await withTimeout(initializeStore(), STORE_TIMEOUT_MS, 'Store initialization');
  } catch {
    // Proceed anyway -- purchase may still work
  }

  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier,
      productType: PURCHASE_TYPE.SUBS,
    });
    return transaction;
  } catch (err: any) {
    if (isUserCancellation(err)) {
      const cancelErr: any = new Error('Purchase cancelled by user');
      cancelErr.code = 'USER_CANCELLED';
      throw cancelErr;
    }
    throw err;
  }
}

export async function validateAppleReceipt(transaction: any): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const payload: Record<string, unknown> = {
    product_identifier: transaction.productIdentifier,
    transaction_id: transaction.transactionIdentifier || transaction.transactionId,
  };

  if (transaction.jwsRepresentation) {
    payload.jws_representation = transaction.jwsRepresentation;
  } else if (transaction.receipt) {
    payload.receipt_data = transaction.receipt;
  } else if (transaction.purchaseToken) {
    payload.purchase_token = transaction.purchaseToken;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apple-receipt-validate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Receipt validation failed');
  }

  const result = await response.json();
  return result.valid === true;
}

export async function restoreApplePurchases(): Promise<void> {
  try {
    await withTimeout(initializeStore(), STORE_TIMEOUT_MS, 'Store initialization');
  } catch {
    // Proceed anyway
  }

  await withTimeout(
    NativePurchases.restorePurchases(),
    STORE_TIMEOUT_MS,
    'restorePurchases'
  );
}

export function getStoreStatus(): { status: StoreStatus; error: string | null } {
  return { status: storeStatus, error: storeError };
}
