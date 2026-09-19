import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const TimeBasedHistoryScreen = ({ navigation }) => {
  const { theme } = useTheme();

  const [type, setType] = useState('time');

  const [pendingTasks, setPendingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);

  const [loading, setLoading] = useState(false);

  // =========================================================
  // FETCH TASK HISTORY
  // =========================================================

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        console.log('No token found');

        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });

        return;
      }

      const isTimeBased = type === 'time';

      const url =
        `${BASE_URL}/Task/history` +
        `?isTimeBased=${isTimeBased}`;

      console.log('Fetching task history:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.log('Invalid JSON response:', text);
      }

      console.log('Task history response:', data);

      // =====================================================
      // UNAUTHORIZED
      // =====================================================

      if (response.status === 401) {
        await AsyncStorage.removeItem('token');

        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });

        return;
      }

      // =====================================================
      // API ERROR
      // =====================================================

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.title ||
            'Failed to fetch task history'
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            'Failed to fetch task history'
        );
      }

      // =====================================================
      // GET HISTORY DATA
      // =====================================================

      const history = data?.data || {};

      const pending = Array.isArray(history.pending)
        ? history.pending
        : [];

      const done = Array.isArray(history.done)
        ? history.done
        : [];

      const upcoming = Array.isArray(history.upcoming)
        ? history.upcoming
        : [];

      // =====================================================
      // SET TASK LISTS
      // =====================================================

      setPendingTasks(pending);
      setCompletedTasks(done);
      setUpcomingTasks(upcoming);

      console.log('Pending:', pending.length);
      console.log('Done:', done.length);
      console.log('Upcoming/Today:', upcoming.length);
    } catch (error) {
      console.log('Error fetching history:', error);

      setPendingTasks([]);
      setCompletedTasks([]);
      setUpcomingTasks([]);

      Alert.alert(
        'Error',
        error?.message ||
          'Unable to load task history.'
      );
    } finally {
      setLoading(false);
    }
  }, [type, navigation]);

  // =========================================================
  // REFRESH WHEN SCREEN OPENS
  // =========================================================

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  // =========================================================
  // FORMAT DATE/TIME
  // =========================================================

  const formatDateTime = task => {
    if (!task?.dueDate && !task?.dueTime) {
      return '';
    }

    let result = '';

    if (task?.dueDate) {
      result += task.dueDate;
    }

    if (task?.dueTime) {
      result += ` ${task.dueTime}`;
    }

    return result.trim();
  };

  // =========================================================
  // TASK CARD
  // =========================================================

  const renderTaskCard = (
    item,
    index,
    iconName,
    iconColor,
    completed = false
  ) => {
    return (
      <View
        key={item?.id || item?.taskId || index}
        style={[
          styles.card,
          {
            backgroundColor:
              theme.card || '#FFFFFF',
            borderColor:
              theme.border ||
              'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <View
          style={[
            styles.cardAccentStrip,
            {
              backgroundColor: iconColor,
            },
          ]}
        />

        <View style={styles.taskContent}>
          <Text
            numberOfLines={2}
            style={[
              styles.taskTitle,
              {
                color:
                  theme.text || '#1E293B',
              },
              completed && styles.doneText,
            ]}
          >
            {item?.title || 'Untitled Task'}
          </Text>

          {formatDateTime(item) !== '' && (
            <View style={styles.timeBadgeContainer}>
              <Icon
                name="time-outline"
                size={12}
                color={
                  theme.subText ||
                  '#64748B'
                }
                style={styles.timeIcon}
              />

              <Text
                style={[
                  styles.subText,
                  {
                    color:
                      theme.subText ||
                      '#64748B',
                  },
                ]}
              >
                {formatDateTime(item)}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor:
                `${iconColor}15`,
            },
          ]}
        >
          <Icon
            name={iconName}
            size={completed ? 20 : 18}
            color={iconColor}
          />
        </View>
      </View>
    );
  };

  // =========================================================
  // RETURN UI
  // =========================================================

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg || '#F8FAFC',
        },
      ]}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor:
                theme.card || '#FFFFFF',
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon
            name="chevron-back"
            size={22}
            color={
              theme.text || '#0F172A'
            }
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            {
              backgroundColor:
                theme.headerBox ||
                '#FFFFFF',
            },
          ]}
        >
          <Text
            style={[
              styles.headerText,
              {
                color:
                  theme.text ||
                  '#0F172A',
              },
            ]}
          >
            Task History
          </Text>
        </View>

        <View
          style={styles.headerRightSpace}
        />
      </View>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* ===================================================
            TYPE TOGGLE
        ==================================================== */}

        <View
          style={[
            styles.toggleContainer,
            {
              backgroundColor:
                theme.headerBox ||
                '#E2E8F0',
            },
          ]}
        >
          {/* TIME BASED */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.toggleSegment,
              type === 'time' && [
                styles.activeSegment,
                {
                  backgroundColor:
                    theme.card ||
                    '#FFFFFF',
                },
              ],
            ]}
            onPress={() => {
              setType('time');
            }}
          >
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor:
                    type === 'time'
                      ? '#3B82F6'
                      : theme.text ||
                        '#94A3B8',
                },
              ]}
            >
              {type === 'time' && (
                <View
                  style={[
                    styles.radioInner,
                    {
                      backgroundColor:
                        '#3B82F6',
                    },
                  ]}
                />
              )}
            </View>

            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'time'
                      ? '#3B82F6'
                      : theme.text ||
                        '#64748B',
                  fontWeight:
                    type === 'time'
                      ? '700'
                      : '500',
                },
              ]}
            >
              Time Based
            </Text>
          </TouchableOpacity>

          {/* NON TIME BASED */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.toggleSegment,
              type === 'non' && [
                styles.activeSegment,
                {
                  backgroundColor:
                    theme.card ||
                    '#FFFFFF',
                },
              ],
            ]}
            onPress={() => {
              navigation.navigate(
                'NonTimeBasedHistoryScreen'
              );
            }}
          >
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor:
                    type === 'non'
                      ? '#3B82F6'
                      : theme.text ||
                        '#94A3B8',
                },
              ]}
            >
              {type === 'non' && (
                <View
                  style={[
                    styles.radioInner,
                    {
                      backgroundColor:
                        '#3B82F6',
                    },
                  ]}
                />
              )}
            </View>

            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'non'
                      ? '#3B82F6'
                      : theme.text ||
                        '#64748B',
                  fontWeight:
                    type === 'non'
                      ? '700'
                      : '500',
                },
              ]}
            >
              Non Time Based
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===================================================
            LOADING
        ==================================================== */}

        {loading && (
          <View
            style={
              styles.loaderContainer
            }
          >
            <ActivityIndicator
              size="large"
              color="#3B82F6"
            />
          </View>
        )}

        {/* ===================================================
            PENDING TASKS
        ==================================================== */}

        <View
          style={
            styles.sectionHeaderContainer
          }
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  theme.text ||
                  '#0F172A',
              },
            ]}
          >
            Pending
          </Text>

          <View
            style={styles.badgeCount}
          >
            <Text
              style={styles.badgeText}
            >
              {pendingTasks.length}
            </Text>
          </View>
        </View>

        {!loading &&
        pendingTasks.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Icon
              name="document-text-outline"
              size={24}
              color="#94A3B8"
            />

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.text ||
                    '#64748B',
                },
              ]}
            >
              No pending tasks available
            </Text>
          </View>
        ) : (
          pendingTasks.map(
            (item, index) =>
              renderTaskCard(
                item,
                index,
                'time-outline',
                '#F59E0B'
              )
          )
        )}

        {/* ===================================================
            COMPLETED TASKS
        ==================================================== */}

        <View
          style={
            styles.sectionHeaderContainer
          }
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  theme.text ||
                  '#0F172A',
              },
            ]}
          >
            Completed
          </Text>

          <View
            style={[
              styles.badgeCount,
              {
                backgroundColor:
                  '#E8F5E9',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: '#2E7D32',
                },
              ]}
            >
              {completedTasks.length}
            </Text>
          </View>
        </View>

        {!loading &&
        completedTasks.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Icon
              name="checkmark-done-outline"
              size={24}
              color="#94A3B8"
            />

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.text ||
                    '#64748B',
                },
              ]}
            >
              No completed tasks yet
            </Text>
          </View>
        ) : (
          completedTasks.map(
            (item, index) =>
              renderTaskCard(
                item,
                index,
                'checkmark-circle',
                '#10B981',
                true
              )
          )
        )}

        {/* ===================================================
            UPCOMING / TODAY TASKS
        ==================================================== */}

        <View
          style={
            styles.sectionHeaderContainer
          }
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  theme.text ||
                  '#0F172A',
              },
            ]}
          >
            Upcoming / Today
          </Text>

          <View
            style={[
              styles.badgeCount,
              {
                backgroundColor:
                  '#E0F2FE',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: '#0284C7',
                },
              ]}
            >
              {upcomingTasks.length}
            </Text>
          </View>
        </View>

        {!loading &&
        upcomingTasks.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Icon
              name="calendar-outline"
              size={24}
              color="#94A3B8"
            />

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.text ||
                    '#64748B',
                },
              ]}
            >
              No upcoming or today tasks
            </Text>
          </View>
        ) : (
          upcomingTasks.map(
            (item, index) =>
              renderTaskCard(
                item,
                index,
                'calendar-outline',
                '#3B82F6'
              )
          )
        )}
      </ScrollView>

      {/* =====================================================
          BOTTOM NAVIGATION
      ====================================================== */}

      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav ||
              '#1E293B',
          },
        ]}
      >
        {/* HOME */}

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'HomeDashboard'
            )
          }
        >
          <Icon
            name="home-outline"
            size={22}
            color="#94A3B8"
          />

          <Text
            style={styles.navLabel}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* CONTACTS */}

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'ContactScreen'
            )
          }
        >
          <Icon
            name="people-outline"
            size={22}
            color="#94A3B8"
          />

          <Text
            style={styles.navLabel}
          >
            Contacts
          </Text>
        </TouchableOpacity>

        {/* HISTORY */}

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <Icon
            name="time"
            size={22}
            color="#3B82F6"
          />

          <Text
            style={[
              styles.navLabel,
              styles.activeNavLabel,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        {/* SETTINGS */}

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'SettingScreen'
            )
          }
        >
          <Icon
            name="settings-outline"
            size={22}
            color="#94A3B8"
          />

          <Text
            style={styles.navLabel}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TimeBasedHistoryScreen;

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop:
      Platform.OS === 'android'
        ? StatusBar.currentHeight
        : 0,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // =======================================================
  // HEADER
  // =======================================================

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  headerRightSpace: {
    width: 40,
  },

  headerBox: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  headerText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // =======================================================
  // TOGGLE
  // =======================================================

  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    alignItems: 'center',
  },

  toggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },

  activeSegment: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  toggleText: {
    fontSize: 13,
  },

  // =======================================================
  // LOADING
  // =======================================================

  loaderContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // =======================================================
  // SECTIONS
  // =======================================================

  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  badgeCount: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },

  // =======================================================
  // TASK CARD
  // =======================================================

  card: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },

  cardAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  taskContent: {
    flex: 1,
    paddingLeft: 6,
    paddingRight: 12,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  doneText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },

  timeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  timeIcon: {
    marginRight: 4,
  },

  subText: {
    fontSize: 12,
    fontWeight: '500',
  },

  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyCard: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(148, 163, 184, 0.2)',
    borderStyle: 'dashed',
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },

  // =======================================================
  // BOTTOM NAVIGATION
  // =======================================================

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minWidth: 48,
  },

  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },

  activeNavLabel: {
    color: '#3B82F6',
    fontWeight: '700',
  },
});











































