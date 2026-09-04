import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const EmailConfirmed: React.FC = () => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConfirmation = async () => {
      console.log('EmailConfirmed: Checking auth state...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      if (user) {
        console.log('EmailConfirmed: User is authenticated!', user.email);
        setConfirming(false);
        setError(null);
      } else {
        console.log('EmailConfirmed: No user found after waiting');
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (user) {
          setConfirming(false);
          setError(null);
        } else {
          setError('Email confirmed! Please sign in with your credentials.');
          setConfirming(false);
        }
      }
    };

    checkConfirmation();
  }, [user]);

  useEffect(() => {
    if (!confirming && !error) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = '/';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [confirming, error]);

  if (confirming) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Confirming Email...</h2>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-12 w-12 border-4 border-green-600 border-t-transparent rounded-full"></div>
            </div>

            <div className="text-center space-y-3">
              <p className="text-gray-600">
                Please wait while we verify your email address...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Email Confirmed!</h2>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-xl font-semibold text-gray-900">
                Your email has been verified!
              </h3>
              <p className="text-gray-600">
                You can now sign in with your credentials.
              </p>
            </div>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Email Confirmed!</h2>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h3 className="text-xl font-semibold text-gray-900">
              Your email has been verified!
            </h3>
            <p className="text-gray-600">
              {user ? (
                <>
                  Welcome, {user.firstName}! You're now logged in and will be redirected to your dashboard in {countdown} seconds.
                </>
              ) : (
                <>
                  You can now sign in to your account. Redirecting you to the sign in page in {countdown} seconds.
                </>
              )}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 text-center">
              Your account is now active and ready to use!
            </p>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            {user ? 'Go to Dashboard' : 'Sign In Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmed;
