import Geolocation from '@react-native-community/geolocation';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

/**
 * The ONLY file that talks to the native location library.
 *
 * Everything else in the app uses the helpers below, so swapping the
 * underlying package (or mocking it in tests) means changing this file alone.
 */

// Ask for permission ourselves so we can show our own explanation first.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
});

// ---------------------------------------------------------------- tuning

// Default alert radius for a new task, matching Tasks.GeofenceRadiusMeters.
export const DEFAULT_GEOFENCE_RADIUS_METERS = 200;

// Radius choices offered on the task screens.
export const GEOFENCE_RADIUS_OPTIONS = [100, 200, 500];

// A fix this accurate or better is good enough to stop asking for more.
export const GOOD_ACCURACY_METERS = 100;

// Once inside, the user must move this far back OUT before we re-arm the
// alert. Without it, standing on the boundary would fire repeatedly.
export const ARRIVAL_HYSTERESIS_METERS = 50;

// How often we ask the OS for a position while the app is open.
// Keep updates flowing, but never drain the battery.
const WATCH_INTERVAL_MS = 15000;
const WATCH_FASTEST_INTERVAL_MS = 5000;
const WATCH_DISTANCE_FILTER_METERS = 25;

// Live-location upload throttle: send to the server when the user has
// moved this far, or this much time has passed — whichever comes first.
export const UPLOAD_MIN_DISTANCE_METERS = 100;
export const UPLOAD_MIN_INTERVAL_MS = 2 * 60 * 1000;

export const PERMISSION_GRANTED = 'granted';
export const PERMISSION_DENIED = 'denied';
export const PERMISSION_BLOCKED = 'blocked';

// ---------------------------------------------------------------- permission

const hasFineLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  } catch (error) {
    return false;
  }
};

/** Check permission WITHOUT prompting. */
export const hasLocationPermission = hasFineLocationPermission;

/** Prompt for permission. Returns granted | denied | blocked. */
export const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    // iOS asks via the system prompt configured in Info.plist.
    return PERMISSION_GRANTED;
  }

  if (await hasFineLocationPermission()) {
    return PERMISSION_GRANTED;
  }

  try {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

    const results = await PermissionsAndroid.requestMultiple([fine, coarse]);

    if (
      results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
      results[coarse] === PermissionsAndroid.RESULTS.GRANTED
    ) {
      return PERMISSION_GRANTED;
    }

    if (
      results[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      results[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      return PERMISSION_BLOCKED;
    }

    return PERMISSION_DENIED;
  } catch (error) {
    return PERMISSION_DENIED;
  }
};

/** Send the user to the app's settings page (used when blocked). */
export const openAppSettings = () => {
  Linking.openSettings().catch(() => {});
};

// ---------------------------------------------------------------- positions

const toLocationError = rawError => {
  const code = rawError?.code;

  let message = 'Could not read your location.';

  if (code === 1) {
    message = 'Location permission was denied.';
  } else if (code === 2) {
    message = 'Location is unavailable. Is GPS turned on?';
  } else if (code === 3) {
    message =
      'No GPS fix yet. Step outside or near a window and try again - ' +
      'or place the pin on the map instead.';
  }

  const error = new Error(message);
  error.code = code;

  return error;
};

const normalizePosition = raw => ({
  latitude: Number(raw?.coords?.latitude),
  longitude: Number(raw?.coords?.longitude),
  accuracy: Number(raw?.coords?.accuracy ?? 0),
  timestamp: Number(raw?.timestamp ?? Date.now()),
  mocked: raw?.mocked === true,
});

/** One-shot position fix. */
export const getCurrentPosition = ({
  highAccuracy = true,
  timeout = 15000,
  maximumAge = 0,
} = {}) =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      raw => {
        const position = normalizePosition(raw);

        if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
          reject(new Error('Received an invalid location fix.'));
          return;
        }

        resolve(position);
      },
      raw => reject(toLocationError(raw)),
      {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge,
      },
    );
  });

/**
 * The position getter the UI should use.
 *
 * Asking for a fresh, high-accuracy fix on a cold start indoors can take a
 * minute or more - which is what produced "Timed out while waiting for a GPS
 * fix". This gets a usable answer fast and upgrades it if it can:
 *
 *   1. a quick network/cached fix (near-instant, may be coarse)
 *   2. a real GPS fix (accurate, slower) - attempted while we already have
 *      something to show, and kept only if it is better
 *
 * onProvisional(fix) fires as soon as step 1 succeeds, so the UI can show a
 * position straight away rather than waiting.
 */
export const getReliablePosition = async ({ onProvisional } = {}) => {
  let best = null;

  try {
    const quick = await getCurrentPosition({
      highAccuracy: false,
      timeout: 8000,
      maximumAge: 120000,
    });

    best = quick;

    if (onProvisional) {
      onProvisional(quick);
    }

    if (quick.accuracy > 0 && quick.accuracy <= GOOD_ACCURACY_METERS) {
      return quick;
    }
  } catch (quickFailure) {
    // Fall through to the accurate attempt.
  }

  try {
    const accurate = await getCurrentPosition({
      highAccuracy: true,
      timeout: 25000,
      maximumAge: 30000,
    });

    if (!best || accurate.accuracy <= best.accuracy) {
      best = accurate;
    }
  } catch (accurateFailure) {
    if (!best) {
      throw accurateFailure;
    }
  }

  return best;
};

