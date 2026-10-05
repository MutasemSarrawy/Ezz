import type { CartLine, LatLng, TravelMode } from './types';

/**
 * Coffee house location. PLACEHOLDER — replace with the real branch coordinates
 * (ideally loaded per-branch from the backend).
 */
export const SHOP_LOCATION: LatLng = { lat: 31.9539, lng: 35.9106 };

/** Start preparing this many seconds *before* the computed latest-start so the drink is ready on arrival, not late. */
export const SAFETY_BUFFER_SECONDS = 45;

/** Within this distance the customer is "here" regardless of the ETA maths. */
export const NEARBY_METERS = 150;

/** Ignore GPS fixes less accurate than this; they cause ETA jitter. */
export const MAX_ACCURACY_METERS = 100;

const EARTH_RADIUS_M = 6_371_000;
/** Straight-line distance understates real routes; scale it. */
const ROUTE_FACTOR = 1.35;
const SPEED_MPS: Record<TravelMode, number> = {
  driving: (25 * 1000) / 3600, // 25 km/h average urban speed incl. stops
  walking: (4.8 * 1000) / 3600,
};
/** Fixed per-order handling time (cup, lid, bagging). */
const BASE_PREP_SECONDS = 30;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateTravelSeconds(
  distanceMeters: number,
  mode: TravelMode,
): number {
  return Math.round((distanceMeters * ROUTE_FACTOR) / SPEED_MPS[mode]);
}

/**
 * Time to make the whole order. Items are made partly in parallel: the slowest
 * line takes full time, everything else adds 60% of its time. Repeat units of
 * the same drink cost 60% too. `queueSeconds` is the barista backlog.
 */
export function estimatePrepSeconds(lines: CartLine[], queueSeconds = 0): number {
  const units = lines.flatMap(({ product, qty }) =>
    Array.from({ length: qty }, (_, i) => ({
      secs: product.prepSeconds,
      repeat: i > 0,
    })),
  );
  if (units.length === 0) return 0;
  const costs = units.map((u) => u.secs * (u.repeat ? 0.6 : 1));
  const longest = Math.max(...costs);
  const rest = costs.reduce((s, c) => s + c, 0) - longest;
  return Math.round(BASE_PREP_SECONDS + longest + rest * 0.6 + queueSeconds);
}

/** Seconds from `now` until the barista should be told to start (0 = now). */
export function secondsUntilStart(etaSeconds: number, prepSeconds: number): number {
  return Math.max(0, etaSeconds - prepSeconds - SAFETY_BUFFER_SECONDS);
}

export function formatMinutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? '1 min' : `${m} min`;
}
