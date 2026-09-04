import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface TrialStatus {
  hasAccess: boolean;
  isTrialExpired: boolean;
  daysRemaining: number;
  trialEndsAt: string | null;
  hasCompletedIntake: boolean;
  needsPaywall: boolean;
}

export const useTrialStatus = (user: User | null) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    hasAccess: true,
    isTrialExpired: false,
    daysRemaining: 0,
    trialEndsAt: null,
    hasCompletedIntake: false,
    needsPaywall: false,
  });
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const checkTrialStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Only show loading spinner on the very first check
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }

    if (user.role === 'coach' || user.role === 'admin') {
      setTrialStatus({
        hasAccess: true,
        isTrialExpired: false,
        daysRemaining: 0,
        trialEndsAt: null,
        hasCompletedIntake: true,
        needsPaywall: false,
      });
      setLoading(false);
      return;
    }

    try {
      const [profileResult, intakeResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('trial_ends_at, trial_extended_until, is_trial_active, has_active_subscription, subscription_tier, apple_transaction_id')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('client_intake_forms')
          .select('id, gender, height, weight, fitness_experience, primary_fitness_goal, activity_frequency, biggest_strength, biggest_weakness, years_strength_training, training_goal, workout_frequency, age')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error('Error fetching trial status:', profileResult.error);
        setTrialStatus({
          hasAccess: true,
          isTrialExpired: false,
          daysRemaining: 0,
          trialEndsAt: null,
          hasCompletedIntake: false,
          needsPaywall: false,
        });
        setLoading(false);
        return;
      }

      const data = profileResult.data;
      const intakeData = intakeResult.data;

      // Determine if intake form is fully completed
      // Use explicit null/undefined checks for numeric fields that can be 0
      const hasCompletedIntake = !!(intakeData &&
        intakeData.age != null &&
        intakeData.gender &&
        intakeData.height &&
        intakeData.weight &&
        intakeData.fitness_experience != null &&
        intakeData.primary_fitness_goal &&
        intakeData.activity_frequency &&
        intakeData.biggest_strength &&
        intakeData.biggest_weakness &&
        intakeData.years_strength_training != null &&
        intakeData.training_goal &&
        intakeData.workout_frequency);

      if (!data) {
        setTrialStatus({
          hasAccess: false,
          isTrialExpired: false,
          daysRemaining: 0,
          trialEndsAt: null,
          hasCompletedIntake,
          needsPaywall: hasCompletedIntake,
        });
        setLoading(false);
        return;
      }

      const hasActiveSubscription = data.has_active_subscription || false;
      const hasApplePurchase = !!data.apple_transaction_id;

      // Hard paywall: access requires an active subscription OR a valid Apple purchase
      // The auto-granted trial_ends_at alone is NOT sufficient for access
      const hasActivatedPlan = hasActiveSubscription || hasApplePurchase;

      // Use trial_extended_until if set by admin, otherwise use trial_ends_at
      const effectiveTrialEnd = data.trial_extended_until || data.trial_ends_at;
      const now = new Date();
      const trialEndDate = effectiveTrialEnd ? new Date(effectiveTrialEnd) : null;

      let isTrialExpired = false;
      let hasAccess = false;

      if (hasActivatedPlan) {
        // User has explicitly activated a plan via StoreKit or has an active subscription
        if (hasActiveSubscription) {
          hasAccess = true;
          isTrialExpired = false;
        } else if (trialEndDate) {
          // Apple purchase activated a trial period
          isTrialExpired = now > trialEndDate;
          hasAccess = !isTrialExpired;
        } else {
          // Has apple_transaction_id but no trial end date -- grant access
          hasAccess = true;
          isTrialExpired = false;
        }
      } else {
        // No plan activated -- needs paywall (if intake is done)
        hasAccess = false;
        isTrialExpired = false;
      }

      const daysRemaining = trialEndDate && hasAccess
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      // needsPaywall: user completed intake but hasn't activated a plan
      const needsPaywall = hasCompletedIntake && !hasActivatedPlan;

      setTrialStatus({
        hasAccess,
        isTrialExpired,
        daysRemaining,
        trialEndsAt: effectiveTrialEnd || null,
        hasCompletedIntake,
        needsPaywall,
      });
    } catch (err) {
      console.error('Unexpected error checking trial status:', err);
      setTrialStatus({
        hasAccess: true,
        isTrialExpired: false,
        daysRemaining: 0,
        trialEndsAt: null,
        hasCompletedIntake: false,
        needsPaywall: false,
      });
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkTrialStatus();
  }, [checkTrialStatus]);

  return { ...trialStatus, loading, refreshTrialStatus: checkTrialStatus };
};
