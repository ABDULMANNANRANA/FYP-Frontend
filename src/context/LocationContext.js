import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { postJson } from '../services/locationApi';
import {
  PERMISSION_BLOCKED,
  PERMISSION_DENIED,
  PERMISSION_GRANTED,
  UPLOAD_MIN_DISTANCE_METERS,
  UPLOAD_MIN_INTERVAL_MS,
  clearPositionWatch,
  getReliablePosition,
  haversineMeters,
  isFreshFix,
  isGoodFix,
  requestLocationPermission,
  watchPosition,
} from '../services/location';

const TRACKING_KEY = 'locationTrackingEnabled';

const LocationContext = createContext(null);

/**
 * Owns the device's location for the whole app session.
 *
 *  * one position watcher, running while the app is open
 *  * the latest fix, shared with any screen that needs it
 *  * throttled "live location" pings to the backend
 *
 * Alerts are NOT raised here — see components/GeofenceWatcher.
 */
export const LocationProvider = ({ children }) => {
  const [permission, setPermission] = useState('unknown');
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [watching, setWatching] = useState(false);
  const [lastUploadAt, setLastUploadAt] = useState(null);
  const [lastFix, setLastFix] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const watchIdRef = useRef(null);
  const permissionRef = useRef('unknown');
  const lastUploadRef = useRef({ at: 0, latitude: null, longitude: null });

  const setPermissionState = useCallback(status => {
    permissionRef.current = status;
    setPermission(status);
  }, []);

  // ---------------------------------------------------------------- uploads

  const uploadPosition = useCallback(async fix => {
    const last = lastUploadRef.current;
    const now = Date.now();

    const movedMeters =
      last.latitude === null
        ? Number.POSITIVE_INFINITY
        : haversineMeters(
            last.latitude,
            last.longitude,
            fix.latitude,
            fix.longitude,
          );

    const elapsedMs = now - last.at;

    const firstEverUpload = last.at === 0;

    // Throttle: only ping the server after a real move or enough time.
    if (
      !firstEverUpload &&
      elapsedMs < UPLOAD_MIN_INTERVAL_MS &&
      movedMeters < UPLOAD_MIN_DISTANCE_METERS
    ) {
      return;
    }

    // Nothing to attribute the position to before login.
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      return;
    }

    try {
      await postJson('/User/location', {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
      });

      lastUploadRef.current = {
        at: now,
        latitude: fix.latitude,
        longitude: fix.longitude,
      };

      setLastUploadAt(now);
      setUploadError(null);
    } catch (uploadFailure) {
      // A failed ping must never interrupt what the user is doing.
      setUploadError(uploadFailure?.message || 'Location sync failed.');
    }
  }, []);

  const handlePosition = useCallback(
    fix => {
      setPosition(fix);
      setLastFix(fix);
      setError(null);
      uploadPosition(fix);
    },
    [uploadPosition],
  );

  const handlePositionError = useCallback(failure => {
    setError(failure?.message || 'Could not read your location.');
  }, []);

  // ---------------------------------------------------------------- watching

  const stopWatching = useCallback(() => {
    clearPositionWatch(watchIdRef.current);
    watchIdRef.current = null;
    setWatching(false);
  }, []);

  const startWatching = useCallback(async () => {
    // Already running.
    if (watchIdRef.current !== null) {
      return true;
    }

    const status = await requestLocationPermission();

    setPermissionState(status);

    if (status !== PERMISSION_GRANTED) {
      setError(
        status === PERMISSION_BLOCKED
          ? 'Location permission is blocked. Enable it in Settings.'
          : 'Location permission is needed for place reminders.',
      );

      return false;
    }

    // Get one usable fix so the UI is useful straight away. A coarse or
    // cached position beats an empty screen; the watcher refines it shortly.
    try {
      const fix = await getReliablePosition();
      handlePosition(fix);
    } catch (firstFixError) {
      setError(firstFixError?.message || 'Waiting for a GPS fix...');
    }

    watchIdRef.current = watchPosition(handlePosition, handlePositionError);
    setWatching(true);

    return true;
  }, [handlePosition, handlePositionError, setPermissionState]);

  // Start automatically once the user is logged in, and re-check whenever
  // the app comes back to the foreground (e.g. after changing the setting
  // in the OS, or after logging in).
  useEffect(() => {
    let cancelled = false;

    const tryStart = async () => {
      if (cancelled || !trackingEnabled) {
        return;
      }

      // Never nag: only auto-prompt if we have not already been refused.
      if (
        permissionRef.current === PERMISSION_DENIED ||
        permissionRef.current === PERMISSION_BLOCKED
      ) {
        return;
      }

      const token = await AsyncStorage.getItem('token');

      if (cancelled || !token) {
        return;
      }

      await startWatching();
    };

    const restoreSetting = async () => {
      const stored = await AsyncStorage.getItem(TRACKING_KEY);

      if (stored === 'false') {
        setTrackingEnabled(false);
      }

      return stored;
    };

    (async () => {
      const stored = await restoreSetting();

      if (stored !== 'false') {
        await tryStart();
      }
    })();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        tryStart();
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [startWatching, trackingEnabled]);

  // Clean up the watcher when the provider unmounts.
  useEffect(() => () => stopWatching(), [stopWatching]);

  // ---------------------------------------------------------------- controls

  const setTracking = useCallback(
    async enabled => {
      setTrackingEnabled(enabled);
      await AsyncStorage.setItem(TRACKING_KEY, enabled ? 'true' : 'false');

      if (enabled) {
        await startWatching();
      } else {
        stopWatching();
      }
    },
    [startWatching, stopWatching],
  );

  /**
   * Manual one-shot fix, used by the "use my current location" button.
   *
   * Order of preference, fastest first:
   *   1. the live watcher's position, if it is recent and accurate
   *   2. a quick network/cached fix
   *   3. a full GPS fix
   * Step 1 is what stops the button from hanging while a perfectly good
   * position sits in state.
   */
  const refresh = useCallback(async () => {
    if (isFreshFix(position) && isGoodFix(position)) {
      setError(null);
      return position;
    }

    const status = await requestLocationPermission();

    setPermissionState(status);

    if (status !== PERMISSION_GRANTED) {
      return null;
    }

    let provisional = null;

    try {
      const fix = await getReliablePosition({
        onProvisional: quick => {
          provisional = quick;
          setPosition(quick);
          setError(null);
        },
      });

      provisional = fix;
      setPosition(provisional);
      setError(null);

      return provisional;
    } catch (fixError) {
      // Keep whatever we do have rather than failing outright.
      if (provisional) {
        setPosition(provisional);
        setError(null);
        return provisional;
      }

      if (position) {
        setError(null);
        return position;
      }

      setError(fixError?.message || 'Could not read your location.');
      return null;
    }
  }, [position, setPermissionState]);

  /**
   * Force a server ping now, ignoring the throttle — powers the
   * "Send now" button so the demo can show the server receiving it.
   */
  const syncNow = useCallback(async () => {
    const fix = position || (await refresh());

    if (!fix) {
      return false;
    }

    // Resetting the throttle state makes the next upload go through.
    lastUploadRef.current = { at: 0, latitude: null, longitude: null };

    await uploadPosition(fix);

    return true;
  }, [position, refresh, uploadPosition]);

  const value = useMemo(
    () => ({
      permission,
      position,
      error,
      watching,
      trackingEnabled,
      lastUploadAt,
      lastFix,
      uploadError,
      setTracking,
      startWatching,
      stopWatching,
      refresh,
      syncNow,
    }),
    [
      permission,
      position,
      error,
      watching,
      trackingEnabled,
      lastUploadAt,
      lastFix,
      uploadError,
      setTracking,
      startWatching,
      stopWatching,
      refresh,
      syncNow,
    ],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error('useLocation must be used inside a LocationProvider.');
  }

  return context;
};

