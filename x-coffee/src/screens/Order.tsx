import React, { useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Segmented, Stepper } from '../components/ui';
import {
  SAFETY_BUFFER_SECONDS,
  SHOP_LOCATION,
  estimatePrepSeconds,
  estimateTravelSeconds,
  formatMinutes,
  haversineMeters,
  secondsUntilStart,
} from '../domain/pickup';
import type { FulfilmentMode, LatLng, TrackingMode, TravelMode } from '../domain/types';
import { getCurrentLocation, requestLocationPermission } from '../services/location';
import { orderService } from '../services/orderService';
import { money, useStore } from '../state/store';
import { colors, font, radius } from '../theme';

type Preview = { location: LatLng; distance: number; eta: number; prep: number };

export default function Order() {
  const { go, lines, subtotal, add, remove, clear, setActiveOrderId } = useStore();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<FulfilmentMode>('pickup');
  const [travel, setTravel] = useState<TravelMode>('driving');
  const [tracking, setTracking] = useState<TrackingMode>('live');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [locating, setLocating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const [permError, setPermError] = useState<'denied' | 'blocked' | 'failed' | null>(null);

  const prep = useMemo(() => estimatePrepSeconds(lines, orderService.queueSeconds()), [lines]);

  // Changing the basket or travel mode invalidates a previously computed ETA.
  const fresh = useMemo(() => {
    if (!preview) return null;
    const eta = estimateTravelSeconds(preview.distance, travel);
    return { ...preview, eta, prep };
  }, [preview, travel, prep]);

  const shareLocation = async () => {
    setPermError(null);
    setLocating(true);
    try {
      const perm = await requestLocationPermission();
      if (perm !== 'granted') return setPermError(perm);
      const location = await getCurrentLocation();
      const distance = haversineMeters(location, SHOP_LOCATION);
      setPreview({ location, distance, eta: estimateTravelSeconds(distance, travel), prep });
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 150);
    } catch {
      setPermError('failed');
    } finally {
      setLocating(false);
    }
  };

  const place = async () => {
    if (!fresh) return;
    setPlacing(true);
    try {
      const order = await orderService.placePickup({
        lines: lines.map((l) => ({ productId: l.product.id, name: l.product.name, qty: l.qty, price: l.product.price })),
        prepSeconds: fresh.prep,
        location: fresh.location,
        tracking,
        travel,
      });
      setActiveOrderId(order.id);
      clear();
      go('tracking');
    } catch {
      Alert.alert('Could not place order', 'Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const startIn = fresh ? secondsUntilStart(fresh.eta, fresh.prep) : 0;
  const empty = lines.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => go('home')} hitSlop={12} accessibilityLabel="Back" style={s.back}>
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
        <Text style={s.title}>Your order</Text>
      </View>

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140, gap: 16 }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'delivery', label: '🛵  Delivery' },
            { value: 'pickup', label: '🏪  Pickup' },
          ]}
        />

        <View style={s.card}>
          {empty ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>☕</Text>
              <Text style={s.itemName}>Your basket is empty</Text>
              <Button variant="secondary" label="Browse the menu" onPress={() => go('home')} />
            </View>
          ) : (
            lines.map((l) => (
              <View key={l.product.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{l.product.name}</Text>
                  <Text style={s.muted}>{money(l.product.price)}</Text>
                </View>
                <Stepper qty={l.qty} onAdd={() => add(l.product)} onRemove={() => remove(l.product)} />
              </View>
            ))
          )}
        </View>

        {mode === 'delivery' ? (
          <View style={s.card}>
            <Text style={s.h2}>Delivery is coming next</Text>
            <Text style={s.muted}>We're starting with pickup. Switch to Pickup to order ahead.</Text>
          </View>
        ) : (
          !empty && (
            <>
              <View style={s.card}>
                <Text style={s.h2}>How are you getting here?</Text>
                <Segmented
                  value={travel}
                  onChange={setTravel}
                  options={[
                    { value: 'driving', label: '🚗  Driving' },
                    { value: 'walking', label: '🚶  Walking' },
                  ]}
                />
              </View>

              <View style={s.card}>
                <Text style={s.h2}>Share your location</Text>
                <Text style={s.muted}>
                  We use it to time your order so it's fresh the moment you arrive.
                </Text>
                <TrackingOption
                  selected={tracking === 'live'}
                  onPress={() => setTracking('live')}
                  title="Live location (recommended)"
                  body="While the app is open we keep your ETA up to date and alert the barista at exactly the right moment."
                />
                <TrackingOption
                  selected={tracking === 'once'}
                  onPress={() => setTracking('once')}
                  title="Share once"
                  body="We use your location now to estimate the start time. It isn't tracked afterwards."
                />

                {!fresh && (
                  <Button
                    testID="share-location"
                    label="Allow location & get my ETA"
                    onPress={shareLocation}
                    loading={locating}
                    style={{ marginTop: 8 }}
                  />
                )}
                {permError && (
                  <View style={s.warn}>
                    <Text style={s.warnText}>
                      {permError === 'blocked'
                        ? 'Location is turned off for X. Enable it in Settings to use pickup timing.'
                        : permError === 'denied'
                          ? 'We need your location to time your order. Tap the button to try again.'
                          : "We couldn't read your location. Check GPS and try again."}
                    </Text>
                    {permError === 'blocked' && (
                      <Button variant="secondary" label="Open Settings" onPress={() => Linking.openSettings()} />
                    )}
                  </View>
                )}
              </View>

              {fresh && (
                <View style={[s.card, { backgroundColor: colors.brand }]} testID="eta-card">
                  <Text style={[s.label, { color: colors.accentSoft }]}>YOUR TIMING</Text>
                  <View style={s.stats}>
                    <Stat label="Arrive in" value={formatMinutes(fresh.eta)} sub={`${(fresh.distance / 1000).toFixed(1)} km away`} />
                    <Stat label="Prep time" value={formatMinutes(fresh.prep)} sub="barista" />
                  </View>
                  <Text style={s.timingNote}>
                    {startIn === 0
                      ? 'We\'ll start making your order right away.'
                      : `We'll start making it in about ${formatMinutes(startIn)}, so it's ready as you walk in.`}
                  </Text>
                  <Text style={[s.muted, { color: colors.accentSoft }]}>
                    Includes a {SAFETY_BUFFER_SECONDS}s buffer.{' '}
                    {tracking === 'live' ? 'Timing adjusts as you move.' : 'Based on your location now.'}
                  </Text>
                  <Pressable onPress={shareLocation} hitSlop={8}>
                    <Text style={s.refresh}>Refresh location</Text>
                  </Pressable>
                </View>
              )}
            </>
          )
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={s.muted}>Total</Text>
          <Text style={s.total}>{money(subtotal)}</Text>
        </View>
        <Button
          testID="place-order"
          label={mode === 'delivery' ? 'Delivery coming soon' : fresh ? 'Place pickup order' : 'Share location to continue'}
          onPress={place}
          loading={placing}
          disabled={empty || mode === 'delivery' || !fresh}
          style={{ flex: 1, marginLeft: 20 }}
        />
      </View>
    </View>
  );
}

function TrackingOption({ selected, onPress, title, body }: { selected: boolean; onPress: () => void; title: string; body: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.option, selected && s.optionOn]}
    >
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
  top: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 36, lineHeight: 38, color: colors.ink },
  title: { ...font.title, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  h2: { ...font.h2, color: colors.ink },
  label: { ...font.label },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemName: { ...font.body, fontWeight: '700', color: colors.ink },
  option: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft + '66' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  warn: { gap: 10, backgroundColor: '#FBE9E6', padding: 12, borderRadius: radius.md },
  warnText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 16 },
  bigValue: { color: colors.onBrand, fontSize: 30, fontWeight: '800' },
  timingNote: { color: colors.onBrand, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  refresh: { color: colors.accent, fontWeight: '700', paddingVertical: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  total: { fontSize: 24, fontWeight: '800', color: colors.ink },
});
