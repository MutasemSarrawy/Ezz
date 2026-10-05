import React, { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Header } from '../components/ui';
import type { Order } from '../domain/types';
import { formatAddress } from '../domain/delivery';
import type { StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

const LABEL: Record<Order['status'], StringKey> = {
  waiting: 'sWaiting', preparing: 'sPreparing', ready: 'sReady', out_for_delivery: 'sOut', picked_up: 'sDone', delivered: 'sDelivered', cancelled: 'sCancelled',
};
const TINT: Record<Order['status'], string> = {
  waiting: colors.inkSoft, preparing: colors.accent, ready: colors.success, out_for_delivery: colors.inkSoft, picked_up: colors.line, delivered: colors.line, cancelled: colors.danger,
};
const REASON: Record<NonNullable<Order['startReason']>, StringKey> = {
  on_time: 'bOnTime', live_eta: 'bLiveEta', nearby: 'bNearby', customer_arrived: 'bArrived', immediate: 'bImmediate',
};
const RANK: Record<Order['status'], number> = { preparing: 0, waiting: 1, ready: 2, out_for_delivery: 3, picked_up: 4, delivered: 4, cancelled: 5 };

/**
 * Stand-in for the coffee house's staff app. In production this is a separate
 * app/screen driven by the same backend; here it reads the same in-memory store
 * so the whole pickup flow can be tried on one device.
 */
export default function Barista() {
  const { orders, t, lang, mins, isRTL, money } = useStore();
  const insets = useSafeAreaInsets();

  // buzz when an order flips to "make now"
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const o of orders) {
      if (o.status === 'preparing' && !seen.current.has(o.id)) {
        seen.current.add(o.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  }, [orders]);

  const data = [...orders].sort((a, b) => RANK[a.status] - RANK[b.status] || a.createdAt - b.createdAt);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('baristaTitle')} top={insets.top} />
      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Text style={s.empty}>{t('baristaEmpty')}</Text>}
        renderItem={({ item: o }) => {
          const startIn = Math.max(0, Math.round((o.startAt - Date.now()) / 1000));
          return (
            <View style={[s.card, isRTL ? { borderRightWidth: 6, borderRightColor: TINT[o.status] } : { borderLeftWidth: 6, borderLeftColor: TINT[o.status] }]}>
              <View style={s.head}>
                <Text style={s.id}>{o.id} <Text style={s.kind}>· {o.fulfilment === 'delivery' ? `🛵 ${t('bDelivery')}` : `🏪 ${t('bPickup')}`}</Text></Text>
                <Text style={[s.status, { color: TINT[o.status] }]}>{t(LABEL[o.status])}</Text>
              </View>
              {(() => {
                // cash orders count as paid once handed over
                const settled = o.payment.status === 'paid' || o.status === 'picked_up' || o.status === 'delivered';
                return (
                  <Text style={[s.pay, { color: settled ? colors.success : colors.danger }]}>
                    {settled ? `✓ ${t('paid')} · ${money(o.total, o.currency)}` : `⚠ ${t('collect', { amount: money(o.total, o.currency) })}`}
                  </Text>
                );
              })()}
              {o.lines.map((l) => (
                <View key={l.key}>
                  <Text style={s.line}>{l.qty} × {l.name[lang]}</Text>
                  {l.details[lang] ? <Text style={s.details}>{l.details[lang]}</Text> : null}
                </View>
              ))}
              {o.delivery ? (
                <Text style={s.meta}>
                  {(o.distanceMeters / 1000).toFixed(1)} km · {o.delivery.courier === 'own' ? t('deliveredByOwn') : t('deliveredByPartner', { partner: o.delivery.partner ?? '' })}
                  {'\n'}{formatAddress(o.delivery.address, lang)}
                </Text>
              ) : (
                <Text style={s.meta}>
                  {(o.distanceMeters / 1000).toFixed(1)} km · {t(o.travel)} · {o.tracking === 'live' ? t('liveLocation') : t('sharedOnce')}
                </Text>
              )}
              {o.status === 'waiting' && (
                <Text style={s.meta}>{t('startMeta', { start: mins(startIn), prep: mins(o.prepSeconds), eta: mins(o.etaSeconds) })}</Text>
              )}
              {o.status === 'preparing' && o.fulfilment === 'pickup' && o.startReason && <Text style={s.meta}>{t(REASON[o.startReason])}</Text>}
              {o.status === 'ready' && o.fulfilment === 'pickup' && <Button label={t('handedOver')} onPress={() => orderService.markPickedUp(o.id)} />}
              {o.status === 'ready' && o.fulfilment === 'delivery' && <Button testID={`hand-${o.id}`} label={`🛵 ${t('handToDriver')}`} onPress={() => orderService.handToDriver(o.id)} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  empty: { color: colors.inkSoft, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  id: { ...font.h2, color: colors.ink },
  status: { ...font.label },
  kind: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  line: { ...font.body, color: colors.ink, fontWeight: '600', textAlign: 'auto' },
  details: { fontSize: 14, color: colors.accent, textAlign: 'auto' },
  pay: { ...font.label, textAlign: 'auto' },
  meta: { color: colors.inkSoft, fontSize: 14, textAlign: 'auto' },
});
