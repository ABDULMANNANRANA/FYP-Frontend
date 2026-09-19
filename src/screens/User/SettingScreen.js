import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const SettingScreen = ({ navigation }) => {
  const { isDark, toggleTheme, theme } = useTheme();

  const [notify, setNotify] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [snooze, setSnooze] = useState('5 min');

  // LOGOUT
  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'token',
        'userId',
        'userName',
      ]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthStack' }],
      });
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  // Safe color fallbacks for theme compatibility
  const textColor = theme.text || (isDark ? '#F9FAFB' : '#111827');
  const subTextColor = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = theme.card || (isDark ? '#1F2937' : '#FFFFFF');
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const headerBoxBg = theme.headerBox || (isDark ? '#374151' : '#F3F4F6');
  const activeIconBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg || (isDark ? '#111827' : '#F9FAFB') }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg || (isDark ? '#111827' : '#F9FAFB')}
      />

      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={textColor}
          />
        </TouchableOpacity>

        <View style={[styles.headerBox, { backgroundColor: headerBoxBg }]}>
          <Ionicons
            name="settings-outline"
            size={16}
            color={textColor}
          />
          <Text style={[styles.headerText, { color: textColor }]}>
            SETTINGS
          </Text>
        </View>

        {/* Keeps header centered */}
        <View style={styles.headerRightSpace} />
      </View>

      {/* Main Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* ================= PERSONAL INFO SECTION ================= */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>
          Personal Info
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* HISTORY */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.left}>
              <View style={[styles.iconContainer, { backgroundColor: activeIconBg }]}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={20}
                  color={textColor}
                />
              </View>
              <Text style={[styles.text, { color: textColor }]}>
                HISTORY
              </Text>
            </View>
            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color={subTextColor}
            />
          </TouchableOpacity>

          <View style={[styles.innerDivider, { backgroundColor: borderColor }]} />

          {/* SNOOZE TIME */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => setShowDropdown(!showDropdown)}
            activeOpacity={0.7}
          >
            <View style={styles.left}>
              <View style={[styles.iconContainer, { backgroundColor: activeIconBg }]}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={textColor}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.textLabel, { color: subTextColor }]}>
                  Snooze Duration
                </Text>
                <Text style={[styles.text, { color: textColor }]}>
                  Snooze Time : {snooze}
                </Text>
              </View>
            </View>

            <Ionicons
              name={
                showDropdown
                  ? 'chevron-up-outline'
                  : 'chevron-down-outline'
              }
              size={18}
              color={subTextColor}
            />
          </TouchableOpacity>

          {/* SNOOZE OPTIONS DROPDOWN */}
          {showDropdown && (
            <View style={[styles.dropdownContainer, { backgroundColor: isDark ? '#1F2937' : '#F8FAFC' }]}>
              {['5 min', '10 min', '15 min'].map((item, index) => {
                const isSelected = snooze === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.dropItem,
                      index > 0 && { borderTopWidth: 1, borderTopColor: borderColor },
                      isSelected && { backgroundColor: isDark ? 'rgba(58, 195, 92, 0.15)' : 'rgba(58, 195, 92, 0.1)' },
                    ]}
                    onPress={() => {
                      setSnooze(item);
                      setShowDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropText,
                        { color: isSelected ? '#3AC35C' : textColor, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-sharp" size={16} color="#3AC35C" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ================= PREFERENCES SECTION ================= */}
        <Text style={[styles.sectionTitle, { color: subTextColor, marginTop: 24 }]}>
          Preferences
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* NOTIFICATION */}
          <View style={styles.rowItem}>
            <View style={styles.left}>
              <View style={[styles.iconContainer, { backgroundColor: activeIconBg }]}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={textColor}
                />
              </View>
              <Text style={[styles.text, { color: textColor }]}>
                Notification
              </Text>
            </View>

            <Switch
              value={notify}
              onValueChange={setNotify}
              trackColor={{
                false: isDark ? '#4B5563' : '#E5E7EB',
                true: '#3AC35C',
              }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.innerDivider, { backgroundColor: borderColor }]} />

          {/* DARK MODE */}
          <View style={styles.rowItem}>
            <View style={styles.left}>
              <View style={[styles.iconContainer, { backgroundColor: activeIconBg }]}>
                <Ionicons
                  name="moon-outline"
                  size={20}
                  color={textColor}
                />
              </View>
              <Text style={[styles.text, { color: textColor }]}>
                Dark Mode
              </Text>
            </View>

            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{
                false: isDark ? '#4B5563' : '#E5E7EB',
                true: '#3AC35C',
              }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ================= ACCOUNT ACTIONS ================= */}
        <View style={styles.logoutWrapper}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: isDark ? '#DC2626' : '#EF4444' }]}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.logoutText}>
              LOGOUT
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ================= BOTTOM NAVIGATION ================= */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor: theme.bottomNav || (isDark ? '#1F2937' : '#1E293B'),
          },
        ]}
      >
        {/* HOME */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="home-outline"
            size={22}
            color="rgba(255,255,255,0.6)"
          />
        </TouchableOpacity>

        {/* CONTACTS */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('ContactScreen')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people-outline"
            size={22}
            color="rgba(255,255,255,0.6)"
          />
        </TouchableOpacity>

        {/* HISTORY */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={22}
            color="rgba(255,255,255,0.6)"
          />
        </TouchableOpacity>

        {/* SETTINGS (ACTIVE) */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <View style={styles.activeTabIndicator}>
            <Ionicons
              name="settings"
              size={22}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SettingScreen;

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 110, // Extra clearance for floating bottom bar
  },

  /* ================= HEADER ================= */

  header: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justify: 'center',
  },

  headerRightSpace: {
    width: 40,
  },

  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  headerText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.8,
    marginLeft: 8,
  },

  /* ================= SECTION & CARDS ================= */

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },

  /* ================= ROW ITEMS ================= */

  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justify: 'center',
    marginRight: 12,
  },

  textContainer: {
    justifyContent: 'center',
  },

  textLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
  },

  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  innerDivider: {
    height: 1,
    width: '100%',
  },

  /* ================= DROPDOWN ================= */

  dropdownContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },

  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  dropText: {
    fontSize: 14,
  },

  /* ================= LOGOUT ================= */

  logoutWrapper: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    width: '100%',
    height: 52,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
    marginLeft: 8,
  },

  /* ================= BOTTOM NAV ================= */

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justify: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justify: 'center',
    height: '100%',
  },

  activeTabIndicator: {
    alignItems: 'center',
    justify: 'center',
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});


















































