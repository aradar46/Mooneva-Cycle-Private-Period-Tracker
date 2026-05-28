import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings, DailyLog, INITIAL_SYMPTOMS } from '../types';
import { requestNotificationPermission } from '../services/notifications';

interface OnboardingWizardProps {
  onComplete: (settings: AppSettings, initialLog?: { date: string, log: DailyLog }) => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);

  // --- Form State ---
  const [lastPeriodDate, setLastPeriodDate] = useState<string | null>(null);
  const [dontRemember, setDontRemember] = useState(false);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);

  // Goals
  const [goal, setGoal] = useState<'track' | 'fertility' | 'pregnancy' | 'birthControl'>('track');
  const [adaptivePrediction, setAdaptivePrediction] = useState(false);

  // Spycraft / Discrete
  const [discreteUnlocked, setDiscreteUnlocked] = useState(false);
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);


  // --- Helpers ---
  const handleFinish = async () => {
    // Request notification permission before finishing
    await requestNotificationPermission();

    // Determine settings based on goal
    let predictionsPaused = false;
    let isOnBirthControl = false;
    let showFertileWindow = false;

    if (goal === 'pregnancy') predictionsPaused = true;
    if (goal === 'birthControl') {
      isOnBirthControl = true;
      showFertileWindow = false;
    }
    if (goal === 'fertility') {
      showFertileWindow = true;
    }

    const newSettings: AppSettings = {
      userName: 'User',
      discreteMode: false,
      onboardingCompleted: true,
      isOnBirthControl,
      symptoms: INITIAL_SYMPTOMS,
      predictionsPaused,
      adaptivePrediction,
      pin: undefined,
      cycleLength,
      periodLength,
      lutealPhaseLength: 14,
      pmsLength: 3,
      showFertileWindow
    };

    let initialLog;
    if (!dontRemember && lastPeriodDate) {
      initialLog = {
        date: lastPeriodDate,
        log: {
          date: lastPeriodDate,
          flow: 'medium',
          symptoms: [],
          notes: 'First entry from onboarding'
        } as DailyLog
      };
    }

    onComplete(newSettings, initialLog);
  };

  // --- Navigation Helpers ---
  const nextStep = () => {
    if (step === 3 && (goal === 'pregnancy' || goal === 'birthControl')) {
      setStep(6); // skip spycraft, go to get started
    } else if (step === 5) {
      setStep(6); // spycraft → get started
    } else if (step === 6) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step === 6 && (goal === 'pregnancy' || goal === 'birthControl')) {
      setStep(3);
    } else if (step === 6) {
      setStep(5);
    } else if (step === 5 && (goal === 'pregnancy' || goal === 'birthControl')) {
      setStep(3);
    } else {
      setStep(s => Math.max(0, s - 1));
    }
  };

  // --- Interaction Handlers ---
  const handlePressStart = React.useCallback(() => {
    if (discreteUnlocked) return;
    setPressing(true);
    setProgress(0);
    const startTime = Date.now();
    const duration = 2000; // 2 seconds

    if (pressTimer.current) clearInterval(pressTimer.current);
    pressTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);

      if (p >= 100) {
        if (pressTimer.current) clearInterval(pressTimer.current);
        setDiscreteUnlocked(true);
        setPressing(false);
      }
    }, 50);
  }, [discreteUnlocked]);

  const handlePressEnd = React.useCallback(() => {
    if (discreteUnlocked) return;
    setPressing(false);
    setProgress(0);
    if (pressTimer.current) clearInterval(pressTimer.current);
  }, [discreteUnlocked]);

  const dateStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step === 2 && dateStripRef.current) {
      setTimeout(() => {
        if (dateStripRef.current) {
          dateStripRef.current.scrollLeft = dateStripRef.current.scrollWidth;
        }
      }, 50);
    }
  }, [step]);

  // --- Render Steps ---
  const renderLanguage = () => {
    const languages = [
      { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
      { code: 'de', label: 'German', native: 'Deutsch', flag: '🇩🇪' },
      { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
      { code: 'sv', label: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
      { code: 'zh', label: 'Chinese', native: '中文', flag: '🇨🇳' },
      { code: 'fa', label: 'Persian', native: 'فارسی', flag: '🇮🇷' },
    ];

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-center items-center py-4 px-2">
          <div className="w-16 mb-4">
            <img
              src="/bitmap.png"
              alt="Mooneva"
              className="w-full h-auto object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Mooneva</h1>
          <p className="text-xs text-slate-400 font-medium mb-6 tracking-wide">Choose your language</p>
          <div
            className="w-full max-w-sm bg-[#F0F2F5] rounded-2xl p-4"
            style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
          >
            <div className="grid grid-cols-3 gap-2">
              {languages.map((lang) => {
                const isSelected = i18n.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all ${isSelected
                      ? 'bg-[#7598a0] text-white scale-[0.98]'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    style={isSelected ? {
                      boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                    } : {
                      boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)'
                    }}
                  >
                    <span className="text-xl mb-1">{lang.flag}</span>
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-slate-600'}`}>{lang.native}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 w-full max-w-sm mx-auto pt-4 pb-2">
          <button
            onClick={nextStep}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white bg-[#7598a0] transition-all active:scale-[0.98]"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
          >
            {t('common.continue')}
          </button>
        </div>
      </div>
    );
  };

  const renderTrust = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center justify-center text-center gap-6 px-4 py-4">
        <div className="w-40 max-w-[40vw] relative">
          <img
            src="/bitmap.png"
            alt="Mooneva"
            className="w-full h-auto object-contain drop-shadow-xl animate-fade-in"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) parent.innerHTML = '<div class="w-full h-full rounded-full bg-[#7598a0] flex items-center justify-center text-white text-4xl font-black">M</div>';
            }}
          />
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
            {t('onboarding.trust.title')}
          </h1>
          <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs mx-auto">
            {t('onboarding.trust.desc')}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 space-y-3 w-full max-w-sm mx-auto pt-4 pb-2">
        <button
          onClick={nextStep}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-white bg-[#7598a0] transition-all active:scale-[0.98]"
          style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
        >
          {t('onboarding.trust.start')}
        </button>
        <button
          className="w-full text-[10px] font-bold uppercase tracking-widest text-[#7598a0] hover:text-[#5a767d] transition-colors"
          onClick={() => alert(t('onboarding.trust.backup_alert'))}
        >
          {t('onboarding.trust.backup_hint')}
        </button>
      </div>
    </div>
  );

  const renderCalibration = () => {
    const dates = [];
    const today = new Date();
    for (let i = 60; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }

    return (
      <div className="flex flex-col h-full min-h-0 py-2 px-2">
        <h2 className="flex-shrink-0 text-2xl font-black text-slate-800 tracking-tight text-center mb-4">{t('onboarding.calibration.title')}</h2>
        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto no-scrollbar pb-2">
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-2">{t('onboarding.calibration.last_period_label')}</label>
            {!dontRemember ? (
              <div
                ref={dateStripRef}
                className="bg-[#F0F2F5] p-3 rounded-2xl overflow-x-auto no-scrollbar flex gap-3 scroll-smooth"
                style={{ boxShadow: 'inset 3px 3px 6px rgba(163, 177, 198, 0.3), inset -3px -3px 6px rgba(255, 255, 255, 0.7)' }}
              >
                {dates.map((date) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isSelected = lastPeriodDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setLastPeriodDate(dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[60px] h-[70px] rounded-xl transition-all flex-shrink-0 ${isSelected ? 'bg-[#7598a0] text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                      <span className="text-[10px] font-bold uppercase">{date.toLocaleDateString(i18n.language, { month: 'short' })}</span>
                      <span className="text-xl font-black">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-[#F0F2F5] rounded-2xl border border-dashed border-slate-300 text-center">
                <span className="text-xs font-medium text-slate-400">{t('onboarding.calibration.starting_fresh')}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-2 cursor-pointer" onClick={() => setDontRemember(!dontRemember)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${dontRemember ? 'bg-[#7598a0] border-[#7598a0]' : 'border-slate-300'}`}>
                {dontRemember && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-xs font-bold text-slate-500 select-none">{t('onboarding.calibration.dont_remember')}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('onboarding.calibration.cycle_length_label')}</label>
              <span className="text-[10px] text-slate-400 font-medium">{t('onboarding.calibration.cycle_length_sub')}</span>
            </div>
            <div
              className="flex items-center justify-between bg-[#F0F2F5] p-2 rounded-2xl"
              style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.2), -8px -8px 16px rgba(255, 255, 255, 0.6)' }}
            >
              <button
                onClick={() => setCycleLength(c => Math.max(21, c - 1))}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 text-xl font-bold bg-[#F0F2F5] active:scale-95 transition-all"
                style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
              >-</button>
              <span className="text-2xl font-black text-slate-700">{cycleLength} <span className="text-sm font-bold text-slate-400">{t('common.days')}</span></span>
              <button
                onClick={() => setCycleLength(c => Math.min(45, c + 1))}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 text-xl font-bold bg-[#F0F2F5] active:scale-95 transition-all"
                style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
              >+</button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('onboarding.calibration.period_duration_label')}</label>
              <span className="text-[10px] text-slate-400 font-medium">{t('onboarding.calibration.period_duration_sub')}</span>
            </div>
            <div
              className="flex items-center justify-between bg-[#F0F2F5] p-2 rounded-2xl"
              style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.2), -8px -8px 16px rgba(255, 255, 255, 0.6)' }}
            >
              <button
                onClick={() => setPeriodLength(p => Math.max(2, p - 1))}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 text-xl font-bold bg-[#F0F2F5] active:scale-95 transition-all"
                style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
              >-</button>
              <span className="text-2xl font-black text-slate-700">{periodLength} <span className="text-sm font-bold text-slate-400">{t('common.days')}</span></span>
              <button
                onClick={() => setPeriodLength(p => Math.min(10, p + 1))}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 text-xl font-bold bg-[#F0F2F5] active:scale-95 transition-all"
                style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
              >+</button>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 pt-3 space-y-3">
          <button
            onClick={() => {
              if (!lastPeriodDate && !dontRemember) {
                setDontRemember(true);
              }
              nextStep();
            }}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-white bg-[#7598a0] transition-all active:scale-[0.98]"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
          >
            {t('common.next')}
          </button>
          <button onClick={prevStep} className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('common.back')}</button>
          <p className="text-[9px] text-center text-slate-400">{t('onboarding.calibration.settings_hint')}</p>
        </div>
      </div>
    );
  };

  const renderGoal = () => {
    const goals = [
      { id: 'track', label: t('onboarding.goal.track_label'), sub: t('onboarding.goal.track_sub'), icon: '🌱' },
      { id: 'fertility', label: t('onboarding.goal.fertility_label'), sub: t('onboarding.goal.fertility_sub'), icon: '🥚' },
      { id: 'pregnancy', label: t('onboarding.goal.pregnancy_label'), sub: t('onboarding.goal.pregnancy_sub'), icon: '🤰' },
      { id: 'birthControl', label: t('onboarding.goal.birth_control_label'), sub: t('onboarding.goal.birth_control_sub'), icon: '💊' },
    ] as const;

    return (
      <div className="flex flex-col h-full min-h-0 py-2 px-2">
        <h2 className="flex-shrink-0 text-2xl font-black text-slate-800 tracking-tight text-center mb-4">{t('onboarding.goal.title')}</h2>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 pb-2">
          {goals.map((g) => {
            const active = goal === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`w-full p-4 rounded-2xl text-left rtl:text-right transition-all flex items-center gap-4 group relative overflow-hidden ${active ? 'text-[#7598a0]' : 'text-slate-600'}`}
                style={active
                  ? { boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.8)', backgroundColor: '#F0F2F5' }
                  : { boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.3), -6px -6px 12px rgba(255, 255, 255, 0.7)', backgroundColor: '#F0F2F5' }
                }
              >
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <div className="text-sm font-black uppercase tracking-wider">{g.label}</div>
                  <div className="text-[10px] font-medium text-slate-400 mt-0.5">{g.sub}</div>
                </div>
                {active && <div className="absolute ltr:right-4 rtl:left-4 w-2 h-2 rounded-full bg-[#7598a0] shadow-[0_0_8px_#7598a0]" />}
              </button>
            );
          })}
        </div>
        <div className="flex-shrink-0 pt-3 space-y-3">
          <button
            onClick={nextStep}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-white bg-[#7598a0] transition-all active:scale-[0.98]"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
          >
            {t('common.continue')}
          </button>
          <button onClick={prevStep} className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('common.back')}</button>
          <p className="text-[9px] text-center text-slate-400">{t('onboarding.calibration.settings_hint')}</p>
        </div>
      </div>
    );
  };

  const renderAdaptivePrediction = () => {
    return (
      <div className="flex flex-col h-full min-h-0 py-2 px-2">
        <h2 className="flex-shrink-0 text-2xl font-black text-slate-800 tracking-tight text-center mb-3">{t('onboarding.adaptive.title')}</h2>
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto no-scrollbar pb-2">
          <div className="bg-[#F0F2F5] p-5 rounded-3xl space-y-3" style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.7)' }}>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">{t('onboarding.adaptive.desc')}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{t('onboarding.adaptive.hint')}</p>
            <p className="text-xs text-[#7598a0] font-semibold leading-relaxed border-t border-slate-200/60 pt-3">{t('onboarding.adaptive.activation_note')}</p>
          </div>
          <button
            onClick={() => setAdaptivePrediction(!adaptivePrediction)}
            className={`w-full p-5 rounded-2xl text-left rtl:text-right transition-all duration-300 flex items-center justify-between relative overflow-hidden ${adaptivePrediction ? 'text-white' : 'text-slate-500'}`}
            style={adaptivePrediction
              ? { background: 'linear-gradient(135deg, #7598a0, #5a7d87)', boxShadow: '6px 6px 14px rgba(117, 152, 160, 0.5), -3px -3px 8px rgba(255, 255, 255, 0.6)' }
              : { backgroundColor: '#F0F2F5', boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.3), -6px -6px 12px rgba(255, 255, 255, 0.7)' }
            }
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{adaptivePrediction ? '🧠' : '🗓️'}</span>
              <div>
                <div className={`text-sm font-black uppercase tracking-wider ${adaptivePrediction ? 'text-white' : 'text-slate-600'}`}>{t('onboarding.adaptive.label')}</div>
                <div className={`text-[10px] font-medium mt-0.5 ${adaptivePrediction ? 'text-white/70' : 'text-slate-400'}`}>
                  {adaptivePrediction ? t('onboarding.adaptive.sub_on') : t('onboarding.adaptive.sub_off')}
                </div>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${adaptivePrediction ? 'bg-white/30' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-4 h-4 shadow-sm rounded-full transition-all duration-300 ${adaptivePrediction
                ? 'ltr:translate-x-7 rtl:-translate-x-7 bg-white'
                : 'ltr:translate-x-1 rtl:-translate-x-1 bg-slate-400'
                } ltr:left-0 rtl:right-0`} />
            </div>
          </button>
        </div>
        <div className="flex-shrink-0 pt-3 space-y-3">
          <button
            onClick={nextStep}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-white bg-[#7598a0] transition-all active:scale-[0.98]"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
          >
            {t('common.continue')}
          </button>
          <button onClick={prevStep} className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('common.back')}</button>
        </div>
      </div>
    );
  };

  const renderSpycraft = () => {
    return (
      <div className="flex flex-col h-full min-h-0 py-2 px-2">
        <h2 className="flex-shrink-0 text-2xl font-black text-slate-800 tracking-tight text-center mb-1">{t('onboarding.discrete.title')}</h2>
        <p className="flex-shrink-0 text-xs text-slate-400 text-center mb-3 font-medium max-w-xs mx-auto leading-relaxed">{t('onboarding.discrete.desc')}</p>
        <div className="flex-1 min-h-0 relative mb-3">
          <div className="absolute inset-0 bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 flex-1 p-4 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">{t('onboarding.discrete.task_header')}</h3>
                <div className="text-slate-400 p-2">
                  <div className="w-5 h-5 border-2 border-slate-300 rounded" />
                </div>
              </div>
              <div className="space-y-3">
                {[24, 32, 16].map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 opacity-50">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                    <div className={`h-2 bg-slate-200 rounded-full`} style={{ width: `${w}px` }} />
                  </div>
                ))}
              </div>
              {!discreteUnlocked && !pressing && (
                <div className="absolute bottom-[80px] right-[40px] z-40 animate-bounce pointer-events-none">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#7598a0]">
                    <path d="M10 10L30 30M30 30V15M30 30H15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-6 right-6 z-30">
                <button
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={(e) => { e.preventDefault(); handlePressStart(); }}
                  onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
                  onTouchCancel={handlePressEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 relative touch-none select-none ${discreteUnlocked ? 'bg-green-500' : 'bg-[#7598a0]'} ${!discreteUnlocked && !pressing ? 'ring-4 ring-[#7598a0]/30 animate-pulse' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {discreteUnlocked ? <path d="M20 6L9 17l-5-5" /> : <path d="M12 5v14M5 12h14" />}
                  </svg>
                  {pressing && !discreteUnlocked && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="8" strokeOpacity="0.3" />
                      <circle
                        cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="8"
                        strokeDasharray="289.026"
                        strokeDashoffset={289.026 * (1 - progress / 100)}
                        style={{ transition: 'stroke-dashoffset 50ms linear' }}
                      />
                    </svg>
                  )}
                </button>
              </div>
              {!discreteUnlocked && !pressing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-6 text-center animate-fade-in z-20 pointer-events-none">
                  <div className="bg-white p-4 rounded-xl shadow-lg">
                    <p className="text-xs font-bold text-slate-800">{t('onboarding.discrete.tutorial_overlay_title')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('onboarding.discrete.tutorial_overlay_desc')}</p>
                    <div className="mt-3 text-[10px] text-[#7598a0] font-black uppercase tracking-wider">{t('onboarding.discrete.tutorial_overlay_hint')}</div>
                  </div>
                </div>
              )}
              {discreteUnlocked && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in text-center p-4 z-40">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <h3 className="text-lg font-black text-slate-800">{t('onboarding.discrete.success_title')}</h3>
                  <p className="text-xs text-slate-500 mt-1">{t('onboarding.discrete.success_desc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 space-y-3">
          <button
            onClick={nextStep}
            disabled={!discreteUnlocked}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all ${discreteUnlocked
              ? 'text-white bg-[#7598a0] active:scale-[0.98]'
              : 'text-slate-300 bg-[#F0F2F5] cursor-not-allowed grayscale opacity-50'}`}
            style={discreteUnlocked ? { boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' } : {}}
          >
            {discreteUnlocked ? t('common.continue') : t('onboarding.discrete.complete_tutorial')}
          </button>
          <div className="flex justify-between px-2">
            <button onClick={prevStep} className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('common.back')}</button>
            <button onClick={nextStep} className="text-[10px] font-bold uppercase tracking-widest text-[#7598a0]">{t('onboarding.discrete.skip_tutorial')}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderGetStarted = () => (
    <div className="flex flex-col h-full min-h-0 py-2 px-2">
      <h2 className="flex-shrink-0 text-2xl font-black text-slate-800 tracking-tight text-center mb-4">
        {t('onboarding.get_started.title')}
      </h2>
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto no-scrollbar pb-2">

        {/* Card 1: Log your period */}
        <div
          className="bg-[#F0F2F5] p-5 rounded-3xl space-y-3"
          style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.7)' }}
        >
          <p className="text-xs font-black uppercase tracking-[0.15em] text-rose-400">
            {t('onboarding.get_started.period_card_title')}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('onboarding.get_started.period_card_body')}
          </p>
          {/* Period? button replica */}
          <div className="flex justify-center pt-1">
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-400"
              style={{
                backgroundColor: '#F0F2F5',
                boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)'
              }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M12 21.5c-3.59 0-6.5-2.91-6.5-6.5 0-3.59 4-9.5 6.5-12.5 2.5 3 6.5 8.91 6.5 12.5 0 3.59-2.91 6.5-6.5 6.5z" />
              </svg>
              {t('calendar.period_question', 'Period?')}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic leading-relaxed">
            {t('onboarding.get_started.period_card_tip')}
          </p>
        </div>

        {/* Card 2: Log daily symptoms */}
        <div
          className="bg-[#F0F2F5] p-5 rounded-3xl space-y-3"
          style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.7)' }}
        >
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#7598a0]">
            {t('onboarding.get_started.daily_card_title')}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('onboarding.get_started.daily_card_body')}
          </p>
          {/* Calendar day cell replica */}
          <div className="flex justify-center pt-1">
            <div className="flex items-center gap-2">
              {[14, 15, 16].map((n, i) => (
                <div
                  key={n}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i === 1
                    ? 'bg-[#7598a0]/20 ring-2 ring-[#7598a0] text-[#5a7d87]'
                    : 'bg-white text-slate-400'}`}
                  style={i !== 1 ? { boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.3), -3px -3px 6px rgba(255, 255, 255, 0.9)' } : {}}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 pt-3">
        <button
          onClick={handleFinish}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-white bg-[#7598a0] transition-all active:scale-[0.98]"
          style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
        >
          {t('onboarding.get_started.cta')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#F0F2F5] z-[100] flex items-center justify-center p-4 selection:bg-[#7598a0]/20">
      <div
        className="w-full max-w-md bg-[#F0F2F5] rounded-[32px] overflow-hidden flex flex-col relative"
        style={{
          boxShadow: '12px 12px 24px rgba(163, 177, 198, 0.4), -12px -12px 24px rgba(255, 255, 255, 0.8)',
          height: 'min(800px, 100%)',
          maxHeight: '100%',
        }}
      >
        {step > 0 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 z-20">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${step + 1 >= i ? 'bg-[#7598a0]' : 'bg-slate-300'}`} />
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 p-4 pt-10 relative flex flex-col">
          {step === 0 && renderLanguage()}
          {step === 1 && renderTrust()}
          {step === 2 && renderCalibration()}
          {step === 3 && renderGoal()}
          {step === 4 && renderAdaptivePrediction()}
          {step === 5 && renderSpycraft()}
          {step === 6 && renderGetStarted()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;