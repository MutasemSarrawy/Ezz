import { describe, expect, it } from 'vitest';
import { formatMobile, initials, isEmail, normalizeMobile } from '../account';

describe('mobile numbers', () => {
  it('Jordan accepts local, national and international forms', () => {
    for (const v of ['0791234567', '791234567', '+962791234567', '00962791234567', '962791234567', '079 123 4567']) {
      expect(normalizeMobile('JO', v)).toBe('+962791234567');
    }
  });
  it('Jordan rejects non-mobile prefixes and wrong lengths', () => {
    expect(normalizeMobile('JO', '0761234567')).toBeNull();
    expect(normalizeMobile('JO', '079123456')).toBeNull();
    expect(normalizeMobile('JO', '064123456')).toBeNull(); // landline
  });
  it('Saudi accepts 05 numbers', () => {
    expect(normalizeMobile('SA', '0512345678')).toBe('+966512345678');
    expect(normalizeMobile('SA', '+966 51 234 5678')).toBe('+966512345678');
    expect(normalizeMobile('SA', '0412345678')).toBeNull();
  });
  it('formats for display', () => {
    expect(formatMobile('+962791234567')).toBe('+962 79 123 4567');
  });
});

describe('profile helpers', () => {
  it('email', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
  it('initials', () => {
    expect(initials('Mutasem Sarrawy')).toBe('MS');
    expect(initials('  ')).toBe('☕');
    expect(initials('مها')).toBe('م');
  });
});
