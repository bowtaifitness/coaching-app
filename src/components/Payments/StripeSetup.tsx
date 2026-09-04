import React, { useState } from 'react';
import { CreditCard, Key, Globe, CheckCircle, AlertCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';

interface StripeSetupProps {
  onComplete?: () => void;
}

const StripeSetup: React.FC<StripeSetupProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [keys, setKeys] = useState({
    publishableKey: '',
    secretKey: '',
    webhookSecret: ''
  });
  const [showSecrets, setShowSecrets] = useState({
    secret: false,
    webhook: false
  });

  const steps = [
    {
      id: 1,
      title: 'Create Stripe Account',
      description: 'Sign up for a Stripe account if you don\'t have one',
      action: 'Visit Stripe Dashboard',
      url: 'https://dashboard.stripe.com/register'
    },
    {
      id: 2,
      title: 'Get API Keys',
      description: 'Copy your publishable and secret keys from the Stripe dashboard',
      action: 'Get API Keys',
      url: 'https://dashboard.stripe.com/apikeys'
    },
    {
      id: 3,
      title: 'Create Products',
      description: 'Set up your coaching packages as products in Stripe',
      action: 'Create Products',
      url: 'https://dashboard.stripe.com/products'
    },
    {
      id: 4,
      title: 'Configure Environment',
      description: 'Add your Stripe keys to the environment variables',
      action: 'Configure Keys'
    }
  ];

  const handleKeySubmit = () => {
    if (!keys.publishableKey || !keys.secretKey || !keys.webhookSecret) {
      alert('Please enter all required keys');
      return;
    }

    // Show environment variables setup
    const envVars = `# Add these to your .env file:
VITE_STRIPE_PUBLISHABLE_KEY=${keys.publishableKey}
STRIPE_SECRET_KEY=${keys.secretKey}
STRIPE_WEBHOOK_SECRET=${keys.webhookSecret}

# Webhook endpoint URL:
${window.location.origin}/functions/v1/stripe-webhooks`;

    // Copy to clipboard
    navigator.clipboard.writeText(envVars).then(() => {
      alert('Environment variables copied to clipboard!\n\nPaste these into your .env file and restart your application.');
    }).catch(() => {
      alert('Environment variables:\n\n' + envVars);
    });
    
    if (onComplete) onComplete();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
          <CreditCard className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Stripe Integration Setup</h2>
        <p className="text-gray-600">Follow these steps to integrate Stripe payments into your fitness coaching app.</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((stepItem, index) => (
            <div key={stepItem.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= stepItem.id 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : 'border-gray-300 text-gray-500'
              }`}>
                {step > stepItem.id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="font-semibold">{stepItem.id}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > stepItem.id ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {step <= 3 ? (
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Step {step}: {steps[step - 1].title}
            </h3>
            <p className="text-gray-600 mb-6">{steps[step - 1].description}</p>
            
            <div className="flex justify-center space-x-4">
              <a
                href={steps[step - 1].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                {steps[step - 1].action}
              </a>
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                I've completed this step
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Step 4: Configure Environment Variables
            </h3>
            <p className="text-gray-600 mb-6">
              Enter your Stripe API keys. In production, these should be added to your environment variables.
            </p>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publishable Key
                </label>
                <input
                  type="text"
                  value={keys.publishableKey}
                  onChange={(e) => setKeys(prev => ({ ...prev, publishableKey: e.target.value }))}
                  placeholder="pk_test_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.secret ? 'text' : 'password'}
                    value={keys.secretKey}
                    onChange={(e) => setKeys(prev => ({ ...prev, secretKey: e.target.value }))}
                    placeholder="sk_test_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, secret: !prev.secret }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showSecrets.secret ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.webhook ? 'text' : 'password'}
                    value={keys.webhookSecret}
                    onChange={(e) => setKeys(prev => ({ ...prev, webhookSecret: e.target.value }))}
                    placeholder="whsec_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, webhook: !prev.webhook }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showSecrets.webhook ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook endpoint in Stripe Dashboard
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-800 mb-2">Webhook Setup:</h5>
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex items-center justify-between">
                    <span>Endpoint URL:</span>
                    <div className="flex items-center space-x-2">
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                        {window.location.origin}/functions/v1/stripe-webhooks
                      </code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/functions/v1/stripe-webhooks`)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p>Events to listen for: customer.subscription.*, invoice.payment_*</p>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 text-sm font-medium">Security Note</p>
                    <p className="text-yellow-700 text-sm">
                      These keys will be copied to your clipboard for secure storage in environment variables.
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleKeySubmit}
                disabled={!keys.publishableKey || !keys.secretKey || !keys.webhookSecret}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Copy Environment Variables
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3">Complete Stripe Integration Features:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Subscription Management</p>
              <p className="text-blue-700 text-sm">Recurring billing for coaching packages</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Customer Portal</p>
              <p className="text-blue-700 text-sm">Self-service billing management</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Payment History</p>
              <p className="text-blue-700 text-sm">Complete transaction tracking</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Revenue Analytics</p>
              <p className="text-blue-700 text-sm">Business insights and reporting</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Webhook Integration</p>
              <p className="text-blue-700 text-sm">Real-time subscription updates</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Secure Processing</p>
              <p className="text-blue-700 text-sm">PCI-compliant payment handling</p>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-6">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            Open Stripe Dashboard
          </a>
          <div className="mt-4">
            <a
              href="/STRIPE_SETUP_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm"
            >
              📋 View Complete Setup Guide
            </a>
          </div>
        </div>
      </div>
      
      {/* Quick Setup Guide */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
        <h4 className="font-semibold text-green-900 mb-3">Quick Setup Checklist:</h4>
        <div className="space-y-2 text-sm text-green-800">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Create Stripe account and get API keys</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Create products and prices in Stripe Dashboard</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Set up webhook endpoint for real-time updates</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Add environment variables to your app</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Test payments in development mode</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeSetup;