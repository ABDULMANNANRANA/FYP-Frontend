import React, { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLocation } from '../context/LocationContext';
import { getJson } from '../services/locationApi';
import { navigate } from '../navigation/navigationRef';
import {
  ARRIVAL_HYSTERESIS_METERS,
  distanceToTask,
  formatDistance,
  taskRadiusMeters,
} from '../services/location';

// Which tasks we already consider ourselves "inside" — persisted so an
// app restart does not re-fire an alert for a place we are still standing in.
const INSIDE_KEY = 'geofence_inside_v1';

// How often to re-read the geofence feed (new tasks, completed tasks...).
const TARGETS_REFRESH_MS = 2 * 60 * 1000;

/**
 * Headless component: watches the user's position and raises an arrival
 * alert when they come within a saved task's radius.
 *
 * Renders nothing. Mounted once, next to the navigator.
 */
const GeofenceWatcher = () => {
  const { position } = useLocation();

  // Kept in refs so the position effect never needs to re-subscribe.
  const targetsRef = useRef([]);
  const insideRef = useRef({});

  const persistInside = useCallback(() => {
    AsyncStorage.setItem(INSIDE_KEY, JSON.stringify(insideRef.current)).catch(
      () => {},
    );
  }, []);

  // Restore which places we were already inside.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(INSIDE_KEY);

        if (!cancelled && stored) {
          insideRef.current = JSON.parse(stored) || {};
        }
      } catch (parseFailure) {
        insideRef.current = {};
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadTargets = useCallback(async () => {
    // Nothing to watch before login.
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      return;
    }

    try {
      const data = await getJson('/Task/geofences');

      targetsRef.current = Array.isArray(data?.data) ? data.data : [];
    } catch (loadFailure) {
      // Offline, or a 401 already handled: keep the last
      // known list rather than dropping every reminder.
    }
  }, []);

  useEffect(() => {
    loadTargets();

    const intervalId = setInterval(loadTargets, TARGETS_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [loadTargets]);

  const openTask = useCallback(task => {
    navigate('TaskOverviewScreen', { task });
  }, []);

  useEffect(() => {
    if (!position || !targetsRef.current.length) {
      return;
    }

    const arrived = [];

    targetsRef.current.forEach(task => {
      const distance = distanceToTask(position, task);

      if (distance === null) {
        return;
      }

      const radius = taskRadiusMeters(task);
      const key = String(task.id);
      const wasInside = insideRef.current[key] === true;

      if (distance <= radius) {
        if (!wasInside) {
          insideRef.current[key] = true;
          arrived.push({ task, distance });
        }

        return;
      }

      // Moved back out (plus a margin, so the boundary does not flicker)
      // -> re-arm the reminder for the next visit.
      if (wasInside && distance > radius + ARRIVAL_HYSTERESIS_METERS) {
        delete insideRef.current[key];
      }
    });

    if (!arrived.length) {
      return;
    }

    persistInside();

    // Several tasks saved at the same place = one combined alert.
    if (arrived.length === 1) {
      const { task, distance } = arrived[0];

      Alert.alert(
        '📍 You are near a saved place',
        `"${task.title || 'Task'}" — you're ${formatDistance(
          distance,
        )} from where you saved it.`,
        [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'View Task', onPress: () => openTask(task) },
        ],
      );

      return;
    }

    Alert.alert(
      `📍 ${arrived.length} saved tasks are near you`,
      arrived
        .map(({ task, distance }) => `• ${task.title || 'Task'} (${formatDistance(distance)})`)
        .join('\n'),
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'View First',
          onPress: () => openTask(arrived[0].task),
        },
      ],
    );
  }, [position, openTask, persistInside]);

  return null;
};

export default GeofenceWatcher;






































// import React, { useCallback, useEffect, useRef } from 'react';
// import { Alert } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { useLocation } from '../context/LocationContext';
// import { getJson } from '../services/locationApi';
// import { navigate } from '../navigation/navigationRef';
// import {
//   ARRIVAL_HYSTERESIS_METERS,
//   distanceToTask,
//   formatDistance,
//   taskRadiusMeters,
// } from '../services/location';

