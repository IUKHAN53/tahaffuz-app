import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';

import { brand } from '../theme';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tahaffuz Speech-Shield mark (text-less variant for in-app use).
 * The Urdu wordmark `تحفظ` is omitted at small sizes — it's only legible at
 * ~100px+. For sizes ≥ 96px, callers should pair this with a separate `<Text>`
 * Urdu wordmark so Noto Nastaliq Urdu renders via the system shaper.
 */
export function BrandMark({ size = 28, style }: Props) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="brand-shield" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1F4F8A" />
            <Stop offset="1" stopColor={brand.ink} />
          </LinearGradient>
        </Defs>
        <Path
          d="M100 20 L168 42 V100 C168 134 142 156 110 170 L96 184 L92 168 C68 162 32 142 32 100 V42 Z"
          fill="url(#brand-shield)"
        />
        <Circle cx="76" cy="142" r="8" fill={brand.amber} />
        <Circle cx="100" cy="142" r="8" fill={brand.amber} opacity={0.78} />
        <Circle cx="124" cy="142" r="8" fill={brand.amber} opacity={0.55} />
      </Svg>
    </View>
  );
}
