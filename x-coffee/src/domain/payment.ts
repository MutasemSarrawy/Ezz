export type PaymentMethod = 'apple_pay' | 'google_pay' | 'card' | 'wallet' | 'counter';
export type CardBrand = 'visa' | 'mastercard' | 'mada' | 'unknown';

export type OrderPayment = {
  method: PaymentMethod;
  status: 'paid' | 'pay_at_counter';
  /** Amount charged (or to collect at the counter), after the points discount. */
  amount: number;
  subtotal: number;
  pointsRedeemed: number;
  discount: number;
  cardLast4?: string;
  cardBrand?: CardBrand;
  reference?: string;
};

/**
 * mada (Saudi debit network) card prefixes. Partial list for UI labelling only;
 * the payment provider decides routing. Keep in sync with the provider's BIN table.
 */
const MADA_BINS = [
  '440647', '440795', '446404', '457865', '968208', '588845', '636120', '417633',
  '468540', '468541', '468542', '468543', '968201', '446393', '409201', '458456',
  '484783', '968205', '462220', '455708', '410621', '455036', '486094', '486095',
  '486096', '504300', '440533', '489317', '489318', '489319', '445564', '968211',
  '401757', '410685', '432328', '428671', '428672', '428673', '968206', '446672',
  '543357', '434107', '431361', '604906', '521076', '588850', '968202', '535825',
  '529415', '543085', '524130', '554180', '549760', '588848', '968209', '531095',
  '530906', '532013', '968204', '422817', '422818', '422819', '428331', '483010',
  '483011', '483012', '589206', '968207', '419593', '439954', '407197', '407395',
];

export const digitsOnly = (s: string) => s.replace(/\D/g, '');

export function detectBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (n.length >= 6 && MADA_BINS.includes(n.slice(0, 6))) return 'mada';
  if (/^4/.test(n)) return 'visa';
  const two = Number(n.slice(0, 2));
  const four = Number(n.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  return 'unknown';
}

export function luhnValid(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 12 || n.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "4242424242424242" → "4242 4242 4242 4242" */
export function formatCardNumber(input: string): string {
  return digitsOnly(input).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" → "12/28" */
export function formatExpiry(input: string): string {
  const d = digitsOnly(input).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export type CardInput = { number: string; expiry: string; cvv: string; name: string };
export type CardErrors = Partial<Record<keyof CardInput, 'cardNumberInvalid' | 'cardExpiryInvalid' | 'cardExpired' | 'cardCvvInvalid' | 'cardNameMissing'>>;

export function validateCard(c: CardInput, now = new Date()): CardErrors {
  const e: CardErrors = {};
  if (!luhnValid(c.number)) e.number = 'cardNumberInvalid';
  const m = /^(\d{2})\/(\d{2})$/.exec(c.expiry);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = 'cardExpiryInvalid';
  else {
    const year = 2000 + Number(m[2]);
    const month = Number(m[1]);
    // valid through the last day of the expiry month
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) e.expiry = 'cardExpired';
  }
  if (!/^\d{3,4}$/.test(c.cvv)) e.cvv = 'cardCvvInvalid';
  if (!c.name.trim()) e.name = 'cardNameMissing';
  return e;
}
