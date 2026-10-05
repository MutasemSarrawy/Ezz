import { describe, expect, it } from 'vitest';
import { driverProgress, formatAddress, nearestBranch, quoteDelivery } from '../delivery';
import { MARKETS, type Market } from '../market';

const JO = MARKETS.JO;
const north = (m: Market, meters: number) => ({ lat: m.branches[0].location.lat + meters / 111_195, lng: m.branches[0].location.lng });

describe('delivery quote', () => {
  it('own drivers nearby, base fee within included km', () => {
    const q = quoteDelivery(JO, north(JO, 1500), 6, 180);
    expect(q.ok && q.courier).toBe('own');
    expect(q.ok && q.fee).toBe(0.75);
  });
  it('charges per km beyond the included distance', () => {
    const q = quoteDelivery(JO, north(JO, 4000), 6, 180);
    expect(q.ok && q.fee).toBeCloseTo(0.75 + 2 * 0.15, 2);
  });
  it('partner beyond own radius, with surcharge', () => {
    const q = quoteDelivery(JO, north(JO, 10_000), 6, 180);
    expect(q.ok && q.courier).toBe('partner');
    expect(q.ok && q.partner).toBe('Talabat');
    expect(q.ok && q.fee).toBeCloseTo(0.75 + 8 * 0.15 + 0.5, 2);
  });
  it('out of range beyond max radius', () => {
    expect(quoteDelivery(JO, north(JO, 16_000), 6, 180).ok).toBe(false);
  });
  it('free above threshold, minimum order shortfall', () => {
    const big = quoteDelivery(JO, north(JO, 3000), 20, 180);
    expect(big.ok && big.free && big.fee).toBe(0);
    const small = quoteDelivery(JO, north(JO, 3000), 1.75, 60);
    expect(small.ok && small.belowMinimumBy).toBe(1.25);
  });
  it('ETA range covers prep + handoff + drive, partners slower', () => {
    const own = quoteDelivery(JO, north(JO, 3000), 6, 180);
    const partner = quoteDelivery(JO, north(JO, 12_000), 6, 180);
    if (!own.ok || !partner.ok) throw new Error();
    expect(own.etaMinMinutes).toBeGreaterThanOrEqual(10);
    expect(partner.etaMaxMinutes - partner.etaMinMinutes).toBeGreaterThan(own.etaMaxMinutes - own.etaMinMinutes);
  });
  it('picks the nearest branch', () => {
    const two: Market = { ...JO, branches: [...JO.branches, { id: 'b2', name: { en: 'B2', ar: 'ب2' }, location: north(JO, 9000) }] };
    expect(nearestBranch(two, north(JO, 8000)).id).toBe('b2');
  });
});

describe('driver', () => {
  it('progress clamps 0..1', () => {
    expect(driverProgress(1000, 100, 1000)).toBe(0);
    expect(driverProgress(1000, 100, 51_000)).toBe(0.5);
    expect(driverProgress(1000, 100, 999_999)).toBe(1);
  });
  it('formats addresses per language', () => {
    const a = { id: 'a', label: 'home' as const, location: { lat: 0, lng: 0 }, area: 'Abdoun', street: 'Cairo St', building: '12', floor: '3' };
    expect(formatAddress(a, 'en')).toBe('Abdoun, Cairo St, Bldg 12, Floor 3');
    expect(formatAddress(a, 'ar')).toContain('مبنى 12');
  });
});
