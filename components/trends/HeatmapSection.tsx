import React from 'react';
import { useTranslation } from 'react-i18next';

interface HeatmapConfig {
    blob?: string;
    color?: string;
    secondary?: string;
    wash?: string;
}

// The legend bar spans the same colours the cells use: steps[1] (one hit) to the
// last step, so the swatch never looks lighter than the grid it explains.
const COLOR_SCALES = {
    indigo: {
        steps: ['#f1f5f9', '#dbe3ff', '#bcc9fe', '#94a5fc', '#6d7cf8', '#5257ef', '#4438e0', '#3a24c4', '#2f1a9c'],
    },
    orange: {
        steps: ['#f1f5f9', '#ffe6c7', '#ffcd99', '#ffae63', '#fd8d2e', '#f4700a', '#dd5602', '#bd3f02', '#992e05'],
    },
    teal: {
        steps: ['#f1f5f9', '#c2fbef', '#8bf5e2', '#45e8cd', '#12d4b4', '#03b89b', '#009a82', '#00806e', '#00655a'],
    },
};

type ColorScaleName = keyof typeof COLOR_SCALES;

/** Flat grey for a column too few cycles reached, so "no answer" never looks like "never
 *  happened". Deliberately off the colour scales above. */
const THIN_COLUMN_COLOR = '#e2e8f0';

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
    /** How many counted cycles reached each cycle day. Cells are a share of this, not a
     *  raw count, so a 1 year range reads like a 3 month one and the late columns stop
     *  looking empty when they were only rarer. */
    opportunities: Record<number, number>;
    /** Columns reached by fewer cycles than this are drawn flat, not coloured. */
    minOpportunities: number;
    /** How many cycle-day columns to draw: the longest cycle in range, capped by the
     *  caller. Fixed at 31, the axis cut a 38-day cycle short and gave a 26-day one columns
     *  that could never hold anything. */
    dayCount: number;
}

/** Zero is the empty step; anything else lands in steps 1 to 8 by share. */
const stepForShare = (share: number, steps: string[]): string => {
    if (share <= 0) return steps[0];
    return steps[Math.min(steps.length - 1, Math.max(1, Math.ceil(share * (steps.length - 1))))];
};

const HeatmapSection: React.FC<HeatmapSectionProps> = ({
    title,
    lowLabel = 'Low',
    highLabel = 'High',
    gradientFrom,
    gradientTo,
    colorScale = 'indigo',
    rows,
    opportunities,
    minOpportunities,
    dayCount
}) => {
    const { t, i18n } = useTranslation();
    const scale = COLOR_SCALES[colorScale];
    const days = Array.from({ length: dayCount }, (_, i) => i + 1);
    const CELL_WIDTH = 18;
    const isRtl = i18n.dir?.() === 'rtl';
    const labelAlignClass = isRtl ? 'pl-2 text-left' : 'pr-2 text-right';

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
                        <span className="heatmap-scale-label text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">{lowLabel}</span>
                        <div
                            className="w-16 h-2 rounded-full overflow-hidden"
                            style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.7)' }}
                        >
                            <div
                                className="h-full w-full"
                                style={{
                                    background: `linear-gradient(to ${isRtl ? 'left' : 'right'}, ${scale.steps[1]}, ${scale.steps[scale.steps.length - 1]})`,
                                }}
                            />
                        </div>
                        <span className="heatmap-scale-label text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">{highLabel}</span>
                    </div>
                </div>
            </div>

            {/* The labels are their own column, outside the scroll box. They used to be
                sticky inside it, so the cells slid underneath them and every seam let a
                sliver show through: the scrollport's padding, the gaps between rows, then a
                fractional scroll offset. Nothing can slide under a column that is not in
                the scroll box, so the whole class of bug is gone rather than patched.
                The two columns line up because both use the same band heights. */}
            <div className="flex">
                <div className="w-20 shrink-0">
                    <div className="h-4 mb-1" />
                    {rows.map((row) => (
                        <div
                            key={row.id}
                            className={`heatmap-row-label h-[22px] leading-[22px] ${labelAlignClass} text-[9.5px] font-bold text-slate-700 truncate capitalize`}
                        >
                            {t(`symptom.${row.label.toLowerCase()}`, row.label)}
                        </div>
                    ))}
                </div>

                <div className="overflow-x-auto no-scrollbar flex-1">
                    <div style={{ minWidth: `${dayCount * CELL_WIDTH}px` }}>
                        {/* Day Header */}
                        <div className="flex h-4 mb-1">
                            {days.map(day => (
                                <div
                                    key={day}
                                    className="heatmap-day-label flex-1 text-center text-[9px] leading-4 font-extrabold text-slate-500"
                                    style={{ minWidth: `${CELL_WIDTH}px` }}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Grid Rows - Smooth heat gradient */}
                        {rows.map((row) => (
                            <div key={row.id} className="flex h-[22px]">
                                {days.map((day) => {
                                    const count = row.data[day] || 0;
                                    const reached = opportunities[day] || 0;
                                    // Too few cycles ever got this far to say anything: one
                                    // cycle reaching day 33 would otherwise paint 100% off a
                                    // single log.
                                    const thin = reached < minOpportunities || reached === 0;

                                    const bgColor = thin
                                        ? THIN_COLUMN_COLOR
                                        : stepForShare(count / reached, scale.steps);

                                    return (
                                        <div
                                            key={day}
                                            className="flex-1 flex items-center justify-center px-px"
                                            style={{ minWidth: `${CELL_WIDTH}px` }}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-sm transition-colors duration-200"
                                                style={{ backgroundColor: bgColor }}
                                                title={thin
                                                    ? `Day ${day}: not enough cycles`
                                                    : `Day ${day}: ${count} of ${reached} cycles`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </section>
    );
};

export default HeatmapSection;
