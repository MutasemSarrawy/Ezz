import { getJSON, setJSON } from './prefs';

export type StaffSession = { branchId: string; since: number };

/**
 * Stand-in for staff accounts. Each branch has a 4-digit PIN for the shared
 * tablet behind the counter. With the real backend, staff sign in with their
 * own account and their role/branch comes from the server.
 */
const DEMO_PINS: Record<string, string> = { 'amm-1': '1111', 'ruh-1': '2222' };
export const demoPin = (branchId: string) => DEMO_PINS[branchId] ?? '0000';

export async function staffSignIn(branchId: string, pin: string): Promise<StaffSession | null> {
  await new Promise((r) => setTimeout(r, 300));
  if (pin !== demoPin(branchId)) return null;
  const s = { branchId, since: Date.now() };
  await setJSON('x.staff', s);
  return s;
}

export const loadStaffSession = () => getJSON<StaffSession | null>('x.staff', null);
export const staffSignOut = () => setJSON('x.staff', null);