/** Is a fix good enough to use without asking for more? */
export const isGoodFix = fix =>
  Boolean(fix) && fix.accuracy > 0 && fix.accuracy <= GOOD_ACCURACY_METERS;

/** Is a live position recent enough to reuse instead of re-requesting? */
export const isFreshFix = (fix, maxAgeMs = 60000) =>
  Boolean(fix) && Boolean(fix.timestamp) && Date.now() - fix.timestamp < maxAgeMs;

/**
 * Continuous updates while the app is open.
 * Returns a watch id to pass to clearPositionWatch().
 */
export const watchPosition = (onPosition, onError) =>
  Geolocation.watchPosition(
    raw => {
      const position = normalizePosition(raw);

      if (Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) {
        onPosition(position);
      }
    },
    raw => {
      if (onError) {
        onError(toLocationError(raw));
      }
    },
    {
      enableHighAccuracy: true,
      interval: WATCH_INTERVAL_MS,
      fastestInterval: WATCH_FASTEST_INTERVAL_MS,
      distanceFilter: WATCH_DISTANCE_FILTER_METERS,
    },
  );

export const clearPositionWatch = watchId => {
  if (watchId !== null && watchId !== undefined) {
    Geolocation.clearWatch(watchId);
  }
};

// ---------------------------------------------------------------- geo maths

