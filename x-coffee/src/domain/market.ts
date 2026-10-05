import type { Currency, Lang, LatLng, Localized, MarketId } from './types';

export type Market = {
  id: MarketId;
  name: Localized;
  flag: string;
  currency: Currency;
  decimals: number;
  symbol: Localized;
  /** Branch customers pick up from. PLACEHOLDER coordinates — replace with real branches. */
  branch: { name: Localized; location: LatLng };
};

export const MARKETS: Record<MarketId, Market> = {
  JO: {
    id: 'JO',
    name: { en: 'Jordan', ar: 'الأردن' },
    flag: '🇯🇴',
    currency: 'JOD',
    decimals: 3,
    symbol: { en: 'JD', ar: 'د.أ' },
    branch: { name: { en: 'Amman', ar: 'عمّان' }, location: { lat: 31.9539, lng: 35.9106 } },
  },
  SA: {
    id: 'SA',
    name: { en: 'Saudi Arabia', ar: 'السعودية' },
    flag: '🇸🇦',
    currency: 'SAR',
    decimals: 2,
    symbol: { en: 'SAR', ar: 'ر.س' },
    branch: { name: { en: 'Riyadh', ar: 'الرياض' }, location: { lat: 24.7136, lng: 46.6753 } },
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
