/**
 * Builds the OpenStreetMap page the location picker runs inside a WebView.
 *
 * OpenStreetMap, not Google:
 *   * tiles come from tile.openstreetmap.org (free, no API key)
 *   * rendering is done by Leaflet, loaded from unpkg
 *   * the Google Maps SDK is not used anywhere in this app
 *
 * The page talks to React Native through window.ReactNativeWebView.postMessage
 * and exposes three functions the app calls with injectJavaScript:
 *   window.setRadius(meters)
 *   window.setUser(latitude, longitude)
 *   window.recenter(latitude, longitude)
 *
 * Messages sent up to the app:
 *   { type: 'ready' }                          the map is up
 *   { type: 'center', latitude, longitude }    where the pin is now
 *   { type: 'drag' }                           the user moved the map by hand
 *   { type: 'error', message }                 tiles or Leaflet failed
 */

// Shown when we have no usable coordinate to start from.
export const FALLBACK_CENTER = { latitude: 33.6844, longitude: 73.0479 };

// Zoom level that roughly frames a given alert radius on a phone screen.
const zoomForRadius = meters => {
  if (meters <= 100) return 17;
  if (meters <= 200) return 16;
  return 15;
};

/**
 * Turns anything into a real number, or falls back.
 *
 * This matters more than it looks: if a null slips through, Leaflet does not
 * complain, it coerces null to 0 and silently drops the map in the Atlantic
 * off West Africa - which reads to the user as "the map is blank blue".
 * So null / undefined / NaN / '' are all rejected here.
 */
const num = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
};

export const buildOsmMapHtml = ({
  latitude,
  longitude,
  radius = 200,
  userLatitude = null,
  userLongitude = null,
}) => {
  let startLat = num(latitude, FALLBACK_CENTER.latitude);
  let startLng = num(longitude, FALLBACK_CENTER.longitude);

  // 0,0 is the app's "no place saved" value arriving as real numbers, and it
  // is deep ocean. Nobody picks a spot there, so treat it as unknown.
  if (startLat === 0 && startLng === 0) {
    startLat = FALLBACK_CENTER.latitude;
    startLng = FALLBACK_CENTER.longitude;
  }

  const zoom = zoomForRadius(radius);

  const userLat = userLatitude === null ? null : num(userLatitude, null);
  const userLng = userLongitude === null ? null : num(userLongitude, null);
  const hasUser = userLat !== null && userLng !== null;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <link rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; }

    #map { position: absolute; inset: 0; background: #e8eaed; }

    /* The pin the user is positioning. Sits at the centre of the screen,
       tip exactly on the middle point, so the map pans underneath it. */
    .pin-wrap {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      filter: drop-shadow(0 3px 3px rgba(0,0,0,0.3));
    }

    #status {
      position: absolute;
      left: 0; right: 0; top: 50%;
      transform: translateY(-50%);
      text-align: center;
      font-family: -apple-system, Roboto, sans-serif;
      font-size: 13px;
      color: #4b5563;
      z-index: 900;
      pointer-events: none;
      padding: 0 24px;
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

  <div id="status">Loading map...</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    var send = function (payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };

    // Leaflet itself failed to download (no internet?).
    if (typeof L === 'undefined') {
      document.getElementById('status').innerHTML =
        'Could not load the map library.<br/>Check the phone has internet.';
      send({ type: 'error', message: 'leaflet-unavailable' });
    } else {
      var statusEl = document.getElementById('status');

      var START = [${startLat}, ${startLng}];
      var USER = ${hasUser ? `[${userLat}, ${userLng}]` : 'null'};
      var usedFallback = false;

      // Belt and braces: never hand Leaflet a coordinate that is not a number.
      if (!isFinite(START[0]) || !isFinite(START[1])) {
        START = [${FALLBACK_CENTER.latitude}, ${FALLBACK_CENTER.longitude}];
        usedFallback = true;
      }

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: true,
      }).setView(START, ${zoom});

      // OpenStreetMap raster tiles - the whole point of this screen.
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      });

      tiles.on('load', function () {
        if (usedFallback) { return; }
        statusEl.style.display = 'none';
      });

      // One flaky tile should not hide the map; a run of them should say so.
      var tileErrors = 0;

      tiles.on('tileerror', function () {
        tileErrors += 1;

        if (tileErrors > 3) {
          statusEl.style.display = 'block';
          statusEl.innerHTML =
            'Map tiles could not load.<br/>Check the phone has internet.';
          send({ type: 'error', message: 'tiles' });
        }
      });

      tiles.addTo(map);

      // The alert zone.
      var circle = L.circle(map.getCenter(), {
        radius: ${num(radius, 200)},
        color: '#0EA5E9',
        weight: 2,
        fillColor: '#0EA5E9',
        fillOpacity: 0.15,
      }).addTo(map);

      // Where the user currently is (if we have a GPS fix).
      var userMarker = null;

      if (USER) {
        userMarker = L.circleMarker(USER, {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#22C55E',
          fillOpacity: 1,
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
            fillOpacity: 1,
          }).addTo(map);
        }

        return true;
      };

      window.recenter = function (lat, lng) {
        map.setView([lat, lng], map.getZoom(), { animate: true });
        return true;
      };
    }
  </script>
