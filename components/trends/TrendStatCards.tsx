import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../services/i18n';

interface TrendStatCardsProps {
    rangeAverages: {
        avgCycle: number | null;
        avgPeriod: number | null;
    };
}

/** Nothing measured yet prints a dash. Falling back to the length from Settings would
 *  show a setting in the same large type as a measurement, which the clinical report
 *  already refuses to do. */
const TrendStatCards: React.FC<TrendStatCardsProps> = ({ rangeAverages }) => {
    const { t } = useTranslation();

    const show = (value: number | null) => value === null ? '-' : formatNumber(value);

    return (
        <section className="grid grid-cols-2 gap-4">
            {/* Avg Cycle Length Card */}
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-[#7598a0] tracking-tighter">{show(rangeAverages.avgCycle)}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('common.days')}</span>
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 mt-4 [overflow-wrap:anywhere]">{t('trends.avg_cycle_length')}</div>
            </div>

            {/* Avg Period Duration Card */}
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-[#fb7185] tracking-tighter">{show(rangeAverages.avgPeriod)}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('common.days')}</span>
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 mt-4 [overflow-wrap:anywhere]">{t('trends.avg_period_duration')}</div>
            </div>
        </section>
    );
};

export default TrendStatCards;
