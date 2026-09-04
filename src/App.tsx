import React, { useState, useEffect } from 'react';
import { Capacitor } from './lib/capacitor-shim';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkoutProvider } from './contexts/WorkoutContext';
import { FloatingVideoProvider } from './contexts/FloatingVideoContext';
import { TutorialProvider, useTutorial } from './contexts/TutorialContext';
import FloatingVideoPlayer from './components/Workout/FloatingVideoPlayer';
import OnboardingTutorialModal from './components/Onboarding/OnboardingTutorialModal';
import { supabase } from './lib/supabase';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useKeyboardAware } from './hooks/useKeyboardAware';
import { WifiOff } from 'lucide-react';
import AuthForm from './components/Auth/AuthForm';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import BottomTabBar from './components/Layout/BottomTabBar';
import CoachDashboard from './components/Dashboard/CoachDashboard';
import ClientDashboard from './components/Dashboard/ClientDashboard';
import ClientIntakeModal from './components/Client/ClientIntakeModal';
import ExerciseLibrary from './components/Exercise/ExerciseLibrary';
import PerformanceTracker from './components/Performance/PerformanceTracker';
import WorkoutBuilder from './components/Workout/WorkoutBuilder';
import ClientManagement from './components/Client/ClientManagement';
import CalendarView from './components/Calendar/CalendarView';
import PaymentInterface from './components/Payments/PaymentInterface';
import ClientWorkoutView from './components/Workout/ClientWorkoutView';
import WorkoutLogView from './components/Workout/WorkoutLogView';
import PaymentSuccess from './components/Payments/PaymentSuccess';
import ResetPasswordForm from './components/Auth/ResetPasswordForm';
import EmailConfirmed from './components/Auth/EmailConfirmed';
import SetupComplete from './components/Auth/SetupComplete';
import ProfileManagement from './components/Profile/ProfileManagement';
import UserDashboard from './components/Dashboard/UserDashboard';
import TrialManagement from './components/Admin/TrialManagement';
import InvitationManagement from './components/Admin/InvitationManagement';
import PrivacyPolicy from './components/Legal/PrivacyPolicy';
import { useTrialStatus } from './hooks/useTrialStatus';

