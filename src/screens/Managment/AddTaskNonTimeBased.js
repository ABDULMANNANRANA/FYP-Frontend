import React, { useState } from "react";
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
} from "react-native";
import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../../context/ThemeContext";
import { BASE_URL } from "../../config/api";

const { width } = Dimensions.get("window");

// Helper: reset navigation to the Login screen inside AuthStack.
const goToLogin = (navigation) => {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: "AuthStack",
        state: {
          routes: [{ name: "Login" }],
        },
      },
    ],
  });
};

// Format a JS Date as "yyyy-MM-dd" to match backend DateOnly format
const toDateOnlyString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const AddTaskNonTimeBased = ({ navigation, route }) => {
  const { theme } = useTheme();

  const [taskType, setTaskType] = useState("non");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);

  const [loading, setLoading] = useState(false);

  const groupIdParam = route?.params?.groupId || null;

  // HANDLE DATE
  const onChangeDate = (event, selectedDate) => {
    setShowDate(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // ADD TASK
  const AddTask = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    const token = await AsyncStorage.getItem("token");

    if (!token) {
      Alert.alert("Session Expired", "Please login again.", [
        {
          text: "OK",
          onPress: () => goToLogin(navigation),
        },
      ]);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${BASE_URL}/Managment/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: toDateOnlyString(date),
          isTimeBased: false,
          groupId: groupIdParam,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server.");
      }

      console.log("Add Task Response:", data);

      if (response.ok && data?.success) {
        Alert.alert(
          "Success",
          data.message || "Task created successfully.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );

        setTitle("");
        setDescription("");
        setDate(new Date());
      } else {
        Alert.alert("Error", data?.message || "Failed to create task.");
      }
    } catch (error) {
      console.log("Add Task Error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert("Error", error?.message || "Server not reachable.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Color Palette standardizing with context themes safely
  const primaryColor = theme.primary || "#2563EB";
  const cardBg = theme.card || "#FFFFFF";
  const textColor = theme.text || "#0F172A";
  const subTextColor = theme.subText || "#64748B";
  const borderClr = theme.border || "#E2E8F0";
  const inputBg = theme.inputBg || (theme.bg === "#000000" || theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.bg === "#000000" || theme.bg === "#0F172A" ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* FIXED HEADER */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: borderClr }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={textColor} />
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
            <Text style={[styles.label, { color: textColor }]}>Task Title</Text>
            <TextInput
              placeholder="e.g. Design System Documentation"
              placeholderTextColor={subTextColor}
              style={[styles.input, { color: textColor, backgroundColor: inputBg, borderColor: borderClr }]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* DESCRIPTION INPUT CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: textColor }]}>Description</Text>
            <TextInput
              placeholder="Provide context or instructions for this task..."
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

          {/* TASK TYPE SELECTOR */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: textColor }]}>Task Mode</Text>
            <View style={styles.radioContainer}>
              <TouchableOpacity
                onPress={() => setTaskType("time")}
                style={[
                  styles.radioItem,
                  { backgroundColor: inputBg, borderColor: taskType === "time" ? primaryColor : borderClr },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, { borderColor: taskType === "time" ? primaryColor : subTextColor }]}>
                  {taskType === "time" && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === "time" ? "700" : "500" }]}>
                  Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTaskType("non")}
                style={[
                  styles.radioItem,
                  { backgroundColor: inputBg, borderColor: taskType === "non" ? primaryColor : borderClr },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, { borderColor: taskType === "non" ? primaryColor : subTextColor }]}>
                  {taskType === "non" && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === "non" ? "700" : "500" }]}>
                  Non-Time Based
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DUE DATE CARD */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: textColor }]}>Due Date</Text>
            <TouchableOpacity
              style={[styles.dateSelector, { backgroundColor: inputBg, borderColor: borderClr }]}
              onPress={() => setShowDate(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateInfoLeft}>
                <Icon name="calendar-outline" size={20} color={primaryColor} />
                <Text style={[styles.dateText, { color: textColor }]}>{date.toDateString()}</Text>
              </View>
              <Text style={[styles.chooseDate, { color: primaryColor }]}>Change Date</Text>
            </TouchableOpacity>
          </View>

          {/* DATE PICKER COMPONENT */}
          {showDate && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              onChange={onChangeDate}
            />
          )}

          {/* ASSIGNMENT DROPDOWN */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            <Text style={[styles.label, { color: textColor }]}>Assign Task To</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("ForwardTaskTo")}
              style={[styles.dropdown, { backgroundColor: inputBg, borderColor: borderClr }]}
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
              style={[styles.btn, styles.submitBtn, { backgroundColor: primaryColor }, loading && styles.btnDisabled]}
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

      {/* BOTTOM NAVIGATION BAR */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor: theme.bottomNav || (theme.bg === "#000000" || theme.bg === "#0F172A" ? "#1E293B" : "#0F172A"),
            borderTopColor: borderClr,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("HomeDashboard")}
          activeOpacity={0.7}
        >
          <Icon name="home" size={22} color="#FFFFFF" />
          <Text style={styles.bottomNavText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("AddMember")}
          activeOpacity={0.7}
        >
          <Icon name="person-add" size={22} color="#FFFFFF" />
          <Text style={styles.bottomNavText}>Members</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("TimeBasedHistoryScreen")}
          activeOpacity={0.7}
        >
          <Icon name="time" size={22} color="#FFFFFF" />
          <Text style={styles.bottomNavText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("SettingScreen")}
          activeOpacity={0.7}
        >
          <Icon name="settings" size={22} color="#FFFFFF" />
          <Text style={styles.bottomNavText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddTaskNonTimeBased;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },

  /* HEADER STYLES */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },

  backBtn: {
    padding: 8,
    borderRadius: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  headerSpacer: {
    width: 40,
  },

  /* LAYOUT & CONTENT */
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100, // Safe clearance for bottom navigation
  },

  responsiveWrapper: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },

  /* CARD STYLES */
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    // Soft shadow for depth
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  /* INPUT STYLES */
  input: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },

  descriptionInput: {
    minHeight: 110,
  },

  /* RADIO STYLES */
  radioContainer: {
    flexDirection: width < 360 ? "column" : "row",
    gap: 10,
  },

  radioItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  radioText: {
    fontSize: 14,
  },

  /* DATE STYLES */
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },

  dateInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dateText: {
    fontSize: 14,
    fontWeight: "600",
  },

  chooseDate: {
    fontSize: 13,
    fontWeight: "700",
  },

  /* DROPDOWN STYLES */
  dropdown: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
  },

  dropdownText: {
    fontSize: 14,
    fontWeight: "500",
  },

  /* ACTION BUTTONS */
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },

  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  cancelBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },

  submitBtn: {
    elevation: 3,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  btnDisabled: {
    opacity: 0.6,
  },

  btnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* BOTTOM NAVIGATION BAR */
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  iconBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minHeight: 48,
  },

  bottomNavText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
});
















































