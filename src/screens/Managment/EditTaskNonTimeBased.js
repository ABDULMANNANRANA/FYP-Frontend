import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// ============================================================
// Helper: reset navigation to the Login screen inside AuthStack.
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

// Format a JS Date as "yyyy-MM-dd" to match backend DateOnly binding
const toDateOnlyString = d => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EditTaskNonTimeBased = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  const task = route?.params?.task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [loading, setLoading] = useState(false);

  // ==============================
  // PREFILL TASK DATA
  // ==============================
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');

      if (task.dueDate) {
        const parsedDate = new Date(task.dueDate);

        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        }
      }
    }
  }, [task]);

  // ==============================
  // DATE CHANGE
  // ==============================
  const onChangeDate = (event, selectedDate) => {
    setShowDate(false);

    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // ==============================
  // UPDATE NON-TIME-BASED TASK
  // ==============================
  const EditNonTimeBasedData = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (!task?.id) {
      Alert.alert('Error', 'Task ID is missing');
      return;
    }

    try {
      setLoading(true);

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
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Managment/${task.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            dueDate: toDateOnlyString(date),
            isTimeBased: false,
          }),
        }
      );

      console.log('Update Task Status:', response.status);

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        data = null;
      }

      console.log('Update Task Response:', data);

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
        return;
      }

      if (response.ok && data?.success) {
        Alert.alert(
          'Success',
          data.message || 'Task updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Error',
        data?.message ||
          data?.error ||
          `Failed to update task. Status: ${response.status}`
      );
    } catch (error) {
      console.log('Update Task Error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Server not reachable.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // SWITCH TO TIME-BASED TASK
  // ==============================
  const switchToTimeBased = () => {
    navigation.navigate('EditTaskTimeBased', {
      task: {
        ...task,
        title,
        description,
        dueDate: date.toISOString(),
      },
    });
  };

  const switchToLocationBased = () => {
    navigation.navigate('EditTaskLocationBased', {
      task: {
        ...task,
        title,
        description,
      },
    });
  };

  // Dynamic Adaptive Palette Constants for Non-Time-Based Tasks
  const isDarkTheme = isDark || theme?.mode === 'dark';
  const cardBg = theme.card || (isDarkTheme ? '#1E293B' : '#FFFFFF');
  const inputBg = isDarkTheme ? '#0F172A' : '#F8FAFC';
  const inputBorder = isDarkTheme ? '#334155' : '#E2E8F0';
  const textColor = theme.text || (isDarkTheme ? '#F8FAFC' : '#0F172A');
  const subTextColor = isDarkTheme ? '#94A3B8' : '#64748B';
  const accentColor = isDarkTheme ? '#38BDF8' : '#0284C7';
  const accentBgLight = isDarkTheme ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)';

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.bg || (isDarkTheme ? '#0F172A' : '#F8FAFC') },
      ]}
    >
      <StatusBar
        barStyle={isDarkTheme ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* FIXED TOP HEADER AREA */}
      <View style={[styles.headerContainer, { borderBottomColor: inputBorder }]}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Icon
            name="arrow-back"
            size={22}
            color={textColor}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            { backgroundColor: theme.headerBox || (isDarkTheme ? '#1E293B' : '#E2E8F0') },
          ]}
        >
          <Text
            style={[
              styles.headerText,
              { color: textColor },
            ]}
          >
            EDIT TASK
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* TITLE FIELD CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: inputBorder },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: textColor },
            ]}
          >
            TASK TITLE
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                color: textColor,
                backgroundColor: inputBg,
                borderColor: inputBorder,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter title"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* DESCRIPTION FIELD CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: inputBorder },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: textColor },
            ]}
          >
            DESCRIPTION
          </Text>

          <TextInput
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[
              styles.input,
              styles.multilineInput,
              {
                color: textColor,
                backgroundColor: inputBg,
                borderColor: inputBorder,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* TASK TYPE SELECTION */}
        <Text
          style={[
            styles.sectionHeader,
            { color: textColor },
          ]}
        >
          TASK TYPE
        </Text>

        <View
          style={[
            styles.typeSelectorCard,
            { backgroundColor: cardBg, borderColor: inputBorder },
          ]}
        >
          {/* TIME BASED OPTION */}
          <TouchableOpacity
            style={[styles.radioItem, { borderColor: inputBorder }]}
            onPress={switchToTimeBased}
            activeOpacity={0.7}
          >
            <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
              {/* Unchecked */}
            </View>

            <View style={styles.radioTextWrapper}>
              <Text style={[styles.radioLabelText, { color: textColor }]}>
                Time-Based
              </Text>
              <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                Set precise start & end times
              </Text>
            </View>

            <Icon name="time-outline" size={18} color={subTextColor} />
          </TouchableOpacity>

          {/* NON-TIME BASED OPTION (ACTIVE) */}
          <TouchableOpacity
            style={[
              styles.radioItem,
              styles.radioItemActive,
              {
                borderColor: accentColor,
                backgroundColor: accentBgLight,
              },
            ]}
            activeOpacity={1}
          >
            <View style={[styles.radioOuter, { borderColor: accentColor }]}>
              <View style={[styles.radioInner, { backgroundColor: accentColor }]} />
            </View>

            <View style={styles.radioTextWrapper}>
              <Text style={[styles.radioLabelText, styles.radioActiveText, { color: textColor }]}>
                Non-Time Based
              </Text>
              <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                Full-day task with due date only
              </Text>
            </View>

            <Icon name="calendar-outline" size={18} color={accentColor} />
          </TouchableOpacity>

          {/* LOCATION BASED OPTION */}
          <TouchableOpacity
            style={[styles.radioItem, { borderColor: inputBorder }]}
            onPress={switchToLocationBased}
            activeOpacity={0.7}
          >
            <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
              {/* Unchecked */}
            </View>

            <View style={styles.radioTextWrapper}>
              <Text style={[styles.radioLabelText, { color: textColor }]}>
                Location Based
              </Text>
              <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                Remind me when I arrive at a place
              </Text>
            </View>

            <Icon name="location-outline" size={18} color={subTextColor} />
          </TouchableOpacity>
        </View>

        {/* DATE SELECTION CARD */}
        <Text
          style={[
            styles.sectionHeader,
            { color: textColor },
          ]}
        >
          DUE DATE
        </Text>

        <View
          style={[
            styles.dateCard,
            { backgroundColor: cardBg, borderColor: inputBorder },
          ]}
        >
          <Text
            style={[
              styles.dateTitle,
              { color: textColor },
            ]}
          >
            SELECTED DUE DATE
          </Text>

          <TouchableOpacity
            style={[
              styles.datePickerTrigger,
              { backgroundColor: inputBg, borderColor: inputBorder },
            ]}
            onPress={() => setShowDate(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateInfoContainer}>
              <Icon
                name="calendar"
                size={20}
                color={accentColor}
                style={styles.calendarIcon}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: textColor },
                ]}
              >
                {date.toDateString()}
              </Text>
            </View>

            <View style={[styles.chooseDateChip, { backgroundColor: accentBgLight }]}>
              <Text style={[styles.chooseDateText, { color: accentColor }]}>
                Change Date
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* DATE PICKER */}
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display="calendar"
            onChange={onChangeDate}
          />
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.cancelBtn,
              { borderColor: inputBorder, backgroundColor: cardBg },
            ]}
            onPress={() => navigation.goBack()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: textColor }]}>
              CANCEL
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.saveBtn,
              { backgroundColor: isDarkTheme ? '#38BDF8' : '#0F172A' },
              loading && styles.btnDisabled,
            ]}
            onPress={EditNonTimeBasedData}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={isDarkTheme ? '#0F172A' : '#FFFFFF'} size="small" />
            ) : (
              <Text
                style={[
                  styles.saveBtnText,
                  { color: isDarkTheme ? '#0F172A' : '#FFFFFF' },
                ]}
              >
                SAVE CHANGES
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottom,
          { backgroundColor: theme.bottomNav || (isDarkTheme ? '#0F172A' : '#1E293B') },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate('HomeDashboard')
          }
          activeOpacity={0.7}
        >
          <Icon
            name="home"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate('ContactScreen')
          }
          activeOpacity={0.7}
        >
          <Icon
            name="people"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate('TimeBasedHistoryScreen')
          }
          activeOpacity={0.7}
        >
          <Icon
            name="time"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate('SettingScreen')
          }
          activeOpacity={0.7}
        >
          <Icon
            name="settings"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default EditTaskNonTimeBased;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* HEADER STYLING */
  headerContainer: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },

  backIconButton: {
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
  },

  headerText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.8,
  },

  /* CONTENT AREA */
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  label: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  input: {
    fontSize: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
  },

  multilineInput: {
    height: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },

  sectionHeader: {
    marginTop: 6,
    marginBottom: 10,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
  },

  /* TASK TYPE SELECTION */
  typeSelectorCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    gap: 10,
  },

  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  radioItemActive: {
    borderWidth: 1.5,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  radioTextWrapper: {
    flex: 1,
  },

  radioLabelText: {
    fontSize: 14,
    fontWeight: '600',
  },

  radioSubLabelText: {
    fontSize: 11,
    marginTop: 2,
  },

  radioActiveText: {
    fontWeight: '700',
  },

  /* DATE CARD */
  dateCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },

  dateTitle: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  dateInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  calendarIcon: {
    marginRight: 10,
  },

  chipText: {
    fontWeight: '600',
    fontSize: 14,
  },

  chooseDateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  chooseDateText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* BUTTONS */
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },

  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelBtn: {
    borderWidth: 1,
  },

  cancelBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },

  saveBtn: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  saveBtnText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  btnDisabled: {
    opacity: 0.5,
  },

  /* BOTTOM NAVIGATION BAR */
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 74 : 60,
    paddingBottom: Platform.OS === 'ios' ? 16 : 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});



