</body>
</html>`;
};

export default buildOsmMapHtml;










































// /**
//  * Builds the OpenStreetMap page the location picker runs inside a WebView.
//  *
//  * OpenStreetMap, not Google:
//  *   * tiles come from tile.openstreetmap.org (free, no API key)
//  *   * rendering is done by Leaflet, loaded from unpkg
//  *   * the Google Maps SDK is not used anywhere in this app
//  *
//  * The page talks to React Native through window.ReactNativeWebView.postMessage
//  * and exposes three functions the app calls with injectJavaScript:
//  *   window.setRadius(meters)
//  *   window.setUser(latitude, longitude)
//  *   window.recenter(latitude, longitude)
//  */

// // Zoom level that roughly frames a given alert radius on a phone screen.
// const zoomForRadius = meters => {
//   if (meters <= 100) return 17;
//   if (meters <= 200) return 16;
//   return 15;
// };

// export const buildOsmMapHtml = ({
//   latitude,
//   longitude,
//   radius = 200,
//   userLatitude = null,
//   userLongitude = null,
// }) => {
//   const zoom = zoomForRadius(radius);

//   return `<!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8" />
//   <meta name="viewport"
//         content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

//   <link rel="stylesheet"
//         href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

//   <style>
//     html, body { margin: 0; padding: 0; height: 100%; width: 100%; }

//     #map { position: absolute; inset: 0; background: #e8eaed; }

//     /* The pin the user is positioning. Sits at the centre of the screen,
//        tip exactly on the middle point, so the map pans underneath it. */
//     .pin-wrap {
//       position: absolute;
//       left: 50%;
//       top: 50%;
//       transform: translate(-50%, -100%);
//       z-index: 1000;
//       pointer-events: none;
//       filter: drop-shadow(0 3px 3px rgba(0,0,0,0.3));
//     }

//     #status {
//       position: absolute;
//       left: 0; right: 0; top: 50%;
//       transform: translateY(-50%);
//       text-align: center;
//       font-family: -apple-system, Roboto, sans-serif;
//       font-size: 13px;
//       color: #4b5563;
//       z-index: 900;
//       pointer-events: none;
//       padding: 0 24px;
//     }

//     /* OpenStreetMap requires this attribution - do not remove it. */
//     .leaflet-control-attribution {
//       font-size: 10px;
//       background: rgba(255,255,255,0.8);
//     }
//   </style>
// </head>

// <body>
//   <div id="map"></div>

//   <div class="pin-wrap">
//     <svg width="38" height="50" viewBox="0 0 24 32">
//       <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20c0-6.6-5.4-12-12-12z"
//             fill="#0EA5E9" />
//       <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
//     </svg>
//   </div>

//   <div id="status">Loading map...</div>

//   <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

//   <script>
//     var send = function (payload) {
//       if (window.ReactNativeWebView) {
//         window.ReactNativeWebView.postMessage(JSON.stringify(payload));
//       }
//     };

//     // Leaflet itself failed to download (no internet?).
//     if (typeof L === 'undefined') {
//       document.getElementById('status').innerHTML =
//         'Could not load the map library.<br/>Check the phone has internet.';
//       send({ type: 'error', message: 'leaflet-unavailable' });
//     } else {
//       var statusEl = document.getElementById('status');

//       var START = [${latitude}, ${longitude}];
//       var USER = ${userLatitude !== null && userLongitude !== null
//         ? `[${userLatitude}, ${userLongitude}]`
//         : 'null'};

//       var map = L.map('map', {
//         zoomControl: false,
//         attributionControl: true,
//         fadeAnimation: true,
//       }).setView(START, ${zoom});

//       // OpenStreetMap raster tiles - the whole point of this screen.
//       var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         maxZoom: 19,
//         attribution: '&copy; OpenStreetMap contributors',
//       });

//       tiles.on('load', function () {
//         statusEl.style.display = 'none';
//       });

//       tiles.on('tileerror', function () {
//         statusEl.style.display = 'block';
//         statusEl.innerHTML = 'Map tiles could not load.<br/>Check the phone has internet.';
//       });

//       tiles.addTo(map);

//       // The alert zone.
//       var circle = L.circle(map.getCenter(), {
//         radius: ${radius},
//         color: '#0EA5E9',
//         weight: 2,
//         fillColor: '#0EA5E9',
//         fillOpacity: 0.15,
//       }).addTo(map);

//       // Where the user currently is (if we have a GPS fix).
//       var userMarker = null;

//       if (USER) {
//         userMarker = L.circleMarker(USER, {
//           radius: 7,
//           color: '#ffffff',
//           weight: 2,
//           fillColor: '#22C55E',
//           fillOpacity: 1,
//         }).addTo(map);
//       }

//       var report = function () {
//         var c = map.getCenter();
//         send({ type: 'center', latitude: c.lat, longitude: c.lng });
//       };

//       map.on('move', function () {
//         circle.setLatLng(map.getCenter());
//       });

//       map.on('moveend', report);

//       map.whenReady(function () {
//         send({ type: 'ready' });
//         report();
//       });

//       // ---- called from React Native via injectJavaScript ----

//       window.setRadius = function (meters) {
//         circle.setRadius(meters);
//         return true;
//       };

//       window.setUser = function (lat, lng) {
//         if (userMarker) {
//           userMarker.setLatLng([lat, lng]);
//         } else {
//           userMarker = L.circleMarker([lat, lng], {
//             radius: 7,
//             color: '#ffffff',
//             weight: 2,
//             fillColor: '#22C55E',
//             fillOpacity: 1,
//           }).addTo(map);
//         }

//         return true;
//       };

//       window.recenter = function (lat, lng) {
//         map.setView([lat, lng], map.getZoom(), { animate: true });
//         return true;
//       };
//     }
//   </script>
// </body>
// </html>`;
// };

// export default buildOsmMapHtml;