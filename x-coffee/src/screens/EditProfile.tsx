import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header } from '../components/ui';
import { formatMobile, isEmail, normalizeMobile } from '../domain/account';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

export default function EditProfile() {
  const { t, lang, market, session, updateProfile, back } = useStore();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(session?.name ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [phone, setPhone] = useState(session?.phone ? formatMobile(session.phone) : '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const locked = !!session?.phoneVerified;

  const save = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = t('errName');
    if (email.trim() && !isEmail(email)) e.email = t('errEmail');
    const normalized = phone.trim() ? normalizeMobile(market.id, phone) : undefined;
    if (!locked && phone.trim() && !normalized) e.phone = t('errMobile', { country: market.name[lang] });
    setErrors(e);
    if (Object.keys(e).length) return;
    updateProfile({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: locked ? session?.phone : normalized ?? undefined,
      phoneVerified: locked,
    });
    back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('editProfile')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Field label={t('name')} value={name} onChange={setName} error={errors.name} testID="edit-name" />
        <Field
          label={t('mobile')}
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          editable={!locked}
          note={locked ? `✓ ${t('phoneLocked')}` : undefined}
          keyboardType="phone-pad"
          ltr
        />
        <Field label={t('email')} value={email} onChange={setEmail} error={errors.email} placeholder={t('emailPlaceholder')} keyboardType="email-address" ltr testID="edit-email" />
        <Button testID="save-profile" label={t('save')} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; note?: string;
  editable?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad'; ltr?: boolean; testID?: string;
};

function Field({ label, value, onChange, error, placeholder, note, editable = true, keyboardType = 'default', ltr, testID }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        style={[s.input, !editable && { backgroundColor: colors.surfaceAlt, color: colors.inkSoft }, !!error && { borderColor: colors.danger }, ltr && { writingDirection: 'ltr' }]}
      />
      {note ? <Text style={s.note}>{note}</Text> : null}
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink, textAlign: 'auto' },
  note: { fontSize: 13, color: colors.success, textAlign: 'auto' },
  err: { color: colors.danger, fontSize: 13, textAlign: 'auto' },
});
