import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header } from '../components/ui';
import { productById } from '../domain/menu';
import type { Order } from '../domain/types';
import type { StringKey } from '../i18n/strings';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const STATUS: Record<Order['status'], { key: StringKey; color: string }> = {
  waiting: { key: 'stWaiting', color: colors.inkSoft },
  preparing: { key: 'stPreparing', color: colors.accent },
  ready: { key: 'stReady', color: colors.success },
  out_for_delivery: { key: 'stOut', color: colors.accent },
  picked_up: { key: 'stPicked', color: colors.success },
  delivered: { key: 'stDelivered', color: colors.success },
  cancelled: { key: 'stCancelled', color: colors.danger },
};

export default function History() {
  const { t, lang, money, orders, addLine, go, setActiveOrderId } = useStore();
  const insets = useSafeAreaInsets();
  const [skipped, setSkipped] = useState(false);

  const when = (ts: number) =>
    new Date(ts).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const reorder = (o: Order) => {
    let missing = false;
    for (const l of o.lines) {
      const p = productById(l.productId);
      if (p) addLine(p, l.choice, l.qty);
      else missing = true;
    }
    setSkipped(missing);
    go('order');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('orderHistory')} top={insets.top} />
      {skipped && <Text style={s.warn}>{t('reorderSkipped')}</Text>}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>🧾</Text>
            <Text style={s.h2}>{t('noOrders')}</Text>
            <Text style={s.muted}>{t('noOrdersBody')}</Text>
            <Button variant="secondary" label={t('browseMenu')} onPress={() => go('home')} />
          </View>
        }
        renderItem={({ item: o }) => {
          const st = STATUS[o.status];
          const active = ['waiting', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
          return (
            <View style={s.card} testID={`history-${o.id}`}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={s.id}>{o.id} · {o.fulfilment === 'delivery' ? '🛵' : '🏪'}</Text>
                  <Text style={s.muted}>{when(o.createdAt)}</Text>
                </View>
                <View style={[s.pill, { borderColor: st.color }]}>
                  <Text style={[s.pillText, { color: st.color }]}>{t(st.key)}</Text>
                </View>
              </View>
              <Text style={s.items} numberOfLines={2}>
                {o.lines.map((l) => `${l.qty}× ${l.name[lang]}`).join(lang === 'ar' ? '، ' : ', ')}
              </Text>
              <View style={s.footer}>
                <Text style={s.total}>{money(o.total, o.currency)}</Text>
                {o.pointsEarned ? <Text style={s.points}>⭐ +{o.pointsEarned}</Text> : null}
                <View style={{ flex: 1 }} />
                {active ? (
                  <Button label={t('track')} onPress={() => { setActiveOrderId(o.id); go('tracking'); }} style={s.btn} />
                ) : (
                  <Button testID={`reorder-${o.id}`} variant="secondary" label={t('reorder')} onPress={() => reorder(o)} style={s.btn} />
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  h2: { ...font.h2, color: colors.ink },
  muted: { color: colors.inkSoft, fontSize: 14, textAlign: 'auto' },
  warn: { marginHorizontal: 16, color: colors.danger, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  id: { ...font.h2, fontSize: 18, color: colors.ink, textAlign: 'auto' },
  pill: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
  items: { ...font.body, color: colors.ink, textAlign: 'auto' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  total: { fontSize: 17, fontWeight: '800', color: colors.ink },
  points: { color: colors.accent, fontWeight: '700' },
  btn: { minHeight: 44, paddingHorizontal: 18 },
});
