import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
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

// A Location Based task is a non-time-based task that carries a saved place.
// Everything that needs to tell the two kinds apart goes through here, so
// the list, the card and the edit handler can never disagree.
const hasPlace = task =>
  task?.latitude !== null &&
  task?.latitude !== undefined &&
  task?.longitude !== null &&
  task?.longitude !== undefined;

const HomeDashboard = ({ navigation }) => {
  const { isDark, theme } = useTheme();

  const [selectedTab, setSelectedTab] = useState('ALL');
  const [selectedMode, setSelectedMode] = useState('time');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);

  const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

  const getToken = async () => {
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
  };

  const fetchGroups = async () => {
    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${BASE_URL}/Task/groups`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      console.log('Fetch Groups Response:', data);

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
          data?.message || 'Failed to fetch groups'
        );
      }

      if (data?.success) {
        const groupList = Array.isArray(data.data)
          ? data.data
          : [];

        const formattedGroups = groupList
          .filter(group => group && group.name)
          .map(group => ({
            id: group.id ?? group.groupId ?? null,
            name: String(group.name).toUpperCase(),
          }));

        setGroups(formattedGroups);

        console.log(
          'Formatted Groups:',
          formattedGroups
        );
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.log('Fetch Groups Error:', error);
      setGroups([]);
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        return;
      }

      const isTimeBased = selectedMode === 'time';

      // Places are saved as non-time-based tasks, so both the Non Time Based
      // and the Location Based radio fetch the same list; they are split by
      // hasPlace() below.
      const isLocation = selectedMode === 'location';

      // A place reminder has no date, so the date tabs cannot apply to it -
      // Location Based always asks for the whole list.
      const tabParam =
        isLocation || selectedTab === 'ALL'
          ? ''
          : selectedTab.toLowerCase();

      const query =
        `/Task/personal?tab=${encodeURIComponent(tabParam)}` +
        `&isTimeBased=${isTimeBased}`;

      console.log(
        'Home Dashboard Fetch:',
        `${BASE_URL}${query}`
      );

      const response = await fetch(
        `${BASE_URL}${query}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log(
        'Home Dashboard Response:',
        data
      );

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () =>
                goToLogin(navigation),
            },
          ]
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Request failed with status ${response.status}`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            'Failed to fetch dashboard tasks.'
        );
      }

      const fetchedTasks = Array.isArray(data.data)
        ? data.data
        : [];

      const dashboardTasks = fetchedTasks.filter(
        task =>
          task &&
          task.status !== 'Done' &&
          task.status !== 'Cancelled'
      );

      // The endpoint answers with every non-time-based task: the checklist
      // ones and the place ones together. Separate them here, so each radio
      // shows only its own kind and no task appears under two radios.
      const visibleTasks = isLocation
        ? dashboardTasks.filter(hasPlace)
        : selectedMode === 'non'
        ? dashboardTasks.filter(task => !hasPlace(task))
        : dashboardTasks;

      setTasks(visibleTasks);

      console.log(
        'Dashboard Tasks Count:',
        visibleTasks.length
      );

      if (isTimeBased) {
        const timeMap = {};

        dashboardTasks.forEach(task => {
          if (
            !task.dueDate ||
            !task.dueTime ||
            task.status === 'Done' ||
            task.status === 'Cancelled'
          ) {
            return;
          }

          const key =
            `${task.dueDate}_${task.dueTime}`;

          if (!timeMap[key]) {
            timeMap[key] = task;
          } else {
            const task1 = timeMap[key];
            const task2 = task;

            Alert.alert(
              '⚠️ Task Clash Detected!',
              `"${task1.title}" and "${task2.title}" are scheduled at the same time (${task.dueDate} ${task.dueTime}).`,
              [
                {
                  text: 'View Clash',
                  onPress: () =>
                    navigation.navigate(
                      'ClashTaskScreen',
                      {
                        task1,
                        task2,
                      }
                    ),
                },
                {
                  text: 'Dismiss',
                  style: 'cancel',
                },
              ]
            );
          }
        });
      }
    } catch (error) {
      console.log(
        'Home Dashboard Fetch Error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to fetch dashboard tasks.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedMode,
    selectedTab,
    navigation,
  ]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
      fetchTasks();
    }, [fetchTasks])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      tasks.forEach(task => {
        if (
          !task.dueDate ||
          !task.dueTime ||
          task.isCompleted ||
          !task.isTimeBased
        ) {
          return;
        }

        const taskDateTimeStr =
          `${task.dueDate}T${task.dueTime}:00`;

        const taskDate =
          new Date(taskDateTimeStr);

        const nowTime = new Date();

        const diffMs =
          taskDate.getTime() -
          nowTime.getTime();

        const diffMins =
          Math.round(diffMs / 60000);

        if (
          diffMins === 0 ||
          diffMins === 5
        ) {
          navigation.navigate(
            'ReminderAlarmScreen',
            {
              task,
              isAdvance: diffMins === 5,
            }
          );
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [tasks, navigation]);

  const handleMarkDone = async task => {
    try {
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

      const data = await response.json();

      console.log(
        'Mark Done Response:',
        data
      );

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () =>
                goToLogin(navigation),
            },
          ]
        );
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            'Failed to mark task as done'
        );
      }

      Alert.alert(
        '✅ Task Completed!',
        `"${task.title}" has been marked as done.`
      );

      fetchTasks();
    } catch (error) {
      console.log(
        'Mark Done Error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to mark task as done'
      );
    }
  };

  const handleDeleteTask = async taskId => {
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
              const token = await getToken();

              if (!token) {
                return;
              }

              const response = await fetch(
                `${BASE_URL}/Task/task/${taskId}`,
                {
                  method: 'DELETE',
                  headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const data =
                await response.json();

              console.log(
                'Delete Task Response:',
                data
              );

              if (response.status === 401) {
                Alert.alert(
                  'Session Expired',
                  'Please login again.',
                  [
                    {
                      text: 'OK',
                      onPress: () =>
                        goToLogin(navigation),
                    },
                  ]
                );
                return;
              }

              if (
                !response.ok ||
                !data?.success
              ) {
                throw new Error(
                  data?.message ||
                    'Failed to delete task'
                );
              }

              Alert.alert(
                'Success',
                data?.message ||
                  'Task deleted successfully'
              );

              fetchTasks();
            } catch (error) {
              console.log(
                'Delete Task Error:',
                error
              );

              Alert.alert(
                'Error',
                error?.message ||
                  'Failed to delete task'
              );
            }
          },
        },
      ]
    );
  };

  const handleCategory = group => {
    if (!group || !group.name) {
      return;
    }

    console.log(
      'Opening GroupDashboard:',
      group
    );

    navigation.navigate(
      'GroupDashboard',
      {
        groupId: group.id,
        groupName: group.name,
      }
    );
  };

  const handleEdit = task => {
    // A place reminder has no date and no time, so it opens its own editor.
    if (hasPlace(task)) {
      navigation.navigate(
        'EditTaskLocationBased',
        {
          task,
        }
      );

      return;
    }

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

  const filteredTasks = tasks;

  const dynamicStyles = {
    container: {
      backgroundColor:
        theme.bg || '#F4F7FA',
    },

    textPrimary: {
      color:
        theme.text || '#1E293B',
    },

    textSubtle: {
      color:
        isDark
          ? '#94A3B8'
          : '#64748B',
    },

    headerBox: {
      backgroundColor:
        theme.headerBox ||
        (isDark
          ? '#1E293B'
          : '#FFFFFF'),
      borderColor:
        isDark
          ? '#334155'
          : '#E2E8F0',
    },

    tabContainer: {
      backgroundColor:
        theme.filterBg ||
        (isDark
          ? '#1E293B'
          : '#E2E8F0'),
    },

    activeTab: {
      backgroundColor:
        isDark
          ? '#38BDF8'
          : '#0284C7',
    },

    inactiveTab: {
      backgroundColor:
        'transparent',
    },

    activeTabText: {
      color: '#FFFFFF',
    },

    toggleBox: {
      backgroundColor:
        theme.headerBox ||
        (isDark
          ? '#1E293B'
          : '#FFFFFF'),
      borderColor:
        isDark
          ? '#334155'
          : '#E2E8F0',
    },

    toggleActiveBg: {
      backgroundColor:
        isDark
          ? '#0284C720'
          : '#E0F2FE',
    },

    card: {
      backgroundColor:
        theme.card ||
        (isDark
          ? '#1E293B'
          : '#FFFFFF'),
      borderColor:
        isDark
          ? '#334155'
          : '#E2E8F0',
    },

    completedCard: {
      backgroundColor:
        isDark
          ? '#0F172A'
          : '#F8FAFC',
      borderColor:
        isDark
          ? '#1E293B'
          : '#CBD5E1',
    },

    clockBg: {
      backgroundColor:
        isDark
          ? '#0F172A'
          : '#F1F5F9',
      borderColor:
        isDark
          ? '#38BDF8'
          : '#0284C7',
    },

    categoryChip: {
      backgroundColor:
        theme.card ||
        (isDark
          ? '#1E293B'
          : '#FFFFFF'),
      borderColor:
        isDark
          ? '#334155'
          : '#CBD5E1',
    },

    activeCategoryChip: {
      backgroundColor:
        isDark
          ? '#38BDF8'
          : '#0284C7',
      borderColor:
        isDark
          ? '#38BDF8'
          : '#0284C7',
    },

    bottomNav: {
      backgroundColor:
        theme.bottomNav ||
        '#0F172A',
    },
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        dynamicStyles.container,
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          theme.bg ||
          (isDark
            ? '#0F172A'
            : '#F4F7FA')
        }
        translucent={false}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconTouchArea}
          onPress={() =>
            navigation.goBack()
          }
          activeOpacity={0.7}
        >
          <Icon
            name="chevron-back"
            size={24}
            color={
              dynamicStyles.textPrimary
                .color
            }
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            dynamicStyles.headerBox,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              dynamicStyles.textPrimary,
            ]}
          >
            TO-DO LIST
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconTouchArea}
          onPress={() =>
            navigation.navigate(
              'NotificationScreen'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="notifications-outline"
            size={22}
            color={
              dynamicStyles.textPrimary
                .color
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={[
            styles.tabContainer,
            dynamicStyles.tabContainer,
          ]}
        >
          {tabs.map(tab => {
            const isActive =
              selectedTab === tab;

            // TODAY / PENDING / UPCOMING all filter on a due date, and a
            // place reminder has none. Grey them out rather than let them
            // look tappable and return nothing.
            const isDisabled =
              selectedMode === 'location' &&
              tab !== 'ALL';

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  isActive
                    ? dynamicStyles.activeTab
                    : dynamicStyles.inactiveTab,
                  isDisabled &&
                    styles.tabDisabled,
                ]}
                onPress={() => {
                  if (isDisabled) {
                    return;
                  }

                  setSelectedTab(tab);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    isActive
                      ? dynamicStyles.activeTabText
                      : dynamicStyles.textSubtle,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[
            styles.toggleBox,
            dynamicStyles.toggleBox,
          ]}
        >
          <TouchableOpacity
            onPress={() =>
              setSelectedMode('time')
            }
            style={[
              styles.toggleItem,
              selectedMode === 'time' &&
                dynamicStyles.toggleActiveBg,
            ]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioOuter,
                selectedMode === 'time' &&
                  styles.radioOuterActive,
              ]}
            >
              {selectedMode === 'time' && (
                <View
                  style={styles.radioInner}
                />
              )}
            </View>

            <Text
              style={[
                styles.toggleText,
                dynamicStyles.textPrimary,
              ]}
            >
              Time Based
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setSelectedMode('non')
            }
            style={[
              styles.toggleItem,
              selectedMode === 'non' &&
                dynamicStyles.toggleActiveBg,
            ]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioOuter,
                selectedMode === 'non' &&
                  styles.radioOuterActive,
              ]}
            >
              {selectedMode === 'non' && (
                <View
                  style={styles.radioInner}
                />
              )}
            </View>

            <Text
              style={[
                styles.toggleText,
                dynamicStyles.textPrimary,
              ]}
            >
              Non Time Based
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // Places have no date, so the date tabs do not apply here.
              setSelectedTab('ALL');
              setSelectedMode('location');
            }}
            style={[
              styles.toggleItem,
              selectedMode === 'location' &&
                dynamicStyles.toggleActiveBg,
            ]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioOuter,
                selectedMode === 'location' &&
                  styles.radioOuterActive,
              ]}
            >
              {selectedMode === 'location' && (
                <View
                  style={styles.radioInner}
                />
              )}
            </View>

            <Text
              style={[
                styles.toggleText,
                dynamicStyles.textPrimary,
              ]}
              numberOfLines={1}
            >
              Location Based
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              dynamicStyles.textPrimary,
            ]}
          >
            SELF
          </Text>

          <Text
            style={[
              styles.taskCountBadge,
              dynamicStyles.textSubtle,
            ]}
          >
            {filteredTasks.length}{' '}
            {filteredTasks.length === 1
              ? 'task'
              : 'tasks'}
          </Text>
        </View>

        {loading ? (
          <View
            style={styles.stateContainer}
          >
            <ActivityIndicator
              size="large"
              color={
                isDark
                  ? '#38BDF8'
                  : '#0284C7'
              }
            />

            <Text
              style={[
                styles.stateText,
                dynamicStyles.textSubtle,
              ]}
            >
              Loading tasks...
            </Text>
          </View>
        ) : filteredTasks.length === 0 ? (
          <View
            style={
              styles.emptyStateContainer
            }
          >
            <Icon
              name="checkmark-done-circle-outline"
              size={56}
              color={
                isDark
                  ? '#475569'
                  : '#CBD5E1'
              }
            />

            <Text
              style={[
                styles.emptyStateTitle,
                dynamicStyles.textPrimary,
              ]}
            >
              {selectedMode === 'location'
                ? 'No places saved yet'
                : 'No tasks found'}
            </Text>

            <Text
              style={[
                styles.emptyStateSub,
                dynamicStyles.textSubtle,
              ]}
            >
              {selectedMode === 'location'
                ? 'Add a task and pick a place on the map.'
                : 'You have no pending items in this view.'}
            </Text>
          </View>
        ) : (
          filteredTasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.card,
                dynamicStyles.card,
                task.isCompleted &&
                  dynamicStyles.completedCard,
              ]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate(
                  'TaskOverviewScreen',
                  {
                    task,
                  }
                )
              }
            >
              <View
                style={styles.cardLeft}
              >
                <View
                  style={[
                    styles.clock,
                    dynamicStyles.clockBg,
                  ]}
                >
                  <Icon
                    name={
                      selectedMode === 'time'
                        ? 'time-outline'
                        : selectedMode === 'location'
                        ? 'location-outline'
                        : 'list-outline'
                    }
                    size={18}
                    color={
                      isDark
                        ? '#38BDF8'
                        : '#0284C7'
                    }
                  />
                </View>

                <View
                  style={
                    styles.taskTextContainer
                  }
                >
                  <Text
                    style={[
                      styles.taskTitle,
                      dynamicStyles.textPrimary,
                      task.isCompleted &&
                        styles.completedText,
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>

                  <Text
                    style={[
                      styles.taskDate,
                      dynamicStyles.textSubtle,
                    ]}
                  >
                    {hasPlace(task)
                      ? `Place reminder · ${
                          task.geofenceRadiusMeters ||
                          200
                        } m`
                      : task.dueDate
                      ? `${task.dueDate} ${
                          task.dueTime || ''
                        }`.trim()
                      : 'No Due Date'}
                  </Text>

                  {task.isCompleted && (
                    <View
                      style={
                        styles.completedBadgeRow
                      }
                    >
                      <Icon
                        name="checkmark-circle"
                        size={12}
                        color="#10B981"
                      />

                      <Text
                        style={
                          styles.completedBadge
                        }
                      >
                        Completed
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View
                style={styles.cardActions}
              >
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={e => {
                    e.stopPropagation?.();
                    handleEdit(task);
                  }}
                  hitSlop={{
                    top: 8,
                    bottom: 8,
                    left: 8,
                    right: 8,
                  }}
                >
                  <Icon
                    name="create-outline"
                    size={18}
                    color={
                      isDark
                        ? '#94A3B8'
                        : '#64748B'
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={e => {
                    e.stopPropagation?.();
                    handleDeleteTask(
                      task.id
                    );
                  }}
                  hitSlop={{
                    top: 8,
                    bottom: 8,
                    left: 8,
                    right: 8,
                  }}
                >
                  <Icon
                    name="trash-outline"
                    size={18}
                    color="#EF4444"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    task.isCompleted &&
                      styles.checkboxDone,
                  ]}
                  onPress={e => {
                    e.stopPropagation?.();

                    if (
                      !task.isCompleted
                    ) {
                      handleMarkDone(task);
                    }
                  }}
                  hitSlop={{
                    top: 8,
                    bottom: 8,
                    left: 8,
                    right: 8,
                  }}
                >
                  {task.isCompleted && (
                    <Icon
                      name="checkmark"
                      size={14}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate(
            selectedMode === 'location'
              ? 'AddTaskLocationBased'
              : 'AddTaskTimeBased'
          )
        }
      >
        <Icon
          name="add"
          size={28}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      <View
        style={styles.categoryContainer}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.categoryScrollContent
          }
        >
          <TouchableOpacity
            key="SELF"
            style={[
              styles.categoryChip,
              dynamicStyles.categoryChip,
              dynamicStyles.activeCategoryChip,
            ]}
            onPress={() => {
              console.log(
                'SELF category selected'
              );
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.categoryText,
                dynamicStyles.activeTabText,
              ]}
            >
              SELF
            </Text>
          </TouchableOpacity>

          {groups.map(group => (
            <TouchableOpacity
              key={
                group.id !== null
                  ? `group-${group.id}`
                  : `group-${group.name}`
              }
              style={[
                styles.categoryChip,
                dynamicStyles.categoryChip,
              ]}
              onPress={() =>
                handleCategory(group)
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryText,
                  dynamicStyles.textPrimary,
                ]}
              >
                {group.name}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.smallAddBtn}
            onPress={() =>
              navigation.navigate(
                'CreateGroup'
              )
            }
            activeOpacity={0.8}
          >
            <Icon
              name="add"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View
        style={[
          styles.bottomNav,
          dynamicStyles.bottomNav,
        ]}
      >
        <TouchableOpacity
          style={styles.iconNavBtn}
          onPress={() =>
            navigation.navigate(
              'HomeDashboard'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="home"
            size={22}
            color="#38BDF8"
          />
          <Text
            style={[
              styles.navLabel,
              styles.activeNavLabel,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          onPress={() =>
            navigation.navigate(
              'ContactScreen'
            )
          }
          activeOpacity={0.7}
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
          style={styles.iconNavBtn}
          onPress={() =>
            navigation.navigate(
              'ClashTaskScreen'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="warning-outline"
            size={22}
            color="#94A3B8"
          />
          <Text style={styles.navLabel}>
            Clashes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          onPress={() =>
            navigation.navigate(
              'TimeBasedHistoryScreen'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="time-outline"
            size={22}
            color="#94A3B8"
          />
          <Text style={styles.navLabel}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          onPress={() =>
            navigation.navigate(
              'SettingScreen'
            )
          }
          activeOpacity={0.7}
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

export default HomeDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop:
      Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 10,
  },

  iconTouchArea: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 170,
  },

  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  tabDisabled: {
    opacity: 0.35,
  },

  toggleBox: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
  },

  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },

  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioOuterActive: {
    borderColor: '#0284C7',
  },

  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },

  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  taskCountBadge: {
    fontSize: 12,
    fontWeight: '600',
  },

  stateContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },

  stateText: {
    marginTop: 8,
    fontSize: 13,
  },

  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },

  emptyStateSub: {
    fontSize: 12,
    marginTop: 4,
  },

  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },

  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },

  completedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  completedBadge: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    marginLeft: 4,
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },

  clock: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  taskTextContainer: {
    flex: 1,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },

  taskDate: {
    fontSize: 12,
    marginTop: 2,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionBtn: {
    padding: 6,
    marginRight: 4,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginLeft: 4,
  },

  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 125,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0284C7',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    zIndex: 10,
  },

  categoryContainer: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    paddingVertical: 8,
    zIndex: 20,
    elevation: 20,
  },

  categoryScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },

  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },

  smallAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.08)',
    zIndex: 10,
    elevation: 10,
  },

  iconNavBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },

  activeNavLabel: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});
















































// import React, { useState, useCallback, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   SafeAreaView,
//   TouchableOpacity,
//   ScrollView,
//   StatusBar,
//   ActivityIndicator,
//   Alert,
//   Platform,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useTheme } from '../../context/ThemeContext';
// import { useFocusEffect } from '@react-navigation/native';
// import { BASE_URL } from '../../config/api';

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

// // A Location Based task is a non-time-based task that carries a saved place.
// // Everything that needs to tell the two kinds apart goes through here, so
// // the list, the card and the edit handler can never disagree.
// const hasPlace = task =>
//   task?.latitude !== null &&
//   task?.latitude !== undefined &&
//   task?.longitude !== null &&
//   task?.longitude !== undefined;

// const HomeDashboard = ({ navigation }) => {
//   const { isDark, theme } = useTheme();

//   const [selectedTab, setSelectedTab] = useState('ALL');
//   const [selectedMode, setSelectedMode] = useState('time');
//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [groups, setGroups] = useState([]);

//   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

//   const getToken = async () => {
//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       Alert.alert(
//         'Session Expired',
//         'Your session has expired. Please login again.',
//         [
//           {
//             text: 'OK',
//             onPress: () => goToLogin(navigation),
//           },
//         ]
//       );

//       return null;
//     }

//     return token;
//   };

//   const fetchGroups = async () => {
//     try {
//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       const response = await fetch(`${BASE_URL}/Task/groups`, {
//         method: 'GET',
//         headers: {
//           Accept: 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const data = await response.json();

//       console.log('Fetch Groups Response:', data);

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
//           data?.message || 'Failed to fetch groups'
//         );
//       }

//       if (data?.success) {
//         const groupList = Array.isArray(data.data)
//           ? data.data
//           : [];

//         const formattedGroups = groupList
//           .filter(group => group && group.name)
//           .map(group => ({
//             id: group.id ?? group.groupId ?? null,
//             name: String(group.name).toUpperCase(),
//           }));

//         setGroups(formattedGroups);

//         console.log(
//           'Formatted Groups:',
//           formattedGroups
//         );
//       } else {
//         setGroups([]);
//       }
//     } catch (error) {
//       console.log('Fetch Groups Error:', error);
//       setGroups([]);
//     }
//   };

//   const fetchTasks = useCallback(async () => {
//     try {
//       setLoading(true);

//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       const isTimeBased = selectedMode === 'time';

//       // Places are saved as non-time-based tasks, so both the Non Time Based
//       // and the Location Based radio fetch the same list; they are split by
//       // hasPlace() below.
//       const isLocation = selectedMode === 'location';

//       // A place reminder has no date, so the date tabs cannot apply to it -
//       // Location Based always asks for the whole list.
//       const tabParam =
//         isLocation || selectedTab === 'ALL'
//           ? ''
//           : selectedTab.toLowerCase();

//       const query =
//         `/Task/personal?tab=${encodeURIComponent(tabParam)}` +
//         `&isTimeBased=${isTimeBased}`;

//       console.log(
//         'Home Dashboard Fetch:',
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

//       const data = await response.json();

//       console.log(
//         'Home Dashboard Response:',
//         data
//       );

//       if (response.status === 401) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () =>
//                 goToLogin(navigation),
//             },
//           ]
//         );

//         return;
//       }

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             `Request failed with status ${response.status}`
//         );
//       }

//       if (!data?.success) {
//         throw new Error(
//           data?.message ||
//             'Failed to fetch dashboard tasks.'
//         );
//       }

//       const fetchedTasks = Array.isArray(data.data)
//         ? data.data
//         : [];

//       const dashboardTasks = fetchedTasks.filter(
//         task =>
//           task &&
//           task.status !== 'Done' &&
//           task.status !== 'Cancelled'
//       );

//       // The endpoint answers with every non-time-based task: the checklist
//       // ones and the place ones together. Separate them here, so each radio
//       // shows only its own kind and no task appears under two radios.
//       const visibleTasks = isLocation
//         ? dashboardTasks.filter(hasPlace)
//         : selectedMode === 'non'
//         ? dashboardTasks.filter(task => !hasPlace(task))
//         : dashboardTasks;

//       setTasks(visibleTasks);

//       console.log(
//         'Dashboard Tasks Count:',
//         visibleTasks.length
//       );

//       if (isTimeBased) {
//         const timeMap = {};

//         dashboardTasks.forEach(task => {
//           if (
//             !task.dueDate ||
//             !task.dueTime ||
//             task.status === 'Done' ||
//             task.status === 'Cancelled'
//           ) {
//             return;
//           }

//           const key =
//             `${task.dueDate}_${task.dueTime}`;

//           if (!timeMap[key]) {
//             timeMap[key] = task;
//           } else {
//             const task1 = timeMap[key];
//             const task2 = task;

//             Alert.alert(
//               '⚠️ Task Clash Detected!',
//               `"${task1.title}" and "${task2.title}" are scheduled at the same time (${task.dueDate} ${task.dueTime}).`,
//               [
//                 {
//                   text: 'View Clash',
//                   onPress: () =>
//                     navigation.navigate(
//                       'ClashTaskScreen',
//                       {
//                         task1,
//                         task2,
//                       }
//                     ),
//                 },
//                 {
//                   text: 'Dismiss',
//                   style: 'cancel',
//                 },
//               ]
//             );
//           }
//         });
//       }
//     } catch (error) {
//       console.log(
//         'Home Dashboard Fetch Error:',
//         error
//       );

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Failed to fetch dashboard tasks.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [
//     selectedMode,
//     selectedTab,
//     navigation,
//   ]);

//   useFocusEffect(
//     useCallback(() => {
//       fetchGroups();
//       fetchTasks();
//     }, [fetchTasks])
//   );

//   useEffect(() => {
//     const interval = setInterval(() => {
//       tasks.forEach(task => {
//         if (
//           !task.dueDate ||
//           !task.dueTime ||
//           task.isCompleted ||
//           !task.isTimeBased
//         ) {
//           return;
//         }

//         const taskDateTimeStr =
//           `${task.dueDate}T${task.dueTime}:00`;

//         const taskDate =
//           new Date(taskDateTimeStr);

//         const nowTime = new Date();

//         const diffMs =
//           taskDate.getTime() -
//           nowTime.getTime();

//         const diffMins =
//           Math.round(diffMs / 60000);

//         if (
//           diffMins === 0 ||
//           diffMins === 5
//         ) {
//           navigation.navigate(
//             'ReminderAlarmScreen',
//             {
//               task,
//               isAdvance: diffMins === 5,
//             }
//           );
//         }
//       });
//     }, 60000);

//     return () => clearInterval(interval);
//   }, [tasks, navigation]);

//   const handleMarkDone = async task => {
//     try {
//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       const response = await fetch(
//         `${BASE_URL}/Task/${task.id}/done`,
//         {
//           method: 'POST',
//           headers: {
//             Accept: 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       const data = await response.json();

//       console.log(
//         'Mark Done Response:',
//         data
//       );

//       if (response.status === 401) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () =>
//                 goToLogin(navigation),
//             },
//           ]
//         );
//         return;
//       }

//       if (!response.ok || !data?.success) {
//         throw new Error(
//           data?.message ||
//             'Failed to mark task as done'
//         );
//       }

//       Alert.alert(
//         '✅ Task Completed!',
//         `"${task.title}" has been marked as done.`
//       );

//       fetchTasks();
//     } catch (error) {
//       console.log(
//         'Mark Done Error:',
//         error
//       );

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Failed to mark task as done'
//       );
//     }
//   };

//   const handleDeleteTask = async taskId => {
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
//               const token = await getToken();

//               if (!token) {
//                 return;
//               }

//               const response = await fetch(
//                 `${BASE_URL}/Task/task/${taskId}`,
//                 {
//                   method: 'DELETE',
//                   headers: {
//                     Accept: 'application/json',
//                     Authorization: `Bearer ${token}`,
//                   },
//                 }
//               );

//               const data =
//                 await response.json();

//               console.log(
//                 'Delete Task Response:',
//                 data
//               );

//               if (response.status === 401) {
//                 Alert.alert(
//                   'Session Expired',
//                   'Please login again.',
//                   [
//                     {
//                       text: 'OK',
//                       onPress: () =>
//                         goToLogin(navigation),
//                     },
//                   ]
//                 );
//                 return;
//               }

//               if (
//                 !response.ok ||
//                 !data?.success
//               ) {
//                 throw new Error(
//                   data?.message ||
//                     'Failed to delete task'
//                 );
//               }

//               Alert.alert(
//                 'Success',
//                 data?.message ||
//                   'Task deleted successfully'
//               );

//               fetchTasks();
//             } catch (error) {
//               console.log(
//                 'Delete Task Error:',
//                 error
//               );

//               Alert.alert(
//                 'Error',
//                 error?.message ||
//                   'Failed to delete task'
//               );
//             }
//           },
//         },
//       ]
//     );
//   };

//   const handleCategory = group => {
//     if (!group || !group.name) {
//       return;
//     }

//     console.log(
//       'Opening GroupDashboard:',
//       group
//     );

//     navigation.navigate(
//       'GroupDashboard',
//       {
//         groupId: group.id,
//         groupName: group.name,
//       }
//     );
//   };

//   const handleEdit = task => {
//     // A place reminder has no date and no time, so it opens its own editor.
//     if (hasPlace(task)) {
//       navigation.navigate(
//         'EditTaskLocationBased',
//         {
//           task,
//         }
//       );

//       return;
//     }

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

//   const filteredTasks = tasks;

//   const dynamicStyles = {
//     container: {
//       backgroundColor:
//         theme.bg || '#F4F7FA',
//     },

//     textPrimary: {
//       color:
//         theme.text || '#1E293B',
//     },

//     textSubtle: {
//       color:
//         isDark
//           ? '#94A3B8'
//           : '#64748B',
//     },

//     headerBox: {
//       backgroundColor:
//         theme.headerBox ||
//         (isDark
//           ? '#1E293B'
//           : '#FFFFFF'),
//       borderColor:
//         isDark
//           ? '#334155'
//           : '#E2E8F0',
//     },

//     tabContainer: {
//       backgroundColor:
//         theme.filterBg ||
//         (isDark
//           ? '#1E293B'
//           : '#E2E8F0'),
//     },

//     activeTab: {
//       backgroundColor:
//         isDark
//           ? '#38BDF8'
//           : '#0284C7',
//     },

//     inactiveTab: {
//       backgroundColor:
//         'transparent',
//     },

//     activeTabText: {
//       color: '#FFFFFF',
//     },

//     toggleBox: {
//       backgroundColor:
//         theme.headerBox ||
//         (isDark
//           ? '#1E293B'
//           : '#FFFFFF'),
//       borderColor:
//         isDark
//           ? '#334155'
//           : '#E2E8F0',
//     },

//     toggleActiveBg: {
//       backgroundColor:
//         isDark
//           ? '#0284C720'
//           : '#E0F2FE',
//     },

//     card: {
//       backgroundColor:
//         theme.card ||
//         (isDark
//           ? '#1E293B'
//           : '#FFFFFF'),
//       borderColor:
//         isDark
//           ? '#334155'
//           : '#E2E8F0',
//     },

//     completedCard: {
//       backgroundColor:
//         isDark
//           ? '#0F172A'
//           : '#F8FAFC',
//       borderColor:
//         isDark
//           ? '#1E293B'
//           : '#CBD5E1',
//     },

//     clockBg: {
//       backgroundColor:
//         isDark
//           ? '#0F172A'
//           : '#F1F5F9',
//       borderColor:
//         isDark
//           ? '#38BDF8'
//           : '#0284C7',
//     },

//     categoryChip: {
//       backgroundColor:
//         theme.card ||
//         (isDark
//           ? '#1E293B'
//           : '#FFFFFF'),
//       borderColor:
//         isDark
//           ? '#334155'
//           : '#CBD5E1',
//     },

//     activeCategoryChip: {
//       backgroundColor:
//         isDark
//           ? '#38BDF8'
//           : '#0284C7',
//       borderColor:
//         isDark
//           ? '#38BDF8'
//           : '#0284C7',
//     },

//     bottomNav: {
//       backgroundColor:
//         theme.bottomNav ||
//         '#0F172A',
//     },
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         dynamicStyles.container,
//       ]}
//     >
//       <StatusBar
//         barStyle={
//           isDark
//             ? 'light-content'
//             : 'dark-content'
//         }
//         backgroundColor={
//           theme.bg ||
//           (isDark
//             ? '#0F172A'
//             : '#F4F7FA')
//         }
//         translucent={false}
//       />

//       <View style={styles.header}>
//         <TouchableOpacity
//           style={styles.iconTouchArea}
//           onPress={() =>
//             navigation.goBack()
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="chevron-back"
//             size={24}
//             color={
//               dynamicStyles.textPrimary
//                 .color
//             }
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             dynamicStyles.headerBox,
//           ]}
//         >
//           <Text
//             style={[
//               styles.headerTitle,
//               dynamicStyles.textPrimary,
//             ]}
//           >
//             TO-DO LIST
//           </Text>
//         </View>

//         <TouchableOpacity
//           style={styles.iconTouchArea}
//           onPress={() =>
//             navigation.navigate(
//               'NotificationScreen'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="notifications-outline"
//             size={22}
//             color={
//               dynamicStyles.textPrimary
//                 .color
//             }
//           />
//         </TouchableOpacity>
//       </View>

//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={
//           styles.scrollContent
//         }
//       >
//         <View
//           style={[
//             styles.tabContainer,
//             dynamicStyles.tabContainer,
//           ]}
//         >
//           {tabs.map(tab => {
//             const isActive =
//               selectedTab === tab;

//             // TODAY / PENDING / UPCOMING all filter on a due date, and a
//             // place reminder has none. Grey them out rather than let them
//             // look tappable and return nothing.
//             const isDisabled =
//               selectedMode === 'location' &&
//               tab !== 'ALL';

//             return (
//               <TouchableOpacity
//                 key={tab}
//                 style={[
//                   styles.tab,
//                   isActive
//                     ? dynamicStyles.activeTab
//                     : dynamicStyles.inactiveTab,
//                   isDisabled &&
//                     styles.tabDisabled,
//                 ]}
//                 onPress={() => {
//                   if (isDisabled) {
//                     return;
//                   }

//                   setSelectedTab(tab);
//                 }}
//                 activeOpacity={0.8}
//               >
//                 <Text
//                   style={[
//                     styles.tabText,
//                     isActive
//                       ? dynamicStyles.activeTabText
//                       : dynamicStyles.textSubtle,
//                   ]}
//                 >
//                   {tab}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </View>

//         <View
//           style={[
//             styles.toggleBox,
//             dynamicStyles.toggleBox,
//           ]}
//         >
//           <TouchableOpacity
//             onPress={() =>
//               setSelectedMode('time')
//             }
//             style={[
//               styles.toggleItem,
//               selectedMode === 'time' &&
//                 dynamicStyles.toggleActiveBg,
//             ]}
//             activeOpacity={0.8}
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 selectedMode === 'time' &&
//                   styles.radioOuterActive,
//               ]}
//             >
//               {selectedMode === 'time' && (
//                 <View
//                   style={styles.radioInner}
//                 />
//               )}
//             </View>

//             <Text
//               style={[
//                 styles.toggleText,
//                 dynamicStyles.textPrimary,
//               ]}
//             >
//               Time Based
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             onPress={() =>
//               setSelectedMode('non')
//             }
//             style={[
//               styles.toggleItem,
//               selectedMode === 'non' &&
//                 dynamicStyles.toggleActiveBg,
//             ]}
//             activeOpacity={0.8}
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 selectedMode === 'non' &&
//                   styles.radioOuterActive,
//               ]}
//             >
//               {selectedMode === 'non' && (
//                 <View
//                   style={styles.radioInner}
//                 />
//               )}
//             </View>

//             <Text
//               style={[
//                 styles.toggleText,
//                 dynamicStyles.textPrimary,
//               ]}
//             >
//               Non Time Based
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             onPress={() => {
//               // Places have no date, so the date tabs do not apply here.
//               setSelectedTab('ALL');
//               setSelectedMode('location');
//             }}
//             style={[
//               styles.toggleItem,
//               selectedMode === 'location' &&
//                 dynamicStyles.toggleActiveBg,
//             ]}
//             activeOpacity={0.8}
//           >
//             <View
//               style={[
//                 styles.radioOuter,
//                 selectedMode === 'location' &&
//                   styles.radioOuterActive,
//               ]}
//             >
//               {selectedMode === 'location' && (
//                 <View
//                   style={styles.radioInner}
//                 />
//               )}
//             </View>

//             <Text
//               style={[
//                 styles.toggleText,
//                 dynamicStyles.textPrimary,
//               ]}
//               numberOfLines={1}
//             >
//               Location Based
//             </Text>
//           </TouchableOpacity>
//         </View>

//         <View style={styles.sectionHeader}>
//           <Text
//             style={[
//               styles.sectionTitle,
//               dynamicStyles.textPrimary,
//             ]}
//           >
//             SELF
//           </Text>

//           <Text
//             style={[
//               styles.taskCountBadge,
//               dynamicStyles.textSubtle,
//             ]}
//           >
//             {filteredTasks.length}{' '}
//             {filteredTasks.length === 1
//               ? 'task'
//               : 'tasks'}
//           </Text>
//         </View>

//         {loading ? (
//           <View
//             style={styles.stateContainer}
//           >
//             <ActivityIndicator
//               size="large"
//               color={
//                 isDark
//                   ? '#38BDF8'
//                   : '#0284C7'
//               }
//             />

//             <Text
//               style={[
//                 styles.stateText,
//                 dynamicStyles.textSubtle,
//               ]}
//             >
//               Loading tasks...
//             </Text>
//           </View>
//         ) : filteredTasks.length === 0 ? (
//           <View
//             style={
//               styles.emptyStateContainer
//             }
//           >
//             <Icon
//               name="checkmark-done-circle-outline"
//               size={56}
//               color={
//                 isDark
//                   ? '#475569'
//                   : '#CBD5E1'
//               }
//             />

//             <Text
//               style={[
//                 styles.emptyStateTitle,
//                 dynamicStyles.textPrimary,
//               ]}
//             >
//               {selectedMode === 'location'
//                 ? 'No places saved yet'
//                 : 'No tasks found'}
//             </Text>

//             <Text
//               style={[
//                 styles.emptyStateSub,
//                 dynamicStyles.textSubtle,
//               ]}
//             >
//               {selectedMode === 'location'
//                 ? 'Add a task and pick a place on the map.'
//                 : 'You have no pending items in this view.'}
//             </Text>
//           </View>
//         ) : (
//           filteredTasks.map(task => (
//             <TouchableOpacity
//               key={task.id}
//               style={[
//                 styles.card,
//                 dynamicStyles.card,
//                 task.isCompleted &&
//                   dynamicStyles.completedCard,
//               ]}
//               activeOpacity={0.85}
//               onPress={() =>
//                 navigation.navigate(
//                   'TaskOverviewScreen',
//                   {
//                     task,
//                   }
//                 )
//               }
//             >
//               <View
//                 style={styles.cardLeft}
//               >
//                 <View
//                   style={[
//                     styles.clock,
//                     dynamicStyles.clockBg,
//                   ]}
//                 >
//                   <Icon
//                     name={
//                       selectedMode === 'time'
//                         ? 'time-outline'
//                         : selectedMode === 'location'
//                         ? 'location-outline'
//                         : 'list-outline'
//                     }
//                     size={18}
//                     color={
//                       isDark
//                         ? '#38BDF8'
//                         : '#0284C7'
//                     }
//                   />
//                 </View>

//                 <View
//                   style={
//                     styles.taskTextContainer
//                   }
//                 >
//                   <Text
//                     style={[
//                       styles.taskTitle,
//                       dynamicStyles.textPrimary,
//                       task.isCompleted &&
//                         styles.completedText,
//                     ]}
//                     numberOfLines={2}
//                   >
//                     {task.title}
//                   </Text>

//                   <Text
//                     style={[
//                       styles.taskDate,
//                       dynamicStyles.textSubtle,
//                     ]}
//                   >
//                     {hasPlace(task)
//                       ? `Place reminder · ${
//                           task.geofenceRadiusMeters ||
//                           200
//                         } m`
//                       : task.dueDate
//                       ? `${task.dueDate} ${
//                           task.dueTime || ''
//                         }`.trim()
//                       : 'No Due Date'}
//                   </Text>

//                   {task.isCompleted && (
//                     <View
//                       style={
//                         styles.completedBadgeRow
//                       }
//                     >
//                       <Icon
//                         name="checkmark-circle"
//                         size={12}
//                         color="#10B981"
//                       />

//                       <Text
//                         style={
//                           styles.completedBadge
//                         }
//                       >
//                         Completed
//                       </Text>
//                     </View>
//                   )}
//                 </View>
//               </View>

//               <View
//                 style={styles.cardActions}
//               >
//                 <TouchableOpacity
//                   style={styles.actionBtn}
//                   onPress={e => {
//                     e.stopPropagation?.();
//                     handleEdit(task);
//                   }}
//                   hitSlop={{
//                     top: 8,
//                     bottom: 8,
//                     left: 8,
//                     right: 8,
//                   }}
//                 >
//                   <Icon
//                     name="create-outline"
//                     size={18}
//                     color={
//                       isDark
//                         ? '#94A3B8'
//                         : '#64748B'
//                     }
//                   />
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   style={styles.actionBtn}
//                   onPress={e => {
//                     e.stopPropagation?.();
//                     handleDeleteTask(
//                       task.id
//                     );
//                   }}
//                   hitSlop={{
//                     top: 8,
//                     bottom: 8,
//                     left: 8,
//                     right: 8,
//                   }}
//                 >
//                   <Icon
//                     name="trash-outline"
//                     size={18}
//                     color="#EF4444"
//                   />
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   style={[
//                     styles.checkbox,
//                     task.isCompleted &&
//                       styles.checkboxDone,
//                   ]}
//                   onPress={e => {
//                     e.stopPropagation?.();

//                     if (
//                       !task.isCompleted
//                     ) {
//                       handleMarkDone(task);
//                     }
//                   }}
//                   hitSlop={{
//                     top: 8,
//                     bottom: 8,
//                     left: 8,
//                     right: 8,
//                   }}
//                 >
//                   {task.isCompleted && (
//                     <Icon
//                       name="checkmark"
//                       size={14}
//                       color="#FFFFFF"
//                     />
//                   )}
//                 </TouchableOpacity>
//               </View>
//             </TouchableOpacity>
//           ))
//         )}
//       </ScrollView>

//       <TouchableOpacity
//         style={styles.fab}
//         activeOpacity={0.9}
//         onPress={() =>
//           navigation.navigate(
//             selectedMode === 'location'
//               ? 'AddTaskLocationBased'
//               : 'AddTaskTimeBased'
//           )
//         }
//       >
//         <Icon
//           name="add"
//           size={28}
//           color="#FFFFFF"
//         />
//       </TouchableOpacity>

//       <View
//         style={styles.categoryContainer}
//       >
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={
//             false
//           }
//           contentContainerStyle={
//             styles.categoryScrollContent
//           }
//         >
//           <TouchableOpacity
//             key="SELF"
//             style={[
//               styles.categoryChip,
//               dynamicStyles.categoryChip,
//               dynamicStyles.activeCategoryChip,
//             ]}
//             onPress={() => {
//               console.log(
//                 'SELF category selected'
//               );
//             }}
//             activeOpacity={0.8}
//           >
//             <Text
//               style={[
//                 styles.categoryText,
//                 dynamicStyles.activeTabText,
//               ]}
//             >
//               SELF
//             </Text>
//           </TouchableOpacity>

//           {groups.map(group => (
//             <TouchableOpacity
//               key={
//                 group.id !== null
//                   ? `group-${group.id}`
//                   : `group-${group.name}`
//               }
//               style={[
//                 styles.categoryChip,
//                 dynamicStyles.categoryChip,
//               ]}
//               onPress={() =>
//                 handleCategory(group)
//               }
//               activeOpacity={0.8}
//             >
//               <Text
//                 style={[
//                   styles.categoryText,
//                   dynamicStyles.textPrimary,
//                 ]}
//               >
//                 {group.name}
//               </Text>
//             </TouchableOpacity>
//           ))}

//           <TouchableOpacity
//             style={styles.smallAddBtn}
//             onPress={() =>
//               navigation.navigate(
//                 'CreateGroup'
//               )
//             }
//             activeOpacity={0.8}
//           >
//             <Icon
//               name="add"
//               size={18}
//               color="#FFFFFF"
//             />
//           </TouchableOpacity>
//         </ScrollView>
//       </View>

//       <View
//         style={[
//           styles.bottomNav,
//           dynamicStyles.bottomNav,
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconNavBtn}
//           onPress={() =>
//             navigation.navigate(
//               'HomeDashboard'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="home"
//             size={22}
//             color="#38BDF8"
//           />
//           <Text
//             style={[
//               styles.navLabel,
//               styles.activeNavLabel,
//             ]}
//           >
//             Home
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconNavBtn}
//           onPress={() =>
//             navigation.navigate(
//               'ContactScreen'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="people-outline"
//             size={22}
//             color="#94A3B8"
//           />
//           <Text style={styles.navLabel}>
//             Contacts
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconNavBtn}
//           onPress={() =>
//             navigation.navigate(
//               'ClashTaskScreen'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="warning-outline"
//             size={22}
//             color="#94A3B8"
//           />
//           <Text style={styles.navLabel}>
//             Clashes
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconNavBtn}
//           onPress={() =>
//             navigation.navigate(
//               'TimeBasedHistoryScreen'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="time-outline"
//             size={22}
//             color="#94A3B8"
//           />
//           <Text style={styles.navLabel}>
//             History
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconNavBtn}
//           onPress={() =>
//             navigation.navigate(
//               'SettingScreen'
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="settings-outline"
//             size={22}
//             color="#94A3B8"
//           />
//           <Text style={styles.navLabel}>
//             Settings
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default HomeDashboard;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//     paddingTop:
//       Platform.OS === 'android' ? 10 : 0,
//     paddingBottom: 10,
//   },

