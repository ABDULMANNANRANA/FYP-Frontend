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
  Dimensions,
  Platform,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// GO TO LOGIN
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

const NonTimeBasedHistoryScreen = ({ navigation }) => {
  const { isDark, theme } = useTheme();

  // ============================================================
  // STATE
  // ============================================================
  const [type, setType] = useState('non');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Dynamic theme colors
  const statusBarBg = theme.headerBox || (isDark ? '#111827' : '#FFFFFF');
  const primaryTextColor = theme.text || (isDark ? '#F9FAFB' : '#0F172A');
  const secondaryTextColor = isDark ? '#9CA3AF' : '#64748B';
  const cardBg = theme.card || (isDark ? '#1F2937' : '#FFFFFF');
  const cardBorderColor = isDark ? '#374151' : '#E2E8F0';
  const activeToggleBg = isDark ? '#374151' : '#FFFFFF';

  // ============================================================
  // GET JWT TOKEN
  // ============================================================
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
          ]
        );
        return null;
      }
      return token;
    } catch (error) {
      console.log('Get Token Error:', error);
      Alert.alert('Error', 'Unable to read your login session.');
      return null;
    }
  };

  // ============================================================
  // FETCH TASK HISTORY
  // ============================================================
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      if (!token) {
        return;
      }

      const isTimeBased = type === 'time';
      const query = `/Task/personal?tab=&isTimeBased=${isTimeBased}`;

      console.log('Fetching History:', `${BASE_URL}${query}`);

      const response = await fetch(`${BASE_URL}${query}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.log('History JSON Parse Error:', parseError);
        throw new Error(
          `Invalid server response. Status: ${response.status}`
        );
      }

      console.log('Fetch History Response:', data);

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

      if (!response.ok) {
        throw new Error(
          data?.message || `Request failed with status ${response.status}`
        );
      }

      if (data?.success) {
        const fetchedTasks = Array.isArray(data.data) ? data.data : [];
        setTasks(fetchedTasks);
      } else {
        setTasks([]);
        console.log(
          'Fetch History Failed:',
          data?.message || 'Failed to fetch task history'
        );
      }
    } catch (error) {
      console.log('Fetch History Error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to fetch task history.'
      );
    } finally {
      setLoading(false);
    }
  }, [type, navigation]);

  // ============================================================
  // REFRESH WHEN SCREEN GETS FOCUS
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  // ============================================================
  // FILTER TASKS
  // ============================================================
  const pendings = tasks.filter(task => !task.isCompleted);
  const completed = tasks.filter(task => task.isCompleted);
  const upcoming = tasks.filter(task => {
    if (!task.dueDate || task.isCompleted) {
      return false;
    }
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    return dueDate > today;
  });

  // ============================================================
  // RENDER TASK CARD
  // ============================================================
  const renderTask = (item, index, completedStatus = false) => {
    return (
      <TouchableOpacity
        key={item.id || index}
        style={[
          styles.card,
          { backgroundColor: cardBg, borderColor: cardBorderColor },
          completedStatus && styles.completedCard,
        ]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('TaskOverviewScreen', {
            task: item,
          })
        }
      >
        <View style={styles.cardContent}>
          {/* ICON */}
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
                  ? 'checkmark-done'
                  : type === 'time'
                  ? 'time-outline'
                  : 'list-outline'
              }
              size={20}
              color={
                completedStatus
                  ? '#10B981'
                  : isDark
                  ? '#60A5FA'
                  : '#2563EB'
              }
            />
          </View>

          {/* TASK INFORMATION */}
          <View style={styles.taskInfo}>
            <Text
              style={[
                styles.taskTitle,
                { color: primaryTextColor },
                completedStatus && styles.completedText,
              ]}
              numberOfLines={2}
            >
              {item.title || 'Untitled Task'}
            </Text>

            <View style={styles.dateRow}>
              <Icon
                name="calendar-outline"
                size={13}
                color={secondaryTextColor}
                style={styles.dateIcon}
              />
              <Text
                style={[styles.taskDate, { color: secondaryTextColor }]}
              >
                {item.dueDate
                  ? `${item.dueDate}${item.dueTime ? ` • ${item.dueTime}` : ''}`
                  : 'No Due Date'}
              </Text>
            </View>

            {completedStatus && (
              <View style={styles.completedBadgeContainer}>
                <View style={styles.completedPill}>
                  <Text style={styles.completedBadge}>✓ Completed</Text>
                </View>
              </View>
            )}
          </View>

          {/* ARROW */}
          <View style={styles.chevronContainer}>
            <Icon
              name="chevron-forward"
              size={18}
              color={secondaryTextColor}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // SCREEN
  // ============================================================
  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.bg || (isDark ? '#0B0F19' : '#F8FAFC') },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={statusBarBg}
        translucent={false}
      />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: statusBarBg }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Icon name="arrow-back" size={22} color={primaryTextColor} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.headerText, { color: primaryTextColor }]}
            numberOfLines={1}
          >
            {type === 'time' ? 'Time-Based History' : 'Non-Time History'}
          </Text>
        </View>

        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TYPE TOGGLE */}
        <View
          style={[
            styles.toggleContainer,
            { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'time' && [
                styles.toggleBtnActive,
                { backgroundColor: activeToggleBg },
              ],
            ]}
            activeOpacity={0.8}
            onPress={() => setType('time')}
          >
            <Icon
              name="time-outline"
              size={17}
              color={type === 'time' ? '#2563EB' : secondaryTextColor}
              style={styles.toggleIcon}
            />
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'time' ? primaryTextColor : secondaryTextColor,
                  fontWeight: type === 'time' ? '700' : '500',
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
                { backgroundColor: activeToggleBg },
              ],
            ]}
            activeOpacity={0.8}
            onPress={() => setType('non')}
          >
            <Icon
              name="list-outline"
              size={17}
              color={type === 'non' ? '#2563EB' : secondaryTextColor}
              style={styles.toggleIcon}
            />
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    type === 'non' ? primaryTextColor : secondaryTextColor,
                  fontWeight: type === 'non' ? '700' : '500',
                },
              ]}
            >
              Non-Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* LOADING STATE */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={isDark ? '#60A5FA' : '#2563EB'}
            />
            <Text
              style={[styles.loadingText, { color: secondaryTextColor }]}
            >
              Loading tasks...
            </Text>
          </View>
        ) : (
          <>
            {/* PENDING TASKS */}
            {pendings.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.section,
                      { color: primaryTextColor },
                    ]}
                  >
                    PENDING
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {pendings.length}
                    </Text>
                  </View>
                </View>

                {pendings.map((item, index) =>
                  renderTask(item, index, false)
                )}
              </View>
            )}

            {/* COMPLETED TASKS */}
            {completed.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.section,
                      { color: primaryTextColor },
                    ]}
                  >
                    COMPLETED
                  </Text>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: '#10B981' },
                      ]}
                    >
                      {completed.length}
                    </Text>
                  </View>
                </View>

                {completed.map((item, index) =>
                  renderTask(item, index, true)
                )}
              </View>
            )}

            {/* UPCOMING TASKS */}
            {upcoming.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.section,
                      { color: primaryTextColor },
                    ]}
                  >
                    UPCOMING
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {upcoming.length}
                    </Text>
                  </View>
                </View>

                {upcoming.map((item, index) =>
                  renderTask(item, index, false)
                )}
              </View>
            )}

            {/* EMPTY STATE */}
            {pendings.length === 0 &&
              completed.length === 0 &&
              upcoming.length === 0 && (
                <View style={styles.emptyContainer}>
                  <View
                    style={[
                      styles.emptyIconCircle,
                      { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' },
                    ]}
                  >
                    <Icon
                      name="archive-outline"
                      size={44}
                      color={secondaryTextColor}
                    />
                  </View>
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: primaryTextColor },
                    ]}
                  >
                    No Tasks Found
                  </Text>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: secondaryTextColor },
                    ]}
                  >
                    There is no task history available for this category right
                    now.
                  </Text>
                </View>
              )}
          </>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav || (isDark ? '#0F172A' : '#1E293B'),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('HomeDashboard')}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ContactScreen')}
        >
          <Icon name="people-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
        >
          <View style={styles.activeNavIndicator}>
            <Icon name="time" size={22} color="#38BDF8" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>
              History
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('SettingScreen')}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default NonTimeBasedHistoryScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // HEADER
  header: {
    height: Platform.OS === 'ios' ? 52 : 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
    fontSize: 17,
    letterSpacing: -0.2,
  },

  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },

  // TOGGLE
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 42,
  },
  toggleBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  toggleIcon: {
    marginRight: 6,
  },
  toggleText: {
    fontSize: 14,
  },

  // SECTION
  sectionContainer: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  section: {
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  // TASK CARD
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  completedCard: {
    opacity: 0.8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  iconCircleCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  taskInfo: {
    flex: 1,
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dateIcon: {
    marginRight: 5,
  },
  taskDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  completedBadgeContainer: {
    marginTop: 6,
    flexDirection: 'row',
  },
  completedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedBadge: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },

  // LOADING
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },

  // BOTTOM NAVIGATION
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 70 : 66,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeNavIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 11,
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
//   Dimensions,
//   Platform,
// } from 'react-native';

// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { useTheme } from '../../context/ThemeContext';
// import { useFocusEffect } from '@react-navigation/native';
// import { BASE_URL } from '../../config/api';

// const { width: SCREEN_WIDTH } = Dimensions.get('window');

// // ============================================================
// // GO TO LOGIN
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

//   // Dynamic status bar styling
//   const statusBarBg = theme.headerBox || (isDark ? '#1F2937' : '#FFFFFF');
//   const primaryTextColor = theme.text || (isDark ? '#F9FAFB' : '#111827');
//   const secondaryTextColor = isDark ? '#9CA3AF' : '#6B7280';
//   const cardBg = theme.card || (isDark ? '#1F2937' : '#FFFFFF');
//   const activeToggleBg = isDark ? '#374151' : '#FFFFFF';

//   // ============================================================
//   // GET JWT TOKEN
//   // ============================================================
//   const getToken = async () => {
//     try {
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
//       Alert.alert('Error', 'Unable to read your login session.');
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

//       const isTimeBased = type === 'time';
//       const query = `/Task/personal?tab=&isTimeBased=${isTimeBased}`;

//       console.log('Fetching History:', `${BASE_URL}${query}`);

//       const response = await fetch(`${BASE_URL}${query}`, {
//         method: 'GET',
//         headers: {
//           Accept: 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const text = await response.text();
//       let data = {};

//       try {
//         data = text ? JSON.parse(text) : {};
//       } catch (parseError) {
//         console.log('History JSON Parse Error:', parseError);
//         throw new Error(
//           `Invalid server response. Status: ${response.status}`
//         );
//       }

//       console.log('Fetch History Response:', data);

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

//       if (!response.ok) {
//         throw new Error(
//           data?.message || `Request failed with status ${response.status}`
//         );
//       }

//       if (data?.success) {
//         const fetchedTasks = Array.isArray(data.data) ? data.data : [];
//         setTasks(fetchedTasks);
//       } else {
//         setTasks([]);
//         console.log(
//           'Fetch History Failed:',
//           data?.message || 'Failed to fetch task history'
//         );
//       }
//     } catch (error) {
//       console.log('Fetch History Error:', error);
//       Alert.alert(
//         'Error',
//         error?.message || 'Failed to fetch task history.'
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
//   const pendings = tasks.filter(task => !task.isCompleted);
//   const completed = tasks.filter(task => task.isCompleted);
//   const upcoming = tasks.filter(task => {
//     if (!task.dueDate || task.isCompleted) {
//       return false;
//     }
//     const dueDate = new Date(task.dueDate);
//     const today = new Date();
//     return dueDate > today;
//   });

//   // ============================================================
//   // RENDER TASK CARD
//   // ============================================================
//   const renderTask = (item, index, completedStatus = false) => {
//     return (
//       <TouchableOpacity
//         key={item.id || index}
//         style={[
//           styles.card,
//           { backgroundColor: cardBg },
//           completedStatus && styles.completedCard,
//         ]}
//         activeOpacity={0.7}
//         onPress={() =>
//           navigation.navigate('TaskOverviewScreen', {
//             task: item,
//           })
//         }
//       >
//         <View style={styles.cardContent}>
//           {/* ICON */}
//           <View
//             style={[
//               styles.iconCircle,
//               completedStatus
//                 ? styles.iconCircleCompleted
//                 : styles.iconCircleActive,
//             ]}
//           >
//             <Icon
//               name={
//                 completedStatus
//                   ? 'checkmark'
//                   : type === 'time'
//                   ? 'time-outline'
//                   : 'list-outline'
//               }
//               size={18}
//               color={
//                 completedStatus
//                   ? '#10B981'
//                   : isDark
//                   ? '#60A5FA'
//                   : '#2563EB'
//               }
//             />
//           </View>

//           {/* TASK INFORMATION */}
//           <View style={styles.taskInfo}>
//             <Text
//               style={[
//                 styles.taskTitle,
//                 { color: primaryTextColor },
//                 completedStatus && styles.completedText,
//               ]}
//               numberOfLines={2}
//             >
//               {item.title || 'Untitled Task'}
//             </Text>

//             <View style={styles.dateRow}>
//               <Icon
//                 name="calendar-outline"
//                 size={12}
//                 color={secondaryTextColor}
//                 style={styles.dateIcon}
//               />
//               <Text
//                 style={[styles.taskDate, { color: secondaryTextColor }]}
//               >
//                 {item.dueDate
//                   ? `${item.dueDate}${item.dueTime ? ` • ${item.dueTime}` : ''}`
//                   : 'No Due Date'}
//               </Text>
//             </View>

//             {completedStatus && (
//               <View style={styles.completedBadgeContainer}>
//                 <Text style={styles.completedBadge}>✓ Completed</Text>
//               </View>
//             )}
//           </View>

//           {/* ARROW */}
//           <Icon
//             name="chevron-forward"
//             size={18}
//             color={secondaryTextColor}
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
//         { backgroundColor: theme.bg || (isDark ? '#111827' : '#F9FAFB') },
//       ]}
//     >
//       <StatusBar
//         barStyle={isDark ? 'light-content' : 'dark-content'}
//         backgroundColor={statusBarBg}
//       />

//       {/* HEADER */}
//       <View style={[styles.header, { backgroundColor: statusBarBg }]}>
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.headerButton}
//           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
//           activeOpacity={0.6}
//         >
//           <Icon name="arrow-back" size={22} color={primaryTextColor} />
//         </TouchableOpacity>

//         <View style={styles.headerTitleContainer}>
//           <Text
//             style={[styles.headerText, { color: primaryTextColor }]}
//             numberOfLines={1}
//           >
//             {type === 'time' ? 'Time-Based History' : 'Non-Time History'}
//           </Text>
//         </View>

//         <View style={styles.headerButtonPlaceholder} />
//       </View>

//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scrollContent}
//       >
//         {/* TYPE TOGGLE */}
//         <View
//           style={[
//             styles.toggleContainer,
//             { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' },
//           ]}
//         >
//           <TouchableOpacity
//             style={[
//               styles.toggleBtn,
//               type === 'time' && [
//                 styles.toggleBtnActive,
//                 { backgroundColor: activeToggleBg },
//               ],
//             ]}
//             activeOpacity={0.8}
//             onPress={() => setType('time')}
//           >
//             <Icon
//               name="time-outline"
//               size={16}
//               color={type === 'time' ? '#2563EB' : secondaryTextColor}
//               style={{ marginRight: 6 }}
//             />
//             <Text
//               style={[
//                 styles.toggleText,
//                 {
//                   color:
//                     type === 'time' ? primaryTextColor : secondaryTextColor,
//                   fontWeight: type === 'time' ? '700' : '500',
//                 },
//               ]}
//             >
//               Time Based
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.toggleBtn,
//               type === 'non' && [
//                 styles.toggleBtnActive,
//                 { backgroundColor: activeToggleBg },
//               ],
//             ]}
//             activeOpacity={0.8}
//             onPress={() => setType('non')}
//           >
//             <Icon
//               name="list-outline"
//               size={16}
//               color={type === 'non' ? '#2563EB' : secondaryTextColor}
//               style={{ marginRight: 6 }}
//             />
//             <Text
//               style={[
//                 styles.toggleText,
//                 {
//                   color:
//                     type === 'non' ? primaryTextColor : secondaryTextColor,
//                   fontWeight: type === 'non' ? '700' : '500',
//                 },
//               ]}
//             >
//               Non-Time
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* LOADING STATE */}
//         {loading ? (
//           <View style={styles.loadingContainer}>
//             <ActivityIndicator
//               size="large"
//               color={isDark ? '#60A5FA' : '#2563EB'}
//             />
//             <Text
//               style={[styles.loadingText, { color: secondaryTextColor }]}
//             >
//               Loading tasks...
//             </Text>
//           </View>
//         ) : (
//           <>
//             {/* PENDING TASKS */}
//             {pendings.length > 0 && (
//               <View style={styles.sectionContainer}>
//                 <View style={styles.sectionHeaderRow}>
//                   <Text
//                     style={[
//                       styles.section,
//                       { color: primaryTextColor },
//                     ]}
//                   >
//                     PENDING
//                   </Text>
//                   <View style={styles.countBadge}>
//                     <Text style={styles.countBadgeText}>
//                       {pendings.length}
//                     </Text>
//                   </View>
//                 </View>

//                 {pendings.map((item, index) =>
//                   renderTask(item, index, false)
//                 )}
//               </View>
//             )}

//             {/* COMPLETED TASKS */}
//             {completed.length > 0 && (
//               <View style={styles.sectionContainer}>
//                 <View style={styles.sectionHeaderRow}>
//                   <Text
//                     style={[
//                       styles.section,
//                       { color: primaryTextColor },
//                     ]}
//                   >
//                     COMPLETED
//                   </Text>
//                   <View
//                     style={[
//                       styles.countBadge,
//                       { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' },
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.countBadgeText,
//                         { color: '#10B981' },
//                       ]}
//                     >
//                       {completed.length}
//                     </Text>
//                   </View>
//                 </View>

//                 {completed.map((item, index) =>
//                   renderTask(item, index, true)
//                 )}
//               </View>
//             )}

//             {/* UPCOMING TASKS */}
//             {upcoming.length > 0 && (
//               <View style={styles.sectionContainer}>
//                 <View style={styles.sectionHeaderRow}>
//                   <Text
//                     style={[
//                       styles.section,
//                       { color: primaryTextColor },
//                     ]}
//                   >
//                     UPCOMING
//                   </Text>
//                   <View style={styles.countBadge}>
//                     <Text style={styles.countBadgeText}>
//                       {upcoming.length}
//                     </Text>
//                   </View>
//                 </View>

//                 {upcoming.map((item, index) =>
//                   renderTask(item, index, false)
//                 )}
//               </View>
//             )}

//             {/* EMPTY STATE */}
//             {pendings.length === 0 &&
//               completed.length === 0 &&
//               upcoming.length === 0 && (
//                 <View style={styles.emptyContainer}>
//                   <View style={styles.emptyIconCircle}>
//                     <Icon
//                       name="archive-outline"
//                       size={40}
//                       color={secondaryTextColor}
//                     />
//                   </View>
//                   <Text
//                     style={[
//                       styles.emptyTitle,
//                       { color: primaryTextColor },
//                     ]}
//                   >
//                     No Tasks Found
//                   </Text>
//                   <Text
//                     style={[
//                       styles.emptyText,
//                       { color: secondaryTextColor },
//                     ]}
//                   >
//                     There is no task history available for this category right
//                     now.
//                   </Text>
//                 </View>
//               )}
//           </>
//         )}
//       </ScrollView>

//       {/* BOTTOM NAVIGATION */}
//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav || (isDark ? '#1F2937' : '#1E293B'),
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           activeOpacity={0.7}
//           onPress={() => navigation.navigate('HomeDashboard')}
//         >
//           <Icon name="home-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Home</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           activeOpacity={0.7}
//           onPress={() => navigation.navigate('ContactScreen')}
//         >
//           <Icon name="people-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Contacts</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           activeOpacity={0.7}
//           onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
//         >
//           <Icon name="time" size={22} color="#38BDF8" />
//           <Text style={[styles.navLabel, styles.navLabelActive]}>
//             History
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           activeOpacity={0.7}
//           onPress={() => navigation.navigate('SettingScreen')}
//         >
//           <Icon name="settings-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Settings</Text>
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
//   },

//   // HEADER
//   header: {
//     height: 56,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justify: 'space-between',
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: 'rgba(0, 0, 0, 0.05)',
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.05,
//     shadowRadius: 2,
//   },
//   headerButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   headerButtonPlaceholder: {
//     width: 40,
//   },
//   headerTitleContainer: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   headerText: {
//     fontWeight: '700',
//     fontSize: 16,
//     letterSpacing: 0.2,
//   },

//   // SCROLL CONTENT
//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 90,
//   },

//   // TOGGLE
//   toggleContainer: {
//     flexDirection: 'row',
//     padding: 4,
//     borderRadius: 12,
//     marginBottom: 20,
//   },
//   toggleBtn: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 10,
//     borderRadius: 8,
//   },
//   toggleBtnActive: {
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//   },
//   toggleText: {
//     fontSize: 13,
//   },

//   // SECTION
//   sectionContainer: {
//     marginBottom: 20,
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 10,
//   },
//   section: {
//     fontWeight: '700',
//     fontSize: 12,
//     letterSpacing: 0.8,
//   },
//   countBadge: {
//     marginLeft: 8,
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 10,
//     backgroundColor: 'rgba(156, 163, 175, 0.2)',
//   },
//   countBadgeText: {
//     fontSize: 11,
//     fontWeight: '700',
//     color: '#6B7280',
//   },

//   // TASK CARD
//   card: {
//     borderRadius: 14,
//     padding: 14,
//     marginBottom: 10,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//   },
//   completedCard: {
//     opacity: 0.75,
//   },
//   cardContent: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   iconCircle: {
//     width: 38,
//     height: 38,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },
//   iconCircleActive: {
//     backgroundColor: 'rgba(37, 99, 235, 0.1)',
//   },
//   iconCircleCompleted: {
//     backgroundColor: 'rgba(16, 185, 129, 0.1)',
//   },
//   taskInfo: {
//     flex: 1,
//     marginRight: 8,
//   },
//   taskTitle: {
//     fontSize: 14,
//     fontWeight: '600',
//     lineHeight: 20,
//   },
//   completedText: {
//     textDecorationLine: 'line-through',
//     opacity: 0.7,
//   },
//   dateRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 4,
//   },
//   dateIcon: {
//     marginRight: 4,
//   },
//   taskDate: {
//     fontSize: 12,
//   },
//   completedBadgeContainer: {
//     marginTop: 4,
//   },
//   completedBadge: {
//     fontSize: 11,
//     color: '#10B981',
//     fontWeight: '600',
//   },

//   // LOADING
//   loadingContainer: {
//     paddingVertical: 50,
//     alignItems: 'center',
//   },
//   loadingText: {
//     marginTop: 10,
//     fontSize: 13,
//   },

//   // EMPTY STATE
//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 60,
//     paddingHorizontal: 20,
//   },
//   emptyIconCircle: {
//     width: 80,
//     height: 80,
//     borderRadius: 40,
//     backgroundColor: 'rgba(156, 163, 175, 0.1)',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 16,
//   },
//   emptyTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//     marginBottom: 6,
//   },
//   emptyText: {
//     textAlign: 'center',
//     fontSize: 13,
//     lineHeight: 18,
//   },

//   // BOTTOM NAVIGATION
//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 64,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     elevation: 8,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },
//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: '100%',
//   },
//   navLabel: {
//     fontSize: 10,
//     color: '#94A3B8',
//     marginTop: 3,
//     fontWeight: '500',
//   },
//   navLabelActive: {
//     color: '#38BDF8',
//     fontWeight: '700',
//   },
// });