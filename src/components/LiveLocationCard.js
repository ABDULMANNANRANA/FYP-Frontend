import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';

import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { getJson } from '../services/locationApi';
import {
  PERMISSION_BLOCKED,
  distanceToTask,
  formatCoordinates,
  formatDistance,
  openAppSettings,
  taskRadiusMeters,
} from '../services/location';

const timeAgo = timestamp => {
  if (!timestamp) {
    return 'never';
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  return `${Math.round(seconds / 60)} min ago`;
};

/**
 * Settings panel: shows the live position, what the server last received,
 * and the distance to the nearest saved place — which doubles as the way to
 * test the 200 m alert by watching the number fall as you walk.
 */
const LiveLocationCard = () => {
  const { theme, isDark } = useTheme();
  const {
    position,
    permission,
    error,
    trackingEnabled,
    setTracking,
    lastUploadAt,
    uploadError,
    syncNow,
  } = useLocation();

  const [nearest, setNearest] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const textColor = theme?.text || '#0F172A';
  const subColor = isDark ? '#94A3B8' : '#64748B';
  const cardBg = theme?.card || (isDark ? '#1E293B' : '#FFFFFF');
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const accent = theme?.primary || '#0EA5E9';

  // Nearest saved place — recomputed whenever the position changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getJson('/Task/geofences');
        const targets = Array.isArray(data?.data) ? data.data : [];

        if (cancelled) {
          return;
        }

        let best = null;

        targets.forEach(task => {
          const distance = distanceToTask(position, task);

          if (distance === null) {
            return;
          }

          if (!best || distance < best.distance) {
            best = {
              title: task.title || 'Task',
              distance,
              radius: taskRadiusMeters(task),
            };
          }
        });

        setNearest(best);
      } catch (loadFailure) {
        // Offline — leave the last value in place.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [position]);

  const handleToggle = useCallback(value => setTracking(value), [setTracking]);

  const handleSync = useCallback(async () => {
    setSyncing(true);

    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }, [syncNow]);

  const tracking = trackingEnabled && permission !== PERMISSION_BLOCKED;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <Icon name="navigate-circle-outline" size={20} color={accent} />

        <Text style={[styles.title, { color: textColor }]}>Live Location</Text>

        <Switch
          value={tracking}
          onValueChange={handleToggle}
          trackColor={{ true: accent, false: borderColor }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Text style={[styles.subtitle, { color: subColor }]}>
        {tracking
          ? 'Your position is shared with the server while the app is open.'
          : 'Location sharing is switched off.'}
      </Text>

      <View style={[styles.grid, { borderColor }]}>
        <View style={styles.gridRow}>
          <Text style={[styles.gridLabel, { color: subColor }]}>Coordinates</Text>

          <Text style={[styles.gridValue, { color: textColor }]}>
            {position
              ? formatCoordinates(position.latitude, position.longitude)
              : 'waiting for GPS...'}
          </Text>
        </View>

        <View style={styles.gridRow}>
          <Text style={[styles.gridLabel, { color: subColor }]}>Accuracy</Text>

          <Text style={[styles.gridValue, { color: textColor }]}>
            {position ? `± ${Math.round(position.accuracy)} m` : '--'}
          </Text>
        </View>

        <View style={styles.gridRow}>
          <Text style={[styles.gridLabel, { color: subColor }]}>
            Last server sync
          </Text>

          <Text style={[styles.gridValue, { color: textColor }]}>
            {timeAgo(lastUploadAt)}
          </Text>
        </View>

        <View style={styles.gridRow}>
          <Text style={[styles.gridLabel, { color: subColor }]}>
            Nearest saved place
          </Text>

          <Text
            style={[
              styles.gridValue,
              {
                color:
                  nearest && nearest.distance <= nearest.radius
                    ? '#22C55E'
                    : textColor,
              },
            ]}
          >
            {nearest
              ? `${nearest.title} — ${formatDistance(nearest.distance)} (alert at ${
                  nearest.radius
                } m)`
              : 'none saved yet'}
          </Text>
        </View>
      </View>

      {tracking ? (
        <TouchableOpacity
          onPress={handleSync}
          disabled={syncing}
          style={[styles.actionButton, { borderColor: accent }]}
          activeOpacity={0.8}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <>
              <Icon name="cloud-upload-outline" size={17} color={accent} />
              <Text style={[styles.actionText, { color: accent }]}>
                Send my location to the server now
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      {permission === PERMISSION_BLOCKED ? (
        <TouchableOpacity
          onPress={openAppSettings}
          style={styles.warningRow}
          activeOpacity={0.7}
        >
          <Icon name="warning-outline" size={15} color="#EF4444" />
          <Text style={styles.warningText}>
            Location permission is blocked. Tap to open phone settings.
          </Text>
        </TouchableOpacity>
      ) : null}

      {error && permission !== PERMISSION_BLOCKED ? (
        <Text style={styles.warningText}>{error}</Text>
      ) : null}

      {uploadError ? (
        <Text style={styles.warningText}>Server sync: {uploadError}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
  },

  grid: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 6,
  },

  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },

  gridLabel: {
    fontSize: 12.5,
    flex: 1,
  },

  gridValue: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },

  actionText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 7,
  },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  warningText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    lineHeight: 17,
    flex: 1,
  },
});

