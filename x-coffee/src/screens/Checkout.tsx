import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Chip, Header } from '../components/ui';
import { roundMoney } from '../domain/market';
import { REDEEM_STEP, bestRedemption, pointsEarned, pointsValue } from '../domain/loyalty';
import { describeChoice } from '../domain/options';
import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  validateCard,
  type CardErrors,
  type CardInput,
  type OrderPayment,
  type PaymentMethod,
} from '../domain/payment';
import { orderService } from '../services/orderService';
import { TEST_CARDS, paymentService } from '../services/paymentService';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

// The Apple logo glyph only renders on Apple fonts.
const APPLE = Platform.OS === 'ios' ? '\uF8FF' : '🍎';
const BRAND_LABEL = { visa: 'VISA', mastercard: 'Mastercard', mada: 'mada', unknown: '' } as const;

export default function Checkout() {
  const { t, money, market, session, lines, count, subtotal, linePrice, pendingPickup, points, addPoints, wallet, addWallet, savedCards, addCard, clear, reset, go, setActiveOrderId, setPendingPickup } = useStore();
  const insets = useSafeAreaInsets();
  const cur = market.currency;

  // Show the wallet that belongs to the platform; the web preview shows both.
  const walletPays: PaymentMethod[] =
    Platform.OS === 'ios' ? ['apple_pay'] : Platform.OS === 'android' ? ['google_pay'] : ['apple_pay', 'google_pay'];
  const [method, setMethod] = useState<PaymentMethod>(savedCards.length ? 'card' : walletPays[0]);
  /** Selected saved card, or null to enter a new card. */
  const [savedCardId, setSavedCardId] = useState<string | null>(savedCards[0]?.id ?? null);
  const [saveNewCard, setSaveNewCard] = useState(true);
  const savedCard = method === 'card' ? savedCards.find((c) => c.id === savedCardId) : undefined;
  const pickMethod = (m: PaymentMethod, cardId: string | null = null) => { setMethod(m); setSavedCardId(cardId); };
  const [usePoints, setUsePoints] = useState(false);
  const [card, setCard] = useState<CardInput>({ number: '', expiry: '', cvv: '', name: '' });
  const [errors, setErrors] = useState<CardErrors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const redemption = useMemo(() => bestRedemption(points, subtotal, cur), [points, subtotal, cur]);
  const discount = usePoints ? redemption.discount : 0;
  const total = roundMoney(Math.max(0, subtotal - discount), cur);
  const earn = pointsEarned(total, cur);
  const walletShort = method === 'wallet' && wallet[cur] < total;
  const topUps = cur === 'JOD' ? [5, 10, 20] : [25, 50, 100];
  const brand = detectBrand(card.number);

  const methodLabel = (m: PaymentMethod) =>
    m === 'apple_pay' ? t('applePay') : m === 'google_pay' ? t('googlePay') : m === 'card' ? t('card') : m === 'wallet' ? t('walletMethod') : t('counter');

  const submit = async () => {
    setProblem(null);
    if (!pendingPickup) return setProblem(t('noPickup'));
    if (method === 'card' && !savedCard) {
      const e = validateCard(card);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    if (walletShort) return;

    setBusy(true);
    try {
      const base = { subtotal, amount: total, pointsRedeemed: usePoints ? redemption.points : 0, discount };
      let payment: OrderPayment;
      if (method === 'counter') {
        payment = { ...base, method, status: 'pay_at_counter' };
      } else if (method === 'wallet') {
        payment = { ...base, method, status: 'paid', reference: `wallet_${Date.now()}` };
      } else {
        const res = await paymentService.charge({
          amount: total,
          currency: cur,
          method,
          card: method === 'card' && !savedCard ? card : undefined,
          saveCard: method === 'card' && !savedCard && saveNewCard,
          token: savedCard?.token,
          description: `X Coffee House · ${count} items`,
        });
        if (!res.ok) {
          setProblem(res.error === 'declined' ? t('declined') : t('payFailed'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          return;
        }
        payment = {
          ...base, method, status: 'paid', reference: res.reference,
          cardLast4: res.cardLast4 ?? savedCard?.last4,
          cardBrand: res.cardBrand ?? savedCard?.brand,
        };
        if (res.token && res.cardLast4 && res.cardBrand) {
          addCard({ token: res.token, brand: res.cardBrand, last4: res.cardLast4, expiry: card.expiry, holder: card.name.trim() });
        }
      }

      const order = await orderService.placePickup({
        lines: lines.map((l) => ({
          key: l.key,
          productId: l.product.id,
          choice: l.choice,
          name: l.product.name,
          details: { en: describeChoice(l.choice, 'en'), ar: describeChoice(l.choice, 'ar') },
          qty: l.qty,
          unitPrice: linePrice(l),
        })),
        currency: cur,
        payment,
        shop: market.branch.location,
        ...pendingPickup,
      });
      if (payment.pointsRedeemed) addPoints(-payment.pointsRedeemed, 'redeem', order.id);
      if (method === 'wallet') addWallet(cur, -total, 'payment', order.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setActiveOrderId(order.id);
      setPendingPickup(null);
      clear();
      reset('home');
      go('tracking');
    } catch {
      setProblem(t('payFailed'));
    } finally {
      setBusy(false);
    }
  };

  const cta =
    method === 'counter' ? t('placeCounter', { amount: money(total) })
    : method === 'wallet' ? t('payWithWallet', { amount: money(total) })
    : method === 'apple_pay' ? `${APPLE} ${t('pay', { amount: money(total) })}`
    : t('pay', { amount: money(total) });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('checkout')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 130 }} keyboardShouldPersistTaps="handled">
        {/* summary */}
        <View style={s.card}>
          <Row label={`${t('subtotal')} · ${t('items', { n: count })}`} value={money(subtotal)} />
          {discount > 0 && <Row label={t('pointsDiscount')} value={`− ${money(discount)}`} accent />}
          <View style={s.divider} />
          <Row label={t('total')} value={money(total)} strong />
        </View>

        {/* loyalty */}
        <View style={s.card}>
          <Text style={s.h2}>⭐ {t('yourPoints')}</Text>
          <Text style={s.muted}>{t('pointsBalance', { points, value: money(pointsValue(points, cur)) })}</Text>
          {redemption.points > 0 ? (
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{t('usePoints', { points: redemption.points })}</Text>
                <Text style={s.muted}>{t('saves', { amount: money(redemption.discount) })}</Text>
              </View>
              <Switch
                testID="use-points"
                value={usePoints}
                onValueChange={setUsePoints}
                trackColor={{ true: colors.accent, false: colors.line }}
                thumbColor={colors.surface}
              />
            </View>
          ) : (
            <Text style={s.muted}>{t('notEnoughPoints', { points: REDEEM_STEP })}</Text>
          )}
          <Text style={s.earn}>{t('willEarn', { points: earn })}</Text>
        </View>

        {/* methods */}
        <View style={s.card}>
          <Text style={s.h2}>{t('payWith')}</Text>
          {walletPays.map((m) => (
            <MethodRow key={m} id={m} selected={method === m} onPress={() => pickMethod(m)} title={methodLabel(m)} icon={m === 'apple_pay' ? APPLE : 'G'} />
          ))}
          {savedCards.map((c) => (
            <MethodRow
              key={c.id}
              id={`saved-${c.last4}`}
              selected={method === 'card' && savedCardId === c.id}
              onPress={() => pickMethod('card', c.id)}
              title={`${BRAND_LABEL[c.brand] || t('card')} •••• ${c.last4}`}
              sub={`${c.holder} · ${c.expiry}`}
              icon="💳"
            />
          ))}
          <MethodRow
            id="card"
            selected={method === 'card' && !savedCard}
            onPress={() => pickMethod('card')}
            title={savedCards.length ? t('newCard') : t('card')}
            sub={cur === 'SAR' ? t('cardBrands') : t('cardBrandsJO')}
            icon="💳"
          />
          {method === 'card' && !savedCard && (
            <View style={s.form}>
              <Field
                label={t('cardNumber')}
                value={card.number}
                onChange={(v) => setCard((c) => ({ ...c, number: formatCardNumber(v) }))}
                error={errors.number && t(errors.number)}
                keyboardType="number-pad"
                placeholder="4242 4242 4242 4242"
                autoComplete="cc-number"
                testID="card-number"
                badge={BRAND_LABEL[brand]}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label={t('expiry')} value={card.expiry} onChange={(v) => setCard((c) => ({ ...c, expiry: formatExpiry(v) }))} error={errors.expiry && t(errors.expiry)} keyboardType="number-pad" placeholder="08/28" autoComplete="cc-exp" testID="card-expiry" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t('cvv')} value={card.cvv} onChange={(v) => setCard((c) => ({ ...c, cvv: v.replace(/\D/g, '').slice(0, 4) }))} error={errors.cvv && t(errors.cvv)} keyboardType="number-pad" placeholder="123" secure autoComplete="cc-csc" testID="card-cvv" />
                </View>
              </View>
              <Field label={t('nameOnCard')} value={card.name} onChange={(v) => setCard((c) => ({ ...c, name: v }))} error={errors.name && t(errors.name)} placeholder="Mutasem S." autoComplete="cc-name" testID="card-name" />
              {session && (
                <View style={s.toggleRow}>
                  <Text style={[s.itemName, { flex: 1, fontWeight: '600' }]}>{t('saveCard')}</Text>
                  <Switch value={saveNewCard} onValueChange={setSaveNewCard} trackColor={{ true: colors.accent, false: colors.line }} thumbColor={colors.surface} />
                </View>
              )}
              <Text style={s.small}>🔒 {t('securedBy')}</Text>
              <Text style={s.small}>{t('testCards', { ok: TEST_CARDS.success, bad: TEST_CARDS.declined, mada: TEST_CARDS.mada })}</Text>
            </View>
          )}
          <MethodRow id="wallet" selected={method === 'wallet'} onPress={() => pickMethod('wallet')} title={t('walletMethod')} sub={t('walletBalance', { amount: money(wallet[cur]) })} icon="👛" />
          {method === 'wallet' && walletShort && (
            <View style={s.form}>
              <Text style={s.muted}>{t('walletShort', { amount: money(wallet[cur]) })}</Text>
              <View style={s.chips}>
                {topUps.map((a) => (
                  <Chip
                    key={a}
                    label={`${t('topUp')} ${money(a)}`}
                    selected={false}
                    onPress={() => { addWallet(cur, a, 'topup'); setNotice(t('toppedUp', { amount: money(a) })); }}
                  />
                ))}
              </View>
            </View>
          )}
          <MethodRow id="counter" selected={method === 'counter'} onPress={() => pickMethod('counter')} title={t('counter')} sub={t('counterBody')} icon="🏪" />
        </View>

        {notice && <Text style={[s.small, { color: colors.success }]}>{notice}</Text>}
        {problem && (
          <View style={s.warn}><Text style={s.warnText}>{problem}</Text></View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          testID="pay"
          label={busy ? t('processing') : cta}
          onPress={submit}
          loading={busy}
          disabled={walletShort || lines.length === 0}
          style={{ flex: 1, backgroundColor: method === 'apple_pay' || method === 'google_pay' ? '#000' : colors.brand }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, strong && s.strong]}>{label}</Text>
      <Text style={[s.rowValue, strong && s.strong, accent && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

function MethodRow({ id, selected, onPress, title, sub, icon }: { id: string; selected: boolean; onPress: () => void; title: string; sub?: string; icon: string }) {
  return (
    <Pressable testID={`method-${id}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[s.method, selected && s.methodOn]}>
      <View style={s.methodIcon}><Text style={s.methodIconText}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemName}>{title}</Text>
        {sub ? <Text style={s.muted}>{sub}</Text> : null}
      </View>
      <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
    </Pressable>
  );
}

type FieldProps = {
  label: string; value: string; onChange: (v: string) => void; error?: string | false; placeholder?: string;
  keyboardType?: 'number-pad' | 'default'; secure?: boolean; badge?: string; testID?: string;
  autoComplete?: 'cc-number' | 'cc-exp' | 'cc-csc' | 'cc-name';
};

function Field({ label, value, onChange, error, placeholder, keyboardType = 'default', secure, badge, testID, autoComplete }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          keyboardType={keyboardType}
          secureTextEntry={secure}
          autoComplete={autoComplete}
          autoCorrect={false}
          style={[s.input, !!error && { borderColor: colors.danger }]}
        />
        {badge ? <Text style={s.badge}>{badge}</Text> : null}
      </View>
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  h2: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  small: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, textAlign: 'auto' },
  earn: { color: colors.accent, fontWeight: '700', fontSize: 14, textAlign: 'auto' },
  itemName: { ...font.body, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { ...font.body, color: colors.inkSoft },
  rowValue: { ...font.body, color: colors.ink, fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '800', color: colors.ink, fontSize: 18 },
  divider: { height: 1, backgroundColor: colors.line },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, minHeight: 64 },
  methodOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft + '55' },
  methodIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  methodIconText: { fontSize: 20, fontWeight: '800', color: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  form: { gap: 12, paddingHorizontal: 4 },
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, fontSize: 16, color: colors.ink, writingDirection: 'ltr' },
  badge: { position: 'absolute', right: 12, top: 15, fontWeight: '800', color: colors.accent, fontSize: 13 },
  err: { color: colors.danger, fontSize: 13, textAlign: 'auto' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warn: { backgroundColor: '#FBE9E6', padding: 12, borderRadius: radius.md },
  warnText: { color: colors.danger, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
