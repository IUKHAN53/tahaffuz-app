import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tahaffuz.deviceId';

function rand(): string {
  // 24-char alphanumeric
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 24; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = `dev_${rand()}`;
    await AsyncStorage.setItem(KEY, id);
  }
  return id;
}
