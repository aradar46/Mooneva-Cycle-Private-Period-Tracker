import React from 'react';

interface NumberSettingRowProps {
    label: string;
    description: string;
    icon: string | React.ReactNode;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    defaultValue: number;
    suffix?: string;
    isLast?: boolean;
}

const NumberSettingRow: React.FC<NumberSettingRowProps> = ({
    label,
    description,
    icon,
    value,
    onChange,
    min,
    max,
    defaultValue,
    suffix = 'days',
    isLast = false
}) => {
    const handleDecrement = () => {
        onChange(Math.max(min, value - 1));
    };

    const handleIncrement = () => {
        onChange(Math.min(max, value + 1));
    };

    return (
        <div className={`px-4 py-4 bg-slate-50 flex items-center justify-between ${!isLast ? 'border-t border-slate-100' : ''}`}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-lg border border-slate-100 shadow-sm">
                    {icon}
                </div>
                <div>
                    <span className="text-[14px] font-bold text-slate-700 block leading-tight">{label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{description}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div
                    className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm items-stretch h-[2.75rem]"
                >
                    <div className="w-10 flex flex-col items-center justify-center border-r border-slate-100">
                        <input
                            type="number"
                            min={min}
                            max={max}
                            value={value}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                    onChange(Math.min(max, Math.max(min, val)));
                                }
                            }}
                            className="w-full h-full bg-transparent border-none text-center text-[14px] font-bold text-slate-700 focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>

                    <div className="flex flex-col w-9">
                        <button
                            onClick={handleIncrement}
                            disabled={value >= max}
                            className="flex-1 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors border-b border-slate-100"
                            aria-label="Increase value"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="m18 15-6-6-6 6" /></svg>
                        </button>
                        <button
                            onClick={handleDecrement}
                            disabled={value <= min}
                            className="flex-1 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease value"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                    </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 min-w-[32px] lowercase">{suffix}</span>
            </div>
        </div>
    );
};

export default NumberSettingRow;
