import React, { useState, useEffect } from 'react';
import { Lock, Calendar, CreditCard, X, Loader, RefreshCw, CheckCircle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { isNativeIOS as checkIsNativeIOS } from '../../lib/platform';
import { getAppleProducts, purchaseAppleProduct, validateAppleReceipt, restoreApplePurchases, isUserCancellation, APPLE_PRODUCT_IDS } from '../../lib/applePurchases';

interface SubscriptionRequiredModalProps {
  daysRemaining?: number;
  trialEndsAt?: string | null;
  onSubscribe: () => void;
  onClose?: () => void;
}

const isNativeIOS = checkIsNativeIOS();

const APPLE_FALLBACK_PRICING: Record<string, { price: string; interval: string }> = {
  [APPLE_PRODUCT_IDS.MONTHLY]: { price: '$19.99', interval: 'month' },
  [APPLE_PRODUCT_IDS.ANNUAL]: { price: '$119.99', interval: 'year' },
};

function getDisplayPrice(product: any): string {
  return product.priceString || product.localizedPrice || APPLE_FALLBACK_PRICING[product.identifier]?.price || '$19.99';
}

function getDisplayInterval(product: any): string {
  if (product.identifier === APPLE_PRODUCT_IDS.ANNUAL) return 'year';
  return 'month';
}

const SubscriptionRequiredModal: React.FC<SubscriptionRequiredModalProps> = ({
  daysRemaining = 0,
  trialEndsAt,
  onSubscribe,
  onClose,
}) => {
  const [appleProducts, setAppleProducts] = useState<any[]>([]);
  const [appleProductsLoading, setAppleProductsLoading] = useState(isNativeIOS);
  const [appleProductsError, setAppleProductsError] = useState<string | null>(null);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNativeIOS) {
      loadAppleProducts();
    }
  }, []);

  useEffect(() => {
    if (!appleProductsLoading) return;
    const safetyTimeout = setTimeout(() => {
      setAppleProductsLoading(false);
      if (appleProducts.length === 0 && !appleProductsError) {
        setAppleProductsError('Unable to load subscription options. Please check your connection or try again.');
      }
    }, 12000);
    return () => clearTimeout(safetyTimeout);
  }, [appleProductsLoading]);

  const loadAppleProducts = async () => {
    try {
      setAppleProductsLoading(true);
      setAppleProductsError(null);
      const products = await getAppleProducts();
      setAppleProducts(products);
      if (products.length > 0 && !selectedProductId) {
        const annual = products.find((p: any) => p.identifier === APPLE_PRODUCT_IDS.ANNUAL);
        setSelectedProductId(annual ? annual.identifier : products[0].identifier);
      }
    } catch (err: any) {
      console.error('Failed to load Apple products:', err);
      setAppleProductsError(err?.message || 'Unable to load subscription options. Please check your connection or try again.');
    } finally {
      setAppleProductsLoading(false);
    }
  };

  const handleApplePurchase = async (productIdentifier: string) => {
    try {
      setPurchasingProductId(productIdentifier);
      setError('');
      const transaction = await purchaseAppleProduct(productIdentifier);
      if (transaction) {
        const isValid = await validateAppleReceipt(transaction);
        if (isValid) {
          onClose?.();
          window.location.reload();
        } else {
          setError('Receipt validation failed. Please contact support.');
        }
      }
    } catch (err: any) {
      if (!isUserCancellation(err) && err?.code !== 'USER_CANCELLED') {
        setError(err?.message || 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasingProductId(null);
    }
  };

  const handleRestore = async () => {
    try {
      setError('');
      await restoreApplePurchases();
      onClose?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore purchases.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const selectedProduct = appleProducts.find((p: any) => p.identifier === selectedProductId);
  const selectedInterval = selectedProduct ? getDisplayInterval(selectedProduct) : 'month';
  const selectedPriceDisplay = selectedProduct ? getDisplayPrice(selectedProduct) : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full relative flex flex-col max-h-[95dvh] sm:max-h-[95vh]">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6 pb-4">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-4">
              <Lock className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
            Trial Period Ended
          </h2>

          <p className="text-center text-gray-600 mb-6">
            Your free trial has expired. Subscribe to continue accessing your personalized training programs and features.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Trial Ended</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(trialEndsAt)}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          {/* Plan Selection (iOS) */}
          {isNativeIOS ? (
            <div className="space-y-3">
              {appleProducts.length > 0 ? (
                [...appleProducts].sort((a, b) => (a.identifier === APPLE_PRODUCT_IDS.ANNUAL ? -1 : 1) - (b.identifier === APPLE_PRODUCT_IDS.ANNUAL ? -1 : 1)).map((product) => {
                  const isAnnual = product.identifier === APPLE_PRODUCT_IDS.ANNUAL;
                  const planName = isAnnual ? 'Bowtai Annual' : 'Bowtai Monthly';
                  const interval = getDisplayInterval(product);
                  const priceDisplay = getDisplayPrice(product);
                  const isSelected = selectedProductId === product.identifier;
                  return (
                    <button
                      key={product.identifier}
                      type="button"
                      onClick={() => setSelectedProductId(product.identifier)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-900">{planName}</span>
                          <span className="ml-2 text-gray-600">{priceDisplay}/{interval === 'year' ? 'yr' : 'mo'}</span>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                      </div>
                      {isAnnual && (
                        <span className="inline-block mt-1 text-xs font-semibold text-blue-700">Save over $39/year</span>
                      )}
                    </button>
                  );
                })
              ) : appleProductsError ? (
                <div className="text-center py-2">
                  <p className="text-sm text-red-600 mb-2">{appleProductsError}</p>
                  <button
                    onClick={loadAppleProducts}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : appleProductsLoading ? (
                <div className="flex flex-col items-center py-4 space-y-2">
                  <Loader className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">Loading plans...</span>
                  <button
                    type="button"
                    className="text-xs text-gray-400 underline"
                    onClick={() => {
                      setAppleProductsLoading(false);
                      setAppleProductsError('Unable to load subscription options. Please check your connection or try again.');
                    }}
                  >
                    Taking too long? Tap here
                  </button>
                </div>
              ) : (
                <button
                  onClick={loadAppleProducts}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Load Subscription Options</span>
                </button>
              )}

              <button
                onClick={handleRestore}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Restore Purchases</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onSubscribe}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <CreditCard className="h-5 w-5" />
              <span>View Membership Options</span>
            </button>
          )}
        </div>

        {/* Sticky Footer Lockup (iOS only) */}
        {isNativeIOS && appleProducts.length > 0 && selectedProductId && (
          <div className="border-t-2 border-gray-200 bg-gray-50 px-6 pt-4 pb-5 rounded-b-2xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 20px)' }}>
            {/* High-Contrast Billing Disclosure */}
            <p className="text-sm font-medium text-gray-900 text-center mb-3 leading-relaxed">
              Subscription auto-renews at {selectedPriceDisplay}/{selectedInterval === 'year' ? 'yr' : 'mo'}.
              Cancel anytime at least 24 hours before the current period ends.
            </p>

            {/* Purchase Button */}
            <button
              onClick={() => handleApplePurchase(selectedProductId)}
              disabled={purchasingProductId !== null}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-base bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchasingProductId === selectedProductId ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Subscribe Now — {selectedPriceDisplay}/{selectedInterval === 'year' ? 'yr' : 'mo'}</span>
              )}
            </button>

            {/* Legal Links */}
            <div className="flex items-center justify-center space-x-4 mt-3">
              <button
                type="button"
                onClick={() => Browser.open({ url: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' })}
                className="text-sm font-medium text-gray-600 underline underline-offset-2"
              >
                Terms of Use (EULA)
              </button>
              <span className="text-gray-400">|</span>
              <button
                type="button"
                onClick={() => { window.location.href = '/privacy-policy'; }}
                className="text-sm font-medium text-gray-600 underline underline-offset-2"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionRequiredModal;
