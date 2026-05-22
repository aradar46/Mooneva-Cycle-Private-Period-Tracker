import { Cycle } from '../../types';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../services/i18n';

// Mock data for testing - remove or ignore in production
export const MOCK_CYCLES: Cycle[] = [
    { startDate: '2025-08-05', length: 28, periodLength: 5 },
    { startDate: '2025-09-02', length: 30, periodLength: 6 },
    { startDate: '2025-10-02', length: 27, periodLength: 5 },
    { startDate: '2025-11-01', length: 29, periodLength: 5 },
    { startDate: '2025-12-01', length: 35, periodLength: 6 }, // Irregular
    { startDate: '2026-01-05', length: 28, periodLength: 5 },
];

interface CycleHistoryChartProps {
    cycles: Cycle[];
}

const CycleHistoryChart: React.FC<CycleHistoryChartProps> = ({ cycles }) => {
    const { t, i18n } = useTranslation();

    // Get last 6 cycles, sorted oldest to newest
    const recentCycles = [...cycles]
        .filter(c => c.length && c.length >= 21 && c.length <= 60)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(-6);

    if (recentCycles.length < 2) {
        return (
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{t('trends.cycle_regularity')}</h3>
                <p className="text-slate-400 text-sm text-center py-8">{t('trends.need_data_chart')}</p>
            </div>
        );
    }

    // Calculate average
    const lengths = recentCycles.map(c => c.length || 28);
    const average = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

    // Dynamic Y-axis scale
    const minVal = Math.min(...lengths);
    const maxVal = Math.max(...lengths);
    const yMin = Math.max(18, Math.floor((minVal - 2) / 5) * 5); // Start near min, rounded down to 5
    const yMax = Math.ceil((maxVal + 2) / 5) * 5; // End above max, rounded up to 5
    const yRange = yMax - yMin;

    // Chart dimensions
    const chartHeight = 160;
    const barWidth = 32;
    const barGap = 16;
    const chartWidth = recentCycles.length * (barWidth + barGap) - barGap;

    // Get bar color based on deviation from average
    const getBarColor = (length: number) => {
        const diff = Math.abs(length - average);
        if (diff <= 2) return 'rgb(45, 212, 191)'; // Teal - regular
        if (diff <= 5) return 'rgb(251, 191, 36)'; // Amber - slightly irregular
        return 'rgb(251, 113, 133)'; // Rose - irregular
    };

    // Format month label
    const getMonthLabel = (dateStr: string) => {
        const [y, m] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        return date.toLocaleDateString(i18n.language, { month: 'short' });
    };

    // Calculate average line position
    const avgLineY = chartHeight - ((average - yMin) / yRange) * chartHeight;

    return (
        <div
            className="bg-[#F0F2F5] rounded-[32px] p-6"
            style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
        >
            <div className="flex flex-col gap-1 mb-6">
                <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{t('trends.cycle_regularity')}</h3>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-slate-400" style={{ borderTop: '1px dashed #94a3b8' }}></span>
                    <span className="text-xs font-medium text-slate-400">{t('trends.average_label', { count: average })}</span>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-2">
                <svg
                    width={chartWidth + 40}
                    height={chartHeight + 40}
                    className="mx-auto"
                    viewBox={`0 0 ${chartWidth + 40} ${chartHeight + 40}`}
                >
                    {/* Y-axis labels */}
                    <text x="0" y="15" className="fill-slate-400 text-[10px] font-medium">{formatNumber(yMax)}{t('common.days_short', 'd')}</text>
                    <text x="0" y={chartHeight + 5} className="fill-slate-400 text-[10px] font-medium">{formatNumber(yMin)}{t('common.days_short', 'd')}</text>

                    {/* Average line (dashed) */}
                    <line
                        x1="30"
                        y1={avgLineY + 10}
                        x2={chartWidth + 35}
                        y2={avgLineY + 10}
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                    />

                    {/* Bars */}
                    {recentCycles.map((cycle, idx) => {
                        const length = cycle.length || 28;
                        const barHeight = ((length - yMin) / yRange) * chartHeight;
                        const x = 35 + idx * (barWidth + barGap);
                        const y = chartHeight - barHeight + 10;

                        return (
                            <g key={cycle.startDate}>
                                {/* Bar */}
                                <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    rx="6"
                                    ry="6"
                                    fill={getBarColor(length)}
                                    className="transition-all duration-300"
                                />
                                {/* Value label */}
                                <text
                                    x={x + barWidth / 2}
                                    y={y - 6}
                                    textAnchor="middle"
                                    className="fill-slate-600 text-[10px] font-bold"
                                >
                                    {formatNumber(length)}
                                </text>
                                {/* Month label */}
                                <text
                                    x={x + barWidth / 2}
                                    y={chartHeight + 28}
                                    textAnchor="middle"
                                    className="fill-slate-400 text-[9px] font-medium uppercase"
                                >
                                    {getMonthLabel(cycle.startDate)}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-teal-400"></div>
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">{t('trends.regular')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-400"></div>
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">{t('trends.varying')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-rose-400"></div>
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">{t('trends.irregular')}</span>
                </div>
            </div>
        </div>
    );
};

export default CycleHistoryChart;
