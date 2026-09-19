import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { BASE_URL } from "../../config/api";

const { width } = Dimensions.get('window');

const AddTaskTimeBased = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  const [taskType, setTaskType] = useState('time');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const groupIdParam = route?.params?.groupId || null;

  React.useEffect(() => {
    const fetchGroups = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`${BASE_URL}/Management/groups`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        // Safe JSON Parsing
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (response.ok && data?.success) {
          setGroups(data.data || []);
        }
      } catch (err) {
        console.log('Error fetching groups:', err);
      }
    };
    fetchGroups();
  }, []);

  // ✅ DATE HANDLER
  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDate(false);

    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setDate(newDate);
    }
  };

  // ✅ TIME HANDLER
  const onChangeTime = (event, selectedTime) => {
    if (Platform.OS === 'android') setShowTime(false);

    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  // ✅ SAFE DATE & TIME FORMATTERS FOR ASP.NET (DateOnly & TimeOnly)
  const formatDueDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDueTime = (d) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // ✅ API FUNCTION
  const AddTask = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const token = await AsyncStorage.getItem('token');

    if (!token) {
      Alert.alert(
        'Session Expired',
        'Please login again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('Login'),
          },
        ]
      );
      return;
    }

    try {
      setLoading(true);

      const formattedDate = formatDueDate(date); // YYYY-MM-DD
      const formattedTime = formatDueTime(date); // HH:mm:ss

      const response = await fetch(`${BASE_URL}/Managment/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: formattedDate,
          dueTime: formattedTime,
          isTimeBased: true,
          groupId: groupIdParam ? parseInt(groupIdParam, 10) : null,
        }),
      });

      // Safely handle empty response body
      const responseText = await response.text();
      let responseData = {};
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.log('Failed to parse response JSON:', responseText);
      }

      console.log('Create Task Response Status:', response.status);
      console.log('Create Task Response Body:', responseData);

      if (response.ok && (responseData?.success || response.status === 200 || response.status === 201)) {
        Alert.alert(
          'Success',
          responseData?.message || 'Task created successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );

        setTitle('');
        setDescription('');
        setDate(new Date());
      } else {
        Alert.alert(
          'Error',
          responseData?.message || `Failed to create task (HTTP ${response.status}).`
        );
      }

    } catch (error) {
      console.log('Add Task Error:', error);

      Alert.alert(
        'Error',
        error.message || 'Server not reachable.'
      );

    } finally {
      setLoading(false);
    }
  };

  const handleNonTimeBased = () => {
    setTaskType('non');
    navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
  };

  const primaryColor = theme.primary || '#2563EB';
  const cardBg = theme.card || '#FFFFFF';
  const textColor = theme.text || '#0F172A';
  const subTextColor = theme.subText || '#64748B';
  const borderClr = theme.border || '#E2E8F0';
  const inputBg = theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg || '#F8FAFC' }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg || '#F8FAFC'}
        translucent={Platform.OS === 'android'}
      />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.bg || '#F8FAFC', borderBottomColor: borderClr }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: inputBg }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>

        <View style={[styles.headerBox, { backgroundColor: theme.headerBox || inputBg }]}>
          <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.responsiveWrapper}>
          
          {/* TITLE INPUT CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: primaryColor }]}>Task Title</Text>
            <TextInput
              placeholder="e.g. System Architecture Design"
              placeholderTextColor={subTextColor}
              style={[styles.input, { color: textColor, backgroundColor: inputBg, borderColor: borderClr }]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* DESCRIPTION INPUT CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: primaryColor }]}>Description</Text>
            <TextInput
              placeholder="Provide detailed instructions or goals..."
              placeholderTextColor={subTextColor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[
                styles.input,
                styles.descriptionInput,
                { color: textColor, backgroundColor: inputBg, borderColor: borderClr },
              ]}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* TASK MODE SELECTOR CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: primaryColor }]}>Task Mode</Text>
            <View style={styles.radioRow}>
              <TouchableOpacity
                onPress={() => setTaskType('time')}
                style={[
                  styles.radioItem,
                  { backgroundColor: inputBg, borderColor: taskType === 'time' ? primaryColor : borderClr },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, { borderColor: taskType === 'time' ? primaryColor : subTextColor }]}>
                  {taskType === 'time' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'time' ? '700' : '500' }]}>
                  Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNonTimeBased}
                style={[
                  styles.radioItem,
                  { backgroundColor: inputBg, borderColor: taskType === 'non' ? primaryColor : borderClr },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, { borderColor: taskType === 'non' ? primaryColor : subTextColor }]}>
                  {taskType === 'non' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'non' ? '700' : '500' }]}>
                  Non-Time Based
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DATE & TIME CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: primaryColor }]}>Date & Time Settings</Text>

            <View style={styles.calendarBox}>
              <TouchableOpacity
                onPress={() => setShowDate(true)}
                style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
                activeOpacity={0.7}
              >
                <View style={styles.dateTimeInfo}>
                  <Icon name="calendar-outline" size={18} color={primaryColor} />
                  <Text style={[styles.dateText, { color: textColor }]}>
                    {date.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.changeText, { color: primaryColor }]}>Change Date</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowTime(true)}
                style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
                activeOpacity={0.7}
              >
                <View style={styles.dateTimeInfo}>
                  <Icon name="time-outline" size={18} color={primaryColor} />
                  <Text style={[styles.dateText, { color: textColor }]}>
                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.changeText, { color: primaryColor }]}>Change Time</Text>
              </TouchableOpacity>

              {showDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onChangeDate}
                />
              )}

              {showTime && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onChange={onChangeTime}
                />
              )}
            </View>
          </View>

          {/* RECIPIENT DROPDOWN CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: primaryColor }]}>Assign Task To</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: inputBg, borderColor: borderClr }]}
              onPress={() => navigation.navigate("ForwardTaskTo")}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownText, { color: textColor }]}>Select Recipient / Group</Text>
              <Icon name="chevron-down" size={18} color={subTextColor} />
            </TouchableOpacity>
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
              onPress={() => navigation.goBack()}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: textColor }]}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btn,
                styles.submitBtn,
                { backgroundColor: primaryColor },
                loading && styles.btnDisabled,
              ]}
              onPress={AddTask}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>ADD TASK</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor: theme.bottomNav || (isDark ? '#1E293B' : '#0F172A'),
            borderTopColor: borderClr,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
          <Text style={styles.bottomNavText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('AddMember')}
          activeOpacity={0.7}
        >
          <Icon name="person-add-outline" size={22} color="#94A3B8" />
          <Text style={styles.bottomNavText}>Members</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.bottomNavText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.bottomNavText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddTaskTimeBased;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  descriptionInput: { minHeight: 110 },
  radioRow: {
    flexDirection: width < 360 ? 'column' : 'row',
    gap: 12,
  },
  radioItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 50,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioText: { fontSize: 14 },
  calendarBox: { gap: 10 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  dateTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdown: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  submitBtn: {
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
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
    paddingVertical: 6,
    minHeight: 48,
  },
  bottomNavText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
});
































// import React, { useState } from 'react';
// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   Alert,
//   Platform,
//   ActivityIndicator,
// } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Icon from 'react-native-vector-icons/Ionicons';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import { apiClient } from '../../utils/apiClient';
// import { useTheme } from '../../context/ThemeContext';


// const AddTaskTimeBased = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   const [taskType, setTaskType] = useState('time');
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');

//   const [date, setDate] = useState(new Date());
//   const [showDate, setShowDate] = useState(false);
//   const [showTime, setShowTime] = useState(false);

//   const [loading, setLoading] = useState(false);

//   const [groups, setGroups] = useState([]);
//   const [selectedGroup, setSelectedGroup] = useState(null);
//   const [showGroupDropdown, setShowGroupDropdown] = useState(false);

//   const groupIdParam = route?.params?.groupId || null;

//   React.useEffect(() => {
//     const fetchGroups = async () => {
//       try {
//         const response = await apiClient('/groups');
//         if (response && response.success) setGroups(response.data || []);
//       } catch (err) {}
//     };
//     fetchGroups();
//   }, []);

//   // ✅ DATE HANDLER
//   const onChangeDate = (event, selectedDate) => {
//     if (Platform.OS === 'android') setShowDate(false);

//     if (selectedDate) {
//       const newDate = new Date(date);
//       newDate.setFullYear(selectedDate.getFullYear());
//       newDate.setMonth(selectedDate.getMonth());
//       newDate.setDate(selectedDate.getDate());
//       setDate(newDate);
//     }
//   };

//   // ✅ TIME HANDLER
//   const onChangeTime = (event, selectedTime) => {
//     if (Platform.OS === 'android') setShowTime(false);

//     if (selectedTime) {
//       const newDate = new Date(date);
//       newDate.setHours(selectedTime.getHours());
//       newDate.setMinutes(selectedTime.getMinutes());
//       setDate(newDate);
//     }
//   };

//   // ✅ API FUNCTION
//   const AddTask = async () => {
//     // Validation
//     if (!title.trim() || !description.trim()) {
//       Alert.alert("Error", "Please fill all fields");
//       return;
//     }

//     // Check login
//     const token = await AsyncStorage.getItem("token");

//     if (!token) {
//       Alert.alert(
//         "Session Expired",
//         "Please login again.",
//         [
//           {
//             text: "OK",
//             onPress: () => navigation.replace("Login"),
//           },
//         ]
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const response = await apiClient("/tasks", {
//         method: "POST",
//         body: JSON.stringify({
//           title: title.trim(),
//           description: description.trim(),
//           dueDate:
//             date.getFullYear() +
//             "-" +
//             String(date.getMonth() + 1).padStart(2, "0") +
//             "-" +
//             String(date.getDate()).padStart(2, "0"),
//           dueTime:
//             String(date.getHours()).padStart(2, "0") +
//             ":" +
//             String(date.getMinutes()).padStart(2, "0"),
//           isTimeBased: true,
//           groupId: groupIdParam,
//         }),
//       });

//       console.log("Create Task Response:", response);

//       if (response?.success) {
//         Alert.alert(
//           "Success",
//           response.message || "Task created successfully.",
//           [
//             {
//               text: "OK",
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         setTitle("");
//         setDescription("");
//         setDate(new Date());

//       } else {
//         Alert.alert(
//           "Error",
//           response?.message || "Failed to create task."
//         );
//       }

//     } catch (error) {
//       console.log("Add Task Error:", error);

//       Alert.alert(
//         "Error",
//         error.message || "Server not reachable."
//       );

//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleNonTimeBased = () => {
//     setTaskType('non');
//     navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
//   };

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <ScrollView contentContainerStyle={styles.content}>

//         {/* HEADER */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()}>
//             <Icon name="arrow-back" size={22} color={theme.text} />
//           </TouchableOpacity>

//           <View style={[styles.headerBox, { backgroundColor: theme.headerBox }]}>
//             <Text style={[styles.headerText, { color: theme.text }]}>ADD-TASK</Text>
//           </View>

//           <View style={{ width: 22 }} />
//         </View>

//         {/* TITLE */}
//         <View style={[styles.card, { backgroundColor: theme.card }]}>
//           <Text style={[styles.label, { color: theme.text }]}>TITLE:</Text>
//           <TextInput value={title} onChangeText={setTitle} />
//         </View>

//         {/* DESCRIPTION */}
//         <View style={[styles.card, { height: 120 }, { backgroundColor: theme.card }]}>
//           <Text style={[styles.label, { color: theme.text }]}>DESCRIPTION</Text>
//           <TextInput
//             multiline
//             value={description}
//             onChangeText={setDescription}
//           />
//         </View>

//         {/* TYPE */}
//         <Text style={[styles.section, { color: theme.text }]}>TIME BASED & NON TIME BASED:</Text>

//         <View style={styles.radioRow}>
//           <TouchableOpacity onPress={() => setTaskType('time')} style={styles.radioItem}>
//             <View style={styles.radioOuter}>
//               {taskType === 'time' && <View style={styles.radioInner} />}
//             </View>
//             <Text style={{ color: theme.text }}>TIME BASED</Text>
//           </TouchableOpacity>

//           <TouchableOpacity onPress={handleNonTimeBased} style={styles.radioItem}>
//             <View style={styles.radioOuter}>
//               {taskType === 'non' && <View style={styles.radioInner} />}
//             </View>
//             <Text style={{ color: theme.text }}>NON-TIME BASED</Text>
//           </TouchableOpacity>
//         </View>

//         {/* DATE & TIME */}
//         <Text style={[styles.section, { color: theme.text }]}>DATE & TIME</Text>

//         <View style={styles.calendarBox}>

//           {/* DATE */}
//           <TouchableOpacity onPress={() => setShowDate(true)} style={styles.dateRow}>
//             <Text style={[styles.dateText, { color: theme.text }]}>
//               {date.toLocaleDateString()}
//             </Text>
//             <Icon name="calendar-outline" size={18} color={theme.text} />
//           </TouchableOpacity>

//           {/* TIME */}
//           <TouchableOpacity onPress={() => setShowTime(true)} style={styles.dateRow}>
//             <Text style={[styles.dateText, { color: theme.text }]}>
//               {date.toLocaleTimeString()}
//             </Text>
//             <Icon name="time-outline" size={18} color={theme.text} />
//           </TouchableOpacity>

//           {/* DATE PICKER */}
//           {showDate && (
//             <DateTimePicker
//               value={date}
//               mode="date"
//               display="calendar"
//               onChange={onChangeDate}
//             />
//           )}

//           {/* TIME PICKER */}
//           {showTime && (
//             <DateTimePicker
//               value={date}
//               mode="time"
//               display="spinner"
//               onChange={onChangeTime}
//             />
//           )}

//         </View>

//         {/* DROPDOWN */}
//         <TouchableOpacity
//           style={styles.dropdown}
//           onPress={() => navigation.navigate("ForwardTaskTo")}
//         >
//           <Text style={{ fontWeight: '600' }}>ADD TASK FOR</Text>
//           <Icon name="chevron-down" size={18} color={theme.text} />
//         </TouchableOpacity>

//         {/* BUTTONS */}
//         <View style={styles.btnRow}>
//           <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
//             <Text style={styles.btnText}>CANCEL</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.btn} onPress={AddTask}>
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.btnText}>ADD</Text>
//             )}
//           </TouchableOpacity>
//         </View>

//       </ScrollView>

//       {/* BOTTOM NAV */}
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

// export default AddTaskTimeBased;

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#B7C9DB' },
//   content: { padding: 20, paddingBottom: 120 },

//   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   headerBox: { backgroundColor: '#fff', padding: 10, borderRadius: 10 },
//   headerText: { fontWeight: '800' },

//   card: { backgroundColor: '#EDEDED', borderRadius: 12, padding: 14, marginTop: 18 },
//   label: { fontWeight: '800' },

//   section: { marginTop: 20, fontWeight: '800' },

//   radioRow: { flexDirection: 'row', marginTop: 10 },
//   radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },

//   radioOuter: {
//     width: 18,
//     height: 18,
//     borderRadius: 9,
//     borderWidth: 2,
//     marginRight: 6,
//     alignItems: 'center',
//     justifyContent: 'center'
//   },

//   radioInner: { width: 8, height: 8, backgroundColor: '#000', borderRadius: 4 },

//   calendarBox: {
//     marginTop: 10,
//     backgroundColor: '#EDEDED',
//     borderRadius: 10,
//     padding: 10
//   },

//   dateRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     paddingVertical: 12
//   },

//   dateText: { fontSize: 14 },

//   dropdown: {
//     marginTop: 20,
//     backgroundColor: '#EDEDED',
//     borderRadius: 25,
//     padding: 14,
//     flexDirection: 'row',
//     justifyContent: 'space-between'
//   },

//   btnRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 30
//   },

//   btn: {
//     width: '45%',
//     backgroundColor: '#000',
//     padding: 14,
//     borderRadius: 30,
//     alignItems: 'center'
//   },

//   btnText: { color: '#fff', fontWeight: '800' },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     width: '100%',
//     height: 65,
//     backgroundColor: '#3A3F45',
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center'
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center'
//   },
// });