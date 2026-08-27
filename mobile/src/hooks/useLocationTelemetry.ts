import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { mobileApiRequest } from '../api/client';

export interface LocationTelemetryState {
  isTracking: boolean;
  permissionGranted: boolean;
  lastPingTime: Date | null;
  currentCoords: { lat: number; lng: number } | null;
  speed: number;
  batteryLevel: number;
  errorMsg: string | null;
  triggerManualPing: () => Promise<void>;
}

export const useLocationTelemetry = (enabled: boolean = true) => {
  const [state, setState] = useState<Omit<LocationTelemetryState, 'triggerManualPing'>>({
    isTracking: false,
    permissionGranted: false,
    lastPingTime: null,
    currentCoords: null,
    speed: 0,
    batteryLevel: 100,
    errorMsg: null
  });

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<any>(null);

  const processAndSendLocation = async (loc: Location.LocationObject) => {
    try {
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const speedKmH = Math.round(Math.max(0, (loc.coords.speed || 0) * 3.6));
      const heading = Math.round(loc.coords.heading || 0);

      let battPct = 100;
      try {
        const batt = await Battery.getBatteryLevelAsync();
        if (batt >= 0) battPct = Math.round(batt * 100);
      } catch {
        battPct = 100;
      }

      await mobileApiRequest('/trackboard/pings', {
        method: 'POST',
        body: JSON.stringify({
          geoLat: lat,
          geoLng: lng,
          speed: speedKmH,
          batteryLevel: battPct,
          heading
        })
      });

      setState(prev => ({
        ...prev,
        isTracking: true,
        permissionGranted: true,
        lastPingTime: new Date(),
        currentCoords: { lat, lng },
        speed: speedKmH,
        batteryLevel: battPct,
        errorMsg: null
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        errorMsg: err?.message || 'GPS ping failed'
      }));
    }
  };

  const triggerManualPing = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      await processAndSendLocation(loc);
    } catch (e: any) {
      setState(prev => ({ ...prev, errorMsg: e?.message || 'Manual GPS ping failed' }));
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (watcherRef.current) watcherRef.current.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    let isMounted = true;

    const startTracking = async () => {
      try {
        // 1. Request foreground location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        if (status !== 'granted') {
          setState(prev => ({
            ...prev,
            permissionGranted: false,
            errorMsg: 'GPS Location permission denied. Please allow location in device settings.'
          }));
          return;
        }

        setState(prev => ({ ...prev, permissionGranted: true, errorMsg: null }));

        // 2. Immediate real GPS ping
        try {
          const initialLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High
          });
          if (isMounted) {
            await processAndSendLocation(initialLoc);
          }
        } catch {}

        // 3. Continuous GPS Watcher (triggers on movement or high accuracy updates)
        try {
          watcherRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 5
            },
            (loc) => {
              if (isMounted) {
                processAndSendLocation(loc);
              }
            }
          );
        } catch {}

        // 4. Periodic 20-second heartbeat interval (ensures pings even when stationary)
        intervalRef.current = setInterval(async () => {
          if (!isMounted) return;
          try {
            const currentLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced
            });
            await processAndSendLocation(currentLoc);
          } catch {}
        }, 20000);
      } catch (err: any) {
        if (isMounted) {
          setState(prev => ({ ...prev, errorMsg: err?.message || 'Location error' }));
        }
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (watcherRef.current) watcherRef.current.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return {
    ...state,
    triggerManualPing
  };
};
