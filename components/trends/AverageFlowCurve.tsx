import React, { useMemo } from 'react';
import { DailyLog, PeriodRecord } from '../../types';
import { useTranslation } from 'react-i18next';
import { addDays } from '../../utils/dateUtils';

// Mock data for testing - remove or ignore in production
export const MOCK_PERIODS: PeriodRecord[] = [
    { id: '1', startDate: '2025-11-01', days: 5 },
    { id: '2', startDate: '2025-12-01', days: 6 },
    { id: '3', startDate: '2026-01-05', days: 5 },
];

export const MOCK_LOGS: Record<string, DailyLog> = {
    // Period 1 (Nov)
    '2025-11-01': { date: '2025-11-01', flow: 'heavy', symptoms: [], notes: '' },
    '2025-11-02': { date: '2025-11-02', flow: 'heavy', symptoms: [], notes: '' },
    '2025-11-03': { date: '2025-11-03', flow: 'medium', symptoms: [], notes: '' },
    '2025-11-04': { date: '2025-11-04', flow: 'light', symptoms: [], notes: '' },
    '2025-11-05': { date: '2025-11-05', flow: 'spotting', symptoms: [], notes: '' },
    // Period 2 (Dec)
    '2025-12-01': { date: '2025-12-01', flow: 'medium', symptoms: [], notes: '' },
    '2025-12-02': { date: '2025-12-02', flow: 'heavy', symptoms: [], notes: '' },
    '2025-12-03': { date: '2025-12-03', flow: 'heavy', symptoms: [], notes: '' },
    '2025-12-04': { date: '2025-12-04', flow: 'medium', symptoms: [], notes: '' },
    '2025-12-05': { date: '2025-12-05', flow: 'light', symptoms: [], notes: '' },
    '2025-12-06': { date: '2025-12-06', flow: 'spotting', symptoms: [], notes: '' },
    // Period 3 (Jan)
    '2026-01-05': { date: '2026-01-05', flow: 'heavy', symptoms: [], notes: '' },
    '2026-01-06': { date: '2026-01-06', flow: 'heavy', symptoms: [], notes: '' },
    '2026-01-07': { date: '2026-01-07', flow: 'medium', symptoms: [], notes: '' },
    '2026-01-08': { date: '2026-01-08', flow: 'light', symptoms: [], notes: '' },
    '2026-01-09': { date: '2026-01-09', flow: 'spotting', symptoms: [], notes: '' },
};

interface AverageFlowCurveProps {
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
}

// Map flow intensity to numeric value
const flowToValue = (flow: string | null | undefined): number => {
    switch (flow) {
        case 'heavy': return 4;
        case 'medium': return 3;
        case 'light': return 2;
        case 'spotting': return 1;
        default: return 0;
    }
};

const AverageFlowCurve: React.FC<AverageFlowCurveProps> = ({ logs, periods }) => {
    const { t } = useTranslation();
    // Get last 3 completed periods
    const recentPeriods = useMemo(() => {
        return [...periods]
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .slice(0, 3);
    }, [periods]);

    // Calculate average intensity per day across periods
    const curveData = useMemo(() => {
        if (recentPeriods.length === 0) return [];

        const maxDays = Math.max(...recentPeriods.map(p => p.days), 7);
        const dayAverages: { day: number; avg: number; count: number }[] = [];

        for (let dayIdx = 0; dayIdx < maxDays; dayIdx++) {
            let sum = 0;
            let count = 0;

            recentPeriods.forEach(period => {
                const dateStr = addDays(period.startDate, dayIdx);
                const log = logs[dateStr];
                if (log?.flow) {
                    sum += flowToValue(log.flow);
                    count++;
                }
            });

            if (count > 0) {
                dayAverages.push({ day: dayIdx + 1, avg: sum / count, count });
            }
        }

        return dayAverages;
    }, [logs, recentPeriods]);

    if (curveData.length < 2) {
        return (
            <div
                className="bg-[#F0F2F5] rounded-[32px] p-6"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
                <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{t('trends.flow_pattern')}</h3>
                <p className="text-slate-400 text-sm text-center py-8">{t('trends.need_data_flow')}</p>
            </div>
        );
    }

    // Chart dimensions
    const chartWidth = 280;
    const chartHeight = 120;
    const padding = { top: 20, right: 15, bottom: 30, left: 45 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Scale functions
    const xScale = (day: number) => padding.left + ((day - 1) / (curveData.length - 1)) * innerWidth;
    const yScale = (val: number) => padding.top + innerHeight - (val / 4) * innerHeight;

    // Find peak day
    const peakIdx = curveData.reduce((maxIdx, curr, idx, arr) =>
        curr.avg > arr[maxIdx].avg ? idx : maxIdx, 0);

    // Generate smooth bezier curve path
    const generatePath = () => {
        if (curveData.length < 2) return '';

        const points = curveData.map(d => ({ x: xScale(d.day), y: yScale(d.avg) }));

        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const ctrl1x = prev.x + (curr.x - prev.x) / 3;
            const ctrl2x = prev.x + 2 * (curr.x - prev.x) / 3;
            path += ` C ${ctrl1x} ${prev.y}, ${ctrl2x} ${curr.y}, ${curr.x} ${curr.y}`;
        }

        return path;
    };

    // Generate area path (closed)
    const generateAreaPath = () => {
        const linePath = generatePath();
        if (!linePath) return '';

        const lastPoint = curveData[curveData.length - 1];
        const firstPoint = curveData[0];
        const bottom = padding.top + innerHeight;

        return `${linePath} L ${xScale(lastPoint.day)} ${bottom} L ${xScale(firstPoint.day)} ${bottom} Z`;
    };

    const linePath = generatePath();
    const areaPath = generateAreaPath();

    return (
        <div
            className="bg-[#F0F2F5] rounded-[32px] p-6"
            style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
        >
            <div className="flex flex-col gap-1 mb-4">
                <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{t('trends.flow_pattern')}</h3>
                <span className="text-xs font-medium text-slate-400">{t('trends.last_3_periods_avg')}</span>
            </div>

            <div className="relative">
                {/* Vertical Y-axis labels */}
                <div
                    className="absolute left-0 flex flex-col justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tighter"
                    style={{
                        top: `${padding.top}px`,
                        height: `${innerHeight}px`,
                        width: '40px'
                    }}
                >
                    <span className="leading-tight">{t('trends.heavier')}</span>
                    <span className="leading-tight">{t('trends.lighter')}</span>
                </div>

                <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
                    {/* Gradient definition */}
                    <defs>
                        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgb(251, 113, 133)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="rgb(251, 113, 133)" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <path d={areaPath} fill="url(#flowGradient)" />

                    {/* Line */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke="rgb(251, 113, 133)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Peak dot */}
                    {curveData[peakIdx] && (
                        <>
                            <circle
                                cx={xScale(curveData[peakIdx].day)}
                                cy={yScale(curveData[peakIdx].avg)}
                                r="6"
                                fill="white"
                                stroke="rgb(225, 29, 72)"
                                strokeWidth="2"
                            />
                            <circle
                                cx={xScale(curveData[peakIdx].day)}
                                cy={yScale(curveData[peakIdx].avg)}
                                r="3"
                                fill="rgb(225, 29, 72)"
                            />
                        </>
                    )}

                    {/* X-axis labels */}
                    {curveData.map((d, idx) => (
                        <text
                            key={d.day}
                            x={xScale(d.day)}
                            y={chartHeight - 5}
                            textAnchor="middle"
                            className="fill-slate-400 text-[9px] font-medium"
                        >
                            {d.day}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default AverageFlowCurve;
