import { lateDays, shiftDay } from './circulation-dates';
import { fineAmount, fineStatus } from './fine-rules';
import { DEFAULT_LIBRARY_SETTINGS, minorUnits } from './library-policies';

describe('fine calculation and calendar dates', () => {
  it('counts calendar days across month and daylight-saving boundaries without negative values', () => {
    expect(shiftDay('2026-03-07', 3)).toBe('2026-03-10');
    expect(lateDays('2026-03-07', '2026-03-10')).toBe(3);
    expect(lateDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(lateDays('2026-03-10', '2026-03-09')).toBe(0);
    expect(lateDays('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('subtracts the grace period and multiplies chargeable days in paise', () => {
    const policy = { ...DEFAULT_LIBRARY_SETTINGS, graceDays: 2, dailyFineMinor: 525 };
    expect(fineAmount(2, policy)).toBe(0);
    expect(fineAmount(5, policy)).toBe(1575);
  });

  it('enforces the cap and supports zero rate or cap', () => {
    expect(fineAmount(150, DEFAULT_LIBRARY_SETTINGS)).toBe(50000);
    expect(fineAmount(2, { ...DEFAULT_LIBRARY_SETTINGS, dailyFineMinor: 0 })).toBe(0);
    expect(fineAmount(2, { ...DEFAULT_LIBRARY_SETTINGS, maxFineMinor: 0 })).toBe(0);
  });

  it('parses decimal amounts without rounding sub-paise input', () => {
    expect(minorUnits('12.37')).toBe(1237);
    expect(minorUnits('0.3')).toBe(30);
    for (const invalid of ['-1', '1.009', '1e2', '', '10000000000000000000']) {
      expect(minorUnits(invalid)).toBeNaN();
    }
    expect(fineStatus(100, 0)).toBe('Outstanding');
    expect(fineStatus(100, 40)).toBe('Partially Paid');
    expect(fineStatus(100, 100)).toBe('Paid');
  });
});
