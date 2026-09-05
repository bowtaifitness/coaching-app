import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SetupComplete: React.FC = () => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
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
  }, []);

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 sm:h-32 sm:w-32 flex items-center justify-center mb-4 rounded-full overflow-hidden">
            <img
              src="/logo.jpg"
              alt="Bowtai Fitness"
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Setup Complete!</h2>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Payment Method Added!</h3>
            <p className="text-sm text-gray-600">
              Your payment method has been securely saved. You can now access your free trial.
            </p>
            {user?.email && (
              <p className="text-sm font-medium text-blue-600">{user.email}</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-sm text-gray-600 text-center">
              Redirecting you to your dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupComplete;