// Helper function to check if current URL is a password reset
const isPasswordResetUrl = () => {
  return window.location.hash.includes('access_token') &&
         (window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password');
};

// Helper function to check if current URL is an email confirmation
const isEmailConfirmationUrl = () => {
  return window.location.hash.includes('access_token') &&
         window.location.hash.includes('type=signup');
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const isOnline = useNetworkStatus();
  useKeyboardAware();
  const { hasAccess, isTrialExpired, needsPaywall, hasCompletedIntake, loading: trialLoading, refreshTrialStatus } = useTrialStatus(user);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [initError, setInitError] = useState<string | null>(null);

  // Check for initialization errors
  React.useEffect(() => {
    try {
      const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
      const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!hasSupabaseUrl || !hasSupabaseKey) {
        setInitError('Missing environment variables. Please check deployment configuration.');
        console.error('Environment variables missing:', { hasSupabaseUrl, hasSupabaseKey });
      }
    } catch (error) {
      setInitError(`Initialization error: ${error}`);
      console.error('App initialization error:', error);
    }
  }, []);

  // Handle OAuth deep link redirects on native platforms
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      // Close the in-app browser when we receive the callback
      try {
        await Browser.close();
      } catch (_) {}

      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;

      const fragment = url.substring(hashIndex + 1);
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error('Error setting session from deep link:', error.message);
        }
      }
    };

    // When user manually closes the browser, check if session was established
    const handleBrowserFinished = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Session might have been set in the browser context; try refreshing
        await supabase.auth.refreshSession();
      }
    };

    CapApp.addListener('appUrlOpen', handleAppUrlOpen);
    Browser.addListener('browserFinished', handleBrowserFinished);

    return () => {
      CapApp.removeAllListeners();
      Browser.removeAllListeners();
    };
  }, []);

  const handleViewChange = (view: string, id?: string) => {
    if (view === 'workouts' && currentView === 'workouts' && !id) {
      setSelectedWorkoutId(undefined);
      setCurrentView('workouts-reset');
      setTimeout(() => setCurrentView('workouts'), 0);
    } else {
      setCurrentView(view);
      if (view === 'workout-log') {
        setSelectedWorkoutId(id);
        setSelectedClientId(undefined);
      } else if (view === 'workouts') {
        setSelectedWorkoutId(id);
        setSelectedClientId(undefined);
      } else if (view === 'clients') {
        setSelectedClientId(id);
        setSelectedWorkoutId(undefined);
      } else {
        setSelectedWorkoutId(id);
      }
    }
    setSidebarOpen(false);
  };

  // Show initialization error if any
  if (initError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 p-4 safe-top safe-bottom">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">App Initialization Error</h2>
            <p className="text-sm text-red-700 mb-4">{initError}</p>
            <p className="text-xs text-gray-600 mb-4">Check console for details</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 touch-manipulation"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || trialLoading) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center safe-top safe-bottom">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Bowtai Fitness...</p>
        </div>
      </div>
    );
  }

  if (window.location.pathname === '/privacy-policy') {
    return <PrivacyPolicy />;
  }

  if (isEmailConfirmationUrl()) {
    return <EmailConfirmed />;
  }

  if (window.location.pathname === '/setup-complete') {
    return <SetupComplete />;
  }

  if (!user) {
    if (isPasswordResetUrl()) {
      return <ResetPasswordForm />;
    }
    if (window.location.pathname === '/reset-password') {
      return <ResetPasswordForm />;
    }
    return <AuthForm />;
  }

  // Onboarding Gate 1: Questionnaire
  // New clients who haven't completed the intake form AND have no active plan see ONLY the questionnaire
  if (user.role === 'client' && !hasCompletedIntake && !hasAccess && !trialLoading) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 min-h-[100dvh]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="sticky top-0 z-[70] bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img src="/icon.png" alt="Bowtai Fitness" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-gray-900">Bowtai Fitness</span>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <div className="flex-1 min-h-0 relative overflow-y-auto">
          <ClientIntakeModal
            userId={user.id}
            onComplete={refreshTrialStatus}
            onClose={undefined}
            embedded
          />
        </div>
      </div>
    );
  }

  // Onboarding Gate 2: Hard Paywall
  // Clients who completed the questionnaire but haven't activated a plan see the paywall (no tabs)
  if (user.role === 'client' && (needsPaywall || (hasCompletedIntake && !hasAccess && isTrialExpired))) {
    return (
      <div className="h-full w-full bg-gray-50 flex flex-col overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/icon.png" alt="Bowtai Fitness" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-gray-900">Bowtai Fitness</span>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
          <PaymentInterface onPurchaseComplete={refreshTrialStatus} />
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return user.role === 'coach' || user.role === 'admin' ? (
          <CoachDashboard onNavigate={handleViewChange} />
        ) : (
          <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />
        );
      case 'exercises':
        return <ExerciseLibrary />;
      case 'workout-log':
        if (selectedWorkoutId) {
          return <WorkoutLogView workoutId={selectedWorkoutId} onBack={() => handleViewChange('workouts')} />;
        }
        return user.role === 'coach' || user.role === 'admin' ? <WorkoutBuilder /> : <ClientWorkoutView key="workout-log-fallback" />;
      case 'workouts':
      case 'workouts-reset':
        return user.role === 'coach' || user.role === 'admin' ? <WorkoutBuilder /> : <ClientWorkoutView key={`workout-${currentView}-${selectedWorkoutId || 'list'}`} initialWorkoutId={selectedWorkoutId} />;
      case 'performance':
        return <PerformanceTracker />;
      case 'clients':
        // Only allow coaches and admins to access client management
        if (user.role !== 'coach' && user.role !== 'admin') {
          return user.role === 'coach' || user.role === 'admin' ? (
            <CoachDashboard onNavigate={handleViewChange} />
          ) : (
            <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />
          );
        }
        return <ClientManagement onNavigate={handleViewChange} initialClientId={selectedClientId} />;
      case 'trainers':
        // Only allow admins to access trainer management
        if (user?.email !== 'brian@bowtaifitness.com') {
          return user.role === 'coach' || user.role === 'admin' ? (
            <CoachDashboard onNavigate={handleViewChange} />
          ) : (
            <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />
          );
        }
        return <ClientManagement onNavigate={handleViewChange} userType="trainers" />;
      case 'payments':
        if (user?.email === 'brian@bowtaifitness.com') {
          return <PaymentInterface />;
        }
        if (user.role === 'client') {
          return <PaymentInterface />;
        }
        return user.role === 'coach' || user.role === 'admin' ? (
          <CoachDashboard onNavigate={handleViewChange} />
        ) : (
          <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />
        );
      case 'payment-success':
        return <PaymentSuccess />;
      case 'promotions':
        if (user?.email === 'brian@bowtaifitness.com') {
          return <TrialManagement />;
        }
        return <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />;
      case 'invitations':
        if (user?.email === 'brian@bowtaifitness.com') {
          return <InvitationManagement />;
        }
        return <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />;
      case 'my-program':
        return <UserDashboard onNavigate={handleViewChange} />;
      case 'profile':
        return <ProfileManagement />;
      default:
        return user.role === 'coach' || user.role === 'admin' ? <CoachDashboard onNavigate={handleViewChange} /> : <ClientDashboard onNavigate={handleViewChange} onIntakeComplete={refreshTrialStatus} />;
    }
  };

  return (
    <div className="h-full w-full overflow-hidden bg-gray-50 flex flex-col" style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
      {/* Handle email confirmation */}
      {isEmailConfirmationUrl() && (
        <EmailConfirmed />
      )}

      {/* Handle payment success route */}
      {window.location.pathname === '/payment-success' && (
        <PaymentSuccess />
      )}

      {/* Handle password reset route or URL with reset token */}
      {(window.location.pathname === '/reset-password' || isPasswordResetUrl()) && (
        <ResetPasswordForm />
      )}

      {window.location.pathname !== '/payment-success' &&
       window.location.pathname !== '/reset-password' &&
       !isPasswordResetUrl() &&
       !isEmailConfirmationUrl() && (
        <>
          {!isOnline && (
            <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shrink-0">
              <WifiOff className="h-4 w-4" />
              You are offline. Some features may be unavailable.
            </div>
          )}
          <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} onNavigate={handleViewChange} />
          <div className="flex flex-1 min-h-0 w-full">
            <Sidebar
              currentView={currentView}
              onViewChange={handleViewChange}
              isOpen={sidebarOpen}
            />
            <main className="flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto bg-gray-50 keyboard-aware-container" key={currentView}>
              <div className="w-full max-w-5xl mx-auto">
                {renderContent()}
              </div>
            </main>
          </div>
          <BottomTabBar currentView={currentView} onViewChange={handleViewChange} />
        </>
      )}
    </div>
  );
};

const GlobalTutorialModal: React.FC = () => {
  const { isTutorialOpen, closeTutorial } = useTutorial();
  if (!isTutorialOpen) return null;
  return (
    <div className="fixed inset-0 z-[999]">
      <OnboardingTutorialModal onClose={closeTutorial} />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <WorkoutProvider>
        <FloatingVideoProvider>
          <TutorialProvider>
            <AppContent />
            <FloatingVideoPlayer />
            <GlobalTutorialModal />
          </TutorialProvider>
        </FloatingVideoProvider>
      </WorkoutProvider>
    </AuthProvider>
  );
}

export default App;