/**
 * The user's saved location & permission, reduced to just what the
 * task screens need. onCapture receives { latitude, longitude, accuracy }.
 */
export const useCurrentLocation = () => {
  const { position, permission, refresh, error, watching } = useLocation();
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    setCapturing(true);

    try {
      return (await refresh()) || position || null;
    } finally {
      setCapturing(false);
    }
  }, [position, refresh]);

  return {
    position,
    permission,
    error,
    watching,
    capturing,
    capture,
  };
};






































// import React, {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import { AppState } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { postJson } from '../services/locationApi';
// import {
//   PERMISSION_BLOCKED,
//   PERMISSION_DENIED,
//   PERMISSION_GRANTED,
//   UPLOAD_MIN_DISTANCE_METERS,
//   UPLOAD_MIN_INTERVAL_MS,
//   clearPositionWatch,
//   getCurrentPosition,
//   haversineMeters,
//   requestLocationPermission,
//   watchPosition,
// } from '../services/location';

// const TRACKING_KEY = 'locationTrackingEnabled';

// const LocationContext = createContext(null);

// /**
//  * Owns the device's location for the whole app session.
//  *
//  *  * one position watcher, running while the app is open
//  *  * the latest fix, shared with any screen that needs it
//  *  * throttled "live location" pings to the backend
//  *
//  * Alerts are NOT raised here — see components/GeofenceWatcher.
//  */
// export const LocationProvider = ({ children }) => {
//   const [permission, setPermission] = useState('unknown');
//   const [position, setPosition] = useState(null);
//   const [error, setError] = useState(null);
//   const [trackingEnabled, setTrackingEnabled] = useState(true);
//   const [watching, setWatching] = useState(false);
//   const [lastUploadAt, setLastUploadAt] = useState(null);
//   const [uploadError, setUploadError] = useState(null);

