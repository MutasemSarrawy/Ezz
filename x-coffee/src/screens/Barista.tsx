import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button } from '../components/ui';
import { formatMinutes } from '../domain/pickup';
import type { Order } from '../domain/types';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const LABEL: Record<Order['status'], string> = {
  waiting: 'INCOMING', preparing: 'MAKE NOW', ready: 'READY', picked_up: 'DONE', cancelled: 'CANCELLED',
};
const TINT: Record<Order['status'], string> = {
  waiting: colors.inkSoft, preparing: colors.accent, ready: colors.success, picked_up: colors.line, cancelled: colors.danger,
};
const REASON: Record<NonNullable<Order['startReason']>, string> = {
  on_time: 'Timed from ETA', live_eta: 'Live ETA reached prep time', nearby: 'Customer is nearby',
  customer_arrived: 'Customer tapped “I’m here”', immediate: 'Customer is already close',
};

/**
 * Stand-in for the coffee house's staff app. In production this is a separate
 * app/screen driven by the same backend; here it reads the same in-memory store
 * so the whole pickup flow can be tried on one device.
 */
export default function Barista() {
  const { go, orders } = useStore();
  const insets = useSafeAreaInsets();

  // buzz when a new order flips to "make now"
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const o of orders) {
      if (o.status === 'preparing' && !seen.current.has(o.id)) {
        seen.current.add(o.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  }, [orders]);

  const rank = (o: Order) => ({ preparing: 0, waiting: 1, ready: 2, picked_up: 3, cancelled: 4 })[o.status];
  const data = [...orders].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => go('home')} hitSlop={12} accessibilityLabel="Back" style={s.back}>
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
        <Text style={s.title}>Barista console</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Text style={s.empty}>No orders yet. Place a pickup order and it appears here.</Text>}
        renderItem={({ item: o }) => {
          const startIn = Math.max(0, Math.round((o.startAt - Date.now()) / 1000));
          return (
            <View style={[s.card, { borderLeftColor: TINT[o.status] }]}>
              <View style={s.head}>
                <Text style={s.id}>{o.id}</Text>
                <Text style={[s.status, { color: TINT[o.status] }]}>{LABEL[o.status]}</Text>
              </View>
              {o.lines.map((l) => <Text key={l.productId} style={s.line}>{l.qty} × {l.name}</Text>)}
              <Text style={s.meta}>
                {(o.distanceMeters / 1000).toFixed(1)} km · {o.travel} · {o.tracking === 'live' ? 'live location' : 'location shared once'}
              </Text>
              {o.status === 'waiting' && <Text style={s.meta}>Start in ~{formatMinutes(startIn)} · prep {formatMinutes(o.prepSeconds)} · ETA {formatMinutes(o.etaSeconds)}</Text>}
              {o.status === 'preparing' && o.startReason && <Text style={s.meta}>{REASON[o.startReason]}</Text>}
              {o.status === 'ready' && <Button label="Handed over" onPress={() => orderService.markPickedUp(o.id)} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 36, lineHeight: 38, color: colors.ink },
  title: { ...font.title, color: colors.ink },
  empty: { color: colors.inkSoft, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 6, borderLeftWidth: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  id: { ...font.h2, color: colors.ink },
  status: { ...font.label },
  line: { ...font.body, color: colors.ink },
  meta: { color: colors.inkSoft, fontSize: 14 },
});
