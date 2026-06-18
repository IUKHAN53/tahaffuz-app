import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tahaffuz.registered.v1';

/** Whether the worker has completed onboarding on this device. */
export async function isRegistered(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markRegistered(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // ignore — worst case they see onboarding again next launch
  }
}
