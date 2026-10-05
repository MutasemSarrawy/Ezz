import React, { useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, Segmented, Stepper } from '../components/ui';
import { describeChoice, unitPrepSeconds } from '../domain/options';
import {
  SAFETY_BUFFER_SECONDS,
  estimatePrepSeconds,
  estimateTravelSeconds,
  haversineMeters,
  secondsUntilStart,
} from '../domain/pickup';
import type { FulfilmentMode, LatLng, TrackingMode, TravelMode } from '../domain/types';
import { LABELS, formatAddress, nearestBranch, quoteDelivery } from '../domain/delivery';
import { getCurrentLocation, requestLocationPermission } from '../services/location';
import { orderService } from '../services/orderService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

type Preview = { location: LatLng; distance: number };

export default function Order() {
  const { go, reset, t, lang, mins, money, market, lines, subtotal, changeQty, linePrice, setPendingOrder, pausedBranches, fulfilment: mode, setFulfilment: setMode, addresses, removeAddress, selectedAddressId, setSelectedAddressId } = useStore();
  const insets = useSafeAreaInsets();
  const [travel, setTravel] = useState<TravelMode>('driving');
  const [tracking, setTracking] = useState<TrackingMode>('live');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [locating, setLocating] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const [permError, setPermError] = useState<'denied' | 'blocked' | 'failed' | null>(null);

  // Pickup uses the branch nearest the customer once we know where they are.
  const branch = preview ? nearestBranch(market, preview.location) : market.branches[0];
  const shop = branch.location;
  const prep = useMemo(
    () => estimatePrepSeconds(lines.map((l) => ({ prepSeconds: unitPrepSeconds(l.product, l.choice), qty: l.qty })), orderService.queueSeconds()),
    [lines],
  );

  // Basket, travel mode or branch changes re-derive the timing from the saved location.
  const fresh = useMemo(() => {
    if (!preview) return null;
    const distance = haversineMeters(preview.location, shop);
    return { location: preview.location, distance, eta: estimateTravelSeconds(distance, travel), prep };
  }, [preview, travel, prep, shop]);

  const showTiming = (location: LatLng) => {
    setPreview({ location, distance: haversineMeters(location, shop) });
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 150);
  };

  const shareLocation = async () => {
    setPermError(null);
    setLocating(true);
    try {
      const perm = await requestLocationPermission();
      if (perm !== 'granted') return setPermError(perm);
      showTiming(await getCurrentLocation());
    } catch {
      setPermError('failed');
    } finally {
      setLocating(false);
    }
  };

  // Web preview can't read GPS inside the sandbox, so offer a fixed point 3 km from the branch.
  const useDemoLocation = () => {
    setPermError(null);
    showTiming({ lat: shop.lat + 3000 / 111_195, lng: shop.lng });
  };

  const address = addresses.find((a) => a.id === selectedAddressId) ?? addresses[0];
  const quote = useMemo(
    () => (address ? quoteDelivery(market, address.location, subtotal, prep) : null),
    [address, market, subtotal, prep],
  );
  const branchClosed = pausedBranches.includes(mode === 'delivery' && quote ? quote.branch.id : branch.id);
  const canDeliver = !!quote && quote.ok && quote.belowMinimumBy === 0;

  const toCheckout = () => {
    if (mode === 'pickup') {
      if (!fresh) return;
      setPendingOrder({ kind: 'pickup', location: fresh.location, tracking, travel, prepSeconds: fresh.prep, branch });
    } else {
      if (!address || !quote || !quote.ok || !canDeliver) return;
      setPendingOrder({ kind: 'delivery', address, quote, prepSeconds: prep });
    }
    go('checkout');
  };

  const startIn = fresh ? secondsUntilStart(fresh.eta, fresh.prep) : 0;
  const empty = lines.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('yourOrder')} top={insets.top} />

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140, gap: 16 }}>
        {branchClosed && (
          <View style={s.warn} testID="branch-paused"><Text style={s.warnText}>⏸ {t('branchPaused')}</Text></View>
        )}
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'delivery', label: `🛵  ${t('delivery')}` },
            { value: 'pickup', label: `🏪  ${t('pickup')}` },
          ]}
        />

        <View style={s.card}>
          {empty ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>☕</Text>
              <Text style={s.itemName}>{t('emptyBasket')}</Text>
              <Button variant="secondary" label={t('browseMenu')} onPress={() => reset('home')} />
            </View>
          ) : (
            lines.map((l) => {
              const details = describeChoice(l.choice, lang);
              return (
                <View key={l.key} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{l.product.name[lang]}</Text>
                    {details ? <Text style={s.muted}>{details}</Text> : null}
                    <Text style={s.price}>{money(linePrice(l) * l.qty)}</Text>
                  </View>
                  <Stepper qty={l.qty} onAdd={() => changeQty(l.key, 1)} onRemove={() => changeQty(l.key, -1)} />
                </View>
              );
            })
          )}
        </View>

        {mode === 'delivery' ? (
          !empty && (
            <>
              <View style={s.card}>
                <Text style={s.h2}>{t('deliverTo')}</Text>
                {addresses.map((a) => {
                  const on = a.id === address?.id;
                  return (
                    <Pressable
                      key={a.id}
                      testID={`address-${a.label}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setSelectedAddressId(a.id)}
                      style={[s.option, on && s.optionOn]}
                    >
                      <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName}>{LABELS[a.label].icon} {LABELS[a.label][lang]}</Text>
                        <Text style={s.muted}>{formatAddress(a, lang)}</Text>
                      </View>
                      <Pressable onPress={() => removeAddress(a.id)} hitSlop={8} accessibilityLabel={t('remove')}>
                        <Text style={s.remove}>✕</Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
                <Button
                  testID="add-address"
                  variant={addresses.length ? 'ghost' : 'primary'}
                  label={addresses.length ? t('addNewAddress') : t('addAddress')}
                  onPress={() => go('address')}
                />
              </View>

              {quote && !quote.ok && (
                <View style={s.warn}>
                  <Text style={s.warnText}>{t('outOfRange', { km: (quote.distanceMeters / 1000).toFixed(1) })}</Text>
                </View>
              )}
              {quote && quote.ok && (
                <View style={[s.card, { backgroundColor: colors.brand }]} testID="delivery-quote">
                  <Text style={[s.label, { color: colors.accentSoft }]}>
                    {quote.courier === 'own' ? `🛵  ${t('deliveredByOwn')}` : `🚚  ${t('deliveredByPartner', { partner: quote.partner ?? '' })}`}
                  </Text>
                  <Text style={[s.bigValue, { fontSize: 24 }]}>{t('arrivesIn', { min: quote.etaMinMinutes, max: quote.etaMaxMinutes })}</Text>
                  <View style={s.quoteRow}>
                    <Text style={[s.muted, { color: colors.accentSoft }]}>{t('deliveryFee')}</Text>
                    <Text style={s.quoteFee}>
                      {quote.free ? `${t('free')}  ` : ''}
                      {quote.free ? <Text style={s.strike}>{money(quote.fullFee)}</Text> : money(quote.fee)}
                    </Text>
                  </View>
                  <Text style={[s.muted, { color: colors.accentSoft }]}>
                    {t('fromBranch', { branch: quote.branch.name[lang], km: (quote.distanceMeters / 1000).toFixed(1) })}
                  </Text>
                  {!quote.free && <Text style={[s.muted, { color: colors.accentSoft }]}>{t('freeAboveHint', { amount: money(market.delivery.freeAbove) })}</Text>}
                </View>
              )}
              {quote && quote.ok && quote.belowMinimumBy > 0 && (
                <View style={s.warn}>
                  <Text style={s.warnText}>{t('minOrderShort', { amount: money(quote.belowMinimumBy), min: money(market.delivery.minOrder) })}</Text>
                </View>
              )}
            </>
          )
        ) : (
          !empty && (
            <>
              <View style={s.card}>
                <Text style={s.h2}>{t('howGettingHere')}</Text>
                <Text style={s.muted}>📍 {t('pickupFrom', { branch: branch.name[lang] })}</Text>
                <Segmented
                  value={travel}
                  onChange={setTravel}
                  options={[
                    { value: 'driving', label: `🚗  ${t('driving')}` },
                    { value: 'walking', label: `🚶  ${t('walking')}` },
                  ]}
                />
              </View>

              <View style={s.card}>
                <Text style={s.h2}>{t('shareTitle')}</Text>
                <Text style={s.muted}>{t('shareBody')}</Text>
                <TrackingOption selected={tracking === 'live'} onPress={() => setTracking('live')} title={t('liveTitle')} body={t('liveBody')} />
                <TrackingOption selected={tracking === 'once'} onPress={() => setTracking('once')} title={t('onceTitle')} body={t('onceBody')} />

                {!fresh && (
                  <Button testID="share-location" label={t('allowLocation')} onPress={shareLocation} loading={locating} style={{ marginTop: 8 }} />
                )}
                {!fresh && Platform.OS === 'web' && (
                  <Button testID="demo-location" variant="secondary" label={t('demoLocation')} onPress={useDemoLocation} />
                )}
                {permError && (
                  <View style={s.warn}>
                    <Text style={s.warnText}>
                      {permError === 'blocked' ? t('permBlocked') : permError === 'denied' ? t('permDenied') : t('permFailed')}
                    </Text>
                    {permError === 'blocked' && (
                      <Button variant="secondary" label={t('openSettings')} onPress={() => Linking.openSettings()} />
                    )}
                  </View>
                )}
              </View>

              {fresh && (
                <View style={[s.card, { backgroundColor: colors.brand }]} testID="eta-card">
                  <Text style={[s.label, { color: colors.accentSoft }]}>{t('yourTiming')}</Text>
                  <View style={s.stats}>
                    <Stat label={t('arriveIn')} value={mins(fresh.eta)} sub={t('kmAway', { km: (fresh.distance / 1000).toFixed(1) })} />
                    <Stat label={t('prepTime')} value={mins(fresh.prep)} sub={t('barista')} />
                  </View>
                  <Text style={s.timingNote}>{startIn === 0 ? t('startNow') : t('startIn', { min: mins(startIn) })}</Text>
                  <Text style={[s.muted, { color: colors.accentSoft }]}>
                    {t('bufferNote', { s: SAFETY_BUFFER_SECONDS })} {tracking === 'live' ? t('adjustsLive') : t('basedOnNow')}
                  </Text>
                  <Pressable onPress={Platform.OS === 'web' ? useDemoLocation : shareLocation} hitSlop={8}>
                    <Text style={s.refresh}>{t('refresh')}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={s.muted}>{t('total')}</Text>
          <Text style={s.total}>{money(subtotal + (mode === 'delivery' && quote?.ok ? quote.fee : 0))}</Text>
        </View>
        <Button
          testID="place-order"
          label={mode === 'delivery' ? (address ? t('continueToPayment') : t('addAddress')) : fresh ? t('continueToPayment') : t('shareToContinue')}
          onPress={mode === 'delivery' && !address ? () => go('address') : toCheckout}
          disabled={empty || branchClosed || (mode === 'pickup' ? !fresh : !!address && !canDeliver)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function TrackingOption({ selected, onPress, title, body }: { selected: boolean; onPress: () => void; title: string; body: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[s.option, selected && s.optionOn]}>
      <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemName}>{title}</Text>
        <Text style={s.muted}>{body}</Text>
      </View>
    </Pressable>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.muted, { color: colors.accentSoft }]}>{label}</Text>
      <Text style={s.bigValue}>{value}</Text>
      <Text style={[s.muted, { color: colors.accentSoft }]}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  h2: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  label: { ...font.label, textAlign: 'auto' },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  price: { color: colors.accent, fontWeight: '800', marginTop: 2, textAlign: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemName: { ...font.body, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  option: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft + '66' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  warn: { gap: 10, backgroundColor: '#FBE9E6', padding: 12, borderRadius: radius.md },
  warnText: { color: colors.danger, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  stats: { flexDirection: 'row', gap: 16 },
  bigValue: { color: colors.onBrand, fontSize: 30, fontWeight: '800', textAlign: 'auto' },
  timingNote: { color: colors.onBrand, fontSize: 16, fontWeight: '600', lineHeight: 22, textAlign: 'auto' },
  refresh: { color: colors.accent, fontWeight: '700', paddingVertical: 4, textAlign: 'auto' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 20, padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteFee: { color: colors.onBrand, fontWeight: '800', fontSize: 16 },
  strike: { textDecorationLine: 'line-through', color: colors.accentSoft, fontWeight: '400' },
  remove: { color: colors.inkSoft, fontSize: 16, paddingHorizontal: 4 },
  total: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'auto' },
});
