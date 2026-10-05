import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Header } from '../components/ui';
import { MARKETS } from '../domain/market';
import type { MarketId } from '../domain/types';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

export default function Settings() {
  const { t, lang, setLang, market, setMarket, back } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('settings')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={s.card}>
          <Text style={s.h2}>{t('language')}</Text>
          <View style={s.row}>
            <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
            <Chip label="العربية" selected={lang === 'ar'} onPress={() => setLang('ar')} />
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.h2}>{t('country')}</Text>
          <View style={s.row}>
            {(Object.keys(MARKETS) as MarketId[]).map((id) => {
              const m = MARKETS[id];
              return (
                <Chip
                  key={id}
                  label={`${m.flag}  ${m.name[lang]}`}
                  sub={`${m.currency} · ${m.branches.map((b) => b.name[lang]).join(', ')}`}
                  selected={market.id === id}
                  onPress={() => setMarket(id)}
                />
              );
            })}
          </View>
          <Text style={s.muted}>{t('countryNote')}</Text>
        </View>
        <Button label={t('done')} onPress={back} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  h2: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
});
