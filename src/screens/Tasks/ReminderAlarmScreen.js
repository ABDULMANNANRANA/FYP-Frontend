import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { onTaskSnoozed } from '../../utils/reminderScheduler';

// ============================================================
// RESET TO LOGIN
// ============================================================
const goToLogin = navigation => {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'AuthStack',
        state: {
          routes: [{ name: 'Login' }],
        },
      },
    ],
  });
};

// ============================================================
// SMALL FORMATTERS (display only)
// ============================================================
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatDate = value => {
  if (!value) {
    return null;
  }

  const parts = String(value).split('-');

  if (parts.length !== 3) {
    return String(value);
  }

  const year = parts[0];
  const month = MONTHS[Number(parts[1]) - 1] || parts[1];
  const day = Number(parts[2]);

  return `${day} ${month} ${year}`;
};

// "09:30:00" / "09:30" -> "9:30 AM"
const formatTime12 = value => {
  if (!value) {
    return null;
  }

  const time = String(value).slice(0, 5);
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;

  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};

// ============================================================
// REMINDER ALARM SCREEN
//
// The popup shown for a SELF task:
//   * 30 minutes before the task time (isAdvance = true)
//   * at the task time               (isAdvance = false)
//
// Actions: MARK AS DONE / SNOOZE / DISMISS
// ============================================================
const ReminderAlarmScreen = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  const { task, isAdvance } = route?.params || {};

  const [loading, setLoading] = useState(false);

  // Dynamic Theme Colors
  const bgColor = theme?.bg || '#F4F6F9';
  const cardBg = theme?.card || '#FFFFFF';
  const textColor = theme?.text || '#0F172A';
  const subTextColor = isDark ? '#9CA3AF' : '#64748B';
  const navBg = theme?.bottomNav || '#0F172A';

  const taskTitle = task?.title || 'Task';
  const dueTime = formatTime12(task?.dueTime);
  const dueDate = formatDate(task?.dueDate);

  // ============================================================
  // GET JWT TOKEN
  // ============================================================
  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );
        return null;
      }

      return token;
    } catch (error) {
      console.log('Get Token Error:', error);
      return null;
    }
  };

  // ============================================================
  // MARK AS DONE
  //
  // POST /api/Task/{id}/done
  // ============================================================
  const handleMarkDone = async () => {
    if (!task?.id) {
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);

      const token = await getToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Task/${task.id}/done`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));
      console.log('Mark Done Response:', data);

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to complete task');
      }

      Alert.alert(
        '✅ Task Completed!',
        `"${taskTitle}" has been marked as done.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.log('Mark Done Error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SNOOZE
  //
  // POST /api/Task/{id}/snooze  { minutesToSnooze }
  //
  // The backend MOVES the task time forward by N minutes and the
  // reminder pops again at the new time.
  // ============================================================
  const doSnooze = async minutes => {
    if (!task?.id) {
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);

      const token = await getToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Task/${task.id}/snooze`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ minutesToSnooze: minutes }),
        }
      );

      const data = await response.json().catch(() => ({}));
      console.log('Snooze Response:', data);

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to snooze task');
      }

      // Let the scheduler show the alarm again at the NEW time.
      await onTaskSnoozed(task.id);

      Alert.alert(
        '⏰ Snoozed',
        `The task time has moved ${minutes} minutes. The reminder will show again at the new time.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.log('Snooze Error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = () => {
    Alert.alert(
      'Snooze Reminder',
      'Move the task time forward by how many minutes?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '5 min', onPress: () => doSnooze(5) },
        { text: '10 min', onPress: () => doSnooze(10) },
        { text: '15 min', onPress: () => doSnooze(15) },
      ]
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <StatusBar barStyle="light-content" backgroundColor="#B45309" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* ======================================================
            ALARM HERO
            ====================================================== */}
        <View
          style={[
            styles.alarmHero,
            {
              backgroundColor: isAdvance ? '#B45309' : '#B91C1C',
            },
          ]}
        >
          <View style={styles.alarmIconCircle}>
            <Icon
              name={isAdvance ? 'alarm-outline' : 'notifications-outline'}
              size={54}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.alarmHeadline}>
            {isAdvance ? '30 MINUTES LEFT' : "IT'S TIME"}
          </Text>

          <Text style={styles.alarmSub}>
            {isAdvance
              ? `Perform this task at ${dueTime || 'the due time'}`
              : 'Perform this task now'}
          </Text>
        </View>

        {/* ======================================================
            TASK CARD
            ====================================================== */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.taskTitle, { color: textColor }]}>
            {taskTitle}
          </Text>

          {task?.description ? (
            <Text style={[styles.taskDescription, { color: subTextColor }]}>
              {task.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Icon name="time-outline" size={17} color="#B45309" />
            <Text style={[styles.metaText, { color: subTextColor }]}>
              {dueDate ? `${dueDate}  •  ` : ''}
              {dueTime || 'No time set'}
            </Text>
          </View>

          {task?.createdByName ? (
            <View style={styles.metaRow}>
              <Icon name="person-outline" size={17} color={subTextColor} />
              <Text style={[styles.metaText, { color: subTextColor }]}>
                Created by: {task.createdByName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ======================================================
            ACTIONS
            ====================================================== */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleMarkDone}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.btnContent}>
              <Icon
                name="checkmark-circle-outline"
                size={20}
                color="#FFFFFF"
                style={styles.btnIcon}
              />
              <Text style={styles.primaryText}>MARK AS DONE</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.snoozeBtn, { backgroundColor: cardBg }]}
          onPress={handleSnooze}
          disabled={loading}
          activeOpacity={0.8}
        >
          <View style={styles.btnContent}>
            <Icon
              name="alarm-outline"
              size={20}
              color={textColor}
              style={styles.btnIcon}
            />
            <Text style={[styles.snoozeText, { color: textColor }]}>
              SNOOZE
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.dismissText, { color: subTextColor }]}>
            DISMISS
          </Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReminderAlarmScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },

  scrollContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },

  // ==================
  // ALARM HERO
  // ==================
  alarmHero: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 18,
  },

  alarmIconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  alarmHeadline: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },

  alarmSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
  },

  // ==================
  // TASK CARD
  // ==================
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },

  taskTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
  },

  taskDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },

  metaText: {
    fontSize: 13,
  },

  // ==================
  // BUTTONS
  // ==================
  primaryBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  snoozeBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  dismissBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnIcon: {
    marginRight: 8,
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  snoozeText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  btnDisabled: {
    opacity: 0.7,
  },
});