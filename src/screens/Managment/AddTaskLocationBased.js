import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { postJson } from '../../services/locationApi';
import LocationCard from '../../components/LocationCard';
import { takePickedLocation } from '../../services/locationPicker';
import { DEFAULT_GEOFENCE_RADIUS_METERS } from '../../services/location';


// Same local helper the other screens use: bounce to the Login screen
// by resetting into the AuthStack.
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

/**
 * Add a LOCATION BASED task.
 *
 * Same family as AddTaskTimeBased / AddTaskNonTimeBased — the three radios
 * switch between the three task types.
 *
 * The difference: this task has no date and no time. Its trigger is the
 * place you save. The phone raises "you are near this place" when you come
 * back within the radius, and the task shows up in the Non-Time lists
 * (isTimeBased = false).
 */
const AddTaskLocationBased = ({ navigation, route }) => {
  const { theme } = useTheme();

  const groupIdParam = route?.params?.groupId;

  const isGroupTask =
    groupIdParam !== null &&
    groupIdParam !== undefined &&
    String(groupIdParam).trim() !== '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // The place this task belongs to. Required — it is the whole trigger.
  const [geofence, setGeofence] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
    geofenceEnabled: true,
  });

  const hasPlace =
    geofence.latitude !== null && geofence.longitude !== null;

  // Collect the spot chosen on the map when we come back into focus.
  useFocusEffect(
    useCallback(() => {
      const picked = takePickedLocation();

      if (picked) {
        setGeofence(current => ({ ...current, ...picked }));
      }
    }, []),
  );

  // ---------------------------------------------------------------- theme

  const textColor = theme.text || '#0F172A';
  const subTextColor = theme.subText || '#64748B';
  const primaryColor = theme.primary || '#0EA5E9';
  const borderClr = theme.border || '#E2E8F0';

  const isDark =
    theme.bg === '#000000' || theme.bg === '#0F172A';

  const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

  const inputBg =
    theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');

  // ------------------------------------------------- type switching

  const handleTimeBasedNavigation = () => {
    const params = {};

    if (isGroupTask) {
      params.groupId = Number(groupIdParam);
    }

    navigation.navigate('AddTaskTimeBased', params);
  };

  const handleNonTimeBasedNavigation = () => {
    const params = {};

    if (isGroupTask) {
      params.groupId = Number(groupIdParam);
    }

    navigation.navigate('AddTaskNonTimeBased', params);
  };

  // ---------------------------------------------------------------- save

  const AddTask = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a task title.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a task description.');
      return;
    }

    if (!hasPlace) {
      Alert.alert(
        'Set a Reminder Place',
        'Tap "Use my current location" so the task knows where to remind you.',
      );
      return;
    }

    try {
      setLoading(true);

      const data = await postJson('/Managment/task', {
        title: title.trim(),
        description: description.trim(),

        // Location based: no date, no time — the place is the trigger.
        dueDate: null,
        dueTime: null,
        isTimeBased: false,

        groupId: isGroupTask ? Number(groupIdParam) : null,

        // The place this task belongs to, plus its alert radius.
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        geofenceRadiusMeters: geofence.geofenceRadiusMeters,
        geofenceEnabled: geofence.geofenceEnabled && hasPlace,
      });

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to create task.');
      }

      Alert.alert('Success', data.message || 'Task created successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      if (error?.isSessionExpired) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      if (error?.kind === 'network') {
        Alert.alert('Connection Error', 'Could not reach the server.');
        return;
      }

      Alert.alert('Error', error?.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------- ui

  const canSubmit =
    !loading && Boolean(title.trim()) && Boolean(description.trim()) && hasPlace;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* ---------------------------------------------------- HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.bg, borderBottomColor: borderClr },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            { backgroundColor: theme.headerBox || inputBg },
          ]}
        >
          <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------- TASK TYPE RADIOS */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
          <Text style={[styles.label, { color: textColor }]}>Task Type</Text>

          <View style={styles.radioContainer}>
            {/* (1) TIME BASED */}
            <TouchableOpacity
              onPress={handleTimeBasedNavigation}
              style={[
                styles.radioItem,
                { backgroundColor: inputBg, borderColor: borderClr },
              ]}
              activeOpacity={0.7}
              disabled={loading}
            >
              <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
                {null}
              </View>

              <View style={styles.radioTextWrapper}>
                <Text style={[styles.radioLabelText, { color: textColor }]}>
                  Time Based
                </Text>

                <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                  Set precise date & time
                </Text>
              </View>

              <Icon name="time-outline" size={18} color={subTextColor} />
            </TouchableOpacity>

            {/* (2) NON-TIME BASED */}
            <TouchableOpacity
              onPress={handleNonTimeBasedNavigation}
              style={[
                styles.radioItem,
                { backgroundColor: inputBg, borderColor: borderClr },
              ]}
              activeOpacity={0.7}
              disabled={loading}
            >
              <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
                {null}
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

            {/* (3) LOCATION BASED — selected */}
            <TouchableOpacity
              style={[
                styles.radioItem,
                styles.radioItemActive,
                {
                  borderColor: primaryColor,
                  backgroundColor: `${primaryColor}18`,
                },
              ]}
              activeOpacity={1}
            >
              <View style={[styles.radioOuter, { borderColor: primaryColor }]}>
                <View
                  style={[styles.radioInner, { backgroundColor: primaryColor }]}
                />
              </View>

              <View style={styles.radioTextWrapper}>
                <Text style={[styles.radioLabelText, { color: textColor }]}>
                  Location Based
                </Text>

                <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
                  Remind me when I arrive at a place
                </Text>
              </View>

              <Icon name="location-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* --------------------------------------------------- TITLE */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
          <Text style={[styles.label, { color: textColor }]}>Task Title</Text>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
            ]}
            placeholder="e.g. Buy groceries"
            placeholderTextColor={subTextColor}
            value={title}
            onChangeText={setTitle}
            editable={!loading}
          />
        </View>

        {/* --------------------------------------------- DESCRIPTION */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
          <Text style={[styles.label, { color: textColor }]}>Description</Text>

          <TextInput
            style={[
              styles.descriptionInput,
              { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
            ]}
            placeholder="What needs to be done at this place?"
            placeholderTextColor={subTextColor}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        {/* --------------------------------------------- THE PLACE */}
        <LocationCard
          value={geofence}
          onChange={setGeofence}
          navigation={navigation}
        />

        {/* ----------------------------------------------- ADD TASK */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.cancelBtn,
              { borderColor: borderClr },
            ]}
            onPress={() => navigation.goBack()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.submitBtn,
              { backgroundColor: primaryColor },
              !canSubmit && styles.btnDisabled,
            ]}
            onPress={AddTask}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>ADD TASK</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  backBtn: {
    padding: 4,
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },

  headerText: {
    fontSize: 15,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 32,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },

  descriptionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 96,
  },

  radioContainer: {
    marginTop: 2,
  },

  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },

  radioItemActive: {
    borderWidth: 2,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    fontWeight: '700',
  },

  radioSubLabelText: {
    fontSize: 11.5,
    marginTop: 3,
  },

  btnRow: {
    flexDirection: 'row',
    marginTop: 6,
  },

  btn: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },

  cancelBtn: {
    borderWidth: 1,
    marginRight: 10,
    backgroundColor: 'transparent',
  },

  submitBtn: {
    borderWidth: 0,
  },

  btnDisabled: {
    opacity: 0.5,
  },

  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default AddTaskLocationBased;



























