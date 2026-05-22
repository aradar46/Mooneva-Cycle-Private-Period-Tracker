
import React from 'react';
import { ScreenWrapper } from '../ScreenWrapper';
import Settings from '../Settings';
import BottomNav from '../BottomNav';
import { useMooneva } from '../../contexts/MoonevaContext';
import { SubViewType, ViewType } from '../../hooks/useAppNavigation';

interface SettingsScreenProps {
    subView: SubViewType;
    setSubView: (view: SubViewType) => void;
    setView: (view: ViewType) => void;
    isCloaked: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
    subView,
    setSubView,
    setView,
    isCloaked
}) => {
    const { settings, actions, periods } = useMooneva();
    const { updateSettings, updatePeriodWithdrawalBleed } = actions;

    return (
        <ScreenWrapper>
            <div className="flex-1 flex flex-col overflow-hidden bg-[#fcfaf6]">
                <Settings
                    settings={settings}
                    onUpdate={updateSettings}
                    subView={subView}
                    onSubViewChange={setSubView}
                    periods={periods}
                    onUpdatePeriodWithdrawalBleed={updatePeriodWithdrawalBleed}
                    onViewChange={setView}
                    onClose={() => {
                        setSubView('main');
                        setView('calendar');
                    }}
                />
            </div>

            <BottomNav
                currentView="settings"
                onViewChange={(v) => {
                    setSubView('main');
                    setView(v);
                }}
                onSettingsClick={() => {
                    // already on settings
                    setSubView('main');
                }}
                isCloaked={isCloaked}
            />
        </ScreenWrapper>
    );
};
