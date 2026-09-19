import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
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

const ForwardTaskTo = ({ navigation, route }) => {
  const { theme } = useTheme();

  const taskId = route?.params?.taskId;

  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // =========================================================
  // FETCH CONTACTS WHEN SCREEN LOADS
  // =========================================================
  useEffect(() => {
    fetchContacts();
  }, []);

  // =========================================================
  // GET CONTACTS FROM GROUPS
  // =========================================================
  const fetchContacts = async () => {
    try {
      setFetching(true);

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

      const response = await fetch(`${BASE_URL}/User/groups`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      let data = null;

      try {
        data = await response.json();
      } catch (jsonError) {
        console.log('Groups response is not valid JSON');
      }

      console.log('Fetch Groups Status:', response.status);
      console.log('Fetch Groups Response:', data);

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

      if (!response.ok) {
        Alert.alert(
          'Error',
          data?.message ||
            data?.error ||
            `Failed to load contacts. Status: ${response.status}`,
        );
        return;
      }

      if (data?.success) {
        const members = [];
        const seen = new Set();

        (data.data || []).forEach(group => {
          (group.members || []).forEach((m, idx) => {
            const memberId = `member_${m.id || idx}_${group.id}`;

            const displayName =
              m.displayName ||
              m.name ||
              'Unknown';

            const phone = m.phone || '';

            if (displayName === 'Unknown' && !phone) {
              return;
            }

            const dedupeKey = `${displayName}_${phone}`;

            if (seen.has(dedupeKey)) {
              return;
            }

            seen.add(dedupeKey);

            const isRegistered = !!m.isRegistered;

            members.push({
              id: memberId,
              registeredUserId: isRegistered ? m.id : null,
              name: displayName,
              phone,
              isRegistered,
              selected: false,
            });
          });
        });

        setContacts(members);
      } else {
        Alert.alert(
          'Error',
          data?.message || 'Failed to load contacts.',
        );
      }
    } catch (error) {
      console.log('Fetch Contacts Error:', error);

      if (error?.message?.includes('Network request failed')) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your API URL and network connection.',
        );
      } else {
        Alert.alert(
          'Error',
          error?.message || 'Failed to load contacts.',
        );
      }
    } finally {
      setFetching(false);
    }
  };

  // =========================================================
  // FILTER CONTACTS
  // =========================================================
  const filtered = useMemo(() => {
    if (!search.trim()) {
      return contacts;
    }

    const searchText = search.toLowerCase().trim();

    return contacts.filter(contact => {
      const name = contact.name?.toLowerCase() || '';
      const phone = contact.phone || '';

      return (
        name.includes(searchText) ||
        phone.includes(searchText)
      );
    });
  }, [search, contacts]);

  // =========================================================
  // TOGGLE CONTACT
  // =========================================================
  const toggle = id => {
    setContacts(prev =>
      prev.map(contact =>
        contact.id === id
          ? {
              ...contact,
              selected: !contact.selected,
            }
          : contact,
      ),
    );
  };

  // =========================================================
  // SEND / FORWARD TASK
  // =========================================================
  const SendTaskTo = async () => {
    const selected = contacts.filter(
      contact => contact.selected,
    );

    if (selected.length === 0) {
      Alert.alert(
        'Error',
        'Select at least one contact.',
      );
      return;
    }

    if (!taskId) {
      Alert.alert(
        'Error',
        'No task selected to forward.',
      );
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
          ],
        );
        return;
      }

      const registeredMembers = selected.filter(
        member => member.registeredUserId,
      );

      const externalMembers = selected.filter(
        member => !member.registeredUserId,
      );

      const registeredIds = registeredMembers.map(
        member => member.registeredUserId,
      );

      const externalNames = externalMembers.map(
        member => member.name,
      );

      let successMsg = '';

      if (registeredIds.length > 0) {
        const url = `${BASE_URL}/Managment/${taskId}/forward`;

        console.log(
          'Forward Task URL:',
          url,
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            ToUserIds: registeredIds,
          }),
        });

        let data = null;

        try {
          data = await response.json();
        } catch (jsonError) {
          console.log(
            'Forward response is not valid JSON',
          );
        }

        console.log(
          'Forward Task Status:',
          response.status,
        );

        console.log(
          'Forward Task Response:',
          data,
        );

        if (response.status === 401) {
          await AsyncStorage.removeItem(
            'token',
          );

          Alert.alert(
            'Session Expired',
            'Please login again.',
            [
              {
                text: 'OK',
                onPress: () =>
                  goToLogin(navigation),
              },
            ],
          );
          return;
        }

        if (!response.ok) {
          Alert.alert(
            'Error',
            data?.message ||
              data?.error ||
              `Failed to forward task. Status: ${response.status}`,
          );
          return;
        }

        if (data?.success) {
          successMsg +=
            `✅ Task forwarded to ${registeredIds.length} registered user(s).`;
        } else {
          Alert.alert(
            'Error',
            data?.message ||
              'Failed to forward to registered users.',
          );
          return;
        }
      }

      if (externalNames.length > 0) {
        successMsg += `${
          successMsg ? '\n\n' : ''
        }📋 External contacts selected:\n${externalNames.join(
          ', ',
        )}\n\nThey are not in the app — please share this task with them manually (e.g. via WhatsApp or SMS).`;
      }

      Alert.alert(
        'Done!',
        successMsg || 'Task processed successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.log(
        'Forward Task Error:',
        error,
      );

      if (
        error?.message?.includes(
          'Network request failed',
        )
      ) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your API URL and network connection.',
        );
      } else {
        Alert.alert(
          'Error',
          error?.message ||
            'Server not reachable.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // COUNTS
  // =========================================================
  const selectedCount = contacts.filter(
    contact => contact.selected,
  ).length;

  const registeredCount = contacts.filter(
    contact => contact.isRegistered,
  ).length;

  const externalCount = contacts.filter(
    contact => !contact.isRegistered,
  ).length;

  // =========================================================
  // UI
  // =========================================================
  const isDarkMode = theme?.mode === 'dark';

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.bg || '#F4F7FB' },
      ]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg || '#F4F7FB'}
      />

      {/* =====================================================
          HEADER
      ===================================================== */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Icon
              name="chevron-back"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Forward Task
          </Text>

          <View style={styles.headerRightPlaceholder}>
            <Icon
              name="paper-plane-outline"
              size={20}
              color="#FFFFFF"
            />
          </View>
        </View>
      </View>

      {/* =====================================================
          SEARCH
      ===================================================== */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDarkMode ? '#2A2E3B' : '#FFFFFF',
              borderColor: isDarkMode ? '#3A3F50' : '#E1E6ED',
            },
          ]}
        >
          <Icon
            name="search-outline"
            size={18}
            color={isDarkMode ? '#8E9AAF' : '#64748B'}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search by name or phone..."
            placeholderTextColor={isDarkMode ? '#8E9AAF' : '#94A3B8'}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.searchInput,
              { color: theme.text || '#0F172A' },
            ]}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="close-circle"
                size={18}
                color={isDarkMode ? '#8E9AAF' : '#94A3B8'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* =====================================================
          STATS / SUMMARY CHIPS
      ===================================================== */}
      {!fetching && contacts.length > 0 && (
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statChip,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#E2F5EA',
                borderColor: '#10B981',
              },
            ]}
          >
            <Icon
              name="checkmark-circle"
              size={14}
              color="#10B981"
            />
            <Text style={[styles.statText, { color: '#047857' }]}>
              {registeredCount} Registered
            </Text>
          </View>

          <View
            style={[
              styles.statChip,
              {
                backgroundColor: isDarkMode ? '#2A2418' : '#FFF7ED',
                borderColor: '#F97316',
              },
            ]}
          >
            <Icon
              name="person-outline"
              size={14}
              color="#F97316"
            />
            <Text style={[styles.statText, { color: '#C2410C' }]}>
              {externalCount} External
            </Text>
          </View>

          {selectedCount > 0 && (
            <View
              style={[
                styles.statChip,
                styles.selectedStatChip,
              ]}
            >
              <Icon
                name="checkbox"
                size={14}
                color="#2563EB"
              />
              <Text style={styles.selectedStatText}>
                {selectedCount} Selected
              </Text>
            </View>
          )}
        </View>
      )}

      {/* =====================================================
          CONTACT LIST
      ===================================================== */}
      {fetching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text
            style={[
              styles.loadingText,
              { color: theme.text || '#64748B' },
            ]}
          >
            Loading contacts...
          </Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Icon
              name="people-outline"
              size={48}
              color="#2563EB"
            />
          </View>
          <Text
            style={[
              styles.emptyTitle,
              { color: theme.text || '#0F172A' },
            ]}
          >
            No Contacts Available
          </Text>
          <Text
            style={[
              styles.emptyText,
              { color: isDarkMode ? '#8E9AAF' : '#64748B' },
            ]}
          >
            Add members to your groups first to forward tasks to them.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map(item => {
            const isExternal = !item.isRegistered;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.card || (isDarkMode ? '#1E293B' : '#FFFFFF'),
                    borderColor: item.selected
                      ? '#2563EB'
                      : isDarkMode
                      ? '#334155'
                      : '#E2E8F0',
                  },
                  item.selected && styles.cardSelected,
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                {/* AVATAR */}
                <View
                  style={[
                    styles.avatar,
                    item.selected
                      ? styles.avatarSelected
                      : isExternal
                      ? styles.avatarExternal
                      : styles.avatarDefault,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {item.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* CONTACT INFO */}
                <View style={styles.contactDetails}>
                  <Text
                    style={[
                      styles.name,
                      { color: theme.text || '#0F172A' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>

                  {item.phone ? (
                    <Text
                      style={[
                        styles.phone,
                        { color: isDarkMode ? '#94A3B8' : '#64748B' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.phone}
                    </Text>
                  ) : null}

                  {/* BADGES */}
                  {isExternal ? (
                    <View style={styles.badgeRow}>
                      <View style={styles.externalBadgeTag}>
                        <Icon
                          name="alert-circle-outline"
                          size={11}
                          color="#D97706"
                        />
                        <Text style={styles.externalBadgeText}>
                          External — share manually
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.badgeRow}>
                      <View style={styles.registeredBadgeTag}>
                        <Icon
                          name="checkmark-seal"
                          size={11}
                          color="#059669"
                        />
                        <Text style={styles.registeredBadgeText}>
                          Registered App User
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* CHECKBOX */}
                <View
                  style={[
                    styles.checkbox,
                    item.selected && styles.checkboxSelected,
                  ]}
                >
                  {item.selected && (
                    <Icon
                      name="checkmark-bold"
                      size={14}
                      color="#FFFFFF"
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* NO SEARCH RESULT */}
          {filtered.length === 0 && search.trim() !== '' && (
            <View style={styles.noResultBox}>
              <Icon
                name="search"
                size={32}
                color={isDarkMode ? '#475569' : '#CBD5E1'}
              />
              <Text
                style={[
                  styles.noResult,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                No contacts match "{search}"
              </Text>
            </View>
          )}

          {/* SEND BUTTON */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              selectedCount === 0 && styles.sendBtnDisabled,
            ]}
            onPress={SendTaskTo}
            disabled={loading || selectedCount === 0}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.sendBtnInner}>
                <Text style={styles.sendText}>
                  SEND TASK
                  {selectedCount > 0 ? ` (${selectedCount})` : ''}
                </Text>
                <Icon
                  name="paper-plane"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav || (isDarkMode ? '#0F172A' : '#1E293B'),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Icon name="grid-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('ContactScreen')}
          activeOpacity={0.7}
        >
          <Icon name="people" size={22} color="#3B82F6" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ForwardTaskTo;

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header Styling
  headerWrapper: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
    paddingBottom: 8,
  },
  headerBar: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  headerRightPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search Styling
  searchWrapper: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },

  // Summary Chips
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedStatChip: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  selectedStatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  // Content Container
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 130, // Space for send button & bottom nav bar
  },

  // Contact Cards
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardSelected: {
    backgroundColor: '#F0F6FF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarDefault: {
    backgroundColor: '#3B82F6',
  },
  avatarSelected: {
    backgroundColor: '#2563EB',
  },
  avatarExternal: {
    backgroundColor: '#F59E0B',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  contactDetails: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  phone: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },

  // Badges inside cards
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  externalBadgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  externalBadgeText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
  },
  registeredBadgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  registeredBadgeText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },

  // Checkbox Styling
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
  },
  checkboxSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  // Empty & Loading States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  noResultBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  noResult: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },

  // Send Button Styling
  sendBtn: {
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },

  // Floating Bottom Navigation
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#3B82F6',
    fontWeight: '700',
  },
});
















































// import React, { useState, useEffect, useMemo } from 'react';
// import {
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   TextInput,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
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

// const ForwardTaskTo = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const taskId = route?.params?.taskId;

//   const [search, setSearch] = useState('');
//   const [contacts, setContacts] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [fetching, setFetching] = useState(false);

//   // =========================================================
//   // FETCH CONTACTS WHEN SCREEN LOADS
//   // =========================================================
//   useEffect(() => {
//     fetchContacts();
//   }, []);

//   // =========================================================
//   // GET CONTACTS FROM GROUPS
//   // =========================================================
//   const fetchContacts = async () => {
//     try {
//       setFetching(true);

//       // Get JWT Token
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
//       // API REQUEST
//       // =====================================================
//       // NOTE: correct route is "api/User/groups", not
//       // "api/groups" (which does not exist on the backend).
//       // This endpoint is also the only one that includes each
//       // group's members list, which this screen needs.
//       const response = await fetch(`${BASE_URL}/User/groups`, {
//         method: 'GET',
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//         },
//       });

//       // =====================================================
//       // READ RESPONSE SAFELY
//       // =====================================================
//       let data = null;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         console.log('Groups response is not valid JSON');
//       }

//       console.log('Fetch Groups Status:', response.status);
//       console.log('Fetch Groups Response:', data);

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
//       // API ERROR
//       // =====================================================
//       if (!response.ok) {
//         Alert.alert(
//           'Error',
//           data?.message ||
//             data?.error ||
//             `Failed to load contacts. Status: ${response.status}`,
//         );

//         return;
//       }

//       // =====================================================
//       // SUCCESS
//       // =====================================================
//       if (data?.success) {
//         const members = [];
//         const seen = new Set();

//         (data.data || []).forEach(group => {
//           (group.members || []).forEach((m, idx) => {
//             const memberId = `member_${m.id || idx}_${group.id}`;

//             const displayName =
//               m.displayName ||
//               m.name ||
//               'Unknown';

//             const phone = m.phone || '';

//             // Skip completely unknown members
//             if (displayName === 'Unknown' && !phone) {
//               return;
//             }

//             // Prevent duplicates
//             const dedupeKey = `${displayName}_${phone}`;

//             if (seen.has(dedupeKey)) {
//               return;
//             }

//             seen.add(dedupeKey);

//             const isRegistered = !!m.isRegistered;

//             members.push({
//               id: memberId,
//               registeredUserId: isRegistered ? m.id : null,
//               name: displayName,
//               phone,
//               isRegistered,
//               selected: false,
//             });
//           });
//         });

//         setContacts(members);
//       } else {
//         Alert.alert(
//           'Error',
//           data?.message || 'Failed to load contacts.',
//         );
//       }
//     } catch (error) {
//       console.log('Fetch Contacts Error:', error);

//       if (error?.message?.includes('Network request failed')) {
//         Alert.alert(
//           'Connection Error',
//           'Unable to connect to the server. Please check your API URL and network connection.',
//         );
//       } else {
//         Alert.alert(
//           'Error',
//           error?.message || 'Failed to load contacts.',
//         );
//       }
//     } finally {
//       setFetching(false);
//     }
//   };

//   // =========================================================
//   // FILTER CONTACTS
//   // =========================================================
//   const filtered = useMemo(() => {
//     if (!search.trim()) {
//       return contacts;
//     }

//     const searchText = search.toLowerCase().trim();

//     return contacts.filter(contact => {
//       const name = contact.name?.toLowerCase() || '';
//       const phone = contact.phone || '';

//       return (
//         name.includes(searchText) ||
//         phone.includes(searchText)
//       );
//     });
//   }, [search, contacts]);

//   // =========================================================
//   // TOGGLE CONTACT
//   // =========================================================
//   const toggle = id => {
//     setContacts(prev =>
//       prev.map(contact =>
//         contact.id === id
//           ? {
//               ...contact,
//               selected: !contact.selected,
//             }
//           : contact,
//       ),
//     );
//   };

//   // =========================================================
//   // SEND / FORWARD TASK
//   // =========================================================
//   const SendTaskTo = async () => {
//     const selected = contacts.filter(
//       contact => contact.selected,
//     );

//     // Validate selected contacts
//     if (selected.length === 0) {
//       Alert.alert(
//         'Error',
//         'Select at least one contact.',
//       );
//       return;
//     }

//     // Validate task
//     if (!taskId) {
//       Alert.alert(
//         'Error',
//         'No task selected to forward.',
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       // =====================================================
//       // GET JWT TOKEN
//       // =====================================================
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
//       // SEPARATE REGISTERED / EXTERNAL USERS
//       // =====================================================
//       const registeredMembers = selected.filter(
//         member => member.registeredUserId,
//       );

//       const externalMembers = selected.filter(
//         member => !member.registeredUserId,
//       );

//       const registeredIds = registeredMembers.map(
//         member => member.registeredUserId,
//       );

//       const externalNames = externalMembers.map(
//         member => member.name,
//       );

//       let successMsg = '';

//       // =====================================================
//       // FORWARD TO REGISTERED USERS
//       // =====================================================
//       if (registeredIds.length > 0) {
//         // NOTE: correct route is "api/Managment/{taskId}/forward"
//         // (ManagmentController.ForwardTask), not
//         // "api/tasks/{taskId}/forward" which does not exist.
//         const url = `${BASE_URL}/Managment/${taskId}/forward`;

//         console.log(
//           'Forward Task URL:',
//           url,
//         );

//         const response = await fetch(url, {
//           method: 'POST',
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//             Accept: 'application/json',
//           },
//           body: JSON.stringify({
//             ToUserIds: registeredIds,
//           }),
//         });

//         // ===================================================
//         // READ RESPONSE SAFELY
//         // ===================================================
//         let data = null;

//         try {
//           data = await response.json();
//         } catch (jsonError) {
//           console.log(
//             'Forward response is not valid JSON',
//           );
//         }

//         console.log(
//           'Forward Task Status:',
//           response.status,
//         );

//         console.log(
//           'Forward Task Response:',
//           data,
//         );

//         // ===================================================
//         // SESSION EXPIRED
//         // ===================================================
//         if (response.status === 401) {
//           await AsyncStorage.removeItem(
//             'token',
//           );

//           Alert.alert(
//             'Session Expired',
//             'Please login again.',
//             [
//               {
//                 text: 'OK',
//                 onPress: () =>
//                   goToLogin(navigation),
//               },
//             ],
//           );

//           return;
//         }

//         // ===================================================
//         // API ERROR
//         // ===================================================
//         if (!response.ok) {
//           Alert.alert(
//             'Error',
//             data?.message ||
//               data?.error ||
//               `Failed to forward task. Status: ${response.status}`,
//           );

//           return;
//         }

//         // ===================================================
//         // SUCCESS
//         // ===================================================
//         if (data?.success) {
//           successMsg +=
//             `✅ Task forwarded to ${registeredIds.length} registered user(s).`;
//         } else {
//           Alert.alert(
//             'Error',
//             data?.message ||
//               'Failed to forward to registered users.',
//           );

//           return;
//         }
//       }

//       // =====================================================
//       // EXTERNAL CONTACTS
//       // =====================================================
//       if (externalNames.length > 0) {
//         successMsg += `${
//           successMsg ? '\n\n' : ''
//         }📋 External contacts selected:\n${externalNames.join(
//           ', ',
//         )}\n\nThey are not in the app — please share this task with them manually (e.g. via WhatsApp or SMS).`;
//       }

//       // =====================================================
//       // FINAL SUCCESS MESSAGE
//       // =====================================================
//       Alert.alert(
//         'Done!',
//         successMsg || 'Task processed successfully.',
//         [
//           {
//             text: 'OK',
//             onPress: () => navigation.goBack(),
//           },
//         ],
//       );
//     } catch (error) {
//       console.log(
//         'Forward Task Error:',
//         error,
//       );

//       if (
//         error?.message?.includes(
//           'Network request failed',
//         )
//       ) {
//         Alert.alert(
//           'Connection Error',
//           'Unable to connect to the server. Please check your API URL and network connection.',
//         );
//       } else {
//         Alert.alert(
//           'Error',
//           error?.message ||
//             'Server not reachable.',
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // =========================================================
//   // COUNTS
//   // =========================================================
//   const selectedCount = contacts.filter(
//     contact => contact.selected,
//   ).length;

//   const registeredCount = contacts.filter(
//     contact => contact.isRegistered,
//   ).length;

//   const externalCount = contacts.filter(
//     contact => !contact.isRegistered,
//   ).length;

//   // =========================================================
//   // UI
//   // =========================================================
//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         { backgroundColor: theme.bg },
//       ]}
//     >

//       {/* =====================================================
//           HEADER
//       ===================================================== */}
//       <View style={styles.headerBar}>
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//         >
//           <Icon
//             name="arrow-back"
//             size={20}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <Text style={styles.headerTitle}>
//           Forward Task To
//         </Text>

//         <Icon
//           name="search"
//           size={18}
//           color="#fff"
//         />
//       </View>

//       {/* =====================================================
//           SEARCH
//       ===================================================== */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#999"
//           value={search}
//           onChangeText={setSearch}
//           style={[
//             styles.searchInput,
//             { color: theme.text },
//           ]}
//         />
//       </View>

//       {/* =====================================================
//           STATS
//       ===================================================== */}
//       {!fetching && contacts.length > 0 && (
//         <View style={styles.statsRow}>

//           <View style={styles.statChip}>
//             <Icon
//               name="checkmark-circle"
//               size={13}
//               color="#4CAF50"
//             />

//             <Text style={styles.statText}>
//               {registeredCount} Registered
//             </Text>
//           </View>

//           <View style={styles.statChip}>
//             <Icon
//               name="person-outline"
//               size={13}
//               color="#FF9800"
//             />

//             <Text style={styles.statText}>
//               {externalCount} External
//             </Text>
//           </View>

//           {selectedCount > 0 && (
//             <View
//               style={[
//                 styles.statChip,
//                 {
//                   backgroundColor: '#E8F5E9',
//                 },
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.statText,
//                   {
//                     color: '#388E3C',
//                     fontWeight: '700',
//                   },
//                 ]}
//               >
//                 {selectedCount} Selected
//               </Text>
//             </View>
//           )}

//         </View>
//       )}

//       {/* =====================================================
//           CONTACT LIST
//       ===================================================== */}
//       {fetching ? (
//         <ActivityIndicator
//           size="large"
//           color={theme.text}
//           style={{ marginTop: 30 }}
//         />
//       ) : contacts.length === 0 ? (
//         <View style={styles.emptyBox}>
//           <Icon
//             name="people-outline"
//             size={40}
//             color={theme.text}
//           />

//           <Text
//             style={[
//               styles.emptyText,
//               { color: theme.text },
//             ]}
//           >
//             No contacts found.
//             {'\n'}
//             Add members to your groups first.
//           </Text>
//         </View>
//       ) : (
//         <ScrollView
//           contentContainerStyle={styles.content}
//         >

//           {/* CONTACTS */}
//           {filtered.map(item => {
//             const isExternal =
//               !item.isRegistered;

//             return (
//               <TouchableOpacity
//                 key={item.id}
//                 style={[
//                   styles.card,
//                   {
//                     backgroundColor:
//                       theme.card,
//                   },
//                   item.selected &&
//                     styles.cardSelected,
//                 ]}
//                 onPress={() =>
//                   toggle(item.id)
//                 }
//                 activeOpacity={0.8}
//               >

//                 {/* AVATAR */}
//                 <View
//                   style={[
//                     styles.avatar,
//                     item.selected
//                       ? styles.avatarSelected
//                       : isExternal
//                       ? styles.avatarExternal
//                       : styles.avatarDefault,
//                   ]}
//                 >
//                   <Text
//                     style={styles.avatarText}
//                   >
//                     {item.name
//                       ?.charAt(0)
//                       .toUpperCase()}
//                   </Text>
//                 </View>

//                 {/* CONTACT INFO */}
//                 <View style={{ flex: 1 }}>
//                   <Text
//                     style={[
//                       styles.name,
//                       {
//                         color: theme.text,
//                       },
//                     ]}
//                   >
//                     {item.name}
//                   </Text>

//                   {item.phone ? (
//                     <Text
//                       style={[
//                         styles.phone,
//                         {
//                           color: theme.text,
//                         },
//                       ]}
//                     >
//                       {item.phone}
//                     </Text>
//                   ) : null}

//                   {/* BADGE */}
//                   {isExternal ? (
//                     <View
//                       style={
//                         styles.externalBadgeRow
//                       }
//                     >
//                       <Icon
//                         name="person-outline"
//                         size={10}
//                         color="#FF9800"
//                       />

//                       <Text
//                         style={
//                           styles.externalBadge
//                         }
//                       >
//                         {' '}
//                         External — share manually
//                       </Text>
//                     </View>
//                   ) : (
//                     <View
//                       style={
//                         styles.registeredBadgeRow
//                       }
//                     >
//                       <Icon
//                         name="checkmark-circle-outline"
//                         size={10}
//                         color="#4CAF50"
//                       />

//                       <Text
//                         style={
//                           styles.registeredBadge
//                         }
//                       >
//                         {' '}
//                         Registered User
//                       </Text>
//                     </View>
//                   )}
//                 </View>

//                 {/* CHECKBOX */}
//                 <View
//                   style={[
//                     styles.checkbox,
//                     item.selected &&
//                       styles.checkboxSelected,
//                   ]}
//                 >
//                   {item.selected && (
//                     <Icon
//                       name="checkmark"
//                       size={16}
//                       color="#fff"
//                     />
//                   )}
//                 </View>

//               </TouchableOpacity>
//             );
//           })}

//           {/* NO SEARCH RESULT */}
//           {filtered.length === 0 &&
//             search.trim() !== '' && (
//               <Text
//                 style={[
//                   styles.noResult,
//                   { color: theme.text },
//                 ]}
//               >
//                 No contacts match "{search}"
//               </Text>
//             )}

//           {/* =================================================
//               SEND BUTTON
//           ================================================= */}
//           <TouchableOpacity
//             style={[
//               styles.sendBtn,
//               selectedCount === 0 &&
//                 styles.sendBtnDisabled,
//             ]}
//             onPress={SendTaskTo}
//             disabled={
//               loading ||
//               selectedCount === 0
//             }
//           >
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.sendText}>
//                 SEND TASK
//                 {selectedCount > 0
//                   ? ` (${selectedCount})`
//                   : ''}
//               </Text>
//             )}
//           </TouchableOpacity>

