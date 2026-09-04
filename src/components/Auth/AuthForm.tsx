import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, signInWithSocial, type SocialProvider } from '../../lib/supabase';
import { Eye, EyeOff, User, UserCheck, Mail } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';
import ActivePromotionBanner from '../Promotions/ActivePromotionBanner';
import { createSetupCheckoutSession } from '../../lib/stripe';
import { Preferences } from '@capacitor/preferences';

const AuthForm: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'coach' | 'client'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [invitationRole, setInvitationRole] = useState<'coach' | 'trainer' | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);

  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    const email = params.get('email');
    const role = params.get('role') as 'coach' | 'trainer' | null;

    if (token && email && (role === 'coach' || role === 'trainer')) {
      setInvitationToken(token);
      setInvitationEmail(email);
      setInvitationRole(role);
      setSelectedRole(role);
      setIsLogin(false);
      validateInvitation(token, email, role);
    }
  }, []);

  const validateInvitation = async (token: string, email: string, role: string) => {
    setValidatingInvite(true);
    try {
      const { data, error } = await supabase.rpc('validate_invitation_token', {
        p_token: token,
        p_email: email,
        p_role: role
      });

      if (error) throw error;

      if (!data.valid) {
        setError(data.error || 'Invalid invitation');
        setInvitationToken(null);
        setInvitationEmail(null);
        setInvitationRole(null);
      }
    } catch (err) {
      console.error('Error validating invitation:', err);
      setError('Failed to validate invitation');
      setInvitationToken(null);
      setInvitationEmail(null);
      setInvitationRole(null);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    setError('');
    try {
      const { error } = await signInWithSocial(provider);
      if (error) {
        setError(error.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // User cancelled the native sign-in dialog
      if (message.toLowerCase().includes('cancel') || message.includes('1001') || message.includes('user_cancelled')) {
        // Silently ignore cancellation
      } else {
        console.error(`Social login error (${provider}):`, err);
        setError(message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    try {
      if (isLogin) {
        console.log('Attempting to sign in with:', email);
        const { error } = await signIn(email, password);
        if (error) {
          console.error('Authentication error:', error.message);
          setError(error.message);
        }
      } else {
        // Check if trying to sign up as coach/trainer without invitation
        if ((selectedRole === 'coach' || selectedRole === 'trainer') && !invitationToken) {
          setError('Coach and trainer accounts require an invitation. Please contact an administrator.');
          setLoading(false);
          return;
        }

        // For invited users, validate email matches invitation
        if (invitationToken && email !== invitationEmail) {
          setError('Email must match the invitation email');
          setLoading(false);
          return;
        }

        console.log('Attempting to sign up with:', { email, selectedRole, firstName, lastName });
        const { data, error } = await signUp(
          email,
          password,
          selectedRole,
          firstName,
          lastName,
          selectedRole === 'client'
        );
        if (error) {
          console.error('Sign up error:', error);
          setError(`Registration failed: ${error.message}`);
        } else {
          console.log('Sign up successful:', data);

          // Mark invitation as used if this was an invited signup
          if (invitationToken && invitationEmail) {
            try {
              await supabase.rpc('mark_invitation_used', {
                p_token: invitationToken,
                p_email: invitationEmail
              });
            } catch (inviteError) {
              console.error('Error marking invitation as used:', inviteError);
            }
          }

          await Preferences.set({ key: 'hasSeenOnboardingTutorial', value: 'false' });
          setSignupSuccess(true);
          setSignupEmail(email);
          if (formRef.current) formRef.current.reset();
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // If signup was successful, show success message
  if (signupSuccess) {
    return (
      <div className="h-full w-full flex flex-col lg:flex-row">
        {/* Desktop brand panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative z-10 flex flex-col items-center text-center px-12">
            <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-2xl mb-8 ring-4 ring-white/20">
              <img src="/logo.png" alt="Bowtai Fitness" className="h-full w-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Bowtai Fitness</h1>
            <p className="text-lg text-emerald-200/80 max-w-sm">Professional fitness coaching and training to elevate your performance.</p>
          </div>
        </div>
        {/* Form panel */}
        <div
          className="flex-1 bg-gradient-to-br from-gray-50 via-white to-gray-100 lg:bg-white lg:from-white lg:via-white lg:to-white flex items-start justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto keyboard-aware-container"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
        >
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <div className="mx-auto h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center mb-4 rounded-full overflow-hidden lg:hidden">
                <img src="/logo.png" alt="Bowtai Fitness" className="h-full w-full object-cover" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Account Created!</h2>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Welcome to Bowtai Fitness!</h3>
                <p className="text-sm text-gray-600">
                  Your account has been created successfully.
                </p>
                <p className="text-sm font-medium text-green-600">{signupEmail}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  You can now sign in with your email and password to get started.
                </p>
              </div>

              <button
                onClick={() => {
                  setSignupSuccess(false);
                  setSignupEmail('');
                  setIsLogin(true);
                }}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors touch-manipulation"
              >
                Continue to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row">
      {/* Desktop brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-400/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl mb-8 ring-4 ring-white/20">
            <img src="/logo.png" alt="Bowtai Fitness" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Bowtai Fitness</h1>
          <p className="text-lg text-emerald-200/80 max-w-sm leading-relaxed">Professional fitness coaching and training to elevate your performance.</p>
          <div className="mt-10 flex items-center gap-6 text-emerald-300/60 text-sm">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Custom Programs
            </span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Expert Coaching
            </span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Progress Tracking
            </span>
          </div>
        </div>
      </div>
      {/* Form panel */}
      <div
        className="flex-1 bg-gradient-to-br from-gray-50 via-white to-gray-100 lg:bg-white lg:from-white lg:via-white lg:to-white flex items-start justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 flex items-center justify-center mb-4 rounded-full overflow-hidden lg:hidden">
            <img
              src="/logo.png"
              alt="Bowtai Fitness"
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Bowtai Fitness{import.meta.env.DEV ? ' (DEV MODE)' : ''}</h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create your coaching account'}
          </p>
        </div>

        {!isLogin && !invitationToken && <ActivePromotionBanner />}

        {!isLogin && invitationToken && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-900">You've been invited!</p>
                <p className="text-sm text-blue-700 mt-1">
                  Complete your registration to join as a {invitationRole}.
                </p>
              </div>
            </div>
          </div>
        )}

        <form ref={formRef} className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="space-y-4">
              {!invitationToken && (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 mb-3">I am a...</p>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('client')}
                      className={`flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg border-2 transition-all touch-manipulation ${
                        selectedRole === 'client'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <User className="h-5 w-5 mr-2" />
                      Client
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div>
                  <label htmlFor="firstName" className="sr-only">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    className="relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="sr-only">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    className="relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Last Name"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={invitationEmail || ''}
              disabled={!!invitationToken}
              className="relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Email address"
            />
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              className="relative block w-full px-3 py-3 pr-12 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500"
              placeholder="Password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center touch-manipulation"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {resetEmailSent && (
            <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg">
              Password reset email sent! Check your inbox for instructions.
            </div>
          )}

          {!isLogin && selectedRole === 'client' && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm text-gray-700">
                  Start your free trial today! You'll receive reminders before your trial ends. Subscribe anytime to continue enjoying full access.
                </p>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </div>

          {isLogin && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                disabled={loading}
                className="text-sm text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50 touch-manipulation"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">
                or continue with
              </span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={loading || !!socialLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {socialLoading === 'google' ? (
                <div className="h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-3"></div>
              ) : (
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span className="text-sm font-medium text-gray-700">Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('apple')}
              disabled={loading || !!socialLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-black hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {socialLoading === 'apple' ? (
                <div className="h-5 w-5 border-2 border-gray-500 border-t-white rounded-full animate-spin mr-3"></div>
              ) : (
                <svg className="h-5 w-5 mr-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              <span className="text-sm font-medium text-white">Continue with Apple</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading || !!socialLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {socialLoading === 'facebook' ? (
                <div className="h-5 w-5 border-2 border-blue-300 border-t-white rounded-full animate-spin mr-3"></div>
              ) : (
                <svg className="h-5 w-5 mr-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              <span className="text-sm font-medium text-white">Continue with Meta</span>
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-green-600 hover:text-green-500 transition-colors touch-manipulation"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 pt-4 border-t border-gray-200">
            <a
              href="/privacy-policy"
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </form>
        
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </div>
      </div>
    </div>
  );
};

export default AuthForm;