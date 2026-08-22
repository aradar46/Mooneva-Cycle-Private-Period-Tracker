import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { i18nReady } from './services/i18n';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Wait for the active locale chunk so the first paint is already translated.
// `finally` (not `then`) so a failed locale load still renders, on the en fallback.
i18nReady.finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});