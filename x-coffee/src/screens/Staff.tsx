import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Button } from '../components/ui';
import { formatAddress } from '../domain/delivery';
import { MARKETS } from '../domain/market';
import type { Order } from '../domain/types';
import type { StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

type Tab = 'make' | 'coming' | 'ready' | 'done';
const TAB_OF: Record<Order['status'], Tab> = {
  waiting: 'coming', preparing: 'make', ready: 'ready', out_for_delivery: 'ready', picked_up: 'done', delivered: 'done', cancelled: 'done',
};
const TABS: { id: Tab; label: StringKey }[] = [
  { id: 'make', label: 'tabMakeNow' }, { id: 'coming', label: 'tabComing' }, { id: 'ready', label: 'tabReady' }, { id: 'done', label: 'tabDone' },
];
const REASON: Record<NonNullable<Order['startReason']>, StringKey> = {
  on_time: 'bOnTime', live_eta: 'bLiveEta', nearby: 'bNearby', customer_arrived: 'bArrived', immediate: 'bImmediate', staff: 'bStaff',
};
const ALL_BRANCHES = Object.values(MARKETS).flatMap((m) => m.branches.map((b) => ({ ...b, flag: m.flag })));

const clock = (secs: number) => {
  const a = Math.abs(Math.round(secs));
  return `${secs < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
};

/**
 * Order queue for the tablet behind the counter. Incoming pickup orders start
 * themselves when the customer is close (with a chime); staff mark drinks ready
 * and hand them over.
 */
export default function Staff() {
  useKeepAwake();
  const { orders, t, lang, mins, money, staff, setStaff, reset, go, pausedBranches } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('make');
  const [sound, setSound] = useState(true);
  const [, force] = useState(0);
  const makeNow = useAudioPlayer(require('../../assets/make-now.wav'));
  const incoming = useAudioPlayer(require('../../assets/incoming.wav'));

  // countdowns and prep timers
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (!staff) reset('staffLogin'); }, [staff, reset]);

  const branch = ALL_BRANCHES.find((b) => b.id === staff?.branchId) ?? ALL_BRANCHES[0];
  const paused = pausedBranches.includes(branch.id);
  // Orders saved before branches existed have no branchId; show them everywhere.
  const mine = useMemo(() => orders.filter((o) => !o.branchId || o.branchId === branch.id), [orders, branch.id]);

  // Chime when an order arrives and a stronger alert when one must be made now.
  const seen = useRef<Map<string, Order['status']> | null>(null);
  useEffect(() => {
    const prev = seen.current;
    const next = new Map(mine.map((o) => [o.id, o.status] as const));
    seen.current = next;
    if (!prev) return; // first render: don't ring for the existing queue
    let alertMake = false;
    let alertNew = false;
    for (const o of mine) {
      const before = prev.get(o.id);
      if (o.status === 'preparing' && before !== 'preparing') alertMake = true;
      else if (!before && o.status === 'waiting') alertNew = true;
    }
    if (alertMake) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (sound) { makeNow.seekTo(0); makeNow.play(); }
      setTab('make');
    } else if (alertNew && sound) {
      incoming.seekTo(0);
      incoming.play();
    }
  }, [mine, sound, makeNow, incoming]);

  const counts = TABS.reduce((acc, x) => ({ ...acc, [x.id]: mine.filter((o) => TAB_OF[o.status] === x.id).length }), {} as Record<Tab, number>);
  const list = mine
    .filter((o) => TAB_OF[o.status] === tab)
    .sort((a, b) => (tab === 'done' ? b.createdAt - a.createdAt : (a.preparingAt ?? a.startAt) - (b.preparingAt ?? b.startAt)))
    .slice(0, tab === 'done' ? 30 : 100);
  const columns = width >= 960 ? 3 : width >= 620 ? 2 : 1;

  const endShift = () => { setStaff(null); reset('home'); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={[s.top, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.branch}>{branch.flag}  {branch.name[lang]}</Text>
          <Text style={s.time}>{new Date().toLocaleTimeString(lang === 'ar' ? 'ar' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        {/* Demo only: on one phone, jump to the customer side to place a test order. */}
        {(__DEV__ || Platform.OS === 'web') && (
          <Pressable testID="customer-view" onPress={() => go('home')} style={s.topBtn}>
            <Text style={s.topBtnText}>📱 {t('customerView')}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setSound((v) => !v)} style={s.topBtn} accessibilityLabel={t('sound')}>
          <Text style={s.topBtnText}>{sound ? '🔔' : '🔕'}</Text>
        </Pressable>
        <Pressable
          testID="pause"
          onPress={() => orderService.setBranchPaused(branch.id, !paused)}
          style={[s.topBtn, paused && { backgroundColor: colors.danger }]}
        >
          <Text style={s.topBtnText}>{paused ? `▶ ${t('resumeOrders')}` : t('pauseOrders')}</Text>
        </Pressable>
        <Pressable testID="end-shift" onPress={endShift} style={s.topBtn}>
          <Text style={s.topBtnText}>{t('endShift')}</Text>
        </Pressable>
      </View>
      {paused && <Text style={s.pausedBar}>{t('pausedNote')}</Text>}

      <View style={s.tabs}>
        {TABS.map((x) => (
          <Pressable key={x.id} testID={`tab-${x.id}`} onPress={() => setTab(x.id)} style={[s.tab, tab === x.id && s.tabOn]}>
            <Text numberOfLines={1} style={[s.tabText, tab === x.id && { color: colors.ink }]}>{t(x.label)}</Text>
            <View style={[s.count, x.id === 'make' && counts.make > 0 && { backgroundColor: colors.accent }]}>
              <Text style={s.countText}>{counts[x.id]}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        keyExtractor={(o) => o.id}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        ListEmptyComponent={<Text style={s.empty}>{t('nothingHere')}</Text>}
        renderItem={({ item: o }) => (
          <View style={{ flex: 1 / columns }}>
            <Ticket o={o} />
          </View>
        )}
      />
    </View>
  );

  function Ticket({ o }: { o: Order }) {
    const now = Date.now();
    const delivery = o.fulfilment === 'delivery';
    const settled = o.payment.status === 'paid' || o.status === 'picked_up' || o.status === 'delivered';
    const prepElapsed = o.preparingAt ? (now - o.preparingAt) / 1000 : 0;
    const late = o.status === 'preparing' && prepElapsed > o.prepSeconds;
    return (
      <View style={[s.ticket, o.status === 'preparing' && { borderColor: late ? colors.danger : colors.accent }]} testID={`ticket-${o.id}`}>
        <View style={s.ticketHead}>
          <Text style={s.ticketId}>{o.id}</Text>
          <Text style={[s.pill, delivery ? s.pillDelivery : s.pillPickup]}>{delivery ? `🛵 ${t('bDelivery')}` : `🏪 ${t('bPickup')}`}</Text>
          <View style={{ flex: 1 }} />
          {o.status === 'preparing' && (
            <Text style={[s.timer, late && { color: colors.danger }]}>{clock(prepElapsed)} / {clock(o.prepSeconds)}</Text>
          )}
        </View>
        <Text style={s.customer}>{o.customer?.name ?? t('guest')} · {t('placedAgo', { min: mins((now - o.createdAt) / 1000) })}</Text>

        <View style={s.items}>
          {o.lines.map((l) => (
            <View key={l.key}>
              <Text style={s.item}><Text style={s.qty}>{l.qty}×</Text> {l.name[lang]}</Text>
              {l.details[lang] ? <Text style={s.details}>{l.details[lang]}</Text> : null}
            </View>
          ))}
        </View>

        <Text style={[s.pay, { color: settled ? colors.success : colors.danger }]}>
          {settled ? `✓ ${t('paid')} · ${money(o.total, o.currency)}` : `⚠ ${t('collect', { amount: money(o.total, o.currency) })}`}
        </Text>

        {o.status === 'waiting' && (
          <View style={s.meta}>
            <Text style={s.metaStrong}>⏱ {t('startsAuto', { min: mins((o.startAt - now) / 1000) })}</Text>
            <Text style={s.metaText}>
              {o.tracking === 'live' ? `● ${t('live')} · ` : ''}
              {t('customerAway', { km: (o.distanceMeters / 1000).toFixed(1), min: mins(o.etaSeconds - (now - o.lastLocationAt) / 1000) })}
            </Text>
          </View>
        )}
        {o.status === 'preparing' && o.fulfilment === 'pickup' && o.startReason && <Text style={s.metaText}>{t(REASON[o.startReason])}</Text>}
        {delivery && o.delivery && (
          <Text style={s.metaText}>
            📍 {formatAddress(o.delivery.address, lang)} · {o.delivery.courier === 'own' ? t('deliveredByOwn') : t('deliveredByPartner', { partner: o.delivery.partner ?? '' })}
          </Text>
        )}
        {o.status === 'out_for_delivery' && o.delivery?.driver && <Text style={s.metaStrong}>🛵 {t('outWithDriver', { name: o.delivery.driver.name[lang] })}</Text>}

        <View style={s.actions}>
          {o.status === 'waiting' && <Button testID={`start-${o.id}`} variant="secondary" label={t('startNowBtn')} onPress={() => orderService.startNow(o.id)} style={s.action} />}
          {o.status === 'preparing' && <Button testID={`ready-${o.id}`} label={`✓ ${t('markReadyBtn')}`} onPress={() => orderService.markReady(o.id)} style={[s.action, { backgroundColor: colors.success }]} />}
          {o.status === 'ready' && !delivery && <Button testID={`handed-${o.id}`} label={t('handedToCustomer')} onPress={() => orderService.markPickedUp(o.id)} style={s.action} />}
          {o.status === 'ready' && delivery && <Button testID={`hand-${o.id}`} label={`🛵 ${t('handToDriver')}`} onPress={() => orderService.handToDriver(o.id)} style={s.action} />}
        </View>
        {(o.status === 'waiting' || o.status === 'preparing') && (
          <Pressable onPress={() => orderService.cancel(o.id)} hitSlop={8} style={s.cancel}>
            <Text style={s.cancelText}>{t('cancelOrder')}</Text>
          </Pressable>
        )}
      </View>
    );
  }
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, flexWrap: 'wrap' },
  branch: { color: colors.onBrand, fontSize: 22, fontWeight: '800', textAlign: 'auto' },
  time: { color: colors.accentSoft, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'auto' },
  topBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: '#3E2A20', justifyContent: 'center' },
  topBtnText: { color: colors.onBrand, fontWeight: '700', fontSize: 14 },
  pausedBar: { backgroundColor: colors.danger, color: colors.onBrand, textAlign: 'center', padding: 8, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: '#3E2A20' },
  tabOn: { backgroundColor: colors.bg },
  tabText: { color: colors.onBrand, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  count: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: colors.onBrand, fontWeight: '800', fontSize: 13 },
  empty: { color: colors.accentSoft, textAlign: 'center', marginTop: 60, fontSize: 16 },
  ticket: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 14, gap: 8, borderWidth: 3, borderColor: 'transparent' },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketId: { fontSize: 22, fontWeight: '900', color: colors.ink },
  pill: { fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  pillPickup: { backgroundColor: colors.accentSoft, color: colors.ink },
  pillDelivery: { backgroundColor: colors.brand, color: colors.onBrand },
  timer: { fontSize: 18, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  customer: { color: colors.inkSoft, fontSize: 14, textAlign: 'auto' },
  items: { gap: 6, paddingVertical: 4 },
  item: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  qty: { color: colors.accent, fontWeight: '900' },
  details: { fontSize: 15, color: colors.accent, fontWeight: '600', textAlign: 'auto' },
  pay: { ...font.label, textAlign: 'auto' },
  meta: { gap: 2 },
  metaStrong: { color: colors.ink, fontWeight: '700', fontSize: 14, textAlign: 'auto' },
  metaText: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, textAlign: 'auto' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  cancel: { alignSelf: 'center', paddingVertical: 6 },
  cancelText: { color: colors.inkSoft, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  action: { flex: 1, minHeight: 48, paddingHorizontal: 14 },
});
