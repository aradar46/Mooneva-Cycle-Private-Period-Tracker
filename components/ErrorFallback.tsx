import React from 'react';

interface ErrorFallbackProps {
    error: any;
    resetErrorBoundary: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-rose-50 p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-rose-100">
                <div className="text-4xl mb-4">🤕</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h2>
                <p className="text-gray-600 mb-6 text-sm">
                    We encountered an unexpected error. Don't worry, your data is safe on your device.
                </p>

                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 mb-6 text-left overflow-auto max-h-32">
                    <code className="text-[10px] text-rose-800 font-mono break-all">
                        {error.message}
                    </code>
                </div>

                <button
                    onClick={resetErrorBoundary}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                >
                    Reload App
                </button>
            </div>
        </div>
    );
};