// import React, { useState, useCallback } from 'react';
// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ScrollView,
//   ActivityIndicator,
//   Alert,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useFocusEffect } from '@react-navigation/native';

// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';

// const TimeBasedHistoryScreen = ({ navigation }) => {
//   const { theme } = useTheme();

//   const [type, setType] = useState('time');
//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(false);

//   // =========================================================
//   // FETCH TIME-BASED HISTORY
//   // =========================================================
//   const fetchHistory = useCallback(async () => {
//     try {
//       setLoading(true);

//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         console.log('No token found');

//         navigation.reset({
//           index: 0,
//           routes: [{ name: 'Login' }],
//         });

//         return;
//       }

//       const isTimeBased = type === 'time';

//       const url =
//         `${BASE_URL}/Task/personal` +
//         `?tab=history` +
//         `&isTimeBased=${isTimeBased}`;

//       console.log('Fetching history:', url);

//       const response = await fetch(url, {
//         method: 'GET',
//         headers: {
//           Accept: 'application/json',
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const text = await response.text();

//       let data = {};

//       try {
//         data = text ? JSON.parse(text) : {};
//       } catch (parseError) {
//         console.log('Invalid JSON response:', text);
//       }

//       console.log('History response:', data);

//       if (response.status === 401) {
//         await AsyncStorage.removeItem('token');

