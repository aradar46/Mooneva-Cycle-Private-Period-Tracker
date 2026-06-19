import React from 'react';
import { useTranslation } from 'react-i18next';

interface HeatmapConfig {
    blob?: string;
    color?: string;
    secondary?: string;
    wash?: string;
}

const COLOR_SCALES = {
    indigo: {
        gradient: ['#e0e7ff', '#6366f1'],
        steps: ['#f1f5f9', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'],
    },
    orange: {
        gradient: ['#ffedd5', '#f97316'],
        steps: ['#f1f5f9', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'],
    },
};

type ColorScaleName = keyof typeof COLOR_SCALES;

interface HeatmapSectionProps {
    title: string;
    lowLabel?: string;
    highLabel?: string;
    gradientFrom: string;
    gradientTo: string;
    colorScale?: ColorScaleName;
    rows: {
        id: string;
        label: string;
        data: Record<number, number>;
        config?: HeatmapConfig;
    }[];
    maxValue: number;
}

const HeatmapSection: React.FC<HeatmapSectionProps> = ({
    title,
    lowLabel = 'Low',
    highLabel = 'High',
    gradientFrom,
    gradientTo,
    colorScale = 'indigo',
    rows,
    maxValue
}) => {
    const { t, i18n } = useTranslation();
    const scale = COLOR_SCALES[colorScale];
    const isRtl = i18n.dir?.() === 'rtl';
    const stickyHeaderClass = isRtl
        ? 'sticky right-0 pl-2 text-left'
        : 'sticky left-0 pr-2 text-right';
    const stickyShadowClass = isRtl
        ? 'shadow-[-4px_0_8px_rgba(240,242,245,0.95)]'
        : 'shadow-[4px_0_8px_rgba(240,242,245,0.95)]';

    return (
        <section
            className="bg-[#F0F2F5] rounded-[32px] p-6"
            style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
        >
            {/* Header - stacked like MoodByPhase */}
            <div className="flex flex-col gap-1 mb-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{title}</h3>
                    <div className="flex gap-2 items-center">
                        <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">{lowLabel}</span>
                        <div
                            className="w-16 h-2 rounded-full overflow-hidden"
                            style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.7)' }}
                        >
                            <div
                                className="h-full w-full"
                                style={{ background: `linear-gradient(to right, ${scale.gradient[0]}, ${scale.gradient[1]})` }}
                            />
                        </div>
                        <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">{highLabel}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto no-scrollbar relative z-10 -mx-2 px-2">
                <div className="min-w-[700px]">
                    {/* Day Header */}
                    <div className="flex mb-1">
                        <div className={`w-20 shrink-0 ${stickyHeaderClass} z-30 bg-[#F0F2F5]`} />
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <div
                                key={day}
                                className="flex-1 text-center text-[9px] font-bold text-slate-400"
                                style={{ minWidth: '18px' }}
                            >
                                {day === 31 ? '31+' : day}
                            </div>
                        ))}
                    </div>

                    {/* Grid Rows - Smooth heat gradient */}
                    {rows.map((row) => (
                        <div key={row.id} className="flex items-center h-5 mb-0.5">
                            <div
                                className={`w-20 shrink-0 ${stickyHeaderClass} ${stickyShadowClass} z-20 bg-[#F0F2F5] text-[9px] font-semibold text-slate-500 truncate capitalize`}
                            >
                                {t(`symptom.${row.label.toLowerCase()}`, row.label)}
                            </div>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                const count = row.data[day] || 0;

                                // Use logarithmic scale for better color distribution
                                // Even a count of 1 should show visible color
                                const s = scale.steps;
                                let bgColor: string;
                                if (count === 0) {
                                    bgColor = s[0];
                                } else if (count === 1) {
                                    bgColor = s[1];
                                } else if (count === 2) {
                                    bgColor = s[2];
                                } else if (count === 3) {
                                    bgColor = s[3];
                                } else if (count === 4) {
                                    bgColor = s[4];
                                } else if (count === 5) {
                                    bgColor = s[5];
                                } else if (count <= 7) {
                                    bgColor = s[6];
                                } else if (count <= 10) {
                                    bgColor = s[7];
                                } else {
                                    bgColor = s[8];
                                }

                                return (
                                    <div
                                        key={day}
                                        className="flex-1 flex items-center justify-center px-px"
                                        style={{ minWidth: '18px' }}
                                    >
                                        <div
                                            className="w-4 h-4 rounded-sm transition-colors duration-200"
                                            style={{ backgroundColor: bgColor }}
                                            title={count > 0 ? `Day ${day}: ${count}x` : `Day ${day}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HeatmapSection;