const EARTH_RADIUS_METERS = 6371000;
const toRadians = degrees => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in metres. */
export const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Read latitude/longitude off a task, whichever casing the API used. */
export const taskCoordinates = task => {
  if (!task) {
    return null;
  }

  const latitude = Number(task.latitude ?? task.Latitude);
  const longitude = Number(task.longitude ?? task.Longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

/** Distance from a position to a task's saved place, or null if it has none. */
export const distanceToTask = (position, task) => {
  const target = taskCoordinates(task);

  if (!position || !target) {
    return null;
  }

  return haversineMeters(
    position.latitude,
    position.longitude,
    target.latitude,
    target.longitude,
  );
};

export const taskRadiusMeters = task =>
  Number(task?.geofenceRadiusMeters ?? task?.GeofenceRadiusMeters) ||
  DEFAULT_GEOFENCE_RADIUS_METERS;

/** "48 m" / "1.2 km" — for alerts and the settings screen. */
export const formatDistance = meters => {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) {
    return '';
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatCoordinates = (latitude, longitude) => {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return '';
  }

  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
};




























// import Geolocation from '@react-native-community/geolocation';
// import { Linking, PermissionsAndroid, Platform } from 'react-native';

// /**
//  * The ONLY file that talks to the native location library.
//  *
//  * Everything else in the app uses the helpers below, so swapping the
//  * underlying package (or mocking it in tests) means changing this file alone.
//  */

// // Ask for permission ourselves so we can show our own explanation first.
// Geolocation.setRNConfiguration({
//   skipPermissionRequests: true,
//   authorizationLevel: 'whenInUse',
// });

// // ---------------------------------------------------------------- tuning

// // Default alert radius for a new task, matching Tasks.GeofenceRadiusMeters.
// export const DEFAULT_GEOFENCE_RADIUS_METERS = 200;

// // Radius choices offered on the task screens.
// export const GEOFENCE_RADIUS_OPTIONS = [100, 200, 500];

// // Once inside, the user must move this far back OUT before we re-arm the
// // alert. Without it, standing on the boundary would fire repeatedly.
// export const ARRIVAL_HYSTERESIS_METERS = 50;

// // How often we ask the OS for a position while the app is open.
// // Keep updates flowing, but never drain the battery.
// const WATCH_INTERVAL_MS = 15000;
// const WATCH_FASTEST_INTERVAL_MS = 5000;
// const WATCH_DISTANCE_FILTER_METERS = 25;

// // Live-location upload throttle: send to the server when the user has
// // moved this far, or this much time has passed — whichever comes first.
// export const UPLOAD_MIN_DISTANCE_METERS = 100;
// export const UPLOAD_MIN_INTERVAL_MS = 2 * 60 * 1000;

// export const PERMISSION_GRANTED = 'granted';
// export const PERMISSION_DENIED = 'denied';
// export const PERMISSION_BLOCKED = 'blocked';

// // ---------------------------------------------------------------- permission

// const hasFineLocationPermission = async () => {
//   if (Platform.OS !== 'android') {
//     return true;
//   }

//   try {
//     return await PermissionsAndroid.check(
//       PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//     );
//   } catch (error) {
//     return false;
//   }
// };

// /** Check permission WITHOUT prompting. */
// export const hasLocationPermission = hasFineLocationPermission;

// /** Prompt for permission. Returns granted | denied | blocked. */
// export const requestLocationPermission = async () => {
//   if (Platform.OS !== 'android') {
//     // iOS asks via the system prompt configured in Info.plist.
//     return PERMISSION_GRANTED;
//   }

//   if (await hasFineLocationPermission()) {
//     return PERMISSION_GRANTED;
//   }

//   try {
//     const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
//     const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

//     const results = await PermissionsAndroid.requestMultiple([fine, coarse]);

//     if (
//       results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
//       results[coarse] === PermissionsAndroid.RESULTS.GRANTED
//     ) {
//       return PERMISSION_GRANTED;
//     }

//     if (
//       results[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
//       results[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
//     ) {
//       return PERMISSION_BLOCKED;
//     }

//     return PERMISSION_DENIED;
//   } catch (error) {
//     return PERMISSION_DENIED;
//   }
// };

// /** Send the user to the app's settings page (used when blocked). */
// export const openAppSettings = () => {
//   Linking.openSettings().catch(() => {});
// };

// // ---------------------------------------------------------------- positions

// const toLocationError = rawError => {
//   const code = rawError?.code;

//   let message = 'Could not read your location.';

//   if (code === 1) {
//     message = 'Location permission was denied.';
//   } else if (code === 2) {
//     message = 'Location is unavailable. Is GPS turned on?';
//   } else if (code === 3) {
//     message = 'Timed out while waiting for a GPS fix.';
//   }

//   const error = new Error(message);
//   error.code = code;

//   return error;
// };

// const normalizePosition = raw => ({
//   latitude: Number(raw?.coords?.latitude),
//   longitude: Number(raw?.coords?.longitude),
//   accuracy: Number(raw?.coords?.accuracy ?? 0),
//   timestamp: Number(raw?.timestamp ?? Date.now()),
//   mocked: raw?.mocked === true,
// });

// /** One-shot position fix. */
// export const getCurrentPosition = ({
//   highAccuracy = true,
//   timeout = 15000,
//   maximumAge = 0,
// } = {}) =>
//   new Promise((resolve, reject) => {
//     Geolocation.getCurrentPosition(
//       raw => {
//         const position = normalizePosition(raw);

//         if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
//           reject(new Error('Received an invalid location fix.'));
//           return;
//         }

//         resolve(position);
//       },
//       raw => reject(toLocationError(raw)),
//       {
//         enableHighAccuracy: highAccuracy,
//         timeout,
//         maximumAge,
//       },
//     );
//   });

// /**
//  * Continuous updates while the app is open.
//  * Returns a watch id to pass to clearPositionWatch().
//  */
// export const watchPosition = (onPosition, onError) =>
//   Geolocation.watchPosition(
//     raw => {
//       const position = normalizePosition(raw);

//       if (Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) {
//         onPosition(position);
//       }
//     },
//     raw => {
//       if (onError) {
//         onError(toLocationError(raw));
//       }
//     },
//     {
//       enableHighAccuracy: true,
//       interval: WATCH_INTERVAL_MS,
//       fastestInterval: WATCH_FASTEST_INTERVAL_MS,
//       distanceFilter: WATCH_DISTANCE_FILTER_METERS,
//     },
//   );

// export const clearPositionWatch = watchId => {
//   if (watchId !== null && watchId !== undefined) {
//     Geolocation.clearWatch(watchId);
//   }
// };

// // ---------------------------------------------------------------- geo maths

// const EARTH_RADIUS_METERS = 6371000;
// const toRadians = degrees => (degrees * Math.PI) / 180;

// /** Great-circle distance between two points, in metres. */
// export const haversineMeters = (lat1, lon1, lat2, lon2) => {
//   const dLat = toRadians(lat2 - lat1);
//   const dLon = toRadians(lon2 - lon1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRadians(lat1)) *
//       Math.cos(toRadians(lat2)) *
//       Math.sin(dLon / 2) ** 2;

//   return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
// };

// /** Read latitude/longitude off a task, whichever casing the API used. */
// export const taskCoordinates = task => {
//   if (!task) {
//     return null;
//   }

//   const latitude = Number(task.latitude ?? task.Latitude);
//   const longitude = Number(task.longitude ?? task.Longitude);

//   if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
//     return null;
//   }

//   return { latitude, longitude };
// };

// /** Distance from a position to a task's saved place, or null if it has none. */
// export const distanceToTask = (position, task) => {
//   const target = taskCoordinates(task);

//   if (!position || !target) {
//     return null;
//   }

//   return haversineMeters(
//     position.latitude,
//     position.longitude,
//     target.latitude,
//     target.longitude,
//   );
// };

// export const taskRadiusMeters = task =>
//   Number(task?.geofenceRadiusMeters ?? task?.GeofenceRadiusMeters) ||
//   DEFAULT_GEOFENCE_RADIUS_METERS;

// /** "48 m" / "1.2 km" — for alerts and the settings screen. */
// export const formatDistance = meters => {
//   if (meters === null || meters === undefined || !Number.isFinite(meters)) {
//     return '';
//   }

//   if (meters < 1000) {
//     return `${Math.round(meters)} m`;
//   }

//   return `${(meters / 1000).toFixed(1)} km`;
// };

// export const formatCoordinates = (latitude, longitude) => {
//   if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
//     return '';
//   }

//   return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
// };
