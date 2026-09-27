import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';

import { BASE_URL } from '../config/api';
import { navigate } from '../navigation/navigationRef';

// ============================================================
// SELF TASK REMINDER SCHEDULER
//
// For every SELF (personal) time-based task, the app pops
// ReminderAlarmScreen:
//
//   * 30 minutes BEFORE the due time  -> isAdvance = true
//   * AT the due time                 -> isAdvance = false
//
// Example: task time 3:00 PM  =>  popup at 2:30 PM.
//
// Two layers work together:
//
//   1. ForeGROUND watchdog (JS timer) - while the app is open it
//      navigates straight to ReminderAlarmScreen.
//
//   2. ForeGROUND/BACKground local notifications
//      (react-native-push-notification) - a heads-up notification
//      is delivered even when the app is backgrounded or killed;
//      tapping it opens the same ReminderAlarmScreen.
//
// Reminders are driven by the scheduler's OWN fetch of
// /Task/personal (time based), so they fire no matter which tab
// or toggle the user is looking at.
// ============================================================

const ADVANCE_MINUTES = 30; // popup this many minutes before the task
const DUE_GRACE_MINUTES = 15; // still pop "it's time" if we were late
const REFRESH_MS = 5 * 60 * 1000; // refetch tasks every 5 minutes
const WATCHDOG_MS = 20 * 1000; // check the clock every 20 seconds

const CHANNEL_ID = 'task-reminders';
const FIRED_KEY = '@reminder_fired_v1';

// ============================================================
// MODULE STATE
// ============================================================
let firedMap = null; // { [taskId]: { advance: ts, due: ts } }
let firedLoaded = false;
let refreshTimer = null;
let watchdogTimer = null;
let cachedTasks = [];
let configured = false;

// ============================================================
// HELPERS
// ============================================================
const isFinished = task =>
  Boolean(task?.isCompleted) ||
  ['done', 'completed'].includes(
    String(task?.status || '').toLowerCase()
  );

// "2026-09-27" + "14:30" | "14:30:00" -> Date
const dueDateOf = task => {
  if (!task?.dueDate || !task?.dueTime) {
    return null;
  }

  const time = String(task.dueTime).slice(0, 5);
  const date = new Date(`${task.dueDate}T${time}:00`);

  return isNaN(date.getTime()) ? null : date;
};

// Small JSON-safe copy to pass through notification payloads.
const slimTask = task => ({
  id: task.id,
  title: task.title,
  description: task.description,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  isTimeBased: task.isTimeBased,
  status: task.status,
  isCompleted: task.isCompleted,
  createdByName: task.createdByName,
});

const formatTime12 = (date, task) => {
  const time = String(task?.dueTime || '').slice(0, 5);
  if (!time) {
    return '';
  }

  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};

// ============================================================
// FIRED-GUARD (persisted so an app restart does not re-pop)
// ============================================================
const loadFired = async () => {
  if (firedLoaded) {
    return firedMap || {};
  }

  try {
    const raw = await AsyncStorage.getItem(FIRED_KEY);
    firedMap = raw ? JSON.parse(raw) : {};

    // Forget very old entries (keep the storage small).
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    Object.keys(firedMap).forEach(id => {
      const entry = firedMap[id] || {};
      if ((entry.advance || 0) < cutoff && (entry.due || 0) < cutoff) {
        delete firedMap[id];
      }
    });
  } catch (error) {
    console.log('Reminder fired-map load error:', error);
    firedMap = {};
  }

  firedLoaded = true;
  return firedMap;
};

const saveFired = async () => {
  try {
    await AsyncStorage.setItem(FIRED_KEY, JSON.stringify(firedMap || {}));
  } catch (error) {
    console.log('Reminder fired-map save error:', error);
  }
};

const hasFired = async (taskId, kind) => {
  const map = await loadFired();
  return Boolean(map[taskId] && map[taskId][kind]);
};

const markFired = async (taskId, kind) => {
  const map = await loadFired();
  map[taskId] = map[taskId] || {};
  map[taskId][kind] = Date.now();
  await saveFired();
};

// ============================================================
// PUBLIC: call after the backend snoozes (moves) a task so the
// "it's time" popup can fire again at the NEW due time.
// ============================================================
export const onTaskSnoozed = async taskId => {
  const map = await loadFired();

  if (map[taskId]) {
    delete map[taskId].due;
    await saveFired();
  }
};

// ============================================================
// NOTIFICATION LAYER (react-native-push-notification)
// ============================================================
const ensureConfigured = () => {
  if (configured) {
    return;
  }
  configured = true;

  try {
    PushNotification.configure({
      // Android 8+ channel
      onRegister: function () {},

      onNotification: function (notification) {
        const data = notification?.data || notification || {};

        // The user TAPPED the notification -> open the alarm screen.
        if (notification?.userInteraction) {
          let task = data.task;
          if (typeof task === 'string') {
            try {
              task = JSON.parse(task);
            } catch (error) {
              task = null;
            }
          }

          const isAdvance =
            data.isAdvance === true ||
            data.isAdvance === 'true';

          if (task?.id) {
            navigate('ReminderAlarmScreen', { task, isAdvance });
          }
        }
      },

      onRegistrationError: function (error) {
        console.log('Reminder notification registration:', error);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: false,
    });

    PushNotification.createChannel({
      channelId: CHANNEL_ID,
      channelName: 'Task Reminders',
      channelDescription: 'Reminders 30 minutes before a task and at task time',
      importance: 4,
      vibrate: true,
    });

    // Android 13+ needs a runtime permission to show notifications.
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      ).catch(() => {});
    }
  } catch (error) {
    console.log('Reminder notification setup error:', error);
  }
};

const scheduleNotifications = tasks => {
  ensureConfigured();

  try {
    PushNotification.cancelAllLocalNotifications();
  } catch (error) {
    console.log('Reminder cancel error:', error);
    return;
  }

  const now = Date.now();

  tasks.forEach(task => {
    if (!task?.id || !task?.isTimeBased || isFinished(task)) {
      return;
    }

    const dueAt = dueDateOf(task);
    if (!dueAt) {
      return;
    }

    const time = formatTime12(dueAt, task);
    const title = task.title || 'Task';

    // ---- 30 minutes BEFORE ----
    const advanceAt = new Date(dueAt.getTime() - ADVANCE_MINUTES * 60000);
    if (advanceAt.getTime() > now) {
      try {
        PushNotification.localNotificationSchedule({
          id: Number(task.id) * 10 + 1,
          channelId: CHANNEL_ID,
          title: '⏰ Task Reminder',
          message: `"${title}" is due at ${time}. Perform this task in 30 minutes.`,
          date: advanceAt,
          allowWhileIdle: true,
          playSound: true,
          soundName: 'default',
          userInfo: {
            screen: 'ReminderAlarmScreen',
            task: slimTask(task),
            isAdvance: true,
          },
        });
      } catch (error) {
        console.log('Reminder schedule (advance) error:', error);
      }
    }

    // ---- AT the task time ----
    if (dueAt.getTime() > now) {
      try {
        PushNotification.localNotificationSchedule({
          id: Number(task.id) * 10 + 2,
          channelId: CHANNEL_ID,
          title: '🔔 Task Time!',
          message: `It's time to perform "${title}"!`,
          date: dueAt,
          allowWhileIdle: true,
          playSound: true,
          soundName: 'default',
          userInfo: {
            screen: 'ReminderAlarmScreen',
            task: slimTask(task),
            isAdvance: false,
          },
        });
      } catch (error) {
        console.log('Reminder schedule (due) error:', error);
      }
    }
  });
};

// ============================================================
// DATA LAYER - the scheduler owns its own task list
// ============================================================
const fetchSelfTimeTasks = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return;
    }

    const response = await fetch(
      `${BASE_URL}/Task/personal?tab=&isTimeBased=true`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 || !response.ok) {
      return;
    }

    const data = await response.json();
    const list = Array.isArray(data?.data) ? data.data : [];

    cachedTasks = list;

    // (Re)plan the background notifications on every refresh.
    scheduleNotifications(list);
  } catch (error) {
    console.log('Reminder fetch error:', error);
  }
};

// ============================================================
// WATCHDOG - pops the alarm screen while the app is open
// ============================================================
const tick = async () => {
  const now = Date.now();

  for (const task of cachedTasks) {
    if (!task?.id || !task?.isTimeBased || isFinished(task)) {
      continue;
    }

    const dueAt = dueDateOf(task);
    if (!dueAt) {
      continue;
    }

    const diff = dueAt.getTime() - now;

    // ---- 30 minutes BEFORE the task ----
    if (
      diff >= 0 &&
      diff <= ADVANCE_MINUTES * 60000 &&
      !(await hasFired(task.id, 'advance'))
    ) {
      await markFired(task.id, 'advance');
      navigate('ReminderAlarmScreen', { task, isAdvance: true });
      return; // one popup per tick
    }

    // ---- AT (or just after) the task time ----
    if (
      diff < 0 &&
      -diff <= DUE_GRACE_MINUTES * 60000 &&
      !(await hasFired(task.id, 'due'))
    ) {
      await markFired(task.id, 'due');
      navigate('ReminderAlarmScreen', { task, isAdvance: false });
      return;
    }
  }
};

// ============================================================
// PUBLIC: start everything (call once from HomeDashboard)
// ============================================================
export const startSelfTaskReminders = () => {
  ensureConfigured();

  // First run immediately, then keep everything fresh.
  fetchSelfTimeTasks().then(() => tick());

  refreshTimer = setInterval(fetchSelfTimeTasks, REFRESH_MS);
  watchdogTimer = setInterval(tick, WATCHDOG_MS);

  // Cleanup (HomeDashboard unmount).
  return () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  };
};