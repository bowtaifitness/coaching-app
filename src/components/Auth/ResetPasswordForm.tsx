import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader, Lock } from 'lucide-react';

const ResetPasswordForm: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Check if we have a valid session from the reset link (either from URL params or hash)
    const checkSession = async () => {
      try {
        // First check if there's a hash with access_token (from email link)
        const hash = window.location.hash;
        if (hash.includes('access_token')) {
          console.log('Found access token in URL hash, processing...');
          
          // Extract the session from the URL
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session from URL:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
            return;
          }
          
          if (data.session) {
            console.log('Valid reset session found');
            setValidSession(true);
          } else {
            console.log('No session found, checking if we can refresh...');
            // Try to refresh the session
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshData.session) {
              setValidSession(true);
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.');
            }
          }
        } else {
          // Check for existing session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setValidSession(true);
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
        setError('Error processing reset link. Please try again.');
      }
    };

    checkSession();
  }, []);

  // Handle URL hash parameters on component mount
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.includes('access_token') && hash.includes('type=recovery')) {
        console.log('Processing password reset from email link...');
        
        try {
          // The session should be automatically set by Supabase
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error processing reset session:', error);
            setError('Error processing reset link. Please try again.');
            return;
          }
          
          if (session) {
            console.log('Reset session established successfully');
            setValidSession(true);
            // Clean up the URL
            window.history.replaceState({}, document.title, '/reset-password');
          }
        } catch (err) {
          console.error('Hash processing error:', err);
          setError('Error processing reset link. Please try again.');
        }
      }
    };

    // Process hash immediately
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Also check on component mount for hash-based reset
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      // Let Supabase handle the session automatically
      const timer = setTimeout(() => {
      }, 1000); // Give Supabase time to process the hash

      return () => clearTimeout(timer);
    }
  }, []);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        throw error;
      }
      
      setSuccess(true);
      
      // Redirect to main app after 3 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      
    } catch (err: any) {
      console.error('Password update error:', err);
      
      if (err.message?.includes('session')) {
        setError('Your reset session has expired. Please request a new password reset.');
      } else if (err.message?.includes('weak')) {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!validSession && !error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Loader className="h-12 w-12 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>

        {success ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Password Updated!</h3>
              <p className="text-gray-600 mb-4">
                Your password has been successfully updated. You'll be redirected to the app shortly.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Redirecting in 3 seconds...
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6" onSubmit={handleSubmit}>
            {!validSession && error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-red-700">{error}</p>
                </div>
                <div className="mt-4">
                  <a
                    href="/"
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Back to Sign In
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter new password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Confirm new password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Update Password
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        )}

        <div className="text-center">
          <a
            href="/"
            className="font-medium text-green-600 hover:text-green-500 transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordForm;