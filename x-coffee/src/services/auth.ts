import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getPref, setPref } from './prefs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '../domain/account';

export type Session = Profile & { identifier: string };

const SESSION_KEY = 'x.session';
const BIOMETRIC_KEY = 'x.biometricEnabled';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => /^\+?[0-9\s-]{7,15}$/.test(v);

export function validateIdentifier(raw: string): 'errIdEmpty' | 'errIdInvalid' | null {
  const v = raw.trim();
  if (!v) return 'errIdEmpty';
  if (!isEmail(v) && !isPhone(v)) return 'errIdInvalid';
  return null;
}

export function validatePassword(v: string): 'errPw' | null {
  return v.length >= 6 ? null : 'errPw';
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

// SecureStore has no web implementation; the browser preview keeps the session in local storage.
const secureGet = (k: string) => (Platform.OS === 'web' ? getPref(k) : SecureStore.getItemAsync(k));
const secureSet = (k: string, v: string) => (Platform.OS === 'web' ? setPref(k, v) : SecureStore.setItemAsync(k, v));
const secureDelete = (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k));

export async function saveSession(s: Session) {
  try { await secureSet(SESSION_KEY, JSON.stringify(s)); } catch {}
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await secureGet(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

// ---- Mobile + SMS code sign-up -------------------------------------------

/** The mock accepts this code. A real SMS provider (Twilio, Unifonic, Infobip…) sends a random one. */
export const DEMO_OTP = '123456';
export const OTP_RESEND_SECONDS = 30;

/** Ask the backend to text a 6-digit code to this E.164 number. */
export async function requestOtp(_phone: string): Promise<{ ok: true; resendIn: number }> {
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true, resendIn: OTP_RESEND_SECONDS };
}

/** Check the code. The backend creates the account on first success and returns the session. */
export async function verifyOtp(phone: string, code: string, name: string): Promise<Session | null> {
  await new Promise((r) => setTimeout(r, 600));
  if (code !== DEMO_OTP) return null;
  return { identifier: phone, name: name.trim() || 'Guest', phone, phoneVerified: true };
}

export async function clearSession() {
  try {
    await secureDelete(SESSION_KEY);
    await secureDelete(BIOMETRIC_KEY);
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
  try { return (await secureGet(BIOMETRIC_KEY)) === '1'; } catch { return false; }
}

export async function setBiometricEnabled(on: boolean) {
  try {
    if (on) await secureSet(BIOMETRIC_KEY, '1');
    else await secureDelete(BIOMETRIC_KEY);
  } catch {}
}

/** Prompts Face ID / fingerprint / device passkey-unlock, then restores the saved session. */
export async function signInWithBiometrics(promptMessage: string, cancelLabel: string): Promise<Session | null> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel });
  if (!res.success) return null;
  try {
    const raw = await secureGet(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