// import React, { useState } from 'react';
// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Switch,
// } from 'react-native';

// import Ionicons from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useTheme } from '../../context/ThemeContext';

// const SettingScreen = ({ navigation }) => {
//   const { isDark, toggleTheme, theme } = useTheme();

//   const [notify, setNotify] = useState(true);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [snooze, setSnooze] = useState('5 min');

//   // LOGOUT
//   const handleLogout = async () => {
//     try {
//       await AsyncStorage.multiRemove([
//         'token',
//         'userId',
//         'userName',
//       ]);

//       navigation.reset({
//         index: 0,
//         routes: [{ name: 'AuthStack' }],
//       });
//     } catch (error) {
//       console.log('Logout error:', error);
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
//       {/* ================= HEADER ================= */}
//       <View style={styles.header}>
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.backButton}
//         >
//           <Ionicons
//             name="arrow-back"
//             size={22}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor: theme.headerBox,
//             },
//           ]}
//         >
//           <Ionicons
//             name="settings-outline"
//             size={16}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.headerText,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             SETTINGS
//           </Text>
//         </View>

//         {/* Keeps header centered */}
//         <View style={styles.headerRightSpace} />
//       </View>

//       {/* ================= PERSONAL INFO ================= */}
//       <Text
//         style={[
//           styles.sectionTitle,
//           {
//             color: theme.text,
//           },
//         ]}
//       >
//         Personal Info
//       </Text>

//       {/* ================= HISTORY ================= */}
//       <TouchableOpacity
//         style={styles.row}
//         onPress={() =>
//           navigation.navigate('TimeBasedHistoryScreen')
//         }
//       >
//         <View style={styles.left}>
//           <Ionicons
//             name="swap-horizontal-outline"
//             size={20}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.text,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             HISTORY
//           </Text>
//         </View>
//       </TouchableOpacity>

//       {/* ================= SNOOZE TIME ================= */}
//       <TouchableOpacity
//         style={styles.row}
//         onPress={() =>
//           setShowDropdown(!showDropdown)
//         }
//       >
//         <View style={styles.left}>
//           <Ionicons
//             name="time-outline"
//             size={20}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.text,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             Snooze Time : {snooze}
//           </Text>
//         </View>

//         <Ionicons
//           name={
//             showDropdown
//               ? 'chevron-up-outline'
//               : 'chevron-down-outline'
//           }
//           size={18}
//           color={theme.text}
//         />
//       </TouchableOpacity>

