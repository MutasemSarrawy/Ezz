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
  const { go, setSession } = useStore();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; pw?: string }>({});
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
    go('home');
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
        Alert.alert('Faster next time?', 'Use Face ID / fingerprint or your device passkey to sign in.', [
          { text: 'Not now', onPress: () => finish(s) },
          { text: 'Enable', onPress: async () => { await setBiometricEnabled(true); finish(s); } },
        ]);
      } else {
        finish(s);
      }
    } finally {
      setBusy(false);
    }
  };

  const biometric = async () => {
    if (!bioReady) return Alert.alert('Not available', 'Set up Face ID, fingerprint or a screen lock on this device first.');
    if (!bioEnabled) return Alert.alert('Not enabled yet', 'Sign in once with your password, then choose “Enable”.');
    const s = await signInWithBiometrics();
    if (s) finish(s);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.body, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <XLogo size={64} />
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub}>Sign in to order ahead and skip the line.</Text>

        <View style={s.field}>
          <Text style={s.label}>Email or mobile number</Text>
          <TextInput
            testID="identifier"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@email.com or +962 7…"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            style={[s.input, errors.id && s.inputErr]}
          />
          {errors.id && <Text style={s.err}>{errors.id}</Text>}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
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
              style={[s.input, { paddingRight: 64 }, errors.pw && s.inputErr]}
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} style={s.eye} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              <Text style={s.eyeText}>{show ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          {errors.pw && <Text style={s.err}>{errors.pw}</Text>}
        </View>

        <Button testID="signin" label="Sign in" onPress={submit} loading={busy} style={{ marginTop: 8 }} />

        <View style={s.divider}>
          <View style={s.line} /><Text style={s.or}>or</Text><View style={s.line} />
        </View>

        <Button testID="biometric" variant="secondary" label="🔐  Passkey / biometric" onPress={biometric} />

        <Button testID="guest" variant="ghost" label="Skip for now" onPress={() => go('home')} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 24, gap: 6 },
  title: { ...font.title, color: colors.ink, marginTop: 24 },
  sub: { ...font.body, color: colors.inkSoft, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { ...font.label, color: colors.inkSoft, marginBottom: 6 },
  // 16px minimum stops iOS from zooming into the field on focus
  input: {
    minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5,
    borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink,
  },
  inputErr: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 13, marginTop: 6 },
  eye: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { color: colors.accent, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.inkSoft },
});