// import React, { useState, useEffect } from 'react';
// import {
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';

// // ============================================================
// // Helper: reset navigation to the Login screen inside AuthStack.
// // 'Login' is NOT a screen in the root navigator (only 'AuthStack'
// // and 'MainStack' are), so navigation.replace('Login') from
// // anywhere inside MainStack throws:
// //   "The action 'REPLACE' with payload {"name":"Login"} was not
// //    handled by any navigator."
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

// // Format a JS Date as "yyyy-MM-dd" to match the backend's
// // DateOnly binding for UpdateTaskRequest.DueDate. Sending a full
// // ISO timestamp (date.toISOString()) does not reliably bind to
// // DateOnly and can fail or produce the wrong date.
// const toDateOnlyString = d => {
//   const year = d.getFullYear();
//   const month = String(d.getMonth() + 1).padStart(2, '0');
//   const day = String(d.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };

// const EditTaskNonTimeBased = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   const task = route?.params?.task;

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [date, setDate] = useState(new Date());
//   const [showDate, setShowDate] = useState(false);
//   const [loading, setLoading] = useState(false);

//   // ==============================
//   // PREFILL TASK DATA
//   // ==============================
//   useEffect(() => {
//     if (task) {
//       setTitle(task.title || '');
//       setDescription(task.description || '');

