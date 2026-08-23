import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PIN_MAX_LENGTH, normalizePinInput, verifyPin } from '../utils/pin';

interface BasePinLockProps {
  correctPin?: string;
  pinHash?: string;
  pinSalt?: string;
  onUnlock: () => void;
}

type PinLockProps =
  | (BasePinLockProps & {
    purpose?: 'unlock';
    onCancel?: never;
  })
  | (BasePinLockProps & {
    purpose: 'exitDiscreteMode';
    onCancel: () => void;
  });

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30;

const PinLock: React.FC<PinLockProps> = (props) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const prompt = props.purpose === 'exitDiscreteMode'
    ? t('settings.pin_exit_discrete_prompt')
    : t('settings.pin_unlock_prompt');

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = async () => {
    if (lockoutRemaining > 0 || isVerifying || !input) return;

    setIsVerifying(true);
    try {
      const isValid = await verifyPin(input, props.pinHash, props.pinSalt, props.correctPin);
      if (isValid) {
        setFailedAttempts(0);
        props.onUnlock();
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setError(true);
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
          setFailedAttempts(0);
        }
        setTimeout(() => {
          setInput('');
          setError(false);
        }, 400);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const isLockedOut = lockoutRemaining > 0;

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
        <p className="text-xs font-medium text-slate-400 text-center max-w-[260px]">
          {isLockedOut
            ? t('settings.pin_locked_out', {
              seconds: lockoutRemaining,
              defaultValue: `Too many failed attempts. Try again in ${lockoutRemaining}s.`
            })
            : prompt}
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-4">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={PIN_MAX_LENGTH}
          placeholder={t('settings.pin_placeholder')}
          value={input}
          disabled={isLockedOut || isVerifying}
          onChange={(e) => { setInput(normalizePinInput(e.target.value)); setError(false); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className={`w-full bg-white border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7598a0]/30 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-100 ${error ? 'border-rose-400' : 'border-slate-300'}`}
          style={error ? { boxShadow: '0 0 0 2px rgba(251, 113, 133, 0.3)' } : {}}
          autoFocus
          autoComplete="one-time-code"
        />
        {error && (
          <p className="text-xs text-rose-600 text-center">{t('settings.incorrect_pin', 'Incorrect PIN.')}</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLockedOut || isVerifying || input.length === 0}
          className="w-full py-3 rounded-xl font-bold text-sm bg-[#7598a0] text-white shadow-md shadow-[#7598a0]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVerifying ? '...' : t('common.unlock', 'Unlock')}
        </button>
        {props.purpose === 'exitDiscreteMode' && (
          <button
            type="button"
            onClick={props.onCancel}
            disabled={isVerifying}
            className="w-full py-2 text-sm font-semibold text-slate-500"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  );
};

export default PinLock;
