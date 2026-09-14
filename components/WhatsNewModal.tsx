import React from 'react';
import { Trans } from 'react-i18next';

interface WhatsNewModalProps {
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 sm:p-5" role="presentation">
      <div
        dir="ltr"
        lang="en"
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <h2 id="whats-new-title" className="text-xl font-bold text-slate-800">
          What's new
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Since the last release:
        </p>
        {/* Release notes are intentionally English-only and hard-coded -- see RELEASE.md.
            Replace this list every release; do not add these strings to the locale files. */}
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs sm:text-sm leading-relaxed text-slate-600">
          <li><strong>Automatic encrypted backups.</strong> Pick a folder once in Settings and the app backs itself up, or tap the new button on the calendar to back up now.</li>
          <li><strong>Log a pregnancy.</strong> Open the day it started, tap Advanced. The calendar marks the whole span and it ends by itself when your period returns.</li>
          <li><strong>Kid Mode.</strong> Hides the Sex &amp; Libido sections everywhere, including the exported report. In Settings.</li>
          <li><strong>Jump to any month</strong> by tapping the month name.</li>
          <li><strong>Persian text and trend charts fixed.</strong></li>
        </ul>

        <p dir="auto" className="mt-5 rounded-2xl bg-[#F0F4F6] px-4 py-3.5 text-center text-xs sm:text-sm leading-relaxed text-slate-600">
          <Trans
            i18nKey="whats_new.tip"
            components={{ b: <strong className="font-bold text-[#557880]" /> }}
          />
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#7598a0] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#63858d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7598a0] focus-visible:ring-offset-2"
        >
          Close
        </button>
      </div>
    </div>
  );
};
