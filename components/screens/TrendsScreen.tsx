
import React from 'react';
import { ScreenWrapper } from '../ScreenWrapper';
import TrendsView from '../TrendsView';
import BottomNav from '../BottomNav';
import { useMooneva } from '../../contexts/MoonevaContext';
import { SubViewType, ViewType } from '../../hooks/useAppNavigation';

interface TrendsScreenProps {
    setSubView: (view: SubViewType) => void;
    setView: (view: ViewType) => void;
    isCloaked: boolean;
}

export const TrendsScreen: React.FC<TrendsScreenProps> = ({
    setSubView,
    setView,
    isCloaked
}) => {
    const { settings, logs, model, periods } = useMooneva();
    const { cycles: pastCycles } = model;

    return (
        <ScreenWrapper>
            <div className="flex-1 flex flex-col overflow-hidden bg-[#fcfaf6]">
                <TrendsView
                    logs={logs}
                    cycles={pastCycles}
                    periods={periods}
                    settings={settings}
                    onBack={() => setView('calendar')}
                    availableSymptoms={settings.symptoms}
                />
            </div>
            <BottomNav
                currentView="trends"
                onViewChange={(v) => {
                    setSubView('main');
                    setView(v);
                }}
                onSettingsClick={() => {
                    setSubView('main');
                    setView('settings');
                }}
                isCloaked={isCloaked}
            />
        </ScreenWrapper>
    );
};