// import React, { useState } from "react";
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
// } from "react-native";
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import DateTimePicker from "@react-native-community/datetimepicker";

// import { useTheme } from "../../context/ThemeContext";
// import { BASE_URL } from "../../config/api";

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
//         name: "AuthStack",
//         state: {
//           routes: [{ name: "Login" }],
//         },
//       },
//     ],
//   });
// };

// // Format a JS Date as "yyyy-MM-dd" to match the backend's
// // DateOnly binding for CreateTaskDto.DueDate. Sending a full
// // ISO timestamp (date.toISOString()) does not reliably bind
// // to DateOnly and can fail or produce the wrong date.
// const toDateOnlyString = d => {
//   const year = d.getFullYear();
//   const month = String(d.getMonth() + 1).padStart(2, "0");
//   const day = String(d.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`;
// };

// const AddTaskNonTimeBased = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const [taskType, setTaskType] = useState("non");
//   const [title, setTitle] = useState("");
//   const [description, setDescription] = useState("");

//   const [date, setDate] = useState(new Date());
//   const [showDate, setShowDate] = useState(false);

//   const [loading, setLoading] = useState(false);

//   const groupIdParam = route?.params?.groupId || null;

//   // ==========================================
//   // HANDLE DATE
//   // ==========================================
//   const onChangeDate = (event, selectedDate) => {
//     setShowDate(false);

//     if (selectedDate) {
//       setDate(selectedDate);
//     }
//   };

//   // ==========================================
//   // ADD TASK
//   // ==========================================
//   const AddTask = async () => {
//     if (!title.trim() || !description.trim()) {
//       Alert.alert(
//         "Error",
//         "Please fill all fields"
//       );
//       return;
//     }

//     // Check authentication
//     const token =
//       await AsyncStorage.getItem("token");