//   iconTouchArea: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   headerBox: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//     borderWidth: 1,
//     elevation: 1,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 1,
//     },
//     shadowOpacity: 0.05,
//     shadowRadius: 2,
//   },

//   headerTitle: {
//     fontSize: 14,
//     fontWeight: '800',
//     letterSpacing: 1.2,
//   },

//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 8,
//     paddingBottom: 170,
//   },

//   tabContainer: {
//     flexDirection: 'row',
//     padding: 4,
//     borderRadius: 12,
//     marginBottom: 12,
//   },

//   tab: {
//     flex: 1,
//     paddingVertical: 10,
//     borderRadius: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   tabText: {
//     fontSize: 11,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   tabDisabled: {
//     opacity: 0.35,
//   },

//   toggleBox: {
//     flexDirection: 'row',
//     borderRadius: 12,
//     padding: 4,
//     marginBottom: 16,
//     borderWidth: 1,
//   },

//   toggleItem: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 8,
//     borderRadius: 8,
//   },

//   radioOuter: {
//     width: 16,
//     height: 16,
//     borderRadius: 8,
//     borderWidth: 2,
//     borderColor: '#94A3B8',
//     marginRight: 5,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   radioOuterActive: {
//     borderColor: '#0284C7',
//   },

//   radioInner: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#0284C7',
//   },

