import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Chip, ProductImage, Stepper } from '../components/ui';
import { CATEGORIES, productById } from '../domain/menu';
import {
  GROUP_TITLE,
  MAX_SHOTS,
  MILK,
  SHOT_PRICE,
  SIZE,
  SUGAR,
  SYRUP,
  defaultChoice,
  unitPrepSeconds,
  unitPrice,
} from '../domain/options';
import type { Choice, OptionGroupId } from '../domain/types';
import { useStore } from '../state/store';
import { colors, font, radius, shadow } from '../theme';

export default function ProductScreen() {
  const { productId, back, t, lang, isRTL, market, money, mins, addLine } = useStore();
  const insets = useSafeAreaInsets();
  const product = productId ? productById(productId) : undefined;
  const [choice, setChoice] = useState<Choice>(() => (product ? defaultChoice(product) : {}));
  const [qty, setQty] = useState(1);

  const cur = market.currency;
  const each = useMemo(() => (product ? unitPrice(product, choice, cur) : 0), [product, choice, cur]);
  if (!product) return null;

  const set = <K extends keyof Choice>(k: K, v: Choice[K]) => setChoice((c) => ({ ...c, [k]: v }));
  const delta = (price?: Record<string, number>) => (price ? `+${money(price[cur])}` : undefined);
  const emoji = CATEGORIES.find((c) => c.id === product.category)?.emoji;

  const add = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addLine(product, { ...choice, notes: choice.notes?.trim() || undefined }, qty);
    back();
  };

  const group = (g: OptionGroupId) => {
    switch (g) {
      case 'size':
        return (
          <Group key={g} title={GROUP_TITLE.size[lang]} hint={t('pickOne')}>
            {SIZE.map((o) => (
              <Chip key={o.value} label={o.label[lang]} sub={delta(o.price)} selected={choice.size === o.value} onPress={() => set('size', o.value)} />
            ))}
          </Group>
        );
      case 'milk':
        return (
          <Group key={g} title={GROUP_TITLE.milk[lang]} hint={t('pickOne')}>
            {MILK.map((o) => (
              <Chip key={o.value} label={o.label[lang]} sub={delta(o.price)} selected={choice.milk === o.value} onPress={() => set('milk', o.value)} />
            ))}
          </Group>
        );
      case 'sugar':
        return (
          <Group key={g} title={GROUP_TITLE.sugar[lang]} hint={t('pickOne')}>
            {SUGAR.map((o) => (
              <Chip key={o.value} label={o.label[lang]} selected={choice.sugar === o.value} onPress={() => set('sugar', o.value)} />
            ))}
          </Group>
        );
      case 'syrup':
        return (
          <Group key={g} title={GROUP_TITLE.syrup[lang]} hint={t('optional')}>
            {SYRUP.map((o) => (
              <Chip key={o.value} label={o.label[lang]} sub={delta(o.price)} selected={choice.syrup === o.value} onPress={() => set('syrup', o.value)} />
            ))}
          </Group>
        );
      case 'shots':
        return (
          <View key={g} style={s.rowGroup}>
            <View style={{ flex: 1 }}>
              <Text style={s.groupTitle}>{GROUP_TITLE.shots[lang]}</Text>
              <Text style={s.hint}>{`+${money(SHOT_PRICE[cur])} · ${t('upTo', { n: MAX_SHOTS })}`}</Text>
            </View>
            <Stepper
              qty={choice.shots ?? 0}
              onAdd={() => set('shots', Math.min(MAX_SHOTS, (choice.shots ?? 0) + 1))}
              onRemove={() => set('shots', Math.max(0, (choice.shots ?? 0) - 1))}
            />
          </View>
        );
      case 'warm':
        return (
          <Group key={g} title={GROUP_TITLE.warm[lang]} hint={t('optional')}>
            <Chip label={lang === 'ar' ? 'بدون تسخين' : 'As is'} selected={!choice.warm} onPress={() => set('warm', false)} />
            <Chip label={lang === 'ar' ? 'سخّنه' : 'Warm it up'} sub={`+${mins(60)}`} selected={!!choice.warm} onPress={() => set('warm', true)} />
          </Group>
        );
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View>
          <ProductImage uri={product.image} emoji={emoji} style={s.hero} />
          <Pressable
            onPress={back}
            accessibilityLabel={t('back')}
            hitSlop={8}
            style={[s.close, { top: insets.top + 12 }, isRTL ? { right: 16 } : { left: 16 }]}
          >
            <Text style={s.closeGlyph}>{isRTL ? '›' : '‹'}</Text>
          </Pressable>
        </View>

        <View style={s.sheet}>
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              {product.popular && <Text style={s.popular}>{t('popular')}</Text>}
              <Text style={s.name}>{product.name[lang]}</Text>
            </View>
            <Text style={s.basePrice}>{money(product.price[cur])}</Text>
          </View>
          <Text style={s.desc}>{product.description[lang]}</Text>
          <Text style={s.prep}>⏱ {t('prepTime')}: ~{mins(unitPrepSeconds(product, choice))}</Text>

          {product.options.map(group)}

          <View style={{ gap: 8 }}>
            <Text style={s.groupTitle}>{t('notes')} <Text style={s.hint}>({t('optional')})</Text></Text>
            <TextInput
              value={choice.notes ?? ''}
              onChangeText={(v) => set('notes', v.slice(0, 120))}
              placeholder={t('notesPlaceholder')}
              placeholderTextColor={colors.inkSoft}
              style={s.notes}
              multiline
            />
          </View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Stepper qty={qty} min={1} onAdd={() => setQty((q) => Math.min(20, q + 1))} onRemove={() => setQty((q) => Math.max(1, q - 1))} />
        <Button testID="add-to-order" label={t('addToOrder', { price: money(each * qty) })} onPress={add} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={s.groupTitle}>{title}</Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      <View style={s.chips}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { width: '100%', height: 320 },
  close: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  closeGlyph: { fontSize: 30, lineHeight: 32, color: colors.ink },
  sheet: { marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  popular: { ...font.label, color: colors.accent, marginBottom: 4, textAlign: 'auto' },
  name: { ...font.title, color: colors.ink, textAlign: 'auto' },
  basePrice: { fontSize: 20, fontWeight: '800', color: colors.accent },
  desc: { ...font.body, color: colors.inkSoft, lineHeight: 24, marginTop: -10, textAlign: 'auto' },
  prep: { color: colors.inkSoft, fontSize: 14, marginTop: -12, textAlign: 'auto' },
  rowGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupTitle: { ...font.h2, fontSize: 17, color: colors.ink, textAlign: 'auto' },
  hint: { fontSize: 13, color: colors.inkSoft, fontWeight: '400' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notes: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, padding: 14, fontSize: 16, color: colors.ink, textAlignVertical: 'top', textAlign: 'auto' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
