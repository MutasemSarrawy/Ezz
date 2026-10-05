import type { CardBrand, PaymentMethod } from '../domain/payment';
import { detectBrand, digitsOnly } from '../domain/payment';
import type { Currency } from '../domain/types';

export type ChargeRequest = {
  amount: number;
  currency: Currency;
  method: Exclude<PaymentMethod, 'counter' | 'wallet'>;
  /** Only for method 'card'. A real provider gets a token from its SDK instead. */
  card?: { number: string; expiry: string; cvv: string; name: string };
  description: string;
};

export type ChargeResult =
  | { ok: true; reference: string; cardLast4?: string; cardBrand?: CardBrand }
  | { ok: false; error: 'declined' | 'cancelled' | 'network' };

/**
 * The seam to the payment provider (Tap, HyperPay, Checkout.com…). To go live,
 * implement `charge` with the provider's mobile SDK: it collects card details
 * in its own secure UI (or Apple/Google Pay sheet) and returns a token; your
 * backend then charges the token. Card numbers must never reach your servers.
 */
export interface PaymentService {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/** Test cards for the mock provider. */
export const TEST_CARDS = {
  success: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
  mada: '4406 4700 0000 0008',
};

class MockPaymentService implements PaymentService {
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    await new Promise((r) => setTimeout(r, 1200));
    const reference = `pay_${Math.random().toString(36).slice(2, 10)}`;
    if (req.method !== 'card' || !req.card) return { ok: true, reference };
    const n = digitsOnly(req.card.number);
    if (n === digitsOnly(TEST_CARDS.declined)) return { ok: false, error: 'declined' };
    return { ok: true, reference, cardLast4: n.slice(-4), cardBrand: detectBrand(n) };
  }
}

export const paymentService: PaymentService = new MockPaymentService();
