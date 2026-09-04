import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, CreditCard, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface TrialExpirationNotificationProps {
  onSubscribeClick: () => void;
}

const TrialExpirationNotification: React.FC<TrialExpirationNotificationProps> = ({ onSubscribeClick }) => {
  const { user } = useAuth();
  const [showNotification, setShowNotification] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'client') return;

    const checkTrialStatus = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_ends_at, subscription_tier')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !profile.trial_ends_at || profile.subscription_tier !== 'trial') {
        return;
      }

      const now = new Date();
      const trialEndsAt = new Date(profile.trial_ends_at);
      const timeDiff = trialEndsAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      setDaysRemaining(daysLeft);

      // Show notification if 7 days or less, or 1 day remaining
      if (daysLeft <= 7 && daysLeft > 0) {
        const dismissedKey = `trial_notification_dismissed_${daysLeft <= 1 ? '1day' : '7days'}`;
        const isDismissed = localStorage.getItem(dismissedKey) === 'true';

        if (!isDismissed) {
          setShowNotification(true);
        }
      }
    };

    checkTrialStatus();

    // Check every hour
    const interval = setInterval(checkTrialStatus, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowNotification(false);

    // Store dismissal in localStorage (expires on next day threshold)
    const dismissalKey = `trial_notification_dismissed_${daysRemaining && daysRemaining <= 1 ? '1day' : '7days'}`;
    localStorage.setItem(dismissalKey, 'true');
  };

  if (!showNotification || dismissed || daysRemaining === null) {
    return null;
  }

  const isUrgent = daysRemaining <= 1;
  const bgColor = isUrgent ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isUrgent ? 'border-red-300' : 'border-yellow-300';
  const textColor = isUrgent ? 'text-red-800' : 'text-yellow-800';
  const iconColor = isUrgent ? 'text-red-600' : 'text-yellow-600';
  const buttonBg = isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700';

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4 safe-top ${bgColor} border ${borderColor} rounded-lg shadow-lg animate-slide-down`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {isUrgent ? (
              <AlertCircle className={`h-6 w-6 ${iconColor}`} />
            ) : (
              <Clock className={`h-6 w-6 ${iconColor}`} />
            )}
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${textColor}`}>
              {isUrgent ? 'Your Trial Expires Soon!' : 'Trial Ending Soon'}
            </h3>
            <div className={`mt-2 text-sm ${textColor}`}>
              <p>
                {isUrgent ? (
                  <>Your trial ends in <span className="font-bold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>. Subscribe now to maintain access to all features.</>
                ) : (
                  <>You have <span className="font-bold">{daysRemaining} days</span> remaining in your trial. Subscribe anytime to continue enjoying full access.</>
                )}
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={onSubscribeClick}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${buttonBg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 transition-colors`}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Subscribe Now
              </button>
              <button
                onClick={handleDismiss}
                className={`inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${textColor} bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 transition-colors`}
              >
                Remind Me Later
              </button>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleDismiss}
              className={`inline-flex rounded-md ${textColor} hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50`}
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialExpirationNotification;
