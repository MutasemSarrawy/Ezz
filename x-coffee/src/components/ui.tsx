import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius } from '../theme';
import { useStore } from '../state/store';

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, testID }: BtnProps) {
  const dim = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!dim }}
      onPress={onPress}
      disabled={dim}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'secondary' && s.btnSecondary,
        variant === 'ghost' && s.btnGhost,
        dim && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : colors.ink} />
      ) : (
        <Text style={[s.btnText, variant !== 'primary' && { color: colors.ink }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Product photo with an emoji tile underneath so a slow/missing image never looks broken. */
export function ProductImage({ uri, emoji = '☕', style }: { uri: string; emoji?: string; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ backgroundColor: colors.accentSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      {!failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && s.segOn]}
          >
            <Text style={[s.segText, on && { color: colors.onBrand }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ qty, onAdd, onRemove, min = 0 }: { qty: number; onAdd: () => void; onRemove: () => void; min?: number }) {
  const { t } = useStore();
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel={t('removeOne')} hitSlop={8} onPress={onRemove} disabled={qty <= min} style={[s.stepBtn, qty <= min && { opacity: 0.35 }]}>
        <Text style={s.stepGlyph}>−</Text>
      </Pressable>
      <Text style={s.stepQty}>{qty}</Text>
      <Pressable accessibilityLabel={t('addOne')} hitSlop={8} onPress={onAdd} style={s.stepBtn}>
        <Text style={s.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

/** Top bar with a back arrow that points the right way in Arabic. */
export function Header({ title, top, right }: { title: string; top: number; right?: React.ReactNode }) {
  const { back, t, isRTL } = useStore();
  return (
    <View style={[s.header, { paddingTop: top + 8 }]}>
      <Pressable onPress={back} hitSlop={12} accessibilityLabel={t('back')} style={s.backBtn}>
        <Text style={s.backGlyph}>{isRTL ? '›' : '‹'}</Text>
      </Pressable>
      <Text style={[s.headerTitle, { flex: 1 }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, sub, selected, onPress }: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, selected && s.chipOn, pressed && { opacity: 0.85 }]}
    >
      <Text style={[s.chipText, selected && { color: colors.onBrand }]}>{label}</Text>
      {sub ? <Text style={[s.chipSub, selected && { color: colors.accentSoft }]}>{sub}</Text> : null}
    </Pressable>
  );
}

/** Tappable settings-style row with a direction-aware chevron. */
export function ListRow({ icon, title, value, onPress, danger, testID }: { icon: string; title: string; value?: string; onPress: () => void; danger?: boolean; testID?: string }) {
  const { isRTL } = useStore();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.listRow, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <Text style={s.listIcon}>{icon}</Text>
      <Text style={[s.listTitle, danger && { color: colors.danger }]}>{title}</Text>
      {value ? <Text style={s.listValue}>{value}</Text> : null}
      {!danger && <Text style={s.chevron}>{isRTL ? '‹' : '›'}</Text>}
    </Pressable>
  );
}

export function XLogo({ size = 96 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="X Coffee House logo"
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
        borderWidth: size * 0.04, borderColor: colors.accent,
      }}
    >
      <Text style={{ color: colors.onBrand, fontSize: size * 0.62, fontWeight: '900', lineHeight: size * 0.74 }}>X</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnPrimary: { backgroundColor: colors.brand },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { ...font.body, fontWeight: '700', color: colors.onBrand },
  seg: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.brand },
  segText: { ...font.body, fontWeight: '700', color: colors.ink },
  header: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 36, lineHeight: 38, color: colors.ink },
  headerTitle: { ...font.title, color: colors.ink, textAlign: 'auto' },
  chip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  chipSub: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16 },
  listIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  listTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink, textAlign: 'auto' },
  listValue: { fontSize: 14, color: colors.inkSoft },
  chevron: { fontSize: 24, color: colors.inkSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, fontWeight: '700', color: colors.ink },
  stepQty: { minWidth: 22, textAlign: 'center', fontWeight: '700', color: colors.ink, fontSize: 16 },
});
