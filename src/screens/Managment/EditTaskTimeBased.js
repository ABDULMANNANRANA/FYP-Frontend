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
  Platform,
  ActivityIndicator,
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
// 'Login' is NOT a screen in the root navigator (only 'AuthStack'
// and 'MainStack' are), so navigation.replace('Login') from
// anywhere inside MainStack throws:
//   "The action 'REPLACE' with payload {"name":"Login"} was not
//    handled by any navigator."
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

const EditTaskTimeBased = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  const task = route?.params?.task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [loading, setLoading] = useState(false);

  // =========================================================
  // PREFILL TASK DATA
  // =========================================================
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');

      if (task.dueDate) {
        const parsedDate = new Date(task.dueDate);

        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        } else {
          setDate(new Date());
        }
      } else {
        setDate(new Date());
      }
    }
  }, [task]);

  // =========================================================
  // DATE HANDLER
  // =========================================================
  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDate(false);
    }

    if (selectedDate) {
      const newDate = new Date(date);

      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());

      setDate(newDate);
    }
  };

  // =========================================================
  // TIME HANDLER
  // =========================================================
  const onChangeTime = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTime(false);
    }

    if (selectedTime) {
      const newDate = new Date(date);

      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      setDate(newDate);
    }
  };

  // =========================================================
  // UPDATE TIME-BASED TASK
  // =========================================================
  const EditTimeBasedData = async () => {
    // Validate task
    if (!task?.id) {
      Alert.alert('Error', 'Task information is missing.');
      return;
    }

    // Validate fields
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }

    try {
      setLoading(true);

      // =====================================================
      // GET JWT TOKEN
      // =====================================================
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
          ],
        );

        return;
      }

      // =====================================================
      // FORMAT DATE
      // =====================================================
      const dueDate =
        date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0');

      // =====================================================
      // FORMAT TIME
      // =====================================================
      const dueTime =
        String(date.getHours()).padStart(2, '0') +
        ':' +
        String(date.getMinutes()).padStart(2, '0');

      // =====================================================
      // API URL
      // =====================================================
      const url = `${BASE_URL}/Managment/${task.id}`;

      console.log('Update Task URL:', url);

      // =====================================================
      // API REQUEST
      // =====================================================
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate,
          dueTime: dueTime,
          isTimeBased: true,
        }),
      });

      // =====================================================
      // READ RESPONSE
      // =====================================================
      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        data = null;
      }

      console.log('Update Time Task Status:', response.status);
      console.log('Update Time Task Response:', data);

      // =====================================================
      // SESSION EXPIRED
      // =====================================================
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
          ],
        );

        return;
      }

      // =====================================================
      // SUCCESS
      // =====================================================
      if (response.ok && data?.success) {
        Alert.alert(
          'Updated',
          data.message || 'Task updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );

        return;
      }

      // =====================================================
      // API ERROR
      // =====================================================
      Alert.alert(
        'Error',
        data?.message ||
          data?.error ||
          `Failed to update task. Status: ${response.status}`,
      );
    } catch (error) {
      console.log('Update Time Task Error:', error);

      if (error?.message?.includes('Network request failed')) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your API URL and network connection.',
        );
      } else {
        Alert.alert(
          'Error',
          error?.message || 'Server not reachable.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SWITCH TO NON-TIME-BASED
  // =========================================================
  const switchToNonTimeBased = () => {
    navigation.navigate('EditTaskNonTimeBased', {
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

  // Dynamic Theme Colors with precise fallback handling
  const isDarkTheme = isDark || theme?.mode === 'dark';
  const cardBg = theme.card || (isDarkTheme ? '#1E293B' : '#FFFFFF');
  const inputBg = isDarkTheme ? '#0F172A' : '#F8FAFC';
  const inputBorder = isDarkTheme ? '#334155' : '#E2E8F0';
  const textColor = theme.text || (isDarkTheme ? '#F8FAFC' : '#0F172A');
  const subTextColor = isDarkTheme ? '#94A3B8' : '#64748B';
  const primaryAccent = isDarkTheme ? '#38BDF8' : '#2563EB';
  const primaryAccentLight = isDarkTheme ? 'rgba(56, 189, 248, 0.12)' : 'rgba(37, 99, 235, 0.08)';

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

      {/* FIXED TOP HEADER AREA (Notch / Safe Area aware) */}
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
        {/* TITLE CARD */}
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
            value={title}
            onChangeText={setTitle}
            style={[
              styles.input,
              {
                color: textColor,
                backgroundColor: inputBg,
                borderColor: inputBorder,
              },
            ]}
            placeholder="Enter title"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* DESCRIPTION CARD */}
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
            value={description}
            onChangeText={setDescription}
            style={[
              styles.input,
              styles.multilineInput,
              {
                color: textColor,
                backgroundColor: inputBg,
                borderColor: inputBorder,
              },
            ]}
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
          {/* TIME BASED OPTION (ACTIVE) */}
          <TouchableOpacity
            style={[
              styles.radioItem,
              styles.radioItemActive,
              {
                borderColor: primaryAccent,
                backgroundColor: primaryAccentLight,
              },
            ]}
            activeOpacity={1}
          >
            <View style={[styles.radioOuter, { borderColor: primaryAccent }]}>
              <View style={[styles.radioInner, { backgroundColor: primaryAccent }]} />
            </View>

            <View style={styles.radioTextWrapper}>
              <Text style={[styles.radioLabelText, styles.radioActiveText, { color: textColor }]}>
                Time-Based
              </Text>

              <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                Set precise start & end times
              </Text>
            </View>

            <Icon name="time-outline" size={18} color={primaryAccent} />
          </TouchableOpacity>

          {/* NON-TIME BASED OPTION */}
          <TouchableOpacity
            style={[styles.radioItem, { borderColor: inputBorder }]}
            onPress={switchToNonTimeBased}
            activeOpacity={0.7}
          >
            <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
              {/* Unchecked */}
            </View>

            <View style={styles.radioTextWrapper}>
              <Text style={[styles.radioLabelText, { color: textColor }]}>
                Non-Time Based
              </Text>

              <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                Full-day task with due date only
              </Text>
            </View>

            <Icon name="calendar-outline" size={18} color={subTextColor} />
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

        {/* DATE & TIME CARD */}
        <Text
          style={[
            styles.sectionHeader,
            { color: textColor },
          ]}
        >
          DATE & TIME
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
            SCHEDULED TIME
          </Text>

          <View style={[styles.dateValueBadge, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Icon name="alarm-outline" size={18} color={primaryAccent} style={styles.badgeIcon} />
            <Text
              style={[
                styles.dateText,
                { color: textColor },
              ]}
            >
              {date.toDateString()}  •  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.pickerRow}>
            {/* SELECT DATE */}
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
              onPress={() => setShowDate(true)}
              activeOpacity={0.7}
            >
              <Icon
                name="calendar-outline"
                size={16}
                color={primaryAccent}
              />
              <Text style={[styles.pickerBtnText, { color: textColor }]}>
                Set Date
              </Text>
            </TouchableOpacity>

            {/* SELECT TIME */}
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
              onPress={() => setShowTime(true)}
              activeOpacity={0.7}
            >
              <Icon
                name="time-outline"
                size={16}
                color={primaryAccent}
              />
              <Text style={[styles.pickerBtnText, { color: textColor }]}>
                Set Time
              </Text>
            </TouchableOpacity>
          </View>
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

        {/* TIME PICKER */}
        {showTime && (
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            onChange={onChangeTime}
          />
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.btnRow}>
          {/* CANCEL */}
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

          {/* SAVE */}
          <TouchableOpacity
            style={[
              styles.btn,
              styles.saveBtn,
              { backgroundColor: isDarkTheme ? '#38BDF8' : '#0F172A' },
              loading && styles.btnDisabled,
            ]}
            onPress={EditTimeBasedData}
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
        {/* HOME */}
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

        {/* CONTACTS */}
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

        {/* HISTORY */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'TimeBasedHistoryScreen',
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="time"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* SETTINGS */}
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

export default EditTaskTimeBased;

// =========================================================
// STYLES
// =========================================================

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

  dateValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },

  badgeIcon: {
    marginRight: 10,
  },

  dateText: {
    fontWeight: '600',
    fontSize: 13,
  },

  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },

  pickerBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  pickerBtnText: {
    fontWeight: '600',
    fontSize: 12,
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
//   Platform,
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

// const EditTaskTimeBased = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const task = route?.params?.task;

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [date, setDate] = useState(new Date());

//   const [showDate, setShowDate] = useState(false);
//   const [showTime, setShowTime] = useState(false);

//   const [loading, setLoading] = useState(false);

//   // =========================================================
//   // PREFILL TASK DATA
//   // =========================================================
//   useEffect(() => {
//     if (task) {
//       setTitle(task.title || '');
//       setDescription(task.description || '');

//       if (task.dueDate) {
//         const parsedDate = new Date(task.dueDate);

//         if (!isNaN(parsedDate.getTime())) {
//           setDate(parsedDate);
//         } else {
//           setDate(new Date());
//         }
//       } else {
//         setDate(new Date());
//       }
//     }
//   }, [task]);

//   // =========================================================
//   // DATE HANDLER
//   // =========================================================
//   const onChangeDate = (event, selectedDate) => {
//     if (Platform.OS === 'android') {
//       setShowDate(false);
//     }

//     if (selectedDate) {
//       const newDate = new Date(date);

//       newDate.setFullYear(selectedDate.getFullYear());
//       newDate.setMonth(selectedDate.getMonth());
//       newDate.setDate(selectedDate.getDate());

//       setDate(newDate);
//     }
//   };

//   // =========================================================
//   // TIME HANDLER
//   // =========================================================
//   const onChangeTime = (event, selectedTime) => {
//     if (Platform.OS === 'android') {
//       setShowTime(false);
//     }

//     if (selectedTime) {
//       const newDate = new Date(date);

//       newDate.setHours(selectedTime.getHours());
//       newDate.setMinutes(selectedTime.getMinutes());
//       newDate.setSeconds(0);
//       newDate.setMilliseconds(0);

//       setDate(newDate);
//     }
//   };

//   // =========================================================
//   // UPDATE TIME-BASED TASK
//   // =========================================================
//   const EditTimeBasedData = async () => {
//     // Validate task
//     if (!task?.id) {
//       Alert.alert('Error', 'Task information is missing.');
//       return;
//     }

//     // Validate fields
//     if (!title.trim() || !description.trim()) {
//       Alert.alert('Error', 'Please fill all fields.');
//       return;
//     }

//     try {
//       setLoading(true);

//       // =====================================================
//       // GET JWT TOKEN
//       // =====================================================
//       // IMPORTANT: LoginScreen saves the token under the key
//       // "token" (AsyncStorage.setItem("token", userData.token)).
//       // This was previously reading "jwtToken", a key that is
//       // never written anywhere, so this always returned null —
//       // triggering "Session Expired" immediately.
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
//           ],
//         );

//         return;
//       }

//       // =====================================================
//       // FORMAT DATE
//       // =====================================================
//       const dueDate =
//         date.getFullYear() +
//         '-' +
//         String(date.getMonth() + 1).padStart(2, '0') +
//         '-' +
//         String(date.getDate()).padStart(2, '0');

//       // =====================================================
//       // FORMAT TIME
//       // =====================================================
//       const dueTime =
//         String(date.getHours()).padStart(2, '0') +
//         ':' +
//         String(date.getMinutes()).padStart(2, '0');

//       // =====================================================
//       // API URL
//       // =====================================================
//       // NOTE: correct route is "api/Managment/{id}"
//       // (ManagmentController.UpdateTask), not "api/tasks/{id}"
//       // which does not exist on the backend.
//       const url = `${BASE_URL}/Managment/${task.id}`;

//       console.log('Update Task URL:', url);

//       // =====================================================
//       // API REQUEST
//       // =====================================================
//       const response = await fetch(url, {
//         method: 'PUT',
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//         },
//         body: JSON.stringify({
//           title: title.trim(),
//           description: description.trim(),
//           dueDate: dueDate,
//           dueTime: dueTime,
//           isTimeBased: true,
//         }),
//       });

//       // =====================================================
//       // READ RESPONSE
//       // =====================================================
//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         data = null;
//       }

//       console.log('Update Time Task Status:', response.status);
//       console.log('Update Time Task Response:', data);

//       // =====================================================
//       // SESSION EXPIRED
//       // =====================================================
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
//           ],
//         );

//         return;
//       }

//       // =====================================================
//       // SUCCESS
//       // =====================================================
//       if (response.ok && data?.success) {
//         Alert.alert(
//           'Updated',
//           data.message || 'Task updated successfully.',
//           [
//             {
//               text: 'OK',
//               onPress: () => navigation.goBack(),
//             },
//           ],
//         );

//         return;
//       }

//       // =====================================================
//       // API ERROR
//       // =====================================================
//       Alert.alert(
//         'Error',
//         data?.message ||
//           data?.error ||
//           `Failed to update task. Status: ${response.status}`,
//       );
//     } catch (error) {
//       console.log('Update Time Task Error:', error);

//       if (error?.message?.includes('Network request failed')) {
//         Alert.alert(
//           'Connection Error',
//           'Unable to connect to the server. Please check your API URL and network connection.',
//         );
//       } else {
//         Alert.alert(
//           'Error',
//           error?.message || 'Server not reachable.',
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // =========================================================
//   // SWITCH TO NON-TIME-BASED
//   // =========================================================
//   const switchToNonTimeBased = () => {
//     navigation.navigate('EditTaskNonTimeBased', {
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

//         {/* =====================================================
//             HEADER
//         ===================================================== */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()}>
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

//         {/* =====================================================
//             TITLE
//         ===================================================== */}
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
//             TITLE
//           </Text>

//           <TextInput
//             value={title}
//             onChangeText={setTitle}
//             style={[
//               styles.input,
//               { color: theme.text },
//             ]}
//             placeholder="Enter title"
//             placeholderTextColor="#999"
//           />
//         </View>

//         {/* =====================================================
//             DESCRIPTION
//         ===================================================== */}
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
//             value={description}
//             onChangeText={setDescription}
//             style={[
//               styles.input,
//               {
//                 color: theme.text,
//                 flex: 1,
//               },
//             ]}
//             placeholder="Enter description"
//             placeholderTextColor="#999"
//           />
//         </View>

//         {/* =====================================================
//             TASK TYPE
//         ===================================================== */}
//         <Text
//           style={[
//             styles.section,
//             { color: theme.text },
//           ]}
//         >
//           TIME BASED & NON TIME BASED:
//         </Text>

//         <View style={styles.radioRow}>

//           {/* TIME BASED - SELECTED */}
//           <TouchableOpacity style={styles.radioItem}>
//             <View style={styles.radioOuter}>
//               <View style={styles.radioInner} />
//             </View>

//             <Text
//               style={[
//                 styles.radioActiveText,
//                 { color: theme.text },
//               ]}
//             >
//               TIME BASED
//             </Text>
//           </TouchableOpacity>

//           {/* NON-TIME BASED */}
//           <TouchableOpacity
//             style={styles.radioItem}
//             onPress={switchToNonTimeBased}
//           >
//             <View style={styles.radioOuter} />

//             <Text style={{ color: theme.text }}>
//               NON-TIME BASED
//             </Text>
//           </TouchableOpacity>

//         </View>

//         {/* =====================================================
//             DATE & TIME
//         ===================================================== */}
//         <Text
//           style={[
//             styles.section,
//             { color: theme.text },
//           ]}
//         >
//           DATE & TIME
//         </Text>

//         <View
//           style={[
//             styles.dateBox,
//             { backgroundColor: theme.card },
//           ]}
//         >
//           <Text
//             style={[
//               styles.dateText,
//               { color: theme.text },
//             ]}
//           >
//             {date.toDateString()} | {date.toLocaleTimeString()}
//           </Text>

//           <View style={styles.pickerRow}>

//             {/* SELECT DATE */}
//             <TouchableOpacity
//               style={styles.pickerBtn}
//               onPress={() => setShowDate(true)}
//             >
//               <Icon
//                 name="calendar-outline"
//                 size={18}
//                 color="#fff"
//               />

//               <Text style={styles.pickerBtnText}>
//                 Select Date
//               </Text>
//             </TouchableOpacity>

//             {/* SELECT TIME */}
//             <TouchableOpacity
//               style={styles.pickerBtn}
//               onPress={() => setShowTime(true)}
//             >
//               <Icon
//                 name="time-outline"
//                 size={18}
//                 color="#fff"
//               />

//               <Text style={styles.pickerBtnText}>
//                 Select Time
//               </Text>
//             </TouchableOpacity>

//           </View>
//         </View>

//         {/* =====================================================
//             DATE PICKER
//         ===================================================== */}
//         {showDate && (
//           <DateTimePicker
//             value={date}
//             mode="date"
//             display="calendar"
//             onChange={onChangeDate}
//           />
//         )}

//         {/* =====================================================
//             TIME PICKER
//         ===================================================== */}
//         {showTime && (
//           <DateTimePicker
//             value={date}
//             mode="time"
//             display="spinner"
//             onChange={onChangeTime}
//           />
//         )}

//         {/* =====================================================
//             BUTTONS
//         ===================================================== */}
//         <View style={styles.btnRow}>

//           {/* CANCEL */}
//           <TouchableOpacity
//             style={styles.btn}
//             onPress={() => navigation.goBack()}
//             disabled={loading}
//           >
//             <Text style={styles.btnText}>
//               CANCEL
//             </Text>
//           </TouchableOpacity>

//           {/* SAVE */}
//           <TouchableOpacity
//             style={[
//               styles.btn,
//               loading && styles.btnDisabled,
//             ]}
//             onPress={EditTimeBasedData}
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

//       {/* =====================================================
//           BOTTOM NAVIGATION
//       ===================================================== */}
//       <View
//         style={[
//           styles.bottom,
//           { backgroundColor: theme.bottomNav },
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
//           onPress={() =>
//             navigation.navigate(
//               'TimeBasedHistoryScreen',
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

// export default EditTaskTimeBased;

// // =========================================================
// // STYLES
// // =========================================================

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#B7C9DB',
//   },

//   content: {
//     padding: 16,
//     paddingBottom: 120,
//   },

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },

//   headerBox: {
//     backgroundColor: '#fff',
//     padding: 8,
//     borderRadius: 10,
//   },

//   headerText: {
//     fontWeight: '800',
//   },

//   card: {
//     backgroundColor: '#EDEDED',
//     padding: 12,
//     borderRadius: 10,
//     marginTop: 15,
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

//   dateBox: {
//     backgroundColor: '#EDEDED',
//     padding: 14,
//     borderRadius: 10,
//     marginTop: 10,
//   },

//   dateText: {
//     marginBottom: 12,
//     fontWeight: '600',
//   },

//   pickerRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     gap: 10,
//   },

//   pickerBtn: {
//     backgroundColor: '#000',
//     paddingVertical: 10,
//     paddingHorizontal: 14,
//     borderRadius: 8,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     flex: 1,
//     gap: 6,
//   },

//   pickerBtnText: {
//     color: '#fff',
//     fontWeight: '600',
//   },

//   btnRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 20,
//   },

//   btn: {
//     width: '45%',
//     backgroundColor: '#000',
//     padding: 14,
//     borderRadius: 30,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   btnDisabled: {
//     opacity: 0.6,
//   },

//   btnText: {
//     color: '#fff',
//     fontWeight: '800',
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     width: '100%',
//     height: 60,
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