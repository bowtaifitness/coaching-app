import React, { useState, useRef } from 'react';
import { supabase, getRedirectUrl } from '../../lib/supabase';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const redirectTo = getRedirectUrl('/reset-password');
      console.log('Attempting password reset for email:', email);
      console.log('Reset redirect URL:', redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      
      console.log('Supabase resetPasswordForEmail response:', { error });
      
      if (error) {
        console.error('Supabase password reset error details:', {
          message: error.message,
          status: error.status,
          details: error
        });
        throw error;
      }
      
      console.log('Password reset email sent successfully');
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      // Provide user-friendly error messages
      if ((err.message?.includes('Error sending recovery email') || 
          err.code === 'unexpected_failure') && 
          err.status === 500) {
        setError('Unable to send password reset email. The email service configuration needs to be set up in the system. Please contact support for assistance.');
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('This email address is not confirmed. Please check your email for a confirmation link first.');
      } else if (err.message?.includes('User not found')) {
        // For security, don't reveal if user exists or not
        setError('If an account with this email exists, you will receive a password reset link shortly.');
      } else if (err.message?.includes('rate limit')) {
        setError('Too many reset attempts. Please wait a few minutes before trying again.');
      } else if (err.message?.includes('redirect')) {
        setError('Configuration error. Please contact support.');
      } else if (err.status === 504 || err.message?.includes('timeout') || err.message?.includes('Gateway Timeout')) {
        setError('The email service is experiencing delays. This usually means the SMTP configuration in Supabase needs to be checked. Please contact support or try again in a few minutes.');
      } else if (err.name === 'AuthRetryableFetchError') {
        setError('Email service temporarily unavailable. Please check your Supabase SMTP configuration or try again later.');
      } else {
        setError(`Unable to send reset email: ${err.message}. Please try again or contact support.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-6 w-full max-w-md sm:mx-4 keyboard-aware-container">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {success ? 'Check Your Email' : 'Reset Password'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Reset Link Sent!</h4>
            <p className="text-gray-600 mb-6">
              We've sent a password reset link to <strong>{email}</strong>. 
              Check your email and follow the instructions to reset your password.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Don't see the email?</strong> Check your spam folder or wait a few minutes for it to arrive.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-gray-600 text-center mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                ref={emailInputRef}
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your email address"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="flex items-center text-sm text-gray-600 hover:text-green-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;