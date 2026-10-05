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

export function Stepper({ qty, onAdd, onRemove }: { qty: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel="Remove one" hitSlop={8} onPress={onRemove} style={s.stepBtn}>
        <Text style={s.stepGlyph}>−</Text>
      </Pressable>
      <Text style={s.stepQty}>{qty}</Text>
      <Pressable accessibilityLabel="Add one" hitSlop={8} onPress={onAdd} style={s.stepBtn}>
        <Text style={s.stepGlyph}>+</Text>
      </Pressable>
    </View>
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
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, fontWeight: '700', color: colors.ink },
  stepQty: { minWidth: 22, textAlign: 'center', fontWeight: '700', color: colors.ink, fontSize: 16 },
});