//         </ScrollView>
//       )}

//       {/* =====================================================
//           BOTTOM NAVIGATION
//       ===================================================== */}
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
//               'HomeDashboard',
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
//               'ContactScreen',
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
//             navigation.navigate(
//               'SettingScreen',
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

// export default ForwardTaskTo;

// // =========================================================
// // STYLES
// // =========================================================

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#B7C9DB',
//   },

//   headerBar: {
//     margin: 14,
//     backgroundColor: '#000',
//     borderRadius: 30,
//     height: 50,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 14,
//     justifyContent: 'space-between',
//   },

//   headerTitle: {
//     color: '#fff',
//     fontWeight: '700',
//     fontSize: 15,
//   },

//   searchWrapper: {
//     paddingHorizontal: 14,
//     marginBottom: 6,
//   },

//   searchInput: {
//     backgroundColor: '#EDEDED',
//     borderRadius: 25,
//     paddingHorizontal: 15,
//     height: 45,
//   },

//   statsRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 6,
//     paddingHorizontal: 14,
//     marginBottom: 8,
//   },

//   statChip: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     backgroundColor: '#f0f0f0',
//     borderRadius: 20,
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//   },

//   statText: {
//     fontSize: 11,
//     color: '#555',
//   },

//   content: {
//     paddingHorizontal: 14,
//     paddingBottom: 120,
//   },

