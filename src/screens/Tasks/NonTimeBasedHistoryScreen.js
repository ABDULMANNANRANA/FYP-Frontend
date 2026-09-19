import React, { useState, useCallback } from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../../config/api';

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

const NonTimeBasedHistoryScreen = ({ navigation }) => {
  const { isDark, theme } = useTheme();

  const [type, setType] = useState('non');

  const [pendingTasks, setPendingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);

  const [loading, setLoading] = useState(false);

  const statusBarBg =
    theme.headerBox || (isDark ? '#1F2937' : '#FFFFFF');

  const primaryTextColor =
    theme.text || (isDark ? '#F9FAFB' : '#111827');

  const secondaryTextColor =
    isDark ? '#9CA3AF' : '#6B7280';

  const cardBg =
    theme.card || (isDark ? '#1F2937' : '#FFFFFF');

  const activeToggleBg =
    isDark ? '#374151' : '#FFFFFF';

  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ],
        );

        return null;
      }

      return token;
    } catch (error) {
      console.log('Get Token Error:', error);

      Alert.alert(
        'Error',
        'Unable to read your login session.',
      );

      return null;
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        return;
      }

      const isTimeBased = type === 'time';

      const query = `/Task/history?isTimeBased=${isTimeBased}`;

      const url = `${BASE_URL}${query}`;

      console.log('Fetching Task History:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      let data = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch (parseError) {
        console.log(
          'History JSON Parse Error:',
          parseError,
        );

        throw new Error(
          `Invalid server response. Status: ${response.status}`,
        );
      }

      console.log(
        'Task History Response:',
        JSON.stringify(data, null, 2),
      );

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ],
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Request failed with status ${response.status}`,
        );
      }

      if (!data?.success) {
        setPendingTasks([]);
        setCompletedTasks([]);
        setUpcomingTasks([]);

        console.log(
          'Fetch History Failed:',
          data?.message ||
            'Failed to fetch task history.',
        );

        return;
      }

      const historyData = data?.data || {};

      const pending =
        Array.isArray(historyData.pending)
          ? historyData.pending
          : [];

      const done =
        Array.isArray(historyData.done)
          ? historyData.done
          : [];

      const upcoming =
        Array.isArray(historyData.upcoming)
          ? historyData.upcoming
          : [];

      setPendingTasks(pending);
      setCompletedTasks(done);
      setUpcomingTasks(upcoming);

      console.log('Pending Tasks:', pending.length);
      console.log('Completed Tasks:', done.length);
      console.log('Upcoming Tasks:', upcoming.length);
    } catch (error) {
      console.log(
        'Fetch History Error:',
        error,
      );

      setPendingTasks([]);
      setCompletedTasks([]);
      setUpcomingTasks([]);

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to fetch task history.',
      );
    } finally {
      setLoading(false);
    }
  }, [type, navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const formatDate = (dueDate, dueTime) => {
    if (!dueDate) {
      return 'No Due Date';
    }

    let formattedDate = dueDate;

    try {
      const date = new Date(dueDate);

      if (!Number.isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString();
      }
    } catch (error) {
      formattedDate = dueDate;
    }

    if (dueTime) {
      return `${formattedDate} • ${dueTime}`;
    }

    return formattedDate;
  };

  const renderTask = (
    item,
    index,
    completedStatus = false,
  ) => {
    return (
      <TouchableOpacity
        key={`${item.id || 'task'}-${index}`}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
          },
          completedStatus && styles.completedCard,
        ]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate(
            'TaskOverviewScreen',
            {
              task: item,
            },
          )
        }
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconCircle,
              completedStatus
                ? styles.iconCircleCompleted
                : styles.iconCircleActive,
            ]}
          >
            <Icon
              name={
                completedStatus
                  ? 'checkmark'
                  : type === 'time'
                  ? 'time-outline'
                  : 'list-outline'
              }
              size={18}
              color={
                completedStatus
                  ? '#10B981'
                  : isDark
                  ? '#60A5FA'
                  : '#2563EB'
              }
            />
          </View>

          <View style={styles.taskInfo}>
            <Text
              style={[
                styles.taskTitle,
                {
                  color: primaryTextColor,
                },
                completedStatus &&
                  styles.completedText,
              ]}
              numberOfLines={2}
            >
              {item.title || 'Untitled Task'}
            </Text>

            {item.description ? (
              <Text
                style={[
                  styles.taskDescription,
                  {
                    color: secondaryTextColor,
                  },
                ]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            ) : null}

            <View style={styles.dateRow}>
              <Icon
                name="calendar-outline"
                size={12}
                color={secondaryTextColor}
                style={styles.dateIcon}
              />

              <Text
                style={[
                  styles.taskDate,
                  {
                    color: secondaryTextColor,
                  },
                ]}
              >
                {formatDate(
                  item.dueDate,
                  item.dueTime,
                )}
              </Text>
            </View>

            {completedStatus && (
              <View
                style={styles.completedBadgeContainer}
              >
                <Text style={styles.completedBadge}>
                  ✓ Completed
                </Text>
              </View>
            )}

            {!completedStatus &&
              item.status === 'Snoozed' && (
                <View
                  style={
                    styles.snoozedBadgeContainer
                  }
                >
                  <Text style={styles.snoozedBadge}>
                    Snoozed
                  </Text>
                </View>
              )}
          </View>

          <Icon
            name="chevron-forward"
            size={18}
            color={secondaryTextColor}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (
    title,
    count,
    completed = false,
  ) => {
    return (
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.section,
            {
              color: primaryTextColor,
            },
          ]}
        >
          {title}
        </Text>

        <View
          style={[
            styles.countBadge,
            completed && {
              backgroundColor: isDark
                ? '#064E3B'
                : '#D1FAE5',
            },
          ]}
        >
          <Text
            style={[
              styles.countBadgeText,
              completed && {
                color: '#10B981',
              },
            ]}
          >
            {count}
          </Text>
        </View>
      </View>
    );
  };

  const totalTasks =
    pendingTasks.length +
    completedTasks.length +
    upcomingTasks.length;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg ||
            (isDark
              ? '#111827'
              : '#F9FAFB'),
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={statusBarBg}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: statusBarBg,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
          activeOpacity={0.6}
        >
          <Icon
            name="arrow-back"
            size={22}
            color={primaryTextColor}
          />
        </TouchableOpacity>

        <View
          style={styles.headerTitleContainer}
        >
          <Text
            style={[
              styles.headerText,
              {
                color: primaryTextColor,
              },
            ]}
            numberOfLines={1}
          >
            {type === 'time'
              ? 'Time-Based History'
              : 'Non-Time History'}
          </Text>
        </View>

        <View
          style={styles.headerButtonPlaceholder}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={[
            styles.toggleContainer,
            {
              backgroundColor: isDark
                ? '#1F2937'
                : '#E5E7EB',
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'time' && [
                styles.toggleBtnActive,
                {
                  backgroundColor:
                    activeToggleBg,
                },
              ],
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (type !== 'time') {
                setType('time');
              }
            }}
          >
            <Icon
              name="time-outline"
              size={16}
              color={
                type === 'time'
                  ? '#2563EB'
                  : secondaryTextColor
              }
              style={{
                marginRight: 6,
              }}
            />

            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'time'
                      ? primaryTextColor
                      : secondaryTextColor,
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

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'non' && [
                styles.toggleBtnActive,
                {
                  backgroundColor:
                    activeToggleBg,
                },
              ],
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (type !== 'non') {
                setType('non');
              }
            }}
          >
            <Icon
              name="list-outline"
              size={16}
              color={
                type === 'non'
                  ? '#2563EB'
                  : secondaryTextColor
              }
              style={{
                marginRight: 6,
              }}
            />

            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'non'
                      ? primaryTextColor
                      : secondaryTextColor,
                  fontWeight:
                    type === 'non'
                      ? '700'
                      : '500',
                },
              ]}
            >
              Non-Time
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View
            style={styles.loadingContainer}
          >
            <ActivityIndicator
              size="large"
              color={
                isDark
                  ? '#60A5FA'
                  : '#2563EB'
              }
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color: secondaryTextColor,
                },
              ]}
            >
              Loading history...
            </Text>
          </View>
        ) : (
          <>
            {pendingTasks.length > 0 && (
              <View
                style={styles.sectionContainer}
              >
                {renderSectionHeader(
                  'PENDING',
                  pendingTasks.length,
                )}

                {pendingTasks.map(
                  (item, index) =>
                    renderTask(
                      item,
                      index,
                      false,
                    ),
                )}
              </View>
            )}

            {completedTasks.length > 0 && (
              <View
                style={styles.sectionContainer}
              >
                {renderSectionHeader(
                  'COMPLETED',
                  completedTasks.length,
                  true,
                )}

                {completedTasks.map(
                  (item, index) =>
                    renderTask(
                      item,
                      index,
                      true,
                    ),
                )}
              </View>
            )}

            {upcomingTasks.length > 0 && (
              <View
                style={styles.sectionContainer}
              >
                {renderSectionHeader(
                  'UPCOMING',
                  upcomingTasks.length,
                )}

                {upcomingTasks.map(
                  (item, index) =>
                    renderTask(
                      item,
                      index,
                      false,
                    ),
                )}
              </View>
            )}

            {totalTasks === 0 && (
              <View
                style={styles.emptyContainer}
              >
                <View
                  style={styles.emptyIconCircle}
                >
                  <Icon
                    name="archive-outline"
                    size={40}
                    color={secondaryTextColor}
                  />
                </View>

                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color: primaryTextColor,
                    },
                  ]}
                >
                  No Tasks Found
                </Text>

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: secondaryTextColor,
                    },
                  ]}
                >
                  There is no task history
                  available for this category
                  right now.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav ||
              (isDark
                ? '#1F2937'
                : '#1E293B'),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'HomeDashboard',
            )
          }
        >
          <Icon
            name="home-outline"
            size={22}
            color="#94A3B8"
          />

          <Text style={styles.navLabel}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'ContactScreen',
            )
          }
        >
          <Icon
            name="people-outline"
            size={22}
            color="#94A3B8"
          />

          <Text style={styles.navLabel}>
            Contacts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'TimeBasedHistoryScreen',
            )
          }
        >
          <Icon
            name="time"
            size={22}
            color="#38BDF8"
          />

          <Text
            style={[
              styles.navLabel,
              styles.navLabelActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(
              'SettingScreen',
            )
          }
        >
          <Icon
            name="settings-outline"
            size={22}
            color="#94A3B8"
          />

          <Text style={styles.navLabel}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default NonTimeBasedHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(0, 0, 0, 0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerButtonPlaceholder: {
    width: 40,
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },

  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },

  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },

  toggleBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  toggleText: {
    fontSize: 13,
  },

  sectionContainer: {
    marginBottom: 20,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  section: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8,
  },

  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor:
      'rgba(156, 163, 175, 0.2)',
  },

  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },

  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  completedCard: {
    opacity: 0.75,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  iconCircleActive: {
    backgroundColor:
      'rgba(37, 99, 235, 0.1)',
  },

  iconCircleCompleted: {
    backgroundColor:
      'rgba(16, 185, 129, 0.1)',
  },

  taskInfo: {
    flex: 1,
    marginRight: 8,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  taskDescription: {
    fontSize: 12,
    marginTop: 2,
  },

  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  dateIcon: {
    marginRight: 4,
  },

  taskDate: {
    fontSize: 12,
  },

  completedBadgeContainer: {
    marginTop: 4,
  },

  completedBadge: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },

  snoozedBadgeContainer: {
    marginTop: 4,
  },

  snoozedBadge: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },

  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor:
      'rgba(156, 163, 175, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },

  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },

  navLabelActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});








































// import React, { useState, useCallback } from 'react';
// import {
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   ActivityIndicator,
//   Alert,
//   StatusBar,
// } from 'react-native';

// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { useTheme } from '../../context/ThemeContext';
// import { useFocusEffect } from '@react-navigation/native';
// import { BASE_URL } from '../../config/api';

// // ============================================================
// // GO TO LOGIN
// // ============================================================
// // Login is inside AuthStack.
// // Therefore navigation.replace('Login') should NOT be used
// // from MainStack screens.
// //
// // Correct structure:
// // Root Navigator
// //    ├── AuthStack
// //    │      └── Login
// //    └── MainStack
// //
// // So we reset to AuthStack and open Login.
// // ============================================================

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

// const NonTimeBasedHistoryScreen = ({ navigation }) => {
//   const { isDark, theme } = useTheme();

//   // ============================================================
//   // STATE
//   // ============================================================

//   const [type, setType] = useState('non');
//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(false);

//   // ============================================================
//   // GET JWT TOKEN
//   // ============================================================
//   const getToken = async () => {
//     try {
//       // IMPORTANT:
//       // LoginScreen stores token using:
//       // AsyncStorage.setItem('token', userData.token)
//       //
//       // Therefore we MUST use "token", NOT "jwtToken".
//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         Alert.alert(
//           'Session Expired',
//           'Your session has expired. Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );

//         return null;
//       }

//       return token;
//     } catch (error) {
//       console.log('Get Token Error:', error);

//       Alert.alert(
//         'Error',
//         'Unable to read your login session.'
//       );

//       return null;
//     }
//   };

//   // ============================================================
//   // FETCH TASK HISTORY
//   // ============================================================

//   const fetchHistory = useCallback(async () => {
//     try {
//       setLoading(true);

//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       // --------------------------------------------------------
//       // Determine task type
//       // --------------------------------------------------------
//       const isTimeBased = type === 'time';

//       // --------------------------------------------------------
//       // Backend route
//       //
//       // HomeDashboard uses:
//       // /Task/personal
//       //
//       // We use the same endpoint here.
//       // --------------------------------------------------------

//       const query = `/Task/personal?tab=&isTimeBased=${isTimeBased}`;

//       console.log(
//         'Fetching History:',
//         `${BASE_URL}${query}`
//       );

//       const response = await fetch(
//         `${BASE_URL}${query}`,
//         {
//           method: 'GET',
//           headers: {
//             Accept: 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       // --------------------------------------------------------
//       // Read response safely
//       // --------------------------------------------------------

//       const text = await response.text();

//       let data = {};

//       try {
//         data = text ? JSON.parse(text) : {};
//       } catch (parseError) {
//         console.log(
//           'History JSON Parse Error:',
//           parseError
//         );

//         throw new Error(
//           `Invalid server response. Status: ${response.status}`
//         );
//       }

//       console.log(
//         'Fetch History Response:',
//         data
//       );

//       // --------------------------------------------------------
//       // Unauthorized
//       // --------------------------------------------------------

//       if (response.status === 401) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );

//         return;
//       }

//       // --------------------------------------------------------
//       // Other HTTP errors
//       // --------------------------------------------------------

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             `Request failed with status ${response.status}`
//         );
//       }

//       // --------------------------------------------------------
//       // Successful response
//       // --------------------------------------------------------

//       if (data?.success) {
//         const fetchedTasks = Array.isArray(data.data)
//           ? data.data
//           : [];

//         setTasks(fetchedTasks);
//       } else {
//         setTasks([]);

//         console.log(
//           'Fetch History Failed:',
//           data?.message || 'Failed to fetch task history'
//         );
//       }
//     } catch (error) {
//       console.log(
//         'Fetch History Error:',
//         error
//       );

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Failed to fetch task history.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [type, navigation]);

//   // ============================================================
//   // REFRESH WHEN SCREEN GETS FOCUS
//   // ============================================================

//   useFocusEffect(
//     useCallback(() => {
//       fetchHistory();
//     }, [fetchHistory])
//   );

//   // ============================================================
//   // FILTER TASKS
//   // ============================================================

//   // Pending = not completed
//   const pendings = tasks.filter(
//     task => !task.isCompleted
//   );

//   // Completed = completed
//   const completed = tasks.filter(
//     task => task.isCompleted
//   );

//   // Upcoming = future date + not completed
//   const upcoming = tasks.filter(task => {
//     if (
//       !task.dueDate ||
//       task.isCompleted
//     ) {
//       return false;
//     }

//     const dueDate = new Date(task.dueDate);
//     const today = new Date();

//     return dueDate > today;
//   });

//   // ============================================================
//   // RENDER TASK CARD
//   // ============================================================

//   const renderTask = (item, index, completed = false) => {
//     return (
//       <TouchableOpacity
//         key={item.id || index}
//         style={[
//           styles.card,
//           {
//             backgroundColor: theme.card,
//           },
//           completed && styles.completedCard,
//         ]}
//         activeOpacity={0.8}
//         onPress={() =>
//           navigation.navigate(
//             'TaskOverviewScreen',
//             {
//               task: item,
//             }
//           )
//         }
//       >
//         <View style={styles.cardContent}>
//           {/* ICON */}
//           <View
//             style={[
//               styles.iconCircle,
//               {
//                 borderColor: theme.text,
//               },
//             ]}
//           >
//             <Icon
//               name={
//                 type === 'time'
//                   ? 'time-outline'
//                   : 'list-outline'
//               }
//               size={19}
//               color={theme.text}
//             />
//           </View>

//           {/* TASK INFORMATION */}
//           <View style={styles.taskInfo}>
//             <Text
//               style={[
//                 styles.taskTitle,
//                 {
//                   color: theme.text,
//                 },
//                 completed &&
//                   styles.completedText,
//               ]}
//               numberOfLines={2}
//             >
//               {item.title || 'Untitled Task'}
//             </Text>

//             {item.dueDate ? (
//               <Text
//                 style={[
//                   styles.taskDate,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 {item.dueDate}
//                 {item.dueTime
//                   ? ` ${item.dueTime}`
//                   : ''}
//               </Text>
//             ) : (
//               <Text
//                 style={[
//                   styles.taskDate,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 No Due Date
//               </Text>
//             )}

//             {completed && (
//               <Text style={styles.completedBadge}>
//                 ✓ Completed
//               </Text>
//             )}
//           </View>

//           {/* ARROW */}
//           <Icon
//             name="chevron-forward"
//             size={20}
//             color={theme.text}
//           />
//         </View>
//       </TouchableOpacity>
//     );
//   };

//   // ============================================================
//   // SCREEN
//   // ============================================================

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor: theme.bg,
//         },
//       ]}
//     >
//       <StatusBar
//         barStyle={
//           isDark
//             ? 'light-content'
//             : 'dark-content'
//         }
//         backgroundColor="#B7C9DB"
//       />

//       {/* ======================================================
//           HEADER
//       ====================================================== */}

//       <View style={styles.header}>
//         {/* BACK */}
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.headerButton}
//         >
//           <Icon
//             name="arrow-back"
//             size={22}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         {/* TITLE */}
//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor:
//                 theme.headerBox,
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
//             {type === 'time'
//               ? 'TIME BASED TASK\nHISTORY'
//               : 'NON - TIME BASED TASK\nHISTORY'}
//           </Text>
//         </View>

//         {/* RIGHT EMPTY SPACE */}
//         <View style={styles.headerButton} />
//       </View>

//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={{
//           paddingBottom: 110,
//         }}
//       >
//         {/* ====================================================
//             TYPE TOGGLE
//         ==================================================== */}

//         <View
//           style={[
//             styles.toggleContainer,
//             {
//               backgroundColor:
//                 theme.headerBox,
//             },
//           ]}
//         >
//           {/* TIME BASED */}
//           <TouchableOpacity
//             style={styles.toggleBtn}
//             onPress={() => setType('time')}
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
//             style={styles.toggleBtn}
//             onPress={() => setType('non')}
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

//         {/* ====================================================
//             LOADING
//         ==================================================== */}

//         {loading ? (
//           <ActivityIndicator
//             size="large"
//             color={theme.text}
//             style={{
//               marginTop: 30,
//             }}
//           />
//         ) : (
//           <>
//             {/* ==================================================
//                 PENDING
//             ================================================== */}

//             {pendings.length > 0 && (
//               <>
//                 <Text
//                   style={[
//                     styles.section,
//                     {
//                       color: theme.text,
//                     },
//                   ]}
//                 >
//                   PENDINGS:
//                 </Text>

//                 {pendings.map(
//                   (item, index) =>
//                     renderTask(
//                       item,
//                       index,
//                       false
//                     )
//                 )}
//               </>
//             )}

//             {/* ==================================================
//                 COMPLETED
//             ================================================== */}

//             {completed.length > 0 && (
//               <>
//                 <Text
//                   style={[
//                     styles.section,
//                     {
//                       color: theme.text,
//                     },
//                   ]}
//                 >
//                   COMPLETED:
//                 </Text>

//                 {completed.map(
//                   (item, index) =>
//                     renderTask(
//                       item,
//                       index,
//                       true
//                     )
//                 )}
//               </>
//             )}

//             {/* ==================================================
//                 UPCOMING
//             ================================================== */}

//             {upcoming.length > 0 && (
//               <>
//                 <Text
//                   style={[
//                     styles.section,
//                     {
//                       color: theme.text,
//                     },
//                   ]}
//                 >
//                   UPCOMINGS:
//                 </Text>

//                 {upcoming.map(
//                   (item, index) =>
//                     renderTask(
//                       item,
//                       index,
//                       false
//                     )
//                 )}
//               </>
//             )}

//             {/* ==================================================
//                 EMPTY
//             ================================================== */}

//             {pendings.length === 0 &&
//               completed.length === 0 &&
//               upcoming.length === 0 && (
//                 <View style={styles.emptyContainer}>
//                   <Icon
//                     name="file-tray-outline"
//                     size={45}
//                     color={theme.text}
//                   />

//                   <Text
//                     style={[
//                       styles.emptyText,
//                       {
//                         color: theme.text,
//                       },
//                     ]}
//                   >
//                     No task history found.
//                   </Text>
//                 </View>
//               )}
//           </>
//         )}
//       </ScrollView>

//       {/* ======================================================
//           BOTTOM NAVIGATION
//       ====================================================== */}

//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav,
//           },
//         ]}
//       >
//         {/* HOME */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               'HomeDashboard'
//             )
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
//             navigation.navigate(
//               'ContactScreen'
//             )
//           }
//         >
//           <Icon
//             name="people"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         {/* TIME HISTORY */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               'TimeBasedHistoryScreen'
//             )
//           }
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
//             navigation.navigate(
//               'SettingScreen'
//             )
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

// export default NonTimeBasedHistoryScreen;

// // ============================================================
// // STYLES
// // ============================================================

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     paddingHorizontal: 14,
//   },

//   // ==========================================================
//   // HEADER
//   // ==========================================================

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 10,
//     marginBottom: 14,
//   },

//   headerButton: {
//     width: 30,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   headerBox: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: '800',
//     textAlign: 'center',
//     fontSize: 12,
//   },

//   // ==========================================================
//   // TOGGLE
//   // ==========================================================

//   toggleContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     padding: 8,
//     borderRadius: 10,
//     marginBottom: 14,
//   },

//   toggleBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginHorizontal: 10,
//     paddingVertical: 4,
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

//   // ==========================================================
//   // SECTION
//   // ==========================================================

//   section: {
//     fontWeight: '800',
//     marginBottom: 8,
//     marginTop: 12,
//   },

//   // ==========================================================
//   // TASK CARD
//   // ==========================================================

//   card: {
//     borderRadius: 12,
//     padding: 14,
//     marginBottom: 12,
//     elevation: 3,
//   },

//   completedCard: {
//     opacity: 0.7,
//     borderLeftWidth: 4,
//     borderLeftColor: '#4CAF50',
//   },

//   cardContent: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   iconCircle: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     borderWidth: 2,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 10,
//   },

//   taskInfo: {
//     flex: 1,
//   },

//   taskTitle: {
//     fontSize: 14,
//     fontWeight: '800',
//   },

//   completedText: {
//     textDecorationLine: 'line-through',
//   },

//   taskDate: {
//     fontSize: 11,
//     marginTop: 4,
//   },

//   completedBadge: {
//     fontSize: 10,
//     color: '#4CAF50',
//     fontWeight: '700',
//     marginTop: 3,
//   },

//   // ==========================================================
//   // EMPTY
//   // ==========================================================

//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 50,
//   },

//   emptyText: {
//     textAlign: 'center',
//     marginTop: 12,
//     fontSize: 14,
//     opacity: 0.7,
//   },

//   // ==========================================================
//   // BOTTOM NAVIGATION
//   // ==========================================================

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     width: '109%',
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
