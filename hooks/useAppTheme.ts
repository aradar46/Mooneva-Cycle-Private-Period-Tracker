import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface UseAppThemeOptions {
    view: string;
    discreteMode: boolean;
}

export const useAppTheme = ({ view, discreteMode }: UseAppThemeOptions) => {
    const { t } = useTranslation();

    useEffect(() => {
        const favicon = document.getElementById('favicon') as HTMLLinkElement;
        const appleIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
        const body = document.body;

        // Reset all classes first
        body.className = 'transition-colors duration-500 ease-in-out';

        if (discreteMode) {
            body.classList.add('bg-gray-100', 'text-gray-900', 'antialiased');
            document.title = t('discrete.title');
            const iconUrl = '/todo.png';
            if (favicon) favicon.href = iconUrl;
            if (appleIcon) appleIcon.href = iconUrl;
        } else {
            // View-based backgrounds
            if (view === 'calendar') body.classList.add('bg-[#f5f4f2]');
            else if (view === 'trends') body.classList.add('bg-[#fffaf5]');
            else body.classList.add('bg-white');

            body.classList.add('text-gray-900', 'antialiased');

            // Title switching
            const titles: Record<string, string> = {
                calendar: 'Mooneva',
                timeline: 'Timeline',
                trends: 'Cycle Trends',
                settings: 'Settings'
            };
            document.title = titles[view] || 'Mooneva';

            const iconUrl = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌙</text></svg>';
            if (favicon) favicon.href = iconUrl;
            if (appleIcon) appleIcon.href = iconUrl;
        }
    }, [view, discreteMode, t]);
};
