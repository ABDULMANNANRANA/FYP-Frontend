import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';

import { useTheme } from '../context/ThemeContext';
import { useCurrentLocation } from '../context/LocationContext';
import { setPickerDraft } from '../services/locationPicker';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  GEOFENCE_RADIUS_OPTIONS,
  PERMISSION_BLOCKED,
  formatCoordinates,
  openAppSettings,
} from '../services/location';

/**
 * "Reminder place" card, shared by the Add and Edit task screens.
 *
 * value:    { latitude, longitude, geofenceRadiusMeters, geofenceEnabled }
 * onChange: (patch) => void
 */
const LocationCard = ({ value = {}, onChange, navigation }) => {
  const { theme, isDark } = useTheme();
  const { position, permission, capturing, capture, error } = useCurrentLocation();

  const latitude = value.latitude ?? null;
  const longitude = value.longitude ?? null;
  const hasPlace = latitude !== null && longitude !== null;

  const radius =
    value.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

  const enabled = value.geofenceEnabled !== false && hasPlace;

  const textColor = theme?.text || '#0F172A';
  const subColor = isDark ? '#94A3B8' : '#64748B';
  const cardBg = theme?.card || (isDark ? '#1E293B' : '#FFFFFF');
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const accent = theme?.primary || '#0EA5E9';

  // A fix from the live watcher is a fine fallback when capture is idle.
  const latestAccuracy = hasPlace
    ? value.accuracy ?? position?.accuracy ?? null
    : null;

  const handleCapture = useCallback(async () => {
    const fix = await capture();

    if (!fix) {
      return;
    }

    onChange?.({
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      geofenceRadiusMeters: radius,
      geofenceEnabled: true,
    });
  }, [capture, onChange, radius]);

  const handlePickOnMap = useCallback(() => {
    if (!navigation) {
      return;
    }

    // The picker reads this when it opens, so it starts on the saved place.
    setPickerDraft({
      latitude,
      longitude,
      geofenceRadiusMeters: radius,
    });

    navigation.navigate('LocationPickerScreen');
  }, [latitude, longitude, navigation, radius]);

  const handleRemove = useCallback(() => {
    onChange?.({
      latitude: null,
      longitude: null,
      accuracy: null,
      geofenceRadiusMeters: radius,
      geofenceEnabled: false,
    });
  }, [onChange, radius]);

  const handleRadius = useCallback(
    nextRadius => {
      onChange?.({
        geofenceRadiusMeters: nextRadius,
        geofenceEnabled: hasPlace,
      });
    },
    [hasPlace, onChange],
  );

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <Icon name="location-outline" size={20} color={accent} />

        <Text style={[styles.title, { color: textColor }]}>Reminder Place</Text>

        {hasPlace ? (
          <View style={[styles.badge, { backgroundColor: `${accent}22` }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {radius} m
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.subtitle, { color: subColor }]}>
        {hasPlace
          ? enabled
            ? `You'll be reminded when you come back within ${radius} m of this place.`
            : 'Place saved, but the reminder is switched off.'
          : 'Drop a pin on the map, or use your current location.'}
      </Text>

      {hasPlace ? (
        <View style={[styles.placeBox, { borderColor }]}>
          <View style={styles.placeLeft}>
            <Text style={[styles.placeCoords, { color: textColor }]}>
              {formatCoordinates(latitude, longitude)}
            </Text>

            <Text style={[styles.placeMeta, { color: subColor }]}>
              {value.source === 'map'
                ? 'pinned on the map'
                : latestAccuracy
                ? `accurate to about ${Math.round(latestAccuracy)} m`
                : 'saved location'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRemove}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Icon name="close-circle-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Radius choices — only meaningful once a place exists. */}
      {hasPlace ? (
        <View style={styles.radiusRow}>
          {GEOFENCE_RADIUS_OPTIONS.map(option => {
            const selected = option === radius;

            return (
              <TouchableOpacity
                key={option}
                onPress={() => handleRadius(option)}
                style={[
                  styles.radiusChip,
                  {
                    borderColor: selected ? accent : borderColor,
                    backgroundColor: selected ? `${accent}22` : 'transparent',
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.radiusText,
                    { color: selected ? accent : subColor },
                  ]}
                >
                  {option} m
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Primary: place the pin yourself. Works even without a GPS fix. */}
      {navigation ? (
        <TouchableOpacity
          onPress={handlePickOnMap}
          disabled={capturing}
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: accent }]}
          activeOpacity={0.85}
        >
          <Icon
            name={hasPlace ? 'map-outline' : 'map-outline'}
            size={17}
            color="#FFFFFF"
          />

          <Text style={[styles.actionText, styles.primaryActionText]}>
            {hasPlace ? 'Change place on map' : 'Pick place on map'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Secondary: use the GPS fix. */}
      <TouchableOpacity
        onPress={
          permission === PERMISSION_BLOCKED ? openAppSettings : handleCapture
        }
        disabled={capturing}
        style={[styles.actionButton, { borderColor: accent }]}
        activeOpacity={0.8}
      >
        {capturing ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <>
            <Icon
              name={
                permission === PERMISSION_BLOCKED
                  ? 'settings-outline'
                  : 'navigate-outline'
              }
              size={17}
              color={accent}
            />

            <Text style={[styles.actionText, { color: accent }]}>
              {permission === PERMISSION_BLOCKED
                ? 'Open phone settings'
                : hasPlace
                ? 'Update to where I am now'
                : 'Use my current location'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {!hasPlace && error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {!hasPlace && !error && permission === PERMISSION_BLOCKED ? (
        <Text style={styles.errorText}>
          Location permission is blocked. Enable it in the phone settings, then
          come back to this screen.
        </Text>
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

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
  },

  placeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },

  placeLeft: {
    flex: 1,
  },

  placeCoords: {
    fontSize: 14,
    fontWeight: '700',
  },

  placeMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },

  iconButton: {
    padding: 4,
  },

  radiusRow: {
    flexDirection: 'row',
    marginTop: 12,
  },

  radiusChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },

  radiusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 14,
  },

  primaryButton: {
    borderWidth: 0,
    marginTop: 14,
  },

  primaryActionText: {
    color: '#FFFFFF',
  },

  actionText: {
    fontSize: 13.5,
    fontWeight: '700',
    marginLeft: 7,
  },

  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 9,
    lineHeight: 17,
  },
});

export default LocationCard;






































// import React, { useCallback } from 'react';
// import {
//   ActivityIndicator,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';

// import { useTheme } from '../context/ThemeContext';
// import { useCurrentLocation } from '../context/LocationContext';
// import {
//   DEFAULT_GEOFENCE_RADIUS_METERS,
//   GEOFENCE_RADIUS_OPTIONS,
//   PERMISSION_BLOCKED,
//   formatCoordinates,
//   openAppSettings,
// } from '../services/location';

// /**
//  * "Reminder place" card, shared by the Add and Edit task screens.
//  *
//  * value:    { latitude, longitude, geofenceRadiusMeters, geofenceEnabled }
//  * onChange: (patch) => void
//  */
// const LocationCard = ({ value = {}, onChange }) => {
//   const { theme, isDark } = useTheme();
//   const { position, permission, capturing, capture, error } = useCurrentLocation();

//   const latitude = value.latitude ?? null;
//   const longitude = value.longitude ?? null;
//   const hasPlace = latitude !== null && longitude !== null;

//   const radius =
//     value.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

//   const enabled = value.geofenceEnabled !== false && hasPlace;

//   const textColor = theme?.text || '#0F172A';
//   const subColor = isDark ? '#94A3B8' : '#64748B';
//   const cardBg = theme?.card || (isDark ? '#1E293B' : '#FFFFFF');
//   const borderColor = isDark ? '#334155' : '#E2E8F0';
//   const accent = theme?.primary || '#0EA5E9';

//   // A fix from the live watcher is a fine fallback when capture is idle.
//   const latestAccuracy = hasPlace
//     ? value.accuracy ?? position?.accuracy ?? null
//     : null;

//   const handleCapture = useCallback(async () => {
//     const fix = await capture();

//     if (!fix) {
//       return;
//     }

//     onChange?.({
//       latitude: fix.latitude,
//       longitude: fix.longitude,
//       accuracy: fix.accuracy,
//       geofenceRadiusMeters: radius,
//       geofenceEnabled: true,
//     });
//   }, [capture, onChange, radius]);

//   const handleRemove = useCallback(() => {
//     onChange?.({
//       latitude: null,
//       longitude: null,
//       accuracy: null,
//       geofenceRadiusMeters: radius,
//       geofenceEnabled: false,
//     });
//   }, [onChange, radius]);

//   const handleRadius = useCallback(
//     nextRadius => {
//       onChange?.({
//         geofenceRadiusMeters: nextRadius,
//         geofenceEnabled: hasPlace,
//       });
//     },
//     [hasPlace, onChange],
//   );

//   return (
//     <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
//       <View style={styles.header}>
//         <Icon name="location-outline" size={20} color={accent} />

//         <Text style={[styles.title, { color: textColor }]}>Reminder Place</Text>

//         {hasPlace ? (
//           <View style={[styles.badge, { backgroundColor: `${accent}22` }]}>
//             <Text style={[styles.badgeText, { color: accent }]}>
//               {radius} m
//             </Text>
//           </View>
//         ) : null}
//       </View>

//       <Text style={[styles.subtitle, { color: subColor }]}>
//         {hasPlace
//           ? enabled
//             ? `You'll be reminded when you come back within ${radius} m of this place.`
//             : 'Place saved, but the reminder is switched off.'
//           : 'Save this place and get reminded when you are back here.'}
//       </Text>

//       {hasPlace ? (
//         <View style={[styles.placeBox, { borderColor }]}>
//           <View style={styles.placeLeft}>
//             <Text style={[styles.placeCoords, { color: textColor }]}>
//               {formatCoordinates(latitude, longitude)}
//             </Text>

//             <Text style={[styles.placeMeta, { color: subColor }]}>
//               {latestAccuracy
//                 ? `accurate to about ${Math.round(latestAccuracy)} m`
//                 : 'saved location'}
//             </Text>
//           </View>

//           <TouchableOpacity
//             onPress={handleRemove}
//             style={styles.iconButton}
//             activeOpacity={0.7}
//           >
//             <Icon name="close-circle-outline" size={22} color="#EF4444" />
//           </TouchableOpacity>
//         </View>
//       ) : null}

//       {/* Radius choices — only meaningful once a place exists. */}
//       {hasPlace ? (
//         <View style={styles.radiusRow}>
//           {GEOFENCE_RADIUS_OPTIONS.map(option => {
//             const selected = option === radius;

//             return (
//               <TouchableOpacity
//                 key={option}
//                 onPress={() => handleRadius(option)}
//                 style={[
//                   styles.radiusChip,
//                   {
//                     borderColor: selected ? accent : borderColor,
//                     backgroundColor: selected ? `${accent}22` : 'transparent',
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <Text
//                   style={[
//                     styles.radiusText,
//                     { color: selected ? accent : subColor },
//                   ]}
//                 >
//                   {option} m
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </View>
//       ) : null}

//       <TouchableOpacity
//         onPress={
//           permission === PERMISSION_BLOCKED ? openAppSettings : handleCapture
//         }
//         disabled={capturing}
//         style={[styles.actionButton, { borderColor: accent }]}
//         activeOpacity={0.8}
//       >
//         {capturing ? (
//           <ActivityIndicator size="small" color={accent} />
//         ) : (
//           <>
//             <Icon
//               name={
//                 permission === PERMISSION_BLOCKED
//                   ? 'settings-outline'
//                   : hasPlace
//                   ? 'refresh-outline'
//                   : 'navigate-outline'
//               }
//               size={17}
//               color={accent}
//             />

//             <Text style={[styles.actionText, { color: accent }]}>
//               {permission === PERMISSION_BLOCKED
//                 ? 'Open phone settings'
//                 : hasPlace
//                 ? 'Update to where I am now'
//                 : 'Use my current location'}
//             </Text>
//           </>
//         )}
//       </TouchableOpacity>

//       {!hasPlace && error ? (
//         <Text style={styles.errorText}>{error}</Text>
//       ) : null}

//       {!hasPlace && !error && permission === PERMISSION_BLOCKED ? (
//         <Text style={styles.errorText}>
//           Location permission is blocked. Enable it in the phone settings, then
//           come back to this screen.
//         </Text>
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

//   badge: {
//     paddingHorizontal: 9,
//     paddingVertical: 3,
//     borderRadius: 10,
//   },

//   badgeText: {
//     fontSize: 11,
//     fontWeight: '800',
//   },

//   subtitle: {
//     fontSize: 12.5,
//     lineHeight: 18,
//     marginTop: 8,
//   },

//   placeBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     marginTop: 12,
//   },

//   placeLeft: {
//     flex: 1,
//   },

//   placeCoords: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   placeMeta: {
//     fontSize: 11.5,
//     marginTop: 2,
//   },

//   iconButton: {
//     padding: 4,
//   },

//   radiusRow: {
//     flexDirection: 'row',
//     marginTop: 12,
//   },

//   radiusChip: {
//     borderWidth: 1,
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     marginRight: 8,
//   },

//   radiusText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },

//   actionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingVertical: 11,
//     marginTop: 14,
//   },

//   actionText: {
//     fontSize: 13.5,
//     fontWeight: '700',
//     marginLeft: 7,
//   },

//   errorText: {
//     fontSize: 12,
//     color: '#EF4444',
//     marginTop: 9,
//     lineHeight: 17,
//   },
// });

// export default LocationCard;