//   card: {
//     borderRadius: 12,
//     padding: 14,
//     marginBottom: 12,
//     flexDirection: 'row',
//     alignItems: 'center',
//     elevation: 3,
//     borderWidth: 2,
//     borderColor: 'transparent',
//   },

//   cardSelected: {
//     borderColor: '#4CAF50',
//     backgroundColor: '#E8F5E9',
//   },

//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   avatarDefault: {
//     backgroundColor: '#6ED3E8',
//   },

//   avatarSelected: {
//     backgroundColor: '#4CAF50',
//   },

//   avatarExternal: {
//     backgroundColor: '#FF9800',
//   },

//   avatarText: {
//     color: '#fff',
//     fontWeight: '800',
//     fontSize: 16,
//   },

//   name: {
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   phone: {
//     fontSize: 11,
//     opacity: 0.7,
//     marginTop: 2,
//   },

//   externalBadgeRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 3,
//   },

//   externalBadge: {
//     fontSize: 10,
//     color: '#FF9800',
//     fontWeight: '600',
//   },

//   registeredBadgeRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 3,
//   },

//   registeredBadge: {
//     fontSize: 10,
//     color: '#4CAF50',
//     fontWeight: '600',
//   },

//   checkbox: {
//     width: 26,
//     height: 26,
//     borderWidth: 2,
//     borderColor: '#999',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 6,
//   },

//   checkboxSelected: {
//     backgroundColor: '#4CAF50',
//     borderColor: '#4CAF50',
//   },

//   noResult: {
//     textAlign: 'center',
//     marginTop: 20,
//     opacity: 0.6,
//   },

//   emptyBox: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: 12,
//   },

//   emptyText: {
//     textAlign: 'center',
//     opacity: 0.7,
//     lineHeight: 22,
//   },

//   sendBtn: {
//     marginTop: 30,
//     alignSelf: 'center',
//     backgroundColor: '#000',
//     paddingVertical: 14,
//     paddingHorizontal: 60,
//     borderRadius: 30,
//     elevation: 6,
//   },

//   sendBtnDisabled: {
//     backgroundColor: '#999',
//   },

//   sendText: {
//     color: '#fff',
//     fontWeight: '800',
//     letterSpacing: 1,
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     width: '100%',
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//   },
// });
