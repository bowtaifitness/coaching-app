import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';

const PrivacyPolicy: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | Bowtai Fitness',
    description: 'Read the privacy policy for the Bowtai Fitness fitness coaching app to understand how we secure and protect your personal performance training data.',
    canonicalPath: '/privacy-policy',
    robots: 'noindex',
    ogType: 'website',
  });

  return (
    <div
      className="h-full bg-gray-50 overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <header
        className="bg-white border-b border-gray-200 sticky top-0 z-10"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </a>
          <div className="h-5 w-px bg-gray-300" />
          <h1 className="text-lg font-semibold text-gray-900">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-10">
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-500 mb-8">Last updated: May 16, 2026</p>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                Bowtai Fitness Fitness ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our fitness and coaching application. Please read this policy carefully. By using our application, you consent to the practices described herein.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We collect the minimum information necessary to provide you with a personalized fitness coaching experience:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Name</strong> - to personalize your experience and allow your coach to identify you.</li>
                <li><strong>Email address</strong> - for account creation, login, and essential communications regarding your account.</li>
                <li><strong>Profile information</strong> - such as fitness goals, physical metrics, and workout preferences you voluntarily provide to receive tailored coaching.</li>
                <li><strong>Workout data</strong> - exercise logs, performance metrics, and progress tracking data generated through your use of the app.</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Authentication &amp; Third-Party Login Providers</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We offer authentication through the following third-party OAuth providers:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Google</strong> (Google Sign-In)</li>
                <li><strong>Apple</strong> (Sign in with Apple)</li>
                <li><strong>Meta</strong> (Facebook Login)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                When you choose to sign in using one of these providers, we receive only your basic profile information (name and email address) as authorized by you during the login process. We do not receive or store your password from these providers. Each provider's own privacy policy governs their handling of your data during the authentication process.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Your information is used solely for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Account management</strong> - creating, maintaining, and securing your account.</li>
                <li><strong>Workout tracking</strong> - recording your exercises, sets, reps, and progress over time.</li>
                <li><strong>Coaching services</strong> - enabling your assigned coach to design programs, track your progress, and provide personalized guidance.</li>
                <li><strong>Communication</strong> - sending essential account notifications, workout reminders, and in-app messages between you and your coach.</li>
                <li><strong>Service improvement</strong> - understanding usage patterns to improve app functionality and user experience.</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Sharing &amp; Selling</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-900 font-semibold">
                  We do not sell, rent, trade, or otherwise transfer your personal information to third parties for marketing or commercial purposes.
                </p>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4">
                Your data may be shared only in the following limited circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>With your coach</strong> - your assigned coach can view your profile, workout data, and progress to provide effective training guidance.</li>
                <li><strong>Service providers</strong> - we use Supabase for secure data storage and Stripe for payment processing. These providers access only the data necessary to perform their services and are bound by their own privacy policies.</li>
                <li><strong>Legal requirements</strong> - we may disclose information if required by law, regulation, legal process, or governmental request.</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We implement industry-standard security measures to protect your personal information, including encrypted data transmission (TLS/SSL), secure database storage with row-level security policies, and regular security audits. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide our services. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes such as fraud prevention.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Depending on your jurisdiction, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Access and receive a copy of your personal data.</li>
                <li>Correct inaccurate or incomplete information.</li>
                <li>Request deletion of your account and associated data.</li>
                <li>Object to or restrict certain processing of your data.</li>
                <li>Data portability - receive your data in a structured, machine-readable format.</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise any of these rights, please contact us using the information provided below.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Our service is not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child without parental consent, we will take steps to delete that information promptly.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. When we make changes, we will update the "Last updated" date at the top of this page. We encourage you to review this policy periodically to stay informed about how we protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-800 font-medium">Bowtai Fitness</p>
                <p className="text-gray-600">Email: support@bowtaifitness.com</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
