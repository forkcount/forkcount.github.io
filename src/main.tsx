import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './index.css';

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      window.dispatchEvent(new CustomEvent('forkcount-sw-update'));
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

setTimeout(() => {
  try {
    sessionStorage.removeItem('forkcount_sw_cache_reset_done');
  } catch {
    // ignore
  }
}, 2000);
