import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { brand } from '../theme';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Shield fill — defaults to cream (for dark headers). Pass an ink tone for light backgrounds. */
  shield?: string;
};

/**
 * Tika Dost "Chat Shield" mark (Concept B): a shield with a speech-bubble tail
 * and three amber dots — protection + a conversational, friendly companion.
 * Cream shield by default (sits on the app's dark headers); pass `shield` to
 * recolor it for light backgrounds.
 */
export function BrandMark({ size = 28, style, shield = brand.cream }: Props) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
          d="M50 9 L82 20 C84 20.8 85 22 85 24 L85 50 C85 70 71 83 56 89 L60 99 L43 88 C27 84 15 70 15 50 L15 24 C15 22 16 20.8 18 20 Z"
          fill={shield}
        />
        <Circle cx="35" cy="50" r="6.5" fill={brand.amber} />
        <Circle cx="50" cy="50" r="6.5" fill={brand.amber} />
        <Circle cx="65" cy="50" r="6.5" fill={brand.amber} />
      </Svg>
    </View>
  );
}