export default LiveLocationCard;









































// import React, { useCallback, useEffect, useState } from 'react';
// import {
//   ActivityIndicator,
//   StyleSheet,
//   Switch,
//   Text,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';

// import { useTheme } from '../context/ThemeContext';
// import { useLocation } from '../context/LocationContext';
// import { getJson } from '../services/locationApi';
// import {
//   PERMISSION_BLOCKED,
//   distanceToTask,
//   formatCoordinates,
//   formatDistance,
//   openAppSettings,
//   taskRadiusMeters,
// } from '../services/location';

// const timeAgo = timestamp => {
//   if (!timestamp) {
//     return 'never';
//   }

//   const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

//   if (seconds < 60) {
//     return `${seconds}s ago`;
//   }

//   return `${Math.round(seconds / 60)} min ago`;
// };

// /**
//  * Settings panel: shows the live position, what the server last received,
//  * and the distance to the nearest saved place — which doubles as the way to
//  * test the 200 m alert by watching the number fall as you walk.
//  */
// const LiveLocationCard = () => {
//   const { theme, isDark } = useTheme();
//   const {
//     position,
//     permission,
//     error,
//     trackingEnabled,
//     setTracking,
//     lastUploadAt,
//     uploadError,
//     syncNow,
//   } = useLocation();

//   const [nearest, setNearest] = useState(null);
//   const [syncing, setSyncing] = useState(false);

//   const textColor = theme?.text || '#0F172A';
//   const subColor = isDark ? '#94A3B8' : '#64748B';
//   const cardBg = theme?.card || (isDark ? '#1E293B' : '#FFFFFF');
//   const borderColor = isDark ? '#334155' : '#E2E8F0';
//   const accent = theme?.primary || '#0EA5E9';

//   // Nearest saved place — recomputed whenever the position changes.
//   useEffect(() => {
//     let cancelled = false;

//     (async () => {
//       try {
//         const data = await getJson('/Task/geofences');
//         const targets = Array.isArray(data?.data) ? data.data : [];

//         if (cancelled) {
//           return;
//         }

//         let best = null;

//         targets.forEach(task => {
//           const distance = distanceToTask(position, task);

//           if (distance === null) {
//             return;
//           }

//           if (!best || distance < best.distance) {
//             best = {
//               title: task.title || 'Task',
//               distance,
//               radius: taskRadiusMeters(task),
//             };
//           }
//         });

//         setNearest(best);
//       } catch (loadFailure) {
//         // Offline — leave the last value in place.
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [position]);

//   const handleToggle = useCallback(value => setTracking(value), [setTracking]);

//   const handleSync = useCallback(async () => {
//     setSyncing(true);

//     try {
//       await syncNow();
//     } finally {
//       setSyncing(false);
//     }
//   }, [syncNow]);

//   const tracking = trackingEnabled && permission !== PERMISSION_BLOCKED;

//   return (
//     <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
//       <View style={styles.header}>
//         <Icon name="navigate-circle-outline" size={20} color={accent} />

//         <Text style={[styles.title, { color: textColor }]}>Live Location</Text>

//         <Switch
//           value={tracking}
//           onValueChange={handleToggle}
//           trackColor={{ true: accent, false: borderColor }}
//           thumbColor="#FFFFFF"
//         />
//       </View>

