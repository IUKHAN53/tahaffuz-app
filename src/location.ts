import * as Location from 'expo-location';
import type { LatLng } from './api';

// A location fix goes stale fast in the field: users open the app at home,
// then travel to a vaccination centre — sending the session-start fix made
// "nearest site" answers point 5 km away from where they were standing. The
// fix is cached for a short TTL; when stale, a quick refresh runs with a hard
// time cap so messages are never held hostage by slow GPS.
let cached: LatLng | null = null;
let cachedAt = 0;
let denied = false;

const MAX_AGE_MS = 2 * 60 * 1000;
const REFRESH_CAP_MS = 2500;

async function fetchFix(): Promise<LatLng | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    cached = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    cachedAt = Date.now();
    return cached;
  } catch {
    // Keep whatever we had — a slightly stale fix beats none.
    return cached;
  }
}

/**
 * Get the device's location, asking for permission the first time. Fresh
 * (≤2 min old) fixes return instantly; stale ones trigger a refresh capped at
 * 2.5s that falls back to the stale fix. Returns null when permission is
 * denied or no fix has ever succeeded — callers just send without coordinates.
 */
export async function getSessionLocation(): Promise<LatLng | null> {
  if (denied) return null;

  if (cached && Date.now() - cachedAt < MAX_AGE_MS) {
    return cached;
  }

  if (!cached) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      denied = true;
      return null;
    }
    return fetchFix();
  }

  // Stale: refresh quickly, but never stall the message on slow GPS.
  return Promise.race([
    fetchFix(),
    new Promise<LatLng | null>((resolve) => setTimeout(() => resolve(cached), REFRESH_CAP_MS)),
  ]);
}

/** The last known location, without triggering a permission prompt or fix. */
export function cachedLocation(): LatLng | null {
  return cached;
}
