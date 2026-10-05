import type { CardBrand } from './payment';
import type { Choice, Currency, MarketId } from './types';

export type Profile = { name: string; phone?: string; email?: string; phoneVerified?: boolean };

export const DIAL_CODE: Record<MarketId, string> = { JO: '+962', SA: '+966' };

/**
 * Mobile numbers only (SMS sign-up).
 *  Jordan: 07X XXX XXXX with X in 7/8/9 → +9627XXXXXXXX
 *  Saudi:  05X XXX XXXX                  → +9665XXXXXXXX
 * Accepts local (leading 0), national, or international forms.
 */
export function normalizeMobile(market: MarketId, input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  const cc = DIAL_CODE[market];
  if (d.startsWith(cc)) d = d.slice(cc.length);
  else if (d.startsWith(cc.slice(1)) && d.length > 10) d = d.slice(cc.length - 1);
  else if (d.startsWith('00' + cc.slice(1))) d = d.slice(cc.length + 1);
  if (d.startsWith('0')) d = d.slice(1);
  const ok = market === 'JO' ? /^7[789]\d{7}$/.test(d) : /^5\d{8}$/.test(d);
  return ok ? cc + d : null;
}

/** +962791234567 → +962 79 123 4567 */
export function formatMobile(e164: string): string {
  const m = /^(\+\d{3})(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** Wrap text that must read left-to-right (phone numbers) so Arabic layout doesn't reorder it. */
export const ltr = (text: string) => `\u2066${text}\u2069`;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '☕';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** A drink the customer saved with their exact options. */
export type SavedDrink = { id: string; productId: string; choice: Choice };

/**
 * A card saved with the payment provider. Only display data and the provider's
 * token are kept on the device — never the number or CVV.
 */
export type SavedCard = { id: string; token: string; brand: CardBrand; last4: string; expiry: string; holder: string };

export type LedgerEntry = {
  id: string;
  at: number;
  kind: 'topup' | 'payment' | 'refund' | 'earn' | 'redeem' | 'restore';
  /** Positive adds to the balance, negative takes from it. */
  amount: number;
  unit: Currency | 'points';
  orderId?: string;
};

export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
