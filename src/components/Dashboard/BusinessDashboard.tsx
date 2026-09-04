import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  UserPlus,
  CreditCard,
  Target,
  Activity
} from 'lucide-react';

interface BusinessMetrics {
  totalUsers: number;
  newUsersThisMonth: number;
  swingAnalysesThisMonth: number;
  trialUsers: number;
  expiredTrialUsers: number;
  monthlyUsers: number;
  annualUsers: number;
  conversionRate: number;
  monthlyConversionRate: number;
  churnRate: number;
  averageTrialDaysRemaining: number;
}

const BusinessDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    totalUsers: 0,
    newUsersThisMonth: 0,
    swingAnalysesThisMonth: 0,
    trialUsers: 0,
    expiredTrialUsers: 0,
    monthlyUsers: 0,
    annualUsers: 0,
    conversionRate: 0,
    monthlyConversionRate: 0,
    churnRate: 0,
    averageTrialDaysRemaining: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentConversions, setRecentConversions] = useState<any[]>([]);
  const [expiringTrials, setExpiringTrials] = useState<any[]>([]);

  useEffect(() => {
    fetchBusinessMetrics();
  }, []);

  const fetchBusinessMetrics = async () => {
    try {
      setLoading(true);

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at, trial_ends_at, is_trial_active, has_active_subscription, subscription_tier, updated_at')
        .eq('role', 'client');

      if (error) throw error;

      if (!profiles) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const totalUsers = profiles.length;
      const newUsersThisMonth = profiles.filter(p => new Date(p.created_at) >= oneMonthAgo).length;

      // Fetch swing analyses this month
      const { count: swingAnalysesThisMonth } = await supabase
        .from('swing_diagnoses')
        .select('*', { count: 'exact', head: true })
        .gte('diagnosed_at', oneMonthAgo.toISOString());

      const trialUsers = profiles.filter(p => p.is_trial_active === true).length;

      const expiredTrialUsers = profiles.filter(p => {
        if (!p.trial_ends_at) return false;
        return new Date(p.trial_ends_at) < now && !p.has_active_subscription;
      }).length;

      const monthlyUsers = profiles.filter(p =>
        p.has_active_subscription === true && p.subscription_tier === 'monthly'
      ).length;

      const annualUsers = profiles.filter(p =>
        p.has_active_subscription === true && p.subscription_tier === 'annual'
      ).length;

      const subscribedUsers = monthlyUsers + annualUsers;
      const conversionRate = totalUsers > 0 ? (subscribedUsers / totalUsers) * 100 : 0;

      const monthlyNewUsers = profiles.filter(p => new Date(p.created_at) >= oneMonthAgo);
      const monthlyConverted = monthlyNewUsers.filter(p => p.has_active_subscription === true).length;
      const monthlyConversionRate = monthlyNewUsers.length > 0 ? (monthlyConverted / monthlyNewUsers.length) * 100 : 0;

      const trialEnded = profiles.filter(p => {
        if (!p.trial_ends_at) return false;
        return new Date(p.trial_ends_at) < now;
      });
      const churned = trialEnded.filter(p => !p.has_active_subscription).length;
      const churnRate = trialEnded.length > 0 ? (churned / trialEnded.length) * 100 : 0;

      const activeTrials = profiles.filter(p => p.is_trial_active === true && p.trial_ends_at);
      const avgDaysRemaining = activeTrials.length > 0
        ? activeTrials.reduce((sum, p) => {
            const daysLeft = Math.max(0, Math.ceil((new Date(p.trial_ends_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            return sum + daysLeft;
          }, 0) / activeTrials.length
        : 0;

      setMetrics({
        totalUsers,
        newUsersThisMonth,
        swingAnalysesThisMonth: swingAnalysesThisMonth || 0,
        trialUsers,
        expiredTrialUsers,
        monthlyUsers,
        annualUsers,
        conversionRate,
        monthlyConversionRate,
        churnRate,
        averageTrialDaysRemaining: avgDaysRemaining,
      });

      const recent = profiles
        .filter(p => p.has_active_subscription === true)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      setRecentConversions(recent);

      const expiring = profiles
        .filter(p => {
          if (!p.trial_ends_at || !p.is_trial_active) return false;
          const daysLeft = Math.ceil((new Date(p.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft >= 0 && daysLeft <= 3;
        })
        .sort((a, b) => new Date(a.trial_ends_at!).getTime() - new Date(b.trial_ends_at!).getTime())
        .slice(0, 5);
      setExpiringTrials(expiring);

    } catch (error) {
      console.error('Error fetching business metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-8 h-8" style={{ color }} />
        </div>
      </div>
    </div>
  );

  const getSubscriptionLabel = (tier: string | null) => {
    if (tier === 'annual') return 'Annual';
    return 'Monthly';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const paidUsers = metrics.monthlyUsers + metrics.annualUsers;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Analytics</h1>
        <p className="text-gray-600">Track user growth, trials, and subscription metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={metrics.totalUsers}
          icon={Users}
          color="#3B82F6"
          subtitle={`+${metrics.newUsersThisMonth} this month`}
        />
        <StatCard
          title="Active Trials"
          value={metrics.trialUsers}
          icon={Clock}
          color="#10B981"
          subtitle={`${metrics.averageTrialDaysRemaining.toFixed(1)} days avg remaining`}
        />
        <StatCard
          title="Paid Subscribers"
          value={paidUsers}
          icon={CreditCard}
          color="#3B82F6"
          subtitle={`${metrics.monthlyUsers} monthly / ${metrics.annualUsers} annual`}
        />
        <StatCard
          title="Conversion Rate"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          icon={Target}
          color="#F59E0B"
          subtitle={`${metrics.monthlyConversionRate.toFixed(1)}% this month`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Swing Analyses This Month"
          value={metrics.swingAnalysesThisMonth}
          icon={Activity}
          color="#06B6D4"
        />
        <StatCard
          title="New Users This Month"
          value={metrics.newUsersThisMonth}
          icon={UserPlus}
          color="#6366F1"
        />
        <StatCard
          title="Expired Trials"
          value={metrics.expiredTrialUsers}
          icon={Clock}
          color="#EF4444"
        />
        <StatCard
          title="Churn Rate"
          value={`${metrics.churnRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="#EC4899"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Recent Conversions</h2>
          </div>
          {recentConversions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent conversions</p>
          ) : (
            <div className="space-y-3">
              {recentConversions.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{user.email}</p>
                    <p className="text-sm text-gray-500">
                      {getSubscriptionLabel(user.subscription_tier)} Plan
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.subscription_tier === 'annual'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {getSubscriptionLabel(user.subscription_tier)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Clock className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Trials Expiring Soon</h2>
          </div>
          {expiringTrials.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No trials expiring in the next 3 days</p>
          ) : (
            <div className="space-y-3">
              {expiringTrials.map((user) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(user.trial_ends_at!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{user.email}</p>
                      <p className="text-sm text-gray-500">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      daysLeft === 0
                        ? 'bg-red-100 text-red-700'
                        : daysLeft === 1
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {daysLeft === 0 ? 'Expires Today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{metrics.totalUsers}</p>
            <p className="text-sm text-gray-600 mt-1">Total Users</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{metrics.trialUsers}</p>
            <p className="text-sm text-gray-600 mt-1">On Trial</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-sky-600">{metrics.monthlyUsers}</p>
            <p className="text-sm text-gray-600 mt-1">Monthly</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-600">{metrics.annualUsers}</p>
            <p className="text-sm text-gray-600 mt-1">Annual</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-500">{metrics.expiredTrialUsers}</p>
            <p className="text-sm text-gray-600 mt-1">Expired</p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">User Distribution</span>
            <span className="text-sm text-gray-500">
              {metrics.totalUsers > 0 ? ((metrics.trialUsers / metrics.totalUsers) * 100).toFixed(0) : 0}% trial |
              {' '}{metrics.totalUsers > 0 ? ((paidUsers / metrics.totalUsers) * 100).toFixed(0) : 0}% subscribed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
            <div
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${metrics.totalUsers > 0 ? (metrics.trialUsers / metrics.totalUsers) * 100 : 0}%` }}
            />
            <div
              className="bg-sky-500 h-full transition-all duration-500"
              style={{ width: `${metrics.totalUsers > 0 ? (metrics.monthlyUsers / metrics.totalUsers) * 100 : 0}%` }}
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${metrics.totalUsers > 0 ? (metrics.annualUsers / metrics.totalUsers) * 100 : 0}%` }}
            />
            <div
              className="bg-red-300 h-full transition-all duration-500"
              style={{ width: `${metrics.totalUsers > 0 ? (metrics.expiredTrialUsers / metrics.totalUsers) * 100 : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-1" />
              <span className="text-gray-600">Trial ({metrics.trialUsers})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-sky-500 rounded mr-1" />
              <span className="text-gray-600">Monthly ({metrics.monthlyUsers})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-emerald-500 rounded mr-1" />
              <span className="text-gray-600">Annual ({metrics.annualUsers})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-300 rounded mr-1" />
              <span className="text-gray-600">Expired ({metrics.expiredTrialUsers})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessDashboard;
