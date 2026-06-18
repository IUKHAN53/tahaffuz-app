import * as Location from 'expo-location';
import type { LatLng } from './api';

// One location fix per app session is plenty for finding the nearest site —
// workers don't move far between questions, and re-prompting every message is
// annoying. Cached after the first successful fix.
let cached: LatLng | null = null;
let denied = false;

/**
 * Get the device's current location, asking for permission the first time.
 * Returns null if permission is denied or the fix fails — callers just send
 * messages without coordinates in that case.
 */
export async function getSessionLocation(): Promise<LatLng | null> {
  if (cached) return cached;
  if (denied) return null;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      denied = true;
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    cached = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    return cached;
  } catch {
    return null;
  }
}

/** The last known location, without triggering a permission prompt or fix. */
export function cachedLocation(): LatLng | null {
  return cached;
}
