import type { Currency } from './types';

/**
 * Points per spend. Both markets give ~5% back:
 *  - Jordan: 10 points per 1 JD, 100 points = 0.500 JD
 *  - Saudi:   2 points per 1 SAR, 100 points = 2.50 SAR
 * Points are earned on the amount actually paid, once the order is picked up.
 */
export const LOYALTY: Record<Currency, { earnPerUnit: number; valuePer100: number }> = {
  JOD: { earnPerUnit: 10, valuePer100: 0.5 },
  SAR: { earnPerUnit: 2, valuePer100: 2.5 },
};
export const REDEEM_STEP = 100;

export function pointsEarned(amountPaid: number, currency: Currency): number {
  return Math.floor(amountPaid * LOYALTY[currency].earnPerUnit);
}

export function pointsValue(points: number, currency: Currency): number {
  return (Math.floor(points / REDEEM_STEP) * LOYALTY[currency].valuePer100);
}

/**
 * Largest redemption (in whole steps of 100 points) that doesn't exceed the
 * subtotal. Returns the points used and the discount they buy.
 */
export function bestRedemption(points: number, subtotal: number, currency: Currency) {
  const { valuePer100 } = LOYALTY[currency];
  const stepsByPoints = Math.floor(points / REDEEM_STEP);
  const stepsBySubtotal = Math.floor(subtotal / valuePer100 + 1e-9);
  const steps = Math.max(0, Math.min(stepsByPoints, stepsBySubtotal));
  return { points: steps * REDEEM_STEP, discount: Math.round(steps * valuePer100 * 1000) / 1000 };
}
