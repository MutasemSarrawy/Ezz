import {
  MAX_ACCURACY_METERS,
  NEARBY_METERS,
  estimateTravelSeconds,
  haversineMeters,
  secondsUntilStart,
} from './pickup';
import type { Currency, LatLng, Order, TrackingMode, TravelMode } from './types';
import { roundMoney } from './market';

type NewPickup = {
  id: string;
  lines: Order['lines'];
  currency: Currency;
  shop: LatLng;
  prepSeconds: number;
  location: LatLng;
  tracking: TrackingMode;
  travel: TravelMode;
  now: number;
};

export function createPickupOrder(input: NewPickup): Order {
  const { location, now } = input;
  const distanceMeters = haversineMeters(location, input.shop);
  const etaSeconds = estimateTravelSeconds(distanceMeters, input.travel);
  const order: Order = {
    id: input.id,
    lines: input.lines,
    total: roundMoney(input.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), input.currency),
    currency: input.currency,
    fulfilment: 'pickup',
    shop: input.shop,
    status: 'waiting',
    createdAt: now,
    prepSeconds: input.prepSeconds,
    travel: input.travel,
    tracking: input.tracking,
    etaSeconds,
    distanceMeters,
    lastLocation: location,
    lastLocationAt: now,
    startAt: now + secondsUntilStart(etaSeconds, input.prepSeconds) * 1000,
  };
  return evaluate(order, now, distanceMeters <= NEARBY_METERS ? 'nearby' : undefined);
}

/**
 * Live-location update. Re-projects the barista start time from the new ETA.
 * Only meaningful for live-tracked orders that are still waiting.
 */
export function applyLocation(
  order: Order,
  location: LatLng,
  accuracyMeters: number | undefined,
  now: number,
): Order {
  if (order.tracking !== 'live' || order.status !== 'waiting') return order;
  if (accuracyMeters !== undefined && accuracyMeters > MAX_ACCURACY_METERS) return order;

  const distanceMeters = haversineMeters(location, order.shop);
  const etaSeconds = estimateTravelSeconds(distanceMeters, order.travel);
  const next: Order = {
    ...order,
    lastLocation: location,
    lastLocationAt: now,
    distanceMeters,
    etaSeconds,
    startAt: now + secondsUntilStart(etaSeconds, order.prepSeconds) * 1000,
  };
  const reason = distanceMeters <= NEARBY_METERS ? 'nearby' : 'live_eta';
  return evaluate(next, now, reason);
}

/** Customer taps "I'm here" / "Start now". */
export function customerArrived(order: Order, now: number): Order {
  if (order.status !== 'waiting') return order;
  return startPreparing(order, now, 'customer_arrived');
}

/** Time-based progression. Call about once a second. */
export function tick(order: Order, now: number): Order {
  if (order.status === 'waiting') return evaluate(order, now, 'on_time');
  if (
    order.status === 'preparing' &&
    order.preparingAt !== undefined &&
    now >= order.preparingAt + order.prepSeconds * 1000
  ) {
    return { ...order, status: 'ready', readyAt: now };
  }
  return order;
}

export function markPickedUp(order: Order): Order {
  return order.status === 'ready' ? { ...order, status: 'picked_up' } : order;
}

export function cancelOrder(order: Order): Order {
  return order.status === 'waiting' || order.status === 'preparing'
    ? { ...order, status: 'cancelled' }
    : order;
}

function evaluate(order: Order, now: number, reason: Order['startReason']): Order {
  if (order.status !== 'waiting') return order;
  if (reason === 'nearby') return startPreparing(order, now, 'nearby');
  if (now >= order.startAt) {
    const immediate = order.startAt <= order.createdAt;
    const why = immediate ? 'immediate' : reason === 'live_eta' ? 'live_eta' : 'on_time';
    return startPreparing(order, now, why);
  }
  return order;
}

function startPreparing(
  order: Order,
  now: number,
  reason: NonNullable<Order['startReason']>,
): Order {
  return { ...order, status: 'preparing', preparingAt: now, startReason: reason };
}
