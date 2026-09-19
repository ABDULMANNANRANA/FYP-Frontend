import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// GO TO LOGIN
// AuthStack -> Login
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
// GROUP DASHBOARD
// ============================================================
const GroupDashboard = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  // Group name received from HomeDashboard
  const targetGroupName = (
    route?.params?.groupName || ''
  ).toUpperCase();

  const [selectedTab, setSelectedTab] = useState('ALL');
  const [selectedMode, setSelectedMode] = useState('time');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [groupId, setGroupId] = useState(null);
  const [allGroupNames, setAllGroupNames] = useState([]);

  const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

  // SELF + all dynamic groups
  const categories = [
    'SELF',
    ...allGroupNames.filter(
      (group, index, array) =>
        array.indexOf(group) === index
    ),
  ];

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
      return null;
    }
  };

  // ============================================================
  // GENERIC API FETCH
  // ============================================================
  const apiFetch = async (endpoint, options = {}) => {
    const token = await getToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }
    );

    let data = null;

    try {
      const text = await response.text();

      if (text) {
        data = JSON.parse(text);
      }
    } catch (error) {
      console.log('Response JSON Parse Error:', error);
      data = null;
    }

    console.log(
      `API ${options.method || 'GET'} ${endpoint}:`,
      response.status,
      data
    );

    if (response.status === 401) {
      await AsyncStorage.removeItem('token');

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

      throw new Error('Session expired');
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  // ============================================================
  // FETCH GROUPS + GROUP TASKS
  // ============================================================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const groupsResponse = await apiFetch('/Task/groups');

      console.log(
        'Fetch Groups Response:',
        groupsResponse
      );

      if (
        !groupsResponse ||
        !groupsResponse.success
      ) {
        setTasks([]);
        return;
      }

      const groups = groupsResponse.data || [];

      const names = groups
        .map(group => group?.name)
        .filter(Boolean)
        .map(name => name.toUpperCase());

      setAllGroupNames(names);

      const targetGroup = groups.find(
        group =>
          group?.name &&
          group.name.toUpperCase() ===
            targetGroupName
      );

      if (!targetGroup) {
        console.log(
          'Group not found:',
          targetGroupName
        );

        setGroupId(null);
        setTasks([]);

        return;
      }

      const currentGroupId = targetGroup.id;

      setGroupId(currentGroupId);

      console.log(
        'Selected Group:',
        targetGroup.name
      );

      console.log(
        'Selected Group ID:',
        currentGroupId
      );

      const isTimeBased =
        selectedMode === 'time';

      const tabParam =
        selectedTab === 'ALL'
          ? ''
          : selectedTab.toLowerCase();

      const query =
        `/Task/group?tab=${encodeURIComponent(
          tabParam
        )}` +
        `&isTimeBased=${isTimeBased}` +
        `&groupId=${encodeURIComponent(
          currentGroupId
        )}`;

      console.log(
        'Fetching Group Tasks:',
        `${BASE_URL}${query}`
      );

      const tasksResponse = await apiFetch(
        query
      );

      console.log(
        'Fetch Group Tasks Response:',
        tasksResponse
      );

      if (
        tasksResponse?.success
      ) {
        setTasks(
          tasksResponse.data || []
        );
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.log(
        'GroupDashboard fetchData Error:',
        error
      );

      if (
        error?.message !==
          'Authentication required' &&
        error?.message !==
          'Session expired'
      ) {
        Alert.alert(
          'Error',
          error?.message ||
            'Failed to load group tasks.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    targetGroupName,
    selectedTab,
    selectedMode,
  ]);

  // ============================================================
  // REFRESH WHEN SCREEN GETS FOCUS
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ============================================================
  // MARK TASK AS DONE
  // ============================================================
  const handleMarkDone = async task => {
    try {
      setLoading(true);

      await apiFetch(
        `/Task/${task.id}/done`,
        {
          method: 'POST',
        }
      );

      Alert.alert(
        '✅ Task Completed!',
        `"${task.title}" has been marked as done.`
      );

      await fetchData();
    } catch (error) {
      console.log(
        'Mark Done Error:',
        error
      );

      if (
        error?.message !==
          'Authentication required' &&
        error?.message !==
          'Session expired'
      ) {
        Alert.alert(
          'Error',
          error?.message ||
            'Failed to mark task as done.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DELETE TASK
  // ============================================================
  const handleDeleteTask = taskId => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              await apiFetch(
                `/Task/task/${taskId}`,
                {
                  method: 'DELETE',
                }
              );

              Alert.alert(
                'Success',
                'Task deleted successfully.'
              );

              await fetchData();
            } catch (error) {
              console.log(
                'Delete Task Error:',
                error
              );

              if (
                error?.message !==
                  'Authentication required' &&
                error?.message !==
                  'Session expired'
              ) {
                Alert.alert(
                  'Error',
                  error?.message ||
                    'Failed to delete task.'
                );
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // DELETE GROUP
  // ============================================================
  const handleDeleteGroup = () => {
    if (!groupId) {
      Alert.alert(
        'Error',
        'Group information is not available yet.'
      );

      return;
    }

    Alert.alert(
      'Delete Group',
      `Delete "${targetGroupName}" group and all its tasks?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              await apiFetch(
                `/Task/groups/${groupId}`,
                {
                  method: 'DELETE',
                }
              );

              Alert.alert(
                'Deleted',
                `"${targetGroupName}" group deleted successfully.`,
                [
                  {
                    text: 'OK',
                    onPress: () =>
                      navigation.navigate(
                        'HomeDashboard'
                      ),
                  },
                ]
              );
            } catch (error) {
              console.log(
                'Delete Group Error:',
                error
              );

              if (
                error?.message !==
                  'Authentication required' &&
                error?.message !==
                  'Session expired'
              ) {
                Alert.alert(
                  'Error',
                  error?.message ||
                    'Failed to delete group.'
                );
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // CATEGORY NAVIGATION
  // ============================================================
  const handleCategory = category => {
    if (category === 'SELF') {
      navigation.navigate(
        'HomeDashboard'
      );

      return;
    }

    if (
      category === targetGroupName
    ) {
      return;
    }

    navigation.replace(
      'GroupDashboard',
      {
        groupName: category,
      }
    );
  };

  // ============================================================
  // ADD TASK
  // ============================================================
  const handleAddTask = () => {
    if (!groupId) {
      Alert.alert(
        'Please wait',
        'Group information is still loading.'
      );

      return;
    }

    if (selectedMode === 'time') {
      navigation.navigate(
        'AddTaskTimeBased',
        {
          groupId: groupId,
        }
      );
    } else {
      navigation.navigate(
        'AddTaskNonTimeBased',
        {
          groupId: groupId,
        }
      );
    }
  };

  // ============================================================
  // EDIT TASK
  // ============================================================
  const handleEdit = task => {
    if (selectedMode === 'time') {
      navigation.navigate(
        'EditTaskTimeBased',
        {
          task,
        }
      );
    } else {
      navigation.navigate(
        'EditTaskNonTimeBased',
        {
          task,
        }
      );
    }
  };

  // Dynamic status bar height calculation
  const statusBarHeight = StatusBar.currentHeight || 0;

  // Primary Accent color
  const primaryAccent = '#0066FF';

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.bg || '#F4F6F9',
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg || '#F4F6F9'}
        translucent
      />

      {/* Dynamic Header Safe Spacing */}
      <View style={{ height: Platform.OS === 'android' ? statusBarHeight : 0 }} />

      {/* ======================================================
          HEADER
      ====================================================== */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconIconButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
            },
          ]}
        >
          <Text style={[styles.headerText, { color: theme.text }]}>
            TO-DO LIST
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconIconButton}
            onPress={handleDeleteGroup}
            disabled={!groupId || loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="trash-outline"
              size={20}
              color={!groupId || loading ? '#A0A0A0' : '#FF3B30'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconIconButton}
            onPress={() => navigation.navigate('NotificationScreen')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="notifications-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ====================================================
            TABS
        ==================================================== */}
        <View
          style={[
            styles.tabContainer,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#EAECEF',
            },
          ]}
        >
          {tabs.map(tab => {
            const isActive = selectedTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  isActive && [
                    styles.activeTab,
                    { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' },
                  ],
                ]}
                onPress={() => setSelectedTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive
                        ? primaryAccent
                        : isDark
                        ? '#A0A0A0'
                        : '#666666',
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ====================================================
            TIME / NON-TIME TOGGLE
        ==================================================== */}
        <View
          style={[
            styles.toggleBox,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
            },
          ]}
        >
          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => setSelectedMode('time')}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor:
                    selectedMode === 'time'
                      ? primaryAccent
                      : isDark
                      ? '#555'
                      : '#CCC',
                },
              ]}
            >
              {selectedMode === 'time' && (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: primaryAccent },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.toggleText,
                {
                  color: theme.text,
                  fontWeight: selectedMode === 'time' ? '700' : '400',
                },
              ]}
            >
              Time Based
            </Text>
          </TouchableOpacity>

          <View style={styles.toggleDivider} />

          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => setSelectedMode('non')}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor:
                    selectedMode === 'non'
                      ? primaryAccent
                      : isDark
                      ? '#555'
                      : '#CCC',
                },
              ]}
            >
              {selectedMode === 'non' && (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: primaryAccent },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.toggleText,
                {
                  color: theme.text,
                  fontWeight: selectedMode === 'non' ? '700' : '400',
                },
              ]}
            >
              Non-Time Based
            </Text>
          </TouchableOpacity>
        </View>

        {/* ====================================================
            GROUP HEADER TITLE
        ==================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {targetGroupName}
          </Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{tasks.length}</Text>
          </View>
        </View>

        {/* ====================================================
            LOADING & TASK LIST
        ==================================================== */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={primaryAccent} />
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              name="clipboard-outline"
              size={48}
              color={isDark ? '#444' : '#CCC'}
            />
            <Text
              style={[
                styles.noTasksText,
                { color: isDark ? '#888' : '#888888' },
              ]}
            >
              No tasks found for this view.
            </Text>
          </View>
        ) : (
          tasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.card || (isDark ? '#1C1C1E' : '#FFFFFF'),
                },
                task.isCompleted && styles.completedCard,
              ]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('TaskGroupOverviewScreen', {
                  task,
                })
              }
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.clock,
                    {
                      backgroundColor: task.isCompleted
                        ? '#E8F5E9'
                        : isDark
                        ? '#2C2C2E'
                        : '#F0F4F8',
                      borderColor: task.isCompleted
                        ? '#34C759'
                        : primaryAccent,
                    },
                  ]}
                >
                  <Icon
                    name={task.isCompleted ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={task.isCompleted ? '#34C759' : primaryAccent}
                  />
                </View>

                <View style={styles.taskInfo}>
                  <Text
                    style={[
                      styles.taskTitle,
                      { color: theme.text },
                      task.isCompleted && styles.completedText,
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>

                  <Text
                    style={[
                      styles.taskDate,
                      { color: isDark ? '#AAA' : '#777777' },
                    ]}
                  >
                    {task.dueDate
                      ? `${task.dueDate} ${task.dueTime || ''}`
                      : 'No Due Date'}
                  </Text>

                  {task.isCompleted && (
                    <Text style={styles.completedBadge}>✓ Completed</Text>
                  )}
                </View>
              </View>

              {/* ACTION BUTTONS */}
              <View style={styles.taskActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={event => {
                    event.stopPropagation?.();
                    handleEdit(task);
                  }}
                  disabled={loading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name="create-outline"
                    size={18}
                    color={loading ? '#AAA' : isDark ? '#CCC' : '#555'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={event => {
                    event.stopPropagation?.();
                    handleDeleteTask(task.id);
                  }}
                  disabled={loading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name="trash-outline"
                    size={18}
                    color={loading ? '#AAA' : '#FF3B30'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: task.isCompleted ? '#34C759' : primaryAccent,
                    },
                    task.isCompleted && styles.checkboxDone,
                  ]}
                  onPress={event => {
                    event.stopPropagation?.();
                    if (!task.isCompleted) {
                      handleMarkDone(task);
                    }
                  }}
                  disabled={task.isCompleted || loading}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {task.isCompleted && (
                    <Icon name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ========================================================
          FLOATING ACTION BUTTON (FAB)
      ======================================================== */}
      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: primaryAccent },
          (!groupId || loading) && styles.fabDisabled,
        ]}
        onPress={handleAddTask}
        disabled={!groupId || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="add" size={30} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* ========================================================
          CATEGORY SLIDER & BOTTOM NAV CONTAINER
      ======================================================== */}
      <View style={styles.bottomSectionWrapper}>
        {/* CATEGORY BAR */}
        <View style={styles.categoryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map(category => {
              const isSelected =
                category === targetGroupName ||
                (category === 'SELF' && targetGroupName === 'SELF');

              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected
                        ? primaryAccent
                        : isDark
                        ? '#2C2C2E'
                        : '#E8ECEF',
                    },
                  ]}
                  onPress={() => handleCategory(category)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isDark
                          ? '#DDD'
                          : '#444444',
                      },
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* ADD GROUP */}
            <TouchableOpacity
              style={[
                styles.smallAdd,
                { backgroundColor: isDark ? '#333336' : '#E2E8F0' },
              ]}
              onPress={() => navigation.navigate('CreateGroup')}
              activeOpacity={0.7}
            >
              <Icon name="add" size={18} color={theme.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* BOTTOM NAVIGATION */}
        <View
          style={[
            styles.bottom,
            {
              backgroundColor: theme.bottomNav || (isDark ? '#1C1C1E' : '#1E293B'),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('HomeDashboard')}
            activeOpacity={0.7}
          >
            <Icon name="home-outline" size={22} color="#FFFFFF" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('ContactScreen')}
            activeOpacity={0.7}
          >
            <Icon name="people-outline" size={22} color="#FFFFFF" />
            <Text style={styles.navLabel}>Contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
            activeOpacity={0.7}
          >
            <Icon name="time-outline" size={22} color="#FFFFFF" />
            <Text style={styles.navLabel}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('SettingScreen')}
            activeOpacity={0.7}
          >
            <Icon name="settings-outline" size={22} color="#FFFFFF" />
            <Text style={styles.navLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default GroupDashboard;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 160,
  },

  // ==========================================================
  // HEADER
  // ==========================================================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  iconIconButton: {
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  headerText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ==========================================================
  // TABS
  // ==========================================================
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginVertical: 12,
  },

  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  tabText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // ==========================================================
  // TYPE TOGGLE
  // ==========================================================
  toggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },

  toggleDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E0E0E0',
  },

  toggleText: {
    fontSize: 13,
  },

  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ==========================================================
  // SECTION TITLE
  // ==========================================================
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  badgeCount: {
    backgroundColor: '#0066FF20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },

  badgeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066FF',
  },

  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },

  noTasksText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  // ==========================================================
  // TASK CARD
  // ==========================================================
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  completedCard: {
    opacity: 0.65,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },

  clock: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  taskInfo: {
    flex: 1,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },

  taskDate: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },

  completedText: {
    textDecorationLine: 'line-through',
  },

  completedBadge: {
    fontSize: 10,
    color: '#34C759',
    fontWeight: '700',
    marginTop: 3,
  },

  // ==========================================================
  // TASK ACTIONS
  // ==========================================================
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginLeft: 4,
  },

  checkboxDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },

  // ==========================================================
  // FAB
  // ==========================================================
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 128,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },

  fabDisabled: {
    opacity: 0.5,
  },

  // ==========================================================
  // CATEGORY & BOTTOM NAVIGATION WRAPPER
  // ==========================================================
  bottomSectionWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
  },

  categoryContainer: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },

  categoryScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },

  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },

  smallAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottom: {
    width: '100%',
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 8,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },

  navLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});




































// import React, { useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   SafeAreaView,
//   TouchableOpacity,
//   ScrollView,
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
// // AuthStack -> Login
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

// // ============================================================
// // GROUP DASHBOARD
// // ============================================================
// const GroupDashboard = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   // Group name received from HomeDashboard
//   const targetGroupName = (
//     route?.params?.groupName || ''
//   ).toUpperCase();

//   const [selectedTab, setSelectedTab] = useState('ALL');
//   const [selectedMode, setSelectedMode] = useState('time');

//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(false);

//   const [groupId, setGroupId] = useState(null);
//   const [allGroupNames, setAllGroupNames] = useState([]);

//   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

//   // SELF + all dynamic groups
//   const categories = [
//     'SELF',
//     ...allGroupNames.filter(
//       (group, index, array) =>
//         array.indexOf(group) === index
//     ),
//   ];

//   // ============================================================
//   // GET JWT TOKEN
//   // IMPORTANT:
//   // LoginScreen stores token using AsyncStorage key "token"
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
//       return null;
//     }
//   };

//   // ============================================================
//   // GENERIC API FETCH
//   // ============================================================
//   const apiFetch = async (endpoint, options = {}) => {
//     const token = await getToken();

//     if (!token) {
//       throw new Error('Authentication required');
//     }

//     const response = await fetch(
//       `${BASE_URL}${endpoint}`,
//       {
//         ...options,
//         headers: {
//           Accept: 'application/json',
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//           ...(options.headers || {}),
//         },
//       }
//     );

//     // Prevent JSON Parse error when backend returns empty body
//     let data = null;

//     try {
//       const text = await response.text();

//       if (text) {
//         data = JSON.parse(text);
//       }
//     } catch (error) {
//       console.log('Response JSON Parse Error:', error);
//       data = null;
//     }

//     console.log(
//       `API ${options.method || 'GET'} ${endpoint}:`,
//       response.status,
//       data
//     );

//     // ==========================================================
//     // UNAUTHORIZED
//     // ==========================================================
//     if (response.status === 401) {
//       await AsyncStorage.removeItem('token');

//       Alert.alert(
//         'Session Expired',
//         'Please login again.',
//         [
//           {
//             text: 'OK',
//             onPress: () => goToLogin(navigation),
//           },
//         ]
//       );

//       throw new Error('Session expired');
//     }

//     // ==========================================================
//     // OTHER API ERRORS
//     // ==========================================================
//     if (!response.ok) {
//       throw new Error(
//         data?.message ||
//           data?.error ||
//           `Request failed with status ${response.status}`
//       );
//     }

//     return data;
//   };

//   // ============================================================
//   // FETCH GROUPS + GROUP TASKS
//   // ============================================================
//   const fetchData = useCallback(async () => {
//     try {
//       setLoading(true);

//       // ========================================================
//       // 1. FETCH GROUPS
//       // Same route pattern used by HomeDashboard
//       // ========================================================
//       const groupsResponse = await apiFetch('/Task/groups');

//       console.log(
//         'Fetch Groups Response:',
//         groupsResponse
//       );

//       if (
//         !groupsResponse ||
//         !groupsResponse.success
//       ) {
//         setTasks([]);
//         return;
//       }

//       const groups = groupsResponse.data || [];

//       // ========================================================
//       // CREATE DYNAMIC GROUP CATEGORY LIST
//       // ========================================================
//       const names = groups
//         .map(group => group?.name)
//         .filter(Boolean)
//         .map(name => name.toUpperCase());

//       setAllGroupNames(names);

//       // ========================================================
//       // FIND CURRENT GROUP
//       // ========================================================
//       const targetGroup = groups.find(
//         group =>
//           group?.name &&
//           group.name.toUpperCase() ===
//             targetGroupName
//       );

//       if (!targetGroup) {
//         console.log(
//           'Group not found:',
//           targetGroupName
//         );

//         setGroupId(null);
//         setTasks([]);

//         return;
//       }

//       const currentGroupId = targetGroup.id;

//       setGroupId(currentGroupId);

//       console.log(
//         'Selected Group:',
//         targetGroup.name
//       );

//       console.log(
//         'Selected Group ID:',
//         currentGroupId
//       );

//       // ========================================================
//       // 2. FETCH TASKS FOR CURRENT GROUP
//       //
//       // Same query style as HomeDashboard:
//       // /Task/personal?tab=...&isTimeBased=...
//       //
//       // Group version:
//       // /Task/group?tab=...&isTimeBased=...&groupId=...
//       // ========================================================
//       const isTimeBased =
//         selectedMode === 'time';

//       const tabParam =
//         selectedTab === 'ALL'
//           ? ''
//           : selectedTab.toLowerCase();

//       const query =
//         `/Task/group?tab=${encodeURIComponent(
//           tabParam
//         )}` +
//         `&isTimeBased=${isTimeBased}` +
//         `&groupId=${encodeURIComponent(
//           currentGroupId
//         )}`;

//       console.log(
//         'Fetching Group Tasks:',
//         `${BASE_URL}${query}`
//       );

//       const tasksResponse = await apiFetch(
//         query
//       );

//       console.log(
//         'Fetch Group Tasks Response:',
//         tasksResponse
//       );

//       if (
//         tasksResponse?.success
//       ) {
//         setTasks(
//           tasksResponse.data || []
//         );
//       } else {
//         setTasks([]);
//       }
//     } catch (error) {
//       console.log(
//         'GroupDashboard fetchData Error:',
//         error
//       );

//       if (
//         error?.message !==
//           'Authentication required' &&
//         error?.message !==
//           'Session expired'
//       ) {
//         Alert.alert(
//           'Error',
//           error?.message ||
//             'Failed to load group tasks.'
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   }, [
//     targetGroupName,
//     selectedTab,
//     selectedMode,
//   ]);

//   // ============================================================
//   // REFRESH WHEN SCREEN GETS FOCUS
//   // ============================================================
//   useFocusEffect(
//     useCallback(() => {
//       fetchData();
//     }, [fetchData])
//   );

//   // ============================================================
//   // MARK TASK AS DONE
//   // Same route as HomeDashboard
//   // POST /Task/{id}/done
//   // ============================================================
//   const handleMarkDone = async task => {
//     try {
//       setLoading(true);

//       await apiFetch(
//         `/Task/${task.id}/done`,
//         {
//           method: 'POST',
//         }
//       );

//       Alert.alert(
//         '✅ Task Completed!',
//         `"${task.title}" has been marked as done.`
//       );

//       await fetchData();
//     } catch (error) {
//       console.log(
//         'Mark Done Error:',
//         error
//       );

//       if (
//         error?.message !==
//           'Authentication required' &&
//         error?.message !==
//           'Session expired'
//       ) {
//         Alert.alert(
//           'Error',
//           error?.message ||
//             'Failed to mark task as done.'
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ============================================================
//   // DELETE TASK
//   // Same route as HomeDashboard
//   // DELETE /Task/task/{id}
//   // ============================================================
//   const handleDeleteTask = taskId => {
//     Alert.alert(
//       'Delete Task',
//       'Are you sure you want to delete this task?',
//       [
//         {
//           text: 'Cancel',
//           style: 'cancel',
//         },

//         {
//           text: 'Delete',
//           style: 'destructive',

//           onPress: async () => {
//             try {
//               setLoading(true);

//               await apiFetch(
//                 `/Task/task/${taskId}`,
//                 {
//                   method: 'DELETE',
//                 }
//               );

//               Alert.alert(
//                 'Success',
//                 'Task deleted successfully.'
//               );

//               await fetchData();
//             } catch (error) {
//               console.log(
//                 'Delete Task Error:',
//                 error
//               );

//               if (
//                 error?.message !==
//                   'Authentication required' &&
//                 error?.message !==
//                   'Session expired'
//               ) {
//                 Alert.alert(
//                   'Error',
//                   error?.message ||
//                     'Failed to delete task.'
//                 );
//               }
//             } finally {
//               setLoading(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   // ============================================================
//   // DELETE GROUP
//   // ============================================================
//   const handleDeleteGroup = () => {
//     if (!groupId) {
//       Alert.alert(
//         'Error',
//         'Group information is not available yet.'
//       );

//       return;
//     }

//     Alert.alert(
//       'Delete Group',
//       `Delete "${targetGroupName}" group and all its tasks?`,
//       [
//         {
//           text: 'Cancel',
//           style: 'cancel',
//         },

//         {
//           text: 'Delete',
//           style: 'destructive',

//           onPress: async () => {
//             try {
//               setLoading(true);

//               // Group CRUD is under Task controller
//               await apiFetch(
//                 `/Task/groups/${groupId}`,
//                 {
//                   method: 'DELETE',
//                 }
//               );

//               Alert.alert(
//                 'Deleted',
//                 `"${targetGroupName}" group deleted successfully.`,
//                 [
//                   {
//                     text: 'OK',
//                     onPress: () =>
//                       navigation.navigate(
//                         'HomeDashboard'
//                       ),
//                   },
//                 ]
//               );
//             } catch (error) {
//               console.log(
//                 'Delete Group Error:',
//                 error
//               );

//               if (
//                 error?.message !==
//                   'Authentication required' &&
//                 error?.message !==
//                   'Session expired'
//               ) {
//                 Alert.alert(
//                   'Error',
//                   error?.message ||
//                     'Failed to delete group.'
//                 );
//               }
//             } finally {
//               setLoading(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   // ============================================================
//   // CATEGORY NAVIGATION
//   // ============================================================
//   const handleCategory = category => {
//     if (category === 'SELF') {
//       navigation.navigate(
//         'HomeDashboard'
//       );

//       return;
//     }

//     if (
//       category === targetGroupName
//     ) {
//       return;
//     }

//     navigation.replace(
//       'GroupDashboard',
//       {
//         groupName: category,
//       }
//     );
//   };

//   // ============================================================
//   // ADD TASK
//   // ============================================================
//   const handleAddTask = () => {
//     if (!groupId) {
//       Alert.alert(
//         'Please wait',
//         'Group information is still loading.'
//       );

//       return;
//     }

//     if (selectedMode === 'time') {
//       navigation.navigate(
//         'AddTaskTimeBased',
//         {
//           groupId: groupId,
//         }
//       );
//     } else {
//       navigation.navigate(
//         'AddTaskNonTimeBased',
//         {
//           groupId: groupId,
//         }
//       );
//     }
//   };

//   // ============================================================
//   // EDIT TASK
//   // ============================================================
//   const handleEdit = task => {
//     if (selectedMode === 'time') {
//       navigation.navigate(
//         'EditTaskTimeBased',
//         {
//           task,
//         }
//       );
//     } else {
//       navigation.navigate(
//         'EditTaskNonTimeBased',
//         {
//           task,
//         }
//       );
//     }
//   };

//   // ============================================================
//   // RENDER
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
//           onPress={() =>
//             navigation.goBack()
//           }
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
//             TO-DO-LIST
//           </Text>
//         </View>

//         {/* RIGHT ICONS */}
//         <View style={styles.headerActions}>
//           {/* DELETE GROUP */}
//           <TouchableOpacity
//             onPress={
//               handleDeleteGroup
//             }
//             disabled={
//               !groupId || loading
//             }
//           >
//             <Icon
//               name="trash-outline"
//               size={20}
//               color={
//                 !groupId || loading
//                   ? '#999'
//                   : '#E52323'
//               }
//             />
//           </TouchableOpacity>

//           {/* NOTIFICATION */}
//           <TouchableOpacity
//             onPress={() =>
//               navigation.navigate(
//                 'NotificationScreen'
//               )
//             }
//           >
//             <Icon
//               name="notifications-outline"
//               size={22}
//               color={theme.text}
//             />
//           </TouchableOpacity>
//         </View>
//       </View>

//       {/* ======================================================
//           MAIN CONTENT
//       ====================================================== */}
//       <ScrollView
//         contentContainerStyle={{
//           paddingBottom: 180,
//         }}
//         showsVerticalScrollIndicator={
//           false
//         }
//       >
//         {/* ====================================================
//             TABS
//         ==================================================== */}
//         <View
//           style={[
//             styles.tabContainer,
//             {
//               backgroundColor:
//                 theme.filterBg,
//             },
//           ]}
//         >
//           {tabs.map(tab => (
//             <TouchableOpacity
//               key={tab}
//               style={[
//                 styles.tab,
//                 {
//                   backgroundColor:
//                     theme.card,
//                 },
//                 selectedTab === tab &&
//                   styles.activeTab,
//               ]}
//               onPress={() =>
//                 setSelectedTab(tab)
//               }
//             >
//               <Text
//                 style={[
//                   styles.tabText,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 {tab}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>

//         {/* ====================================================
//             TIME / NON-TIME
//         ==================================================== */}
//         <View
//           style={[
//             styles.toggleBox,
//             {
//               backgroundColor:
//                 theme.headerBox,
//             },
//           ]}
//         >
//           {/* TIME */}
//           <TouchableOpacity
//             style={styles.toggleItem}
//             onPress={() =>
//               setSelectedMode('time')
//             }
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 {
//                   borderColor:
//                     theme.text,
//                 },
//               ]}
//             >
//               {selectedMode ===
//                 'time' && (
//                 <View
//                   style={[
//                     styles.radioInner,
//                     {
//                       backgroundColor:
//                         theme.text,
//                     },
//                   ]}
//                 />
//               )}
//             </View>

//             <Text
//               style={{
//                 color: theme.text,
//               }}
//             >
//               Time Based
//             </Text>
//           </TouchableOpacity>

//           {/* NON-TIME */}
//           <TouchableOpacity
//             style={styles.toggleItem}
//             onPress={() =>
//               setSelectedMode('non')
//             }
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 {
//                   borderColor:
//                     theme.text,
//                 },
//               ]}
//             >
//               {selectedMode ===
//                 'non' && (
//                 <View
//                   style={[
//                     styles.radioInner,
//                     {
//                       backgroundColor:
//                         theme.text,
//                     },
//                   ]}
//                 />
//               )}
//             </View>

//             <Text
//               style={{
//                 color: theme.text,
//               }}
//             >
//               Non Time Based
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* ====================================================
//             GROUP NAME
//         ==================================================== */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           {targetGroupName}:
//         </Text>

//         {/* ====================================================
//             LOADING
//         ==================================================== */}
//         {loading ? (
//           <ActivityIndicator
//             size="large"
//             color={theme.text}
//             style={{
//               marginTop: 20,
//             }}
//           />
//         ) : tasks.length === 0 ? (
//           /* ==================================================
//              NO TASKS
//           ================================================== */
//           <Text
//             style={[
//               styles.noTasks,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             No tasks found.
//           </Text>
//         ) : (
//           /* ==================================================
//              TASK LIST
//           ================================================== */
//           tasks.map(task => (
//             <TouchableOpacity
//               key={task.id}
//               style={[
//                 styles.card,
//                 {
//                   backgroundColor:
//                     theme.card,
//                 },
//                 task.isCompleted &&
//                   styles.completedCard,
//               ]}
//               activeOpacity={0.8}
//               onPress={() =>
//                 navigation.navigate(
//                   'TaskGroupOverviewScreen',
//                   {
//                     task,
//                   }
//                 )
//               }
//             >
//               {/* LEFT SIDE */}
//               <View
//                 style={styles.cardLeft}
//               >
//                 {/* CLOCK */}
//                 <View
//                   style={[
//                     styles.clock,
//                     {
//                       borderColor:
//                         theme.text,
//                     },
//                   ]}
//                 >
//                   <Icon
//                     name="time-outline"
//                     size={20}
//                     color={theme.text}
//                   />
//                 </View>

//                 {/* TASK INFORMATION */}
//                 <View
//                   style={{
//                     flex: 1,
//                   }}
//                 >
//                   <Text
//                     style={[
//                       styles.taskTitle,
//                       {
//                         color: theme.text,
//                       },
//                       task.isCompleted &&
//                         styles.completedText,
//                     ]}
//                   >
//                     {task.title}
//                   </Text>

//                   <Text
//                     style={[
//                       styles.taskDate,
//                       {
//                         color: theme.text,
//                       },
//                     ]}
//                   >
//                     {task.dueDate
//                       ? `${task.dueDate} ${
//                           task.dueTime || ''
//                         }`
//                       : 'No Due Date'}
//                   </Text>

//                   {task.isCompleted && (
//                     <Text
//                       style={
//                         styles.completedBadge
//                       }
//                     >
//                       ✓ Completed
//                     </Text>
//                   )}
//                 </View>
//               </View>

//               {/* =================================================
//                   ACTION BUTTONS
//               ================================================= */}
//               <View
//                 style={
//                   styles.taskActions
//                 }
//               >
//                 {/* EDIT */}
//                 <TouchableOpacity
//                   style={styles.editBtn}
//                   onPress={event => {
//                     event.stopPropagation?.();
//                     handleEdit(task);
//                   }}
//                   disabled={loading}
//                 >
//                   <Icon
//                     name="create-outline"
//                     size={16}
//                     color={
//                       loading
//                         ? '#999'
//                         : theme.text
//                     }
//                   />
//                 </TouchableOpacity>

//                 {/* DELETE */}
//                 <TouchableOpacity
//                   style={styles.editBtn}
//                   onPress={event => {
//                     event.stopPropagation?.();
//                     handleDeleteTask(
//                       task.id
//                     );
//                   }}
//                   disabled={loading}
//                 >
//                   <Icon
//                     name="trash-outline"
//                     size={16}
//                     color={
//                       loading
//                         ? '#999'
//                         : '#E52323'
//                     }
//                   />
//                 </TouchableOpacity>

//                 {/* CHECKBOX */}
//                 <TouchableOpacity
//                   style={[
//                     styles.checkbox,
//                     {
//                       borderColor:
//                         theme.text,
//                     },
//                     task.isCompleted &&
//                       styles.checkboxDone,
//                   ]}
//                   onPress={event => {
//                     event.stopPropagation?.();

//                     if (
//                       !task.isCompleted
//                     ) {
//                       handleMarkDone(
//                         task
//                       );
//                     }
//                   }}
//                   disabled={
//                     task.isCompleted ||
//                     loading
//                   }
//                 >
//                   {task.isCompleted && (
//                     <Icon
//                       name="checkmark"
//                       size={14}
//                       color="#fff"
//                     />
//                   )}
//                 </TouchableOpacity>
//               </View>
//             </TouchableOpacity>
//           ))
//         )}
//       </ScrollView>

//       {/* ========================================================
//           FAB
//       ======================================================== */}
//       <TouchableOpacity
//         style={[
//           styles.fab,
//           (!groupId || loading) &&
//             styles.fabDisabled,
//         ]}
//         onPress={handleAddTask}
//         disabled={!groupId || loading}
//       >
//         {loading ? (
//           <ActivityIndicator
//             size="small"
//             color={theme.text}
//           />
//         ) : (
//           <Icon
//             name="add"
//             size={28}
//             color={theme.text}
//           />
//         )}
//       </TouchableOpacity>

//       {/* ========================================================
//           CATEGORY BAR
//       ======================================================== */}
//       <View
//         style={styles.categoryContainer}
//       >
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={
//             false
//           }
//         >
//           {categories.map(category => (
//             <TouchableOpacity
//               key={category}
//               style={[
//                 styles.category,
//                 category ===
//                   targetGroupName &&
//                   styles.activeCategory,
//                 category === 'SELF' &&
//                   targetGroupName ===
//                     'SELF' &&
//                   styles.activeCategory,
//               ]}
//               onPress={() =>
//                 handleCategory(
//                   category
//                 )
//               }
//             >
//               <Text
//                 style={[
//                   styles.categoryText,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 {category}
//               </Text>
//             </TouchableOpacity>
//           ))}

//           {/* ADD GROUP */}
//           <TouchableOpacity
//             style={styles.smallAdd}
//             onPress={() =>
//               navigation.navigate(
//                 'CreateGroup'
//               )
//             }
//           >
//             <Icon
//               name="add"
//               size={16}
//               color={theme.text}
//             />
//           </TouchableOpacity>
//         </ScrollView>
//       </View>

//       {/* ========================================================
//           BOTTOM NAVIGATION
//       ======================================================== */}
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

//         {/* HISTORY */}
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

// export default GroupDashboard;

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
//     marginVertical: 10,
//   },

//   headerBox: {
//     paddingHorizontal: 18,
//     paddingVertical: 6,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: '800',
//     letterSpacing: 1,
//   },

//   headerActions: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },

//   // ==========================================================
//   // TABS
//   // ==========================================================
//   tabContainer: {
//     flexDirection: 'row',
//     padding: 6,
//     borderRadius: 16,
//     marginBottom: 16,
//   },

//   tab: {
//     flex: 1,
//     paddingVertical: 8,
//     borderRadius: 10,
//     marginHorizontal: 3,
//     alignItems: 'center',
//   },

//   activeTab: {
//     backgroundColor: '#fff',
//   },

//   tabText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },

//   // ==========================================================
//   // TYPE TOGGLE
//   // ==========================================================
//   toggleBox: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     borderRadius: 10,
//     padding: 8,
//     marginBottom: 14,
//   },

//   toggleItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginHorizontal: 10,
//   },

//   radioOuter: {
//     width: 16,
//     height: 16,
//     borderRadius: 8,
//     borderWidth: 2,
//     marginRight: 6,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   radioInner: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//   },

//   // ==========================================================
//   // SECTION
//   // ==========================================================
//   section: {
//     fontWeight: '800',
//     marginBottom: 10,
//   },

//   noTasks: {
//     textAlign: 'center',
//     marginTop: 20,
//   },

//   // ==========================================================
//   // TASK CARD
//   // ==========================================================
//   card: {
//     borderRadius: 12,
//     padding: 14,
//     marginBottom: 12,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     elevation: 3,
//   },

//   completedCard: {
//     opacity: 0.7,
//     borderLeftWidth: 4,
//     borderLeftColor: '#4CAF50',
//   },

//   cardLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//   },

//   clock: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     borderWidth: 2,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },

//   taskTitle: {
//     fontWeight: '800',
//   },

//   taskDate: {
//     fontSize: 11,
//     marginTop: 4,
//   },

//   completedText: {
//     textDecorationLine: 'line-through',
//   },

//   completedBadge: {
//     fontSize: 10,
//     color: '#4CAF50',
//     fontWeight: '700',
//     marginTop: 2,
//   },

//   // ==========================================================
//   // TASK ACTIONS
//   // ==========================================================
//   taskActions: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//   },

//   editBtn: {
//     padding: 4,
//   },

//   checkbox: {
//     width: 22,
//     height: 22,
//     borderWidth: 1.5,
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 4,
//   },

//   checkboxDone: {
//     backgroundColor: '#4CAF50',
//     borderColor: '#4CAF50',
//   },

//   // ==========================================================
//   // FAB
//   // ==========================================================
//   fab: {
//     position: 'absolute',
//     right: 20,
//     bottom: 140,
//     width: 60,
//     height: 60,
//     borderRadius: 30,
//     backgroundColor: '#6ED3E8',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   fabDisabled: {
//     opacity: 0.5,
//   },

//   // ==========================================================
//   // CATEGORY
//   // ==========================================================
//   categoryContainer: {
//     position: 'absolute',
//     bottom: 70,
//     width: '100%',
//   },

//   category: {
//     backgroundColor: '#EDEDED',
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 12,
//     marginRight: 8,
//   },

//   activeCategory: {
//     backgroundColor: '#7DD4E8',
//   },

//   categoryText: {
//     fontWeight: '700',
//   },

//   smallAdd: {
//     width: 30,
//     height: 30,
//     borderRadius: 15,
//     backgroundColor: '#6ED3E8',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 3,
//   },

//   // ==========================================================
//   // BOTTOM NAV
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
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });
