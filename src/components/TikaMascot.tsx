import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';

import { tika } from '../theme';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Droplet body color. Teal by default; pass '#fff' on teal backgrounds. */
  color?: string;
  /** Eye color. White by default; pass a teal on a white droplet. */
  face?: string;
  /** Set false for list items to avoid running many animation loops. */
  animated?: boolean;
};

/**
 * "Tika" — the Tika Dost droplet mascot (new logo). A teardrop (rounded square
 * with a sharp top-left corner, rotated 45°) with blinking eyes and an amber
 * smile. Mirrors the mockup's tdWiggle (gentle 5s wiggle) and tdBlink
 * (periodic eye blink) animations.
 */
export function TikaMascot({
  size = 42,
  style,
  color = tika.teal,
  face = '#FFFFFF',
  animated = true,
}: Props) {
  // One 0→1 driver per 5s cycle; wiggle + blink both key off it, matching the
  // mockup where both keyframe animations share the same 5s duration.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, t]);

  // tdWiggle: 0–62% rest at 45°, then 37° → 52° → 42° → 47° → 45°.
  const rotate = t.interpolate({
    inputRange: [0, 0.62, 0.7, 0.78, 0.86, 0.93, 1],
    outputRange: ['45deg', '45deg', '37deg', '52deg', '42deg', '47deg', '45deg'],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.62, 0.7, 0.78, 1],
    outputRange: [1, 1, 1.04, 1, 1],
  });
  // tdBlink: quick scaleY dip to 0.12 at ~90.5% of the cycle.
  const blink = t.interpolate({
    inputRange: [0, 0.88, 0.905, 0.93, 1],
    outputRange: [1, 1, 0.12, 1, 1],
  });

  const eye = size * 0.107;
  const eyeGap = size * 0.167;
  const smileW = size * 0.262;
  const smileH = size * 0.12;
  const smileStroke = Math.max(1.5, size * 0.06);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderTopLeftRadius: 0,
          borderTopRightRadius: size / 2,
          borderBottomRightRadius: size / 2,
          borderBottomLeftRadius: size / 2,
          transform: animated ? [{ rotate }, { scale }] : [{ rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.28,
          shadowRadius: size * 0.24,
          shadowOffset: { width: 0, height: size * 0.1 },
          elevation: 3,
        }}
      >
        <View
          style={{
            transform: [{ rotate: '-45deg' }],
            alignItems: 'center',
            gap: size * 0.072,
            marginTop: size * 0.12,
          }}
        >
          <View style={{ flexDirection: 'row', gap: eyeGap }}>
            <Animated.View
              style={{
                width: eye,
                height: eye,
                borderRadius: eye / 2,
                backgroundColor: face,
                transform: animated ? [{ scaleY: blink }] : undefined,
              }}
            />
            <Animated.View
              style={{
                width: eye,
                height: eye,
                borderRadius: eye / 2,
                backgroundColor: face,
                transform: animated ? [{ scaleY: blink }] : undefined,
              }}
            />
          </View>
          <View
            style={{
              width: smileW,
              height: smileH,
              borderBottomWidth: smileStroke,
              borderColor: tika.amber,
              borderBottomLeftRadius: smileW,
              borderBottomRightRadius: smileW,
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}
