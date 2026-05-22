import React from 'react';
import { useTranslation } from 'react-i18next';

import { CycleStatusData } from '../services/logic/status';

interface HeaderProps {
  isCloaked: boolean;
  cycleStatus: CycleStatusData;
  taskCount?: number;
  onNotificationsClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isCloaked, cycleStatus, taskCount = 0, onNotificationsClick }) => {
  const { t } = useTranslation();

  return (
    <header
      dir="ltr"
      className={`relative z-50 px-6 pt-3 pb-1.5 flex justify-between items-start shrink-0 w-full transition-all duration-500 overflow-visible ${isCloaked ? 'bg-slate-900 border-b border-white/10' : 'bg-[#F0F2F5]'}`}
    >
      {/* Main Content Area */}
      <div className={`min-w-0 flex-1 relative z-10 flex items-center justify-between gap-2`}>
        {!isCloaked ? (
          <>
            <div className="flex items-center flex-shrink-0">
              <img src="/bitmap.png" alt="Mooneva" className="h-8 w-auto object-contain drop-shadow-xl" />
            </div>
            <div className="flex-1 min-w-0 flex justify-end">
              <button
                type="button"
                onClick={onNotificationsClick}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-xl transition-colors"
                style={{
                  backgroundColor: '#F0F2F5',
                  boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)'
                }}
                aria-label={t('common.notifications', 'Notifications')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="animate-fade-in px-2">
            <h1 className="text-xl font-black text-white tracking-tight">{t('discrete.title')}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-60" />
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-wider opacity-60">{t('discrete.subtitle', { count: taskCount })}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;