//       {/* ================= SNOOZE OPTIONS ================= */}
//       {showDropdown && (
//         <View
//           style={[
//             styles.dropdown,
//             {
//               backgroundColor: theme.card,
//             },
//           ]}
//         >
//           {['5 min', '10 min', '15 min'].map(item => (
//             <TouchableOpacity
//               key={item}
//               style={styles.dropItem}
//               onPress={() => {
//                 setSnooze(item);
//                 setShowDropdown(false);
//               }}
//             >
//               <Text
//                 style={[
//                   styles.dropText,
//                   {
//                     color: theme.text,
//                   },
//                 ]}
//               >
//                 {item}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       )}

//       {/* ================= NOTIFICATION ================= */}
//       <View style={styles.row}>
//         <View style={styles.left}>
//           <Ionicons
//             name="notifications-outline"
//             size={20}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.text,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             Notification
//           </Text>
//         </View>

//         <Switch
//           value={notify}
//           onValueChange={setNotify}
//           trackColor={{
//             false: '#ccc',
//             true: '#3AC35C',
//           }}
//           thumbColor="#fff"
//         />
//       </View>

//       {/* ================= DARK MODE ================= */}
//       <View style={styles.row}>
//         <View style={styles.left}>
//           <Ionicons
//             name="moon-outline"
//             size={20}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.text,
//               {
//                 color: theme.text,
//               },
//             ]}
//           >
//             Dark Mode
//           </Text>
//         </View>

//         <Switch
//           value={isDark}
//           onValueChange={toggleTheme}
//           trackColor={{
//             false: '#ccc',
//             true: '#3AC35C',
//           }}
//           thumbColor="#fff"
//         />
//       </View>

//       {/* ================= DIVIDER ================= */}
//       <View
//         style={[
//           styles.divider,
//           {
//             backgroundColor: `${theme.text}30`,
//           },
//         ]}
//       />

//       {/* ================= LOGOUT ================= */}
//       <View style={styles.logoutRow}>
//         <Ionicons
//           name="log-out-outline"
//           size={22}
//           color={theme.text}
//         />

//         <TouchableOpacity
//           style={styles.logoutBtn}
//           onPress={handleLogout}
//         >
//           <Text style={styles.logoutText}>
//             LOGOUT
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {/* ================= BOTTOM NAVIGATION ================= */}
//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor: theme.bottomNav,
//           },
//         ]}
//       >
//         {/* HOME */}
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('HomeDashboard')
//           }
//         >
//           <Ionicons
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
//           <Ionicons
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
//           <Ionicons
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
//           <Ionicons
//             name="settings"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default SettingScreen;

// /* =====================================================
//    STYLES
// ===================================================== */

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     paddingHorizontal: 16,
//   },

//   /* ================= HEADER ================= */

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 10,
//     marginBottom: 20,
//   },

//   backButton: {
//     width: 30,
//     alignItems: 'flex-start',
//     justifyContent: 'center',
//   },

//   headerRightSpace: {
//     width: 30,
//   },

//   headerBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 18,
//     paddingVertical: 6,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: '800',
//     marginLeft: 6,
//   },

//   /* ================= SECTION ================= */

//   sectionTitle: {
//     fontSize: 20,
//     fontWeight: '700',
//     marginBottom: 14,
//   },

//   /* ================= ROW ================= */

//   row: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 14,
//     minHeight: 40,
//   },

//   left: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   text: {
//     marginLeft: 12,
//     fontSize: 15,
//   },

//   /* ================= DROPDOWN ================= */

//   dropdown: {
//     borderRadius: 10,
//     marginBottom: 14,
//     marginTop: -5,
//     elevation: 4,
//     overflow: 'hidden',
//   },

//   dropItem: {
//     paddingVertical: 12,
//     paddingHorizontal: 20,
//     borderBottomWidth: 1,
//     borderBottomColor: '#00000015',
//   },

//   dropText: {
//     fontSize: 14,
//   },

//   /* ================= DIVIDER ================= */

//   divider: {
//     height: 1,
//     marginVertical: 18,
//   },

//   /* ================= LOGOUT ================= */

//   logoutRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 20,
//   },

//   logoutBtn: {
//     marginLeft: 14,
//     backgroundColor: '#000',
//     paddingVertical: 12,
//     paddingHorizontal: 30,
//     borderRadius: 25,
//     elevation: 4,
//   },

//   logoutText: {
//     color: '#fff',
//     fontWeight: '800',
//     letterSpacing: 1,
//   },

//   /* ================= BOTTOM NAV ================= */

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
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

