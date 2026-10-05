import { estimateTravelSeconds, haversineMeters } from './pickup';
import { roundMoney, type Branch, type Market } from './market';
import type { LatLng, Localized } from './types';

export type AddressLabel = 'home' | 'work' | 'other';

export type Address = {
  id: string;
  label: AddressLabel;
  location: LatLng;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  notes?: string;
};

export type Courier = 'own' | 'partner';

export type DeliveryQuote =
  | {
      ok: true;
      branch: Branch;
      distanceMeters: number;
      courier: Courier;
      partner?: string;
      fee: number;
      /** Fee before the free-delivery threshold was applied. */
      fullFee: number;
      free: boolean;
      /** Amount still needed to reach the minimum order (0 when met). */
      belowMinimumBy: number;
      travelSeconds: number;
      etaMinMinutes: number;
      etaMaxMinutes: number;
    }
  | { ok: false; reason: 'out_of_range'; branch: Branch; distanceMeters: number };

/** Time for the driver to collect the order once it's ready. */
export const DRIVER_HANDOFF_SECONDS = 90;

export function nearestBranch(market: Market, at: LatLng): Branch {
  return market.branches.reduce((best, b) =>
    haversineMeters(at, b.location) < haversineMeters(at, best.location) ? b : best,
  );
}

/**
 * Price and time for delivering `subtotal` worth of items to `to`.
 * Own drivers inside `ownRadiusKm`, a partner up to `maxRadiusKm`, nothing beyond.
 */
export function quoteDelivery(market: Market, to: LatLng, subtotal: number, prepSeconds: number): DeliveryQuote {
  const cfg = market.delivery;
  const branch = nearestBranch(market, to);
  const distanceMeters = haversineMeters(to, branch.location);
  const km = distanceMeters / 1000;
  if (km > cfg.maxRadiusKm) return { ok: false, reason: 'out_of_range', branch, distanceMeters };

  const courier: Courier = km <= cfg.ownRadiusKm ? 'own' : 'partner';
  const cur = market.currency;
  const fullFee = roundMoney(
    cfg.baseFee + Math.max(0, km - cfg.includedKm) * cfg.perKm + (courier === 'partner' ? cfg.partnerSurcharge : 0),
    cur,
  );
  const free = subtotal >= cfg.freeAbove;
  const travelSeconds = estimateTravelSeconds(distanceMeters, 'driving');
  const total = prepSeconds + DRIVER_HANDOFF_SECONDS + travelSeconds;
  // Partners add their own dispatch time and are less predictable.
  const slack = courier === 'own' ? 5 : 10;
  const etaMinMinutes = Math.max(10, Math.round(total / 60 / 5) * 5);
  return {
    ok: true,
    branch,
    distanceMeters,
    courier,
    partner: courier === 'partner' ? cfg.partners[0] : undefined,
    fee: free ? 0 : fullFee,
    fullFee,
    free,
    belowMinimumBy: roundMoney(Math.max(0, cfg.minOrder - subtotal), cur),
    travelSeconds,
    etaMinMinutes,
    etaMaxMinutes: etaMinMinutes + slack + (courier === 'partner' ? 5 : 0),
  };
}

/** Driver progress 0..1 along the route while out for delivery. */
export function driverProgress(outAt: number, travelSeconds: number, now: number): number {
  if (travelSeconds <= 0) return 1;
  return Math.min(1, Math.max(0, (now - outAt) / (travelSeconds * 1000)));
}

export function interpolate(a: LatLng, b: LatLng, f: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

export function formatAddress(a: Address, lang: 'en' | 'ar'): string {
  const parts = [a.area, a.street, lang === 'ar' ? `مبنى ${a.building}` : `Bldg ${a.building}`];
  if (a.floor) parts.push(lang === 'ar' ? `طابق ${a.floor}` : `Floor ${a.floor}`);
  if (a.apartment) parts.push(lang === 'ar' ? `شقة ${a.apartment}` : `Apt ${a.apartment}`);
  return parts.filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
}

export const LABELS: Record<AddressLabel, Localized & { icon: string }> = {
  home: { en: 'Home', ar: 'المنزل', icon: '🏠' },
  work: { en: 'Work', ar: 'العمل', icon: '🏢' },
  other: { en: 'Other', ar: 'آخر', icon: '📍' },
};
