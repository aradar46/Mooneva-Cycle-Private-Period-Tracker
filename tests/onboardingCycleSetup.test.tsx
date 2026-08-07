import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OnboardingWizard from '../components/OnboardingWizard';
import type { AppSettings } from '../types';

// Declared with `var` so the hoisted vi.mock factory below can reference it.
var translations: Record<string, string> = {
    'onboarding.goal.title': 'What is your focus?',
    'onboarding.goal.track_label': 'Track Cycle',
    'onboarding.goal.fertility_label': 'Monitor Fertility',
    'onboarding.goal.pregnancy_label': 'Pregnancy Mode',
    'onboarding.goal.birth_control_label': 'Birth Control',
    'settings.cycle_mgmt_title': 'Cycle Management',
    'settings.adaptive_prediction_label': 'Adaptive Prediction',
    'settings.show_fertile_window': 'Show Fertile Window',
    'settings.show_pms_window': 'Show PMS Window',
    'settings.birth_control': 'Hormonal Birth Control',
    'settings.pause_predictions': 'Pause Predictions',
    'settings.on_bc_disabled': 'Disabled while on birth control',
    'settings.cycle_length_label': 'Cycle Length',
    'settings.period_length_label': 'Period Length',
    'settings.luteal_phase_label': 'Luteal Phase',
    'settings.pms_window_label': 'PMS Window',
    'common.continue': 'Continue',
    'common.next': 'Next',
    'common.back': 'Back',
    'common.days': 'days',
};

vi.mock('react-i18next', () => ({
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
    useTranslation: () => ({
        i18n: { language: 'en', changeLanguage: vi.fn() },
        t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../services/notifications', () => ({
    requestNotificationPermission: vi.fn().mockResolvedValue(true),
}));

/** Advance from the language step to the focus/goal step. */
const goToGoalStep = () => {
    // step 0 language -> 1 trust
    fireEvent.click(screen.getAllByText('Continue')[0]);
    // step 1 trust -> 2 calibration (own CTA)
    fireEvent.click(screen.getByText('onboarding.trust.start'));
    // step 2 calibration -> 3 goal (this step's CTA is "Next")
    fireEvent.click(screen.getByText('Next'));
};

const selectGoalAndContinue = (goalLabel: string) => {
    fireEvent.click(screen.getByText(goalLabel));
    fireEvent.click(screen.getAllByText('Continue')[0]);
};

describe('onboarding cycle setup step', () => {
    it('shows the cycle management step after picking a focus', () => {
        render(<OnboardingWizard onComplete={vi.fn()} />);
        goToGoalStep();
        selectGoalAndContinue('Track Cycle');

        expect(screen.getByText('Cycle Management')).toBeTruthy();
        expect(screen.getByText('Adaptive Prediction')).toBeTruthy();
        expect(screen.getByText('Show Fertile Window')).toBeTruthy();
        expect(screen.getByText('Hormonal Birth Control')).toBeTruthy();
        expect(screen.getByText('Pause Predictions')).toBeTruthy();
    });

    it('seeds fertile window from the fertility focus', () => {
        render(<OnboardingWizard onComplete={vi.fn()} />);
        goToGoalStep();
        selectGoalAndContinue('Monitor Fertility');

        // The WHO disclaimer only renders when the fertile window is on
        expect(screen.getByText('settings.fertility_disclaimer_body')).toBeTruthy();
    });

    it('disables fertility and adaptive rows for the birth control focus', () => {
        render(<OnboardingWizard onComplete={vi.fn()} />);
        goToGoalStep();
        selectGoalAndContinue('Birth Control');

        // Both rows explain why they are unavailable
        expect(screen.getAllByText('Disabled while on birth control').length).toBe(2);
        // Fertility disclaimer is hidden while on birth control
        expect(screen.queryByText('settings.fertility_disclaimer_body')).toBeNull();
    });

    it('keeps the birth control preset when finishing', async () => {
        const onComplete = vi.fn();
        render(<OnboardingWizard onComplete={onComplete} />);
        goToGoalStep();
        selectGoalAndContinue('Birth Control');

        // birthControl skips spycraft, landing on get started
        fireEvent.click(screen.getAllByText('Continue')[0]);
        fireEvent.click(screen.getByText('onboarding.get_started.cta'));
        await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());

        const settings = onComplete.mock.calls[0][0] as AppSettings;
        expect(settings.isOnBirthControl).toBe(true);
        expect(settings.showFertileWindow).toBe(false);
        expect(settings.adaptivePrediction).toBe(false);
        expect(settings.cycleLength).toBe(28);
    });

    it('keeps the pregnancy preset when finishing', async () => {
        const onComplete = vi.fn();
        render(<OnboardingWizard onComplete={onComplete} />);
        goToGoalStep();
        selectGoalAndContinue('Pregnancy Mode');

        // pregnancy also skips spycraft, landing on get started
        fireEvent.click(screen.getAllByText('Continue')[0]);
        fireEvent.click(screen.getByText('onboarding.get_started.cta'));
        await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());

        const settings = onComplete.mock.calls[0][0] as AppSettings;
        expect(settings.predictionsPaused).toBe(true);
        expect(settings.showFertileWindow).toBe(false);
        expect(settings.adaptivePrediction).toBe(false);
    });

    it('turning on birth control clears fertility in the same step', () => {
        render(<OnboardingWizard onComplete={vi.fn()} />);
        goToGoalStep();
        selectGoalAndContinue('Monitor Fertility');

        // Fertility is on from the preset
        expect(screen.getByText('settings.fertility_disclaimer_body')).toBeTruthy();

        // Toggling birth control on must force it off
        const bcRow = screen.getByText('Hormonal Birth Control').closest('div')?.parentElement?.parentElement;
        const toggle = bcRow?.querySelector('button');
        fireEvent.click(toggle!);

        expect(screen.queryByText('settings.fertility_disclaimer_body')).toBeNull();
        expect(screen.getAllByText('Disabled while on birth control').length).toBe(2);
    });
});
