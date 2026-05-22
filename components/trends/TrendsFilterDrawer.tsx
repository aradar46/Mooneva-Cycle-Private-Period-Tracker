import React from 'react';
import { useTranslation } from 'react-i18next';
import { SymptomConfig, MOOD_OPTIONS } from '../../types';

interface TrendsFilterDrawerProps {
    showFilters: boolean;
    hasActiveFilters: boolean;
    clearFilters: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    availableSymptoms: SymptomConfig[];
    selectedSymptoms: string[];
    toggleSymptomFilter: (s: string) => void;
    selectedMoods: string[];
    toggleMoodFilter: (m: string) => void;
}

const TrendsFilterDrawer: React.FC<TrendsFilterDrawerProps> = ({
    showFilters,
    hasActiveFilters,
    clearFilters,
    searchQuery,
    setSearchQuery,
    availableSymptoms,
    selectedSymptoms,
    toggleSymptomFilter,
    selectedMoods,
    toggleMoodFilter
}) => {
    const { t } = useTranslation();

    if (!showFilters) return null;

    return (
        <section className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/40 border border-black/[0.01] animate-slide-in-right">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Refine Your View</h3>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-[9px] font-bold uppercase tracking-widest text-rose-400 bg-rose-50 px-4 py-2 rounded-full transition-all active:scale-95">Reset</button>
                )}
            </div>

            <div className="space-y-8">
                <div className="relative">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search notes or symptoms..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50/50 border border-black/[0.03] rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#7598a0]/10 transition-all placeholder:text-slate-500"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#7598a0] transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 mb-4 block">{t('trends.filter_symptoms')}</span>
                    <div className="flex flex-wrap gap-2.5">
                        {availableSymptoms.map(sym => (
                            <button
                                key={sym.id}
                                onClick={() => toggleSymptomFilter(sym.label)}
                                className={`px-4 py-2 rounded-2xl text-[11px] font-bold transition-all border ${selectedSymptoms.includes(sym.label)
                                    ? 'bg-[#7598a0] text-white border-[#7598a0] shadow-md scale-105'
                                    : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'
                                    }`}
                            >
                                {sym.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 mb-4 block">{t('trends.filter_mood')}</span>
                    <div className="flex flex-wrap gap-4">
                        {MOOD_OPTIONS.map(mood => (
                            <button
                                key={mood.id}
                                onClick={() => toggleMoodFilter(mood.id)}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all bg-white shadow-sm border ${selectedMoods.includes(mood.id)
                                    ? 'ring-2 scale-110 shadow-lg'
                                    : 'grayscale contrast-[0.8] opacity-60 hover:grayscale-0 hover:opacity-100 hover:scale-105'
                                    }`}
                                style={{
                                    backgroundColor: selectedMoods.includes(mood.id) ? mood.shadow : 'white',
                                    borderColor: selectedMoods.includes(mood.id) ? mood.dark : 'rgba(0,0,0,0.05)',
                                    ['--tw-ring-color' as any]: mood.dark,
                                    color: mood.dark
                                }}
                            >
                                <span className="text-2xl drop-shadow-sm filter">{mood.emoji}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TrendsFilterDrawer;
