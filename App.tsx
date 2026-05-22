import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './components/ErrorFallback';
import { MoonevaProvider } from './contexts/MoonevaContext';
import { AppRouter } from './components/AppRouter';

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <MoonevaProvider>
        <AppRouter />
      </MoonevaProvider>
    </ErrorBoundary>
  );
}

export default App;