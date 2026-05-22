import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ur', label: 'اردو' },
  { value: 'rud', label: 'Roman' },
];

/** Compact segmented control for switching the whole app's language. */
function LanguageSwitcherComponent() {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const active = language === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => setLanguage(opt.value)}
            android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: false }}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const LanguageSwitcher = memo(LanguageSwitcherComponent);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244,238,227,0.12)',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  segment: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: brand.cream,
  },
  label: {
    color: 'rgba(244,238,227,0.78)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  labelActive: {
    color: brand.ink,
  },
});
