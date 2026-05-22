import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../../types';
import { generateEncryptedBackup, shareOrDownloadBackup, loadData, wipeAllData, decryptBackup, saveData, generateBackup, restoreBackup, loadPeriods, savePeriods } from '../../services/logic';
import Logger from '../../services/logger';
import { toLocalISOString } from '../../utils/dateUtils';

interface DataManagementViewProps {
    settings: AppSettings;
    onUpdate: (s: AppSettings) => void;
    onBack: () => void;
}

const DataManagementView: React.FC<DataManagementViewProps> = ({ settings, onUpdate, onBack }) => {
    const { t } = useTranslation();
    const [backupPassword, setBackupPassword] = useState('');

    const [isBackupEncrypted, setIsBackupEncrypted] = useState(false);
    const [importPassword, setImportPassword] = useState('');
    const [isImportEncrypted, setIsImportEncrypted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Confirmation states
    const [showWipeConfirm, setShowWipeConfirm] = useState(false);
    const [showFinalWipeConfirm, setShowFinalWipeConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showArchiveFinalConfirm, setShowArchiveFinalConfirm] = useState(false);
    const [archiveDate, setArchiveDate] = useState(toLocalISOString(new Date()));

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        setIsProcessing(true);
        try {
            const allData = await loadData();
            const allPeriods = await loadPeriods();

            const { blob, filename } = await generateBackup(
                { data: allData, settings, timestamp: new Date().toISOString(), periods: allPeriods },
                isBackupEncrypted ? backupPassword : undefined
            );
            shareOrDownloadBackup(blob, `${filename.split('.')[0]}-${toLocalISOString(new Date())}.${filename.split('.')[1]}`);
            setBackupPassword('');
        } catch (e) {
            alert(t('errors.backup_error'));
            Logger.error("Import failed:", e);
        } finally { setIsProcessing(false); }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset password if no encryption selected
        const passwordToUse = isImportEncrypted ? importPassword : undefined;

        setIsProcessing(true);
        try {
            const restored = await restoreBackup(file, passwordToUse);
            if (restored.data && restored.settings && confirm(t('settings.import_confirm'))) {
                await saveData(restored.data);
                // Restore periods if present in backup
                if (restored.periods && restored.periods.length > 0) {
                    await savePeriods(restored.periods);
                }
                onUpdate(restored.settings);
                window.location.reload();
            } else {
                // If decryptBackup returns null or incomplete structure
                if (!restored.data) alert(t('settings.invalid_backup'));
            }
        } catch (err) { alert((err as Error).message); }
        finally { setIsProcessing(false); setImportPassword(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    return (
        <div className="h-full flex flex-col bg-[#F0F2F5] animate-slide-left">
            <div className="flex items-center gap-4 p-6 bg-[#F0F2F5] sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-slate-500"
                    style={{ boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
                >
                    <span className="text-xl rtl:rotate-180">←</span>
                </button>
                <h2 className="text-lg font-extrabold text-slate-700 tracking-tight">{t('settings.data_management_title')}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-24">
                <div className="max-w-lg mx-auto space-y-8">

                    {/* Box 1: Export/Import Combined */}
                    <div className="bg-[#F0F2F5] rounded-[24px] overflow-hidden" style={{ boxShadow: 'rgba(163, 177, 198, 0.4) 6px 6px 12px, rgba(255, 255, 255, 0.8) -6px -6px 12px' }}>
                        <div className="p-6 space-y-6">

                            {/* EXPORT SECTION */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-[#7598a0]" style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.8)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700">{t('settings.create_backup')}</h3>
                                        <p className="text-xs text-slate-400">{t('settings.save_to_file')}</p>
                                    </div>
                                </div>

                                {/* Encryption Toggle */}
                                <div className="bg-white/50 rounded-xl p-3 border border-slate-100/50">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-xs font-semibold text-slate-600">{t('settings.protect_with_password')}</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={isBackupEncrypted}
                                                onChange={(e) => setIsBackupEncrypted(e.target.checked)}
                                            />
                                            <div className={`w-10 h-6 rounded-full shadow-inner transition-colors duration-200 ${isBackupEncrypted ? 'bg-[#7598a0]' : 'bg-slate-200'}`}></div>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isBackupEncrypted
                                                ? 'ltr:translate-x-5 rtl:-translate-x-5'
                                                : 'ltr:translate-x-1 rtl:-translate-x-1'
                                                } ltr:left-0 rtl:right-0`}></div>
                                        </div>
                                    </label>

                                    {isBackupEncrypted && (
                                        <div className="mt-3 animate-fade-in">
                                            <input
                                                placeholder={t('settings.enter_password') + '...'}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#7598a0] focus:ring-1 focus:ring-[#7598a0]"
                                                type="password"
                                                value={backupPassword}
                                                onChange={(e) => setBackupPassword(e.target.value)}
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                                                {t('settings.password_warning')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleBackup}
                                    disabled={isProcessing}
                                    className="w-full py-3 bg-[#7598a0] text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-transform"
                                >
                                    {t('common.export')}
                                </button>
                            </div>

                            <div className="h-px bg-slate-200/50 w-full" />

                            {/* RESTORE SECTION */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-amber-500" style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.8)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700">{t('settings.restore_backup')}</h3>
                                        <p className="text-xs text-slate-400">{t('settings.import_from_file')}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                            checked={isImportEncrypted}
                                            onChange={(e) => setIsImportEncrypted(e.target.checked)}
                                        />
                                        <span className="text-xs font-semibold text-slate-500">{t('settings.backup_is_encrypted')}</span>
                                    </label>

                                    {isImportEncrypted && (
                                        <input
                                            placeholder={t('settings.enter_backup_password')}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                            type="password"
                                            value={importPassword}
                                            onChange={(e) => setImportPassword(e.target.value)}
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="w-full py-3 bg-[#fccfb7] text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 border border-[#fbd8c1] shadow-sm"
                                >
                                    {t('common.import')}
                                </button>

                                <input
                                    accept=".enc"
                                    className="hidden"
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImport}
                                />
                            </div>

                        </div>
                    </div>

                    {/* Box 2: Archive & Restore */}
                    <div className="bg-[#F0F2F5] rounded-[24px] overflow-hidden" style={{ boxShadow: 'rgba(163, 177, 198, 0.4) 6px 6px 12px, rgba(255, 255, 255, 0.8) -6px -6px 12px' }}>
                        <div className="p-4">
                            <p className="text-xs text-slate-500 leading-relaxed mb-4 px-2">
                                {t('settings.archive_desc_long')}
                            </p>

                            {settings.historyArchivedDate && !showArchiveConfirm && (
                                <div className="mb-3 p-3 bg-white/50 border border-indigo-100 rounded-xl flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{t('settings.archive_active')}</p>
                                        <p className="text-xs font-semibold text-slate-600">{t('settings.restricting_logs', { date: settings.historyArchivedDate })}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm(t('settings.restore_archived_confirm'))) {
                                                onUpdate({ ...settings, historyArchivedDate: undefined });
                                            }
                                        }}
                                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                        <span>{t('settings.unarchive')}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                    </button>
                                </div>
                            )}

                            {!showArchiveConfirm ? (
                                <button
                                    onClick={() => setShowArchiveConfirm(true)}
                                    className="w-full py-4 px-5 flex items-center justify-between bg-[#F0F2F5] text-slate-600 rounded-xl transition-all active:scale-[0.98] group"
                                    style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#fde68a] flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                            <span className="text-sm">📦</span>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wide group-hover:text-amber-600 transition-colors">
                                            {settings.historyArchivedDate ? t('settings.update_archive_date') : t('settings.archive_historical_data')}
                                        </span>
                                    </div>
                                    <div className="text-slate-400 group-hover:translate-x-1 transition-transform rtl:rotate-180">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </div>
                                </button>
                            ) : (
                                <div className="bg-slate-50/80 rounded-xl p-4 space-y-3 animate-fade-in border border-slate-100">
                                    <div className="text-center space-y-1">
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{t('settings.archive_older_data_q')}</p>
                                        <p className="text-[11px] text-slate-500 leading-tight max-w-[200px] mx-auto">
                                            {t('settings.archive_older_data_desc')}
                                        </p>
                                    </div>
                                    <div className="px-4">
                                        <input
                                            type="date"
                                            value={archiveDate}
                                            onChange={(e) => setArchiveDate(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#7598a0] focus:ring-1 focus:ring-[#7598a0] text-center font-bold text-slate-600"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => {
                                                onUpdate({ ...settings, historyArchivedDate: archiveDate });
                                                setShowArchiveConfirm(false);
                                                alert(t('settings.history_archived_msg'));
                                            }}
                                            className="flex-1 bg-[#7598a0] text-white py-3 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
                                        >
                                            {t('common.ok')}
                                        </button>
                                        <button
                                            onClick={() => setShowArchiveConfirm(false)}
                                            className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Box 3: Nuke */}
                    <div className="bg-[#F0F2F5] rounded-[24px] overflow-hidden" style={{ boxShadow: 'rgba(163, 177, 198, 0.4) 6px 6px 12px, rgba(255, 255, 255, 0.8) -6px -6px 12px' }}>
                        <div className="p-4">
                            {!showWipeConfirm ? (
                                <button
                                    onClick={() => setShowWipeConfirm(true)}
                                    className="w-full py-3.5 px-4 flex items-center justify-between text-rose-500 active:bg-rose-50 rounded-xl"
                                >
                                    <span className="text-sm font-bold">{t('settings.nuke_data_btn')}</span>
                                    <span className="text-lg">☢️</span>
                                </button>
                            ) : !showFinalWipeConfirm ? (
                                <div className="bg-rose-50 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-rose-600 text-center">{t('settings.wipe_confirm')}</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowFinalWipeConfirm(true)} className="flex-1 bg-white border border-rose-200 text-rose-600 py-3 rounded-xl text-xs font-bold shadow-sm">{t('settings.yes_continue')}</button>
                                        <button onClick={() => setShowWipeConfirm(false)} className="flex-1 bg-rose-100 text-rose-700 py-3 rounded-xl text-xs font-bold">{t('common.cancel')}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-rose-100 rounded-xl p-4 space-y-3 animate-fade-in border-2 border-rose-200">
                                    <p className="text-xs font-black text-rose-700 text-center uppercase tracking-wide">{t('settings.final_warning')}</p>
                                    <p className="text-[10px] text-rose-600 text-center leading-tight">{t('settings.delete_all_data_confirm')}</p>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={wipeAllData} className="flex-1 bg-rose-600 text-white py-3 rounded-xl text-xs font-black shadow-md active:scale-95">{t('settings.nuke_it')}</button>
                                        <button onClick={() => { setShowFinalWipeConfirm(false); setShowWipeConfirm(false); }} className="flex-1 bg-white border border-rose-200 text-slate-500 py-3 rounded-xl text-xs font-bold">{t('common.cancel')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default DataManagementView;
