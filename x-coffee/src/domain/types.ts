import type { OrderPayment } from './payment';
import type { Address, Courier } from './delivery';

export type LatLng = { lat: number; lng: number };

export type Lang = 'en' | 'ar';
export type Localized = Record<Lang, string>;

export type Currency = 'JOD' | 'SAR';
export type MarketId = 'JO' | 'SA';

export type CategoryId = 'coffee' | 'iced' | 'tea' | 'bakery' | 'dessert';
export type Category = { id: CategoryId; name: Localized; emoji: string };

export type OptionGroupId = 'size' | 'milk' | 'sugar' | 'shots' | 'syrup' | 'warm';

export type Product = {
  id: string;
  name: Localized;
  description: Localized;
  /** Base price (smallest size) per currency. */
  price: Record<Currency, number>;
  category: CategoryId;
  image: string;
  /** Barista time to make one unit with default options, in seconds. */
  prepSeconds: number;
  options: OptionGroupId[];
  popular?: boolean;
};

/** A customer's choices for one product. Keys follow the product's option groups. */
export type Choice = {
  size?: 'S' | 'M' | 'L';
  milk?: 'full' | 'skim' | 'oat' | 'almond' | 'lactose_free';
  sugar?: 'none' | 'less' | 'normal' | 'extra';
  shots?: number; // extra espresso shots, 0..3
  syrup?: 'none' | 'vanilla' | 'caramel' | 'hazelnut';
  warm?: boolean;
  notes?: string;
};

export type CartLine = { key: string; product: Product; choice: Choice; qty: number };

export type FulfilmentMode = 'pickup' | 'delivery';
export type TravelMode = 'driving' | 'walking';
/** once = location shared a single time; live = continuous while the order is open. */
export type TrackingMode = 'once' | 'live';

export type OrderStatus =
  | 'waiting' // placed, barista not yet notified — customer still on the way
  | 'preparing'
  | 'ready'
  | 'out_for_delivery' // delivery only
  | 'picked_up' // pickup only: customer collected it
  | 'delivered' // delivery only
  | 'cancelled';

export type DeliveryInfo = {
  address: Address;
  fee: number;
  courier: Courier;
  partner?: string;
  travelSeconds: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  driver?: { name: Localized; vehicle: string };
  outAt?: number;
  deliveredAt?: number;
};

export type OrderLine = {
  key: string;
  /** Kept so the order can be repeated from history. */
  productId: string;
  choice: Choice;
  name: Localized;
  details: Localized;
  qty: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  /** Amount after points discount. */
  total: number;
  payment: OrderPayment;
  /** Loyalty points credited when the order was picked up. */
  pointsEarned?: number;
  /** Paid amount / redeemed points returned after a cancellation. */
  refunded?: boolean;
  currency: Currency;
  fulfilment: FulfilmentMode;
  shop: LatLng;
  branchName: Localized;
  delivery?: DeliveryInfo;
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
