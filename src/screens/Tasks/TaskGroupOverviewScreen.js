import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// ============================================================
// GO TO LOGIN
// Same navigation logic used in HomeDashboard
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
// TASK GROUP OVERVIEW SCREEN
// ============================================================

const TaskGroupOverviewScreen = ({ navigation, route }) => {
  const { theme } = useTheme();

  const task = route?.params?.task || {};

  const [picked, setPicked] = useState(
    task?.isCompleted || false
  );

  const [loading, setLoading] = useState(false);

  // Dynamic Theme Colors with Safe Defaults
  const isDark = theme?.isDark || false;
  const bgColor = theme?.bg || (isDark ? '#0F172A' : '#F8FAFC');
  const cardBg = theme?.card || (isDark ? '#1E293B' : '#FFFFFF');
  const textColor = theme?.text || (isDark ? '#F1F5F9' : '#0F172A');
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const headerBoxBg = theme?.headerBox || (isDark ? '#334155' : '#F1F5F9');
  const bottomNavBg = theme?.bottomNav || (isDark ? '#0F172A' : '#1E293B');

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

      Alert.alert(
        'Error',
        'Unable to read your session.'
      );

      return null;
    }
  };

  // ============================================================
  // PICK TASK / MARK TASK AS DONE
  // ============================================================

  const PickTaskByMe = async () => {
    if (picked) {
      return;
    }

    if (!task?.id) {
      Alert.alert(
        'Error',
        'Task ID is missing.'
      );
      return;
    }

    try {
      setLoading(true);

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

      let data = {};

      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      console.log(
        'Pick Task Response:',
        data
      );

      // ========================================================
      // SESSION EXPIRED
      // ========================================================

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

      // ========================================================
      // CHECK RESPONSE
      // ========================================================

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
          'Failed to pick task'
        );
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      setPicked(true);

      Alert.alert(
        '✅ Task Picked!',
        `"${task.title || 'Task'}" has been picked and marked as done. It will now appear in your history.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );

    } catch (error) {
      console.log(
        'Pick Task Error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Unable to connect to the server.'
      );

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DELETE TASK
  // ============================================================

  const DeleteTask = () => {
    if (!task?.id) {
      Alert.alert(
        'Error',
        'Task ID is missing.'
      );
      return;
    }

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

              const token = await getToken();

              if (!token) {
                return;
              }

              const response = await fetch(
                `${BASE_URL}/Task/task/${task.id}`,
                {
                  method: 'DELETE',

                  headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              let data = {};

              try {
                data = await response.json();
              } catch (error) {
                data = {};
              }

              console.log(
                'Delete Task Response:',
                data
              );

              // ==================================================
              // SESSION EXPIRED
              // ==================================================

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

              // ==================================================
              // CHECK RESPONSE
              // ==================================================

              if (
                !response.ok ||
                !data?.success
              ) {
                throw new Error(
                  data?.message ||
                    'Failed to delete task'
                );
              }

              // ==================================================
              // SUCCESS
              // ==================================================

              Alert.alert(
                'Success',
                data?.message ||
                  'Task deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ]
              );

            } catch (error) {
              console.log(
                'Delete Task Error:',
                error
              );

              Alert.alert(
                'Error',
                error?.message ||
                  'Unable to connect to the server.'
              );

            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      {/* ======================================================
          HEADER
      ====================================================== */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconTouchable}
          onPress={() => navigation.goBack()}
          disabled={loading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>

        <View style={[styles.headerBox, { backgroundColor: headerBoxBg }]}>
          <Text
            style={[styles.headerText, { color: textColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {task.groupName || 'Group Task'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconTouchable}
          onPress={DeleteTask}
          disabled={loading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Icon name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* ======================================================
          MAIN CONTENT AREA (SCROLLABLE FOR MOBILE FIT)
      ====================================================== */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ======================================================
            TASK CARD
        ====================================================== */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          
          {/* CARD HEADER / TITLE SECTION */}
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionSubtitle, { color: subTextColor }]}>
              TASK DETAILS
            </Text>
            <Text style={[styles.taskTitle, { color: textColor }]}>
              {task.title || 'NO TITLE'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* DESCRIPTION */}
          {task.description ? (
            <View style={styles.descContainer}>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>
                Description
              </Text>
              <Text style={[styles.descText, { color: textColor }]}>
                {task.description}
              </Text>
            </View>
          ) : null}

          {/* ====================================================
              TASK INFORMATION GRID
          ==================================================== */}
          <View style={styles.infoGrid}>
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Icon name="person-outline" size={16} color={subTextColor} />
                <Text style={[styles.infoLabel, { color: subTextColor }]}>From</Text>
              </View>
              <Text style={[styles.infoValue, { color: textColor }]} numberOfLines={1}>
                {task.from || task.createdByName || 'Group Member'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Icon name="arrow-forward-circle-outline" size={16} color={subTextColor} />
                <Text style={[styles.infoLabel, { color: subTextColor }]}>To</Text>
              </View>
              <Text style={[styles.infoValue, { color: textColor }]}>
                Me
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Icon name="calendar-outline" size={16} color={subTextColor} />
                <Text style={[styles.infoLabel, { color: subTextColor }]}>Date</Text>
              </View>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {task.dueDate || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Icon name="time-outline" size={16} color={subTextColor} />
                <Text style={[styles.infoLabel, { color: subTextColor }]}>Time</Text>
              </View>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {task.dueTime || 'N/A'}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={styles.infoLabelGroup}>
                <Icon name="information-circle-outline" size={16} color={subTextColor} />
                <Text style={[styles.infoLabel, { color: subTextColor }]}>Status</Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: picked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)' }
              ]}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: picked ? '#22C55E' : '#F59E0B' }
                ]} />
                <Text style={[
                  styles.statusText, 
                  { color: picked ? '#15803D' : '#B45309' }
                ]}>
                  {picked ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>

          </View>
        </View>

        {/* ======================================================
            BUTTONS
        ====================================================== */}
        <View style={styles.btnWrap}>
          
          {/* PICK TASK BUTTON */}
          <TouchableOpacity
            style={[
              styles.mainBtn,
              picked && styles.pickedBtn,
              loading && styles.disabledBtn,
            ]}
            onPress={PickTaskByMe}
            disabled={picked || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.mainBtnText}>
                  {picked ? 'ALREADY PICKED' : 'PICK TASK'}
                </Text>
                {picked && (
                  <View style={styles.checkBox}>
                    <Icon name="checkmark" size={14} color="#15803D" />
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* IGNORE BUTTON */}
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { borderColor: isDark ? '#475569' : '#CBD5E1' },
              loading && styles.disabledBtn,
            ]}
            onPress={() => navigation.goBack()}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryBtnText, { color: textColor }]}>
              IGNORE
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* ======================================================
          BOTTOM NAVIGATION BAR
      ====================================================== */}
      <View style={[styles.bottomNavContainer, { backgroundColor: bottomNavBg }]}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.6}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('ContactScreen')}
          activeOpacity={0.6}
        >
          <Icon name="people-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.6}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.6}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

export default TaskGroupOverviewScreen;

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
  },

  iconTouchable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBox: {
    maxWidth: width * 0.6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // SCROLL CONTENT AREA
  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },

  // CARD
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  cardHeader: {
    marginBottom: 12,
  },

  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  taskTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },

  divider: {
    height: 1,
    width: '100%',
    marginVertical: 14,
  },

  descContainer: {
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },

  descText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // INFO GRID
  infoGrid: {
    marginTop: 8,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },

  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // BUTTONS
  btnWrap: {
    marginTop: 28,
    alignItems: 'center',
    gap: 12,
  },

  mainBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  pickedBtn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },

  disabledBtn: {
    opacity: 0.65,
  },

  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  mainBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  checkBox: {
    width: 22,
    height: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // BOTTOM NAVIGATION
  bottomNavContainer: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 8,
  },

  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
});






































// import React, { useState } from 'react';

// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
// } from 'react-native';

// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';


// // ============================================================
// // GO TO LOGIN
// // Same navigation logic used in HomeDashboard
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
// // TASK GROUP OVERVIEW SCREEN
// // ============================================================

// const TaskGroupOverviewScreen = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const task = route?.params?.task || {};

//   const [picked, setPicked] = useState(
//     task?.isCompleted || false
//   );

//   const [loading, setLoading] = useState(false);


//   // ============================================================
//   // GET JWT TOKEN
//   // ============================================================

//   const getToken = async () => {
//     try {
//       // Same key used by HomeDashboard / LoginScreen
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
//         'Unable to read your session.'
//       );

//       return null;
//     }
//   };


//   // ============================================================
//   // PICK TASK / MARK TASK AS DONE
//   // ============================================================

//   const PickTaskByMe = async () => {
//     if (picked) {
//       return;
//     }

//     if (!task?.id) {
//       Alert.alert(
//         'Error',
//         'Task ID is missing.'
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       // IMPORTANT:
//       // HomeDashboard uses:
//       // POST /Task/{id}/done
//       //
//       // NOT:
//       // /tasks/{id}/done

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

//       let data = {};

//       try {
//         data = await response.json();
//       } catch (error) {
//         data = {};
//       }

//       console.log(
//         'Pick Task Response:',
//         data
//       );


//       // ========================================================
//       // SESSION EXPIRED
//       // ========================================================

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


//       // ========================================================
//       // CHECK RESPONSE
//       // ========================================================

//       if (!response.ok || !data?.success) {
//         throw new Error(
//           data?.message ||
//           'Failed to pick task'
//         );
//       }


//       // ========================================================
//       // SUCCESS
//       // ========================================================

//       setPicked(true);

//       Alert.alert(
//         '✅ Task Picked!',
//         `"${task.title || 'Task'}" has been picked and marked as done. It will now appear in your history.`,
//         [
//           {
//             text: 'OK',
//             onPress: () => {
//               navigation.goBack();
//             },
//           },
//         ]
//       );

//     } catch (error) {
//       console.log(
//         'Pick Task Error:',
//         error
//       );

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Unable to connect to the server.'
//       );

//     } finally {
//       setLoading(false);
//     }
//   };


//   // ============================================================
//   // DELETE TASK
//   // ============================================================

//   const DeleteTask = () => {
//     if (!task?.id) {
//       Alert.alert(
//         'Error',
//         'Task ID is missing.'
//       );
//       return;
//     }

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

//               const token = await getToken();

//               if (!token) {
//                 return;
//               }

//               // IMPORTANT:
//               // HomeDashboard uses:
//               // DELETE /Task/task/{id}
//               //
//               // NOT:
//               // /tasks/{id}

//               const response = await fetch(
//                 `${BASE_URL}/Task/task/${task.id}`,
//                 {
//                   method: 'DELETE',

//                   headers: {
//                     Accept: 'application/json',
//                     Authorization: `Bearer ${token}`,
//                   },
//                 }
//               );

//               let data = {};

//               try {
//                 data = await response.json();
//               } catch (error) {
//                 data = {};
//               }

//               console.log(
//                 'Delete Task Response:',
//                 data
//               );


//               // ==================================================
//               // SESSION EXPIRED
//               // ==================================================

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


//               // ==================================================
//               // CHECK RESPONSE
//               // ==================================================

//               if (
//                 !response.ok ||
//                 !data?.success
//               ) {
//                 throw new Error(
//                   data?.message ||
//                     'Failed to delete task'
//                 );
//               }


//               // ==================================================
//               // SUCCESS
//               // ==================================================

//               Alert.alert(
//                 'Success',
//                 data?.message ||
//                   'Task deleted successfully.',
//                 [
//                   {
//                     text: 'OK',
//                     onPress: () => {
//                       navigation.goBack();
//                     },
//                   },
//                 ]
//               );

//             } catch (error) {
//               console.log(
//                 'Delete Task Error:',
//                 error
//               );

//               Alert.alert(
//                 'Error',
//                 error?.message ||
//                   'Unable to connect to the server.'
//               );

//             } finally {
//               setLoading(false);
//             }
//           },
//         },
//       ]
//     );
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

//       {/* ======================================================
//           HEADER
//       ====================================================== */}

//       <View style={styles.header}>

//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           disabled={loading}
//         >
//           <Icon
//             name="arrow-back"
//             size={22}
//             color={theme.text}
//           />
//         </TouchableOpacity>


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
//             {task.groupName ||
//               'Group Task'}
//           </Text>
//         </View>


//         <TouchableOpacity
//           onPress={DeleteTask}
//           disabled={loading}
//         >
//           <Icon
//             name="trash-outline"
//             size={22}
//             color="#E52323"
//           />
//         </TouchableOpacity>

//       </View>


//       {/* ======================================================
//           TASK CARD
//       ====================================================== */}

//       <View
//         style={[
//           styles.card,
//           {
//             backgroundColor: theme.card,
//           },
//         ]}
//       >

//         <Text
//           style={[
//             styles.descTitle,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           DESCRIPTION:
//         </Text>


//         {/* TITLE */}

//         <Text
//           style={[
//             styles.desc,
//             styles.taskTitle,
//             {
//               color: theme.text,
//             },
//           ]}
//         >
//           {task.title || 'NO TITLE'}
//         </Text>


//         {/* DESCRIPTION */}

//         {task.description ? (
//           <Text
//             style={[
//               styles.desc,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             {task.description}
//           </Text>
//         ) : null}


//         {/* ====================================================
//             TASK INFORMATION
//         ==================================================== */}

//         <View style={styles.infoBlock}>

//           <Text
//             style={[
//               styles.info,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             From : {task.from ||
//               task.createdByName ||
//               'Group Member'}
//           </Text>


//           <Text
//             style={[
//               styles.info,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             To : Me
//           </Text>


//           <Text
//             style={[
//               styles.info,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             DATE : {task.dueDate ||
//               'N/A'}
//           </Text>


//           <Text
//             style={[
//               styles.info,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             TIME : {task.dueTime ||
//               'N/A'}
//           </Text>


//           <Text
//             style={[
//               styles.info,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             STATUS :{' '}
//             {picked
//               ? '✅ Completed'
//               : '🕐 Pending'}
//           </Text>

//         </View>

//       </View>


//       {/* ======================================================
//           BUTTONS
//       ====================================================== */}

//       <View style={styles.btnWrap}>

//         {/* ====================================================
//             PICK TASK
//         ==================================================== */}

//         <TouchableOpacity
//           style={[
//             styles.mainBtn,

//             picked &&
//               styles.pickedBtn,

//             loading &&
//               styles.disabledBtn,
//           ]}
//           onPress={PickTaskByMe}
//           disabled={
//             picked || loading
//           }
//         >

//           <Text style={styles.btnText}>
//             {loading
//               ? 'PROCESSING...'
//               : picked
//               ? 'ALREADY PICKED'
//               : 'PICK TASK'}
//           </Text>


//           <View style={styles.checkBox}>

//             {picked && (
//               <Icon
//                 name="checkmark"
//                 size={14}
//                 color="#4CAF50"
//               />
//             )}

//           </View>

//         </TouchableOpacity>


//         {/* ====================================================
//             IGNORE
//         ==================================================== */}

//         <TouchableOpacity
//           style={[
//             styles.secondaryBtn,
//             loading &&
//               styles.disabledBtn,
//           ]}
//           onPress={() =>
//             navigation.goBack()
//           }
//           disabled={loading}
//         >
//           <Text style={styles.btnText}>
//             IGNORE
//           </Text>
//         </TouchableOpacity>

//       </View>


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


// export default TaskGroupOverviewScreen;


// // ============================================================
// // STYLES
// // ============================================================

// const styles = StyleSheet.create({

//   container: {
//     flex: 1,
//     backgroundColor: '#B7C9DB',
//     paddingHorizontal: 16,
//   },


//   // ==========================================================
//   // HEADER
//   // ==========================================================

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 10,
//   },

//   headerBox: {
//     backgroundColor: '#fff',
//     paddingHorizontal: 18,
//     paddingVertical: 6,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: '800',
//     letterSpacing: 1,
//   },


//   // ==========================================================
//   // CARD
//   // ==========================================================

//   card: {
//     marginTop: 30,
//     borderRadius: 18,
//     paddingVertical: 30,
//     paddingHorizontal: 20,
//     alignItems: 'center',
//     elevation: 4,
//   },

//   descTitle: {
//     fontWeight: '800',
//     letterSpacing: 2,
//     textDecorationLine: 'underline',
//     marginBottom: 14,
//   },

//   desc: {
//     letterSpacing: 1,
//     marginBottom: 8,
//     textAlign: 'center',
//   },

//   taskTitle: {
//     fontWeight: '800',
//     fontSize: 17,
//   },


//   // ==========================================================
//   // INFORMATION
//   // ==========================================================

//   infoBlock: {
//     marginTop: 20,
//     alignSelf: 'flex-start',
//   },

//   info: {
//     fontWeight: '700',
//     marginBottom: 8,
//     letterSpacing: 1,
//   },


//   // ==========================================================
//   // BUTTONS
//   // ==========================================================

//   btnWrap: {
//     marginTop: 40,
//     alignItems: 'center',
//     gap: 16,
//   },

//   mainBtn: {
//     width: '60%',
//     backgroundColor: '#000',
//     paddingVertical: 14,
//     borderRadius: 30,
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 5,
//   },

//   pickedBtn: {
//     backgroundColor: '#4CAF50',
//   },

//   disabledBtn: {
//     opacity: 0.6,
//   },

//   checkBox: {
//     position: 'absolute',
//     right: 16,
//     width: 20,
//     height: 20,
//     backgroundColor: '#fff',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 4,
//   },

//   secondaryBtn: {
//     width: '60%',
//     backgroundColor: '#555',
//     paddingVertical: 14,
//     borderRadius: 30,
//     alignItems: 'center',
//     elevation: 5,
//   },

//   btnText: {
//     color: '#fff',
//     fontWeight: '800',
//     letterSpacing: 1,
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
