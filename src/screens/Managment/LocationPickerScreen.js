import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from '@react-native-vector-icons/ionicons';

import { useTheme } from '../../context/ThemeContext';
import { useLocation } from '../../context/LocationContext';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  GEOFENCE_RADIUS_OPTIONS,
  formatCoordinates,
} from '../../services/location';
import {
  getPickerDraft,
  setPickedLocation,
} from '../../services/locationPicker';

// Used only when we have neither a saved place nor a GPS fix to open at.
const FALLBACK_CENTER = { latitude: 33.6844, longitude: 73.0479 };

// ---------------------------------------------------------------- map page
// The OpenStreetMap page is built right here, so this screen is one
// self-contained file: copy it in and the map works, no second file to add.
//
// OpenStreetMap, not Google: tiles come from tile.openstreetmap.org and the
// rendering is done by Leaflet. No Google Maps SDK, no API key, nothing to
// sign up for. Leaflet is fetched from three different CDNs in turn, so one
// blocked or slow CDN cannot leave you with a blank screen.

const buildMapHtml = ({
  latitude,
  longitude,
  radius = 200,
  userLatitude = null,
  userLongitude = null,
}) => {
  // Belt and braces. The screen already validates before calling this, but a
  // null must never reach Leaflet: it coerces null to 0 without complaining,
  // which silently drops the map at latitude 0, longitude 0 - the ocean.
  const clean = (value, fallback) => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
  };

  let startLat = clean(latitude, FALLBACK_CENTER.latitude);
  let startLng = clean(longitude, FALLBACK_CENTER.longitude);

  // 0,0 is how "no place saved" arrives when it reaches this point as real
  // numbers. Nobody picks a spot in the Gulf of Guinea, so treat it as unset.
  if (startLat === 0 && startLng === 0) {
    startLat = FALLBACK_CENTER.latitude;
    startLng = FALLBACK_CENTER.longitude;
  }

  const userLat = userLatitude === null ? null : clean(userLatitude, null);
  const userLng = userLongitude === null ? null : clean(userLongitude, null);
  const hasUser = userLat !== null && userLng !== null;

  const safeRadius = clean(radius, 200);

  // Roughly frames the alert radius on a phone screen.
  const zoom = safeRadius <= 100 ? 17 : safeRadius <= 220 ? 16 : 15;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; }

    #map { position: absolute; inset: 0; background: #e8eaed; }

    /* The pin the user is positioning. Sits at the centre of the screen with
       its tip on the middle point, so the map pans underneath it. */
    .pin-wrap {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      filter: drop-shadow(0 3px 3px rgba(0,0,0,0.3));
    }

    .msg {
      position: absolute;
      left: 0; right: 0; top: 50%;
      transform: translateY(-50%);
      text-align: center;
      font-family: -apple-system, Roboto, sans-serif;
      font-size: 13px;
      line-height: 19px;
      color: #4b5563;
      z-index: 900;
      pointer-events: none;
      padding: 0 24px;
    }

    #note {
      position: absolute;
      left: 8px; bottom: 8px; right: 8px;
      text-align: center;
      font-family: -apple-system, Roboto, sans-serif;
      font-size: 11px;
      color: #4b5563;
      background: rgba(255,255,255,0.85);
      border-radius: 6px;
      padding: 4px 6px;
      z-index: 900;
      pointer-events: none;
      display: none;
    }

    /* OpenStreetMap requires this attribution - do not remove it. */
    .leaflet-control-attribution {
      font-size: 10px;
      background: rgba(255,255,255,0.8);
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <div class="pin-wrap">
    <svg width="38" height="50" viewBox="0 0 24 32">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20c0-6.6-5.4-12-12-12z"
            fill="#0EA5E9" />
      <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
    </svg>
  </div>

  <div id="status" class="msg">Loading map...</div>
  <div id="note"></div>

  <script>
    var statusEl = document.getElementById('status');
    var noteEl = document.getElementById('note');

    var send = function (payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };

    var showNote = function (text) {
      noteEl.innerHTML = text;
      noteEl.style.display = 'block';

      setTimeout(function () { noteEl.style.display = 'none'; }, 6000);
    };

    var fatal = function (message) {
      statusEl.style.display = 'block';
      statusEl.innerHTML =
        'Could not load the map library.<br/>Check the phone has internet.';
      send({ type: 'fatal', message: message });
    };

    // Three independent copies of Leaflet. If the first is blocked or slow,
    // the next one is tried, so no single CDN can leave the screen blank.
    var CDNS = [
      {
        js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      },
      {
        js: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
        css: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'
      },
      {
        js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
        css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
      }
    ];

    var booted = false;

    // If nothing has arrived after this long, say so instead of spinning.
    setTimeout(function () {
      if (!booted) {
        fatal('leaflet-timeout');
      }
    }, 20000);

    var boot = function () {
      var START = [${startLat}, ${startLng}];
      var USER = ${hasUser ? `[${userLat}, ${userLng}]` : 'null'};
      var usedFallback = false;

      // Last line of defence: never hand Leaflet a coordinate that is not a
      // real number. isNaN(null) is false, so Leaflet would accept a null
      // and quietly draw the map at 0,0.
      if (!isFinite(START[0]) || !isFinite(START[1])) {
        START = [${FALLBACK_CENTER.latitude}, ${FALLBACK_CENTER.longitude}];
        usedFallback = true;
      }

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: true
      }).setView(START, ${zoom});

      // OpenStreetMap raster tiles - the whole point of this screen.
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      });

      var tileErrors = 0;

      tiles.on('load', function () {
        statusEl.style.display = 'none';
        send({ type: 'tiles', ok: true });
      });

      // One flaky tile is normal. A run of them means no usable connection.
      tiles.on('tileerror', function () {
        tileErrors += 1;

        if (tileErrors === 4) {
          showNote('Map tiles are not loading - check the phone has internet.');
          send({ type: 'tiles', ok: false });
        }
      });

      tiles.addTo(map);

      // The alert zone.
      var circle = L.circle(map.getCenter(), {
        radius: ${safeRadius},
        color: '#0EA5E9',
        weight: 2,
        fillColor: '#0EA5E9',
        fillOpacity: 0.15
      }).addTo(map);

      // Where the user currently is, once we have a GPS fix.
      var userMarker = null;

      if (USER) {
        userMarker = L.circleMarker(USER, {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#22C55E',
          fillOpacity: 1
        }).addTo(map);
      }

      var report = function () {
        var c = map.getCenter();
        send({ type: 'center', latitude: c.lat, longitude: c.lng });
      };

      map.on('move', function () {
        circle.setLatLng(map.getCenter());
      });

      // dragstart only fires for a real finger drag, never for setView, so
      // the app can tell "the user has taken over" from "we moved it".
      map.on('dragstart', function () {
        send({ type: 'drag' });
      });

      map.on('moveend', report);

      map.whenReady(function () {
        send({ type: 'ready' });
        report();

        if (usedFallback) {
          showNote('Waiting for your position - drag the map to pick a place.');
        }
      });

      // ---- called from React Native via injectJavaScript ----

      window.setRadius = function (meters) {
        circle.setRadius(meters);
        return true;
      };

      window.setUser = function (lat, lng) {
        if (userMarker) {
          userMarker.setLatLng([lat, lng]);
        } else {
          userMarker = L.circleMarker([lat, lng], {
            radius: 7,
            color: '#ffffff',
            weight: 2,
            fillColor: '#22C55E',
            fillOpacity: 1
          }).addTo(map);
        }

        return true;
      };

      window.recenter = function (lat, lng) {
        map.setView([lat, lng], map.getZoom(), { animate: true });
        return true;
      };
    };

    var tryCdn = function (index) {
      if (booted) {
        return;
      }

      if (index >= CDNS.length) {
        fatal('leaflet-unavailable');
        return;
      }

      var script = document.createElement('script');

      script.src = CDNS[index].js;

      script.onload = function () {
        if (booted) {
          return;
        }

        booted = true;

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CDNS[index].css;
        document.head.appendChild(link);

        try {
          boot();
        } catch (bootError) {
          fatal('leaflet-boot-failed');
        }
      };

      script.onerror = function () {
        tryCdn(index + 1);
      };

      document.head.appendChild(script);
    };

    tryCdn(0);
  </script>
