import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Header } from '../components/ui';
import { uid } from '../domain/account';
import { LABELS, type Address, type AddressLabel } from '../domain/delivery';
import type { LatLng } from '../domain/types';
import { getCurrentLocation, requestLocationPermission } from '../services/location';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

type Fields = Pick<Address, 'area' | 'street' | 'building' | 'floor' | 'apartment' | 'notes'>;

export default function AddressScreen() {
  const { t, lang, market, saveAddress, back } = useStore();
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState<AddressLabel>('home');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [f, setF] = useState<Fields>({ area: '', street: '', building: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | 'location', string>>>({});
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const set = (k: keyof Fields) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const locate = async () => {
    setLocError(null);
    setLocating(true);
    try {
      const perm = await requestLocationPermission();
      if (perm !== 'granted') return setLocError(perm === 'blocked' ? t('permBlocked') : t('permDenied'));
      setLocation(await getCurrentLocation());
      setErrors((e) => ({ ...e, location: undefined }));
    } catch {
      setLocError(t('permFailed'));
    } finally {
      setLocating(false);
    }
  };

  // Web preview can't read GPS inside the sandbox: pin a point 3 km from the branch.
  const demo = () => {
    const b = market.branches[0].location;
    setLocation({ lat: b.lat + 3000 / 111_195, lng: b.lng });
    setErrors((e) => ({ ...e, location: undefined }));
  };

  const save = () => {
    const e: typeof errors = {};
    if (!location) e.location = t('needLocation');
    if (!f.area.trim()) e.area = t('required');
    if (!f.street.trim()) e.street = t('required');
    if (!f.building.trim()) e.building = t('required');
    setErrors(e);
    if (Object.keys(e).length) return;
    const trim = (v?: string) => v?.trim() || undefined;
    saveAddress({
      id: uid('addr'), label, location: location!,
      area: f.area.trim(), street: f.street.trim(), building: f.building.trim(),
      floor: trim(f.floor), apartment: trim(f.apartment), notes: trim(f.notes),
    });
    back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('addressTitle')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          {location ? (
            <Text style={s.pinned}>{t('locationPinned')}</Text>
          ) : (
            <Text style={[s.muted, errors.location && { color: colors.danger }]}>{errors.location ?? t('needLocation')}</Text>
          )}
          <Button testID="addr-locate" variant={location ? 'secondary' : 'primary'} label={`📍 ${t('useCurrentLocation')}`} onPress={locate} loading={locating} />
          {Platform.OS === 'web' && <Button testID="addr-demo" variant="secondary" label={t('demoLocation')} onPress={demo} />}
          {locError && <Text style={s.err}>{locError}</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t('labelTitle')}</Text>
          <View style={s.chips}>
            {(Object.keys(LABELS) as AddressLabel[]).map((k) => (
              <Chip key={k} label={`${LABELS[k].icon}  ${LABELS[k][lang]}`} selected={label === k} onPress={() => setLabel(k)} />
            ))}
          </View>
          <Field testID="addr-area" label={t('area')} value={f.area} onChange={set('area')} error={errors.area} />
          <Field testID="addr-street" label={t('street')} value={f.street} onChange={set('street')} error={errors.street} />
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field testID="addr-building" label={t('building')} value={f.building} onChange={set('building')} error={errors.building} /></View>
            <View style={{ flex: 1 }}><Field label={`${t('floor')} (${t('optional')})`} value={f.floor ?? ''} onChange={set('floor')} /></View>
            <View style={{ flex: 1 }}><Field label={`${t('apartment')} (${t('optional')})`} value={f.apartment ?? ''} onChange={set('apartment')} /></View>
          </View>
          <Field label={`${t('directions')} (${t('optional')})`} value={f.notes ?? ''} onChange={set('notes')} placeholder={t('directionsPlaceholder')} multiline />
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="addr-save" label={t('saveAddress')} onPress={save} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, error, placeholder, multiline, testID }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; multiline?: boolean; testID?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        multiline={multiline}
        style={[s.input, multiline && { minHeight: 72, paddingTop: 14, textAlignVertical: 'top' }, !!error && { borderColor: colors.danger }]}
      />
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  pinned: { color: colors.success, fontWeight: '700', fontSize: 16, textAlign: 'auto' },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, fontSize: 16, color: colors.ink, textAlign: 'auto' },
  err: { color: colors.danger, fontSize: 13, textAlign: 'auto' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