// // Which tasks we already consider ourselves "inside" — persisted so an
// // app restart does not re-fire an alert for a place we are still standing in.
// const INSIDE_KEY = 'geofence_inside_v1';

// // How often to re-read the geofence feed (new tasks, completed tasks...).
// const TARGETS_REFRESH_MS = 2 * 60 * 1000;

// /**
//  * Headless component: watches the user's position and raises an arrival
//  * alert when they come within a saved task's radius.
//  *
//  * Renders nothing. Mounted once, next to the navigator.
//  */
// const GeofenceWatcher = () => {
//   const { position } = useLocation();

//   // Kept in refs so the position effect never needs to re-subscribe.
//   const targetsRef = useRef([]);
//   const insideRef = useRef({});

//   const persistInside = useCallback(() => {
//     AsyncStorage.setItem(INSIDE_KEY, JSON.stringify(insideRef.current)).catch(
//       () => {},
//     );
//   }, []);

//   // Restore which places we were already inside.
//   useEffect(() => {
//     let cancelled = false;

//     (async () => {
//       try {
//         const stored = await AsyncStorage.getItem(INSIDE_KEY);

//         if (!cancelled && stored) {
//           insideRef.current = JSON.parse(stored) || {};
//         }
//       } catch (parseFailure) {
//         insideRef.current = {};
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const loadTargets = useCallback(async () => {
//     // Nothing to watch before login.
//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       return;
//     }

//     try {
//       const data = await getJson('/Task/geofences');

//       targetsRef.current = Array.isArray(data?.data) ? data.data : [];
//     } catch (loadFailure) {
//       // Offline, or a 401 already handled: keep the last
//       // known list rather than dropping every reminder.
//     }
//   }, []);

//   useEffect(() => {
//     loadTargets();

//     const intervalId = setInterval(loadTargets, TARGETS_REFRESH_MS);

//     return () => clearInterval(intervalId);
//   }, [loadTargets]);

//   const openTask = useCallback(task => {
//     navigate('TaskOverviewScreen', { task });
//   }, []);

//   useEffect(() => {
//     if (!position || !targetsRef.current.length) {
//       return;
//     }

//     const arrived = [];

//     targetsRef.current.forEach(task => {
//       const distance = distanceToTask(position, task);

//       if (distance === null) {
//         return;
//       }

//       const radius = taskRadiusMeters(task);
//       const key = String(task.id);
//       const wasInside = insideRef.current[key] === true;

//       if (distance <= radius) {
//         if (!wasInside) {
//           insideRef.current[key] = true;
//           arrived.push({ task, distance });
//         }

//         return;
//       }

//       // Moved back out (plus a margin, so the boundary does not flicker)
//       // -> re-arm the reminder for the next visit.
//       if (wasInside && distance > radius + ARRIVAL_HYSTERESIS_METERS) {
//         delete insideRef.current[key];
//       }
//     });

//     if (!arrived.length) {
//       return;
//     }

//     persistInside();

//     // Several tasks saved at the same place = one combined alert.
//     if (arrived.length === 1) {
//       const { task, distance } = arrived[0];

//       Alert.alert(
//         '📍 You are near a saved place',
//         `"${task.title || 'Task'}" — you're ${formatDistance(
//           distance,
//         )} from where you saved it.`,
//         [
//           { text: 'Dismiss', style: 'cancel' },
//           { text: 'View Task', onPress: () => openTask(task) },
//         ],
//       );

//       return;
//     }

//     Alert.alert(
//       `📍 ${arrived.length} saved tasks are near you`,
//       arrived
//         .map(({ task, distance }) => `• ${task.title || 'Task'} (${formatDistance(distance)})`)
//         .join('\n'),
//       [
//         { text: 'Dismiss', style: 'cancel' },
//         {
//           text: 'View First',
//           onPress: () => openTask(arrived[0].task),
//         },
//       ],
//     );
//   }, [position, openTask, persistInside]);

//   return null;
// };

// export default GeofenceWatcher;