//         navigation.reset({
//           index: 0,
//           routes: [{ name: 'Login' }],
//         });

//         return;
//       }

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             data?.title ||
//             'Failed to fetch task history'
//         );
//       }

//       /*
//        * Your API may return:
//        *
//        * {
//        *   success: true,
//        *   data: [...]
//        * }
//        *
//        * OR directly return an array.
//        */
//       let historyData = [];

//       if (Array.isArray(data)) {
//         historyData = data;
//       } else if (Array.isArray(data?.data)) {
//         historyData = data.data;
//       } else if (Array.isArray(data?.tasks)) {
//         historyData = data.tasks;
//       } else if (Array.isArray(data?.data?.tasks)) {
//         historyData = data.data.tasks;
//       }

//       setTasks(historyData);
//     } catch (error) {
//       console.log('Error fetching history:', error);

//       setTasks([]);

//       Alert.alert(
//         'Error',
//         error?.message || 'Unable to load task history.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [type, navigation]);

//   // =========================================================
//   // REFRESH WHEN SCREEN OPENS
//   // =========================================================
//   useFocusEffect(
//     useCallback(() => {
//       fetchHistory();
//     }, [fetchHistory])
//   );

//   // =========================================================
//   // FILTER TASKS
//   // =========================================================

//   const pendingTasks = tasks.filter(
//     task => !task?.isCompleted
//   );

