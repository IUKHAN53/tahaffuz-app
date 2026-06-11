import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { brand } from '../theme';

type Props = {
  isRecording: boolean;
  recordingHint: string;
  tapToRecordHint: string;
};

/** Animated voice recording hint with visual feedback. */
function VoiceHintComponent({ isRecording, recordingHint, tapToRecordHint }: Props) {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    waveAnim.setValue(0);
  }, [isRecording, waveAnim]);

  const waveScale = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0.6],
  });

  return (
    <View style={styles.container}>
      {isRecording ? (
        <View style={styles.recordingRow}>
          <View style={styles.waveContainer}>
            <Animated.View
              style={[
                styles.wave,
                { transform: [{ scale: waveScale }], opacity: waveOpacity },
              ]}
            />
            <View style={styles.recordingDot} />
          </View>
          <Text style={styles.recordingText}>{recordingHint}</Text>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Text style={styles.micIcon}>🎤</Text>
          <Text style={styles.hintText}>{tapToRecordHint}</Text>
        </View>
      )}
    </View>
  );
}

export const VoiceHint = memo(VoiceHintComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.7,
  },
  micIcon: {
    fontSize: 14,
  },
  hintText: {
    fontSize: 13,
    color: brand.indigoSoft,
    fontWeight: '500',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waveContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B3261E',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B3261E',
  },
  recordingText: {
    fontSize: 14,
    color: '#B3261E',
    fontWeight: '700',
  },
});
