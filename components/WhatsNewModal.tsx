import React from 'react';
import { useTranslation } from 'react-i18next';

interface WhatsNewModalProps {
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-5" role="presentation">
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <h2 id="whats-new-title" className="text-xl font-bold text-slate-800">
          {t('whats_new.title', "What's new")}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t('whats_new.intro', 'Since the last release:')}
        </p>
        {/* Release notes are intentionally English-only and hard-coded -- see RELEASE.md.
            Replace this list every release; do not add these strings to the locale files. */}
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
          <li>Added Hungarian, Russian and Portuguese — now in 12 languages.</li>
          <li>The app opens faster and uses less memory.</li>
          <li>Also in Mooneva: contraception reminders for the pill, patch, ring, injection, IUD and implant.</li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-[#7598a0] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#63858d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7598a0] focus-visible:ring-offset-2"
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    </div>
  );
};