//   const completedTasks = tasks.filter(
//     task => task?.isCompleted
//   );

//   const upcomingTasks = tasks.filter(task => {
//     if (!task?.dueDate || task?.isCompleted) {
//       return false;
//     }

//     const dueDate = new Date(task.dueDate);

//     if (Number.isNaN(dueDate.getTime())) {
//       return false;
//     }

//     return dueDate > new Date();
//   });

//   // =========================================================
//   // FORMAT DATE/TIME
//   // =========================================================

//   const formatDateTime = task => {
//     if (!task?.dueDate && !task?.dueTime) {
//       return '';
//     }

//     let result = '';

//     if (task?.dueDate) {
//       result += task.dueDate;
//     }

//     if (task?.dueTime) {
//       result += ` ${task.dueTime}`;
//     }

//     return result.trim();
//   };

//   // =========================================================
//   // TASK CARD
//   // =========================================================

//   const renderTaskCard = (
//     item,
//     index,
//     iconName,
//     iconColor,
//     completed = false
//   ) => {
//     return (
//       <View
//         key={item?.id || item?.taskId || index}
//         style={[
//           styles.card,
//           {
//             backgroundColor: theme.card,
//           },
//         ]}
//       >
//         <View style={styles.taskContent}>
//           <Text
//             numberOfLines={2}
//             style={[
//               styles.taskTitle,
//               {
//                 color: theme.text,
//               },
//               completed && styles.doneText,
//             ]}
//           >
//             {item?.title || 'Untitled Task'}
//           </Text>

