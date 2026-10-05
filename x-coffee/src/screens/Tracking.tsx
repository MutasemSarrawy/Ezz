import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { SHOP_LOCATION, formatMinutes } from '../domain/pickup';
import type { Order } from '../domain/types';
import { orderService } from '../services/orderService';
import { money, useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const STEPS: { key: Order['status'] | 'placed'; label: string }[] = [
  { key: 'placed', label: 'Order placed' },
  { key: 'waiting', label: 'Heading to the shop' },
  { key: 'preparing', label: 'Barista is preparing' },
  { key: 'ready', label: 'Ready for pickup' },
];

const stepIndex = (s: Order['status']) =>
  s === 'waiting' ? 1 : s === 'preparing' ? 2 : s === 'ready' || s === 'picked_up' ? 3 : 0;

/** Metres due north of the shop, used by the test tools to fake driving closer. */
const northOfShop = (m: number) => ({ lat: SHOP_LOCATION.lat + m / 111_195, lng: SHOP_LOCATION.lng });

export default function Tracking() {
  const { go, activeOrder: o, setActiveOrderId } = useStore();
  const insets = useSafeAreaInsets();

  if (!o) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 24, alignItems: 'center' }]}>
        <Text style={s.title}>No active order</Text>
        <Button label="Back to menu" onPress={() => go('home')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const now = Date.now();
  const startInSec = Math.max(0, Math.round((o.startAt - now) / 1000));
  const readyInSec =
    o.status === 'preparing' && o.preparingAt ? Math.max(0, Math.round((o.preparingAt + o.prepSeconds * 1000 - now) / 1000)) : 0;
  const idx = stepIndex(o.status);
  const finished = o.status === 'picked_up' || o.status === 'cancelled';

  const headline =
    o.status === 'waiting' ? `Barista starts in ${formatMinutes(startInSec)}`
    : o.status === 'preparing' ? `Ready in about ${formatMinutes(readyInSec)}`
    : o.status === 'ready' ? 'Your order is ready ☕'
    : o.status === 'picked_up' ? 'Enjoy! 🎉'
    : 'Order cancelled';

  const sub =
    o.status === 'waiting'
      ? o.tracking === 'live'
        ? `${(o.distanceMeters / 1000).toFixed(1)} km away · arriving in ~${formatMinutes(o.etaSeconds)}. Updating live.`
        : `Estimated arrival in ~${formatMinutes(o.etaSeconds)} based on your location when you ordered.`
      : o.status === 'preparing'
        ? reasonText(o)
        : o.status === 'ready' ? 'Show order number ' + o.id + ' at the counter.' : '';

  const leave = () => { setActiveOrderId(null); go('home'); };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Text style={s.kicker}>ORDER {o.id} · PICKUP</Text>
      <Text style={s.title} testID="headline">{headline}</Text>
      <Text style={s.sub}>{sub}</Text>

      {o.tracking === 'live' && o.status === 'waiting' && (
        <View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>Live location on</Text></View>
      )}

      <View style={s.card}>
        {STEPS.map((st, i) => {
          const done = i < idx || (i === idx && !finished) || (finished && o.status === 'picked_up');
          const current = i === idx && !finished;
          return (
            <View key={st.key} style={s.stepRow}>
              <View style={[s.dot, done && s.dotDone, current && s.dotCurrent]} />
              <Text style={[s.stepText, !done && { color: colors.inkSoft }, current && { fontWeight: '800' }]}>{st.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        {o.lines.map((l) => (
          <View key={l.productId} style={s.line}>
            <Text style={s.lineText}>{l.qty} × {l.name}</Text>
            <Text style={s.lineText}>{money(l.qty * l.price)}</Text>
          </View>
        ))}
        <View style={[s.line, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}>
          <Text style={[s.lineText, { fontWeight: '800' }]}>Total</Text>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{money(o.total)}</Text>
        </View>
      </View>

      {o.status === 'waiting' && (
        <Button testID="arrived" label="I'm here — start my order now" onPress={() => orderService.arrived(o.id)} />
      )}
      {(o.status === 'waiting' || o.status === 'preparing') && (
        <Button
          variant="ghost"
          label="Cancel order"
          onPress={() =>
            // Alert has no buttons on web, so cancel directly there
            Platform.OS === 'web'
              ? orderService.cancel(o.id)
              : Alert.alert('Cancel this order?', undefined, [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Cancel order', style: 'destructive', onPress: () => orderService.cancel(o.id) },
                ])
          }
        />
      )}
      {o.status === 'ready' && <Button label="I've picked it up" onPress={() => orderService.markPickedUp(o.id)} />}
      {finished && <Button label="Back to menu" onPress={leave} />}
      {!finished && <Button variant="secondary" label="Back to menu" onPress={() => go('home')} />}

      {(__DEV__ || Platform.OS === 'web') && o.tracking === 'live' && o.status === 'waiting' && (
        <View style={s.dev}>
          <Text style={s.devTitle}>TEST TOOLS · simulate live location</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[5000, 2000, 800, 100].map((m) => (
              <Pressable key={m} style={s.devBtn} onPress={() => orderService.sendLocation(o.id, northOfShop(m), 10)}>
                <Text style={s.devBtnText}>{m >= 1000 ? `${m / 1000} km` : `${m} m`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function reasonText(o: Order) {
  switch (o.startReason) {
    case 'live_eta': return 'You\'re close — the barista was alerted based on your live ETA.';
    case 'nearby': return 'You\'re nearby — the barista has started.';
    case 'customer_arrived': return 'Started at your request.';
    default: return 'Timed to be ready when you arrive.';
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: { ...font.label, color: colors.accent },
  title: { ...font.title, color: colors.ink },
  sub: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  livePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepText: { ...font.body, color: colors.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineText: { ...font.body, color: colors.ink },
  dev: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inkSoft, borderRadius: radius.md, padding: 12, gap: 10 },
  devTitle: { ...font.label, color: colors.inkSoft },
  devBtn: { paddingHorizontal: 14, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  devBtnText: { fontWeight: '700', color: colors.ink },
});
