import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

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

const ClashTaskScreen = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  const [t1, setT1] = useState(route?.params?.task1 || {});
  const [t2, setT2] = useState(route?.params?.task2 || {});
  const [loadingClash, setLoadingClash] = useState(
    !route?.params?.task1 || !route?.params?.task2,
  );

  const [task1Checked, setTask1Checked] = useState(false);
  const [task2Checked, setTask2Checked] = useState(false);
  const [resolving, setResolving] = useState(false);

  // ============================================================
  // FETCH CLASHING TASKS
  // ============================================================
  const fetchClashes = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      const response = await fetch(`${BASE_URL}/Task/clashes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please login again.', [
            { text: 'OK', onPress: () => goToLogin(navigation) },
          ]);
          return;
        }
        throw new Error(data?.message || 'Failed to load clashing tasks.');
      }

      const firstGroup = Array.isArray(data) ? data[0] : null;
      const clashTasks = firstGroup?.tasks || [];

      if (clashTasks.length < 2) {
        Alert.alert('No Clashes', 'There are no clashing tasks right now.', [
          { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
        ]);
        return;
      }

      setT1(clashTasks[0]);
      setT2(clashTasks[1]);
    } catch (err) {
      console.log('Error fetching clashes:', err);
      Alert.alert('Error', err?.message || 'Failed to load clashing tasks.');
    } finally {
      setLoadingClash(false);
    }
  }, [navigation]);

  useEffect(() => {
    if (!route?.params?.task1 || !route?.params?.task2) {
      fetchClashes();
    }
  }, [route?.params?.task1, route?.params?.task2, fetchClashes]);

  // ============================================================
  // MARK TASK AS DONE
  // ============================================================
  const markTaskDone = async (taskId, token) => {
    if (!taskId) {
      throw new Error('Task ID is missing.');
    }

    const response = await fetch(`${BASE_URL}/Task/${taskId}/done`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    console.log(`Mark Task ${taskId} Done Response:`, data);

    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error('Session expired. Please login again.');
        error.status = 401;
        throw error;
      }
      const error = new Error(
        data?.message || `Failed to mark task as done. (${response.status})`,
      );
      error.status = response.status;
      throw error;
    }

    return data || { success: true };
  };

  // ============================================================
  // MARK SELECTED TASK(S) AS DONE
  // ============================================================
  const resolveClash = async () => {
    if (!task1Checked && !task2Checked) {
      Alert.alert('Select a Task', 'Please select at least one task to resolve.');
      return;
    }

    if ((task1Checked && !t1.id) || (task2Checked && !t2.id)) {
      Alert.alert(
        'Error',
        'One of the selected tasks is missing an ID and cannot be resolved.',
      );
      return;
    }

    try {
      setResolving(true);

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      if (task1Checked) {
        await markTaskDone(t1.id, token);
      }

      if (task2Checked) {
        await markTaskDone(t2.id, token);
      }

      const resolvedNames = [task1Checked && t1.title, task2Checked && t2.title]
        .filter(Boolean)
        .join(' & ');

      Alert.alert('✅ Clash Resolved!', `"${resolvedNames}" marked as done.`, [
        { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
      ]);
    } catch (err) {
      console.log('Error resolving clash:', err);

      if (err?.status === 401) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
      } else {
        Alert.alert('Error', err?.message || 'Failed to resolve tasks.');
      }
    } finally {
      setResolving(false);
    }
  };

  // ============================================================
  // MARK BOTH TASKS AS DONE
  // ============================================================
  const markBothDone = async () => {
    if (!t1.id || !t2.id) {
      Alert.alert('Error', 'Both tasks must have a valid ID to resolve.');
      return;
    }

    try {
      setResolving(true);

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      await markTaskDone(t1.id, token);
      await markTaskDone(t2.id, token);

      setTask1Checked(true);
      setTask2Checked(true);

      Alert.alert('✅ Both Tasks Resolved!', 'Both clashing tasks marked as done.', [
        { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
      ]);
    } catch (err) {
      console.log('Error marking both tasks done:', err);

      if (err?.status === 401) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
      } else {
        Alert.alert('Error', err?.message || 'Failed to resolve tasks.');
      }
    } finally {
      setResolving(false);
    }
  };

  // ============================================================
  // TASK CARD COMPONENT
  // ============================================================
  const renderTaskCard = (task, checked, setChecked) => (
    <TouchableOpacity
      style={[
        styles.taskCard,
        {
          backgroundColor: isDark
            ? checked
              ? '#1E293B'
              : '#0F172A'
            : checked
            ? '#F0FDF4'
            : '#FFFFFF',
          borderColor: checked
            ? '#22C55E'
            : isDark
            ? '#334155'
            : '#E2E8F0',
        },
        checked && styles.taskCardChecked,
      ]}
      onPress={() => setChecked(!checked)}
      activeOpacity={0.8}
      disabled={resolving}
    >
      <View style={styles.taskCardLeft}>
        <View
          style={[
            styles.clockCircle,
            {
              backgroundColor: checked
                ? '#DCFCE7'
                : isDark
                ? '#1E293B'
                : '#E0F2FE',
            },
          ]}
        >
          <Icon
            name="time-outline"
            size={20}
            color={checked ? '#16A34A' : '#0284C7'}
          />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={[
              styles.taskTitle,
              { color: theme?.text || (isDark ? '#F8FAFC' : '#0F172A') },
            ]}
            numberOfLines={2}
          >
            {task.title || 'Unknown Task'}
          </Text>

          <View style={styles.timeBadgeRow}>
            <Icon
              name="calendar-outline"
              size={12}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.taskTime,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {task.dueDate
                ? `${task.dueDate} ${task.dueTime || ''}`
                : 'No Due Date'}
            </Text>
          </View>

          {task.groupName ? (
            <View style={styles.groupBadgeRow}>
              <Icon
                name="people-outline"
                size={12}
                color={isDark ? '#38BDF8' : '#0284C7'}
              />
              <Text
                style={[
                  styles.taskGroup,
                  { color: isDark ? '#38BDF8' : '#0284C7' },
                ]}
                numberOfLines={1}
              >
                {task.groupName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked
              ? '#22C55E'
              : isDark
              ? '#64748B'
              : '#94A3B8',
          },
          checked && styles.checkboxChecked,
        ]}
      >
        {checked && <Icon name="checkmark-bold" size={14} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );

  // ============================================================
  // UI RENDER
  // ============================================================
  if (loadingClash) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme?.bg || (isDark ? '#0F172A' : '#F4F7FB'),
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <StatusBar
          backgroundColor={theme?.bg || (isDark ? '#0F172A' : '#F4F7FB')}
          barStyle={isDark ? 'light-content' : 'dark-content'}
        />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text
          style={{
            marginTop: 12,
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#94A3B8' : '#64748B',
          }}
        >
          Detecting schedule clashes...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme?.bg || (isDark ? '#0F172A' : '#F4F7FB') },
      ]}
    >
      <StatusBar
        backgroundColor={theme?.bg || (isDark ? '#0F172A' : '#F4F7FB')}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* HEADER */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            disabled={resolving}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerBox}>
            <Icon name="warning-outline" size={16} color="#EF4444" />
            <Text style={styles.headerText}>SCHEDULE CLASH</Text>
          </View>

          <TouchableOpacity
            style={styles.bellWrap}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Icon name="notifications-outline" size={20} color="#FFFFFF" />
            <View style={styles.dot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* WARNING BANNER */}
        <View style={styles.warningBanner}>
          <View style={styles.warningIconBg}>
            <Icon name="alert-circle" size={22} color="#EF4444" />
          </View>
          <Text style={styles.warningText}>
            These tasks are scheduled at the exact same time and require your resolution!
          </Text>
        </View>

        {/* TIME STAMP CHIP */}
        <View style={styles.clashChipWrapper}>
          <View
            style={[
              styles.clashBadge,
              {
                backgroundColor: isDark ? '#1E293B' : '#FEF2F2',
                borderColor: '#FCA5A5',
              },
            ]}
          >
            <Icon name="time" size={14} color="#EF4444" />
            <Text
              style={[
                styles.clashLabel,
                { color: isDark ? '#FCA5A5' : '#991B1B' },
              ]}
            >
              Clash Time: {t1.dueDate || 'N/A'} {t1.dueTime || ''}
            </Text>
          </View>
        </View>

        {/* TASK 1 */}
        {renderTaskCard(t1, task1Checked, setTask1Checked)}

        {/* VS DIVIDER */}
        <View style={styles.vsWrap}>
          <View
            style={[
              styles.vsLine,
              { backgroundColor: isDark ? '#334155' : '#CBD5E1' },
            ]}
          />
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View
            style={[
              styles.vsLine,
              { backgroundColor: isDark ? '#334155' : '#CBD5E1' },
            ]}
          />
        </View>

        {/* TASK 2 */}
        {renderTaskCard(t2, task2Checked, setTask2Checked)}

        {/* INSTRUCTION HINT */}
        <Text
          style={[
            styles.hint,
            { color: isDark ? '#94A3B8' : '#64748B' },
          ]}
        >
          Tap a task card to select it, then choose your resolution strategy below.
        </Text>

        {/* ACTION BUTTONS */}
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryBtn,
              resolving && styles.buttonDisabled,
            ]}
            onPress={resolveClash}
            disabled={resolving}
            activeOpacity={0.8}
          >
            {resolving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <Icon name="checkmark-done-circle" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>RESOLVE SELECTED</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.dangerBtn,
              resolving && styles.buttonDisabled,
            ]}
            onPress={markBothDone}
            disabled={resolving}
            activeOpacity={0.8}
          >
            {resolving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <Icon name="double-checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>MARK BOTH AS DONE</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryBtn]}
            onPress={() => navigation.goBack()}
            disabled={resolving}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: isDark ? '#CBD5E1' : '#475569' },
              ]}
            >
              DISMISS
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FLOATING BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme?.bottomNav || (isDark ? '#0F172A' : '#1E293B'),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Icon name="grid-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('AddMember')}
          activeOpacity={0.7}
        >
          <Icon name="person-add-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Add Member</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ClashTaskScreen;

// ============================================================
// STYLESHEET
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header Styles
  headerWrapper: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
    paddingBottom: 8,
  },
  headerBar: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 6,
  },
  headerText: {
    fontWeight: '800',
    letterSpacing: 0.8,
    fontSize: 12,
    color: '#EF4444',
  },
  bellWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },

  // Scroll Container
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 110, // Avoid bottom nav overlap
  },

  // Warning Banner
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 12,
  },
  warningIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningText: {
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // Clash Chip
  clashChipWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  clashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  clashLabel: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },

  // Task Cards
  taskCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 2,
  },
  taskCardChecked: {
    elevation: 6,
    shadowColor: '#22C55E',
    shadowOpacity: 0.2,
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  taskTitle: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  taskTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  taskGroup: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Checkbox
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 8,
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  // VS Divider
  vsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  vsLine: {
    flex: 1,
    height: 1,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    elevation: 2,
  },
  vsText: {
    fontWeight: '900',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Hint
  hint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
    lineHeight: 18,
  },

  // Buttons
  actionGroup: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    minHeight: 50,
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
  },
  dangerBtn: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    marginTop: 10,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.6,
    fontSize: 13,
  },
  secondaryButtonText: {
    fontWeight: '700',
    letterSpacing: 0.6,
    fontSize: 13,
  },

  // Bottom Navigation
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 3,
  },
});































// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   SafeAreaView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   Alert,
//   ScrollView,
//   ActivityIndicator,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';

// const goToLogin = navigation => {
//   navigation.reset({
//     index: 0,
//     routes: [
//       {
//         name: 'AuthStack',
//         state: {
//           routes: [{ name: 'Login' }],
//         },
//       },
//     ],
//   });
// };

// const ClashTaskScreen = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   const [t1, setT1] = useState(route?.params?.task1 || {});
//   const [t2, setT2] = useState(route?.params?.task2 || {});
//   const [loadingClash, setLoadingClash] = useState(
//     !route?.params?.task1 || !route?.params?.task2
//   );

//   const [task1Checked, setTask1Checked] = useState(false);
//   const [task2Checked, setTask2Checked] = useState(false);
//   const [resolving, setResolving] = useState(false);

//   // ============================================================
//   // FETCH CLASHING TASKS
//   // Only needed when the screen wasn't navigated to with
//   // task1/task2 already in params (e.g. deep link, or a
//   // "Clashes" list screen that just says "open the clash screen").
//   // ============================================================
//   const fetchClashes = useCallback(async () => {
//     try {
//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//         return;
//       }

//       const response = await fetch(`${BASE_URL}/Task/clashes`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await response.json().catch(() => null);

//       if (!response.ok) {
//         if (response.status === 401) {
//           Alert.alert('Session Expired', 'Please login again.', [
//             { text: 'OK', onPress: () => goToLogin(navigation) },
//           ]);
//           return;
//         }
//         throw new Error(data?.message || 'Failed to load clashing tasks.');
//       }

//       const firstGroup = Array.isArray(data) ? data[0] : null;
//       const clashTasks = firstGroup?.tasks || [];

//       if (clashTasks.length < 2) {
//         Alert.alert('No Clashes', 'There are no clashing tasks right now.', [
//           { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
//         ]);
//         return;
//       }

//       setT1(clashTasks[0]);
//       setT2(clashTasks[1]);
//     } catch (err) {
//       console.log('Error fetching clashes:', err);
//       Alert.alert('Error', err?.message || 'Failed to load clashing tasks.');
//     } finally {
//       setLoadingClash(false);
//     }
//   }, [navigation]);

//   useEffect(() => {
//     if (!route?.params?.task1 || !route?.params?.task2) {
//       fetchClashes();
//     }
//   }, [route?.params?.task1, route?.params?.task2, fetchClashes]);

//   // ============================================================
//   // MARK TASK AS DONE
//   // ============================================================
//   const markTaskDone = async (taskId, token) => {
//     if (!taskId) {
//       throw new Error('Task ID is missing.');
//     }

//     const response = await fetch(`${BASE_URL}/Task/${taskId}/done`, {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     });

//     let data = null;
//     try {
//       data = await response.json();
//     } catch (e) {
//       data = null;
//     }

//     console.log(`Mark Task ${taskId} Done Response:`, data);

//     if (!response.ok) {
//       if (response.status === 401) {
//         const error = new Error('Session expired. Please login again.');
//         error.status = 401;
//         throw error;
//       }
//       const error = new Error(
//         data?.message || `Failed to mark task as done. (${response.status})`
//       );
//       error.status = response.status;
//       throw error;
//     }

//     return data || { success: true };
//   };

//   // ============================================================
//   // MARK SELECTED TASK(S) AS DONE
//   // ============================================================
//   const resolveClash = async () => {
//     if (!task1Checked && !task2Checked) {
//       Alert.alert('Select a Task', 'Please select at least one task to resolve.');
//       return;
//     }

//     // Guard: don't claim success for a checked task that has no id.
//     if ((task1Checked && !t1.id) || (task2Checked && !t2.id)) {
//       Alert.alert('Error', 'One of the selected tasks is missing an ID and cannot be resolved.');
//       return;
//     }

//     try {
//       setResolving(true);

//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//         return;
//       }

//       if (task1Checked) {
//         await markTaskDone(t1.id, token);
//       }

//       if (task2Checked) {
//         await markTaskDone(t2.id, token);
//       }

//       const resolvedNames = [task1Checked && t1.title, task2Checked && t2.title]
//         .filter(Boolean)
//         .join(' & ');

//       Alert.alert('✅ Clash Resolved!', `"${resolvedNames}" marked as done.`, [
//         { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
//       ]);
//     } catch (err) {
//       console.log('Error resolving clash:', err);

//       if (err?.status === 401) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//       } else {
//         Alert.alert('Error', err?.message || 'Failed to resolve tasks.');
//       }
//     } finally {
//       setResolving(false);
//     }
//   };

//   // ============================================================
//   // MARK BOTH TASKS AS DONE
//   // ============================================================
//   const markBothDone = async () => {
//     if (!t1.id || !t2.id) {
//       Alert.alert('Error', 'Both tasks must have a valid ID to resolve.');
//       return;
//     }

//     try {
//       setResolving(true);

//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//         return;
//       }

//       await markTaskDone(t1.id, token);
//       await markTaskDone(t2.id, token);

//       setTask1Checked(true);
//       setTask2Checked(true);

//       Alert.alert('✅ Both Tasks Resolved!', 'Both clashing tasks marked as done.', [
//         { text: 'OK', onPress: () => navigation.navigate('HomeDashboard') },
//       ]);
//     } catch (err) {
//       console.log('Error marking both tasks done:', err);

//       if (err?.status === 401) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//       } else {
//         Alert.alert('Error', err?.message || 'Failed to resolve tasks.');
//       }
//     } finally {
//       setResolving(false);
//     }
//   };

//   // ============================================================
//   // TASK CARD
//   // ============================================================
//   const renderTaskCard = (task, checked, setChecked) => (
//     <TouchableOpacity
//       style={[styles.taskCard, checked && styles.taskCardChecked]}
//       onPress={() => setChecked(!checked)}
//       activeOpacity={0.85}
//       disabled={resolving}
//     >
//       <View style={styles.taskCardLeft}>
//         <View style={styles.clockCircle}>
//           <Icon name="time-outline" size={20} color="#000" />
//         </View>

//         <View style={{ flex: 1 }}>
//           <Text style={styles.taskTitle}>{task.title || 'Unknown Task'}</Text>

//           <Text style={styles.taskTime}>
//             {task.dueDate ? `${task.dueDate} ${task.dueTime || ''}` : 'No Due Date'}
//           </Text>

//           {task.groupName && <Text style={styles.taskGroup}>Group: {task.groupName}</Text>}
//         </View>
//       </View>

//       <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
//         {checked && <Icon name="checkmark" size={14} color="#fff" />}
//       </View>
//     </TouchableOpacity>
//   );

//   // ============================================================
//   // UI
//   // ============================================================
//   if (loadingClash) {
//     return (
//       <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
//         <ActivityIndicator size="large" color="#000" />
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <StatusBar backgroundColor="#B7C9DB" barStyle="dark-content" />

//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()} disabled={resolving}>
//           <Icon name="arrow-back" size={22} color={theme.text} />
//         </TouchableOpacity>

//         <View style={[styles.headerBox, { backgroundColor: theme.headerBox }]}>
//           <Text style={[styles.headerText, { color: theme.text }]}>⚠️ CLASH</Text>
//         </View>

//         <View style={styles.bellWrap}>
//           <Icon name="notifications-outline" size={22} color={theme.text} />
//           <View style={styles.dot} />
//         </View>
//       </View>

//       <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
//         <View style={styles.warningBanner}>
//           <Icon name="warning" size={20} color="#fff" />
//           <Text style={styles.warningText}>
//             These tasks are scheduled at the same time and are clashing!
//           </Text>
//         </View>

//         <Text style={[styles.clashLabel, { color: theme.text }]}>
//           Clash Time: {t1.dueDate || 'N/A'} {t1.dueTime || ''}
//         </Text>

//         {renderTaskCard(t1, task1Checked, setTask1Checked)}

//         <View style={styles.vsWrap}>
//           <View style={styles.vsLine} />
//           <Text style={[styles.vsText, { color: theme.text }]}>VS</Text>
//           <View style={styles.vsLine} />
//         </View>

//         {renderTaskCard(t2, task2Checked, setTask2Checked)}

//         <Text style={[styles.hint, { color: theme.text }]}>
//           Tap a task to select it, then choose how to resolve the clash.
//         </Text>

//         <TouchableOpacity
//           style={[styles.button, { backgroundColor: '#000' }, resolving && styles.buttonDisabled]}
//           onPress={resolveClash}
//           disabled={resolving}
//         >
//           {resolving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>RESOLVE SELECTED</Text>}
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[styles.button, { backgroundColor: '#E52323', marginTop: 12 }, resolving && styles.buttonDisabled]}
//           onPress={markBothDone}
//           disabled={resolving}
//         >
//           {resolving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>MARK BOTH AS DONE</Text>}
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[styles.button, { backgroundColor: '#555', marginTop: 12 }]}
//           onPress={() => navigation.goBack()}
//           disabled={resolving}
//         >
//           <Text style={styles.buttonText}>DISMISS</Text>
//         </TouchableOpacity>
//       </ScrollView>

//       <View style={[styles.bottom, { backgroundColor: theme.bottomNav }]}>
//         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('HomeDashboard')}>
//           <Icon name="home" size={24} color="#fff" />
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddMember')}>
//           <Icon name="person-add" size={24} color="#fff" />
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('TimeBasedHistoryScreen')}>
//           <Icon name="time" size={24} color="#fff" />
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SettingScreen')}>
//           <Icon name="settings" size={24} color="#fff" />
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default ClashTaskScreen;

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#B7C9DB', paddingHorizontal: 14 },
//   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 },
//   headerBox: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 10, elevation: 3 },
//   headerText: { fontWeight: '800', letterSpacing: 1 },
//   bellWrap: { position: 'relative' },
//   dot: { position: 'absolute', right: 0, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5C5C' },
//   warningBanner: { backgroundColor: '#E52323', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
//   warningText: { color: '#fff', fontWeight: '600', flex: 1, fontSize: 13 },
//   clashLabel: { fontWeight: '700', textAlign: 'center', marginBottom: 16, fontSize: 13 },
//   taskCard: { backgroundColor: '#EDEDED', borderRadius: 14, padding: 16, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5, borderWidth: 2, borderColor: 'transparent' },
//   taskCardChecked: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
//   taskCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
//   clockCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6ED3E8', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
//   taskTitle: { fontWeight: '800', color: '#000', fontSize: 14 },
//   taskTime: { fontSize: 11, marginTop: 4, color: '#444' },
//   taskGroup: { fontSize: 10, marginTop: 2, color: '#666' },
//   checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#666', justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
//   checkboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
//   vsWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
//   vsLine: { flex: 1, height: 1, backgroundColor: '#999' },
//   vsText: { fontWeight: '800', fontSize: 16, marginHorizontal: 12 },
//   hint: { textAlign: 'center', fontSize: 12, opacity: 0.7, marginBottom: 20 },
//   button: { alignSelf: 'center', width: '80%', paddingVertical: 14, borderRadius: 30, alignItems: 'center', elevation: 6 },
//   buttonDisabled: { opacity: 0.6 },
//   buttonText: { color: '#fff', fontWeight: '800', letterSpacing: 1, fontSize: 13 },
//   bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 65, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, elevation: 10 },
//   iconBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
// });
