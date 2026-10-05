import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { XLogo } from '../components/ui';
import { colors } from '../theme';

/** Shows the brand for ~1.8 s before the app continues to login. */
export default function Splash({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),
      Animated.timing(word, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
    ]).start(({ finished }) => finished && onDone());
  }, [fade, scale, word, onDone]);

  return (
    <View style={s.root}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <XLogo size={120} />
      </Animated.View>
      <Animated.View style={{ opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <Text style={s.name}>COFFEE HOUSE</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 22 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 6 },
});
