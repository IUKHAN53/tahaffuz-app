import { type StyleProp, type ViewStyle } from 'react-native';

import { tika } from '../theme';
import { TikaMascot } from './TikaMascot';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Droplet body color (legacy prop name kept so old call sites still work). */
  shield?: string;
};

/**
 * Static Tika Dost mark — the droplet mascot without animation loops, safe for
 * list rows and repeated use. The animated version lives in TikaMascot.
 *
 * Legacy note: callers used to pass `shield` (cream on dark headers). The new
 * design has light headers, so the default body is teal; a light `shield`
 * value still renders a light droplet with teal eyes for dark surfaces.
 */
export function BrandMark({ size = 28, style, shield }: Props) {
  const light = shield !== undefined && shield !== tika.teal;
  return (
    <TikaMascot
      size={size}
      style={style}
      animated={false}
      color={light ? shield : tika.teal}
      face={light ? tika.teal : '#FFFFFF'}
    />
  );
}