// import React, { useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';

// import { useTheme } from '../../context/ThemeContext';
// import { postJson } from '../../services/locationApi';
// import LocationCard from '../../components/LocationCard';
// import { DEFAULT_GEOFENCE_RADIUS_METERS } from '../../services/location';


// // Same local helper the other screens use: bounce to the Login screen
// // by resetting into the AuthStack.
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

// /**
//  * Add a LOCATION BASED task.
//  *
//  * Same family as AddTaskTimeBased / AddTaskNonTimeBased — the three radios
//  * switch between the three task types.
//  *
//  * The difference: this task has no date and no time. Its trigger is the
//  * place you save. The phone raises "you are near this place" when you come
//  * back within the radius, and the task shows up in the Non-Time lists
//  * (isTimeBased = false).
//  */
// const AddTaskLocationBased = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const groupIdParam = route?.params?.groupId;

//   const isGroupTask =
//     groupIdParam !== null &&
//     groupIdParam !== undefined &&
//     String(groupIdParam).trim() !== '';

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [loading, setLoading] = useState(false);

//   // The place this task belongs to. Required — it is the whole trigger.
//   const [geofence, setGeofence] = useState({
//     latitude: null,
//     longitude: null,
//     accuracy: null,
//     geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
//     geofenceEnabled: true,
//   });