</body>
</html>`;
};

// ------------------------------------------------------- coordinate helpers

/**
 * True only for a real coordinate pair.
 *
 * The explicit null checks are the important part. A draft for a brand new
 * task carries latitude: null, and Number(null) is 0 - so a plain
 * isFinite(Number(x)) test would accept it and hand the map 0,0, which is
 * the middle of the ocean. That was the blank blue map.
 */
const isPoint = point =>
  point !== null &&
  point !== undefined &&
  point.latitude !== null &&
  point.latitude !== undefined &&
  point.longitude !== null &&
  point.longitude !== undefined &&
  Number.isFinite(Number(point.latitude)) &&
  Number.isFinite(Number(point.longitude));

/**
 * A point we are willing to call "a place the user chose". Same as isPoint,
 * except that 0,0 is rejected - it is real ocean, and it is also what the
 * buggy build wrote into the database when someone tapped USE THIS PLACE on
 * that blank screen. Treating it as unset means such a task now opens on
 * somewhere sensible instead of on the water again.
 */
const isPlace = point =>
  isPoint(point) &&
  !(Number(point.latitude) === 0 && Number(point.longitude) === 0);

// ------------------------------------------------------------- the screen

/**
 * Full-screen map for choosing the place a task is tied to.
 *
 * The pin stays fixed at the centre and the user drags the map underneath it,
 * which is easier to aim than grabbing a small marker and works with no GPS.
 */
const LocationPickerScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { position, refresh } = useLocation();

  const webRef = useRef(null);

  const draft = route?.params?.draft || getPickerDraft() || null;

  // A saved place wins, then a live GPS fix, then the city fallback. Only a
  // point that actually has usable numbers in it counts as a place.
  const start = isPlace(draft)
    ? draft
    : isPlace(position)
    ? position
    : FALLBACK_CENTER;

  const startLatitude = Number(start.latitude);
  const startLongitude = Number(start.longitude);

  // True when we had nothing real to open at, so the map should glide to the
  // user's position as soon as a GPS fix lands.
  const autoLocateRef = useRef(!isPlace(draft) && !isPlace(position));

  // Set the moment we have asked the GPS, so we only ever ask once. Without
  // it, refresh's changing identity would re-fire this effect on every fix.
  const autoLocateDoneRef = useRef(false);

  // Set once the user drags the map, so we never yank it away from them.
  const draggedRef = useRef(false);
  const locatedRef = useRef(false);

  const [radius, setRadius] = useState(
    draft?.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS
  );

  const [center, setCenter] = useState({
    latitude: startLatitude,
    longitude: startLongitude,
  });

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [tileWarning, setTileWarning] = useState(false);

  // Built once, from an already-validated point. Later changes go in through
  // injectJavaScript, so the map is never torn down while being dragged.
  const html = useMemo(
    () =>
      buildMapHtml({
        latitude: startLatitude,
        longitude: startLongitude,
        radius: draft?.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS,
        userLatitude: isPlace(position) ? position.latitude : null,
        userLongitude: isPlace(position) ? position.longitude : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Nothing saved and no fix yet: ask for one, so the map opens on the user
  // rather than on the fallback city.
  useEffect(() => {
    if (!autoLocateRef.current || autoLocateDoneRef.current) {
      return;
    }

    autoLocateDoneRef.current = true;

    refresh().catch(() => {});
  }, [refresh]);

  // ---------------------------------------------------------------- theme

  const textColor = theme.text || '#0F172A';
  const subTextColor = theme.subText || '#64748B';
  const primaryColor = theme.primary || '#0EA5E9';
  const borderClr = theme.border || '#E2E8F0';
  const isDark = theme.bg === '#000000' || theme.bg === '#0F172A';
  const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

  // -------------------------------------------------------- map -> app

  const handleMessage = useCallback(event => {
    let payload = null;

    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch (parseFailure) {
      return;
    }

    if (payload?.type === 'ready') {
      setMapReady(true);
      setMapError(null);
      return;
    }

    if (payload?.type === 'drag') {
      draggedRef.current = true;
      return;
    }

    if (payload?.type === 'tiles') {
      setTileWarning(payload.ok === false);
      return;
    }

    if (payload?.type === 'center') {
      setCenter({
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
      return;
    }

    if (payload?.type === 'fatal') {
      setMapError(
        'The map could not load. Check that the phone has internet, then try again.'
      );
    }
  }, []);

  // -------------------------------------------------------- app -> map

  const runInMap = useCallback(script => {
    webRef.current?.injectJavaScript(`try { ${script} } catch (err) {} true;`);
  }, []);

  // A fix arriving after the map opened: show the dot, and if the map is
  // still sitting on the fallback city, glide over to the user once.
  useEffect(() => {
    if (!isPlace(position) || !mapReady) {
      return;
    }

    runInMap(
      `if (typeof window.setUser === 'function') { window.setUser(${position.latitude}, ${position.longitude}); }`
    );

    if (!autoLocateRef.current || locatedRef.current || draggedRef.current) {
      return;
    }

    locatedRef.current = true;

    setCenter({
      latitude: Number(position.latitude),
      longitude: Number(position.longitude),
    });

    runInMap(
      `if (typeof window.recenter === 'function') { window.recenter(${position.latitude}, ${position.longitude}); }`
    );
  }, [position, mapReady, runInMap]);

  const handleRadius = useCallback(
    nextRadius => {
      setRadius(nextRadius);
      runInMap(`window.setRadius(${nextRadius});`);
    },
    [runInMap]
  );

  const handleRecenter = useCallback(async () => {
    if (isPlace(position)) {
      setCenter({
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
      });

      runInMap(`window.recenter(${position.latitude}, ${position.longitude});`);

      return;
    }

    // No fix in memory - try to get one before giving up.
    const fix = await refresh().catch(() => null);

    if (isPlace(fix)) {
      setCenter({
        latitude: Number(fix.latitude),
        longitude: Number(fix.longitude),
      });

      runInMap(`window.recenter(${fix.latitude}, ${fix.longitude});`);

      return;
    }

    Alert.alert(
      'No GPS fix yet',
      'The phone has not found your position yet. Drag the map to the place you want instead.'
    );
  }, [position, refresh, runInMap]);

  const handleConfirm = useCallback(() => {
    if (!isPoint(center)) {
      return;
    }

    setPickedLocation({
      latitude: Number(center.latitude),
      longitude: Number(center.longitude),
      accuracy: isPlace(position) ? position.accuracy : null,
      geofenceRadiusMeters: radius,
      geofenceEnabled: true,
      source: 'map',
    });

    navigation.goBack();
  }, [center, navigation, position, radius]);

  // ---------------------------------------------------------------- render

  const canConfirm = mapReady && isPoint(center);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.bg, borderBottomColor: borderClr },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textColor }]}>
          Pick the place
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* MAP - OpenStreetMap, no Google involved */}
      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          onError={() =>
            setMapError('The map could not load. Check the phone has internet.')
          }
          javaScriptEnabled
          domStorageEnabled
          // The map is all we show, so let it own its gestures.
          scrollEnabled
          overScrollMode="never"
          setBuiltInZoomControls={false}
          androidLayerType="hardware"
          style={styles.webview}
        />

        {!mapReady && !mapError ? (
          <View pointerEvents="none" style={styles.mapLoading}>
            <ActivityIndicator color={primaryColor} />
            <Text style={[styles.mapLoadingText, { color: subTextColor }]}>
              Loading map...
            </Text>
          </View>
        ) : null}

        {mapError ? (
          <View pointerEvents="none" style={styles.mapLoading}>
            <Icon name="cloud-offline-outline" size={30} color={subTextColor} />
            <Text style={[styles.mapErrorText, { color: subTextColor }]}>
              {mapError}
            </Text>
          </View>
        ) : null}

        {/* Not blocking the map - the map may work fine, tiles may not. */}
        {tileWarning && !mapError ? (
          <View
            pointerEvents="none"
            style={[styles.tileBanner, { backgroundColor: cardBg }]}
          >
            <Icon name="cloud-offline-outline" size={14} color={subTextColor} />
            <Text style={[styles.tileBannerText, { color: subTextColor }]}>
              Map tiles are not loading - check the internet
            </Text>
          </View>
        ) : null}

        {/* My location */}
        <TouchableOpacity
          style={[styles.myLocationBtn, { backgroundColor: cardBg }]}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Icon name="navigate" size={20} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* BOTTOM CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: cardBg, borderTopColor: borderClr },
        ]}
      >
        <Text style={[styles.hint, { color: subTextColor }]}>
          Drag the map so the pin sits on the place you want.
        </Text>

        <Text style={[styles.coords, { color: textColor }]}>
          {isPoint(center)
            ? formatCoordinates(center.latitude, center.longitude)
            : 'Locating you...'}
        </Text>

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
                    borderColor: selected ? primaryColor : borderClr,
                    backgroundColor: selected
                      ? `${primaryColor}22`
                      : 'transparent',
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.radiusText,
                    { color: selected ? primaryColor : subTextColor },
                  ]}
                >
                  {option} m
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.confirmBtn,
              { backgroundColor: primaryColor },
            ]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmText}>USE THIS PLACE</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.credit, { color: subTextColor }]}>
          Map data © OpenStreetMap contributors
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  backBtn: { padding: 4 },

  headerTitle: { fontSize: 16, fontWeight: '700' },

  headerSpacer: { width: 32 },

  mapWrap: { flex: 1, overflow: 'hidden' },

  webview: { flex: 1, backgroundColor: 'transparent' },

  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  mapLoadingText: { fontSize: 12.5, marginTop: 8 },

  mapErrorText: {
    fontSize: 12.5,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },

  tileBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    elevation: 3,
  },

  tileBannerText: { fontSize: 11.5, marginLeft: 6 },

  myLocationBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  card: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  hint: { fontSize: 12.5 },

  coords: { fontSize: 15, fontWeight: '700', marginTop: 6 },

  radiusRow: { flexDirection: 'row', marginTop: 12 },

  radiusChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },

  radiusText: { fontSize: 12.5, fontWeight: '700' },

  btnRow: { flexDirection: 'row', marginTop: 16 },

  btn: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },

  cancelBtn: { borderWidth: 1, marginRight: 10 },

  confirmBtn: { borderWidth: 0 },

  btnText: { fontSize: 13.5, fontWeight: '700' },

  confirmText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  credit: {
    fontSize: 10,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default LocationPickerScreen;















































// import React, { useCallback, useMemo, useRef, useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   SafeAreaView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import { WebView } from 'react-native-webview';
// import Icon from '@react-native-vector-icons/ionicons';

// import { useTheme } from '../../context/ThemeContext';
// import { useLocation } from '../../context/LocationContext';
// import {
//   DEFAULT_GEOFENCE_RADIUS_METERS,
//   GEOFENCE_RADIUS_OPTIONS,
//   formatCoordinates,
// } from '../../services/location';
// import { buildOsmMapHtml } from '../../services/osmMap';
// import {
//   getPickerDraft,
//   setPickedLocation,
// } from '../../services/locationPicker';

// // Used only when we have neither a saved place nor a GPS fix to start from.
// const FALLBACK_CENTER = { latitude: 33.6844, longitude: 73.0479 };

// /**
//  * Full-screen map for choosing the place a task is tied to.
//  *
//  * The map is OpenStreetMap rendered by Leaflet inside a WebView - no Google
//  * Maps SDK and no API key anywhere. The pin stays fixed at the centre of the
//  * screen and the user drags the map underneath it, which is far easier to aim
//  * than grabbing a small marker, and it works even when there is no GPS fix.
//  */
// const LocationPickerScreen = ({ navigation, route }) => {
//   const { theme } = useTheme();
//   const { position } = useLocation();

//   const webRef = useRef(null);

//   const draft = route?.params?.draft || getPickerDraft() || null;
//   const start = draft || position || FALLBACK_CENTER;

//   const [radius, setRadius] = useState(
//     draft?.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS
//   );

//   const [center, setCenter] = useState({
//     latitude: Number(start.latitude),
//     longitude: Number(start.longitude),
//   });

//   const [mapReady, setMapReady] = useState(false);
//   const [mapError, setMapError] = useState(null);

//   // Built once. Later changes go in through injectJavaScript so the map is
//   // never torn down and reloaded while the user is dragging it.
//   const html = useMemo(
//     () =>
//       buildOsmMapHtml({
//         latitude: Number(start.latitude),
//         longitude: Number(start.longitude),
//         radius: draft?.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS,
//         userLatitude: position ? position.latitude : null,
//         userLongitude: position ? position.longitude : null,
//       }),
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     []
//   );

//   // ---------------------------------------------------------------- theme

//   const textColor = theme.text || '#0F172A';
//   const subTextColor = theme.subText || '#64748B';
//   const primaryColor = theme.primary || '#0EA5E9';
//   const borderClr = theme.border || '#E2E8F0';
//   const isDark = theme.bg === '#000000' || theme.bg === '#0F172A';
//   const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

//   // -------------------------------------------------------- map -> app

//   const handleMessage = useCallback(event => {
//     let payload = null;

//     try {
//       payload = JSON.parse(event.nativeEvent.data);
//     } catch (parseFailure) {
//       return;
//     }

//     if (payload?.type === 'ready') {
//       setMapReady(true);
//       setMapError(null);
//       return;
//     }

//     if (payload?.type === 'center') {
//       setCenter({
//         latitude: payload.latitude,
//         longitude: payload.longitude,
//       });
//       return;
//     }

//     if (payload?.type === 'error') {
//       setMapError(
//         'The map could not load. Check that the phone has internet, then try again.'
//       );
//     }
//   }, []);

//   // -------------------------------------------------------- app -> map

//   const runInMap = useCallback(script => {
//     webRef.current?.injectJavaScript(`${script} true;`);
//   }, []);

//   const handleRadius = useCallback(
//     nextRadius => {
//       setRadius(nextRadius);
//       runInMap(`window.setRadius(${nextRadius});`);
//     },
//     [runInMap]
//   );

//   const handleRecenter = useCallback(() => {
//     if (!position) {
//       Alert.alert(
//         'No GPS fix yet',
//         'The phone has not found your position yet. Drag the map to the place you want instead.'
//       );
//       return;
//     }

//     setCenter({
//       latitude: position.latitude,
//       longitude: position.longitude,
//     });

//     runInMap(`window.recenter(${position.latitude}, ${position.longitude});`);
//   }, [position, runInMap]);

//   const handleConfirm = useCallback(() => {
//     setPickedLocation({
//       latitude: center.latitude,
//       longitude: center.longitude,
//       accuracy: position ? position.accuracy : null,
//       geofenceRadiusMeters: radius,
//       geofenceEnabled: true,
//       source: 'map',
//     });

//     navigation.goBack();
//   }, [center, navigation, position, radius]);

//   // ---------------------------------------------------------------- render

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <StatusBar
//         barStyle={isDark ? 'light-content' : 'dark-content'}
//         backgroundColor={theme.bg}
//       />

//       {/* HEADER */}
//       <View
//         style={[
//           styles.header,
//           { backgroundColor: theme.bg, borderBottomColor: borderClr },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.backBtn}
//           activeOpacity={0.7}
//         >
//           <Icon name="arrow-back" size={24} color={textColor} />
//         </TouchableOpacity>

//         <Text style={[styles.headerTitle, { color: textColor }]}>
//           Pick the place
//         </Text>

//         <View style={styles.headerSpacer} />
//       </View>

//       {/* MAP - OpenStreetMap inside a WebView, no Google involved */}
//       <View style={styles.mapWrap}>
//         <WebView
//           ref={webRef}
//           originWhitelist={['*']}
//           source={{ html }}
//           onMessage={handleMessage}
//           onError={() =>
//             setMapError('The map could not load. Check the phone has internet.')
//           }
//           javaScriptEnabled
//           domStorageEnabled
//           // The map is all we show, so let it own its gestures.
//           scrollEnabled
//           overScrollMode="never"
//           setBuiltInZoomControls={false}
//           androidLayerType="hardware"
//           style={styles.webview}
//         />

//         {!mapReady && !mapError ? (
//           <View pointerEvents="none" style={styles.mapLoading}>
//             <ActivityIndicator color={primaryColor} />
//             <Text style={[styles.mapLoadingText, { color: subTextColor }]}>
//               Loading map...
//             </Text>
//           </View>
//         ) : null}

//         {mapError ? (
//           <View pointerEvents="none" style={styles.mapLoading}>
//             <Icon name="cloud-offline-outline" size={30} color={subTextColor} />
//             <Text style={[styles.mapErrorText, { color: subTextColor }]}>
//               {mapError}
//             </Text>
//           </View>
//         ) : null}

//         {/* My location */}
//         <TouchableOpacity
//           style={[styles.myLocationBtn, { backgroundColor: cardBg }]}
//           onPress={handleRecenter}
//           activeOpacity={0.8}
//         >
//           <Icon name="navigate" size={20} color={primaryColor} />
//         </TouchableOpacity>
//       </View>

//       {/* BOTTOM CARD */}
//       <View
//         style={[
//           styles.card,
//           { backgroundColor: cardBg, borderTopColor: borderClr },
//         ]}
//       >
//         <Text style={[styles.hint, { color: subTextColor }]}>
//           Drag the map so the pin sits on the place you want.
//         </Text>

//         <Text style={[styles.coords, { color: textColor }]}>
//           {formatCoordinates(center.latitude, center.longitude)}
//         </Text>

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
//                     borderColor: selected ? primaryColor : borderClr,
//                     backgroundColor: selected
//                       ? `${primaryColor}22`
//                       : 'transparent',
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <Text
//                   style={[
//                     styles.radiusText,
//                     { color: selected ? primaryColor : subTextColor },
//                   ]}
//                 >
//                   {option} m
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </View>

//         <View style={styles.btnRow}>
//           <TouchableOpacity
//             style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
//             onPress={() => navigation.goBack()}
//             activeOpacity={0.8}
//           >
//             <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.btn,
//               styles.confirmBtn,
//               { backgroundColor: primaryColor },
//             ]}
//             onPress={handleConfirm}
//             disabled={!mapReady}
//             activeOpacity={0.85}
//           >
//             <Text style={styles.confirmText}>USE THIS PLACE</Text>
//           </TouchableOpacity>
//         </View>

//         <Text style={[styles.credit, { color: subTextColor }]}>
//           Map data © OpenStreetMap contributors
//         </Text>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1 },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//   },

//   backBtn: { padding: 4 },

//   headerTitle: { fontSize: 16, fontWeight: '700' },

//   headerSpacer: { width: 32 },

//   mapWrap: { flex: 1, overflow: 'hidden' },

//   webview: { flex: 1, backgroundColor: 'transparent' },

//   mapLoading: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 32,
//   },

//   mapLoadingText: { fontSize: 12.5, marginTop: 8 },

//   mapErrorText: {
//     fontSize: 12.5,
//     marginTop: 10,
//     textAlign: 'center',
//     lineHeight: 18,
//   },

//   myLocationBtn: {
//     position: 'absolute',
//     right: 16,
//     bottom: 16,
//     width: 46,
//     height: 46,
//     borderRadius: 23,
//     alignItems: 'center',
//     justifyContent: 'center',
//     elevation: 4,
//     shadowColor: '#000',
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//     shadowOffset: { width: 0, height: 2 },
//   },

//   card: {
//     borderTopWidth: 1,
//     paddingHorizontal: 16,
//     paddingTop: 14,
//     paddingBottom: 16,
//   },

//   hint: { fontSize: 12.5 },

//   coords: { fontSize: 15, fontWeight: '700', marginTop: 6 },

//   radiusRow: { flexDirection: 'row', marginTop: 12 },

//   radiusChip: {
//     borderWidth: 1,
//     borderRadius: 10,
//     paddingHorizontal: 14,
//     paddingVertical: 7,
//     marginRight: 8,
//   },

//   radiusText: { fontSize: 12.5, fontWeight: '700' },

//   btnRow: { flexDirection: 'row', marginTop: 16 },

//   btn: {
//     flex: 1,
//     borderRadius: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 15,
//   },

//   cancelBtn: { borderWidth: 1, marginRight: 10 },

//   confirmBtn: { borderWidth: 0 },

//   btnText: { fontSize: 13.5, fontWeight: '700' },

//   confirmText: {
//     color: '#FFFFFF',
//     fontSize: 13.5,
//     fontWeight: '800',
//     letterSpacing: 0.4,
//   },

//   credit: {
//     fontSize: 10,
//     marginTop: 10,
//     textAlign: 'center',
//   },
// });

// export default LocationPickerScreen;