//           {formatDateTime(item) !== '' && (
//             <Text
//               style={[
//                 styles.subText,
//                 {
//                   color: theme.text,
//                 },
//               ]}
//             >
//               {formatDateTime(item)}
//             </Text>
//           )}
//         </View>

//         <Icon
//           name={iconName}
//           size={completed ? 21 : 18}
//           color={iconColor}
//         />
//       </View>
//     );
//   };

//   // =========================================================
//   // UI
//   // =========================================================

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor: theme.bg,
//         },
//       ]}
//     >
//       {/* =====================================================
//           HEADER
//       ====================================================== */}
//       <View style={styles.header}>
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() => navigation.goBack()}
//         >
//           <Icon
//             name="arrow-back"
//             size={23}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor: theme.headerBox,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.headerText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             History
//           </Text>
//         </View>

//         <View style={styles.headerRightSpace} />
//       </View>

//       {/* =====================================================
//           CONTENT
//       ====================================================== */}
//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scrollContent}
//       >
//         {/* ===================================================
//             TYPE TOGGLE
//         ==================================================== */}
//         <View
//           style={[
//             styles.toggleBox,
//             {
//               backgroundColor: theme.headerBox,
//             },
//           ]}
//         >
//           {/* TIME BASED */}
//           <TouchableOpacity
//             activeOpacity={0.7}
//             style={[
//               styles.toggleItem,
//               type === 'time' && styles.activeToggle,
//             ]}
//             onPress={() => {
//               setType('time');
//             }}
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 {
//                   borderColor: theme.text,
//                 },
//               ]}
//             >
//               {type === 'time' && (
//                 <View style={styles.radioInner} />
//               )}
//             </View>

//             <Text
//               style={[
//                 styles.toggleText,
//                 {
//                   color: theme.text,
//                 },
//               ]}
//             >
//               Time Based
//             </Text>
//           </TouchableOpacity>

//           {/* NON TIME BASED */}
//           <TouchableOpacity
//             activeOpacity={0.7}
//             style={[
//               styles.toggleItem,
//               type === 'non' && styles.activeToggle,
//             ]}
//             onPress={() => {
//               navigation.navigate(
//                 'NonTimeBasedHistoryScreen'
//               );
//             }}
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 {
//                   borderColor: theme.text,
//                 },
//               ]}
//             >
//               {type === 'non' && (
//                 <View style={styles.radioInner} />
//               )}
//             </View>

//             <Text
//               style={[
//                 styles.toggleText,
//                 {
//                   color: theme.text,
//                 },
//               ]}
//             >
//               Non Time Based
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* ===================================================
//             LOADING
//         ==================================================== */}
//         {loading && (
//           <ActivityIndicator
//             size="large"
//             color={theme.text}
//             style={styles.loader}
//           />
//         )}

//         {/* ===================================================
//             PENDING TASKS
//         ==================================================== */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           PENDINGS:
//         </Text>

//         {!loading && pendingTasks.length === 0 ? (
//           <Text
//             style={[
//               styles.emptyText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             No pending tasks.
//           </Text>
//         ) : (
//           pendingTasks.map((item, index) =>
//             renderTaskCard(
//               item,
//               index,
//               'time-outline',
//               '#FF9800'
//             )
//           )
//         )}

//         {/* ===================================================
//             COMPLETED TASKS
//         ==================================================== */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           COMPLETED:
//         </Text>

//         {!loading && completedTasks.length === 0 ? (
//           <Text
//             style={[
//               styles.emptyText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             No completed tasks yet.
//           </Text>
//         ) : (
//           completedTasks.map((item, index) =>
//             renderTaskCard(
//               item,
//               index,
//               'checkmark-circle',
//               '#4CAF50',
//               true
//             )
//           )
//         )}

//         {/* ===================================================
//             UPCOMING TASKS
//         ==================================================== */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           UPCOMINGS:
//         </Text>

//         {!loading && upcomingTasks.length === 0 ? (
//           <Text
//             style={[
//               styles.emptyText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             No upcoming tasks.
//           </Text>
//         ) : (
//           upcomingTasks.map((item, index) =>
//             renderTaskCard(
//               item,
//               index,
//               'calendar-outline',
//               '#2196F3'
//             )
//           )
//         )}
//       </ScrollView>

//       {/* =====================================================
//           BOTTOM NAVIGATION
//       ====================================================== */}
//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor: theme.bottomNav,
//           },
//         ]}
//       >
//         {/* HOME */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('HomeDashboard')
//           }
//         >
//           <Icon
//             name="home"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         {/* CONTACTS */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('ContactScreen')
//           }
//         >
//           <Icon
//             name="people"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         {/* HISTORY */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => {}}
//         >
//           <Icon
//             name="time"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         {/* SETTINGS */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('SettingScreen')
//           }
//         >
//           <Icon
//             name="settings"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default TimeBasedHistoryScreen;

// // =========================================================
// // STYLES
// // =========================================================

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     paddingHorizontal: 14,
//   },

//   scrollContent: {
//     paddingBottom: 100,
//   },

//   // =======================================================
//   // HEADER
//   // =======================================================

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 10,
//     marginBottom: 12,
//   },

//   backButton: {
//     width: 30,
//     height: 35,
//     justifyContent: 'center',
//     alignItems: 'flex-start',
//   },

//   headerRightSpace: {
//     width: 30,
//   },

//   headerBox: {
//     paddingHorizontal: 18,
//     paddingVertical: 6,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontSize: 15,
//     fontWeight: '800',
//   },

//   // =======================================================
//   // TOGGLE
//   // =======================================================

//   toggleBox: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 10,
//     padding: 9,
//     marginBottom: 14,
//     elevation: 2,
//   },

//   toggleItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginHorizontal: 10,
//     paddingVertical: 3,
//   },

//   activeToggle: {
//     opacity: 1,
//   },

//   radioOuter: {
//     width: 16,
//     height: 16,
//     borderRadius: 8,
//     borderWidth: 2,
//     marginRight: 6,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   radioInner: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#000',
//   },

//   toggleText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },

//   // =======================================================
//   // LOADING
//   // =======================================================

//   loader: {
//     marginTop: 20,
//     marginBottom: 10,
//   },

//   // =======================================================
//   // SECTIONS
//   // =======================================================

//   section: {
//     fontSize: 14,
//     fontWeight: '800',
//     marginTop: 12,
//     marginBottom: 8,
//   },

//   // =======================================================
//   // TASK CARD
//   // =======================================================

//   card: {
//     borderRadius: 12,
//     paddingVertical: 14,
//     paddingHorizontal: 18,
//     marginBottom: 10,
//     elevation: 3,
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   taskContent: {
//     flex: 1,
//     paddingRight: 12,
//   },

//   taskTitle: {
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   doneText: {
//     textDecorationLine: 'line-through',
//   },

//   subText: {
//     fontSize: 11,
//     marginTop: 3,
//     opacity: 0.7,
//   },

//   emptyText: {
//     fontSize: 12,
//     opacity: 0.6,
//     marginBottom: 10,
//     marginLeft: 4,
//   },

//   // =======================================================
//   // BOTTOM NAVIGATION
//   // =======================================================

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     paddingHorizontal: 10,
//     elevation: 10,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: '100%',
//   },
// });