//   const hasPlace =
//     geofence.latitude !== null && geofence.longitude !== null;

//   // ---------------------------------------------------------------- theme

//   const textColor = theme.text || '#0F172A';
//   const subTextColor = theme.subText || '#64748B';
//   const primaryColor = theme.primary || '#0EA5E9';
//   const borderClr = theme.border || '#E2E8F0';

//   const isDark =
//     theme.bg === '#000000' || theme.bg === '#0F172A';

//   const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

//   const inputBg =
//     theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');

//   // ------------------------------------------------- type switching

//   const handleTimeBasedNavigation = () => {
//     const params = {};

//     if (isGroupTask) {
//       params.groupId = Number(groupIdParam);
//     }

//     navigation.navigate('AddTaskTimeBased', params);
//   };

//   const handleNonTimeBasedNavigation = () => {
//     const params = {};

//     if (isGroupTask) {
//       params.groupId = Number(groupIdParam);
//     }

//     navigation.navigate('AddTaskNonTimeBased', params);
//   };

//   // ---------------------------------------------------------------- save

//   const AddTask = async () => {
//     if (!title.trim()) {
//       Alert.alert('Missing Title', 'Please enter a task title.');
//       return;
//     }

//     if (!description.trim()) {
//       Alert.alert('Missing Description', 'Please enter a task description.');
//       return;
//     }