//       if (task.dueDate) {
//         const parsedDate = new Date(task.dueDate);

//         if (!isNaN(parsedDate.getTime())) {
//           setDate(parsedDate);
//         }
//       }
//     }
//   }, [task]);

//   // ==============================
//   // DATE CHANGE
//   // ==============================
//   const onChangeDate = (event, selectedDate) => {
//     setShowDate(false);

//     if (selectedDate) {
//       setDate(selectedDate);
//     }
//   };

//   // ==============================
//   // UPDATE NON-TIME-BASED TASK
//   // ==============================
//   const EditNonTimeBasedData = async () => {
//     if (!title.trim() || !description.trim()) {
//       Alert.alert('Error', 'Please fill all fields');
//       return;
//     }

//     if (!task?.id) {
//       Alert.alert('Error', 'Task ID is missing');
//       return;
//     }

//     try {
//       setLoading(true);

//       // Get JWT token
//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
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

//       // ==============================
//       // API REQUEST
//       // ==============================
//       // NOTE: correct route is "api/Managment/{id}"
//       // (ManagmentController.UpdateTask), not "api/tasks/{id}"
//       // which does not exist on the backend.
//       const response = await fetch(
//         `${BASE_URL}/Managment/${task.id}`,
//         {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: title.trim(),
//             description: description.trim(),
//             // NOTE: backend expects a DateOnly ("yyyy-MM-dd"),
//             // not a full ISO timestamp.
//             dueDate: toDateOnlyString(date),
//             isTimeBased: false,
//           }),
//         }
//       );

//       console.log('Update Task Status:', response.status);

//       // Get response safely
//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         data = null;
//       }

//       console.log('Update Task Response:', data);

