import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tika } from '../theme';

type Props = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Three green dots that pulse with a stagger (mockup tdDot) — the assistant
 * "thinking…" indicator shown in the status pill while an answer is prepared.
 */
export function TypingDots({ size = 6, color = tika.tealBright, style }: Props) {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 380, useNativeDriver: true }),
        ]),
      );
    const loops = [pulse(a, 0), pulse(b, 140), pulse(c, 280)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b, c]);

  const dot = (val: Animated.Value, key: string) => (
    <Animated.View
      key={key}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: val,
        },
      ]}
    />
  );

  return (
    <View style={[styles.row, style]}>
      {dot(a, 'a')}
      {dot(b, 'b')}
      {dot(c, 'c')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
