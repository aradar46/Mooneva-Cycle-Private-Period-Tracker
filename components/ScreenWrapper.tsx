import React from 'react';

export const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#F0F2F5] transition-colors duration-500 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),0px)]">
        {children}
    </div>
);