//   toggleText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },

//   sectionHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 12,
//   },

//   sectionTitle: {
//     fontSize: 15,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },

//   taskCountBadge: {
//     fontSize: 12,
//     fontWeight: '600',
//   },

//   stateContainer: {
//     paddingVertical: 32,
//     alignItems: 'center',
//   },

//   stateText: {
//     marginTop: 8,
//     fontSize: 13,
//   },

//   emptyStateContainer: {
//     paddingVertical: 40,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   emptyStateTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//     marginTop: 12,
//   },

//   emptyStateSub: {
//     fontSize: 12,
//     marginTop: 4,
//   },

//   card: {
//     borderRadius: 14,
//     padding: 14,
//     marginBottom: 10,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     borderWidth: 1,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.04,
//     shadowRadius: 4,
//   },

//   completedText: {
//     textDecorationLine: 'line-through',
//     opacity: 0.6,
//   },

//   completedBadgeRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 4,
//   },

//   completedBadge: {
//     fontSize: 11,
//     color: '#10B981',
//     fontWeight: '700',
//     marginLeft: 4,
//   },

//   cardLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//     marginRight: 8,
//   },

//   clock: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     borderWidth: 1.5,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   taskTextContainer: {
//     flex: 1,
//   },

//   taskTitle: {
//     fontSize: 14,
//     fontWeight: '700',
//     lineHeight: 18,
//   },

//   taskDate: {
//     fontSize: 12,
//     marginTop: 2,
//   },

//   cardActions: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   actionBtn: {
//     padding: 6,
//     marginRight: 4,
//   },

//   checkbox: {
//     width: 22,
//     height: 22,
//     borderWidth: 2,
//     borderColor: '#94A3B8',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 6,
//     marginLeft: 4,
//   },

//   checkboxDone: {
//     backgroundColor: '#10B981',
//     borderColor: '#10B981',
//   },

//   fab: {
//     position: 'absolute',
//     right: 20,
//     bottom: 125,
//     width: 54,
//     height: 54,
//     borderRadius: 27,
//     backgroundColor: '#0284C7',
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 6,
//     shadowColor: '#0284C7',
//     shadowOffset: {
//       width: 0,
//       height: 4,
//     },
//     shadowOpacity: 0.35,
//     shadowRadius: 6,
//     zIndex: 10,
//   },

//   categoryContainer: {
//     position: 'absolute',
//     bottom: 64,
//     left: 0,
//     right: 0,
//     paddingVertical: 8,
//     zIndex: 20,
//     elevation: 20,
//   },

//   categoryScrollContent: {
//     paddingHorizontal: 16,
//     alignItems: 'center',
//   },

//   categoryChip: {
//     paddingVertical: 6,
//     paddingHorizontal: 14,
//     borderRadius: 20,
//     borderWidth: 1,
//     marginRight: 8,
//   },

//   categoryText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },

//   smallAddBtn: {
//     width: 30,
//     height: 30,
//     borderRadius: 15,
//     backgroundColor: '#0284C7',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   bottomNav: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 64,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     paddingHorizontal: 8,
//     borderTopWidth: 1,
//     borderTopColor:
//       'rgba(255,255,255,0.08)',
//     zIndex: 10,
//     elevation: 10,
//   },

//   iconNavBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 6,
//   },

//   navLabel: {
//     fontSize: 10,
//     color: '#94A3B8',
//     marginTop: 2,
//     fontWeight: '500',
//   },

//   activeNavLabel: {
//     color: '#38BDF8',
//     fontWeight: '700',
//   },
// });







































// // import React, { useState, useCallback, useEffect } from 'react';
// // import {
// //   View,
// //   Text,
// //   StyleSheet,
// //   SafeAreaView,
// //   TouchableOpacity,
// //   ScrollView,
// //   StatusBar,
// //   ActivityIndicator,
// //   Alert,
// //   Platform,
// // } from 'react-native';
// // import Icon from '@react-native-vector-icons/ionicons';
// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import { useTheme } from '../../context/ThemeContext';
// // import { useFocusEffect } from '@react-navigation/native';
// // import { BASE_URL } from '../../config/api';

// // const goToLogin = navigation => {
// //   navigation.reset({
// //     index: 0,
// //     routes: [
// //       {
// //         name: 'AuthStack',
// //         state: {
// //           routes: [{ name: 'Login' }],
// //         },
// //       },
// //     ],
// //   });
// // };

// // const HomeDashboard = ({ navigation }) => {
// //   const { isDark, theme } = useTheme();

// //   const [selectedTab, setSelectedTab] = useState('ALL');
// //   const [selectedMode, setSelectedMode] = useState('time');
// //   const [tasks, setTasks] = useState([]);
// //   const [loading, setLoading] = useState(false);
// //   const [groups, setGroups] = useState([]);

// //   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

// //   const getToken = async () => {
// //     const token = await AsyncStorage.getItem('token');

// //     if (!token) {
// //       Alert.alert(
// //         'Session Expired',
// //         'Your session has expired. Please login again.',
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => goToLogin(navigation),
// //           },
// //         ]
// //       );

// //       return null;
// //     }

// //     return token;
// //   };

// //   const fetchGroups = async () => {
// //     try {
// //       const token = await getToken();

// //       if (!token) {
// //         return;
// //       }

// //       const response = await fetch(`${BASE_URL}/Task/groups`, {
// //         method: 'GET',
// //         headers: {
// //           Accept: 'application/json',
// //           Authorization: `Bearer ${token}`,
// //         },
// //       });

// //       const data = await response.json();

// //       console.log('Fetch Groups Response:', data);

// //       if (response.status === 401) {
// //         Alert.alert(
// //           'Session Expired',
// //           'Please login again.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => goToLogin(navigation),
// //             },
// //           ]
// //         );
// //         return;
// //       }

// //       if (!response.ok) {
// //         throw new Error(
// //           data?.message || 'Failed to fetch groups'
// //         );
// //       }

// //       if (data?.success) {
// //         const groupList = Array.isArray(data.data)
// //           ? data.data
// //           : [];

// //         const formattedGroups = groupList
// //           .filter(group => group && group.name)
// //           .map(group => ({
// //             id: group.id ?? group.groupId ?? null,
// //             name: String(group.name).toUpperCase(),
// //           }));

// //         setGroups(formattedGroups);

// //         console.log(
// //           'Formatted Groups:',
// //           formattedGroups
// //         );
// //       } else {
// //         setGroups([]);
// //       }
// //     } catch (error) {
// //       console.log('Fetch Groups Error:', error);
// //       setGroups([]);
// //     }
// //   };

// //   const fetchTasks = useCallback(async () => {
// //     try {
// //       setLoading(true);

// //       const token = await getToken();

// //       if (!token) {
// //         return;
// //       }

// //       const isTimeBased = selectedMode === 'time';

// //       const tabParam =
// //         selectedTab === 'ALL'
// //           ? ''
// //           : selectedTab.toLowerCase();

// //       const query =
// //         `/Task/personal?tab=${encodeURIComponent(tabParam)}` +
// //         `&isTimeBased=${isTimeBased}`;

// //       console.log(
// //         'Home Dashboard Fetch:',
// //         `${BASE_URL}${query}`
// //       );

// //       const response = await fetch(
// //         `${BASE_URL}${query}`,
// //         {
// //           method: 'GET',
// //           headers: {
// //             Accept: 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         }
// //       );

// //       const data = await response.json();

// //       console.log(
// //         'Home Dashboard Response:',
// //         data
// //       );

// //       if (response.status === 401) {
// //         Alert.alert(
// //           'Session Expired',
// //           'Please login again.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () =>
// //                 goToLogin(navigation),
// //             },
// //           ]
// //         );

// //         return;
// //       }

// //       if (!response.ok) {
// //         throw new Error(
// //           data?.message ||
// //             `Request failed with status ${response.status}`
// //         );
// //       }

// //       if (!data?.success) {
// //         throw new Error(
// //           data?.message ||
// //             'Failed to fetch dashboard tasks.'
// //         );
// //       }

// //       const fetchedTasks = Array.isArray(data.data)
// //         ? data.data
// //         : [];

// //       const dashboardTasks = fetchedTasks.filter(
// //         task =>
// //           task &&
// //           task.status !== 'Done' &&
// //           task.status !== 'Cancelled'
// //       );

// //       setTasks(dashboardTasks);

// //       console.log(
// //         'Dashboard Tasks Count:',
// //         dashboardTasks.length
// //       );

// //       if (isTimeBased) {
// //         const timeMap = {};

// //         dashboardTasks.forEach(task => {
// //           if (
// //             !task.dueDate ||
// //             !task.dueTime ||
// //             task.status === 'Done' ||
// //             task.status === 'Cancelled'
// //           ) {
// //             return;
// //           }

// //           const key =
// //             `${task.dueDate}_${task.dueTime}`;

// //           if (!timeMap[key]) {
// //             timeMap[key] = task;
// //           } else {
// //             const task1 = timeMap[key];
// //             const task2 = task;

// //             Alert.alert(
// //               '⚠️ Task Clash Detected!',
// //               `"${task1.title}" and "${task2.title}" are scheduled at the same time (${task.dueDate} ${task.dueTime}).`,
// //               [
// //                 {
// //                   text: 'View Clash',
// //                   onPress: () =>
// //                     navigation.navigate(
// //                       'ClashTaskScreen',
// //                       {
// //                         task1,
// //                         task2,
// //                       }
// //                     ),
// //                 },
// //                 {
// //                   text: 'Dismiss',
// //                   style: 'cancel',
// //                 },
// //               ]
// //             );
// //           }
// //         });
// //       }
// //     } catch (error) {
// //       console.log(
// //         'Home Dashboard Fetch Error:',
// //         error
// //       );

