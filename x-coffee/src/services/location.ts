import * as Location from 'expo-location';
import type { LatLng } from '../domain/types';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function requestLocationPermission(): Promise<PermissionResult> {
  const res = await Location.requestForegroundPermissionsAsync();
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'denied' : 'blocked';
}

export async function getCurrentLocation(): Promise<LatLng> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Continuous updates while the app is open. Fires on ≥25 m movement or every
 * 15 s, whichever comes first, to balance ETA freshness against battery.
 */
export async function watchLocation(
  onFix: (loc: LatLng, accuracy: number | undefined) => void,
): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 15_000 },
    (pos) =>
      onFix(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        pos.coords.accuracy ?? undefined,
      ),
  );
  return () => sub.remove();
}
