import { describe, expect, it } from 'vitest';
import { bestRedemption, pointsEarned, pointsValue } from '../loyalty';
import { detectBrand, formatCardNumber, formatExpiry, luhnValid, validateCard } from '../payment';

describe('cards', () => {
  it('luhn', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
    expect(luhnValid('4242 4242 4242 4241')).toBe(false);
    expect(luhnValid('123')).toBe(false);
  });
  it('detects brands incl. mada before visa', () => {
    expect(detectBrand('4242424242424242')).toBe('visa');
    expect(detectBrand('5555555555554444')).toBe('mastercard');
    expect(detectBrand('2223003122003222')).toBe('mastercard');
    expect(detectBrand('4406470000000000')).toBe('mada'); // starts with 4 but is mada
    expect(detectBrand('3714496353984310')).toBe('unknown');
  });
  it('formats as you type', () => {
    expect(formatCardNumber('42424242abc42424242')).toBe('4242 4242 4242 4242');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('1')).toBe('1');
  });
  it('validates expiry against today', () => {
    const now = new Date(2026, 9, 5); // Oct 2026
    const ok = { number: '4242424242424242', expiry: '10/26', cvv: '123', name: 'A' };
    expect(validateCard(ok, now)).toEqual({});
    expect(validateCard({ ...ok, expiry: '09/26' }, now).expiry).toBe('cardExpired');
    expect(validateCard({ ...ok, expiry: '13/27' }, now).expiry).toBe('cardExpiryInvalid');
    expect(validateCard({ ...ok, cvv: '12', name: ' ' }, now)).toMatchObject({ cvv: 'cardCvvInvalid', name: 'cardNameMissing' });
  });
});

describe('loyalty', () => {
  it('earns on amount paid', () => {
    expect(pointsEarned(4.4, 'JOD')).toBe(44);
    expect(pointsEarned(28, 'SAR')).toBe(56);
  });
  it('values points in steps of 100', () => {
    expect(pointsValue(250, 'JOD')).toBe(1);
    expect(pointsValue(250, 'SAR')).toBe(5);
  });
  it('never redeems more than the subtotal or the balance', () => {
    expect(bestRedemption(1000, 2.9, 'JOD')).toEqual({ points: 500, discount: 2.5 });
    expect(bestRedemption(150, 18, 'SAR')).toEqual({ points: 100, discount: 2.5 });
    expect(bestRedemption(99, 18, 'SAR')).toEqual({ points: 0, discount: 0 });
  });
});