//       // ==============================
//       // SESSION EXPIRED
//       // ==============================
//       if (response.status === 401) {
//         await AsyncStorage.removeItem('token');

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

//       // ==============================
//       // SUCCESS
//       // ==============================
//       if (response.ok && data?.success) {
//         Alert.alert(
//           'Success',
//           data.message || 'Task updated successfully.',
//           [
//             {
//               text: 'OK',
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         return;
//       }

//       // ==============================
//       // API ERROR
//       // ==============================
//       Alert.alert(
//         'Error',
//         data?.message ||
//           data?.error ||
//           `Failed to update task. Status: ${response.status}`
//       );

//     } catch (error) {
//       console.log('Update Task Error:', error);

//       Alert.alert(
//         'Error',
//         error?.message || 'Server not reachable.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ==============================
//   // SWITCH TO TIME-BASED TASK
//   // ==============================
//   const switchToTimeBased = () => {
//     navigation.navigate('EditTaskTimeBased', {
//       task: {
//         ...task,
//         title,
//         description,
//         dueDate: date.toISOString(),
//       },
//     });
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         { backgroundColor: theme.bg },
//       ]}
//     >
//       <ScrollView contentContainerStyle={styles.content}>

//         {/* ==============================
//             HEADER
//         ============================== */}
//         <View style={styles.header}>

//           <TouchableOpacity
//             onPress={() => navigation.goBack()}
//           >
//             <Icon
//               name="arrow-back"
//               size={22}
//               color={theme.text}
//             />
//           </TouchableOpacity>

//           <View
//             style={[
//               styles.headerBox,
//               { backgroundColor: theme.headerBox },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.headerText,
//                 { color: theme.text },
//               ]}
//             >
//               EDIT TASK
//             </Text>
//           </View>

//           <View style={{ width: 22 }} />

//         </View>

//         {/* ==============================
//             TITLE
//         ============================== */}
//         <View
//           style={[
//             styles.card,
//             { backgroundColor: theme.card },
//           ]}
//         >
//           <Text
//             style={[
//               styles.label,
//               { color: theme.text },
//             ]}
//           >
//             TITLE:
//           </Text>

//           <TextInput
//             style={[
//               styles.input,
//               { color: theme.text },
//             ]}
//             value={title}
//             onChangeText={setTitle}
//             placeholder="Enter title"
//             placeholderTextColor="#999"
//           />
//         </View>

//         {/* ==============================
//             DESCRIPTION
//         ============================== */}
//         <View
//           style={[
//             styles.card,
//             {
//               height: 120,
//               backgroundColor: theme.card,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.label,
//               { color: theme.text },
//             ]}
//           >
//             DESCRIPTION
//           </Text>

//           <TextInput
//             multiline
//             textAlignVertical="top"
//             style={[
//               styles.input,
//               {
//                 color: theme.text,
//                 flex: 1,
//               },
//             ]}
//             value={description}
//             onChangeText={setDescription}
//             placeholder="Enter description"
//             placeholderTextColor="#999"
//           />
//         </View>

//         {/* ==============================
//             TASK TYPE
//         ============================== */}
//         <Text
//           style={[
//             styles.section,
//             { color: theme.text },
//           ]}
//         >
//           TIME BASED & NON TIME BASED:
//         </Text>

//         <View style={styles.radioRow}>

//           {/* TIME BASED */}
//           <TouchableOpacity
//             style={styles.radioItem}
//             onPress={switchToTimeBased}
//           >
//             <View style={styles.radioOuter}>
//               {/* Not selected */}
//             </View>

//             <Text style={{ color: theme.text }}>
//               TIME BASED
//             </Text>
//           </TouchableOpacity>

//           {/* NON-TIME BASED */}
//           <TouchableOpacity
//             style={styles.radioItem}
//           >
//             <View style={styles.radioOuter}>
//               <View style={styles.radioInner} />
//             </View>

//             <Text
//               style={[
//                 { color: theme.text },
//                 styles.radioActiveText,
//               ]}
//             >
//               NON-TIME BASED
//             </Text>
//           </TouchableOpacity>

//         </View>

//         {/* ==============================
//             DATE
//         ============================== */}
//         <Text
//           style={[
//             styles.section,
//             { color: theme.text },
//           ]}
//         >
//           DATE
//         </Text>

//         <View
//           style={[
//             styles.dateCard,
//             { backgroundColor: theme.card },
//           ]}
//         >