// //       Alert.alert(
// //         'Error',
// //         error?.message ||
// //           'Failed to fetch dashboard tasks.'
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, [
// //     selectedMode,
// //     selectedTab,
// //     navigation,
// //   ]);

// //   useFocusEffect(
// //     useCallback(() => {
// //       fetchGroups();
// //       fetchTasks();
// //     }, [fetchTasks])
// //   );

// //   useEffect(() => {
// //     const interval = setInterval(() => {
// //       tasks.forEach(task => {
// //         if (
// //           !task.dueDate ||
// //           !task.dueTime ||
// //           task.isCompleted ||
// //           !task.isTimeBased
// //         ) {
// //           return;
// //         }

// //         const taskDateTimeStr =
// //           `${task.dueDate}T${task.dueTime}:00`;

// //         const taskDate =
// //           new Date(taskDateTimeStr);

// //         const nowTime = new Date();

// //         const diffMs =
// //           taskDate.getTime() -
// //           nowTime.getTime();

// //         const diffMins =
// //           Math.round(diffMs / 60000);

// //         if (
// //           diffMins === 0 ||
// //           diffMins === 5
// //         ) {
// //           navigation.navigate(
// //             'ReminderAlarmScreen',
// //             {
// //               task,
// //               isAdvance: diffMins === 5,
// //             }
// //           );
// //         }
// //       });
// //     }, 60000);

// //     return () => clearInterval(interval);
// //   }, [tasks, navigation]);

// //   const handleMarkDone = async task => {
// //     try {
// //       const token = await getToken();

// //       if (!token) {
// //         return;
// //       }

// //       const response = await fetch(
// //         `${BASE_URL}/Task/${task.id}/done`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             Accept: 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         }
// //       );

// //       const data = await response.json();

// //       console.log(
// //         'Mark Done Response:',
// //         data
// //       );

// //       if (response.status === 401) {
// //         Alert.alert(
// //           'Session Expired',
// //           'Please login again.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () =>
// //                 goToLogin(navigation),
// //             },
// //           ]
// //         );
// //         return;
// //       }

// //       if (!response.ok || !data?.success) {
// //         throw new Error(
// //           data?.message ||
// //             'Failed to mark task as done'
// //         );
// //       }

// //       Alert.alert(
// //         '✅ Task Completed!',
// //         `"${task.title}" has been marked as done.`
// //       );

// //       fetchTasks();
// //     } catch (error) {
// //       console.log(
// //         'Mark Done Error:',
// //         error
// //       );

// //       Alert.alert(
// //         'Error',
// //         error?.message ||
// //           'Failed to mark task as done'
// //       );
// //     }
// //   };

// //   const handleDeleteTask = async taskId => {
// //     Alert.alert(
// //       'Delete Task',
// //       'Are you sure you want to delete this task?',
// //       [
// //         {
// //           text: 'Cancel',
// //           style: 'cancel',
// //         },
// //         {
// //           text: 'Delete',
// //           style: 'destructive',
// //           onPress: async () => {
// //             try {
// //               const token = await getToken();

// //               if (!token) {
// //                 return;
// //               }

// //               const response = await fetch(
// //                 `${BASE_URL}/Task/task/${taskId}`,
// //                 {
// //                   method: 'DELETE',
// //                   headers: {
// //                     Accept: 'application/json',
// //                     Authorization: `Bearer ${token}`,
// //                   },
// //                 }
// //               );

// //               const data =
// //                 await response.json();

// //               console.log(
// //                 'Delete Task Response:',
// //                 data
// //               );

// //               if (response.status === 401) {
// //                 Alert.alert(
// //                   'Session Expired',
// //                   'Please login again.',
// //                   [
// //                     {
// //                       text: 'OK',
// //                       onPress: () =>
// //                         goToLogin(navigation),
// //                     },
// //                   ]
// //                 );
// //                 return;
// //               }

// //               if (
// //                 !response.ok ||
// //                 !data?.success
// //               ) {
// //                 throw new Error(
// //                   data?.message ||
// //                     'Failed to delete task'
// //                 );
// //               }

// //               Alert.alert(
// //                 'Success',
// //                 data?.message ||
// //                   'Task deleted successfully'
// //               );

// //               fetchTasks();
// //             } catch (error) {
// //               console.log(
// //                 'Delete Task Error:',
// //                 error
// //               );

// //               Alert.alert(
// //                 'Error',
// //                 error?.message ||
// //                   'Failed to delete task'
// //               );
// //             }
// //           },
// //         },
// //       ]
// //     );
// //   };

// //   const handleCategory = group => {
// //     if (!group || !group.name) {
// //       return;
// //     }

// //     console.log(
// //       'Opening GroupDashboard:',
// //       group
// //     );

// //     navigation.navigate(
// //       'GroupDashboard',
// //       {
// //         groupId: group.id,
// //         groupName: group.name,
// //       }
// //     );
// //   };

// //   const handleEdit = task => {
// //     // Location based tasks have no date or time - they open their own editor.
// //     const isLocationBased =
// //       task?.latitude !== null &&
// //       task?.latitude !== undefined &&
// //       task?.longitude !== null &&
// //       task?.longitude !== undefined &&
// //       task?.geofenceEnabled !== false;

// //     if (isLocationBased) {
// //       navigation.navigate(
// //         'EditTaskLocationBased',
// //         {
// //           task,
// //         }
// //       );

// //       return;
// //     }

// //     if (selectedMode === 'time') {
// //       navigation.navigate(
// //         'EditTaskTimeBased',
// //         {
// //           task,
// //         }
// //       );
// //     } else {
// //       navigation.navigate(
// //         'EditTaskNonTimeBased',
// //         {
// //           task,
// //         }
// //       );
// //     }
// //   };

// //   const filteredTasks = tasks;

// //   const dynamicStyles = {
// //     container: {
// //       backgroundColor:
// //         theme.bg || '#F4F7FA',
// //     },

// //     textPrimary: {
// //       color:
// //         theme.text || '#1E293B',
// //     },

// //     textSubtle: {
// //       color:
// //         isDark
// //           ? '#94A3B8'
// //           : '#64748B',
// //     },

// //     headerBox: {
// //       backgroundColor:
// //         theme.headerBox ||
// //         (isDark
// //           ? '#1E293B'
// //           : '#FFFFFF'),
// //       borderColor:
// //         isDark
// //           ? '#334155'
// //           : '#E2E8F0',
// //     },

// //     tabContainer: {
// //       backgroundColor:
// //         theme.filterBg ||
// //         (isDark
// //           ? '#1E293B'
// //           : '#E2E8F0'),
// //     },

// //     activeTab: {
// //       backgroundColor:
// //         isDark
// //           ? '#38BDF8'
// //           : '#0284C7',
// //     },

// //     inactiveTab: {
// //       backgroundColor:
// //         'transparent',
// //     },

// //     activeTabText: {
// //       color: '#FFFFFF',
// //     },

// //     toggleBox: {
// //       backgroundColor:
// //         theme.headerBox ||
// //         (isDark
// //           ? '#1E293B'
// //           : '#FFFFFF'),
// //       borderColor:
// //         isDark
// //           ? '#334155'
// //           : '#E2E8F0',
// //     },

// //     toggleActiveBg: {
// //       backgroundColor:
// //         isDark
// //           ? '#0284C720'
// //           : '#E0F2FE',
// //     },

// //     card: {
// //       backgroundColor:
// //         theme.card ||
// //         (isDark
// //           ? '#1E293B'
// //           : '#FFFFFF'),
// //       borderColor:
// //         isDark
// //           ? '#334155'
// //           : '#E2E8F0',
// //     },

// //     completedCard: {
// //       backgroundColor:
// //         isDark
// //           ? '#0F172A'
// //           : '#F8FAFC',
// //       borderColor:
// //         isDark
// //           ? '#1E293B'
// //           : '#CBD5E1',
// //     },

// //     clockBg: {
// //       backgroundColor:
// //         isDark
// //           ? '#0F172A'
// //           : '#F1F5F9',
// //       borderColor:
// //         isDark
// //           ? '#38BDF8'
// //           : '#0284C7',
// //     },

// //     categoryChip: {
// //       backgroundColor:
// //         theme.card ||
// //         (isDark
// //           ? '#1E293B'
// //           : '#FFFFFF'),
// //       borderColor:
// //         isDark
// //           ? '#334155'
// //           : '#CBD5E1',
// //     },

// //     activeCategoryChip: {
// //       backgroundColor:
// //         isDark
// //           ? '#38BDF8'
// //           : '#0284C7',
// //       borderColor:
// //         isDark
// //           ? '#38BDF8'
// //           : '#0284C7',
// //     },

// //     bottomNav: {
// //       backgroundColor:
// //         theme.bottomNav ||
// //         '#0F172A',
// //     },
// //   };

// //   return (
// //     <SafeAreaView
// //       style={[
// //         styles.container,
// //         dynamicStyles.container,
// //       ]}
// //     >
// //       <StatusBar
// //         barStyle={
// //           isDark
// //             ? 'light-content'
// //             : 'dark-content'
// //         }
// //         backgroundColor={
// //           theme.bg ||
// //           (isDark
// //             ? '#0F172A'
// //             : '#F4F7FA')
// //         }
// //         translucent={false}
// //       />

// //       <View style={styles.header}>
// //         <TouchableOpacity
// //           style={styles.iconTouchArea}
// //           onPress={() =>
// //             navigation.goBack()
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="chevron-back"
// //             size={24}
// //             color={
// //               dynamicStyles.textPrimary
// //                 .color
// //             }
// //           />
// //         </TouchableOpacity>

// //         <View
// //           style={[
// //             styles.headerBox,
// //             dynamicStyles.headerBox,
// //           ]}
// //         >
// //           <Text
// //             style={[
// //               styles.headerTitle,
// //               dynamicStyles.textPrimary,
// //             ]}
// //           >
// //             TO-DO LIST
// //           </Text>
// //         </View>

// //         <TouchableOpacity
// //           style={styles.iconTouchArea}
// //           onPress={() =>
// //             navigation.navigate(
// //               'NotificationScreen'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="notifications-outline"
// //             size={22}
// //             color={
// //               dynamicStyles.textPrimary
// //                 .color
// //             }
// //           />
// //         </TouchableOpacity>
// //       </View>

// //       <ScrollView
// //         showsVerticalScrollIndicator={false}
// //         contentContainerStyle={
// //           styles.scrollContent
// //         }
// //       >
// //         <View
// //           style={[
// //             styles.tabContainer,
// //             dynamicStyles.tabContainer,
// //           ]}
// //         >
// //           {tabs.map(tab => {
// //             const isActive =
// //               selectedTab === tab;

// //             return (
// //               <TouchableOpacity
// //                 key={tab}
// //                 style={[
// //                   styles.tab,
// //                   isActive
// //                     ? dynamicStyles.activeTab
// //                     : dynamicStyles.inactiveTab,
// //                 ]}
// //                 onPress={() =>
// //                   setSelectedTab(tab)
// //                 }
// //                 activeOpacity={0.8}
// //               >
// //                 <Text
// //                   style={[
// //                     styles.tabText,
// //                     isActive
// //                       ? dynamicStyles.activeTabText
// //                       : dynamicStyles.textSubtle,
// //                   ]}
// //                 >
// //                   {tab}
// //                 </Text>
// //               </TouchableOpacity>
// //             );
// //           })}
// //         </View>

// //         <View
// //           style={[
// //             styles.toggleBox,
// //             dynamicStyles.toggleBox,
// //           ]}
// //         >
// //           <TouchableOpacity
// //             onPress={() =>
// //               setSelectedMode('time')
// //             }
// //             style={[
// //               styles.toggleItem,
// //               selectedMode === 'time' &&
// //                 dynamicStyles.toggleActiveBg,
// //             ]}
// //             activeOpacity={0.8}
// //           >
// //             <View
// //               style={[
// //                 styles.radioOuter,
// //                 selectedMode === 'time' &&
// //                   styles.radioOuterActive,
// //               ]}
// //             >
// //               {selectedMode === 'time' && (
// //                 <View
// //                   style={styles.radioInner}
// //                 />
// //               )}
// //             </View>

// //             <Text
// //               style={[
// //                 styles.toggleText,
// //                 dynamicStyles.textPrimary,
// //               ]}
// //             >
// //               Time Based
// //             </Text>
// //           </TouchableOpacity>

// //           <TouchableOpacity
// //             onPress={() =>
// //               setSelectedMode('non')
// //             }
// //             style={[
// //               styles.toggleItem,
// //               selectedMode === 'non' &&
// //                 dynamicStyles.toggleActiveBg,
// //             ]}
// //             activeOpacity={0.8}
// //           >
// //             <View
// //               style={[
// //                 styles.radioOuter,
// //                 selectedMode === 'non' &&
// //                   styles.radioOuterActive,
// //               ]}
// //             >
// //               {selectedMode === 'non' && (
// //                 <View
// //                   style={styles.radioInner}
// //                 />
// //               )}
// //             </View>

// //             <Text
// //               style={[
// //                 styles.toggleText,
// //                 dynamicStyles.textPrimary,
// //               ]}
// //             >
// //               Non Time Based
// //             </Text>
// //           </TouchableOpacity>
// //         </View>

// //         <View style={styles.sectionHeader}>
// //           <Text
// //             style={[
// //               styles.sectionTitle,
// //               dynamicStyles.textPrimary,
// //             ]}
// //           >
// //             SELF
// //           </Text>

// //           <Text
// //             style={[
// //               styles.taskCountBadge,
// //               dynamicStyles.textSubtle,
// //             ]}
// //           >
// //             {filteredTasks.length}{' '}
// //             {filteredTasks.length === 1
// //               ? 'task'
// //               : 'tasks'}
// //           </Text>
// //         </View>

// //         {loading ? (
// //           <View
// //             style={styles.stateContainer}
// //           >
// //             <ActivityIndicator
// //               size="large"
// //               color={
// //                 isDark
// //                   ? '#38BDF8'
// //                   : '#0284C7'
// //               }
// //             />

// //             <Text
// //               style={[
// //                 styles.stateText,
// //                 dynamicStyles.textSubtle,
// //               ]}
// //             >
// //               Loading tasks...
// //             </Text>
// //           </View>
// //         ) : filteredTasks.length === 0 ? (
// //           <View
// //             style={
// //               styles.emptyStateContainer
// //             }
// //           >
// //             <Icon
// //               name="checkmark-done-circle-outline"
// //               size={56}
// //               color={
// //                 isDark
// //                   ? '#475569'
// //                   : '#CBD5E1'
// //               }
// //             />

// //             <Text
// //               style={[
// //                 styles.emptyStateTitle,
// //                 dynamicStyles.textPrimary,
// //               ]}
// //             >
// //               No tasks found
// //             </Text>

// //             <Text
// //               style={[
// //                 styles.emptyStateSub,
// //                 dynamicStyles.textSubtle,
// //               ]}
// //             >
// //               You have no pending items in
// //               this view.
// //             </Text>
// //           </View>
// //         ) : (
// //           filteredTasks.map(task => (
// //             <TouchableOpacity
// //               key={task.id}
// //               style={[
// //                 styles.card,
// //                 dynamicStyles.card,
// //                 task.isCompleted &&
// //                   dynamicStyles.completedCard,
// //               ]}
// //               activeOpacity={0.85}
// //               onPress={() =>
// //                 navigation.navigate(
// //                   'TaskOverviewScreen',
// //                   {
// //                     task,
// //                   }
// //                 )
// //               }
// //             >
// //               <View
// //                 style={styles.cardLeft}
// //               >
// //                 <View
// //                   style={[
// //                     styles.clock,
// //                     dynamicStyles.clockBg,
// //                   ]}
// //                 >
// //                   <Icon
// //                     name={
// //                       selectedMode === 'time'
// //                         ? 'time-outline'
// //                         : 'list-outline'
// //                     }
// //                     size={18}
// //                     color={
// //                       isDark
// //                         ? '#38BDF8'
// //                         : '#0284C7'
// //                     }
// //                   />
// //                 </View>

// //                 <View
// //                   style={
// //                     styles.taskTextContainer
// //                   }
// //                 >
// //                   <Text
// //                     style={[
// //                       styles.taskTitle,
// //                       dynamicStyles.textPrimary,
// //                       task.isCompleted &&
// //                         styles.completedText,
// //                     ]}
// //                     numberOfLines={2}
// //                   >
// //                     {task.title}
// //                   </Text>

// //                   <Text
// //                     style={[
// //                       styles.taskDate,
// //                       dynamicStyles.textSubtle,
// //                     ]}
// //                   >
// //                     {task.dueDate
// //                       ? `${task.dueDate} ${
// //                           task.dueTime || ''
// //                         }`.trim()
// //                       : 'No Due Date'}
// //                   </Text>

// //                   {task.isCompleted && (
// //                     <View
// //                       style={
// //                         styles.completedBadgeRow
// //                       }
// //                     >
// //                       <Icon
// //                         name="checkmark-circle"
// //                         size={12}
// //                         color="#10B981"
// //                       />

// //                       <Text
// //                         style={
// //                           styles.completedBadge
// //                         }
// //                       >
// //                         Completed
// //                       </Text>
// //                     </View>
// //                   )}
// //                 </View>
// //               </View>

// //               <View
// //                 style={styles.cardActions}
// //               >
// //                 <TouchableOpacity
// //                   style={styles.actionBtn}
// //                   onPress={e => {
// //                     e.stopPropagation?.();
// //                     handleEdit(task);
// //                   }}
// //                   hitSlop={{
// //                     top: 8,
// //                     bottom: 8,
// //                     left: 8,
// //                     right: 8,
// //                   }}
// //                 >
// //                   <Icon
// //                     name="create-outline"
// //                     size={18}
// //                     color={
// //                       isDark
// //                         ? '#94A3B8'
// //                         : '#64748B'
// //                     }
// //                   />
// //                 </TouchableOpacity>

// //                 <TouchableOpacity
// //                   style={styles.actionBtn}
// //                   onPress={e => {
// //                     e.stopPropagation?.();
// //                     handleDeleteTask(
// //                       task.id
// //                     );
// //                   }}
// //                   hitSlop={{
// //                     top: 8,
// //                     bottom: 8,
// //                     left: 8,
// //                     right: 8,
// //                   }}
// //                 >
// //                   <Icon
// //                     name="trash-outline"
// //                     size={18}
// //                     color="#EF4444"
// //                   />
// //                 </TouchableOpacity>

// //                 <TouchableOpacity
// //                   style={[
// //                     styles.checkbox,
// //                     task.isCompleted &&
// //                       styles.checkboxDone,
// //                   ]}
// //                   onPress={e => {
// //                     e.stopPropagation?.();

// //                     if (
// //                       !task.isCompleted
// //                     ) {
// //                       handleMarkDone(task);
// //                     }
// //                   }}
// //                   hitSlop={{
// //                     top: 8,
// //                     bottom: 8,
// //                     left: 8,
// //                     right: 8,
// //                   }}
// //                 >
// //                   {task.isCompleted && (
// //                     <Icon
// //                       name="checkmark"
// //                       size={14}
// //                       color="#FFFFFF"
// //                     />
// //                   )}
// //                 </TouchableOpacity>
// //               </View>
// //             </TouchableOpacity>
// //           ))
// //         )}
// //       </ScrollView>

// //       <TouchableOpacity
// //         style={styles.fab}
// //         activeOpacity={0.9}
// //         onPress={() =>
// //           navigation.navigate(
// //             'AddTaskTimeBased'
// //           )
// //         }
// //       >
// //         <Icon
// //           name="add"
// //           size={28}
// //           color="#FFFFFF"
// //         />
// //       </TouchableOpacity>

// //       <View
// //         style={styles.categoryContainer}
// //       >
// //         <ScrollView
// //           horizontal
// //           showsHorizontalScrollIndicator={
// //             false
// //           }
// //           contentContainerStyle={
// //             styles.categoryScrollContent
// //           }
// //         >
// //           <TouchableOpacity
// //             key="SELF"
// //             style={[
// //               styles.categoryChip,
// //               dynamicStyles.categoryChip,
// //               dynamicStyles.activeCategoryChip,
// //             ]}
// //             onPress={() => {
// //               console.log(
// //                 'SELF category selected'
// //               );
// //             }}
// //             activeOpacity={0.8}
// //           >
// //             <Text
// //               style={[
// //                 styles.categoryText,
// //                 dynamicStyles.activeTabText,
// //               ]}
// //             >
// //               SELF
// //             </Text>
// //           </TouchableOpacity>

// //           {groups.map(group => (
// //             <TouchableOpacity
// //               key={
// //                 group.id !== null
// //                   ? `group-${group.id}`
// //                   : `group-${group.name}`
// //               }
// //               style={[
// //                 styles.categoryChip,
// //                 dynamicStyles.categoryChip,
// //               ]}
// //               onPress={() =>
// //                 handleCategory(group)
// //               }
// //               activeOpacity={0.8}
// //             >
// //               <Text
// //                 style={[
// //                   styles.categoryText,
// //                   dynamicStyles.textPrimary,
// //                 ]}
// //               >
// //                 {group.name}
// //               </Text>
// //             </TouchableOpacity>
// //           ))}

// //           <TouchableOpacity
// //             style={styles.smallAddBtn}
// //             onPress={() =>
// //               navigation.navigate(
// //                 'CreateGroup'
// //               )
// //             }
// //             activeOpacity={0.8}
// //           >
// //             <Icon
// //               name="add"
// //               size={18}
// //               color="#FFFFFF"
// //             />
// //           </TouchableOpacity>
// //         </ScrollView>
// //       </View>

// //       <View
// //         style={[
// //           styles.bottomNav,
// //           dynamicStyles.bottomNav,
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconNavBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'HomeDashboard'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="home"
// //             size={22}
// //             color="#38BDF8"
// //           />
// //           <Text
// //             style={[
// //               styles.navLabel,
// //               styles.activeNavLabel,
// //             ]}
// //           >
// //             Home
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconNavBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'ContactScreen'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="people-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />
// //           <Text style={styles.navLabel}>
// //             Contacts
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconNavBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'ClashTaskScreen'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="warning-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />
// //           <Text style={styles.navLabel}>
// //             Clashes
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconNavBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'TimeBasedHistoryScreen'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="time-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />
// //           <Text style={styles.navLabel}>
// //             History
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconNavBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'SettingScreen'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="settings-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />
// //           <Text style={styles.navLabel}>
// //             Settings
// //           </Text>
// //         </TouchableOpacity>
// //       </View>
// //     </SafeAreaView>
// //   );
// // };

// // export default HomeDashboard;

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //   },

// //   header: {
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     paddingHorizontal: 16,
// //     paddingTop:
// //       Platform.OS === 'android' ? 10 : 0,
// //     paddingBottom: 10,
// //   },

// //   iconTouchArea: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   headerBox: {
// //     paddingHorizontal: 16,
// //     paddingVertical: 8,
// //     borderRadius: 20,
// //     borderWidth: 1,
// //     elevation: 1,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: 1,
// //     },
// //     shadowOpacity: 0.05,
// //     shadowRadius: 2,
// //   },

// //   headerTitle: {
// //     fontSize: 14,
// //     fontWeight: '800',
// //     letterSpacing: 1.2,
// //   },

// //   scrollContent: {
// //     paddingHorizontal: 16,
// //     paddingTop: 8,
// //     paddingBottom: 170,
// //   },

// //   tabContainer: {
// //     flexDirection: 'row',
// //     padding: 4,
// //     borderRadius: 12,
// //     marginBottom: 12,
// //   },

// //   tab: {
// //     flex: 1,
// //     paddingVertical: 10,
// //     borderRadius: 8,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   tabText: {
// //     fontSize: 11,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },

// //   toggleBox: {
// //     flexDirection: 'row',
// //     borderRadius: 12,
// //     padding: 4,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //   },

// //   toggleItem: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 8,
// //     borderRadius: 8,
// //   },

// //   radioOuter: {
// //     width: 16,
// //     height: 16,
// //     borderRadius: 8,
// //     borderWidth: 2,
// //     borderColor: '#94A3B8',
// //     marginRight: 8,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   radioOuterActive: {
// //     borderColor: '#0284C7',
// //   },

// //   radioInner: {
// //     width: 8,
// //     height: 8,
// //     borderRadius: 4,
// //     backgroundColor: '#0284C7',
// //   },

// //   toggleText: {
// //     fontSize: 13,
// //     fontWeight: '600',
// //   },

// //   sectionHeader: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     marginBottom: 12,
// //   },

// //   sectionTitle: {
// //     fontSize: 15,
// //     fontWeight: '800',
// //     letterSpacing: 0.5,
// //   },

// //   taskCountBadge: {
// //     fontSize: 12,
// //     fontWeight: '600',
// //   },

// //   stateContainer: {
// //     paddingVertical: 32,
// //     alignItems: 'center',
// //   },

// //   stateText: {
// //     marginTop: 8,
// //     fontSize: 13,
// //   },

// //   emptyStateContainer: {
// //     paddingVertical: 40,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   emptyStateTitle: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     marginTop: 12,
// //   },

// //   emptyStateSub: {
// //     fontSize: 12,
// //     marginTop: 4,
// //   },

// //   card: {
// //     borderRadius: 14,
// //     padding: 14,
// //     marginBottom: 10,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     borderWidth: 1,
// //     elevation: 2,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: 2,
// //     },
// //     shadowOpacity: 0.04,
// //     shadowRadius: 4,
// //   },

// //   completedText: {
// //     textDecorationLine: 'line-through',
// //     opacity: 0.6,
// //   },

// //   completedBadgeRow: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     marginTop: 4,
// //   },

// //   completedBadge: {
// //     fontSize: 11,
// //     color: '#10B981',
// //     fontWeight: '700',
// //     marginLeft: 4,
// //   },

// //   cardLeft: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     flex: 1,
// //     marginRight: 8,
// //   },

// //   clock: {
// //     width: 36,
// //     height: 36,
// //     borderRadius: 18,
// //     borderWidth: 1.5,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     marginRight: 12,
// //   },

// //   taskTextContainer: {
// //     flex: 1,
// //   },

// //   taskTitle: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     lineHeight: 18,
// //   },

// //   taskDate: {
// //     fontSize: 12,
// //     marginTop: 2,
// //   },

// //   cardActions: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //   },

// //   actionBtn: {
// //     padding: 6,
// //     marginRight: 4,
// //   },

// //   checkbox: {
// //     width: 22,
// //     height: 22,
// //     borderWidth: 2,
// //     borderColor: '#94A3B8',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     borderRadius: 6,
// //     marginLeft: 4,
// //   },

// //   checkboxDone: {
// //     backgroundColor: '#10B981',
// //     borderColor: '#10B981',
// //   },

// //   fab: {
// //     position: 'absolute',
// //     right: 20,
// //     bottom: 125,
// //     width: 54,
// //     height: 54,
// //     borderRadius: 27,
// //     backgroundColor: '#0284C7',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     elevation: 6,
// //     shadowColor: '#0284C7',
// //     shadowOffset: {
// //       width: 0,
// //       height: 4,
// //     },
// //     shadowOpacity: 0.35,
// //     shadowRadius: 6,
// //     zIndex: 10,
// //   },

// //   categoryContainer: {
// //     position: 'absolute',
// //     bottom: 64,
// //     left: 0,
// //     right: 0,
// //     paddingVertical: 8,
// //     zIndex: 20,
// //     elevation: 20,
// //   },

// //   categoryScrollContent: {
// //     paddingHorizontal: 16,
// //     alignItems: 'center',
// //   },

// //   categoryChip: {
// //     paddingVertical: 6,
// //     paddingHorizontal: 14,
// //     borderRadius: 20,
// //     borderWidth: 1,
// //     marginRight: 8,
// //   },

// //   categoryText: {
// //     fontSize: 12,
// //     fontWeight: '700',
// //   },

// //   smallAddBtn: {
// //     width: 30,
// //     height: 30,
// //     borderRadius: 15,
// //     backgroundColor: '#0284C7',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   bottomNav: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 64,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     paddingHorizontal: 8,
// //     borderTopWidth: 1,
// //     borderTopColor:
// //       'rgba(255,255,255,0.08)',
// //     zIndex: 10,
// //     elevation: 10,
// //   },

// //   iconNavBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 6,
// //   },

// //   navLabel: {
// //     fontSize: 10,
// //     color: '#94A3B8',
// //     marginTop: 2,
// //     fontWeight: '500',
// //   },

// //   activeNavLabel: {
// //     color: '#38BDF8',
// //     fontWeight: '700',
// //   },
// // });





























// // // import React, { useState, useCallback, useEffect } from 'react';
// // // import {
// // //   View,
// // //   Text,
// // //   StyleSheet,
// // //   SafeAreaView,
// // //   TouchableOpacity,
// // //   ScrollView,
// // //   StatusBar,
// // //   ActivityIndicator,
// // //   Alert,
// // // } from 'react-native';
// // // import Icon from '@react-native-vector-icons/ionicons';
// // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // import { useTheme } from '../../context/ThemeContext';
// // // import { useFocusEffect } from '@react-navigation/native';
// // // import { BASE_URL } from '../../config/api';

// // // // ============================================================
// // // // Helper: reset navigation to the Login screen inside AuthStack.
// // // // 'Login' is NOT a screen in the root navigator (only 'AuthStack'
// // // // and 'MainStack' are), so navigation.replace('Login') / .navigate('Login')
// // // // from anywhere inside MainStack will always throw:
// // // //   "The action 'REPLACE' with payload {"name":"Login"} was not
// // // //    handled by any navigator."
// // // // Resetting to 'AuthStack' with a nested route to 'Login' is the
// // // // correct way to jump straight to the Login screen from here.
// // // // ============================================================
// // // const goToLogin = navigation => {
// // //   navigation.reset({
// // //     index: 0,
// // //     routes: [
// // //       {
// // //         name: 'AuthStack',
// // //         state: {
// // //           routes: [{ name: 'Login' }],
// // //         },
// // //       },
// // //     ],
// // //   });
// // // };

// // // const HomeDashboard = ({ navigation }) => {
// // //   const { isDark, theme } = useTheme();

// // //   const [selectedTab, setSelectedTab] = useState('ALL');
// // //   const [selectedMode, setSelectedMode] = useState('time');
// // //   const [tasks, setTasks] = useState([]);
// // //   const [loading, setLoading] = useState(false);
// // //   const [allGroupNames, setAllGroupNames] = useState([]);

// // //   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

// // //   // SELF is always first; the rest come dynamically from the API
// // //   const categories = ['SELF', ...allGroupNames];

// // //   // ============================================================
// // //   // GET JWT TOKEN
// // //   // ============================================================
// // //   const getToken = async () => {
// // //     // IMPORTANT: LoginScreen saves the token under the key "token"
// // //     // (AsyncStorage.setItem("token", userData.token)).
// // //     // This was previously reading "jwtToken", a key that is never
// // //     // written anywhere, so this always returned null — triggering
// // //     // "Session Expired" immediately after every login.
// // //     const token = await AsyncStorage.getItem('token');

// // //     if (!token) {
// // //       Alert.alert(
// // //         'Session Expired',
// // //         'Your session has expired. Please login again.',
// // //         [
// // //           {
// // //             text: 'OK',
// // //             onPress: () => goToLogin(navigation),
// // //           },
// // //         ]
// // //       );

// // //       return null;
// // //     }

// // //     return token;
// // //   };

// // //   // ============================================================
// // //   // FETCH GROUPS
// // //   // ============================================================
// // //   const fetchGroups = async () => {
// // //     try {
// // //       const token = await getToken();

// // //       if (!token) {
// // //         return;
// // //       }

// // //       // NOTE: backend route is "api/Task/groups", not "api/groups"
// // //       // (TaskController's route base is "api/Task"). Calling the
// // //       // wrong URL hit a 404 with an EMPTY body, which is what caused
// // //       // "JSON Parse error: Unexpected end of input" — there was
// // //       // nothing for response.json() to parse.
// // //       const response = await fetch(`${BASE_URL}/Task/groups`, {
// // //         method: 'GET',
// // //         headers: {
// // //           Accept: 'application/json',
// // //           Authorization: `Bearer ${token}`,
// // //         },
// // //       });

// // //       const data = await response.json();

// // //       console.log('Fetch Groups Response:', data);

// // //       if (response.status === 401) {
// // //         Alert.alert(
// // //           'Session Expired',
// // //           'Please login again.',
// // //           [
// // //             {
// // //               text: 'OK',
// // //               onPress: () => goToLogin(navigation),
// // //             },
// // //           ]
// // //         );
// // //         return;
// // //       }

// // //       if (response.ok && data?.success) {
// // //         // All group names from DB — fully dynamic
// // //         const names = (data.data || [])
// // //           .map(group => group?.name)
// // //           .filter(Boolean)
// // //           .map(name => name.toUpperCase());

// // //         setAllGroupNames(names);
// // //       } else {
// // //         console.log(
// // //           'Fetch Groups Failed:',
// // //           data?.message || 'Failed to fetch groups'
// // //         );
// // //       }
// // //     } catch (error) {
// // //       console.log('Fetch Groups Error:', error);
// // //     }
// // //   };

// // //   // ============================================================
// // //   // FETCH TASKS
// // //   // ============================================================
// // //   const fetchTasks = useCallback(async () => {
// // //     try {
// // //       setLoading(true);

// // //       const token = await getToken();

// // //       if (!token) {
// // //         return;
// // //       }

// // //       const isTimeBased = selectedMode === 'time';

// // //       const tabParam =
// // //         selectedTab === 'ALL'
// // //           ? ''
// // //           : selectedTab.toLowerCase();

// // //       // NOTE: backend route is "api/Task/personal" (personal/SELF
// // //       // tasks, GroupId == null), which is also the only endpoint
// // //       // that supports the tab (today/pending/upcoming) filter —
// // //       // "api/tasks" does not exist on the backend at all.
// // //       const query = `/Task/personal?tab=${encodeURIComponent(
// // //         tabParam
// // //       )}&isTimeBased=${isTimeBased}`;

// // //       console.log('Fetching Tasks:', `${BASE_URL}${query}`);

// // //       const response = await fetch(`${BASE_URL}${query}`, {
// // //         method: 'GET',
// // //         headers: {
// // //           Accept: 'application/json',
// // //           Authorization: `Bearer ${token}`,
// // //         },
// // //       });

// // //       const data = await response.json();

// // //       console.log('Fetch Tasks Response:', data);

// // //       if (response.status === 401) {
// // //         Alert.alert(
// // //           'Session Expired',
// // //           'Please login again.',
// // //           [
// // //             {
// // //               text: 'OK',
// // //               onPress: () => goToLogin(navigation),
// // //             },
// // //           ]
// // //         );
// // //         return;
// // //       }

// // //       if (!response.ok) {
// // //         throw new Error(
// // //           data?.message || `Request failed with status ${response.status}`
// // //         );
// // //       }

// // //       if (data?.success) {
// // //         const fetchedTasks = data.data || [];

// // //         setTasks(fetchedTasks);

// // //         // ======================================================
// // //         // CLASH DETECTION
// // //         // ======================================================
// // //         if (isTimeBased) {
// // //           const timeMap = {};

// // //           fetchedTasks.forEach(task => {
// // //             if (
// // //               task.dueDate &&
// // //               task.dueTime &&
// // //               !task.isCompleted
// // //             ) {
// // //               const key = `${task.dueDate}_${task.dueTime}`;

// // //               if (!timeMap[key]) {
// // //                 timeMap[key] = task;
// // //               } else {
// // //                 // Found a clash
// // //                 const task1 = timeMap[key];
// // //                 const task2 = task;

// // //                 Alert.alert(
// // //                   '⚠️ Task Clash Detected!',
// // //                   `"${task1.title}" and "${task2.title}" are scheduled at the same time (${task.dueDate} ${task.dueTime}).`,
// // //                   [
// // //                     {
// // //                       text: 'View Clash',
// // //                       onPress: () =>
// // //                         navigation.navigate(
// // //                           'ClashTaskScreen',
// // //                           {
// // //                             task1,
// // //                             task2,
// // //                           }
// // //                         ),
// // //                     },
// // //                     {
// // //                       text: 'Dismiss',
// // //                       style: 'cancel',
// // //                     },
// // //                   ]
// // //                 );
// // //               }
// // //             }
// // //           });
// // //         }
// // //       } else {
// // //         Alert.alert(
// // //           'Error',
// // //           data?.message || 'Failed to fetch tasks'
// // //         );
// // //       }
// // //     } catch (error) {
// // //       console.log('Fetch Tasks Error:', error);

// // //       Alert.alert(
// // //         'Error',
// // //         error?.message || 'Failed to fetch tasks'
// // //       );
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   }, [selectedMode, selectedTab]);

// // //   // ============================================================
// // //   // SCREEN FOCUS
// // //   // ============================================================
// // //   useFocusEffect(
// // //     useCallback(() => {
// // //       fetchGroups();
// // //       fetchTasks();
// // //     }, [fetchTasks])
// // //   );

// // //   // ============================================================
// // //   // REFRESH TASKS WHEN TAB / MODE CHANGES
// // //   // ============================================================
// // //   useEffect(() => {
// // //     fetchTasks();
// // //   }, [fetchTasks]);

// // //   // ============================================================
// // //   // REMINDER ALARM POPUP
// // //   // ============================================================
// // //   useEffect(() => {
// // //     const interval = setInterval(() => {
// // //       tasks.forEach(task => {
// // //         if (
// // //           !task.dueDate ||
// // //           !task.dueTime ||
// // //           task.isCompleted ||
// // //           !task.isTimeBased
// // //         ) {
// // //           return;
// // //         }

// // //         // Task date/time
// // //         const taskDateTimeStr = `${task.dueDate}T${task.dueTime}:00`;
// // //         const taskDate = new Date(taskDateTimeStr);

// // //         // Current date/time
// // //         const nowTime = new Date();

// // //         // Difference in milliseconds
// // //         const diffMs =
// // //           taskDate.getTime() - nowTime.getTime();

