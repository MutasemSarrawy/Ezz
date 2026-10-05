import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Header } from '../components/ui';
import type { LedgerEntry } from '../domain/account';
import { pointsValue } from '../domain/loyalty';
import type { PaymentMethod } from '../domain/payment';
import type { StringKey } from '../i18n/strings';
import { paymentService } from '../services/paymentService';
import { useStore } from '../state/store';
import { colors, font, radius, shadow } from '../theme';

const KIND: Record<LedgerEntry['kind'], StringKey> = {
  topup: 'kTopup', payment: 'kPayment', refund: 'kRefund', earn: 'kEarn', redeem: 'kRedeem', restore: 'kRestore',
};
const BRAND = { visa: 'VISA', mastercard: 'Mastercard', mada: 'mada', unknown: '' } as const;

export default function Wallet() {
  const { t, lang, money, market, wallet, addWallet, points, ledger, savedCards, removeCard } = useStore();
  const insets = useSafeAreaInsets();
  const cur = market.currency;
  const amounts = cur === 'JOD' ? [5, 10, 20, 50] : [25, 50, 100, 200];
  const [amount, setAmount] = useState(amounts[1]);
  const platformPay: PaymentMethod = Platform.OS === 'android' ? 'google_pay' : 'apple_pay';
  // pay for the top-up with a saved card when there is one, else Apple/Google Pay
  const [payWith, setPayWith] = useState<string>(savedCards[0]?.id ?? platformPay);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const topUp = async () => {
    setBusy(true);
    setMsg(null);
    const card = savedCards.find((c) => c.id === payWith);
    const res = await paymentService.charge({
      amount,
      currency: cur,
      method: card ? 'card' : (payWith as 'apple_pay' | 'google_pay'),
      token: card?.token,
      description: 'X Wallet top-up',
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: t('payFailed') });
    addWallet(cur, amount, 'topup');
    setMsg({ ok: true, text: t('toppedUpReal', { amount: money(amount) }) });
  };

  const when = (ts: number) =>
    new Date(ts).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const walletTx = ledger.filter((e) => e.unit === cur);
  const pointsTx = ledger.filter((e) => e.unit === 'points');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('paymentWallet')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}>
        {/* wallet */}
        <View style={s.balance}>
          <Text style={s.balanceLabel}>{t('walletBalanceTitle')} · {market.flag}</Text>
          <Text style={s.balanceValue} testID="wallet-balance">{money(wallet[cur])}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.h2}>{t('topUpAmount')}</Text>
          <View style={s.chips}>
            {amounts.map((a) => (
              <Chip key={a} label={money(a)} selected={amount === a} onPress={() => setAmount(a)} />
            ))}
          </View>
          <Text style={s.label}>{t('topUpWith')}</Text>
          <View style={s.chips}>
            {savedCards.map((c) => (
              <Chip key={c.id} label={`💳 ${BRAND[c.brand]} •••• ${c.last4}`} selected={payWith === c.id} onPress={() => setPayWith(c.id)} />
            ))}
            <Chip label={platformPay === 'apple_pay' ? t('applePay') : t('googlePay')} selected={payWith === platformPay} onPress={() => setPayWith(platformPay)} />
          </View>
          <Button testID="topup" label={t('topUpPay', { amount: money(amount) })} onPress={topUp} loading={busy} />
          {msg && <Text style={[s.msg, { color: msg.ok ? colors.success : colors.danger }]}>{msg.text}</Text>}
        </View>

        {/* cards */}
        <View style={s.card}>
          <Text style={s.h2}>{t('savedCardsTitle')}</Text>
          {savedCards.length === 0 && <Text style={s.muted}>{t('noCards')}</Text>}
          {savedCards.map((c) => (
            <View key={c.id} style={s.cardRow}>
              <View style={s.cardChip}><Text style={s.cardBrand}>{BRAND[c.brand] || '💳'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.item}>•••• {c.last4}</Text>
                <Text style={s.muted}>{c.holder} · {t('expires', { date: c.expiry })}</Text>
              </View>
              <Pressable onPress={() => removeCard(c.id)} hitSlop={8}>
                <Text style={s.remove}>{t('remove')}</Text>
              </Pressable>
            </View>
          ))}
          <Text style={s.small}>🔒 {t('securedBy')}</Text>
        </View>

        {/* points */}
        <View style={s.card}>
          <Text style={s.h2}>⭐ {t('points')}: {points}</Text>
          <Text style={s.muted}>{t('pointsBalance', { points, value: money(pointsValue(points, cur)) })}</Text>
          <Text style={s.label}>{t('pointsHistory')}</Text>
          {pointsTx.length === 0 && <Text style={s.muted}>{t('noActivity')}</Text>}
          {pointsTx.slice(0, 20).map((e) => <Tx key={e.id} label={t(KIND[e.kind])} sub={[e.orderId, when(e.at)].filter(Boolean).join(' · ')} amount={`${e.amount > 0 ? '+' : ''}${e.amount}`} positive={e.amount > 0} />)}
        </View>

        <View style={s.card}>
          <Text style={s.h2}>{t('walletHistory')}</Text>
          {walletTx.length === 0 && <Text style={s.muted}>{t('noActivity')}</Text>}
          {walletTx.slice(0, 20).map((e) => <Tx key={e.id} label={t(KIND[e.kind])} sub={[e.orderId, when(e.at)].filter(Boolean).join(' · ')} amount={`${e.amount > 0 ? '+' : '−'}${money(Math.abs(e.amount))}`} positive={e.amount > 0} />)}
        </View>
      </ScrollView>
    </View>
  );
}

function Tx({ label, sub, amount, positive }: { label: string; sub: string; amount: string; positive: boolean }) {
  return (
    <View style={s.tx}>
      <View style={{ flex: 1 }}>
        <Text style={s.item}>{label}</Text>
        <Text style={s.small}>{sub}</Text>
      </View>
      <Text style={[s.txAmount, { color: positive ? colors.success : colors.ink }]}>{amount}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  balance: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 20, gap: 6, ...shadow },
  balanceLabel: { ...font.label, color: colors.accentSoft, textAlign: 'auto' },
  balanceValue: { fontSize: 34, fontWeight: '800', color: colors.onBrand, textAlign: 'auto', fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  h2: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  label: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  small: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, textAlign: 'auto' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  msg: { fontSize: 14, fontWeight: '600', textAlign: 'auto' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardChip: { width: 56, height: 38, borderRadius: 8, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  cardBrand: { color: colors.onBrand, fontSize: 11, fontWeight: '800' },
  item: { ...font.body, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  txAmount: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
