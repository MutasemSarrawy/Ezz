import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export type Session = { identifier: string; name: string };

const SESSION_KEY = 'x.session';
const BIOMETRIC_KEY = 'x.biometricEnabled';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => /^\+?[0-9\s-]{7,15}$/.test(v);

export function validateIdentifier(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Enter your email or mobile number';
  if (!isEmail(v) && !isPhone(v)) return 'Enter a valid email or mobile number';
  return null;
}

export function validatePassword(v: string): string | null {
  return v.length >= 6 ? null : 'Password must be at least 6 characters';
}

/**
 * Stand-in for the real auth API. Accepts any well-formed credentials so the
 * app can be tested; replace with a call to the coffee house backend.
 */
export async function signIn(identifier: string, _password: string): Promise<Session> {
  await new Promise((r) => setTimeout(r, 450));
  const id = identifier.trim();
  return { identifier: id, name: id.includes('@') ? id.split('@')[0] : 'Guest' };
}

export async function saveSession(s: Session) {
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s)); } catch {}
}

export async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  } catch {}
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1'; } catch { return false; }
}

export async function setBiometricEnabled(on: boolean) {
  try {
    if (on) await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
    else await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  } catch {}
}

/** Prompts Face ID / fingerprint / device passkey-unlock, then restores the saved session. */
export async function signInWithBiometrics(): Promise<Session | null> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in to X',
    cancelLabel: 'Use password',
  });
  if (!res.success) return null;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
