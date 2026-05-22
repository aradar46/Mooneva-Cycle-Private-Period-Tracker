import { registerPlugin } from '@capacitor/core';

export interface AppIconPlugin {
    setIcon(options: { name: 'Default' | 'Todo' }): Promise<void>;
}

const AppIcon = registerPlugin<AppIconPlugin>('AppIcon');

export default AppIcon;
