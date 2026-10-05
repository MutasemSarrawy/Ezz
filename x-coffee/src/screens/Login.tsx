import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, XLogo } from '../components/ui';
import {
  biometricAvailable,
  isBiometricEnabled,
  saveSession,
  setBiometricEnabled,
  signIn,
  signInWithBiometrics,
  validateIdentifier,
  validatePassword,
} from '../services/auth';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

export default function Login() {
  const { reset, setSession, t, lang, setLang, isRTL } = useStore();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ id?: 'errIdEmpty' | 'errIdInvalid'; pw?: 'errPw' }>({});
  const [busy, setBusy] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      setBioReady(await biometricAvailable());
      setBioEnabled(await isBiometricEnabled());
    })();
  }, []);

  const finish = (s: { identifier: string; name: string }) => {
    setSession(s);
    reset('home');
  };

  const submit = async () => {
    const e = { id: validateIdentifier(identifier) ?? undefined, pw: validatePassword(password) ?? undefined };
    setErrors(e);
    if (e.id || e.pw) return;
    setBusy(true);
    try {
      const s = await signIn(identifier, password);
      await saveSession(s);
      if (bioReady && !bioEnabled) {
        Alert.alert(t('bioOfferTitle'), t('bioOfferBody'), [
          { text: t('notNow'), onPress: () => finish(s) },
          { text: t('enable'), onPress: async () => { await setBiometricEnabled(true); finish(s); } },
        ]);
      } else {
        finish(s);
      }
    } finally {
      setBusy(false);
    }
  };

  const biometric = async () => {
    if (!bioReady) return Alert.alert(t('bioUnavailableTitle'), t('bioUnavailableBody'));
    if (!bioEnabled) return Alert.alert(t('bioNotEnabledTitle'), t('bioNotEnabledBody'));
    const s = await signInWithBiometrics(t('bioPrompt'), t('usePassword'));
    if (s) finish(s);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.body, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={s.topRow}>
          <XLogo size={64} />
          <Pressable
            testID="lang-toggle"
            onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            style={s.langBtn}
            accessibilityLabel={lang === 'ar' ? 'English' : 'العربية'}
          >
            <Text style={s.langText}>{lang === 'ar' ? 'English' : 'العربية'}</Text>
          </Pressable>
        </View>
        <Text style={s.title}>{t('welcome')}</Text>
        <Text style={s.sub}>{t('signInSub')}</Text>

        <View style={s.field}>
          <Text style={s.label}>{t('idLabel')}</Text>
          <TextInput
            testID="identifier"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={t('idPlaceholder')}
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            style={[s.input, errors.id && s.inputErr]}
          />
          {errors.id && <Text style={s.err}>{t(errors.id)}</Text>}
        </View>

        <View style={s.field}>
          <Text style={s.label}>{t('pwLabel')}</Text>
          <View>
            <TextInput
              testID="password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor={colors.inkSoft}
              secureTextEntry={!show}
              textContentType="password"
              autoComplete="password"
              onSubmitEditing={submit}
              style={[s.input, isRTL ? { paddingLeft: 72 } : { paddingRight: 72 }, errors.pw && s.inputErr]}
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} style={[s.eye, isRTL ? { left: 16 } : { right: 16 }]} accessibilityLabel={show ? t('hide') : t('show')}>
              <Text style={s.eyeText}>{show ? t('hide') : t('show')}</Text>
            </Pressable>
          </View>
          {errors.pw && <Text style={s.err}>{t(errors.pw)}</Text>}
        </View>

        <Button testID="signin" label={t('signIn')} onPress={submit} loading={busy} style={{ marginTop: 8 }} />

        <View style={s.divider}>
          <View style={s.line} /><Text style={s.or}>{t('or')}</Text><View style={s.line} />
        </View>

        <Button testID="biometric" variant="secondary" label={`🔐  ${t('biometric')}`} onPress={biometric} />

        <Button testID="guest" variant="ghost" label={t('skip')} onPress={() => reset('home')} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 24, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, justifyContent: 'center' },
  langText: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  title: { ...font.title, color: colors.ink, marginTop: 24, textAlign: 'auto' },
  sub: { ...font.body, color: colors.inkSoft, marginBottom: 20, textAlign: 'auto' },
  field: { marginBottom: 14 },
  label: { ...font.label, color: colors.inkSoft, marginBottom: 6, textAlign: 'auto' },
  // 16px minimum stops iOS from zooming into the field on focus
  input: {
    minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5,
    borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink, textAlign: 'auto',
  },
  inputErr: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 13, marginTop: 6, textAlign: 'auto' },
  eye: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { color: colors.accent, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.inkSoft },
});
