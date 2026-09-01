import React from 'react';
import { useTranslation } from 'react-i18next';

export const LoadErrorScreen: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-[#fcfaf6] flex flex-col items-center justify-center p-6 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
                {t('errors.load_failed_title', 'Could not unlock your data')}
            </h2>
            <p className="text-sm text-slate-500 max-w-xs mb-6">
                {t('errors.load_failed_desc', 'Your data is still on this device and has not been changed. Restarting the app usually fixes this.')}
            </p>
            <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-[#7598a0] text-white rounded-xl font-bold text-sm shadow-md active:scale-95"
            >
                {t('common.reload', 'Reload')}
            </button>
        </div>
    );
};

export default LoadErrorScreen;
