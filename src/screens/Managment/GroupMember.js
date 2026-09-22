import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { BASE_URL } from '../../config/api';

const GroupMembersScreen = ({ navigation, route }) => {
  const { theme } = useTheme();

  const groupId = route?.params?.groupId;
  const groupName = route?.params?.groupName || 'Group';

  const [members, setMembers] = useState([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!groupId) {
      Alert.alert('Error', 'Group ID is missing.');
      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session Expired', 'Please login again.');
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Managment/group/${groupId}/members`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log('Group Members API:', data);

      if (response.status === 401) {
        Alert.alert('Session Expired', 'Please login again.');
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || 'Failed to load group members.'
        );
      }

      setMembers(data.data?.members || []);
      setTotalMembers(data.data?.totalMembers || 0);
    } catch (error) {
      console.log('Group Members Error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Failed to load group members.'
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [fetchMembers])
  );

  const renderMember = ({ item }) => {
    const displayName =
      item.name ||
      `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
      'Unknown Member';

    const firstLetter = displayName.charAt(0).toUpperCase();

    return (
      <View
        style={[
          styles.memberCard,
          { backgroundColor: theme.card },
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {firstLetter}
          </Text>
        </View>

        <View style={styles.memberInfo}>
          <Text
            style={[
              styles.memberName,
              { color: theme.text },
            ]}
          >
            {displayName}
          </Text>

          {item.email ? (
            <View style={styles.detailRow}>
              <Icon
                name="mail-outline"
                size={15}
                color={theme.text}
              />
              <Text
                style={[
                  styles.detailText,
                  { color: theme.text },
                ]}
              >
                {item.email}
              </Text>
            </View>
          ) : null}

          {item.phone ? (
            <View style={styles.detailRow}>
              <Icon
                name="call-outline"
                size={15}
                color={theme.text}
              />
              <Text
                style={[
                  styles.detailText,
                  { color: theme.text },
                ]}
              >
                {item.phone}
              </Text>
            </View>
          ) : null}

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {item.role || 'Member'}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: item.isRegistered
                    ? '#E8F5E9'
                    : '#FFF3E0',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: item.isRegistered
                      ? '#2E7D32'
                      : '#EF6C00',
                  },
                ]}
              >
                {item.isRegistered
                  ? 'Registered'
                  : 'External'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.bg },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon
            name="arrow-back"
            size={23}
            color={theme.text}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.text },
            ]}
          >
            Group Members
          </Text>

          <Text
            style={[
              styles.groupName,
              { color: theme.text },
            ]}
          >
            {groupName}
          </Text>
        </View>

        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>
            {totalMembers}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.text}
          />
          <Text
            style={[
              styles.loadingText,
              { color: theme.text },
            ]}
          >
            Loading members...
          </Text>
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon
            name="people-outline"
            size={55}
            color={theme.text}
          />

          <Text
            style={[
              styles.emptyTitle,
              { color: theme.text },
            ]}
          >
            No Members
          </Text>

          <Text
            style={[
              styles.emptyText,
              { color: theme.text },
            ]}
          >
            This group does not have any members.
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item, index) =>
            String(item.id || item.userId || index)
          }
          renderItem={renderMember}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DADADA',
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  headerTitleContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
  },

  groupName: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.7,
  },

  headerCount: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6ED3E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerCountText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  list: {
    padding: 15,
    paddingBottom: 30,
  },

  memberCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6ED3E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  memberInfo: {
    flex: 1,
  },

  memberName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 5,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  detailText: {
    fontSize: 13,
    marginLeft: 7,
    opacity: 0.8,
  },

  badgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 7,
  },

  roleText: {
    color: '#1565C0',
    fontSize: 11,
    fontWeight: '700',
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 15,
  },

  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 7,
    opacity: 0.7,
  },
});

export default GroupMembersScreen;
