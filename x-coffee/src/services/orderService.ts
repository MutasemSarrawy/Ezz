import {
  applyLocation,
  cancelOrder,
  createPickupOrder,
  customerArrived,
  markPickedUp,
  tick,
} from '../domain/orderEngine';
import type { Currency, LatLng, Order, TrackingMode, TravelMode } from '../domain/types';
import type { OrderPayment } from '../domain/payment';

/**
 * The seam between the customer app and the coffee house's system.
 * `mockOrderService` below runs everything in-process so the full flow can be
 * tried on one phone (the Barista console reads the same store). To go live,
 * implement this interface against the real backend (REST + WebSocket/push)
 * and run the same `orderEngine` rules server-side so the barista app is
 * notified even if the customer's phone is asleep.
 */
export interface OrderService {
  placePickup(input: {
    lines: Order['lines'];
    currency: Currency;
    payment: OrderPayment;
    shop: LatLng;
    prepSeconds: number;
    location: LatLng;
    tracking: TrackingMode;
    travel: TravelMode;
  }): Promise<Order>;
  sendLocation(orderId: string, loc: LatLng, accuracy?: number): void;
  arrived(orderId: string): void;
  cancel(orderId: string): void;
  markPickedUp(orderId: string): void;
  /** Record bookkeeping done by the app (points credited, refund issued). */
  annotate(orderId: string, patch: Pick<Partial<Order>, 'pointsEarned' | 'refunded'>): void;
  /** Seconds of work already queued for baristas (feeds prep estimate). */
  queueSeconds(): number;
  subscribe(listener: (orders: Order[]) => void): () => void;
}

class MockOrderService implements OrderService {
  private orders = new Map<string, Order>();
  private listeners = new Set<(o: Order[]) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 100;

  async placePickup(input: Parameters<OrderService['placePickup']>[0]) {
    await new Promise((r) => setTimeout(r, 300));
    const order = createPickupOrder({
      id: `X-${++this.seq}`,
      ...input,
      now: Date.now(),
    });
    this.orders.set(order.id, order);
    this.ensureTimer();
    this.emit();
    return order;
  }

  sendLocation(id: string, loc: LatLng, accuracy?: number) {
    this.update(id, (o) => applyLocation(o, loc, accuracy, Date.now()));
  }
  arrived(id: string) { this.update(id, (o) => customerArrived(o, Date.now())); }
  cancel(id: string) { this.update(id, cancelOrder); }
  markPickedUp(id: string) { this.update(id, markPickedUp); }
  annotate(id: string, patch: Pick<Partial<Order>, 'pointsEarned' | 'refunded'>) { this.update(id, (o) => ({ ...o, ...patch })); }

  queueSeconds() {
    let secs = 0;
    for (const o of this.orders.values()) if (o.status === 'preparing') secs += o.prepSeconds;
    // two baristas on shift
    return Math.round(secs / 2);
  }

  subscribe(listener: (orders: Order[]) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  private update(id: string, fn: (o: Order) => Order) {
    const cur = this.orders.get(id);
    if (!cur) return;
    const next = fn(cur);
    if (next !== cur) {
      this.orders.set(id, next);
      this.emit();
    }
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, o] of this.orders) {
        const next = tick(o, now);
        if (next !== o) { this.orders.set(id, next); changed = true; }
      }
      // keep emitting while anything is active so countdowns on screen stay live
      if (changed || this.hasActive()) this.emit();
    }, 1000);
  }

  private hasActive() {
    for (const o of this.orders.values()) if (o.status === 'waiting' || o.status === 'preparing') return true;
    return false;
  }

  private snapshot() {
    return [...this.orders.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const orderService: OrderService = new MockOrderService();
