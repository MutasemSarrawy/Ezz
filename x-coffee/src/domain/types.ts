export type LatLng = { lat: number; lng: number };

export type CategoryId = 'coffee' | 'iced' | 'tea' | 'bakery' | 'dessert';

export type Category = { id: CategoryId; name: string; emoji: string };

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: CategoryId;
  image: string;
  /** Barista time to make one unit, in seconds. */
  prepSeconds: number;
  popular?: boolean;
};

export type CartLine = { product: Product; qty: number };

export type FulfilmentMode = 'pickup' | 'delivery';
export type TravelMode = 'driving' | 'walking';
/** once = location shared a single time; live = continuous while the order is open. */
export type TrackingMode = 'once' | 'live';

export type OrderStatus =
  | 'waiting' // placed, barista not yet notified — customer still on the way
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

export type Order = {
  id: string;
  lines: { productId: string; name: string; qty: number; price: number }[];
  total: number;
  fulfilment: 'pickup';
  status: OrderStatus;
  createdAt: number;
  prepSeconds: number;
  travel: TravelMode;
  tracking: TrackingMode;
  etaSeconds: number;
  distanceMeters: number;
  lastLocation: LatLng;
  lastLocationAt: number;
  /** When the barista will be told to start. Re-projected on every location fix. */
  startAt: number;
  preparingAt?: number;
  readyAt?: number;
  /** Why preparation started — shown on the barista console. */
  startReason?: 'on_time' | 'live_eta' | 'nearby' | 'customer_arrived' | 'immediate';
};
