/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    // Removed dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
                arabic: ['Vazirmatn', 'sans-serif'],
            },
            colors: {
                accent: '#7598a0',

                surface: {
                    body: '#fcfaf6',
                    card: '#ffffff',
                    onboarding: '#fefdfb',
                },

                text: {
                    primary: '#1E293B',
                    secondary: '#94A3B8',
                    dimmed: '#CBD5E1',
                },

                danger: '#FF6B6B',
                success: '#2dd4bf',
                warning: '#f59e0b',
                info: '#3b82f6',
                secondary: '#8b5cf6',

                cycle: {
                    period: '#fb7185',
                    ovulation: '#2dd4bf',
                    follicular: '#7dd3fc',
                    luteal: '#fbbf24',
                    spotting: '#f6141b',
                },
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scalePulse: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'pulse-scale': 'scalePulse 2s infinite ease-in-out',
            }
        }
    },
    plugins: [],
}
