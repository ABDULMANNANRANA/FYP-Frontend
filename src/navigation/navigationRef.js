import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Lets non-screen code (the geofence watcher, for example) navigate —
 * e.g. tapping "View Task" on an arrival alert.
 */
export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }

  return false;
};