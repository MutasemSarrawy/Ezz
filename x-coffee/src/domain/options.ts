import type { Choice, Currency, Lang, Localized, OptionGroupId, Product } from './types';

type Opt<V> = {
  value: V;
  label: Localized;
  price?: Record<Currency, number>;
  /** Extra barista seconds this choice adds per unit. */
  prep?: number;
};

const p = (JOD: number, SAR: number) => ({ JOD, SAR });

export const SIZE: Opt<NonNullable<Choice['size']>>[] = [
  { value: 'S', label: { en: 'Small', ar: 'صغير' } },
  { value: 'M', label: { en: 'Medium', ar: 'وسط' }, price: p(0.35, 2), prep: 10 },
  { value: 'L', label: { en: 'Large', ar: 'كبير' }, price: p(0.7, 4), prep: 20 },
];
export const MILK: Opt<NonNullable<Choice['milk']>>[] = [
  { value: 'full', label: { en: 'Full fat', ar: 'كامل الدسم' } },
  { value: 'skim', label: { en: 'Skimmed', ar: 'خالي الدسم' } },
  { value: 'lactose_free', label: { en: 'Lactose-free', ar: 'خالي اللاكتوز' }, price: p(0.25, 2) },
  { value: 'oat', label: { en: 'Oat', ar: 'شوفان' }, price: p(0.4, 3) },
  { value: 'almond', label: { en: 'Almond', ar: 'لوز' }, price: p(0.4, 3) },
];
export const SUGAR: Opt<NonNullable<Choice['sugar']>>[] = [
  { value: 'none', label: { en: 'No sugar', ar: 'بدون سكر' } },
  { value: 'less', label: { en: 'Less', ar: 'قليل' } },
  { value: 'normal', label: { en: 'Normal', ar: 'وسط' } },
  { value: 'extra', label: { en: 'Extra', ar: 'زيادة' } },
];
export const SYRUP: Opt<NonNullable<Choice['syrup']>>[] = [
  { value: 'none', label: { en: 'None', ar: 'بدون' } },
  { value: 'vanilla', label: { en: 'Vanilla', ar: 'فانيلا' }, price: p(0.3, 2) },
  { value: 'caramel', label: { en: 'Caramel', ar: 'كراميل' }, price: p(0.3, 2) },
  { value: 'hazelnut', label: { en: 'Hazelnut', ar: 'بندق' }, price: p(0.3, 2) },
];
export const SHOT_PRICE = p(0.4, 3);
export const SHOT_PREP = 20;
export const MAX_SHOTS = 3;
export const WARM_PREP = 60;

export const GROUP_TITLE: Record<OptionGroupId, Localized> = {
  size: { en: 'Size', ar: 'الحجم' },
  milk: { en: 'Milk', ar: 'الحليب' },
  sugar: { en: 'Sugar', ar: 'السكر' },
  shots: { en: 'Extra espresso shots', ar: 'شوت إسبريسو إضافي' },
  syrup: { en: 'Flavour syrup', ar: 'نكهة إضافية' },
  warm: { en: 'Serve warm', ar: 'تسخين' },
};

export function defaultChoice(product: Product): Choice {
  const c: Choice = {};
  for (const g of product.options) {
    if (g === 'size') c.size = 'M';
    if (g === 'milk') c.milk = 'full';
    if (g === 'sugar') c.sugar = 'none';
    if (g === 'shots') c.shots = 0;
    if (g === 'syrup') c.syrup = 'none';
    if (g === 'warm') c.warm = false;
  }
  return c;
}

const find = <V>(opts: Opt<V>[], v: V | undefined) => opts.find((o) => o.value === v);

export function unitPrice(product: Product, c: Choice, cur: Currency): number {
  let total = product.price[cur];
  total += find(SIZE, c.size)?.price?.[cur] ?? 0;
  total += find(MILK, c.milk)?.price?.[cur] ?? 0;
  total += find(SYRUP, c.syrup)?.price?.[cur] ?? 0;
  total += (c.shots ?? 0) * SHOT_PRICE[cur];
  return total;
}

export function unitPrepSeconds(product: Product, c: Choice): number {
  return (
    product.prepSeconds +
    (find(SIZE, c.size)?.prep ?? 0) +
    (c.shots ?? 0) * SHOT_PREP +
    (find(SYRUP, c.syrup)?.value !== 'none' && c.syrup ? 10 : 0) +
    (c.warm ? WARM_PREP : 0)
  );
}

/** Short summary like "Large · Oat · +1 shot" in the given language. Defaults are left out. */
export function describeChoice(c: Choice, lang: Lang): string {
  const parts: string[] = [];
  if (c.size) parts.push(find(SIZE, c.size)!.label[lang]);
  if (c.milk && c.milk !== 'full') parts.push(find(MILK, c.milk)!.label[lang]);
  if (c.sugar && c.sugar !== 'none') parts.push(`${GROUP_TITLE.sugar[lang]}: ${find(SUGAR, c.sugar)!.label[lang]}`);
  if (c.shots) parts.push(lang === 'ar' ? `${c.shots} شوت إضافي` : `+${c.shots} shot${c.shots > 1 ? 's' : ''}`);
  if (c.syrup && c.syrup !== 'none') parts.push(find(SYRUP, c.syrup)!.label[lang]);
  if (c.warm) parts.push(GROUP_TITLE.warm[lang]);
  if (c.notes?.trim()) parts.push(`“${c.notes.trim()}”`);
  return parts.join(' · ');
}

/** Stable key so identical configurations merge into one basket line. */
export function choiceKey(productId: string, c: Choice): string {
  return [productId, c.size, c.milk, c.sugar, c.shots, c.syrup, c.warm ? 'w' : '', c.notes?.trim() ?? ''].join('|');
}
