import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import {
  applyLocation,
  cancelOrder,
  createPickupOrder,
  customerArrived,
  markPickedUp,
  tick,
} from '../orderEngine';
import {
  SAFETY_BUFFER_SECONDS,
  SHOP_LOCATION,
  estimatePrepSeconds,
  estimateTravelSeconds,
  haversineMeters,
  secondsUntilStart,
} from '../pickup';
import type { LatLng } from '../types';

const p = (id: string) => PRODUCTS.find((x) => x.id === id)!;
const metersNorth = (m: number): LatLng => ({
  lat: SHOP_LOCATION.lat + m / 111_195,
  lng: SHOP_LOCATION.lng,
});
const lines = [{ productId: 'latte', name: 'Caffè Latte', qty: 1, price: 4 }];
const T0 = 1_000_000;

function order(distanceM: number, tracking: 'once' | 'live', prepSeconds = 170) {
  return createPickupOrder({
    id: 'o1',
    lines,
    prepSeconds,
    location: metersNorth(distanceM),
    tracking,
    travel: 'driving',
    now: T0,
  });
}

describe('estimates', () => {
  it('haversine ≈ known distance', () => {
    expect(haversineMeters(metersNorth(1000), SHOP_LOCATION)).toBeGreaterThan(990);
    expect(haversineMeters(metersNorth(1000), SHOP_LOCATION)).toBeLessThan(1010);
  });
  it('walking is slower than driving', () => {
    expect(estimateTravelSeconds(1000, 'walking')).toBeGreaterThan(
      estimateTravelSeconds(1000, 'driving'),
    );
  });
  it('prep time grows with items but less than linearly', () => {
    const one = estimatePrepSeconds([{ product: p('latte'), qty: 1 }]);
    const two = estimatePrepSeconds([{ product: p('latte'), qty: 2 }]);
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(one * 2);
    expect(estimatePrepSeconds([])).toBe(0);
  });
  it('queue backlog adds to prep time', () => {
    const base = estimatePrepSeconds([{ product: p('latte'), qty: 1 }]);
    expect(estimatePrepSeconds([{ product: p('latte'), qty: 1 }], 120)).toBe(base + 120);
  });
  it('never starts in the past', () => {
    expect(secondsUntilStart(10, 200)).toBe(0);
  });
});

describe('pickup order lifecycle', () => {
  it('far away: waits, then starts at ETA − prep − buffer', () => {
    const o = order(5000, 'once');
    expect(o.status).toBe('waiting');
    const expectedStart = T0 + (o.etaSeconds - 170 - SAFETY_BUFFER_SECONDS) * 1000;
    expect(o.startAt).toBe(expectedStart);
    expect(tick(o, expectedStart - 1).status).toBe('waiting');
    const started = tick(o, expectedStart);
    expect(started.status).toBe('preparing');
    expect(started.startReason).toBe('on_time');
  });

  it('closer than prep time: starts immediately', () => {
    const o = order(300, 'once', 300);
    expect(o.status).toBe('preparing');
    expect(o.startReason).toBe('immediate');
  });

  it('already at the shop: starts as nearby', () => {
    expect(order(50, 'once').startReason).toBe('nearby');
  });

  it('preparing becomes ready after prepSeconds, then picked up', () => {
    const o = order(300, 'once', 100);
    const ready = tick(o, T0 + 100_000);
    expect(ready.status).toBe('ready');
    expect(markPickedUp(ready).status).toBe('picked_up');
    expect(markPickedUp(o).status).toBe('preparing');
  });

  it('live: re-projects start time as the customer moves', () => {
    let o = order(5000, 'live');
    const firstStart = o.startAt;
    // customer drives much closer 60s later, so start moves earlier in absolute terms
    o = applyLocation(o, metersNorth(3000), 10, T0 + 60_000);
    expect(o.status).toBe('waiting');
    expect(o.startAt).toBeLessThan(firstStart + 60_000);
    expect(o.distanceMeters).toBeLessThan(3100);
  });

  it('live: notifies the barista once ETA ≤ prep + buffer', () => {
    let o = order(5000, 'live');
    o = applyLocation(o, metersNorth(900), 10, T0 + 120_000);
    // 900m * 1.35 / 6.94 m/s ≈ 175s ≤ 170 + 45
    expect(o.status).toBe('preparing');
    expect(o.startReason).toBe('live_eta');
  });

  it('live: nearby trigger beats ETA maths', () => {
    let o = order(5000, 'live');
    o = applyLocation(o, metersNorth(100), 10, T0 + 5_000);
    expect(o.status).toBe('preparing');
    expect(o.startReason).toBe('nearby');
  });

  it('live: poor-accuracy fixes are ignored', () => {
    const o = order(5000, 'live');
    expect(applyLocation(o, metersNorth(50), 500, T0 + 1000)).toBe(o);
  });

  it('once-mode ignores later location updates', () => {
    const o = order(5000, 'once');
    expect(applyLocation(o, metersNorth(50), 5, T0 + 1000)).toBe(o);
  });

  it('live: stale location falls back to projected start time', () => {
    const o = order(5000, 'live');
    expect(tick(o, o.startAt).status).toBe('preparing');
  });

  it('"I\'m here" starts preparation immediately', () => {
    const o = customerArrived(order(5000, 'once'), T0 + 1000);
    expect(o.status).toBe('preparing');
    expect(o.startReason).toBe('customer_arrived');
  });

  it('can cancel before ready, not after', () => {
    const o = order(5000, 'once');
    expect(cancelOrder(o).status).toBe('cancelled');
    const started = tick(order(300, 'once', 10), T0 + 5_000);
    const ready = tick(started, T0 + 15_000);
    expect(ready.status).toBe('ready');
    expect(cancelOrder(ready).status).toBe('ready');
  });
});
