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
import type { CategoryId, Product } from '../domain/types';
import { ProductImage, Stepper } from '../components/ui';
import { money, useStore } from '../state/store';
import { colors, font, radius, shadow } from '../theme';

export default function Home() {
  const { go, session, count, subtotal, qtyOf, add, remove, activeOrder } = useStore();
  const insets = useSafeAreaInsets();
  const list = useRef<SectionList<Product>>(null);
  const [active, setActive] = useState<CategoryId>('coffee');
  const sections = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        data: PRODUCTS.filter((p) => p.category === c.id),
      })),
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

  const hasLive = activeOrder && (activeOrder.status === 'waiting' || activeOrder.status === 'preparing' || activeOrder.status === 'ready');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.bg }}>
        <View style={s.header}>
          <View>
            <Text style={s.hello}>{session ? `Hi, ${session.name}` : 'Good to see you'}</Text>
            <Text style={s.title}>What are you having?</Text>
          </View>
          <Pressable onPress={() => go('barista')} accessibilityLabel="Barista console" style={s.baristaBtn}>
            <Text style={{ fontSize: 18 }}>👨‍🍳</Text>
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
                <Text style={[s.chipText, on && { color: colors.onBrand }]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {hasLive && (
          <Pressable onPress={() => go('tracking')} style={s.banner}>
            <Text style={s.bannerText}>
              Order {activeOrder!.id} ·{' '}
              {activeOrder!.status === 'waiting' ? 'Waiting for you to get closer' : activeOrder!.status === 'preparing' ? 'Being prepared' : 'Ready for pickup'}
            </Text>
            <Text style={s.bannerText}>View ›</Text>
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
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionTitle}>{section.emoji}  {section.name}</Text>
        )}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            qty={qtyOf(item.id)}
            onAdd={() => { Haptics.selectionAsync().catch(() => {}); add(item); }}
            onRemove={() => remove(item)}
          />
        )}
      />

      <Pressable
        testID="order-fab"
        accessibilityRole="button"
        accessibilityLabel={`Order, ${count} items`}
        onPress={() => go('order')}
        style={({ pressed }) => [s.fab, { bottom: insets.bottom + 20 }, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Text style={s.fabText}>🛍  Order</Text>
        {count > 0 && (
          <View style={s.fabBadge}>
            <Text style={s.fabBadgeText}>{count} · {money(subtotal)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function ProductCard({ product, qty, onAdd, onRemove }: { product: Product; qty: number; onAdd: () => void; onRemove: () => void }) {
  const emoji = CATEGORIES.find((c) => c.id === product.category)?.emoji;
  return (
    <View style={s.card}>
      <ProductImage uri={product.image} emoji={emoji} style={s.cardImg} />
      {product.popular && (
        <View style={s.tag}><Text style={s.tagText}>★ Popular</Text></View>
      )}
      <View style={s.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{product.name}</Text>
          <Text style={s.desc} numberOfLines={2}>{product.description}</Text>
          <Text style={s.price}>{money(product.price)}</Text>
        </View>
        {qty === 0 ? (
          <Pressable accessibilityLabel={`Add ${product.name}`} onPress={onAdd} style={s.addBtn}>
            <Text style={s.addGlyph}>+</Text>
          </Pressable>
        ) : (
          <Stepper qty={qty} onAdd={onAdd} onRemove={onRemove} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  hello: { ...font.label, color: colors.inkSoft },
  title: { ...font.title, color: colors.ink },
  baristaBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...font.body, fontWeight: '700', color: colors.ink },
  banner: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft, flexDirection: 'row', justifyContent: 'space-between' },
  bannerText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  sectionTitle: { ...font.h2, color: colors.ink, marginTop: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 16, overflow: 'hidden', ...shadow },
  cardImg: { height: 190, width: '100%' },
  tag: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.onBrand, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...font.h2, color: colors.ink },
  desc: { color: colors.inkSoft, marginTop: 2, lineHeight: 20 },
  price: { marginTop: 8, fontWeight: '800', fontSize: 17, color: colors.accent },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  addGlyph: { color: colors.onBrand, fontSize: 28, lineHeight: 30, fontWeight: '500' },
  fab: { position: 'absolute', right: 16, minHeight: 60, borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  fabText: { color: colors.onBrand, fontSize: 17, fontWeight: '800' },
  fabBadge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  fabBadgeText: { color: colors.onBrand, fontWeight: '800', fontSize: 13 },
});
