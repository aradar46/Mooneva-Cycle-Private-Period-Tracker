import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../../types';
import { generateEncryptedBackup, shareOrDownloadBackup, loadData, wipeAllData, decryptBackup, saveData, savePeriods } from '../../services/logic';
import { toLocalISOString } from '../../utils/dateUtils';
import { SettingCard } from './SettingsUI';

interface BackupSectionProps {
    settings: AppSettings;
    onUpdate: (s: AppSettings) => void;
}

const BackupSection: React.FC<BackupSectionProps> = ({ settings, onUpdate }) => {
    const { t } = useTranslation();
    const [backupPassword, setBackupPassword] = useState('');
    const [importPassword, setImportPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showWipeConfirm, setShowWipeConfirm] = useState(false);
    const [showFinalWipeConfirm, setShowFinalWipeConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showArchiveFinalConfirm, setShowArchiveFinalConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        if (!backupPassword) return alert(t('errors.backup_password'));
        setIsProcessing(true);
        try {
            const allData = await loadData();
            const blob = await generateEncryptedBackup({ data: allData, settings, timestamp: new Date().toISOString() }, backupPassword);
            shareOrDownloadBackup(blob, `mooneva-backup-${toLocalISOString(new Date())}.enc`);
            setBackupPassword('');
        } catch (e) {
            alert(t('errors.backup_error'));
        } finally { setIsProcessing(false); }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !importPassword) return alert(t('errors.import_password'));
        setIsProcessing(true);
        try {
            const restored = await decryptBackup(file, importPassword);
            if (restored.data && restored.settings && confirm(t('settings.import_confirm'))) {
                saveData(restored.data);
                onUpdate(restored.settings);
                window.location.reload();
            } else alert(t('settings.invalid_backup'));
        } catch (err) { alert((err as Error).message); }
        finally { setIsProcessing(false); setImportPassword(''); }
    };

    return (
        <SettingCard title="Data Management">
            <p className="px-4 pt-4 pb-1 text-sm text-slate-500 leading-relaxed">
                You can export and restore your backup. If you set a key, the backup is encrypted and you can restore it only with that key. If you leave the key empty, there is no encryption.
            </p>
            <div className="p-4 grid grid-cols-2 gap-3">
                {/* Export */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export</span>
                    </div>
                    <input
                        type="password"
                        placeholder="Key"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#7598a0]"
                    />
                    <button onClick={handleBackup} disabled={isProcessing} className="w-full py-2 bg-[rgba(117,152,160,1)] text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform">
                        Export
                    </button>
                </div>

                {/* Import */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Restore</span>
                    </div>
                    <input
                        type="password"
                        placeholder="Key"
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400"
                    />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full py-2 bg-[#fccfb7] text-[rgba(250,252,255,1)] rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform hover:bg-[#fbc1a2]">
                        Import
                    </button>
                    <input type="file" accept=".enc" ref={fileInputRef} className="hidden" onChange={handleImport} />
                </div>
            </div>



            {/* Archive & Wipe */}
            <div className="border-t border-slate-100 divide-y divide-slate-100">
                <div className="p-4 pt-3 pb-1">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Focus on the now. Securely archive past logs so your trends reflect your current health, not your history from years ago.
                        Archived data is never deleted. It is included in your backups and can be restored or exported for your doctor at any time.
                    </p>
                </div>
                {!showArchiveConfirm ? (
                    <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="w-full py-3.5 px-4 flex items-center justify-between text-[#7598a0] active:bg-slate-50"
                    >
                        <span className="text-sm font-semibold">Archive Historical Data</span>
                        <span className="text-lg">📦</span>
                    </button>
                ) : !showArchiveFinalConfirm ? (
                    <div className="p-4 bg-slate-50 space-y-3 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-600 text-center">Archive historical data? Predictions will focus on recent cycles only.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowArchiveFinalConfirm(true)} className="flex-1 bg-[#7598a0] text-white py-3 rounded-xl text-xs font-bold shadow-sm active:scale-95">Yes, continue</button>
                            <button onClick={() => setShowArchiveConfirm(false)} className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl text-xs font-bold">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-100 space-y-3 border-t border-slate-200 animate-fade-in">
                        <p className="text-xs font-black text-slate-700 text-center uppercase tracking-wide">Second confirmation</p>
                        <p className="text-sm text-slate-600 text-center leading-tight">This will set today as the archive date. Older data will no longer appear in the main timeline. You can restore from backup if needed.</p>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => {
                                    onUpdate({ ...settings, historyArchivedDate: toLocalISOString(new Date()) });
                                    setShowArchiveFinalConfirm(false);
                                    setShowArchiveConfirm(false);
                                }}
                                className="flex-1 bg-[#7598a0] text-white py-3 rounded-xl text-xs font-bold shadow-md active:scale-95"
                            >
                                Archive
                            </button>
                            <button onClick={() => { setShowArchiveFinalConfirm(false); setShowArchiveConfirm(false); }} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl text-xs font-bold">Cancel</button>
                        </div>
                    </div>
                )}

                {!showWipeConfirm ? (
                    <button
                        onClick={() => setShowWipeConfirm(true)}
                        className="w-full py-3.5 px-4 flex items-center justify-between text-rose-500 active:bg-rose-50"
                    >
                        <span className="text-sm font-bold">Nuke the Data!</span>
                        <span className="text-lg">☢️</span>
                    </button>
                ) : !showFinalWipeConfirm ? (
                    <div className="p-4 bg-rose-50 space-y-3">
                        <p className="text-xs font-bold text-rose-600 text-center">Are you sure?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowFinalWipeConfirm(true)} className="flex-1 bg-white border border-rose-200 text-rose-600 py-3 rounded-xl text-xs font-bold shadow-sm">Yes, continue</button>
                            <button onClick={() => setShowWipeConfirm(false)} className="flex-1 bg-rose-100 text-rose-700 py-3 rounded-xl text-xs font-bold">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-rose-100 space-y-3 animate-fade-in border-2 border-rose-200 rounded-xl m-2">
                        <p className="text-xs font-black text-rose-700 text-center uppercase tracking-wide">⚠️ Final Warning ⚠️</p>
                        <p className="text-[10px] text-rose-600 text-center leading-tight">This will permanently delete all your data. There is no going back.</p>
                        <div className="flex gap-2 pt-1">
                            <button onClick={wipeAllData} className="flex-1 bg-rose-600 text-white py-3 rounded-xl text-xs font-black shadow-md active:scale-95">NUKE IT 💥</button>
                            <button onClick={() => { setShowFinalWipeConfirm(false); setShowWipeConfirm(false); }} className="flex-1 bg-white border border-rose-200 text-slate-500 py-3 rounded-xl text-xs font-bold">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </SettingCard>
    );
};

export default BackupSection;
