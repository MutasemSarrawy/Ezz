import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Header } from '../components/ui';
import { MARKETS } from '../domain/market';
import { staffSignIn } from '../services/staffAuth';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const ALL_BRANCHES = Object.values(MARKETS).flatMap((m) => m.branches.map((b) => ({ ...b, flag: m.flag })));

export default function StaffLogin() {
  const { t, lang, setStaff, reset } = useStore();
  const insets = useSafeAreaInsets();
  const [branchId, setBranchId] = useState(ALL_BRANCHES[0].id);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const s = await staffSignIn(branchId, pin);
    setBusy(false);
    if (!s) { setError(t('pinWrong')); setPin(''); return; }
    setStaff(s);
    reset('barista');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('staffLogin')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={s.sub}>{t('staffLoginSub')}</Text>
        <Text style={s.label}>{t('pickBranch')}</Text>
        <View style={s.chips}>
          {ALL_BRANCHES.map((b) => (
            <Chip key={b.id} label={`${b.flag}  ${b.name[lang]}`} selected={branchId === b.id} onPress={() => { setBranchId(b.id); setError(null); }} />
          ))}
        </View>
        <Text style={s.label}>{t('pin')}</Text>
        <TextInput
          testID="staff-pin"
          value={pin}
          onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          onSubmitEditing={submit}
          style={[s.pin, !!error && { borderColor: colors.danger }]}
        />
        {error && <Text style={s.err}>{error}</Text>}
        <Text style={s.hint}>{t('demoPins')}</Text>
        <Button testID="staff-start" label={t('startShift')} onPress={submit} loading={busy} disabled={pin.length !== 4} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'auto' },
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pin: { minHeight: 60, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, fontSize: 28, letterSpacing: 12, textAlign: 'center', color: colors.ink },
  err: { color: colors.danger, fontSize: 14, textAlign: 'auto' },
  hint: { color: colors.inkSoft, fontSize: 13, textAlign: 'center' },
});