//   const watchIdRef = useRef(null);
//   const permissionRef = useRef('unknown');
//   const lastUploadRef = useRef({ at: 0, latitude: null, longitude: null });

//   const setPermissionState = useCallback(status => {
//     permissionRef.current = status;
//     setPermission(status);
//   }, []);

//   // ---------------------------------------------------------------- uploads

//   const uploadPosition = useCallback(async fix => {
//     const last = lastUploadRef.current;
//     const now = Date.now();

//     const movedMeters =
//       last.latitude === null
//         ? Number.POSITIVE_INFINITY
//         : haversineMeters(
//             last.latitude,
//             last.longitude,
//             fix.latitude,
//             fix.longitude,
//           );

//     const elapsedMs = now - last.at;

//     const firstEverUpload = last.at === 0;

//     // Throttle: only ping the server after a real move or enough time.
//     if (
//       !firstEverUpload &&
//       elapsedMs < UPLOAD_MIN_INTERVAL_MS &&
//       movedMeters < UPLOAD_MIN_DISTANCE_METERS
//     ) {
//       return;
//     }

//     // Nothing to attribute the position to before login.
//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       return;
//     }

//     try {
//       await postJson('/User/location', {
//         latitude: fix.latitude,
//         longitude: fix.longitude,
//         accuracy: fix.accuracy,
//       });

//       lastUploadRef.current = {
//         at: now,
//         latitude: fix.latitude,
//         longitude: fix.longitude,
//       };

//       setLastUploadAt(now);
//       setUploadError(null);
//     } catch (uploadFailure) {
//       // A failed ping must never interrupt what the user is doing.
//       setUploadError(uploadFailure?.message || 'Location sync failed.');
//     }
//   }, []);

//   const handlePosition = useCallback(
//     fix => {
//       setPosition(fix);
//       setError(null);
//       uploadPosition(fix);
//     },
//     [uploadPosition],
//   );

//   const handlePositionError = useCallback(failure => {
//     setError(failure?.message || 'Could not read your location.');
//   }, []);

//   // ---------------------------------------------------------------- watching

//   const stopWatching = useCallback(() => {
//     clearPositionWatch(watchIdRef.current);
//     watchIdRef.current = null;
//     setWatching(false);
//   }, []);

//   const startWatching = useCallback(async () => {
//     // Already running.
//     if (watchIdRef.current !== null) {
//       return true;
//     }

//     const status = await requestLocationPermission();

//     setPermissionState(status);

//     if (status !== PERMISSION_GRANTED) {
//       setError(
//         status === PERMISSION_BLOCKED
//           ? 'Location permission is blocked. Enable it in Settings.'
//           : 'Location permission is needed for place reminders.',
//       );

//       return false;
//     }

//     // Get one fix immediately so the UI is useful straight away.
//     try {
//       const fix = await getCurrentPosition();
//       handlePosition(fix);
//     } catch (firstFixError) {
//       setError(firstFixError?.message || 'Waiting for a GPS fix...');
//     }

//     watchIdRef.current = watchPosition(handlePosition, handlePositionError);
//     setWatching(true);

//     return true;
//   }, [handlePosition, handlePositionError, setPermissionState]);