// // //         // Difference in minutes
// // //         const diffMins = Math.round(diffMs / 60000);

// // //         // Trigger at exact time OR 5 minutes before
// // //         if (diffMins === 0 || diffMins === 5) {
// // //           navigation.navigate('ReminderAlarmScreen', {
// // //             task,
// // //             isAdvance: diffMins === 5,
// // //           });
// // //         }
// // //       });
// // //     }, 60000);

// // //     return () => clearInterval(interval);
// // //   }, [tasks, navigation]);

// // //   // ============================================================
// // //   // MARK TASK AS DONE
// // //   // ============================================================
// // //   const handleMarkDone = async task => {
// // //     try {
// // //       const token = await getToken();

// // //       if (!token) {
// // //         return;
// // //       }

// // //       // NOTE: correct route is "api/Task/{id}/done", not "api/tasks/{id}/done"
// // //       const response = await fetch(
// // //         `${BASE_URL}/Task/${task.id}/done`,
// // //         {
// // //           method: 'POST',
// // //           headers: {
// // //             Accept: 'application/json',
// // //             Authorization: `Bearer ${token}`,
// // //           },
// // //         }
// // //       );

// // //       const data = await response.json();

// // //       console.log('Mark Done Response:', data);

// // //       if (response.status === 401) {
// // //         Alert.alert(
// // //           'Session Expired',
// // //           'Please login again.',
// // //           [
// // //             {
// // //               text: 'OK',
// // //               onPress: () => goToLogin(navigation),
// // //             },
// // //           ]
// // //         );
// // //         return;
// // //       }

// // //       if (!response.ok || !data?.success) {
// // //         throw new Error(
// // //           data?.message || 'Failed to mark task as done'
// // //         );
// // //       }

// // //       Alert.alert(
// // //         '✅ Task Completed!',
// // //         `"${task.title}" has been marked as done.`
// // //       );

// // //       fetchTasks();
// // //     } catch (error) {
// // //       console.log('Mark Done Error:', error);

// // //       Alert.alert(
// // //         'Error',
// // //         error?.message || 'Failed to mark task as done'
// // //       );
// // //     }
// // //   };

// // //   // ============================================================
// // //   // DELETE TASK
// // //   // ============================================================
// // //   const handleDeleteTask = async taskId => {
// // //     Alert.alert(
// // //       'Delete Task',
// // //       'Are you sure you want to delete this task?',
// // //       [
// // //         {
// // //           text: 'Cancel',
// // //           style: 'cancel',
// // //         },
// // //         {
// // //           text: 'Delete',
// // //           style: 'destructive',
// // //           onPress: async () => {
// // //             try {
// // //               const token = await getToken();

// // //               if (!token) {
// // //                 return;
// // //               }

// // //               // NOTE: correct route is "api/Task/task/{id}", not "api/tasks/{id}"
// // //               const response = await fetch(
// // //                 `${BASE_URL}/Task/task/${taskId}`,
// // //                 {
// // //                   method: 'DELETE',
// // //                   headers: {
// // //                     Accept: 'application/json',
// // //                     Authorization: `Bearer ${token}`,
// // //                   },
// // //                 }
// // //               );

// // //               const data = await response.json();

// // //               console.log('Delete Task Response:', data);

// // //               if (response.status === 401) {
// // //                 Alert.alert(
// // //                   'Session Expired',
// // //                   'Please login again.',
// // //                   [
// // //                     {
// // //                       text: 'OK',
// // //                       onPress: () => goToLogin(navigation),
// // //                     },
// // //                   ]
// // //                 );
// // //                 return;
// // //               }

// // //               if (!response.ok || !data?.success) {
// // //                 throw new Error(
// // //                   data?.message || 'Failed to delete task'
// // //                 );
// // //               }

// // //               Alert.alert(
// // //                 'Success',
// // //                 data?.message || 'Task deleted successfully'
// // //               );

// // //               fetchTasks();
// // //             } catch (error) {
// // //               console.log('Delete Task Error:', error);

// // //               Alert.alert(
// // //                 'Error',
// // //                 error?.message || 'Failed to delete task'
// // //               );
// // //             }
// // //           },
// // //         },
// // //       ]
// // //     );
// // //   };

// // //   // ============================================================
// // //   // CATEGORY NAVIGATION
// // //   // ============================================================
// // //   const handleCategory = cat => {
// // //     if (cat !== 'SELF') {
// // //       navigation.navigate('GroupDashboard', {
// // //         groupName: cat,
// // //       });
// // //     }
// // //   };

// // //   // ============================================================
// // //   // EDIT TASK
// // //   // ============================================================
// // //   const handleEdit = task => {
// // //     if (selectedMode === 'time') {
// // //       navigation.navigate('EditTaskTimeBased', {
// // //         task,
// // //       });
// // //     } else {
// // //       navigation.navigate('EditTaskNonTimeBased', {
// // //         task,
// // //       });
// // //     }
// // //   };

// // //   const filteredTasks = tasks;

// // //   return (
// // //     <SafeAreaView
// // //       style={[
// // //         styles.container,
// // //         {
// // //           backgroundColor: theme.bg,
// // //         },
// // //       ]}
// // //     >
// // //       <StatusBar
// // //         barStyle={isDark ? 'light-content' : 'dark-content'}
// // //         backgroundColor="#B7C9DB"
// // //       />

// // //       {/* HEADER */}
// // //       <View style={styles.header}>
// // //         <TouchableOpacity
// // //           onPress={() => navigation.goBack()}
// // //         >
// // //           <Icon
// // //             name="arrow-back"
// // //             size={22}
// // //             color={theme.text}
// // //           />
// // //         </TouchableOpacity>

// // //         <View
// // //           style={[
// // //             styles.headerBox,
// // //             {
// // //               backgroundColor: theme.headerBox,
// // //             },
// // //           ]}
// // //         >
// // //           <Text
// // //             style={[
// // //               styles.headerTitle,
// // //               {
// // //                 color: theme.text,
// // //               },
// // //             ]}
// // //           >
// // //             TO-DO-LIST
// // //           </Text>
// // //         </View>

// // //         <TouchableOpacity
// // //           onPress={() =>
// // //             navigation.navigate('NotificationScreen')
// // //           }
// // //         >
// // //           <Icon
// // //             name="notifications-outline"
// // //             size={22}
// // //             color={theme.text}
// // //           />
// // //         </TouchableOpacity>
// // //       </View>

