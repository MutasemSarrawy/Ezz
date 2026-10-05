import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Header } from '../components/ui';
import { DIAL_CODE, formatMobile, ltr, normalizeMobile } from '../domain/account';
import { MARKETS } from '../domain/market';
import type { MarketId } from '../domain/types';
import { DEMO_OTP, requestOtp, saveSession, verifyOtp } from '../services/auth';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const CODE_LENGTH = 6;

/** Mobile number + SMS code. The account is created on the first successful code. */
export default function SignUp() {
  const { t, lang, market, setMarket, setSession, reset } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState<MarketId>(market.id);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const codeInput = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const send = async () => {
    const e: typeof errors = {};
    const normalized = normalizeMobile(country, mobile);
    if (!name.trim()) e.name = t('errName');
    if (!normalized) e.mobile = t('errMobile', { country: MARKETS[country].name[lang] });
    setErrors(e);
    if (e.name || e.mobile) return;
    setBusy(true);
    try {
      const res = await requestOtp(normalized!);
      setPhone(normalized!);
      setResendIn(res.resendIn);
      setCode('');
      setNotice(null);
      setStep('code');
      setTimeout(() => codeInput.current?.focus(), 200);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const res = await requestOtp(phone);
    setResendIn(res.resendIn);
    setNotice(t('codeSent'));
  };

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH) return;
    setBusy(true);
    try {
      const s = await verifyOtp(phone, value, name);
      if (!s) {
        setErrors({ code: t('codeWrong') });
        setCode('');
        return;
      }
      await saveSession(s);
      setSession(s);
      // The number's country decides prices and pickup branch from now on.
      setMarket(country);
      reset('home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={step === 'phone' ? t('signupTitle') : t('codeTitle')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {step === 'phone' ? (
          <>
            <Text style={s.sub}>{t('signupSub')}</Text>

            <View style={s.field}>
              <Text style={s.label}>{t('yourName')}</Text>
              <TextInput
                testID="signup-name"
                value={name}
                onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
                placeholder={t('namePlaceholder')}
                placeholderTextColor={colors.inkSoft}
                autoComplete="name"
                textContentType="name"
                style={[s.input, !!errors.name && s.inputErr]}
              />
              {errors.name && <Text style={s.err}>{errors.name}</Text>}
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('mobile')}</Text>
              <View style={s.countries}>
                {(Object.keys(MARKETS) as MarketId[]).map((id) => (
                  <Chip key={id} label={`${MARKETS[id].flag}  ${DIAL_CODE[id]}`} selected={country === id} onPress={() => setCountry(id)} />
                ))}
              </View>
              <View style={[s.phoneRow, !!errors.mobile && s.inputErr]}>
                <Text style={s.dial}>{DIAL_CODE[country]}</Text>
                <TextInput
                  testID="signup-mobile"
                  value={mobile}
                  onChangeText={(v) => { setMobile(v.replace(/[^\d\s+]/g, '')); setErrors((e) => ({ ...e, mobile: undefined })); }}
                  placeholder={country === 'JO' ? '79 123 4567' : '51 234 5678'}
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  onSubmitEditing={send}
                  style={s.phoneInput}
                />
              </View>
              {errors.mobile && <Text style={s.err}>{errors.mobile}</Text>}
            </View>

            <Button testID="send-code" label={t('sendCode')} onPress={send} loading={busy} />
            <Button variant="ghost" label={t('haveAccount')} onPress={() => reset('login')} />
          </>
        ) : (
          <>
            <Text style={s.sub}>{t('codeSub', { phone: ltr(formatMobile(phone)) })}</Text>

            {/* One hidden input drives six boxes, so paste and SMS autofill work. */}
            <Pressable onPress={() => codeInput.current?.focus()} style={s.boxes} accessibilityLabel={t('codeTitle')}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <View key={i} style={[s.box, code.length === i && s.boxActive, !!errors.code && s.inputErr]}>
                  <Text style={s.boxText}>{code[i] ?? ''}</Text>
                </View>
              ))}
            </Pressable>
            <TextInput
              ref={codeInput}
              testID="otp"
              value={code}
              onChangeText={(v) => {
                const d = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(d);
                setErrors({});
                if (d.length === CODE_LENGTH) verify(d);
              }}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              style={s.hiddenInput}
            />
            {errors.code && <Text style={s.err}>{errors.code}</Text>}
            {notice && <Text style={[s.sub, { color: colors.success }]}>{notice}</Text>}
            <Text style={s.hint}>{t('demoCode', { code: DEMO_OTP })}</Text>

            <Button testID="verify" label={t('verify')} onPress={() => verify()} loading={busy} disabled={code.length !== CODE_LENGTH} />
            <View style={s.links}>
              <Pressable onPress={() => setStep('phone')} hitSlop={8}>
                <Text style={s.link}>{t('changeNumber')}</Text>
              </Pressable>
              <Pressable onPress={resend} disabled={resendIn > 0} hitSlop={8}>
                <Text style={[s.link, resendIn > 0 && { color: colors.inkSoft }]}>
                  {resendIn > 0 ? t('resendIn', { s: resendIn }) : t('resend')}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  sub: { ...font.body, color: colors.inkSoft, lineHeight: 22, textAlign: 'auto' },
  field: { gap: 8 },
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink, textAlign: 'auto' },
  inputErr: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 13, textAlign: 'auto' },
  countries: { flexDirection: 'row', gap: 8 },
  // phone numbers always read left-to-right, even in Arabic
  phoneRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, gap: 10 },
  dial: { fontSize: 16, fontWeight: '700', color: colors.ink },
  phoneInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 48, writingDirection: 'ltr', textAlign: 'left', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  boxes: { flexDirection: 'row', direction: 'ltr', gap: 8, justifyContent: 'center' },
  box: { width: 46, height: 56, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: colors.accent, borderWidth: 2 },
  boxText: { fontSize: 24, fontWeight: '800', color: colors.ink },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  hint: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
