import React from 'react';
import type { SexType } from '../../types';

interface SexMarkerIconProps {
    type: Exclude<SexType, null>;
    className?: string;
    label?: string;
}

export const SexMarkerIcon: React.FC<SexMarkerIconProps> = ({ type, className = '', label }) => {
    const accessibilityProps = label
        ? { 'aria-label': label, role: 'img' }
        : { 'aria-hidden': true };

    if (type === 'protected') {
        return (
            <svg
                {...accessibilityProps}
                className={`calendar-sex-marker-icon calendar-sex-marker-heart-shield ${className}`}
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    fillRule="evenodd"
                    d="M12 3 5 6v5.5c0 4.4 2.8 8 7 9.5 4.2-1.5 7-5.1 7-9.5V6l-7-3Zm0 12.6-.4-.3c-.3-.3-2.6-1.8-2.6-3.6a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 1.8-2.3 3.3-2.6 3.6l-.4.3Z"
                />
            </svg>
        );
    }

    return (
        <svg
            {...accessibilityProps}
            className={`calendar-sex-marker-icon calendar-sex-marker-heart ${className}`}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M12 21s-8-4.7-8-11.2A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8 3.6C20 16.3 12 21 12 21Z" />
        </svg>
    );
};