// // //       <ScrollView
// // //         contentContainerStyle={{
// // //           paddingBottom: 180,
// // //         }}
// // //       >
// // //         {/* TABS */}
// // //         <View
// // //           style={[
// // //             styles.tabContainer,
// // //             {
// // //               backgroundColor: theme.filterBg,
// // //             },
// // //           ]}
// // //         >
// // //           {tabs.map(tab => (
// // //             <TouchableOpacity
// // //               key={tab}
// // //               style={[
// // //                 styles.tab,
// // //                 selectedTab === tab && styles.activeTab,
// // //                 {
// // //                   backgroundColor: theme.card,
// // //                 },
// // //               ]}
// // //               onPress={() => setSelectedTab(tab)}
// // //             >
// // //               <Text
// // //                 style={[
// // //                   styles.tabText,
// // //                   {
// // //                     color: theme.text,
// // //                   },
// // //                 ]}
// // //               >
// // //                 {tab}
// // //               </Text>
// // //             </TouchableOpacity>
// // //           ))}
// // //         </View>

// // //         {/* TYPE */}
// // //         <View
// // //           style={[
// // //             styles.toggleBox,
// // //             {
// // //               backgroundColor: theme.headerBox,
// // //             },
// // //           ]}
// // //         >
// // //           <TouchableOpacity
// // //             onPress={() => setSelectedMode('time')}
// // //             style={styles.toggleItem}
// // //           >
// // //             <View style={styles.radioOuter}>
// // //               {selectedMode === 'time' && (
// // //                 <View style={styles.radioInner} />
// // //               )}
// // //             </View>

// // //             <Text style={{ color: theme.text }}>
// // //               Time Based
// // //             </Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity
// // //             onPress={() => setSelectedMode('non')}
// // //             style={styles.toggleItem}
// // //           >
// // //             <View style={styles.radioOuter}>
// // //               {selectedMode === 'non' && (
// // //                 <View style={styles.radioInner} />
// // //               )}
// // //             </View>

// // //             <Text style={{ color: theme.text }}>
// // //               Non Time Based
// // //             </Text>
// // //           </TouchableOpacity>
// // //         </View>

// // //         <Text
// // //           style={[
// // //             styles.section,
// // //             {
// // //               color: theme.text,
// // //             },
// // //           ]}
// // //         >
// // //           SELF:
// // //         </Text>

// // //         {/* TASK LIST */}
// // //         {loading ? (
// // //           <ActivityIndicator
// // //             size="large"
// // //             color={theme.text}
// // //             style={{
// // //               marginTop: 20,
// // //             }}
// // //           />
// // //         ) : filteredTasks.length === 0 ? (
// // //           <Text
// // //             style={{
// // //               textAlign: 'center',
// // //               marginTop: 20,
// // //               color: theme.text,
// // //             }}
// // //           >
// // //             No tasks found.
// // //           </Text>
// // //         ) : (
// // //           filteredTasks.map(task => (
// // //             <TouchableOpacity
// // //               key={task.id}
// // //               style={[
// // //                 styles.card,
// // //                 {
// // //                   backgroundColor: theme.card,
// // //                 },
// // //                 task.isCompleted &&
// // //                   styles.completedCard,
// // //               ]}
// // //               activeOpacity={0.8}
// // //               onPress={() =>
// // //                 navigation.navigate(
// // //                   'TaskOverviewScreen',
// // //                   {
// // //                     task,
// // //                   }
// // //                 )
// // //               }
// // //             >
// // //               <View style={styles.cardLeft}>
// // //                 <View style={styles.clock}>
// // //                   <Icon
// // //                     name="time-outline"
// // //                     size={20}
// // //                     color={theme.text}
// // //                   />
// // //                 </View>

// // //                 <View style={{ flex: 1 }}>
// // //                   <Text
// // //                     style={[
// // //                       styles.taskTitle,
// // //                       {
// // //                         color: theme.text,
// // //                       },
// // //                       task.isCompleted &&
// // //                         styles.completedText,
// // //                     ]}
// // //                   >
// // //                     {task.title}
// // //                   </Text>

// // //                   <Text
// // //                     style={[
// // //                       styles.taskDate,
// // //                       {
// // //                         color: theme.text,
// // //                       },
// // //                     ]}
// // //                   >
// // //                     {task.dueDate
// // //                       ? `${task.dueDate} ${
// // //                           task.dueTime || ''
// // //                         }`
// // //                       : 'No Due Date'}
// // //                   </Text>

// // //                   {task.isCompleted && (
// // //                     <Text style={styles.completedBadge}>
// // //                       ✓ Completed
// // //                     </Text>
// // //                   )}
// // //                 </View>
// // //               </View>

// // //               <View
// // //                 style={{
// // //                   flexDirection: 'row',
// // //                   alignItems: 'center',
// // //                 }}
// // //               >
// // //                 {/* EDIT */}
// // //                 <TouchableOpacity
// // //                   style={styles.editBtn}
// // //                   onPress={e => {
// // //                     e.stopPropagation?.();
// // //                     handleEdit(task);
// // //                   }}
// // //                 >
// // //                   <Icon
// // //                     name="create-outline"
// // //                     size={16}
// // //                     color={theme.text}
// // //                   />
// // //                 </TouchableOpacity>

// // //                 {/* DELETE */}
// // //                 <TouchableOpacity
// // //                   style={styles.editBtn}
// // //                   onPress={e => {
// // //                     e.stopPropagation?.();
// // //                     handleDeleteTask(task.id);
// // //                   }}
// // //                 >
// // //                   <Icon
// // //                     name="trash-outline"
// // //                     size={16}
// // //                     color="#E52323"
// // //                   />
// // //                 </TouchableOpacity>

// // //                 {/* CHECK */}
// // //                 <TouchableOpacity
// // //                   style={[
// // //                     styles.checkbox,
// // //                     task.isCompleted &&
// // //                       styles.checkboxDone,
// // //                   ]}
// // //                   onPress={e => {
// // //                     e.stopPropagation?.();

// // //                     if (!task.isCompleted) {
// // //                       handleMarkDone(task);
// // //                     }
// // //                   }}
// // //                 >
// // //                   {task.isCompleted && (
// // //                     <Icon
// // //                       name="checkmark"
// // //                       size={14}
// // //                       color="#fff"
// // //                     />
// // //                   )}
// // //                 </TouchableOpacity>
// // //               </View>
// // //             </TouchableOpacity>
// // //           ))
// // //         )}
// // //       </ScrollView>

// // //       {/* FAB */}
// // //       <TouchableOpacity
// // //         style={styles.fab}
// // //         onPress={() =>
// // //           navigation.navigate('AddTaskTimeBased')
// // //         }
// // //       >
// // //         <Icon
// // //           name="add"
// // //           size={28}
// // //           color={theme.text}
// // //         />
// // //       </TouchableOpacity>

// // //       {/* CATEGORY */}
// // //       <View style={styles.categoryContainer}>
// // //         <ScrollView
// // //           horizontal
// // //           showsHorizontalScrollIndicator={false}
// // //         >
// // //           {categories.map(cat => (
// // //             <TouchableOpacity
// // //               key={cat}
// // //               style={[
// // //                 styles.category,
// // //                 cat === 'SELF' &&
// // //                   styles.activeCategory,
// // //               ]}
// // //               onPress={() => handleCategory(cat)}
// // //             >
// // //               <Text
// // //                 style={[
// // //                   styles.categoryText,
// // //                   {
// // //                     color: theme.text,
// // //                   },
// // //                 ]}
// // //               >
// // //                 {cat}
// // //               </Text>
// // //             </TouchableOpacity>
// // //           ))}

// // //           <TouchableOpacity
// // //             style={styles.smallAdd}
// // //             onPress={() =>
// // //               navigation.navigate('CreateGroup')
// // //             }
// // //           >
// // //             <Icon
// // //               name="add"
// // //               size={16}
// // //               color={theme.text}
// // //             />
// // //           </TouchableOpacity>
// // //         </ScrollView>
// // //       </View>

// // //       {/* BOTTOM NAV */}
// // //       <View
// // //         style={[
// // //           styles.bottom,
// // //           {
// // //             backgroundColor: theme.bottomNav,
// // //           },
// // //         ]}
// // //       >
// // //         {/* HOME */}
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() =>
// // //             navigation.navigate('HomeDashboard')
// // //           }
// // //         >
// // //           <Icon
// // //             name="home"
// // //             size={24}
// // //             color="#fff"
// // //           />
// // //         </TouchableOpacity>

// // //         {/* CONTACTS */}
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() =>
// // //             navigation.navigate('ContactScreen')
// // //           }
// // //         >
// // //           <Icon
// // //             name="people"
// // //             size={24}
// // //             color="#fff"
// // //           />
// // //         </TouchableOpacity>

// // //         {/* CLASH TASKS */}
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() =>
// // //             navigation.navigate('ClashTaskScreen')
// // //           }
// // //         >
// // //           <Icon
// // //             name="warning"
// // //             size={25}
// // //             color="#fff"
// // //           />
// // //         </TouchableOpacity>

// // //         {/* HISTORY */}
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() =>
// // //             navigation.navigate('TimeBasedHistoryScreen')
// // //           }
// // //         >
// // //           <Icon
// // //             name="time"
// // //             size={24}
// // //             color="#fff"
// // //           />
// // //         </TouchableOpacity>

// // //         {/* SETTINGS */}
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() =>
// // //             navigation.navigate('SettingScreen')
// // //           }
// // //         >
// // //           <Icon
// // //             name="settings"
// // //             size={24}
// // //             color="#fff"
// // //           />
// // //         </TouchableOpacity>
// // //       </View>
// // //     </SafeAreaView>
// // //   );
// // // };

// // // export default HomeDashboard;

// // // const styles = StyleSheet.create({
// // //   container: {
// // //     flex: 1,
// // //     backgroundColor: '#B7C9DB',
// // //     paddingHorizontal: 14,
// // //     topMargin: 30,
// // //   },

// // //   header: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     alignItems: 'center',
// // //     marginVertical: 10,
// // //   },

// // //   headerBox: {
// // //     backgroundColor: '#fff',
// // //     paddingHorizontal: 18,
// // //     paddingVertical: 6,
// // //     borderRadius: 10,
// // //     elevation: 3,
// // //   },

// // //   headerTitle: {
// // //     fontWeight: '800',
// // //     letterSpacing: 1,
// // //   },

// // //   tabContainer: {
// // //     flexDirection: 'row',
// // //     backgroundColor: '#79C6D6',
// // //     padding: 6,
// // //     borderRadius: 16,
// // //     marginBottom: 16,
// // //   },

// // //   tab: {
// // //     flex: 1,
// // //     paddingVertical: 8,
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 10,
// // //     marginHorizontal: 3,
// // //     alignItems: 'center',
// // //   },

// // //   activeTab: {
// // //     backgroundColor: '#fff',
// // //   },

// // //   tabText: {
// // //     fontSize: 12,
// // //     fontWeight: '600',
// // //   },

// // //   toggleBox: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'center',
// // //     backgroundColor: '#fff',
// // //     borderRadius: 10,
// // //     padding: 8,
// // //     marginBottom: 14,
// // //   },

// // //   toggleItem: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     marginHorizontal: 10,
// // //   },

// // //   radioOuter: {
// // //     width: 16,
// // //     height: 16,
// // //     borderRadius: 8,
// // //     borderWidth: 2,
// // //     marginRight: 6,
// // //   },

// // //   radioInner: {
// // //     width: 8,
// // //     height: 8,
// // //     borderRadius: 4,
// // //     backgroundColor: '#000',
// // //     alignSelf: 'center',
// // //     marginTop: 2,
// // //   },

// // //   section: {
// // //     fontWeight: '800',
// // //     marginBottom: 10,
// // //   },

// // //   card: {
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 12,
// // //     padding: 14,
// // //     marginBottom: 12,
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     alignItems: 'center',
// // //     elevation: 3,
// // //   },

// // //   completedCard: {
// // //     opacity: 0.7,
// // //     borderLeftWidth: 4,
// // //     borderLeftColor: '#4CAF50',
// // //   },

// // //   completedText: {
// // //     textDecorationLine: 'line-through',
// // //   },

// // //   completedBadge: {
// // //     fontSize: 10,
// // //     color: '#4CAF50',
// // //     fontWeight: '700',
// // //     marginTop: 2,
// // //   },

// // //   cardLeft: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     flex: 1,
// // //   },

// // //   clock: {
// // //     width: 40,
// // //     height: 40,
// // //     borderRadius: 20,
// // //     borderWidth: 2,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     marginRight: 10,
// // //   },

// // //   taskTitle: {
// // //     fontWeight: '800',
// // //   },

// // //   taskDate: {
// // //     fontSize: 11,
// // //     marginTop: 4,
// // //   },

// // //   checkbox: {
// // //     width: 22,
// // //     height: 22,
// // //     borderWidth: 1.5,
// // //     borderColor: '#000',
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     borderRadius: 4,
// // //   },

// // //   checkboxDone: {
// // //     backgroundColor: '#4CAF50',
// // //     borderColor: '#4CAF50',
// // //   },

// // //   editBtn: {
// // //     marginRight: 8,
// // //     padding: 4,
// // //   },

// // //   fab: {
// // //     position: 'absolute',
// // //     right: 20,
// // //     bottom: 140,
// // //     width: 60,
// // //     height: 60,
// // //     borderRadius: 30,
// // //     backgroundColor: '#6ED3E8',
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //   },

// // //   categoryContainer: {
// // //     position: 'absolute',
// // //     bottom: 70,
// // //     width: '100%',
// // //   },

// // //   category: {
// // //     backgroundColor: '#EDEDED',
// // //     paddingVertical: 8,
// // //     paddingHorizontal: 16,
// // //     borderRadius: 12,
// // //     marginRight: 8,
// // //   },

// // //   activeCategory: {
// // //     backgroundColor: '#7DD4E8',
// // //   },

// // //   categoryText: {
// // //     fontWeight: '700',
// // //   },

// // //   smallAdd: {
// // //     width: 28,
// // //     height: 28,
// // //     borderRadius: 14,
// // //     backgroundColor: '#6ED3E8',
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     marginTop: 6,
// // //   },

// // //   bottom: {
// // //     position: 'absolute',
// // //     bottom: 0,
// // //     left: 0,
// // //     right: 0,
// // //     width: '109%',
// // //     height: 65,
// // //     backgroundColor: '#3A3F45',
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-around',
// // //     alignItems: 'center',
// // //     paddingHorizontal: 10,
// // //   },

// // //   iconBtn: {
// // //     flex: 1,
// // //     alignItems: 'center',
// // //     justifyContent: 'center',
// // //   },
// // // });