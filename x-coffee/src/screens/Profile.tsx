import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, ListRow } from '../components/ui';
import { formatMobile, initials, ltr } from '../domain/account';
import { useStore } from '../state/store';
import { colors, font, radius, shadow } from '../theme';

export default function Profile() {
  const { t, lang, isRTL, go, reset, session, signOut, points, wallet, market, money, orders, favourites, savedDrinks, savedCards } = useStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('profile')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}>
        {session ? (
          <View style={s.hero}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials(session.name)}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{session.name}</Text>
              {session.phone ? (
                <Text style={s.heroMeta}>
                  {ltr(formatMobile(session.phone))}{session.phoneVerified ? `  ✓ ${t('verified')}` : ''}
                </Text>
              ) : null}
              {session.email ? <Text style={s.heroMeta}>{session.email}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={[s.card, { padding: 20, gap: 12 }]}>
            <Text style={s.h2}>{t('guestTitle')}</Text>
            <Text style={s.meta}>{t('guestBody')}</Text>
            <Button testID="guest-signup" label={t('createAccount')} onPress={() => go('signup')} />
            <Button variant="secondary" label={t('signIn')} onPress={() => reset('login')} />
          </View>
        )}

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>⭐ {t('points')}</Text>
            <Text style={s.tileValue}>{points}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>👛 {t('walletLabel')}</Text>
            <Text style={s.tileValue}>{money(wallet[market.currency])}</Text>
          </View>
        </View>

        <View style={s.card}>
          <ListRow testID="row-history" icon="🧾" title={t('orderHistory')} value={orders.length ? String(orders.length) : undefined} onPress={() => go('history')} />
          <View style={[s.sep, isRTL ? { marginRight: 58 } : { marginLeft: 58 }]} />
          <ListRow testID="row-favourites" icon="♡" title={t('favouritesTitle')} value={String(favourites.length + savedDrinks.length || '') || undefined} onPress={() => go('favourites')} />
          <View style={[s.sep, isRTL ? { marginRight: 58 } : { marginLeft: 58 }]} />
          <ListRow testID="row-wallet" icon="💳" title={t('paymentWallet')} value={savedCards.length ? String(savedCards.length) : undefined} onPress={() => go('wallet')} />
        </View>

        <View style={s.card}>
          {session && (
            <>
              <ListRow testID="row-edit" icon="✏️" title={t('editProfile')} onPress={() => go('editProfile')} />
              <View style={[s.sep, isRTL ? { marginRight: 58 } : { marginLeft: 58 }]} />
            </>
          )}
          <ListRow icon={market.flag} title={t('settings')} value={lang === 'ar' ? 'العربية' : 'English'} onPress={() => go('settings')} />
        </View>

        <View style={s.card}>
          <ListRow icon="👨‍🍳" title={`${t('staff')} · ${t('baristaConsole')}`} onPress={() => go('barista')} />
        </View>

        {session && (
          <View style={s.card}>
            <ListRow testID="sign-out" icon="↩︎" title={t('signOut')} onPress={signOut} danger />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.brand, borderRadius: radius.lg, padding: 20, ...shadow },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onBrand, fontSize: 24, fontWeight: '800' },
  name: { ...font.h2, fontSize: 22, color: colors.onBrand, textAlign: 'auto' },
  heroMeta: { color: colors.accentSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  meta: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: 'auto' },
  h2: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: colors.line },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 6 },
  tileLabel: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'auto', fontVariant: ['tabular-nums'] },
});
