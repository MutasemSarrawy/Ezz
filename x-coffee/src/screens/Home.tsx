import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, PRODUCTS } from '../domain/menu';
import { defaultChoice, describeChoice, unitPrice } from '../domain/options';
import { initials } from '../domain/account';
import { productById } from '../domain/menu';
import type { CategoryId, Product } from '../domain/types';
import { ProductImage, Stepper } from '../components/ui';
import { useStore } from '../state/store';
import { colors, font, radius, shadow } from '../theme';

export default function Home() {
  const { go, t, lang, isRTL, money, market, session, count, subtotal, qtyOf, addLine, removeOne, openProduct, activeOrder, savedDrinks, favourites } = useStore();
  const insets = useSafeAreaInsets();
  const list = useRef<SectionList<Product>>(null);
  const [active, setActive] = useState<CategoryId>('coffee');
  const sections = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, data: PRODUCTS.filter((p) => p.category === c.id) })),
    [],
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable && v.item);
    if (first) setActive((first.item as Product).category);
  }).current;

  const jump = (id: CategoryId) => {
    setActive(id);
    const idx = sections.findIndex((s) => s.id === id);
    list.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, viewOffset: 8 });
  };

  // Saved drinks first (exact options), then favourite items with default options.
  const quick = [
    ...savedDrinks.flatMap((d) => { const p = productById(d.productId); return p ? [{ key: d.id, product: p, choice: d.choice }] : []; }),
    ...favourites.flatMap((id) => { const p = productById(id); return p ? [{ key: `fav-${id}`, product: p, choice: defaultChoice(p) }] : []; }),
  ].slice(0, 10);

  const live = activeOrder && ['waiting', 'preparing', 'ready', 'out_for_delivery'].includes(activeOrder.status) ? activeOrder : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.bg }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>{session ? t('hello', { name: session.name }) : t('helloGuest')}</Text>
            <Text style={s.title}>{t('homeTitle')}</Text>
          </View>
          <Pressable testID="settings" onPress={() => go('settings')} accessibilityLabel={t('settings')} style={s.iconBtn}>
            <Text style={{ fontSize: 18 }}>{market.flag}</Text>
          </Pressable>
          <Pressable testID="profile" onPress={() => go('profile')} accessibilityLabel={t('profile')} style={[s.iconBtn, session && { backgroundColor: colors.brand }]}>
            <Text style={[{ fontSize: 16, fontWeight: '800' }, session ? { color: colors.onBrand } : { fontSize: 18 }]}>{session ? initials(session.name) : '👤'}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {CATEGORIES.map((c) => {
            const on = c.id === active;
            return (
              <Pressable
                key={c.id}
                onPress={() => jump(c.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                <Text style={[s.chipText, on && { color: colors.onBrand }]}>{c.name[lang]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {live && (
          <Pressable onPress={() => go('tracking')} style={s.banner}>
            <Text style={s.bannerText}>
              {live.id} · {live.status === 'waiting' ? t('bannerWaiting') : live.status === 'preparing' ? t('bannerPreparing') : live.status === 'out_for_delivery' ? t('bannerOut') : t('bannerReady')}
            </Text>
            <Text style={s.bannerText}>{t('view')}</Text>
          </Pressable>
        )}
      </View>

      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          quick.length ? (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={s.sectionTitle}>♡  {t('yourFavourites')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {quick.map((q) => (
                  <View key={q.key} style={s.quick}>
                    <Text style={s.quickName} numberOfLines={1}>{q.product.name[lang]}</Text>
                    <Text style={s.quickSub} numberOfLines={1}>{describeChoice(q.choice, lang) || ' '}</Text>
                    <View style={s.quickRow}>
                      <Text style={s.quickPrice}>{money(unitPrice(q.product, q.choice, market.currency))}</Text>
                      <Pressable
                        accessibilityLabel={t('add', { name: q.product.name[lang] })}
                        onPress={() => { Haptics.selectionAsync().catch(() => {}); addLine(q.product, q.choice); }}
                        style={s.quickAdd}
                      >
                        <Text style={s.quickAddGlyph}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionTitle}>{section.emoji}  {section.name[lang]}</Text>
        )}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            qty={qtyOf(item.id)}
            rtl={isRTL}
            name={item.name[lang]}
            description={item.description[lang]}
            price={money(item.price[market.currency])}
            popular={t('popular')}
            addLabel={t('add', { name: item.name[lang] })}
            onOpen={() => openProduct(item.id)}
            onAdd={() => { Haptics.selectionAsync().catch(() => {}); addLine(item, defaultChoice(item)); }}
            onRemove={() => removeOne(item)}
          />
        )}
      />

      <Pressable
        testID="order-fab"
        accessibilityRole="button"
        accessibilityLabel={t('orderItems', { n: count })}
        onPress={() => go('order')}
        style={({ pressed }) => [s.fab, { bottom: insets.bottom + 20 }, isRTL ? { left: 16 } : { right: 16 }, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Text style={s.fabText}>🛍  {t('order')}</Text>
        {count > 0 && (
          <View style={s.fabBadge}>
            <Text style={s.fabBadgeText}>{count} · {money(subtotal)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

type CardProps = {
  product: Product; qty: number; rtl: boolean; name: string; description: string; price: string; popular: string; addLabel: string;
  onOpen: () => void; onAdd: () => void; onRemove: () => void;
};

function ProductCard({ product, qty, rtl, name, description, price, popular, addLabel, onOpen, onAdd, onRemove }: CardProps) {
  const emoji = CATEGORIES.find((c) => c.id === product.category)?.emoji;
  return (
    <Pressable testID={`card-${product.id}`} onPress={onOpen} accessibilityRole="button" accessibilityLabel={name} style={({ pressed }) => [s.card, pressed && { opacity: 0.95 }]}>
      <ProductImage uri={product.image} emoji={emoji} style={s.cardImg} />
      {product.popular && (
        <View style={[s.tag, rtl ? { right: 12 } : { left: 12 }]}><Text style={s.tagText}>{popular}</Text></View>
      )}
      <View style={s.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{name}</Text>
          <Text style={s.desc} numberOfLines={2}>{description}</Text>
          <Text style={s.price}>{price}</Text>
        </View>
        {qty === 0 ? (
          <Pressable accessibilityLabel={addLabel} onPress={onAdd} style={s.addBtn}>
            <Text style={s.addGlyph}>+</Text>
          </Pressable>
        ) : (
          <Stepper qty={qty} onAdd={onAdd} onRemove={onRemove} />
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12 },
  hello: { ...font.label, color: colors.inkSoft, textAlign: 'auto' },
  title: { ...font.title, color: colors.ink, textAlign: 'auto' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...font.body, fontWeight: '700', color: colors.ink },
  banner: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft, flexDirection: 'row', justifyContent: 'space-between' },
  bannerText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  sectionTitle: { ...font.h2, color: colors.ink, marginTop: 20, marginBottom: 12, textAlign: 'auto' },
  quick: { width: 170, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 2, borderWidth: 1, borderColor: colors.line },
  quickName: { fontWeight: '800', color: colors.ink, fontSize: 15, textAlign: 'auto' },
  quickSub: { color: colors.inkSoft, fontSize: 12, textAlign: 'auto' },
  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  quickPrice: { color: colors.accent, fontWeight: '800' },
  quickAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  quickAddGlyph: { color: colors.onBrand, fontSize: 20, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 16, overflow: 'hidden', ...shadow },
  cardImg: { height: 190, width: '100%' },
  tag: { position: 'absolute', top: 12, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.onBrand, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...font.h2, color: colors.ink, textAlign: 'auto' },
  desc: { color: colors.inkSoft, marginTop: 2, lineHeight: 20, textAlign: 'auto' },
  price: { marginTop: 8, fontWeight: '800', fontSize: 17, color: colors.accent, textAlign: 'auto' },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  addGlyph: { color: colors.onBrand, fontSize: 28, lineHeight: 30, fontWeight: '500' },
  fab: { position: 'absolute', minHeight: 60, borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  fabText: { color: colors.onBrand, fontSize: 17, fontWeight: '800' },
  fabBadge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  fabBadgeText: { color: colors.onBrand, fontWeight: '800', fontSize: 13 },
});
