import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { supabase } from '../../lib/supabase';
import { Browser } from '@capacitor/browser';
import { isNativeIOS as checkIsNativeIOS, shouldUseStripe } from '../../lib/platform';
import { getUserSubscription, getUserOrders, createCheckoutSession, createCustomerPortalSession, STRIPE_PRODUCTS } from '../../lib/stripe';
import { getAppleProducts, purchaseAppleProduct, validateAppleReceipt, restoreApplePurchases, isUserCancellation, APPLE_PRODUCT_IDS } from '../../lib/applePurchases';
import BusinessDashboard from '../Dashboard/BusinessDashboard';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Download,
  Eye,
  Star,
  Crown,
  Zap,
  Shield,
  Clock,
  Target,
  Award,
  BarChart3,
  User,
  Phone,
  Video,
  MessageCircle,
  Loader,
  RefreshCw
} from 'lucide-react';

const isNativeIOS = checkIsNativeIOS();

const APPLE_FALLBACK_PRICING: Record<string, { price: string; interval: string; trialDays: number }> = {
  [APPLE_PRODUCT_IDS.MONTHLY]: { price: '$19.99', interval: 'month', trialDays: 7 },
  [APPLE_PRODUCT_IDS.ANNUAL]: { price: '$119.99', interval: 'year', trialDays: 7 },
};

function getAppleProductDisplayPrice(product: any): string {
  return product.priceString || product.localizedPrice || APPLE_FALLBACK_PRICING[product.identifier]?.price || '$19.99';
}

function getAppleProductInterval(product: any): string {
  if (product.identifier === APPLE_PRODUCT_IDS.ANNUAL) return 'year';
  return 'month';
}

function getAppleProductTrialDays(product: any): number {
  if (product.freeTrialPeriod) {
    const parsed = parseInt(product.freeTrialPeriod, 10);
    if (parsed > 0) return parsed;
  }
  if (product.introductoryPrice?.periodNumberOfUnits) {
    return product.introductoryPrice.periodNumberOfUnits;
  }
  return APPLE_FALLBACK_PRICING[product.identifier]?.trialDays ?? 7;
}

function isTrialEligible(product: any, trialExpired: boolean): boolean {
  if (trialExpired) return false;
  if (product.introductoryPrice === null && product.freeTrialPeriod === null) {
    return true;
  }
  return true;
}

interface PaymentInterfaceProps {
  onPurchaseComplete?: () => void;
}