//     if (!token) {
//       Alert.alert(
//         "Session Expired",
//         "Please login again.",
//         [
//           {
//             text: "OK",
//             onPress: () => goToLogin(navigation),
//           },
//         ]
//       );

//       return;
//     }

//     try {
//       setLoading(true);

//       // NOTE: correct route is "api/Managment/task"
//       // (ManagmentController.CreateTask), not "api/tasks"
//       // which does not exist on the backend.
//       const response = await fetch(
//         `${BASE_URL}/Managment/task`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: title.trim(),
//             description: description.trim(),
//             // NOTE: backend expects a DateOnly ("yyyy-MM-dd"),
//             // not a full ISO timestamp.
//             dueDate: toDateOnlyString(date),
//             isTimeBased: false,
//             groupId: groupIdParam,
//           }),
//         }
//       );

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error(
//           "Invalid response received from server."
//         );
//       }

//       console.log(
//         "Add Task Response:",
//         data
//       );

//       if (response.ok && data?.success) {
//         Alert.alert(
//           "Success",
//           data.message ||
//             "Task created successfully.",
//           [
//             {
//               text: "OK",
//               onPress: () =>
//                 navigation.goBack(),
//             },
//           ]
//         );

//         setTitle("");
//         setDescription("");
//         setDate(new Date());
//       } else {
//         Alert.alert(
//           "Error",
//           data?.message ||
//             "Failed to create task."
//         );
//       }
//     } catch (error) {
//       console.log(
//         "Add Task Error:",
//         error
//       );

//       if (
//         error?.message ===
//         "Network request failed"
//       ) {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message ||
//             "Server not reachable."
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor: theme.bg,
//         },
//       ]}
//     >
//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//       >
//         {/* HEADER */}
//         <View style={styles.header}>
//           <TouchableOpacity
//             onPress={() =>
//               navigation.goBack()
//             }
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
//               {
//                 backgroundColor:
//                   theme.headerBox,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.headerText,
//                 {
//                   color: theme.text,
//                 },
//               ]}
//             >
//               ADD-TASK
//             </Text>
//           </View>

//           <View style={{ width: 22 }} />
//         </View>

//         {/* TITLE */}
//         <View
//           style={[
//             styles.card,
//             {
//               backgroundColor:
//                 theme.card,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.label,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             TITLE:
//           </Text>

//           <TextInput
//             placeholder="TITLE"
//             placeholderTextColor="#888"
//             style={[
//               styles.input,
//               {
//                 color: theme.text,
//               },
//             ]}
//             value={title}
//             onChangeText={setTitle}
//           />
//         </View>

//         {/* DESCRIPTION */}
//         <View
//           style={[
//             styles.card,
//             styles.descriptionCard,
//             {
//               backgroundColor:
//                 theme.card,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.label,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             DESCRIPTION
//           </Text>

//           <TextInput
//             placeholder="DESCRIPTION"
//             placeholderTextColor="#888"
//             multiline
//             textAlignVertical="top"
//             style={[
//               styles.input,
//               styles.descriptionInput,
//               {
//                 color: theme.text,
//               },
//             ]}
//             value={description}
//             onChangeText={setDescription}
//           />
//         </View>

//         {/* TYPE */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           TIME BASED & NON TIME BASED:
//         </Text>

//         <View style={styles.radioRow}>
//           {/* TIME BASED */}
//           <TouchableOpacity
//             onPress={() =>
//               setTaskType("time")
//             }
//             style={styles.radioItem}
//           >
//             <View style={styles.radioOuter}>
//               {taskType === "time" && (
//                 <View
//                   style={styles.radioInner}
//                 />
//               )}
//             </View>

//             <Text
//               style={{
//                 color: theme.text,
//               }}
//             >
//               TIME BASED
//             </Text>
//           </TouchableOpacity>

//           {/* NON-TIME BASED */}
//           <TouchableOpacity
//             onPress={() =>
//               setTaskType("non")
//             }
//             style={styles.radioItem}
//           >
//             <View style={styles.radioOuter}>
//               {taskType === "non" && (
//                 <View
//                   style={styles.radioInner}
//                 />
//               )}
//             </View>

//             <Text
//               style={{
//                 color: theme.text,
//               }}
//             >
//               NON-TIME BASED
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* DATE */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           DATE
//         </Text>

//         <View style={styles.dateCard}>
//           <Text
//             style={[
//               styles.dateTitle,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             DUE DATE:
//           </Text>

//           <View style={styles.dateRow}>
//             <View style={styles.chip}>
//               <Text
//                 style={[
//                   styles.chipText,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 {date.toDateString()}
//               </Text>
//             </View>

//             <TouchableOpacity
//               onPress={() =>
//                 setShowDate(true)
//               }
//             >
//               <Icon
//                 name="calendar-outline"
//                 size={22}
//                 color={theme.text}
//               />
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={() =>
//                 setShowDate(true)
//               }
//             >
//               <Text
//                 style={[
//                   styles.chooseDate,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 choose date
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* DATE PICKER */}
//         {showDate && (
//           <DateTimePicker
//             value={date}
//             mode="date"
//             display="calendar"
//             onChange={onChangeDate}
//           />
//         )}

//         {/* ADD TASK FOR */}
//         <Text
//           style={[
//             styles.section,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           ADD TASK FOR
//         </Text>

//         <TouchableOpacity
//           onPress={() =>
//             navigation.navigate(
//               "ForwardTaskTo"
//             )
//           }
//           style={styles.dropdown}
//         >
//           <Text
//             style={[
//               styles.dropdownText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             ADD TASK FOR
//           </Text>

//           <Icon
//             name="chevron-down"
//             size={18}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         {/* BUTTONS */}
//         <View style={styles.btnRow}>
//           <TouchableOpacity
//             style={styles.btn}
//             onPress={() =>
//               navigation.goBack()
//             }
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
//             onPress={AddTask}
//             disabled={loading}
//           >
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.btnText}>
//                 ADD
//               </Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </ScrollView>