//     if (!hasPlace) {
//       Alert.alert(
//         'Set a Reminder Place',
//         'Tap "Use my current location" so the task knows where to remind you.',
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const data = await postJson('/Managment/task', {
//         title: title.trim(),
//         description: description.trim(),

//         // Location based: no date, no time — the place is the trigger.
//         dueDate: null,
//         dueTime: null,
//         isTimeBased: false,

//         groupId: isGroupTask ? Number(groupIdParam) : null,

//         // The place this task belongs to, plus its alert radius.
//         latitude: geofence.latitude,
//         longitude: geofence.longitude,
//         geofenceRadiusMeters: geofence.geofenceRadiusMeters,
//         geofenceEnabled: geofence.geofenceEnabled && hasPlace,
//       });

//       if (!data?.success) {
//         throw new Error(data?.message || 'Failed to create task.');
//       }

//       Alert.alert('Success', data.message || 'Task created successfully.', [
//         {
//           text: 'OK',
//           onPress: () => navigation.goBack(),
//         },
//       ]);
//     } catch (error) {
//       if (error?.isSessionExpired) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//         return;
//       }

//       if (error?.kind === 'network') {
//         Alert.alert('Connection Error', 'Could not reach the server.');
//         return;
//       }

//       Alert.alert('Error', error?.message || 'Failed to create task.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------------------------------------------------------------- ui

//   const canSubmit =
//     !loading && Boolean(title.trim()) && Boolean(description.trim()) && hasPlace;

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <StatusBar
//         barStyle={isDark ? 'light-content' : 'dark-content'}
//         backgroundColor={theme.bg}
//       />

//       {/* ---------------------------------------------------- HEADER */}
//       <View
//         style={[
//           styles.header,
//           { backgroundColor: theme.bg, borderBottomColor: borderClr },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.backBtn}
//           activeOpacity={0.7}
//         >
//           <Icon name="arrow-back" size={24} color={textColor} />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             { backgroundColor: theme.headerBox || inputBg },
//           ]}
//         >
//           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
//         </View>

//         <View style={styles.headerSpacer} />
//       </View>

//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* ---------------------------------------- TASK TYPE RADIOS */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Task Type</Text>

//           <View style={styles.radioContainer}>
//             {/* (1) TIME BASED */}
//             <TouchableOpacity
//               onPress={handleTimeBasedNavigation}
//               style={[
//                 styles.radioItem,
//                 { backgroundColor: inputBg, borderColor: borderClr },
//               ]}
//               activeOpacity={0.7}
//               disabled={loading}
//             >
//               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
//                 {null}
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Time Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Set precise date & time
//                 </Text>
//               </View>

//               <Icon name="time-outline" size={18} color={subTextColor} />
//             </TouchableOpacity>

//             {/* (2) NON-TIME BASED */}
//             <TouchableOpacity
//               onPress={handleNonTimeBasedNavigation}
//               style={[
//                 styles.radioItem,
//                 { backgroundColor: inputBg, borderColor: borderClr },
//               ]}
//               activeOpacity={0.7}
//               disabled={loading}
//             >
//               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
//                 {null}
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Non-Time Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Full-day task with due date only
//                 </Text>
//               </View>

//               <Icon name="calendar-outline" size={18} color={subTextColor} />
//             </TouchableOpacity>

//             {/* (3) LOCATION BASED — selected */}
//             <TouchableOpacity
//               style={[
//                 styles.radioItem,
//                 styles.radioItemActive,
//                 {
//                   borderColor: primaryColor,
//                   backgroundColor: `${primaryColor}18`,
//                 },
//               ]}
//               activeOpacity={1}
//             >
//               <View style={[styles.radioOuter, { borderColor: primaryColor }]}>
//                 <View
//                   style={[styles.radioInner, { backgroundColor: primaryColor }]}
//                 />
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Location Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Remind me when I arrive at a place
//                 </Text>
//               </View>

//               <Icon name="location-outline" size={18} color={primaryColor} />
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* --------------------------------------------------- TITLE */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Task Title</Text>

//           <TextInput
//             style={[
//               styles.input,
//               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
//             ]}
//             placeholder="e.g. Buy groceries"
//             placeholderTextColor={subTextColor}
//             value={title}
//             onChangeText={setTitle}
//             editable={!loading}
//           />
//         </View>

//         {/* --------------------------------------------- DESCRIPTION */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Description</Text>

//           <TextInput
//             style={[
//               styles.descriptionInput,
//               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
//             ]}
//             placeholder="What needs to be done at this place?"
//             placeholderTextColor={subTextColor}
//             value={description}
//             onChangeText={setDescription}
//             multiline
//             numberOfLines={4}
//             textAlignVertical="top"
//             editable={!loading}
//           />
//         </View>

//         {/* --------------------------------------------- THE PLACE */}
//         <LocationCard value={geofence} onChange={setGeofence} />

//         {/* ----------------------------------------------- ADD TASK */}
//         <View style={styles.btnRow}>
//           <TouchableOpacity
//             style={[
//               styles.btn,
//               styles.cancelBtn,
//               { borderColor: borderClr },
//             ]}
//             onPress={() => navigation.goBack()}
//             disabled={loading}
//             activeOpacity={0.8}
//           >
//             <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.btn,
//               styles.submitBtn,
//               { backgroundColor: primaryColor },
//               !canSubmit && styles.btnDisabled,
//             ]}
//             onPress={AddTask}
//             disabled={!canSubmit}
//             activeOpacity={0.8}
//           >
//             {loading ? (
//               <ActivityIndicator color="#FFFFFF" size="small" />
//             ) : (
//               <Text style={styles.submitBtnText}>ADD TASK</Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//   },

//   backBtn: {
//     padding: 4,
//   },

//   headerBox: {
//     paddingHorizontal: 16,
//     paddingVertical: 7,
//     borderRadius: 20,
//   },

//   headerText: {
//     fontSize: 15,
//     fontWeight: '700',
//   },

//   headerSpacer: {
//     width: 32,
//   },

//   content: {
//     padding: 16,
//     paddingBottom: 40,
//   },

//   card: {
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 16,
//     marginBottom: 14,
//   },

//   label: {
//     fontSize: 14,
//     fontWeight: '700',
//     marginBottom: 10,
//   },

//   input: {
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     fontSize: 14,
//   },

//   descriptionInput: {
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     fontSize: 14,
//     minHeight: 96,
//   },

//   radioContainer: {
//     marginTop: 2,
//   },

//   radioItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderRadius: 14,
//     paddingHorizontal: 14,
//     paddingVertical: 13,
//     marginBottom: 10,
//   },

//   radioItemActive: {
//     borderWidth: 2,
//   },

//   radioOuter: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },

//   radioInner: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//   },

//   radioTextWrapper: {
//     flex: 1,
//   },

//   radioLabelText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   radioSubLabelText: {
//     fontSize: 11.5,
//     marginTop: 3,
//   },

//   btnRow: {
//     flexDirection: 'row',
//     marginTop: 6,
//   },

//   btn: {
//     flex: 1,
//     borderRadius: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 15,
//   },

//   cancelBtn: {
//     borderWidth: 1,
//     marginRight: 10,
//     backgroundColor: 'transparent',
//   },

//   submitBtn: {
//     borderWidth: 0,
//   },

//   btnDisabled: {
//     opacity: 0.5,
//   },

//   btnText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   submitBtnText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
// });

// export default AddTaskLocationBased;
