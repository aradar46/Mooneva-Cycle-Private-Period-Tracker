import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeatmapSection from '../components/trends/HeatmapSection';

const mockI18n = vi.hoisted(() => ({
    dir: vi.fn(() => 'ltr'),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: mockI18n,
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

const renderHeatmap = () => render(
    <HeatmapSection
        title="Symptom Timeline"
        gradientFrom="indigo-100"
        gradientTo="indigo-500"
        rows={[{
            id: 'cramps',
            label: 'Cramps',
            data: { 1: 2 },
        }]}
        maxValue={2}
    />
);

describe('HeatmapSection sticky row headers', () => {
    it('pins row headers to the left in LTR layouts', () => {
        mockI18n.dir.mockReturnValue('ltr');

        renderHeatmap();

        const header = screen.getByText('Cramps');
        expect(header.className).toContain('sticky');
        expect(header.className).toContain('left-0');
        expect(header.className).not.toContain('right-0');
    });

    it('pins row headers to the right in RTL layouts', () => {
        mockI18n.dir.mockReturnValue('rtl');

        renderHeatmap();

        const header = screen.getByText('Cramps');
        expect(header.className).toContain('sticky');
        expect(header.className).toContain('right-0');
        expect(header.className).not.toContain('left-0');
    });
});