//       <Text style={[styles.subtitle, { color: subColor }]}>
//         {tracking
//           ? 'Your position is shared with the server while the app is open.'
//           : 'Location sharing is switched off.'}
//       </Text>

//       <View style={[styles.grid, { borderColor }]}>
//         <View style={styles.gridRow}>
//           <Text style={[styles.gridLabel, { color: subColor }]}>Coordinates</Text>

//           <Text style={[styles.gridValue, { color: textColor }]}>
//             {position
//               ? formatCoordinates(position.latitude, position.longitude)
//               : 'waiting for GPS...'}
//           </Text>
//         </View>

//         <View style={styles.gridRow}>
//           <Text style={[styles.gridLabel, { color: subColor }]}>Accuracy</Text>

//           <Text style={[styles.gridValue, { color: textColor }]}>
//             {position ? `± ${Math.round(position.accuracy)} m` : '--'}
//           </Text>
//         </View>

//         <View style={styles.gridRow}>
//           <Text style={[styles.gridLabel, { color: subColor }]}>
//             Last server sync
//           </Text>

//           <Text style={[styles.gridValue, { color: textColor }]}>
//             {timeAgo(lastUploadAt)}
//           </Text>
//         </View>

//         <View style={styles.gridRow}>
//           <Text style={[styles.gridLabel, { color: subColor }]}>
//             Nearest saved place
//           </Text>

//           <Text
//             style={[
//               styles.gridValue,
//               {
//                 color:
//                   nearest && nearest.distance <= nearest.radius
//                     ? '#22C55E'
//                     : textColor,
//               },
//             ]}
//           >
//             {nearest
//               ? `${nearest.title} — ${formatDistance(nearest.distance)} (alert at ${
//                   nearest.radius
//                 } m)`
//               : 'none saved yet'}
//           </Text>
//         </View>
//       </View>

//       {tracking ? (
//         <TouchableOpacity
//           onPress={handleSync}
//           disabled={syncing}
//           style={[styles.actionButton, { borderColor: accent }]}
//           activeOpacity={0.8}
//         >
//           {syncing ? (
//             <ActivityIndicator size="small" color={accent} />
//           ) : (
//             <>
//               <Icon name="cloud-upload-outline" size={17} color={accent} />
//               <Text style={[styles.actionText, { color: accent }]}>
//                 Send my location to the server now
//               </Text>
//             </>
//           )}
//         </TouchableOpacity>
//       ) : null}

//       {permission === PERMISSION_BLOCKED ? (
//         <TouchableOpacity
//           onPress={openAppSettings}
//           style={styles.warningRow}
//           activeOpacity={0.7}
//         >
//           <Icon name="warning-outline" size={15} color="#EF4444" />
//           <Text style={styles.warningText}>
//             Location permission is blocked. Tap to open phone settings.
//           </Text>
//         </TouchableOpacity>
//       ) : null}

//       {error && permission !== PERMISSION_BLOCKED ? (
//         <Text style={styles.warningText}>{error}</Text>
//       ) : null}

//       {uploadError ? (
//         <Text style={styles.warningText}>Server sync: {uploadError}</Text>
//       ) : null}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   card: {
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 16,
//     marginBottom: 14,
//   },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   title: {
//     flex: 1,
//     fontSize: 15,
//     fontWeight: '700',
//     marginLeft: 8,
//   },

//   subtitle: {
//     fontSize: 12.5,
//     lineHeight: 18,
//     marginTop: 8,
//   },

//   grid: {
//     borderTopWidth: 1,
//     marginTop: 12,
//     paddingTop: 6,
//   },

//   gridRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: 7,
//   },

//   gridLabel: {
//     fontSize: 12.5,
//     flex: 1,
//   },

//   gridValue: {
//     fontSize: 12.5,
//     fontWeight: '700',
//     flex: 1.4,
//     textAlign: 'right',
//   },

//   actionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingVertical: 11,
//     marginTop: 12,
//   },

//   actionText: {
//     fontSize: 13,
//     fontWeight: '700',
//     marginLeft: 7,
//   },

//   warningRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 10,
//   },

//   warningText: {
//     fontSize: 12,
//     color: '#EF4444',
//     marginTop: 8,
//     lineHeight: 17,
//     flex: 1,
//   },
// });

// export default LiveLocationCard;
