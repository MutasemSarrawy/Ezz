import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import type { Order } from '../domain/types';
import type { StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { driverProgress, formatAddress } from '../domain/delivery';
import { colors, font, radius } from '../theme';

export function payLabel(o: Order, t: (k: StringKey) => string) {
  const p = o.payment;
  if (p.method === 'apple_pay') return t('applePay');
  if (p.method === 'google_pay') return t('googlePay');
  if (p.method === 'wallet') return t('walletMethod');
  if (p.method === 'card') return `${p.cardBrand === 'mada' ? 'mada' : p.cardBrand === 'mastercard' ? 'Mastercard' : 'Visa'} •••• ${p.cardLast4 ?? ''}`;
  return t('counter');
}

const STEPS: StringKey[] = ['stepPlaced', 'stepWaiting', 'stepPreparing', 'stepReady'];

const stepIndex = (s: Order['status']) =>
  s === 'waiting' ? 1 : s === 'preparing' ? 2 : s === 'ready' || s === 'picked_up' ? 3 : 0;

const REASON: Record<NonNullable<Order['startReason']>, StringKey> = {
  live_eta: 'rLiveEta', nearby: 'rNearby', customer_arrived: 'rArrived', on_time: 'rOnTime', immediate: 'rOnTime',
};

export default function Tracking() {
  const { reset, t, lang, mins, money, activeOrder: o, setActiveOrderId } = useStore();
  const insets = useSafeAreaInsets();

  if (!o) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 24, alignItems: 'center', padding: 16 }]}>
        <Text style={s.title}>{t('noActive')}</Text>
        <Button label={t('backToMenu')} onPress={() => reset('home')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (o.fulfilment === 'delivery') return <DeliveryTracking o={o} />;

  const now = Date.now();
  const startInSec = Math.max(0, Math.round((o.startAt - now) / 1000));
  const readyInSec =
    o.status === 'preparing' && o.preparingAt ? Math.max(0, Math.round((o.preparingAt + o.prepSeconds * 1000 - now) / 1000)) : 0;
  const idx = stepIndex(o.status);
  const finished = o.status === 'picked_up' || o.status === 'cancelled';
  const km = (o.distanceMeters / 1000).toFixed(1);

  const headline =
    o.status === 'waiting' ? t('hBaristaStarts', { min: mins(startInSec) })
    : o.status === 'preparing' ? t('hReadyIn', { min: mins(readyInSec) })
    : o.status === 'ready' ? t('hReady')
    : o.status === 'picked_up' ? t('hEnjoy')
    : t('hCancelled');

  const sub =
    o.status === 'waiting'
      ? o.tracking === 'live' ? t('subLive', { km, min: mins(o.etaSeconds) }) : t('subOnce', { min: mins(o.etaSeconds) })
      : o.status === 'preparing' && o.startReason ? t(REASON[o.startReason])
      : o.status === 'ready' ? t('subReady', { id: o.id }) : '';

  const leave = () => { setActiveOrderId(null); reset('home'); };
  const cancel = () =>
    // Alert has no buttons on web, so cancel directly there
    Platform.OS === 'web'
      ? orderService.cancel(o.id)
      : Alert.alert(t('cancelConfirm'), undefined, [
          { text: t('keepIt'), style: 'cancel' },
          { text: t('cancelOrder'), style: 'destructive', onPress: () => orderService.cancel(o.id) },
        ]);

  /** Metres due north of the branch, used by the test tools to fake driving closer. */
  const northOfShop = (m: number) => ({ lat: o.shop.lat + m / 111_195, lng: o.shop.lng });

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Text style={s.kicker}>{t('orderLabel', { id: o.id })}</Text>
      <Text style={s.title} testID="headline">{headline}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}

      {o.tracking === 'live' && o.status === 'waiting' && (
        <View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>{t('liveOn')}</Text></View>
      )}

      <View style={s.card}>
        {STEPS.map((key, i) => {
          const done = i < idx || (i === idx && !finished) || o.status === 'picked_up';
          const current = i === idx && !finished;
          return (
            <View key={key} style={s.stepRow}>
              <View style={[s.dot, done && s.dotDone, current && s.dotCurrent]} />
              <Text style={[s.stepText, !done && { color: colors.inkSoft }, current && { fontWeight: '800' }]}>{t(key)}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        {o.lines.map((l) => (
          <View key={l.key} style={s.line}>
            <View style={{ flex: 1 }}>
              <Text style={s.lineText}>{l.qty} × {l.name[lang]}</Text>
              {l.details[lang] ? <Text style={s.lineSub}>{l.details[lang]}</Text> : null}
            </View>
            <Text style={s.lineText}>{money(l.qty * l.unitPrice, o.currency)}</Text>
          </View>
        ))}
        {o.payment.discount > 0 && (
          <View style={s.line}>
            <Text style={[s.lineText, { color: colors.success }]}>{t('pointsDiscount')}</Text>
            <Text style={[s.lineText, { color: colors.success }]}>− {money(o.payment.discount, o.currency)}</Text>
          </View>
        )}
        <View style={[s.line, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{t('total')}</Text>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{money(o.total, o.currency)}</Text>
        </View>
      </View>

      <View style={s.payRow}>
        <Text style={s.payText}>
          {o.payment.status === 'paid'
            ? `✓ ${t('paidWith', { method: payLabel(o, t) })}`
            : `🏪 ${t('payAtCounter', { amount: money(o.total, o.currency) })}`}
        </Text>
        {o.pointsEarned ? <Text style={s.points}>⭐ {t('pointsEarnedMsg', { points: o.pointsEarned })}</Text> : null}
      </View>

      {o.status === 'waiting' && <Button testID="arrived" label={t('arrivedBtn')} onPress={() => orderService.arrived(o.id)} />}
      {(o.status === 'waiting' || o.status === 'preparing') && <Button variant="ghost" label={t('cancelOrder')} onPress={cancel} />}
      {o.status === 'ready' && <Button label={t('pickedUp')} onPress={() => orderService.markPickedUp(o.id)} />}
      {finished ? <Button label={t('backToMenu')} onPress={leave} /> : <Button variant="secondary" label={t('backToMenu')} onPress={() => reset('home')} />}

      {(__DEV__ || Platform.OS === 'web') && o.tracking === 'live' && o.status === 'waiting' && (
        <View style={s.dev}>
          <Text style={s.devTitle}>{t('testTools')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[5000, 2000, 800, 100].map((m) => (
              <Pressable key={m} testID={`sim-${m}`} style={s.devBtn} onPress={() => orderService.sendLocation(o.id, northOfShop(m), 10)}>
                <Text style={s.devBtnText}>{m >= 1000 ? `${m / 1000} km` : `${m} m`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const D_STEPS: StringKey[] = ['dStepPlaced', 'dStepPreparing', 'dStepDriver', 'dStepOnWay', 'dStepDelivered'];
const dStepIndex = (st: Order['status']) =>
  st === 'preparing' ? 1 : st === 'ready' ? 2 : st === 'out_for_delivery' ? 3 : st === 'delivered' ? 4 : 0;

function DeliveryTracking({ o }: { o: Order }) {
  const { reset, t, lang, isRTL, mins, money, setActiveOrderId } = useStore();
  const insets = useSafeAreaInsets();
  const d = o.delivery!;
  const now = Date.now();
  const elapsed = (now - o.createdAt) / 1000;
  const progress = o.status === 'delivered' ? 1 : o.status === 'out_for_delivery' && d.outAt ? driverProgress(d.outAt, d.travelSeconds, now) : 0;
  const remainingTravel = d.travelSeconds * (1 - progress);
  const finished = o.status === 'delivered' || o.status === 'cancelled';
  const idx = dStepIndex(o.status);

  const headline =
    o.status === 'preparing' ? t('hArrivesIn', { min: mins(Math.max(60, o.etaSeconds - elapsed)) })
    : o.status === 'ready' ? t('hDriverPicking')
    : o.status === 'out_for_delivery' ? t('hOnTheWay', { min: mins(remainingTravel) })
    : o.status === 'delivered' ? t('hDelivered')
    : t('hCancelled');
  const courier = d.courier === 'own' ? t('deliveredByOwn') : t('deliveredByPartner', { partner: d.partner ?? '' });
  const leave = () => { setActiveOrderId(null); reset('home'); };
  const cancel = () =>
    Platform.OS === 'web'
      ? orderService.cancel(o.id)
      : Alert.alert(t('cancelConfirm'), undefined, [
          { text: t('keepIt'), style: 'cancel' },
          { text: t('cancelOrder'), style: 'destructive', onPress: () => orderService.cancel(o.id) },
        ]);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Text style={s.kicker}>{o.id} · {t('bDelivery')}</Text>
      <Text style={s.title} testID="headline">{headline}</Text>
      <Text style={s.sub}>{courier}</Text>

      {o.status !== 'cancelled' && (
        <View style={s.card}>
          <View style={s.routeEnds}>
            <Text style={s.routeEnd}>☕ {o.branchName[lang]}</Text>
            <Text style={s.routeEnd}>🏠 {(o.distanceMeters / 1000).toFixed(1)} {t('km')}</Text>
          </View>
          <View style={s.track}>
            <View style={s.trackBase} />
            <View style={[s.trackFill, { width: `${progress * 100}%` }, isRTL ? { right: 0 } : { left: 0 }]} />
            <Text style={[s.rider, isRTL ? { right: `${progress * 92}%`, transform: [{ scaleX: -1 }] } : { left: `${progress * 92}%` }]}>🛵</Text>
          </View>
          {d.driver && o.status === 'out_for_delivery' && (
            <View style={s.driver}>
              <View style={s.driverAvatar}><Text style={{ fontSize: 22 }}>{d.courier === 'own' ? '🧑' : '🚚'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.lineSub}>{t('yourDriver')}</Text>
                <Text style={s.payText}>{d.driver.name[lang]}</Text>
                <Text style={s.lineSub}>{d.courier === 'own' ? t('motorbike') : d.driver.vehicle}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={s.card}>
        {D_STEPS.map((key, i) => {
          const done = i < idx || (i === idx && !finished) || o.status === 'delivered';
          const current = i === idx && !finished;
          return (
            <View key={key} style={s.stepRow}>
              <View style={[s.dot, done && s.dotDone, current && s.dotCurrent]} />
              <Text style={[s.stepText, !done && { color: colors.inkSoft }, current && { fontWeight: '800' }]}>{t(key)}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        <Text style={s.lineSub}>{t('deliveringTo')}</Text>
        <Text style={s.lineText}>{formatAddress(d.address, lang)}</Text>
        {d.address.notes ? <Text style={s.lineSub}>“{d.address.notes}”</Text> : null}
      </View>

      <View style={s.card}>
        {o.lines.map((l) => (
          <View key={l.key} style={s.line}>
            <View style={{ flex: 1 }}>
              <Text style={s.lineText}>{l.qty} × {l.name[lang]}</Text>
              {l.details[lang] ? <Text style={s.lineSub}>{l.details[lang]}</Text> : null}
            </View>
            <Text style={s.lineText}>{money(l.qty * l.unitPrice, o.currency)}</Text>
          </View>
        ))}
        {o.payment.discount > 0 && (
          <View style={s.line}>
            <Text style={[s.lineText, { color: colors.success }]}>{t('pointsDiscount')}</Text>
            <Text style={[s.lineText, { color: colors.success }]}>− {money(o.payment.discount, o.currency)}</Text>
          </View>
        )}
        <View style={s.line}>
          <Text style={s.lineText}>{t('deliveryFee')}</Text>
          <Text style={s.lineText}>{d.fee ? money(d.fee, o.currency) : t('free')}</Text>
        </View>
        <View style={[s.line, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{t('total')}</Text>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{money(o.total, o.currency)}</Text>
        </View>
      </View>

      <View style={s.payRow}>
        <Text style={s.payText}>
          {o.payment.status === 'paid'
            ? `✓ ${t('paidWith', { method: payLabel(o, t) })}`
            : `💵 ${t('payOnDelivery', { amount: money(o.total, o.currency) })}`}
        </Text>
        {o.pointsEarned ? <Text style={s.points}>⭐ {t('pointsEarnedMsg', { points: o.pointsEarned })}</Text> : null}
      </View>

      {o.status === 'preparing' && <Button variant="ghost" label={t('cancelOrder')} onPress={cancel} />}
      {finished ? <Button label={t('backToMenu')} onPress={leave} /> : <Button variant="secondary" label={t('backToMenu')} onPress={() => reset('home')} />}

      {(__DEV__ || Platform.OS === 'web') && !finished && (
        <View style={s.dev}>
          <Text style={s.devTitle}>{t('testTools')}</Text>
          <Pressable testID="skip-ahead" style={s.devBtn} onPress={() => orderService.skipAhead(o.id, 120)}>
            <Text style={s.devBtnText}>{t('skipAhead')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  routeEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  routeEnd: { fontWeight: '700', color: colors.ink },
  track: { height: 36, justifyContent: 'center', borderRadius: 3 },
  trackBase: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: colors.line, top: 15 },
  trackFill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: colors.accent, top: 15 },
  rider: { position: 'absolute', fontSize: 26, top: 0 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: { ...font.label, color: colors.accent, textAlign: 'auto' },
  title: { ...font.title, color: colors.ink, textAlign: 'auto' },
  sub: { ...font.body, color: colors.inkSoft, lineHeight: 22, textAlign: 'auto' },
  livePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepText: { ...font.body, color: colors.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineText: { ...font.body, color: colors.ink, textAlign: 'auto' },
  lineSub: { fontSize: 13, color: colors.inkSoft, textAlign: 'auto' },
  payRow: { gap: 4 },
  payText: { ...font.body, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  points: { color: colors.accent, fontWeight: '700', textAlign: 'auto' },
  dev: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inkSoft, borderRadius: radius.md, padding: 12, gap: 10 },
  devTitle: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  devBtn: { paddingHorizontal: 14, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  devBtnText: { fontWeight: '700', color: colors.ink },
});
