import { describe, it, expect } from 'vitest';
import { loadData, loadPeriods } from '../services/logic';

describe('Data Integrity Smoke Test', () => {
    it('should be able to initialize and load empty or existing data', async () => {
        // This tests that our basic storage service methods don't crash on load
        const logs = await loadData();
        const periods = await loadPeriods();

        expect(logs).toBeDefined();
        expect(typeof logs).toBe('object');

        expect(periods).toBeDefined();
        expect(Array.isArray(periods)).toBe(true);
    });
});
