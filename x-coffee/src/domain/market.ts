import type { Currency, Lang, LatLng, Localized, MarketId } from './types';

export type Market = {
  id: MarketId;
  name: Localized;
  flag: string;
  currency: Currency;
  decimals: number;
  symbol: Localized;
  /**
   * Branches in this country. PLACEHOLDER: one per country until the real list
   * is decided. Pickup and delivery always use the branch nearest the customer.
   */
  branches: Branch[];
  delivery: DeliveryConfig;
};

export type Branch = { id: string; name: Localized; location: LatLng };

export type DeliveryConfig = {
  /** Our own drivers cover up to this distance (straight line, km). */
  ownRadiusKm: number;
  /** A delivery partner covers from there up to this distance. */
  maxRadiusKm: number;
  partners: string[];
  baseFee: number;
  /** Charged per km beyond `includedKm`. */
  perKm: number;
  includedKm: number;
  /** Partner deliveries cost this much more. */
  partnerSurcharge: number;
  minOrder: number;
  freeAbove: number;
};

export const MARKETS: Record<MarketId, Market> = {
  JO: {
    id: 'JO',
    name: { en: 'Jordan', ar: 'الأردن' },
    flag: '🇯🇴',
    currency: 'JOD',
    decimals: 3,
    symbol: { en: 'JD', ar: 'د.أ' },
    branches: [{ id: 'amm-1', name: { en: 'Amman', ar: 'عمّان' }, location: { lat: 31.9539, lng: 35.9106 } }],
    delivery: {
      ownRadiusKm: 5, maxRadiusKm: 15, partners: ['Talabat', 'Careem'],
      baseFee: 0.75, perKm: 0.15, includedKm: 2, partnerSurcharge: 0.5, minOrder: 3, freeAbove: 15,
    },
  },
  SA: {
    id: 'SA',
    name: { en: 'Saudi Arabia', ar: 'السعودية' },
    flag: '🇸🇦',
    currency: 'SAR',
    decimals: 2,
    symbol: { en: 'SAR', ar: 'ر.س' },
    branches: [{ id: 'ruh-1', name: { en: 'Riyadh', ar: 'الرياض' }, location: { lat: 24.7136, lng: 46.6753 } }],
    delivery: {
      ownRadiusKm: 6, maxRadiusKm: 20, partners: ['Jahez', 'Careem'],
      baseFee: 7, perKm: 1, includedKm: 2, partnerSurcharge: 3, minOrder: 15, freeAbove: 75,
    },
  },
};

export function formatMoney(amount: number, currency: Currency, lang: Lang): string {
  const m = currency === 'JOD' ? MARKETS.JO : MARKETS.SA;
  return `${amount.toFixed(m.decimals)} ${m.symbol[lang]}`;
}

/** Round to the currency's minor unit (fils for JOD, halala for SAR). */
export function roundMoney(amount: number, currency: Currency): number {
  const f = currency === 'JOD' ? 1000 : 100;
  return Math.round(amount * f) / f;
}
