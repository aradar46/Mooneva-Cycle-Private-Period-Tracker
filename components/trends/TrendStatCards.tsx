import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../services/i18n';

interface TrendStatCardsProps {
    rangeAverages: {
        avgCycle: number | null;
        avgPeriod: number | null;
    };
    defaultCycleLength: number;
    defaultPeriodLength: number;
}

const TrendStatCards: React.FC<TrendStatCardsProps> = ({ rangeAverages, defaultCycleLength, defaultPeriodLength }) => {
    const { t } = useTranslation();

    return (
        <section className="grid grid-cols-2 gap-4">
            {/* Avg Cycle Length Card */}
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-[#7598a0] tracking-tighter">{formatNumber(rangeAverages.avgCycle ?? defaultCycleLength)}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('common.days')}</span>
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 mt-4">{t('trends.avg_cycle_length')}</div>
            </div>

            {/* Avg Period Duration Card */}
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-[#fb7185] tracking-tighter">{formatNumber(rangeAverages.avgPeriod ?? defaultPeriodLength)}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('common.days')}</span>
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 mt-4">{t('trends.avg_period_duration')}</div>
            </div>
        </section>
    );
};

export default TrendStatCards;
