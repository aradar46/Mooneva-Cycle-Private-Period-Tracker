import { registerPlugin } from '@capacitor/core';

export interface WidgetSyncData {
    cycleDay: number;
    cycleLength: number;
    daysUntilPeriod: number;
    daysUntilOvulation: number;
    currentPhase: 'period' | 'fertile' | 'ovulation' | 'luteal' | 'follicular' | 'pms';
    discreteMode: boolean;
}

export interface WidgetSyncResult {
    success: boolean;
    widgetsUpdated: number;
}

export interface WidgetStatusResult {
    widgetCount: number;
    hasWidgets: boolean;
}

export interface WidgetSyncPlugin {
    updateWidgetData(data: WidgetSyncData): Promise<WidgetSyncResult>;
    getWidgetStatus(): Promise<WidgetStatusResult>;
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync');

export { WidgetSync };