//   // Start automatically once the user is logged in, and re-check whenever
//   // the app comes back to the foreground (e.g. after changing the setting
//   // in the OS, or after logging in).
//   useEffect(() => {
//     let cancelled = false;

//     const tryStart = async () => {
//       if (cancelled || !trackingEnabled) {
//         return;
//       }

//       // Never nag: only auto-prompt if we have not already been refused.
//       if (
//         permissionRef.current === PERMISSION_DENIED ||
//         permissionRef.current === PERMISSION_BLOCKED
//       ) {
//         return;
//       }

//       const token = await AsyncStorage.getItem('token');

//       if (cancelled || !token) {
//         return;
//       }

//       await startWatching();
//     };

//     const restoreSetting = async () => {
//       const stored = await AsyncStorage.getItem(TRACKING_KEY);

//       if (stored === 'false') {
//         setTrackingEnabled(false);
//       }

//       return stored;
//     };

//     (async () => {
//       const stored = await restoreSetting();

//       if (stored !== 'false') {
//         await tryStart();
//       }
//     })();

//     const subscription = AppState.addEventListener('change', state => {
//       if (state === 'active') {
//         tryStart();
//       }
//     });

//     return () => {
//       cancelled = true;
//       subscription?.remove();
//     };
//   }, [startWatching, trackingEnabled]);

//   // Clean up the watcher when the provider unmounts.
//   useEffect(() => () => stopWatching(), [stopWatching]);

//   // ---------------------------------------------------------------- controls

//   const setTracking = useCallback(
//     async enabled => {
//       setTrackingEnabled(enabled);
//       await AsyncStorage.setItem(TRACKING_KEY, enabled ? 'true' : 'false');

//       if (enabled) {
//         await startWatching();
//       } else {
//         stopWatching();
//       }
//     },
//     [startWatching, stopWatching],
//   );

//   /** Manual one-shot fix, used by the "use my current location" button. */
//   const refresh = useCallback(async () => {
//     const status = await requestLocationPermission();

//     setPermissionState(status);

//     if (status !== PERMISSION_GRANTED) {
//       return null;
//     }

//     try {
//       const fix = await getCurrentPosition({ maximumAge: 0 });
//       setPosition(fix);
//       setError(null);
//       return fix;
//     } catch (fixError) {
//       setError(fixError?.message || 'Could not read your location.');
//       return null;
//     }
//   }, [setPermissionState]);

//   /**
//    * Force a server ping now, ignoring the throttle — powers the
//    * "Send now" button so the demo can show the server receiving it.
//    */
//   const syncNow = useCallback(async () => {
//     const fix = position || (await refresh());

//     if (!fix) {
//       return false;
//     }

//     // Resetting the throttle state makes the next upload go through.
//     lastUploadRef.current = { at: 0, latitude: null, longitude: null };

//     await uploadPosition(fix);

//     return true;
//   }, [position, refresh, uploadPosition]);

//   const value = useMemo(
//     () => ({
//       permission,
//       position,
//       error,
//       watching,
//       trackingEnabled,
//       lastUploadAt,
//       uploadError,
//       setTracking,
//       startWatching,
//       stopWatching,
//       refresh,
//       syncNow,
//     }),
//     [
//       permission,
//       position,
//       error,
//       watching,
//       trackingEnabled,
//       lastUploadAt,
//       uploadError,
//       setTracking,
//       startWatching,
//       stopWatching,
//       refresh,
//       syncNow,
//     ],
//   );

//   return (
//     <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
//   );
// };

// export const useLocation = () => {
//   const context = useContext(LocationContext);

//   if (!context) {
//     throw new Error('useLocation must be used inside a LocationProvider.');
//   }

//   return context;
// };

// /**
//  * The user's saved location & permission, reduced to just what the
//  * task screens need. onCapture receives { latitude, longitude, accuracy }.
//  */
// export const useCurrentLocation = () => {
//   const { position, permission, refresh, error, watching } = useLocation();
//   const [capturing, setCapturing] = useState(false);

//   const capture = useCallback(async () => {
//     setCapturing(true);

//     try {
//       return (await refresh()) || position || null;
//     } finally {
//       setCapturing(false);
//     }
//   }, [position, refresh]);

//   return {
//     position,
//     permission,
//     error,
//     watching,
//     capturing,
//     capture,
//   };
// };
