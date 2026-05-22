/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [],
        include: ['tests/**/*.test.{ts,tsx}'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
