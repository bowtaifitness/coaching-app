import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from './lib/capacitor-shim';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Handle OAuth callback redirect for native Capacitor apps.
const hash = window.location.hash;
if (
  hash.includes('access_token') &&
  !hash.includes('type=recovery') &&
  !hash.includes('type=signup')
) {
  const isCapacitorWebView = window.location.hostname === 'app.bowtaifitness.com';
  const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isInAppBrowser = !isCapacitorWebView && isIOSDevice;
  if (isInAppBrowser) {
    window.location.href = `com.bowtaifitness.app://callback${hash}`;
  }
}

if (import.meta.env.DEV) {
  document.title = 'Bowtai Fitness (DEV MODE) - Coaching Platform';
}

// Register service worker for PWA support (web only, not in native shell)
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            });
          }
        });

        setInterval(() => {
          registration.update();
        }, 60000);
      })
      .catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
