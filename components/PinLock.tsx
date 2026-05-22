import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PinLockProps {
  correctPin: string;
  onUnlock: () => void;
}

const PinLock: React.FC<PinLockProps> = ({ correctPin, onUnlock }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (input === correctPin) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => { setInput(''); setError(false); }, 400);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#F0F2F5] flex flex-col items-center justify-center p-6 animate-fade-in font-sans">

      {/* Header Area */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 text-[#7598a0]"
          style={{
            backgroundColor: '#F0F2F5',
            boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-xl font-extrabold tracking-[0.15em] text-slate-700 uppercase mb-2">
          {t('settings.pin_lock') || 'Security'}
        </h2>
        <p className="text-xs font-medium text-slate-400">
          Enter your password
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-4">
        <input
          type="password"
          placeholder="Password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className={`w-full bg-white border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7598a0]/30 outline-none transition-all placeholder:text-slate-400 ${error ? 'border-rose-400' : 'border-slate-300'}`}
          style={error ? { boxShadow: '0 0 0 2px rgba(251, 113, 133, 0.3)' } : {}}
          autoFocus
          autoComplete="current-password"
        />
        {error && (
          <p className="text-xs text-rose-600 text-center">Incorrect password.</p>
        )}
        <button
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl font-bold text-sm bg-[#7598a0] text-white shadow-md shadow-[#7598a0]/20 active:scale-[0.98] transition-all"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};

export default PinLock;