//       {/* BOTTOM NAV */}
//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "HomeDashboard"
//             )
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
//             navigation.navigate(
//               "AddMember"
//             )
//           }
//         >
//           <Icon
//             name="person-add"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "TimeBasedHistoryScreen"
//             )
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
//             navigation.navigate(
//               "SettingScreen"
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

// export default AddTaskNonTimeBased;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   content: {
//     padding: 20,
//     paddingBottom: 120,
//   },

//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },

//   headerBox: {
//     paddingHorizontal: 20,
//     paddingVertical: 6,
//     borderRadius: 10,
//   },

//   headerText: {
//     fontWeight: "800",
//   },

//   card: {
//     borderRadius: 12,
//     padding: 14,
//     marginTop: 18,
//   },

//   descriptionCard: {
//     height: 120,
//   },

//   label: {
//     fontWeight: "800",
//   },

//   input: {
//     fontSize: 12,
//     paddingVertical: 8,
//   },

//   descriptionInput: {
//     flex: 1,
//   },

//   section: {
//     marginTop: 20,
//     fontWeight: "800",
//   },

//   radioRow: {
//     flexDirection: "row",
//     marginTop: 10,
//   },

//   radioItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginRight: 25,
//   },

//   radioOuter: {
//     width: 18,
//     height: 18,
//     borderRadius: 9,
//     borderWidth: 2,
//     marginRight: 6,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   radioInner: {
//     width: 8,
//     height: 8,
//     backgroundColor: "#000",
//     borderRadius: 4,
//   },

//   dateCard: {
//     marginTop: 10,
//     backgroundColor: "#EDEDED",
//     borderRadius: 12,
//     padding: 14,
//   },

//   dateTitle: {
//     fontWeight: "800",
//     marginBottom: 10,
//   },

//   dateRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },

//   chip: {
//     backgroundColor: "#BDBDBD",
//     borderRadius: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//   },

//   chipText: {
//     fontWeight: "600",
//   },

//   chooseDate: {
//     textDecorationLine: "underline",
//   },

//   dropdown: {
//     marginTop: 12,
//     backgroundColor: "#EDEDED",
//     borderRadius: 25,
//     padding: 14,
//     flexDirection: "row",
//     justifyContent: "space-between",
//   },

//   dropdownText: {
//     fontSize: 14,
//   },

//   btnRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 30,
//   },

//   btn: {
//     width: "45%",
//     backgroundColor: "#000",
//     padding: 14,
//     borderRadius: 30,
//     alignItems: "center",
//   },

//   btnDisabled: {
//     backgroundColor: "#777",
//   },

//   btnText: {
//     color: "#fff",
//     fontWeight: "800",
//   },

//   bottom: {
//     position: "absolute",
//     bottom: 0,
//     width: "100%",
//     height: 65,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: "center",
//   },
// });