const PaymentInterface: React.FC<PaymentInterfaceProps> = ({ onPurchaseComplete }) => {
  const { user } = useAuth();
  const { isTrialExpired, daysRemaining } = useTrialStatus(user);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [stripeProducts, setStripeProducts] = useState<any[]>([]);
  const [stripeSubscriptions, setStripeSubscriptions] = useState<any[]>([]);
  const [stripePayments, setStripePayments] = useState<any[]>([]);
  const [stripeCustomers, setStripeCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [clientSubscription, setClientSubscription] = useState<any>(null);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'revenue' | 'metrics'>('revenue');
  const [appleProducts, setAppleProducts] = useState<any[]>([]);
  const [appleProductsLoading, setAppleProductsLoading] = useState(isNativeIOS);
  const [appleProductsError, setAppleProductsError] = useState<string | null>(null);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [selectedAppleProductId, setSelectedAppleProductId] = useState<string | null>(null);
  const [activeAppleSubscription, setActiveAppleSubscription] = useState<{
    productId: string;
    purchasedAt: string;
    expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (user?.role === 'coach' || user?.role === 'admin') {
      fetchCoachData();
    } else {
      fetchClientData();
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (isNativeIOS && user?.role === 'client') {
      fetchAppleProducts();
      checkActiveAppleSubscription();
    }
  }, [user?.id]);

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

  const fetchAppleProducts = async () => {
    try {
      setAppleProductsLoading(true);
      setAppleProductsError(null);
      const products = await getAppleProducts();
      setAppleProducts(products);
      if (products.length > 0 && !selectedAppleProductId) {
        const annual = products.find((p: any) => p.identifier === APPLE_PRODUCT_IDS.ANNUAL);
        setSelectedAppleProductId(annual ? annual.identifier : products[0].identifier);
      }
    } catch (err: any) {
      console.error('Failed to fetch Apple products:', err);
      setAppleProductsError(err?.message || 'Unable to load subscription options. Please check your connection or try again.');
    } finally {
      setAppleProductsLoading(false);
    }
  };

  const checkActiveAppleSubscription = async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('apple_product_id, apple_transaction_id, apple_subscription_expires_at, subscription_tier')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.apple_product_id && profile?.apple_transaction_id) {
        setActiveAppleSubscription({
          productId: profile.apple_product_id,
          purchasedAt: profile.apple_subscription_expires_at
            ? new Date(new Date(profile.apple_subscription_expires_at).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : new Date().toISOString(),
          expiresAt: profile.apple_subscription_expires_at || null,
        });
        setClientSubscription({ status: 'active', source: 'apple', productId: profile.apple_product_id });
      } else if (profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium') {
        setClientSubscription({ status: 'active', source: 'apple' });
      }
    } catch (err) {
      console.warn('[IAP] Failed to check active subscription:', err);
    }
  };

  const handleApplePurchase = async (productIdentifier: string) => {
    try {
      setPurchasingProductId(productIdentifier);
      setError('');
      const transaction = await purchaseAppleProduct(productIdentifier);
      if (transaction) {
        // Validate receipt with backend and activate subscription
        const isValid = await validateAppleReceipt(transaction);
        if (isValid) {
          const now = new Date();
          const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          setActiveAppleSubscription({
            productId: productIdentifier,
            purchasedAt: now.toISOString(),
            expiresAt: trialEnd.toISOString(),
          });
          setClientSubscription({ status: 'active', source: 'apple', productId: productIdentifier });
          onPurchaseComplete?.();
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

  const handleRestorePurchases = async () => {
    try {
      setError('');
      await restoreApplePurchases();
      await checkActiveAppleSubscription();
      onPurchaseComplete?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore purchases.');
    }
  };

  const fetchCoachData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Fetch real Stripe data
      const [
        productsResponse,
        subscriptionsResponse,
        paymentsResponse,
        customersResponse,
        revenueResponse
      ] = await Promise.allSettled([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=products`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=subscriptions`, {
          headers: {
            'Authorization': `Bearer ${(await import('../../lib/supabase').then(m => m.supabase.auth.getSession())).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=payments`, {
          headers: {
            'Authorization': `Bearer ${(await import('../../lib/supabase').then(m => m.supabase.auth.getSession())).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=customers`, {
          headers: {
            'Authorization': `Bearer ${(await import('../../lib/supabase').then(m => m.supabase.auth.getSession())).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=revenue`, {
          headers: {
            'Authorization': `Bearer ${(await import('../../lib/supabase').then(m => m.supabase.auth.getSession())).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      // Process responses
      const allowedProductIds = ['prod_UVStnMer1wbMNB', 'prod_UVSubHEWvnf8z3'];
      if (productsResponse.status === 'fulfilled' && productsResponse.value.ok) {
        const products = await productsResponse.value.json();
        const filteredProducts = (products.data || []).filter((product: any) => {
          return product.active && product.default_price && allowedProductIds.includes(product.id);
        });
        setStripeProducts(filteredProducts);
      }

      if (subscriptionsResponse.status === 'fulfilled' && subscriptionsResponse.value.ok) {
        const subscriptions = await subscriptionsResponse.value.json();
        setStripeSubscriptions(subscriptions.data || []);
      }

      if (paymentsResponse.status === 'fulfilled' && paymentsResponse.value.ok) {
        const payments = await paymentsResponse.value.json();
        setStripePayments(payments.data || []);
      }

      if (customersResponse.status === 'fulfilled' && customersResponse.value.ok) {
        const customers = await customersResponse.value.json();
        setStripeCustomers(customers.data || []);
      }

      if (revenueResponse.status === 'fulfilled' && revenueResponse.value.ok) {
        const revenue = await revenueResponse.value.json();
        setRevenueData(revenue);
      }

    } catch (error) {
      console.error('Error fetching coach payment data:', error);
      setError('Failed to load Stripe data. Please check your Stripe configuration.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientData = async () => {
    try {
      setLoading(true);
      setError('');

      // On iOS native, we use Apple IAP not Stripe -- skip Stripe calls entirely
      if (isNativeIOS) {
        setLoading(false);
        return;
      }

      // Get user's subscription data from Stripe via edge function
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Add a timeout to prevent hanging on network issues
      const fetchWithTimeout = (url: string, options: RequestInit) => {
        return Promise.race([
          fetch(url, options),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 10000)
          ),
        ]);
      };

      // Fetch real subscription data from Stripe
      const subscriptionResponse = await fetchWithTimeout(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=subscriptions`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        const activeSubscription = subscriptionData.data?.find((sub: any) => sub.status === 'active');
        setClientSubscription(activeSubscription);

        // Also set the legacy subscription format for compatibility
        if (activeSubscription) {
          setSubscription({
            price_id: activeSubscription.items?.data?.[0]?.price?.id,
            subscription_status: activeSubscription.status,
            current_period_end: activeSubscription.current_period_end,
            cancel_at_period_end: activeSubscription.cancel_at_period_end,
            payment_method_brand: activeSubscription.default_payment_method?.card?.brand,
            payment_method_last4: activeSubscription.default_payment_method?.card?.last4
          });
        }
      }

      // Fetch real payment data from Stripe
      const paymentsResponse = await fetchWithTimeout(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=payments`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setClientPayments(paymentsData.data || []);
      }

      // Fetch products for plan display
      const productsResponse = await fetchWithTimeout(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-data?action=products`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const allowedProductIds = ['prod_UVStnMer1wbMNB', 'prod_UVSubHEWvnf8z3'];
        const activeProducts = (productsData.data || []).filter((product: any) => {
          return product.active && product.default_price && allowedProductIds.includes(product.id);
        });
        setStripeProducts(activeProducts);
      }

      // Get user's order history from database
      const userOrders = await getUserOrders();
      setOrders(userOrders);

    } catch (error) {
      console.error('Error fetching client payment data:', error);
      setError('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      setError('');
      await createCheckoutSession(priceId);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      setError(error?.message || 'Error creating subscription. Please try again.');
    }
  };

  const handleManageBilling = async () => {
    try {
      await createCustomerPortalSession();
    } catch (error) {
      console.error('Error opening customer portal:', error);
      setError('Error opening billing portal. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Something went wrong</h3>
              <p className="text-red-700 mt-2">{error}</p>
              <button
                onClick={() => {
                  setError('');
                  if (user?.role === 'coach' || user?.role === 'admin') {
                    fetchCoachData();
                  } else {
                    fetchClientData();
                  }
                }}
                className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Coach/Admin view - Business dashboard
  if (user?.role === 'coach' || user?.role === 'admin') {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Dashboard</h1>
          <p className="text-gray-600">Monitor your coaching business revenue, subscriptions, and client metrics.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('revenue')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'revenue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Revenue & Payments
              </div>
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'metrics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                User Metrics & Trials
              </div>
            </button>
          </nav>
        </div>

        {activeTab === 'metrics' ? (
          <BusinessDashboard />
        ) : (
          <>
        {/* Revenue Tab Content */}

        {/* Revenue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${revenueData?.thisMonth?.toFixed(2) || '0.00'}
                </p>
                <p className={`text-xs mt-1 ${
                  (revenueData?.growth || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {(revenueData?.growth || 0) >= 0 ? '+' : ''}{(revenueData?.growth || 0).toFixed(1)}% vs last month
                </p>
              </div>
              <div className="bg-blue-500 rounded-lg p-3">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">{stripeSubscriptions.filter(s => s.status === 'active').length}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {stripeCustomers.length} total customers
                </p>
              </div>
              <div className="bg-blue-500 rounded-lg p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Annual Projection</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(stripeSubscriptions
                    .filter(s => s.status === 'active')
                    .reduce((sum, s) => {
                      const product = stripeProducts.find(p => p.default_price?.id === s.items?.data?.[0]?.price?.id);
                      return sum + ((product?.default_price?.unit_amount || 0) / 100);
                    }, 0)
                  ).toFixed(2)}
                </p>
                <p className="text-xs text-purple-600 mt-1">Monthly recurring revenue</p>
              </div>
              <div className="bg-purple-500 rounded-lg p-3">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">{stripePayments.length}</p>
                <p className="text-xs text-orange-600 mt-1">All time transactions</p>
              </div>
              <div className="bg-orange-500 rounded-lg p-3">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Client Subscriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Client Subscriptions</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stripeSubscriptions.filter(s => s.status === 'active').map((sub) => {
                  const customer = stripeCustomers.find(c => c.id === sub.customer);
                  const product = stripeProducts.find(p => p.default_price?.id === sub.items?.data?.[0]?.price?.id);
                  
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {customer?.email ? customer.email.substring(0, 2).toUpperCase() : 'CU'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer?.email || 'Unknown Customer'}</p>
                        <p className="text-sm text-gray-600">{product?.name || 'Unknown Plan'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        ${((sub.items?.data?.[0]?.price?.unit_amount || 0) / 100).toFixed(2)}/
                        {sub.items?.data?.[0]?.price?.recurring?.interval || 'mo'}
                      </p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        sub.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                        sub.status === 'past_due' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                  );
                })}
                {stripeSubscriptions.filter(s => s.status === 'active').length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No active subscriptions</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stripeProducts.map((product) => {
                  const subscriptionsForProduct = stripeSubscriptions.filter(sub => 
                    sub.items?.data?.[0]?.price?.id === product.default_price?.id && sub.status === 'active'
                  );
                  const clientCount = subscriptionsForProduct.length;
                  const monthlyRevenue = clientCount * ((product.default_price?.unit_amount || 0) / 100);
                  const totalActiveSubscriptions = stripeSubscriptions.filter(s => s.status === 'active').length;
                  const percentage = totalActiveSubscriptions > 0 ? (clientCount / totalActiveSubscriptions) * 100 : 0;
                  
                  return (
                    <div key={product.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{product.name || 'Unnamed Product'}</span>
                        <span className="text-gray-600">{clientCount} clients</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{percentage.toFixed(1)}% of clients</span>
                        <span className="font-medium text-gray-900">${monthlyRevenue.toFixed(2)}/mo</span>
                      </div>
                    </div>
                  );
                })}
                {stripeProducts.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No products found</p>
                    <p className="text-sm text-gray-400">Create products in your Stripe dashboard</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Stripe Dashboard
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stripePayments.slice(0, 10).map((payment) => {
                  const customer = stripeCustomers.find(c => c.id === payment.customer);
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {customer?.email ? customer.email.substring(0, 2).toUpperCase() : 'CU'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{customer?.email || 'Unknown Customer'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.description || 'Payment'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${((payment.amount || 0) / 100).toFixed(2)} {payment.currency?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.status === 'succeeded' ? 'bg-blue-100 text-blue-800' :
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(payment.created * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {stripePayments.length === 0 && (
              <div className="text-center py-8">
                <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No transactions found</p>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    );
  }

  // Client view - Subscription management and plan selection
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {clientSubscription ? 'Your Membership' : 'Choose Your Membership'}
        </h1>
        <p className="text-gray-600">
          {clientSubscription
            ? 'Your subscription is active. Enjoy full access to all training features.'
            : 'Select a plan to continue accessing your personalized training programs, swing analysis, and coaching features.'}
        </p>
      </div>

      {/* Current Subscription Status */}
      {clientSubscription ? (
        isNativeIOS && activeAppleSubscription ? (
          /* Detailed iOS Active Subscription Card */
          (() => {
            const isAnnual = activeAppleSubscription.productId === APPLE_PRODUCT_IDS.ANNUAL;
            const activePlanName = isAnnual ? 'Bowtai Annual Plan' : 'Bowtai Monthly Plan';
            const fallback = APPLE_FALLBACK_PRICING[activeAppleSubscription.productId];
            const priceLabel = fallback ? `${fallback.price}/${fallback.interval === 'year' ? 'yr' : 'mo'}` : '';
            const expiresAt = activeAppleSubscription.expiresAt ? new Date(activeAppleSubscription.expiresAt) : null;
            const now = new Date();
            const trialDaysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
            const isInTrial = trialDaysLeft > 0 && trialDaysLeft <= 7;

            return (
              <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6 mb-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                      isAnnual ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'
                    }`}>
                      {isAnnual ? <Star className="h-7 w-7 text-white" /> : <Zap className="h-7 w-7 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{activePlanName}</h3>
                      {priceLabel && <p className="text-sm text-gray-500">{priceLabel}</p>}
                    </div>
                  </div>
                  {isInTrial ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Active Free Trial
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </span>
                  )}
                </div>

                {isInTrial && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">Free Trial Status</span>
                    </div>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      You have <span className="font-bold">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span> remaining in your 7-day free trial before paid billing begins.
                    </p>
                    <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 rounded-full h-2 transition-all"
                        style={{ width: `${((7 - trialDaysLeft) / 7) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-blue-600">Started</span>
                      <span className="text-xs text-blue-600">Day 7</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Shield className="h-4 w-4" />
                  <span>Managed via App Store. Cancel or change plans in your Apple ID settings.</span>
                </div>
              </div>
            );
          })()
        ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 rounded-lg p-3">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Active Subscription</h3>
                {isNativeIOS ? (
                  <p className="text-gray-600">Managed via App Store</p>
                ) : (
                  <p className="text-gray-600">
                    {stripeProducts.find(p => p.default_price?.id === clientSubscription.items?.data?.[0]?.price?.id)?.name || 'Coaching Plan'} -
                    ${((clientSubscription.items?.data?.[0]?.price?.unit_amount || 0) / 100).toFixed(2)}/
                    {clientSubscription.items?.data?.[0]?.price?.recurring?.interval || 'month'}
                  </p>
                )}
              </div>
            </div>
            {!isNativeIOS && (
              <button
                onClick={handleManageBilling}
                className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Billing
              </button>
            )}
          </div>
        </div>
        )
      ) : isTrialExpired ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-amber-500 rounded-lg p-3">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900">Your Free Trial Has Ended</h3>
              <p className="text-amber-700">Subscribe to a monthly or annual membership to continue using Bowtai Fitness</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-500 rounded-lg p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Free Trial Active</h3>
              <p className="text-blue-700">You have {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining on your free trial. Subscribe anytime to keep your access.</p>
            </div>
          </div>
        </div>
      )}


      {/* Coaching Plans - Platform Conditional */}
      {isNativeIOS ? (
        /* iOS Native In-App Purchase Flow - Only show when not subscribed */
        activeAppleSubscription ? null : (
        <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 280px)' }}>
          {/* Scrollable Plan Cards Area */}
          <div className="flex-1 space-y-6" style={{ paddingBottom: 'calc(280px + env(safe-area-inset-bottom, 16px))' }}>
            {appleProducts.length > 0 ? (
              <div className={`grid grid-cols-1 ${appleProducts.length >= 2 ? 'md:grid-cols-2' : ''} gap-6`}>
                {[...appleProducts].sort((a, b) => (a.identifier === APPLE_PRODUCT_IDS.ANNUAL ? -1 : 1) - (b.identifier === APPLE_PRODUCT_IDS.ANNUAL ? -1 : 1)).map((product) => {
                  const isAnnual = product.identifier === APPLE_PRODUCT_IDS.ANNUAL;
                  const planName = isAnnual ? 'Bowtai Annual Plan' : 'Bowtai Monthly Plan';
                  const interval = getAppleProductInterval(product);
                  const priceDisplay = getAppleProductDisplayPrice(product);
                  const trialDays = getAppleProductTrialDays(product);
                  const showTrial = isTrialEligible(product, isTrialExpired);
                  const isSelected = selectedAppleProductId === product.identifier;
                  return (
                    <button
                      key={product.identifier}
                      type="button"
                      onClick={() => setSelectedAppleProductId(product.identifier)}
                      className={`relative bg-white rounded-xl shadow-sm border-2 transition-all text-left w-full ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      {isAnnual && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                            Best Value
                          </span>
                        </div>
                      )}
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                              isAnnual ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
                              'bg-gradient-to-br from-blue-500 to-blue-700'
                            }`}>
                              {isAnnual ? <Star className="h-6 w-6 text-white" /> :
                               <Zap className="h-6 w-6 text-white" />}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{planName}</h3>
                              <div className="flex items-baseline">
                                <span className="text-2xl font-bold text-gray-900">{priceDisplay}</span>
                                <span className="text-gray-600 ml-1">/{interval}</span>
                              </div>
                              {showTrial && (
                                <p className="text-sm font-semibold text-blue-700 mt-1">
                                  {trialDays} Days Free, then {priceDisplay}/{interval === 'year' ? 'yr' : 'mo'}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                          </div>
                        </div>

                        <ul className="space-y-2 mb-4">
                          {[
                            'Personalized workout programs',
                            'Performance tracking & analytics',
                            'Full exercise library access',
                            'Video swing analysis',
                            'Mobile app access',
                            'Coach messaging'
                          ].map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start space-x-2">
                              <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isAnnual && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                            <span className="text-blue-700 text-sm font-semibold">Save over $39/year vs monthly</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : appleProductsError ? (
              <div className="bg-white rounded-xl shadow-sm border border-red-100 p-12">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Plans</h3>
                  <p className="text-gray-600 mb-4">{appleProductsError}</p>
                  <button
                    onClick={fetchAppleProducts}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            ) : appleProductsLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Loader className="h-8 w-8 text-gray-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Subscription Options...</h3>
                  <p className="text-gray-600 mb-4">Fetching available plans from the App Store.</p>
                  <button
                    onClick={() => {
                      setAppleProductsLoading(false);
                      setAppleProductsError('Unable to load subscription options. Please check your connection or try again.');
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Taking too long? Tap here.
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Plans Available</h3>
                  <p className="text-gray-600 mb-4">Subscription plans could not be loaded. Please check your connection and try again.</p>
                  <button
                    onClick={fetchAppleProducts}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleRestorePurchases}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Restore Purchases</span>
            </button>
          </div>

          {/* Sticky Footer Lockup - Purchase Button + Billing Disclosure */}
          {appleProducts.length > 0 && selectedAppleProductId && (() => {
            const selectedProduct = appleProducts.find((p: any) => p.identifier === selectedAppleProductId);
            if (!selectedProduct) return null;
            const interval = getAppleProductInterval(selectedProduct);
            const priceDisplay = getAppleProductDisplayPrice(selectedProduct);
            const trialDays = getAppleProductTrialDays(selectedProduct);
            const showTrial = isTrialEligible(selectedProduct, isTrialExpired);

            return (
              <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-50 border-t-2 border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
                <div className="px-5 pt-5 pb-4 max-w-lg mx-auto">
                  {/* Billing Disclosure - High Contrast */}
                  {showTrial ? (
                    <p className="text-sm font-medium text-gray-900 text-center mb-4 leading-relaxed">
                      {trialDays}-Day Free Trial, then auto-renews at {priceDisplay}/{interval === 'year' ? 'yr' : 'mo'}.
                      Cancel anytime at least 24 hours before the trial ends.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 text-center mb-4 leading-relaxed">
                      Subscription auto-renews at {priceDisplay}/{interval === 'year' ? 'yr' : 'mo'}.
                      Cancel anytime at least 24 hours before the current period ends.
                    </p>
                  )}

                  {/* Purchase Button */}
                  <button
                    onClick={() => handleApplePurchase(selectedAppleProductId)}
                    disabled={purchasingProductId !== null}
                    className="w-full py-4 px-6 rounded-xl font-bold text-base bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasingProductId === selectedAppleProductId ? (
                      <>
                        <Loader className="h-5 w-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>
                        {showTrial
                          ? `Start ${trialDays}-Day Free Trial`
                          : `Subscribe Now — ${priceDisplay}/${interval === 'year' ? 'yr' : 'mo'}`
                        }
                      </span>
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

                  {/* Apple subscription management note */}
                  <p className="text-xs text-gray-500 text-center mt-3 leading-relaxed">
                    Payment will be charged to your Apple ID account at confirmation. Manage or cancel subscriptions in your App Store account settings.
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
        )
      ) : (
        /* Web/PWA Stripe Checkout Flow */
        (() => {
        const visibleProducts = stripeProducts;
        return visibleProducts.length > 0 ? (
        <div className={`grid grid-cols-1 ${visibleProducts.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 mb-8`}>
          {visibleProducts.map((product: any) => {
            const price = product.default_price;
            const isAnnual = price?.recurring?.interval === 'year';
            const isPopular = isAnnual;
            const priceAmount = price ? (price.unit_amount / 100) : 0;
            const interval = price?.recurring?.interval || 'month';

            return (
              <div
                key={product.id}
                className={`relative bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-lg ${
                  isAnnual ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Best Value
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
                      isAnnual ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
                      'bg-gradient-to-br from-blue-500 to-blue-700'
                    }`}>
                      {isAnnual ? <Star className="h-8 w-8 text-white" /> :
                       <Zap className="h-8 w-8 text-white" />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">${priceAmount}</span>
                      <span className="text-gray-600 ml-2">/{interval}</span>
                    </div>
                  </div>

                  {product.description && (
                    <div className="mb-6">
                      <p className="text-gray-600 text-sm text-center">{product.description}</p>
                    </div>
                  )}

                  <div className="mb-6">
                    {product.metadata?.features ? (
                      <ul className="space-y-3">
                        {product.metadata.features.split(',').map((feature: string, featureIndex: number) => (
                          <li key={featureIndex} className="flex items-start space-x-3">
                            <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700 text-sm">{feature.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <ul className="space-y-3">
                          {[
                            'Personalized workout programs',
                            'Performance tracking & analytics',
                            'Full exercise library access',
                            'Video swing analysis',
                            'Mobile app access',
                            'Coach messaging'
                          ].map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start space-x-3">
                              <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isAnnual && (
                          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                            <span className="text-blue-700 text-sm font-semibold">Save over $39/year vs monthly</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handleSubscribe(price.id)}
                    disabled={clientSubscription?.items?.data?.[0]?.price?.id === price.id}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      clientSubscription?.items?.data?.[0]?.price?.id === price.id
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : isAnnual
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {clientSubscription?.items?.data?.[0]?.price?.id === price.id ? 'Current Plan' : 'Get Started'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 mb-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Coaching Plans Available</h3>
            <p className="text-gray-600 mb-6">
              No active products found in your Stripe account. Please contact your administrator to set up coaching packages.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>For Admins:</strong> Create products with recurring prices in your Stripe Dashboard to display coaching packages here.
              </p>
            </div>
          </div>
        </div>
      );
        })()
      )}

      {/* Current Subscription Details - Stripe only */}
      {!isNativeIOS && clientSubscription && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Plan</span>
                <span className="font-medium text-gray-900">
                  {stripeProducts.find(p => p.default_price?.id === clientSubscription.items?.data?.[0]?.price?.id)?.name || 'Unknown Plan'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  clientSubscription.status === 'active' ? 'bg-blue-100 text-blue-800' :
                  clientSubscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                  clientSubscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {clientSubscription.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Next Billing</span>
                <span className="font-medium text-gray-900">
                  {clientSubscription.current_period_end 
                    ? new Date(clientSubscription.current_period_end * 1000).toLocaleDateString()
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium text-gray-900">
                  ${((clientSubscription.items?.data?.[0]?.price?.unit_amount || 0) / 100).toFixed(2)}/
                  {clientSubscription.items?.data?.[0]?.price?.recurring?.interval || 'month'}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium text-gray-900">
                  {clientSubscription.default_payment_method?.card?.brand && clientSubscription.default_payment_method?.card?.last4
                    ? `${clientSubscription.default_payment_method.card.brand.toUpperCase()} •••• ${clientSubscription.default_payment_method.card.last4}`
                    : 'Not available'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Auto-renewal</span>
                <span className={`font-medium ${
                  clientSubscription.cancel_at_period_end ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {clientSubscription.cancel_at_period_end ? 'Disabled' : 'Enabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Started</span>
                <span className="font-medium text-gray-900">
                  {clientSubscription.created 
                    ? new Date(clientSubscription.created * 1000).toLocaleDateString()
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History for Clients - Stripe only */}
      {!isNativeIOS && clientPayments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clientPayments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{payment.id.substring(payment.id.length - 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.description || 'Subscription Payment'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${((payment.amount || 0) / 100).toFixed(2)} {payment.currency?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.status === 'succeeded' ? 'bg-blue-100 text-blue-800' :
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(payment.created * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* Business Insights for Coaches */}
      {(user?.role === 'coach' || user?.role === 'admin') && revenueData && revenueData.thisMonth > 0 && (
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">Revenue Growth</span>
              </div>
              <p className="text-sm text-gray-700">
                Your monthly revenue has grown by {revenueData.growth.toFixed(1)}% compared to last month. 
                Keep up the excellent work!
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">Active Subscriptions</span>
              </div>
              <p className="text-sm text-gray-700">
                You have {stripeSubscriptions.filter(s => s.status === 'active').length} active subscriptions out of {stripeCustomers.length} total customers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentInterface;