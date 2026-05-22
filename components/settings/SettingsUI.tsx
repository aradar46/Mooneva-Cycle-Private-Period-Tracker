import React from 'react';

// 1. Neumorphic Toggle
export const Toggle = ({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-14 h-8 rounded-full relative transition-all duration-300 focus:outline-none ${active ? 'bg-[#7598a0]' : 'bg-[#E8EAED]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
            boxShadow: active
                ? 'inset 2px 2px 4px rgba(0,0,0,0.1), 0 0 8px rgba(117, 152, 160, 0.3)'
                : 'inset 3px 3px 6px rgba(163, 177, 198, 0.4), inset -3px -3px 6px rgba(255, 255, 255, 0.8)'
        }}
    >
        <div
            className={`absolute top-1 w-6 h-6 rounded-full transition-transform duration-300 ${active
                ? 'ltr:translate-x-7 rtl:-translate-x-7 bg-white'
                : 'ltr:translate-x-1 rtl:-translate-x-1 bg-[#F0F2F5]'
                } ltr:left-0 rtl:right-0`}
            style={{ boxShadow: '2px 2px 4px rgba(163, 177, 198, 0.5), -1px -1px 3px rgba(255, 255, 255, 0.8)' }}
        ></div>
    </button>
);

// 2. Neumorphic Card (title omitted from UI per design)
export const SettingCard = ({ children, title }: { children: React.ReactNode, title?: string }) => (
    <div className="space-y-3">
        <div
            className="bg-[#F0F2F5] rounded-[24px] overflow-hidden"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
        >
            {children}
        </div>
    </div>
);

// 3. Neumorphic Row
export const SettingRow = ({ label, desc, icon, children, last, onClick, tooltip, rightElement }: { label: string, desc?: React.ReactNode, icon?: React.ReactNode, children?: React.ReactNode, last?: boolean, onClick?: () => void, tooltip?: string, rightElement?: React.ReactNode }) => (
    <div
        onClick={onClick}
        title={tooltip}
        className={`py-3 px-4 ${!last ? 'border-b border-slate-200/50' : ''} ${onClick ? 'cursor-pointer active:bg-slate-100/50 transition-colors' : ''}`}
    >
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {icon && (
                    <div
                        className="w-9 h-9 shrink-0 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-slate-500"
                        style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.8)' }}
                    >
                        {icon}
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-semibold text-slate-700 truncate">{label}</span>
                    {desc && <p className="text-[12px] text-slate-400 leading-snug mt-0.5 tracking-tight">{desc}</p>}
                </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
                {children}
                {rightElement}
            </div>
        </div>
    </div>
);

