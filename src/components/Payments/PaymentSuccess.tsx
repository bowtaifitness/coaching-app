import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, ArrowRight, Home, CreditCard } from 'lucide-react';

const PaymentSuccess: React.FC = () => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Get session ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session_id');
    setSessionId(sessionIdParam);
  }, []);

  return (
    <div className="h-full w-full bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600">
            Thank you for subscribing to Bowtai Fitness. Your payment has been processed successfully.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Confirmation Email</p>
                <p className="text-sm text-gray-600">
                  You'll receive a confirmation email with your subscription details shortly.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Access Your Dashboard</p>
                <p className="text-sm text-gray-600">
                  Your coaching features are now active and ready to use.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm font-semibold">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Start Training</p>
                <p className="text-sm text-gray-600">
                  Begin your personalized fitness coaching journey today.
                </p>
              </div>
            </div>
          </div>
        </div>

        {sessionId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Session ID:</strong> {sessionId}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Keep this for your records
            </p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            View Billing
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;