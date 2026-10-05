import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Header, ProductImage } from '../components/ui';
import { CATEGORIES, productById } from '../domain/menu';
import { defaultChoice, describeChoice, unitPrice } from '../domain/options';
import { useStore } from '../state/store';
import { colors, font, radius } from '../theme';

export default function Favourites() {
  const { t, lang, money, market, favourites, toggleFavourite, savedDrinks, removeSavedDrink, addLine, openProduct, go } = useStore();
  const insets = useSafeAreaInsets();
  const drinks = savedDrinks.flatMap((d) => {
    const p = productById(d.productId);
    return p ? [{ ...d, product: p }] : [];
  });
  const items = favourites.flatMap((id) => {
    const p = productById(id);
    return p ? [p] : [];
  });
  const emojiOf = (cat: string) => CATEGORIES.find((c) => c.id === cat)?.emoji;
  const added = () => Haptics.selectionAsync().catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('favouritesTitle')} top={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
        {!drinks.length && !items.length && (
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>♡</Text>
            <Text style={s.h2}>{t('noFavourites')}</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>{t('noFavouritesBody')}</Text>
            <Button variant="secondary" label={t('browseMenu')} onPress={() => go('home')} />
          </View>
        )}

        {drinks.length > 0 && <Text style={s.section}>{t('savedDrinks')}</Text>}
        {drinks.map((d) => (
          <View key={d.id} style={s.row} testID={`saved-${d.productId}`}>
            <ProductImage uri={d.product.image} emoji={emojiOf(d.product.category)} style={s.thumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{d.product.name[lang]}</Text>
              <Text style={s.muted} numberOfLines={2}>{describeChoice(d.choice, lang)}</Text>
              <Text style={s.price}>{money(unitPrice(d.product, d.choice, market.currency))}</Text>
            </View>
            <View style={{ gap: 6, alignItems: 'center' }}>
              <Pressable accessibilityLabel={t('add', { name: d.product.name[lang] })} onPress={() => { addLine(d.product, d.choice); added(); }} style={s.add}>
                <Text style={s.addGlyph}>+</Text>
              </Pressable>
              <Pressable onPress={() => removeSavedDrink(d.id)} hitSlop={8}>
                <Text style={s.remove}>{t('remove')}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {items.length > 0 && <Text style={s.section}>{t('favouriteItems')}</Text>}
        {items.map((p) => (
          <Pressable key={p.id} style={s.row} onPress={() => openProduct(p.id)}>
            <ProductImage uri={p.image} emoji={emojiOf(p.category)} style={s.thumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{p.name[lang]}</Text>
              <Text style={s.price}>{money(p.price[market.currency])}</Text>
            </View>
            <Pressable accessibilityLabel={t('favRemove')} onPress={() => toggleFavourite(p.id)} hitSlop={8} style={s.heart}>
              <Text style={{ fontSize: 22, color: colors.danger }}>♥</Text>
            </Pressable>
            <Pressable accessibilityLabel={t('add', { name: p.name[lang] })} onPress={() => { addLine(p, defaultChoice(p)); added(); }} style={s.add}>
              <Text style={s.addGlyph}>+</Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 16 },
  h2: { ...font.h2, color: colors.ink },
  section: { ...font.label, color: colors.inkSoft, marginTop: 4, textAlign: 'auto' },
  muted: { color: colors.inkSoft, fontSize: 14, textAlign: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  name: { ...font.body, fontWeight: '700', color: colors.ink, textAlign: 'auto' },
  price: { color: colors.accent, fontWeight: '800', textAlign: 'auto' },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  addGlyph: { color: colors.onBrand, fontSize: 24, lineHeight: 26 },
  heart: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  remove: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
});