//           <Text
//             style={[
//               styles.dateTitle,
//               { color: theme.text },
//             ]}
//           >
//             DUE DATE:
//           </Text>

//           <View style={styles.dateRow}>

//             <View style={styles.chip}>
//               <Text
//                 style={[
//                   styles.chipText,
//                   { color: theme.text },
//                 ]}
//               >
//                 {date.toDateString()}
//               </Text>
//             </View>

//             <TouchableOpacity
//               onPress={() => setShowDate(true)}
//             >
//               <Icon
//                 name="calendar-outline"
//                 size={22}
//                 color={theme.text}
//               />
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={() => setShowDate(true)}
//             >
//               <Text style={styles.chooseDate}>
//                 choose date
//               </Text>
//             </TouchableOpacity>

//           </View>

//         </View>

//         {/* ==============================
//             DATE PICKER
//         ============================== */}
//         {showDate && (
//           <DateTimePicker
//             value={date}
//             mode="date"
//             display="calendar"
//             onChange={onChangeDate}
//           />
//         )}

//         {/* ==============================
//             BUTTONS
//         ============================== */}
//         <View style={styles.btnRow}>

//           <TouchableOpacity
//             style={styles.btn}
//             onPress={() => navigation.goBack()}
//             disabled={loading}
//           >
//             <Text style={styles.btnText}>
//               CANCEL
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.btn,
//               loading && styles.btnDisabled,
//             ]}
//             onPress={EditNonTimeBasedData}
//             disabled={loading}
//           >
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.btnText}>
//                 SAVE CHANGES
//               </Text>
//             )}
//           </TouchableOpacity>

//         </View>

//       </ScrollView>

//       {/* ==============================
//           BOTTOM NAVIGATION
//       ============================== */}
//       <View
//         style={[
//           styles.bottom,
//           { backgroundColor: theme.bottomNav },
//         ]}
//       >

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

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('TimeBasedHistoryScreen')
//           }
//         >
//           <Icon
//             name="time"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

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

// export default EditTaskNonTimeBased;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#B7C9DB',
//   },

//   content: {
//     padding: 20,
//     paddingBottom: 120,
//   },

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },

//   headerBox: {
//     backgroundColor: '#fff',
//     paddingHorizontal: 20,
//     paddingVertical: 6,
//     borderRadius: 10,
//   },

//   headerText: {
//     fontWeight: '800',
//   },

//   card: {
//     backgroundColor: '#EDEDED',
//     borderRadius: 12,
//     padding: 14,
//     marginTop: 18,
//   },

//   label: {
//     fontWeight: '800',
//     marginBottom: 6,
//   },

//   input: {
//     fontSize: 14,
//   },

//   section: {
//     marginTop: 20,
//     fontWeight: '800',
//   },

//   radioRow: {
//     flexDirection: 'row',
//     marginTop: 10,
//   },

//   radioItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginRight: 20,
//   },

//   radioOuter: {
//     width: 18,
//     height: 18,
//     borderRadius: 9,
//     borderWidth: 2,
//     borderColor: '#333',
//     marginRight: 6,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   radioInner: {
//     width: 9,
//     height: 9,
//     backgroundColor: '#333',
//     borderRadius: 5,
//   },

//   radioActiveText: {
//     fontWeight: '700',
//   },

//   dateCard: {
//     marginTop: 10,
//     backgroundColor: '#EDEDED',
//     borderRadius: 12,
//     padding: 14,
//   },

//   dateTitle: {
//     fontWeight: '800',
//     marginBottom: 10,
//   },

//   dateRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },

//   chip: {
//     backgroundColor: '#BDBDBD',
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//   },

//   chipText: {
//     fontWeight: '600',
//   },

//   chooseDate: {
//     color: '#6FA8DC',
//     textDecorationLine: 'underline',
//   },

//   btnRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 30,
//   },

//   btn: {
//     width: '45%',
//     backgroundColor: '#000',
//     padding: 14,
//     borderRadius: 30,
//     alignItems: 'center',
//     justifyContent: 'center',
//     minHeight: 50,
//   },

//   btnDisabled: {
//     backgroundColor: '#777',
//   },

//   btnText: {
//     color: '#fff',
//     fontWeight: '800',
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     width: '100%',
//     height: 65,
//     backgroundColor: '#3A3F45',
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });