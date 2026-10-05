import {
  MAX_ACCURACY_METERS,
  NEARBY_METERS,
  estimateTravelSeconds,
  haversineMeters,
  secondsUntilStart,
} from './pickup';
import type { Currency, DeliveryInfo, LatLng, Localized, Order, TrackingMode, TravelMode } from './types';
import { DRIVER_HANDOFF_SECONDS, type Address } from './delivery';
import type { OrderPayment } from './payment';

type NewPickup = {
  id: string;
  lines: Order['lines'];
  currency: Currency;
  payment: OrderPayment;
  shop: LatLng;
  branchId: string;
  branchName: Localized;
  customer?: Order['customer'];
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
    total: input.payment.amount,
    payment: input.payment,
    currency: input.currency,
    fulfilment: 'pickup',
    shop: input.shop,
    branchId: input.branchId,
    branchName: input.branchName,
    customer: input.customer,
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

type NewDelivery = {
  id: string;
  lines: Order['lines'];
  currency: Currency;
  payment: OrderPayment;
  shop: LatLng;
  branchId: string;
  branchName: Localized;
  customer?: Order['customer'];
  prepSeconds: number;
  address: Address;
  distanceMeters: number;
  delivery: Omit<DeliveryInfo, 'address' | 'driver' | 'outAt' | 'deliveredAt'>;
  now: number;
};

/** Delivery orders go straight to the barista: there is no arrival to time. */
export function createDeliveryOrder(input: NewDelivery): Order {
  const { now } = input;
  return {
    id: input.id,
    lines: input.lines,
    total: input.payment.amount,
    payment: input.payment,
    currency: input.currency,
    fulfilment: 'delivery',
    shop: input.shop,
    branchId: input.branchId,
    branchName: input.branchName,
    customer: input.customer,
    delivery: { ...input.delivery, address: input.address },
    status: 'preparing',
    createdAt: now,
    prepSeconds: input.prepSeconds,
    travel: 'driving',
    tracking: 'once',
    etaSeconds: input.prepSeconds + DRIVER_HANDOFF_SECONDS + input.delivery.travelSeconds,
    distanceMeters: input.distanceMeters,
    lastLocation: input.address.location,
    lastLocationAt: now,
    startAt: now,
    preparingAt: now,
    startReason: 'immediate',
  };
}

const DRIVERS: Localized[] = [
  { en: 'Omar', ar: 'عمر' }, { en: 'Yousef', ar: 'يوسف' }, { en: 'Khaled', ar: 'خالد' }, { en: 'Ahmad', ar: 'أحمد' },
];

function goOut(order: Order, now: number): Order {
  const d = order.delivery!;
  const seed = Number(order.id.replace(/\D/g, '')) || 0;
  const driver =
    d.courier === 'own'
      ? { name: DRIVERS[seed % DRIVERS.length], vehicle: 'Motorbike' }
      : { name: { en: `${d.partner} courier`, ar: `مندوب ${d.partner}` }, vehicle: d.partner ?? '' };
  return { ...order, status: 'out_for_delivery', delivery: { ...d, driver, outAt: now } };
}

/** Barista hands the bag to the driver before the automatic hand-off time. */
export function handToDriver(order: Order, now: number): Order {
  return order.fulfilment === 'delivery' && order.status === 'ready' ? goOut(order, now) : order;
}

/** Staff start an incoming order early. */
export function staffStart(order: Order, now: number): Order {
  return order.status === 'waiting' ? startPreparing(order, now, 'staff') : order;
}

/** Barista finished making it. */
export function markReady(order: Order, now: number): Order {
  return order.status === 'preparing' ? { ...order, status: 'ready', readyAt: now } : order;
}

/**
 * Time-based progression. Call about once a second.
 * `autoAdvance` false = staff mark orders ready and hand them to drivers
 * themselves; only the arrival-timed start stays automatic.
 */
export function tick(order: Order, now: number, autoAdvance = true): Order {
  if (order.status === 'waiting') return evaluate(order, now, 'on_time');
  if (!autoAdvance && (order.status === 'preparing' || order.status === 'ready')) return order;
  if (
    order.status === 'preparing' &&
    order.preparingAt !== undefined &&
    now >= order.preparingAt + order.prepSeconds * 1000
  ) {
    return { ...order, status: 'ready', readyAt: now };
  }
  if (order.fulfilment === 'delivery' && order.delivery) {
    if (order.status === 'ready' && order.readyAt !== undefined && now >= order.readyAt + DRIVER_HANDOFF_SECONDS * 1000) {
      return goOut(order, now);
    }
    const out = order.delivery.outAt;
    if (order.status === 'out_for_delivery' && out !== undefined && now >= out + order.delivery.travelSeconds * 1000) {
      return { ...order, status: 'delivered', delivery: { ...order.delivery, deliveredAt: now } };
    }
  }
  return order;
}

export function markPickedUp(order: Order): Order {
  return order.status === 'ready' && order.fulfilment === 'pickup' ? { ...order, status: 'picked_up' } : order;
}

/** Test tool: pretend `seconds` have passed by moving every timestamp back. */
export function advance(order: Order, seconds: number): Order {
  const ms = seconds * 1000;
  const back = (t?: number) => (t === undefined ? t : t - ms);
  return {
    ...order,
    createdAt: order.createdAt - ms,
    startAt: order.startAt - ms,
    lastLocationAt: order.lastLocationAt - ms,
    preparingAt: back(order.preparingAt),
    readyAt: back(order.readyAt),
    delivery: order.delivery && { ...order.delivery, outAt: back(order.delivery.outAt) },
  };
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
