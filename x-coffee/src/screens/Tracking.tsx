import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import type { Order } from '../domain/types';
import type { StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

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
        <View style={[s.line, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{t('total')}</Text>
          <Text style={[s.lineText, { fontWeight: '800' }]}>{money(o.total, o.currency)}</Text>
        </View>
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

const s = StyleSheet.create({
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
  dev: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inkSoft, borderRadius: radius.md, padding: 12, gap: 10 },
  devTitle: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  devBtn: { paddingHorizontal: 14, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  devBtnText: { fontWeight: '700', color: colors.ink },
});
